const { invoke } = window.__TAURI__.core;
const { open } = window.__TAURI__.dialog;
const { listen } = window.__TAURI__.event;
const notification = window.__TAURI__.notification;

const OPTIMIZERS = [
  "AdamW",
  "AdamWScheduleFree",
  "AdamW8bit",
  "Adafactor",
  "DAdaptation",
  "DAdaptAdam",
  "DAdaptLion",
  "DAdaptSGD",
  "Lion",
  "Lion8bit",
  "Prodigy",
];

const LR_SCHEDULERS = ["adafactor", "constant", "constant_with_warmup", "cosine", "cosine_with_restarts", "linear"];

const PARAM_GROUPS = [
  {
    name: "Network",
    fields: [
      { key: "network_module", label: "Network Module", type: "string", default: "networks.lora_anima" },
      { key: "network_dim", label: "Network Dim", type: "int", default: 8 },
      { key: "network_alpha", label: "Network Alpha", type: "int", default: 4 },
      { key: "network_train_unet_only", label: "Train DiT Only", type: "bool", default: true },
      { key: "network_args", label: "Network Args", type: "list", default: [], hint: "comma separated" },
    ],
  },
  {
    name: "Training",
    fields: [
      { key: "train_batch_size", label: "Batch Size", type: "int", default: 2 },
      { key: "epoch", label: "Epoch", type: "int", default: 16 },
      { key: "max_train_steps", label: "Max Train Steps", type: "int", default: 288 },
      { key: "seed", label: "Seed", type: "int", default: 2023 },
      { key: "max_data_loader_n_workers", label: "Data Loader Workers", type: "int", default: 0 },
      { key: "gradient_accumulation_steps", label: "Gradient Accumulation Steps", type: "int", default: 1 },
      { key: "gradient_checkpointing", label: "Gradient Checkpointing", type: "bool", default: true },
      {
        key: "mixed_precision",
        label: "Mixed Precision",
        type: "enum",
        default: "bf16",
        options: ["no", "fp16", "bf16", "fp32"],
      },
      {
        key: "dynamo_backend",
        label: "Dynamo Backend",
        type: "enum",
        default: "inductor",
        options: ["none", "cudagraphs", "inductor", "explain", "aot_eager"],
      },
      { key: "highvram", label: "High VRAM", type: "bool", default: true },
      { key: "xformers", label: "Xformers", type: "bool", default: true },
    ],
  },
  {
    name: "Learning Rate & Optimizer",
    fields: [
      { key: "learning_rate", label: "Learning Rate", type: "float", default: 0.1 },
      { key: "unet_lr", label: "DiT Learning Rate", type: "float", default: 0.1 },
      {
        key: "optimizer_type",
        label: "Optimizer Type",
        type: "enum",
        default: "optimizer.prodigy_plus_schedulefree.ProdigyPlusScheduleFree",
        options: OPTIMIZERS,
      },
      { key: "optimizer_args", label: "Optimizer Args", type: "list", default: [], hint: "comma separated" },
      { key: "lr_scheduler", label: "LR Scheduler", type: "enum", default: "constant", options: LR_SCHEDULERS },
      { key: "lr_scheduler_num_cycles", label: "LR Scheduler Num Cycles", type: "int", default: 1 },
      { key: "lr_scheduler_power", label: "LR Scheduler Power", type: "int", default: 1 },
      { key: "lr_scheduler_args", label: "LR Scheduler Args", type: "list", default: [], hint: "comma separated" },
    ],
  },
  {
    name: "Data & Buckets",
    fields: [
      { key: "resolution", label: "Resolution", type: "string", default: "1024,1024" },
      { key: "enable_bucket", label: "Enable Bucket", type: "bool", default: true },
      { key: "bucket_reso_steps", label: "Bucket Reso Steps", type: "int", default: 64 },
      { key: "bucket_no_upscale", label: "Bucket No Upscale", type: "bool", default: true },
      { key: "min_bucket_reso", label: "Min Bucket Reso", type: "int", default: 768 },
      { key: "max_bucket_reso", label: "Max Bucket Reso", type: "int", default: 1536 },
      { key: "caption_extension", label: "Caption Extension", type: "string", default: ".txt" },
      { key: "shuffle_caption", label: "Shuffle Caption", type: "bool", default: true },
      { key: "keep_tokens", label: "Keep Tokens", type: "int", default: 2 },
      { key: "cache_latents", label: "Cache Latents", type: "bool", default: true },
      { key: "skip_cache_check", label: "Skip Cache Check", type: "bool", default: true },
    ],
  },
  {
    name: "Loss & Timestep",
    fields: [
      {
        key: "loss_type",
        label: "Loss Type",
        type: "enum",
        default: "l2",
        options: ["l1", "l2", "huber", "smooth_l1"],
      },
      { key: "huber_scale", label: "Huber Scale", type: "int", default: 1 },
      { key: "huber_c", label: "Huber C", type: "float", default: 0.1 },
      { key: "huber_schedule", label: "Huber Schedule", type: "enum", default: "snr", options: ["snr", "fixed"] },
      { key: "prior_loss_weight", label: "Prior Loss Weight", type: "float", default: 0.5 },
      {
        key: "timestep_sampling",
        label: "Timestep Sampling",
        type: "enum",
        default: "sigmoid",
        options: ["sigma", "uniform", "sigmoid", "shift", "flux_shift"],
      },
      { key: "discrete_flow_shift", label: "Discrete Flow Shift", type: "float", default: 1.0 },
      { key: "sigmoid_scale", label: "Sigmoid Scale", type: "float", default: 1.0 },
      {
        key: "noise_offset_type",
        label: "Noise Offset Type",
        type: "enum",
        default: "Original",
        options: ["Original", "Radial"],
      },
      { key: "max_timestep", label: "Max Timestep", type: "int", default: 1000 },
    ],
  },
  {
    name: "VAE & Encoding",
    fields: [
      { key: "vae_batch_size", label: "VAE Batch Size", type: "int", default: 4 },
      { key: "qwen3_max_token_length", label: "Qwen3 Max Token Length", type: "int", default: 512 },
      { key: "t5_max_token_length", label: "T5 Max Token Length", type: "int", default: 512 },
    ],
  },
  {
    name: "Saving & Metadata",
    fields: [
      {
        key: "save_model_as",
        label: "Save Model As",
        type: "enum",
        default: "safetensors",
        options: ["safetensors", "ckpt", "diffusers", "diffusers_safetensors"],
      },
      {
        key: "save_precision",
        label: "Save Precision",
        type: "enum",
        default: "bf16",
        options: ["no_save", "fp16", "bf16", "fp32"],
      },
      { key: "save_every_n_epochs", label: "Save Every N Epochs", type: "int", default: 4 },
      { key: "metadata_author", label: "Metadata Author", type: "string", default: "", optional: true },
    ],
  },
];

