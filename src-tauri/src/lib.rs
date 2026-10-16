use serde::{Deserialize, Serialize};
use std::fs;
use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::{Arc, Mutex};
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::path::BaseDirectory;
use tauri::{AppHandle, Emitter, Manager, State};

type TrainState = Arc<Mutex<Option<u32>>>;

const VAE_2D_MAX_SIZE: u64 = 200 * 1024 * 1024;

#[derive(Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct Config {
    pub installation: String,
    pub checkpoint: String,
    pub text_encoder: String,
    pub vae: String,
    pub output: String,
}

#[derive(Serialize, Default)]
#[serde(rename_all = "camelCase")]
struct InitState {
    config: Config,
    git: bool,
    uv: bool,
    sd_scripts: bool,
    default_installation: String,
}

fn default_installation(app: &AppHandle) -> String {
    app.path()
        .resolve("sd-scripts", BaseDirectory::Document)
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_default()
}

fn config_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_config_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join("config.json"))
}

fn training_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_config_dir()
        .map_err(|e| e.to_string())?
        .join("training");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

fn read_config(app: &AppHandle) -> Config {
    config_path(app)
        .ok()
        .and_then(|path| fs::read_to_string(path).ok())
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

fn write_config(app: &AppHandle, config: &Config) -> Result<(), String> {
    let path = config_path(app)?;
    let body = serde_json::to_string_pretty(config).map_err(|e| e.to_string())?;
    fs::write(&path, body).map_err(|e| e.to_string())
}

fn cmd_ok(program: &str, args: &[&str], cwd: Option<&Path>) -> bool {
    let mut cmd = Command::new(program);
    cmd.args(args);
    if let Some(dir) = cwd {
        cmd.current_dir(dir);
    }
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x0800_0000);
    }
    cmd.stdout(Stdio::null()).stderr(Stdio::null());
    matches!(cmd.status(), Ok(status) if status.success())
}

fn venv_python(base: &Path) -> PathBuf {
    if cfg!(windows) {
        base.join("venv").join("Scripts").join("python.exe")
    } else {
        base.join("venv").join("bin").join("python")
    }
}

struct ScriptsState {
    scripts: bool,
    venv: bool,
    library: bool,
}

impl ScriptsState {
    fn installed(&self) -> bool {
        self.scripts && self.venv && self.library
    }
}

fn scripts_state(path: &str) -> ScriptsState {
    let mut state = ScriptsState {
        scripts: false,
        venv: false,
        library: false,
    };
    if path.is_empty() {
        return state;
    }
    let dir = Path::new(path);
    if !dir.is_dir() || dir_is_empty(dir).unwrap_or(true) {
        return state;
    }
    state.scripts = dir.join("anima_train_network.py").is_file();
    if !state.scripts {
        return state;
    }
    state.venv = dir.join("venv").is_dir();
    if state.venv {
        let python = venv_python(dir);
        state.library = cmd_ok(
            &python.to_string_lossy(),
            &["-c", "import library"],
            Some(dir),
        );
    }
    state
}

fn run_stream(app: &AppHandle, program: &str, args: &[&str], cwd: &Path) -> Result<(), String> {
    let mut cmd = Command::new(program);
    cmd.args(args).current_dir(cwd);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x0800_0000);
    }
    let mut child = cmd
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("failed to start `{program}`: {e}"))?;

    let stdout = child.stdout.take().expect("stdout piped");
    let stderr = child.stderr.take().expect("stderr piped");

    let stderr_app = app.clone();
    let stderr_thread = std::thread::spawn(move || {
        for line in BufReader::new(stderr).lines().map_while(Result::ok) {
            let _ = stderr_app.emit("install-log", line);
        }
    });

    for line in BufReader::new(stdout).lines().map_while(Result::ok) {
        let _ = app.emit("install-log", line);
    }
    let _ = stderr_thread.join();

    let status = child.wait().map_err(|e| e.to_string())?;
    if status.success() {
        Ok(())
    } else {
        Err(format!("`{program}` exited with status {status}"))
    }
}

fn toml_str(table: &toml::Table, key: &str) -> Option<String> {
    table.get(key).and_then(|v| v.as_str().map(String::from))
}

fn image_dirs(dataset: &toml::Table) -> Vec<String> {
    let datasets: Vec<&toml::Value> = match dataset.get("datasets") {
        Some(toml::Value::Array(items)) => items.iter().collect(),
        Some(table @ toml::Value::Table(_)) => vec![table],
        _ => Vec::new(),
    };
    datasets
        .iter()
        .filter_map(|ds| ds.get("subsets").and_then(toml::Value::as_array))
        .flat_map(|subsets| subsets.iter())
        .filter_map(|subset| subset.get("image_dir").and_then(toml::Value::as_str))
        .map(String::from)
        .collect()
}

