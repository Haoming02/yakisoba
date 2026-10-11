use serde::{Deserialize, Serialize};
use std::fs;
use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::{Arc, Mutex};
use tauri::path::BaseDirectory;
use tauri::{AppHandle, Emitter, Manager, State};

type TrainState = Arc<Mutex<Option<u32>>>;

#[derive(Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct Config {
    pub installation: String,
    pub checkpoint: String,
    pub text_encoder: String,
    pub vae: String,
    pub output: String,
}

#[derive(Serialize)]
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

fn read_config(app: &AppHandle) -> Config {
    let path = match config_path(app) {
        Ok(p) => p,
        Err(_) => return Config::default(),
    };
    match fs::read_to_string(&path) {
        Ok(s) => serde_json::from_str(&s).unwrap_or_default(),
        Err(_) => Config::default(),
    }
}

fn write_config(app: &AppHandle, config: &Config) -> Result<(), String> {
    let path = config_path(app)?;
    let body = serde_json::to_string_pretty(config).map_err(|e| e.to_string())?;
    fs::write(&path, body).map_err(|e| e.to_string())
}

fn cmd_ok(program: &str, args: &[&str]) -> bool {
    let mut cmd = Command::new(program);
    cmd.args(args);
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
        .map_err(|e| format!("Failed to start `{program}`: {e}"))?;

    let stdout = child.stdout.take().unwrap();
    let stderr = child.stderr.take().unwrap();

    let stderr_app = app.clone();
    let stderr_thread = std::thread::spawn(move || {
        for line in BufReader::new(stderr).lines() {
            if let Ok(line) = line {
                let _ = stderr_app.emit("install-log", line);
            }
        }
    });

    for line in BufReader::new(stdout).lines() {
        if let Ok(line) = line {
            let _ = app.emit("install-log", line);
        }
    }
    let _ = stderr_thread.join();

    let status = child.wait().map_err(|e| e.to_string())?;
    if status.success() {
        Ok(())
    } else {
        Err(format!("`{program}` exited with status {status}"))
    }
}

fn toml_string_value(toml: &str, key: &str) -> Option<String> {
    let prefix = format!("{key} = ");
    for line in toml.lines() {
        let line = line.trim();
        if !line.starts_with(&prefix) {
            continue;
        }
        let value = line[prefix.len()..].trim();
        if value.len() >= 2 && value.starts_with('"') && value.ends_with('"') {
            let mut out = String::new();
            let mut chars = value[1..value.len() - 1].chars();
            while let Some(c) = chars.next() {
                if c == '\\' {
                    match chars.next() {
                        Some('\\') => out.push('\\'),
                        Some('"') => out.push('"'),
                        Some(other) => out.push(other),
                        None => {}
                    }
                } else {
                    out.push(c);
                }
            }
            return Some(out);
        }
    }
    None
}