const PATH_FIELDS = [
  { key: "pretrained_model_name_or_path", id: "checkpoint" },
  { key: "qwen3", id: "text-encoder" },
  { key: "vae", id: "vae" },
  { key: "train_data_dir", id: "dataset" },
  { key: "output_dir", id: "output" },
  { key: "network_weights", id: "resume-weights" },
  { key: "output_name", id: "output-name" },
];

const CONFIG_FIELDS = [
  { id: "installation", key: "installation" },
  { id: "checkpoint", key: "checkpoint" },
  { id: "text-encoder", key: "textEncoder" },
  { id: "vae", key: "vae" },
  { id: "output", key: "output" },
];

const status = { git: false, uv: false, sdScripts: false };
let training = false;
let installing = false;

const $ = (id) => document.getElementById(id);

function notifyError(message) {
  const body = String(message);
  (async () => {
    try {
      let granted = await notification.isPermissionGranted();
      if (!granted) {
        granted = (await notification.requestPermission()) === "granted";
      }
      if (granted) {
        notification.sendNotification({ title: "Yakisoba", body });
      }
    } catch (e) {
      console.error("Failed to send notification", e);
    }
  })();
}

const STATUS_LABELS = { "status-git": "git", "status-uv": "uv", "status-sd": "sd-scripts" };

function setStatus(id, ok) {
  const el = $(id);
  el.classList.toggle("ok", ok);
  el.title = ok ? `${STATUS_LABELS[id]} is installed` : `${STATUS_LABELS[id]} is not installed`;
}

function updateInstallButton() {
  const btn = $("install-btn");
  if (installing) {
    btn.disabled = true;
    btn.classList.remove("installed");
    btn.textContent = "Installing...";
    btn.title = "Installation in progress";
    return;
  }
  if (status.sdScripts) {
    btn.disabled = true;
    btn.classList.add("installed");
    btn.textContent = "Installed";
    btn.title = "sd-scripts is already installed";
  } else {
    btn.disabled = true;
    btn.classList.remove("installed");
    btn.textContent = "Install";
    const missing = [!status.git && "git", !status.uv && "uv"].filter(Boolean);
    if (missing.length) {
      btn.title = `Missing: ${missing.join(", ")}`;
    } else {
      btn.disabled = false;
      btn.title = "Install sd-scripts";
    }
  }
}