#[tauri::command]
async fn init_state(app: AppHandle) -> InitState {
    tauri::async_runtime::spawn_blocking(move || {
        let config = read_config(&app);
        InitState {
            git: cmd_ok("git", &["--version"], None),
            uv: cmd_ok("uv", &["--version"], None),
            sd_scripts: scripts_state(&config.installation).installed(),
            default_installation: default_installation(&app),
            config,
        }
    })
    .await
    .unwrap_or_default()
}

#[tauri::command]
async fn check_installation(path: String) -> bool {
    tauri::async_runtime::spawn_blocking(move || scripts_state(&path).installed())
        .await
        .unwrap_or(false)
}

#[tauri::command]
fn save_config(app: AppHandle, config: Config) -> Result<(), String> {
    write_config(&app, &config)
}

#[tauri::command]
fn open_config_folder(app: AppHandle) -> Result<(), String> {
    let dir = app.path().app_config_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    tauri_plugin_opener::open_path(&dir, None::<&str>).map_err(|e| e.to_string())
}

#[tauri::command]
fn open_training_folder(app: AppHandle) -> Result<(), String> {
    let dir = training_dir(&app)?;
    tauri_plugin_opener::open_path(&dir, None::<&str>).map_err(|e| e.to_string())
}

#[tauri::command]
fn open_url(url: String) -> Result<(), String> {
    tauri_plugin_opener::open_url(url, None::<&str>).map_err(|e| e.to_string())
}

fn dir_is_empty(path: &Path) -> Result<bool, String> {
    let mut entries = fs::read_dir(path).map_err(|e| e.to_string())?;
    Ok(entries.next().is_none())
}

#[tauri::command]
fn is_directory(path: String) -> bool {
    Path::new(&path).is_dir()
}

#[tauri::command]
fn read_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| format!("failed to read file: {e}"))
}

#[tauri::command]
fn list_subdirectories(path: String) -> Result<Vec<String>, String> {
    let mut dirs = Vec::new();
    for entry in fs::read_dir(&path).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        if entry.path().is_dir() {
            dirs.push(entry.file_name().to_string_lossy().to_string());
        }
    }
    dirs.sort();
    Ok(dirs)
}

#[tauri::command]
fn install(app: AppHandle, path: String) -> Result<(), String> {
    let target = PathBuf::from(&path);
    if target.as_os_str().is_empty() {
        return Err("installation path is empty".into());
    }
    if target.is_file() {
        return Err("installation path points to a file".into());
    }

    let scripts = scripts_state(&path);
    let (clone_cwd, clone_name, final_dir) = if scripts.scripts {
        (target.clone(), None, target.clone())
    } else if target.exists() && !dir_is_empty(&target)? {
        let clone_dest = target.join("sd-scripts");
        if clone_dest.exists() {
            return Err("sd-scripts already exists in the installation path".into());
        }
        (target.clone(), None, clone_dest)
    } else {
        if !target.exists() {
            fs::create_dir_all(&target).map_err(|e| e.to_string())?;
        }
        let parent = target
            .parent()
            .filter(|p| !p.as_os_str().is_empty())
            .ok_or("installation path has no parent directory")?;
        let name = target
            .file_name()
            .ok_or("installation path has no folder name")?
            .to_string_lossy()
            .to_string();
        (parent.to_path_buf(), Some(name), target.clone())
    };

    let skip_clone = scripts.scripts;
    let has_venv = scripts.venv;
    let worker = app.clone();
    std::thread::spawn(move || {
        let result = (|| -> Result<PathBuf, String> {
            if !skip_clone {
                let mut clone_args: Vec<&str> = vec![
                    "clone",
                    "--branch",
                    "v0.12.0",
                    "--depth",
                    "1",
                    "--filter",
                    "blob:none",
                    "https://github.com/kohya-ss/sd-scripts",
                ];
                if let Some(name) = &clone_name {
                    clone_args.push(name);
                }
                run_stream(&worker, "git", &clone_args, &clone_cwd)?;
            }
            if !has_venv {
                run_stream(&worker, "uv", &["venv", "venv"], &final_dir)?;
            }
            let python = venv_python(&final_dir).to_string_lossy().to_string();
            let triton = if cfg!(windows) {
                "triton-windows<3.9.0"
            } else {
                "triton<3.9.0"
            };
            run_stream(
                &worker,
                "uv",
                &[
                    "pip",
                    "install",
                    "torch==2.14.0+cu130",
                    "torchvision==0.29.0+cu130",
                    "xformers",
                    triton,
                    "--extra-index-url",
                    "https://download.pytorch.org/whl/cu130",
                    "--python",
                    &python,
                ],
                &final_dir,
            )?;
            run_stream(
                &worker,
                "uv",
                &[
                    "pip",
                    "install",
                    "-r",
                    "requirements.txt",
                    "--python",
                    &python,
                ],
                &final_dir,
            )?;
            Ok(final_dir)
        })();

        match result {
            Ok(sd_scripts) => {
                let mut config = read_config(&worker);
                config.installation = sd_scripts.to_string_lossy().to_string();
                let _ = write_config(&worker, &config);
                let _ = worker.emit("install-done", "ok");
            }
            Err(error) => {
                let _ = worker.emit("install-done", format!("error::{error}"));
            }
        }
    });

    Ok(())
}