#[tauri::command]
fn init_state(app: AppHandle) -> InitState {
    let config = read_config(&app);
    let git = cmd_ok("git", &["--version"]);
    let uv = cmd_ok("uv", &["--version"]);
    let sd_scripts = !config.installation.is_empty()
        && Path::new(&config.installation).is_dir()
        && Path::new(&config.installation).join("venv").is_dir();
    InitState {
        config,
        git,
        uv,
        sd_scripts,
        default_installation: default_installation(&app),
    }
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
fn open_temp_folder() -> Result<(), String> {
    tauri_plugin_opener::open_path(std::env::temp_dir(), None::<&str>).map_err(|e| e.to_string())
}

fn dir_is_empty(path: &Path) -> Result<bool, String> {
    let mut entries = fs::read_dir(path).map_err(|e| e.to_string())?;
    Ok(entries.next().is_none())
}

#[tauri::command]
fn install(app: AppHandle, path: String) -> Result<(), String> {
    let target = PathBuf::from(&path);
    if target.as_os_str().is_empty() {
        return Err("Installation path is empty".into());
    }
    if target.is_file() {
        return Err("Installation path points to a file".into());
    }

    let (clone_cwd, clone_name, final_dir) = if target.exists() && !dir_is_empty(&target)? {
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
            .ok_or("Installation path has no parent directory")?;
        let name = target
            .file_name()
            .ok_or("Installation path has no folder name")?
            .to_string_lossy()
            .to_string();
        (parent.to_path_buf(), Some(name), target.clone())
    };

    let worker = app.clone();
    std::thread::spawn(move || {
        let result = (|| -> Result<PathBuf, String> {
            let mut clone_args: Vec<&str> = vec!["clone", "https://github.com/kohya-ss/sd-scripts"];
            if let Some(name) = &clone_name {
                clone_args.push(name);
            }
            run_stream(&worker, "git", &clone_args, &clone_cwd)?;
            run_stream(&worker, "uv", &["venv", "venv"], &final_dir)?;
            let python = venv_python(&final_dir).to_string_lossy().to_string();
            run_stream(
                &worker,
                "uv",
                &[
                    "pip",
                    "install",
                    "torch==2.14.0+cu130",
                    "torchvision==0.29.0+cu130",
                    "xformers",
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

#[tauri::command]
fn start_training(
    app: AppHandle,
    state: State<'_, TrainState>,
    install_path: String,
    toml: String,
    conditioning_data_dir: Option<String>,
) -> Result<(), String> {
    if state.lock().map_err(|e| e.to_string())?.is_some() {
        return Err("Training is already running".into());
    }

    let install = PathBuf::from(&install_path);
    if !install.is_dir() {
        return Err("Installation path is not set or does not exist".into());
    }
    let python = venv_python(&install);
    if !python.is_file() {
        return Err("Virtual environment not found in the installation path".into());
    }
    let script = install.join("anima_train_network.py");
    if !script.is_file() {
        return Err("anima_train_network.py not found in the installation path".into());
    }

    if let Some(checkpoint) = toml_string_value(&toml, "pretrained_model_name_or_path") {
        if !Path::new(&checkpoint).is_file() {
            return Err(format!("Checkpoint not found: {checkpoint}"));
        }
    }
    if let Some(dataset) = toml_string_value(&toml, "train_data_dir") {
        if !Path::new(&dataset).is_dir() {
            return Err(format!("Dataset directory not found: {dataset}"));
        }
    }
    if let Some(output) = toml_string_value(&toml, "output_dir") {
        fs::create_dir_all(&output).map_err(|e| e.to_string())?;
    }

    if let Some(dir) = &conditioning_data_dir {
        if !Path::new(dir).is_dir() {
            return Err(format!("Conditioning data directory not found: {dir}"));
        }
    }

    let param_file = std::env::temp_dir().join("yakisoba_param.toml");
    fs::write(&param_file, &toml).map_err(|e| e.to_string())?;

    let mut cmd = Command::new(&python);
    cmd.arg(&script)
        .arg("--config_file")
        .arg(&param_file)
        .current_dir(&install);
    if let Some(dir) = &conditioning_data_dir {
        cmd.arg("--conditioning_data_dir").arg(dir);
    }
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x0000_0010); // CREATE_NEW_CONSOLE so the training logs are visible
    }

    let child = cmd
        .spawn()
        .map_err(|e| format!("Failed to start training: {e}"))?;
    let pid = child.id();
    *state.lock().map_err(|e| e.to_string())? = Some(pid);
    let _ = app.emit("train-status", true);

    let monitor = state.inner().clone();
    std::thread::spawn(move || {
        let mut child = child;
        let _ = child.wait();
        if let Ok(mut guard) = monitor.lock() {
            *guard = None;
        }
        let _ = app.emit("train-status", false);
    });

    Ok(())
}

#[tauri::command]
fn terminate_training(state: State<'_, TrainState>) -> Result<(), String> {
    let pid = *state.lock().map_err(|e| e.to_string())?;
    if let Some(pid) = pid {
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
    Ok(())
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
            save_config,
            open_config_folder,
            open_temp_folder,
            install,
            start_training,
            terminate_training
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