function renderParameters() {
  const root = $("parameters");
  root.innerHTML = "";
  for (const group of PARAM_GROUPS) {
    const section = document.createElement("div");
    section.className = "group";
    const heading = document.createElement("h2");
    heading.textContent = group.name;
    section.appendChild(heading);

    const grid = document.createElement("div");
    grid.className = "grid";
    const ordered = [
      ...group.fields.filter((f) => f.type !== "bool"),
      ...group.fields.filter((f) => f.type === "bool"),
    ];
    for (const field of ordered) {
      grid.appendChild(renderField(field));
    }
    section.appendChild(grid);
    root.appendChild(section);
  }
}

function renderField(field) {
  const wrap = document.createElement("div");
  wrap.className = "param";

  if (field.type === "bool") {
    wrap.classList.add("param-bool");
    const label = document.createElement("label");
    label.className = "toggle";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.id = `param-${field.key}`;
    input.checked = Boolean(field.default);
    const text = document.createElement("span");
    text.textContent = field.label;
    label.appendChild(input);
    label.appendChild(text);
    wrap.appendChild(label);
    return wrap;
  }

  const label = document.createElement("label");
  label.htmlFor = `param-${field.key}`;
  label.textContent = field.label;
  wrap.appendChild(label);

  let input;
  if (field.type === "enum") {
    input = document.createElement("select");
    for (const option of field.options) {
      const el = document.createElement("option");
      el.value = option;
      el.textContent = option;
      if (option === field.default) el.selected = true;
      input.appendChild(el);
    }
  } else {
    input = document.createElement("input");
    if (field.type === "int" || field.type === "float") {
      input.type = "number";
      if (field.type === "float") input.step = "any";
    } else {
      input.type = "text";
    }
    input.id = `param-${field.key}`;
    input.spellcheck = false;
    if (field.type === "list") {
      input.placeholder = field.hint || "comma separated";
      input.value = (field.default || []).join(", ");
    } else {
      input.value = String(field.default);
    }
  }
  input.id = `param-${field.key}`;
  wrap.appendChild(input);

  if (field.hint && field.type !== "list") {
    const hint = document.createElement("div");
    hint.className = "hint";
    hint.textContent = field.hint;
    wrap.appendChild(hint);
  }
  return wrap;
}

function escapeToml(value) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function tomlValue(field, raw) {
  switch (field.type) {
    case "bool":
      return raw ? "true" : "false";
    case "int": {
      const n = parseInt(raw, 10);
      return Number.isFinite(n) ? String(n) : String(field.default ?? 0);
    }
    case "float": {
      let n = parseFloat(raw);
      if (!Number.isFinite(n)) n = Number(field.default) || 0;
      return Number.isInteger(n) ? n.toFixed(1) : String(n);
    }
    case "enum":
    case "string":
      return `"${escapeToml(raw)}"`;
    case "list": {
      const items = String(raw)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      return `[${items.map((s) => `"${escapeToml(s)}"`).join(", ")}]`;
    }
    default:
      return `"${escapeToml(raw)}"`;
  }
}

function buildToml() {
  const lines = [];

  for (const { key, id } of PATH_FIELDS) {
    const value = $(id).value.trim();
    if (value) lines.push(`${key} = ${tomlValue({ type: "string" }, value)}`);
  }

  lines.push(`masked_loss = ${$("masked-loss").checked ? "true" : "false"}`);

  for (const group of PARAM_GROUPS) {
    for (const field of group.fields) {
      const el = $(`param-${field.key}`);
      if (!el) continue;
      if (field.type === "bool") {
        lines.push(`${field.key} = ${tomlValue(field, el.checked)}`);
        continue;
      }
      const raw = el.value;
      if (field.optional && String(raw).trim() === "") continue;
      lines.push(`${field.key} = ${tomlValue(field, raw)}`);
    }
  }

  return lines.join("\n") + "\n";
}

function collectConfig() {
  const config = {};
  for (const { id, key } of CONFIG_FIELDS) {
    config[key] = $(id).value.trim();
  }
  return config;
}

let saveTimer = null;
function scheduleSaveConfig() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try {
      await invoke("save_config", { config: collectConfig() });
    } catch (e) {
      notifyError(`Failed to save config: ${e}`);
    }
  }, 400);
}