fn timestamp() -> String {
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    let days = (secs / 86400) as i64;
    let tod = secs % 86400;
    let z = days + 719468;
    let era = if z >= 0 { z } else { z - 146096 } / 146097;
    let doe = (z - era * 146097) as u64;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let y = yoe as i64 + era * 400 + if m <= 2 { 1 } else { 0 };
    format!(
        "{:04}{:02}{:02}-{:02}{:02}{:02}",
        y,
        m,
        d,
        tod / 3600,
        (tod % 3600) / 60,
        tod % 60
    )
}

fn kill_pid(pid: u32) {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        let _ = Command::new("taskkill")
            .args(["/F", "/T", "/PID", &pid.to_string()])
            .creation_flags(0x0800_0000)
            .status();
    }
    #[cfg(not(windows))]
    {
        let _ = Command::new("kill").args(["-9", &pid.to_string()]).status();
    }
}

// Kill python children so the console falls through to `pause` and logs stay readable
fn kill_training_children(pid: u32) {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        let query = format!(
            "Get-CimInstance Win32_Process -Filter \"ParentProcessId={pid}\" | Where-Object {{ $_.Name -like 'python*' }} | ForEach-Object {{ $_.ProcessId }}"
        );
        let output = Command::new("powershell")
            .args(["-NoProfile", "-NonInteractive", "-Command", &query])
            .creation_flags(0x0800_0000)
            .output();
        if let Ok(output) = output {
            for line in String::from_utf8_lossy(&output.stdout).lines() {
                if let Ok(child) = line.trim().parse::<u32>() {
                    kill_pid(child);
                }
            }
        }
    }
    #[cfg(not(windows))]
    {
        let _ = Command::new("pkill")
            .args(["-TERM", "-P", &pid.to_string()])
            .status();
    }
}