async function refresh() {
  const state = await invoke("init_state");
  status.git = state.git;
  status.uv = state.uv;
  status.sdScripts = state.sdScripts;
  setStatus("status-git", status.git);
  setStatus("status-uv", status.uv);
  setStatus("status-sd", status.sdScripts);

  $("installation").value = state.config.installation || state.defaultInstallation || "";
  $("checkpoint").value = state.config.checkpoint || "";
  $("text-encoder").value = state.config.textEncoder || "";
  $("vae").value = state.config.vae || "";
  $("output").value = state.config.output || "";

  updateInstallButton();
}

function setTraining(running) {
  training = running;
  const btn = $("train-btn");
  btn.textContent = running ? "Terminate" : "Train";
  btn.classList.toggle("running", running);
}

async function handleBrowse(button) {
  const target = button.dataset.target;
  const kind = button.dataset.kind;
  const options =
    kind === "dir"
      ? { directory: true }
      : {
        multiple: false,
        filters: [{ name: "Model", extensions: ["safetensors"] }],
      };
  const path = await open(options);
  if (path) {
    $(target).value = path;
    if (CONFIG_FIELDS.some((f) => f.id === target)) scheduleSaveConfig();
  }
}

async function handleInstall() {
  const path = $("installation").value.trim();
  if (!path) {
    notifyError("Installation path is empty");
    return;
  }
  installing = true;
  updateInstallButton();
  const log = $("install-log");
  log.hidden = false;
  log.textContent = "";
  try {
    await invoke("install", { path });
  } catch (e) {
    installing = false;
    if (!log.textContent) log.hidden = true;
    updateInstallButton();
    notifyError(String(e));
  }
}

async function handleTrain() {
  if (training) {
    try {
      await invoke("terminate_training");
    } catch (e) {
      notifyError(String(e));
    }
    return;
  }

  const installPath = $("installation").value.trim();
  const required = [
    [installPath, "installation path"],
    [$("checkpoint").value.trim(), "checkpoint path"],
    [$("text-encoder").value.trim(), "text encoder path"],
    [$("vae").value.trim(), "VAE path"],
    [$("dataset").value.trim(), "dataset path"],
    [$("output").value.trim(), "output path"],
  ];
  const missing = required.filter(([value]) => !value).map(([, label]) => label);
  if (missing.length) {
    notifyError(`Missing required path(s): ${missing.join(", ")}`);
    return;
  }

  const outputName = $("output-name").value.trim();
  if (outputName && /[<>:"/\\|?*]/.test(outputName)) {
    notifyError(`Invalid characters in output filename: <>:"/\\|?*`);
    return;
  }

  const maskedLoss = $("masked-loss").checked;
  const conditioningData = $("conditioning-data").value.trim();
  if (maskedLoss && !conditioningData) {
    notifyError("Conditioning Data Path is required when Masked Loss is enabled");
    return;
  }

  try {
    await invoke("start_training", {
      installPath,
      toml: buildToml(),
      conditioningDataDir: maskedLoss ? conditioningData : null,
    });
  } catch (e) {
    notifyError(String(e));
  }
}

window.addEventListener("DOMContentLoaded", async () => {
  renderParameters();

  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
      document.querySelectorAll(".page").forEach((p) => p.classList.remove("active"));
      tab.classList.add("active");
      $(`page-${tab.dataset.tab}`).classList.add("active");
    });
  });

  document.querySelectorAll(".browse[data-target]").forEach((button) => {
    button.addEventListener("click", () => handleBrowse(button));
  });

  CONFIG_FIELDS.forEach(({ id }) => {
    $(id).addEventListener("change", scheduleSaveConfig);
  });

  $("install-btn").addEventListener("click", handleInstall);
  $("train-btn").addEventListener("click", handleTrain);
  $("masked-loss").addEventListener("change", () => {
    $("conditioning-field").hidden = !$("masked-loss").checked;
  });
  $("open-config").addEventListener("click", () => {
    invoke("open_config_folder").catch((e) => notifyError(String(e)));
  });
  $("open-temp").addEventListener("click", () => {
    invoke("open_temp_folder").catch((e) => notifyError(String(e)));
  });

  await listen("install-log", (event) => {
    const log = $("install-log");
    log.textContent += `${event.payload}\n`;
    log.scrollTop = log.scrollHeight;
  });

  await listen("install-done", async (event) => {
    installing = false;
    const log = $("install-log");
    if (event.payload === "ok") {
      await refresh();
    } else {
      if (!log.textContent) log.hidden = true;
      updateInstallButton();
      notifyError(String(event.payload).replace(/^error::/, ""));
    }
  });

  await listen("train-status", (event) => {
    setTraining(Boolean(event.payload));
  });

  try {
    await refresh();
  } catch (e) {
    notifyError(`Failed to initialize: ${e}`);
  }
});