#[tauri::command]
fn start_training(
    app: AppHandle,
    state: State<'_, TrainState>,
    install_path: String,
    toml: String,
    dataset_toml: String,
) -> Result<(), String> {
    let install = PathBuf::from(&install_path);
    if !install.is_dir() {
        return Err("installation path is not set or does not exist".into());
    }
    let python = venv_python(&install);
    if !python.is_file() {
        return Err("virtual environment not found in the installation path".into());
    }
    let script = install.join("anima_train_network.py");

    let mut params: toml::Table =
        toml::from_str(&toml).map_err(|e| format!("invalid parameters: {e}"))?;
    let dataset: toml::Table =
        toml::from_str(&dataset_toml).map_err(|e| format!("invalid dataset config: {e}"))?;

    if let Some(checkpoint) = toml_str(&params, "pretrained_model_name_or_path") {
        if !Path::new(&checkpoint).is_file() {
            return Err(format!("checkpoint not found: {checkpoint}"));
        }
    }
    let image_dirs = image_dirs(&dataset);
    if image_dirs.is_empty() {
        return Err("no dataset entries to train".into());
    }
    for image_dir in &image_dirs {
        if !Path::new(image_dir).is_dir() {
            return Err(format!("dataset directory not found: {image_dir}"));
        }
    }
    if let Some(output) = toml_str(&params, "output_dir") {
        fs::create_dir_all(&output).map_err(|e| e.to_string())?;
    }

    if let Some(qwen3) = toml_str(&params, "qwen3") {
        if !Path::new(&qwen3).is_file() {
            return Err(format!("text encoder not found: {qwen3}"));
        }
    }
    if let Some(vae) = toml_str(&params, "vae") {
        if !Path::new(&vae).is_file() {
            return Err(format!("vae not found: {vae}"));
        }
        if matches!(fs::metadata(&vae), Ok(meta) if meta.len() < VAE_2D_MAX_SIZE) {
            params.insert("qwen_image_vae_2d".to_string(), toml::Value::Boolean(true));
        }
    }

    let stamp = timestamp();
    let dir = training_dir(&app)?;
    let param_file = dir.join(format!("{stamp}-P.toml"));
    let param_body = toml::to_string(&params).map_err(|e| e.to_string())?;
    fs::write(&param_file, param_body).map_err(|e| e.to_string())?;
    let dataset_file = dir.join(format!("{stamp}-D.toml"));
    fs::write(&dataset_file, &dataset_toml).map_err(|e| e.to_string())?;

    // Kill a lingering paused console from a previous run
    let lingering = {
        let mut guard = state.lock().map_err(|e| e.to_string())?;
        guard.take()
    };
    if let Some(pid) = lingering {
        kill_pid(pid);
    }

    #[cfg(windows)]
    {
        let marker = dir.join(format!("{stamp}.exit"));
        if let Ok(entries) = fs::read_dir(&dir) {
            for entry in entries.flatten() {
                if entry.path().extension().is_some_and(|ext| ext == "exit") {
                    let _ = fs::remove_file(entry.path());
                }
            }
        }
        let bat = app
            .path()
            .resolve(format!("yakisoba-{stamp}.bat"), BaseDirectory::Temp)
            .map_err(|e| e.to_string())?;
        let script_content = format!(
            "@echo off\r\n\"{}\" \"{}\" --config_file \"{}\" --dataset_config \"{}\"\r\ntype nul > \"{}\"\r\npause\r\n",
            python.to_string_lossy(),
            script.to_string_lossy(),
            param_file.to_string_lossy(),
            dataset_file.to_string_lossy(),
            marker.to_string_lossy(),
        );
        fs::write(&bat, script_content).map_err(|e| e.to_string())?;

        use std::os::windows::process::CommandExt;
        let mut cmd = Command::new("cmd");
        cmd.args(["/C", &bat.to_string_lossy()]);
        cmd.creation_flags(0x0000_0010); // CREATE_NEW_CONSOLE: keep training logs visible

        let child = cmd
            .spawn()
            .map_err(|e| format!("failed to start training: {e}"))?;
        let pid = child.id();
        *state.lock().map_err(|e| e.to_string())? = Some(pid);
        let _ = app.emit("train-status", true);

        let monitor = state.inner().clone();
        std::thread::spawn(move || {
            let mut child = child;
            let mut script_finished = false;
            loop {
                if marker.exists() {
                    script_finished = true;
                    break;
                }
                match child.try_wait() {
                    Ok(Some(_)) => break,
                    Ok(None) => std::thread::sleep(Duration::from_millis(250)),
                    Err(_) => break,
                }
            }

            if script_finished {
                if let Ok(guard) = monitor.lock() {
                    if *guard == Some(pid) {
                        drop(guard);
                        let _ = app.emit("train-status", false);
                    }
                }
                let _ = fs::remove_file(&marker);
                let _ = child.wait();
            }

            let mut cleared = false;
            if let Ok(mut guard) = monitor.lock() {
                if *guard == Some(pid) {
                    *guard = None;
                    cleared = true;
                }
            }
            if !script_finished && cleared {
                let _ = app.emit("train-status", false);
            }
        });
    }

    #[cfg(not(windows))]
    {
        let mut cmd = Command::new(&python);
        cmd.arg(&script)
            .arg("--config_file")
            .arg(&param_file)
            .arg("--dataset_config")
            .arg(&dataset_file)
            .current_dir(&install);

        let child = cmd
            .spawn()
            .map_err(|e| format!("failed to start training: {e}"))?;
        let pid = child.id();
        *state.lock().map_err(|e| e.to_string())? = Some(pid);
        let _ = app.emit("train-status", true);

        let monitor = state.inner().clone();
        std::thread::spawn(move || {
            let mut child = child;
            let _ = child.wait();
            let mut cleared = false;
            if let Ok(mut guard) = monitor.lock() {
                if *guard == Some(pid) {
                    *guard = None;
                    cleared = true;
                }
            }
            if cleared {
                let _ = app.emit("train-status", false);
            }
        });
    }

    Ok(())
}

#[tauri::command]
async fn terminate_training(state: State<'_, TrainState>) -> Result<(), String> {
    let Some(pid) = *state.lock().map_err(|e| e.to_string())? else {
        return Ok(());
    };
    tauri::async_runtime::spawn_blocking(move || {
        #[cfg(windows)]
        kill_training_children(pid);
        #[cfg(not(windows))]
        kill_pid(pid);
    })
    .await
    .map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .manage(Arc::new(Mutex::new(None::<u32>)))
        .invoke_handler(tauri::generate_handler![
            init_state,
            check_installation,
            save_config,
            open_config_folder,
            open_training_folder,
            open_url,
            is_directory,
            read_file,
            list_subdirectories,
            install,
            start_training,
            terminate_training
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
