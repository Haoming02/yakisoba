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

const LR_SCHEDULERS = [
  "adafactor",
  "constant",
  "constant_with_warmup",
  "cosine",
  "cosine_with_restarts",
  "linear",
  "polynomial",
];

const DEFAULT_WORKERS = (() => {
  try {
    const n = Math.floor(window.navigator.hardwareConcurrency / 2);
    return Number.isFinite(n) ? n : 0;
  } catch (e) {
    return 0;
  }
})();

const PARAM_GROUPS = [
  {
    name: "Network",
    fields: [
      {
        key: "network_module",
        label: "Network Module",
        type: "string",
        default: "networks.lora_anima",
        disabled: true,
      },
      { key: "network_dim", label: "Network Dim", type: "int", default: 8 },
      { key: "network_alpha", label: "Network Alpha", type: "int", default: 4 },
      { key: "network_dropout", label: "Network Dropout", type: "float", default: 0.0 },
      { key: "network_train_unet_only", label: "Train DiT Only", type: "bool", default: true, disabled: true },
    ],
  },
  {
    name: "Training",
    fields: [
      { key: "train_batch_size", label: "Batch Size", type: "int", default: 2 },
      { key: "max_train_epochs", label: "Max Train Epochs", type: "int", default: 16, epochSteps: true },
      { key: "max_train_steps", label: "Max Train Steps", type: "int", default: 0, epochSteps: true },
      { key: "seed", label: "Seed", type: "int", default: 1337 },
      { key: "max_data_loader_n_workers", label: "Data Loader Workers", type: "int", default: DEFAULT_WORKERS },
      { key: "gradient_accumulation_steps", label: "Gradient Accumulation Steps", type: "int", default: 1 },
      { key: "max_grad_norm", label: "Max Grad Norm", type: "float", default: 1.0 },
      {
        key: "mixed_precision",
        label: "Mixed Precision",
        type: "enum",
        default: "bf16",
        options: ["no", "fp16", "bf16", "fp32"],
      },
      { key: "persistent_data_loader_workers", label: "Persistent Data Loader Workers", type: "bool", default: false },
      { key: "gradient_checkpointing", label: "Gradient Checkpointing", type: "bool", default: true },
      { key: "xformers", label: "xformers", type: "bool", default: true },
      { key: "cuda_allow_tf32", label: "CUDA Allow TF32", type: "bool", default: false },
      { key: "highvram", label: "High VRAM", type: "bool", default: false },
      { key: "lowram", label: "Low RAM", type: "bool", default: false },
    ],
  },
  {
    name: "Learning Rate & Optimizer",
    fields: [
      {
        key: "optimizer_type",
        label: "Optimizer Type",
        type: "enum",
        default: "Prodigy",
        options: OPTIMIZERS,
      },
      { key: "learning_rate", label: "Learning Rate", type: "float", default: 1.0 },
      { key: "unet_lr", label: "DiT Learning Rate", type: "float", default: 1.0, disabled: true },
      { key: "optimizer_args", label: "Optimizer Args", type: "list", default: [], hint: "comma separated" },
      { key: "lr_scheduler", label: "LR Scheduler", type: "enum", default: "constant", options: LR_SCHEDULERS },
      { key: "lr_warmup_steps", label: "LR Warmup Steps", type: "int", default: 0 },
      { key: "scale_weight_norms", label: "Scale Weight Norms", type: "float", default: 0.0 },
      { key: "lr_scheduler_args", label: "LR Scheduler Args", type: "list", default: [], hint: "comma separated" },
      { key: "lr_scheduler_num_cycles", label: "LR Scheduler Num Cycles", type: "int", default: 1 },
      { key: "lr_scheduler_power", label: "LR Scheduler Power", type: "int", default: 1 },
    ],
  },
  {
    name: "Data & Buckets",
    fields: [
      {
        key: "resolution",
        label: "Resolution",
        type: "enum",
        default: "1024",
        options: ["512", "768", "1024", "1280", "1536"],
      },
      { key: "caption_extension", label: "Caption Extension", type: "string", default: ".txt" },
      {
        key: "shuffle_caption",
        label: "Caption Processing",
        type: "radio",
        default: "shuffle_caption",
        options: [
          { key: "shuffle_caption", label: "Shuffle Caption" },
          { key: "cache_text_encoder_outputs", label: "Cache Text Encoder Outputs" },
        ],
      },
      { key: "caption_dropout_rate", label: "Caption Dropout Rate", type: "float", default: 0.0 },
      { key: "caption_tag_dropout_rate", label: "Caption Tag Dropout Rate", type: "float", default: 0.0 },
      { key: "cache_latents", label: "Cache Latents", type: "bool", default: true },
      { key: "skip_cache_check", label: "Skip Cache Check", type: "bool", default: false },
      { key: "enable_bucket", label: "Enable Bucket", type: "bool", default: true },
      { key: "bucket_no_upscale", label: "Bucket No Upscale", type: "bool", default: true, disabled: true },
      { key: "bucket_reso_steps", label: "Bucket Reso Steps", type: "int", default: 64 },
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
      {
        key: "timestep_sampling",
        label: "Timestep Sampling",
        type: "enum",
        default: "sigmoid",
        options: ["sigmoid", "shift"],
      },
      { key: "prior_loss_weight", label: "Prior Loss Weight", type: "float", default: 1.0 },
      { key: "debiased_estimation_loss", label: "Debiased Estimation Loss", type: "bool", default: false },
    ],
  },
  {
    name: "VAE & Encoding",
    fields: [
      { key: "vae_batch_size", label: "VAE Batch Size", type: "int", default: 1 },
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
        disabled: true,
      },
      {
        key: "save_precision",
        label: "Save Precision",
        type: "enum",
        default: "bf16",
        options: ["fp16", "bf16", "fp32"],
      },
      { key: "save_every_n_epochs", label: "Save Every N Epochs", type: "int", default: 4 },
      { key: "metadata_author", label: "Metadata Author", type: "string", default: "", optional: true },
    ],
  },
];

const CONDITIONAL_FIELDS = [
  {
    controller: "lr_scheduler",
    options: ["cosine_with_restarts", "polynomial"],
    targets: ["lr_scheduler_num_cycles", "lr_scheduler_power"],
  },
  {
    controller: "loss_type",
    options: ["huber", "smooth_l1"],
    targets: ["huber_scale", "huber_c", "huber_schedule"],
  },
  {
    controller: "enable_bucket",
    targets: ["bucket_reso_steps", "bucket_no_upscale"],
  },
];

function updateConditionalFields() {
  for (const { controller, options, targets } of CONDITIONAL_FIELDS) {
    const el = $(`param-${controller}`);
    const active = options ? options.includes(el.value) : el.checked;
    for (const key of targets) {
      $(`param-${key}`).closest(".param").hidden = !active;
    }
  }
}

const PATH_FIELDS = [
  { key: "pretrained_model_name_or_path", id: "checkpoint" },
  { key: "qwen3", id: "text-encoder" },
  { key: "vae", id: "vae" },
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

const datasetEntries = [];

const REPEAT_NAME_RE = /^(\d+)_(.+)$/;

function folderName(path) {
  const trimmed = path.replace(/[\\/]+$/, "");
  const parts = trimmed.split(/[\\/]/);
  return parts[parts.length - 1] || trimmed;
}

function joinPath(base, name) {
  const sep = base.includes("\\") ? "\\" : "/";
  return /[\\/]$/.test(base) ? base + name : base + sep + name;
}

function toInt(raw, fallback) {
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : fallback;
}

function addDatasetEntry(fields = {}) {
  datasetEntries.push({
    isReg: false,
    imageDir: "",
    overrides: "",
    conditioningDataDir: "",
    keepTokens: 0,
    numRepeats: 1,
    ...fields,
  });
}

function entryField(labelText, value, onChange, options = {}) {
  const wrap = document.createElement("div");
  wrap.className = "entry-field";
  if (options.span) wrap.classList.add("entry-span-2");

  const label = document.createElement("label");
  label.textContent = labelText;
  if (options.id) label.htmlFor = options.id;
  wrap.appendChild(label);

  const control = document.createElement("div");
  control.className = "control";
  const input = document.createElement("input");
  input.type = options.number ? "number" : "text";
  if (options.number) input.min = "0";
  input.spellcheck = false;
  input.autocomplete = "off";
  if (options.id) input.id = options.id;
  if (options.placeholder) input.placeholder = options.placeholder;
  input.value = String(value);
  input.addEventListener("input", () => onChange(input.value));
  control.appendChild(input);

  if (options.browse) {
    const button = document.createElement("button");
    button.className = "browse";
    button.textContent = "Browse";
    button.dataset.target = options.id;
    button.dataset.kind = "dir";
    control.appendChild(button);
  }
  wrap.appendChild(control);
  return wrap;
}

function renderDatasetEntries() {
  const root = $("dataset-entries");
  root.innerHTML = "";
  datasetEntries.forEach((entry, index) => {
    const row = document.createElement("div");
    row.className = "dataset-entry";

    row.appendChild(
      entryField(
        "Image Folder",
        entry.imageDir,
        (v) => {
          entry.imageDir = v.trim();
        },
        { id: `entry-dir-${index}`, browse: true },
      ),
    );
    row.appendChild(
      entryField(
        "Overrides",
        entry.overrides,
        (v) => {
          entry.overrides = v;
        },
        { placeholder: "comma separated", span: 2 },
      ),
    );

    const reg = document.createElement("label");
    reg.className = "toggle entry-reg";
    const regInput = document.createElement("input");
    regInput.type = "checkbox";
    regInput.checked = entry.isReg;
    regInput.addEventListener("change", () => {
      entry.isReg = regInput.checked;
    });
    const regText = document.createElement("span");
    regText.textContent = "Is Reg";
    reg.appendChild(regInput);
    reg.appendChild(regText);
    row.appendChild(reg);

    row.appendChild(
      entryField(
        "Conditioning Data Folder",
        entry.conditioningDataDir,
        (v) => {
          entry.conditioningDataDir = v.trim();
        },
        { id: `entry-cond-${index}`, browse: true },
      ),
    );
    row.appendChild(
      entryField(
        "Keep Tokens",
        entry.keepTokens,
        (v) => {
          entry.keepTokens = toInt(v, 0);
        },
        { number: true },
      ),
    );
    row.appendChild(
      entryField(
        "Num Repeats",
        entry.numRepeats,
        (v) => {
          entry.numRepeats = toInt(v, 1);
        },
        { number: true },
      ),
    );

    const remove = document.createElement("button");
    remove.className = "browse entry-remove";
    remove.textContent = "Remove";
    remove.addEventListener("click", () => {
      datasetEntries.splice(index, 1);
      renderDatasetEntries();
    });
    row.appendChild(remove);
    root.appendChild(row);
  });
}

async function processDroppedFolder(path) {
  const subdirs = await invoke("list_subdirectories", { path });
  const parsed = subdirs
    .map((name) => {
      const m = REPEAT_NAME_RE.exec(name);
      return m ? { name, numRepeats: parseInt(m[1], 10) } : null;
    })
    .filter(Boolean);
  if (parsed.length) {
    for (const sub of parsed) {
      addDatasetEntry({ imageDir: joinPath(path, sub.name), numRepeats: sub.numRepeats });
    }
    return;
  }
  const m = REPEAT_NAME_RE.exec(folderName(path));
  if (m) {
    addDatasetEntry({ imageDir: path, numRepeats: parseInt(m[1], 10) });
  } else {
    addDatasetEntry({ imageDir: path, numRepeats: 1 });
  }
}

const status = { git: false, uv: false, sdScripts: false };
let training = false;
let installing = false;

const $ = (id) => document.getElementById(id);

const EPOCH_STEPS_KEYS = ["max_train_epochs", "max_train_steps"];
let lastEditedEpochSteps = "max_train_epochs";

function epochStepsValue(key) {
  const n = parseInt($(`param-${key}`).value, 10);
  return Number.isFinite(n) ? n : 0;
}

function activeEpochSteps() {
  const other = lastEditedEpochSteps === "max_train_epochs" ? "max_train_steps" : "max_train_epochs";
  if (epochStepsValue(lastEditedEpochSteps) !== 0) return lastEditedEpochSteps;
  if (epochStepsValue(other) !== 0) return other;
  return null;
}

function updateEpochStepsUI() {
  const active = activeEpochSteps();
  for (const key of EPOCH_STEPS_KEYS) {
    $(`param-${key}`)
      .closest(".param")
      .classList.toggle("dimmed", key !== active);
  }
}

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

const INSTALL_LINKS = {
  "status-git": "https://git-scm.com/install",
  "status-uv": "https://github.com/astral-sh/uv#installation",
};

function setStatus(id, ok) {
  const el = $(id);
  el.classList.toggle("ok", ok);
  el.classList.toggle("clickable", !ok && id in INSTALL_LINKS);
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
    for (const field of group.fields) {
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
    if (field.disabled) {
      input.disabled = true;
      label.style.cursor = "default";
    }
    const text = document.createElement("span");
    text.textContent = field.label;
    label.appendChild(input);
    label.appendChild(text);
    wrap.appendChild(label);
    return wrap;
  }

  if (field.type === "radio") {
    wrap.classList.add("param-radio");
    for (const option of field.options) {
      const label = document.createElement("label");
      label.className = "toggle";
      const input = document.createElement("input");
      input.type = "radio";
      input.name = `param-${field.key}`;
      input.id = `param-${option.key}`;
      input.checked = option.key === field.default;
      const text = document.createElement("span");
      text.textContent = option.label;
      label.appendChild(input);
      label.appendChild(text);
      wrap.appendChild(label);
    }
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
    input.autocomplete = "off";
    if (field.type === "list") {
      input.placeholder = field.hint || "comma separated";
      input.value = (field.default || []).join(", ");
    } else {
      input.value = String(field.default);
    }
  }
  input.id = `param-${field.key}`;
  if (field.disabled) input.disabled = true;
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
      if (field.key === "resolution") return `"${escapeToml(raw)},${escapeToml(raw)}"`;
      return `"${escapeToml(raw)}"`;
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
  const epochStepsActive = activeEpochSteps();

  for (const { key, id } of PATH_FIELDS) {
    const value = $(id).value.trim();
    if (value) lines.push(`${key} = ${tomlValue({ type: "string" }, value)}`);
  }

  if (datasetEntries.length && datasetEntries.every((e) => e.conditioningDataDir)) {
    lines.push("masked_loss = true");
  }

  for (const group of PARAM_GROUPS) {
    for (const field of group.fields) {
      if (field.type === "radio") {
        const selected = field.options.find((o) => $(`param-${o.key}`).checked);
        if (selected) lines.push(`${selected.key} = true`);
        continue;
      }
      if (field.epochSteps) {
        if (field.key === epochStepsActive) {
          lines.push(`${field.key} = ${tomlValue(field, $(`param-${field.key}`).value)}`);
        }
        continue;
      }
      const el = $(`param-${field.key}`);
      if (!el) continue;
      if (field.type === "bool") {
        lines.push(`${field.key} = ${tomlValue(field, el.checked)}`);
        continue;
      }
      const raw = el.value;
      if (field.optional && String(raw).trim() === "") continue;
      lines.push(`${field.key} = ${tomlValue(field, raw)}`);
      if (field.key === "timestep_sampling" && raw === "shift") {
        lines.push(`discrete_flow_shift = 3.0`);
      }
      if (field.key === "resolution") {
        const reso = parseInt(raw, 10);
        if (Number.isFinite(reso)) {
          lines.push(`min_bucket_reso = ${Math.round(reso / 2)}`);
          lines.push(`max_bucket_reso = ${Math.round(reso * 1.5)}`);
        }
      }
    }
  }

  return lines.join("\n") + "\n";
}

function buildDatasetToml() {
  const lines = ["[[datasets]]"];
  for (const entry of datasetEntries) {
    lines.push("", "[[datasets.subsets]]");
    lines.push(`image_dir = ${tomlValue({ type: "string" }, entry.imageDir)}`);
    lines.push(`num_repeats = ${tomlValue({ type: "int" }, entry.numRepeats)}`);
    lines.push(`keep_tokens = ${tomlValue({ type: "int" }, entry.keepTokens)}`);
    if (entry.conditioningDataDir) {
      lines.push(`conditioning_data_dir = ${tomlValue({ type: "string" }, entry.conditioningDataDir)}`);
    }
    if (entry.isReg) lines.push("is_reg = true");
    for (const item of String(entry.overrides)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)) {
      lines.push(item);
    }
  }
  return lines.join("\n") + "\n";
}

const TOML_KEY_RE = /^([A-Za-z0-9_.-]+)\s*=\s*(.*)$/;
const TOML_SECTION_RE = /^\[\[([^\]]+)\]\]$/;

function parseTomlValue(raw) {
  raw = raw.trim();
  if (raw.startsWith('"')) {
    let out = "";
    let i = 1;
    while (i < raw.length && raw[i] !== '"') {
      if (raw[i] === "\\") i += 1;
      out += raw[i] ?? "";
      i += 1;
    }
    return out;
  }
  if (raw.startsWith("[")) {
    const inner = raw.slice(1, raw.lastIndexOf("]"));
    const items = [];
    let depth = 0;
    let inStr = false;
    let escaped = false;
    let current = "";
    for (const c of inner) {
      if (inStr) {
        current += c;
        if (escaped) escaped = false;
        else if (c === "\\") escaped = true;
        else if (c === '"') inStr = false;
        continue;
      }
      if (c === '"') {
        inStr = true;
        current += c;
      } else if (c === "[") {
        depth += 1;
        current += c;
      } else if (c === "]") {
        depth -= 1;
        current += c;
      } else if (c === "," && depth === 0) {
        items.push(current);
        current = "";
      } else {
        current += c;
      }
    }
    if (current.trim()) items.push(current);
    return items.map(parseTomlValue);
  }
  if (raw === "true") return true;
  if (raw === "false") return false;
  const n = Number(raw);
  if (raw !== "" && Number.isFinite(n)) return n;
  return raw;
}

function parseParamToml(text) {
  const parsed = {};
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("[")) continue;
    const m = TOML_KEY_RE.exec(trimmed);
    if (m) parsed[m[1]] = parseTomlValue(m[2]);
  }
  return parsed;
}

function parseDatasetToml(text) {
  const subsets = [];
  let current = null;
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const section = TOML_SECTION_RE.exec(trimmed);
    if (section) {
      current = section[1] === "datasets.subsets" ? {} : null;
      if (current) subsets.push(current);
      continue;
    }
    if (!current) continue;
    const m = TOML_KEY_RE.exec(trimmed);
    if (m) current[m[1]] = m[2].trim();
  }
  return subsets;
}

const DATASET_ENTRY_KEYS = new Set(["image_dir", "num_repeats", "keep_tokens", "conditioning_data_dir", "is_reg"]);

function applyDatasetPreset(subsets) {
  datasetEntries.length = 0;
  for (const subset of subsets) {
    const overrides = [];
    for (const [key, raw] of Object.entries(subset)) {
      if (!DATASET_ENTRY_KEYS.has(key)) overrides.push(`${key} = ${raw}`);
    }
    addDatasetEntry({
      imageDir: subset.image_dir !== undefined ? String(parseTomlValue(subset.image_dir)) : "",
      overrides: overrides.join(", "),
      conditioningDataDir:
        subset.conditioning_data_dir !== undefined ? String(parseTomlValue(subset.conditioning_data_dir)) : "",
      keepTokens: subset.keep_tokens !== undefined ? toInt(subset.keep_tokens, 0) : 0,
      numRepeats: subset.num_repeats !== undefined ? toInt(subset.num_repeats, 1) : 1,
      isReg: subset.is_reg === "true",
    });
  }
  renderDatasetEntries();
}

function applyParamPreset(parsed) {
  for (const group of PARAM_GROUPS) {
    for (const field of group.fields) {
      if (field.type === "radio") {
        const selected = field.options.find((o) => parsed[o.key] === true);
        if (selected) $(`param-${selected.key}`).checked = true;
        continue;
      }
      const value = parsed[field.key];
      if (value === undefined) continue;
      const el = $(`param-${field.key}`);
      if (!el) continue;
      if (field.type === "bool") {
        el.checked = Boolean(value);
      } else if (field.type === "list") {
        el.value = Array.isArray(value) ? value.join(", ") : String(value);
      } else if (field.type === "enum") {
        let option = String(value);
        if (option.includes(",")) option = option.split(",")[0].trim();
        if ([...el.options].some((o) => o.value === option)) el.value = option;
      } else {
        el.value = String(value);
      }
    }
  }

  for (const { key, id } of PATH_FIELDS) {
    const value = parsed[key];
    if (value !== undefined) $(id).value = String(value);
  }

  if (parsed.learning_rate !== undefined && parsed.unet_lr === undefined) {
    $("param-unet_lr").value = $("param-learning_rate").value;
  }

  const presetSteps = Number(parsed.max_train_steps);
  lastEditedEpochSteps = Number.isFinite(presetSteps) && presetSteps !== 0 ? "max_train_steps" : "max_train_epochs";

  updateConditionalFields();
  updateEpochStepsUI();
  if (PATH_FIELDS.some(({ key }) => parsed[key] !== undefined)) scheduleSaveConfig();
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

let checkTimer = null;
function scheduleCheckInstallation() {
  clearTimeout(checkTimer);
  checkTimer = setTimeout(async () => {
    let ok = false;
    try {
      ok = await invoke("check_installation", { path: $("installation").value.trim() });
    } catch (e) {
      ok = false;
    }
    status.sdScripts = ok;
    setStatus("status-sd", ok);
    updateInstallButton();
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
    const input = $(target);
    input.value = path;
    input.dispatchEvent(new Event("input"));
    if (CONFIG_FIELDS.some((f) => f.id === target)) scheduleSaveConfig();
    if (target === "installation") scheduleCheckInstallation();
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
    [$("output").value.trim(), "output path"],
  ];
  const missing = required.filter(([value]) => !value).map(([, label]) => label);
  if (missing.length) {
    notifyError(`Missing required path(s): ${missing.join(", ")}`);
    return;
  }

  if (!datasetEntries.length || datasetEntries.some((e) => !e.imageDir)) {
    notifyError("At least one dataset entry with an image directory is required");
    return;
  }

  if (datasetEntries.some((e) => e.conditioningDataDir && e.isReg)) {
    notifyError("Conditioning data folder and is reg cannot both be set for the same dataset entry");
    return;
  }

  const outputName = $("output-name").value.trim();
  if (!outputName) {
    notifyError("Output filename is required");
    return;
  }
  if (/[<>:"/\\|?*]/.test(outputName)) {
    notifyError(`Invalid characters in output filename: <>:"/\\|?*`);
    return;
  }

  const withConditioning = datasetEntries.filter((e) => e.conditioningDataDir).length;
  if (withConditioning && withConditioning !== datasetEntries.length) {
    notifyError("Conditioning data folder must be set for all or none of the dataset entries");
    return;
  }

  try {
    await invoke("start_training", {
      installPath,
      toml: buildToml(),
      datasetToml: buildDatasetToml(),
    });
  } catch (e) {
    notifyError(String(e));
  }
}

function activateTab(name) {
  document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t.dataset.tab === name));
  document.querySelectorAll(".page").forEach((p) => p.classList.remove("active"));
  $(`page-${name}`).classList.add("active");
}

function dropZoneUnder(event) {
  const position = event.payload?.position;
  if (!position) return null;
  const dpr = window.devicePixelRatio || 1;
  const el = document.elementFromPoint(position.x / dpr, position.y / dpr);
  return el?.closest(".drop-zone") || null;
}

function setDragHighlight(event) {
  const zone = dropZoneUnder(event);
  document.querySelectorAll(".drop-zone").forEach((el) => el.classList.toggle("dragging", el === zone));
}

function clearDragHighlight() {
  document.querySelectorAll(".drop-zone").forEach((el) => el.classList.remove("dragging"));
}

window.addEventListener("DOMContentLoaded", async () => {
  renderParameters();

  updateConditionalFields();
  for (const { controller } of CONDITIONAL_FIELDS) {
    $(`param-${controller}`).addEventListener("change", updateConditionalFields);
  }

  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => activateTab(tab.dataset.tab));
  });

  document.addEventListener("click", (event) => {
    const button = event.target.closest(".browse[data-target]");
    if (button) handleBrowse(button);
  });

  CONFIG_FIELDS.forEach(({ id }) => {
    $(id).addEventListener("change", scheduleSaveConfig);
  });

  $("installation").addEventListener("input", scheduleCheckInstallation);

  Object.entries(INSTALL_LINKS).forEach(([id, url]) => {
    $(id).addEventListener("click", () => {
      if (!$(id).classList.contains("ok")) {
        invoke("open_url", { url }).catch((e) => notifyError(String(e)));
      }
    });
  });

  $("param-learning_rate").addEventListener("input", () => {
    $("param-unet_lr").value = $("param-learning_rate").value;
  });

  for (const key of EPOCH_STEPS_KEYS) {
    $(`param-${key}`).addEventListener("input", () => {
      lastEditedEpochSteps = key;
      updateEpochStepsUI();
    });
  }
  updateEpochStepsUI();

  $("install-btn").addEventListener("click", handleInstall);
  $("train-btn").addEventListener("click", handleTrain);
  $("open-config").addEventListener("click", () => {
    invoke("open_config_folder").catch((e) => notifyError(String(e)));
  });
  $("open-training").addEventListener("click", () => {
    invoke("open_training_folder").catch((e) => notifyError(String(e)));
  });

  renderDatasetEntries();
  $("add-entry").addEventListener("click", () => {
    addDatasetEntry();
    renderDatasetEntries();
  });

  await listen("tauri://drag-enter", setDragHighlight);
  await listen("tauri://drag-over", setDragHighlight);
  await listen("tauri://drag-leave", clearDragHighlight);
  await listen("tauri://drag-drop", async (event) => {
    clearDragHighlight();
    const zone = dropZoneUnder(event);
    if (!zone) return;
    const paths = event.payload?.paths || [];

    if (zone.id === "drop-zone") {
      let added = false;
      for (const path of paths) {
        try {
          if (!(await invoke("is_directory", { path }))) continue;
          await processDroppedFolder(path);
          added = true;
        } catch (e) {
          notifyError(String(e));
        }
      }
      if (added) renderDatasetEntries();
      return;
    }

    const tomlPaths = paths.filter((p) => /\.toml$/i.test(p));
    if (!tomlPaths.length) return;

    if (zone.id === "preset-dataset") {
      const subsets = [];
      for (const path of tomlPaths) {
        try {
          subsets.push(...parseDatasetToml(await invoke("read_file", { path })));
        } catch (e) {
          notifyError(String(e));
        }
      }
      if (subsets.length) {
        applyDatasetPreset(subsets);
        activateTab("dataset");
      }
    } else if (zone.id === "preset-parameters") {
      let applied = false;
      for (const path of tomlPaths) {
        try {
          applyParamPreset(parseParamToml(await invoke("read_file", { path })));
          applied = true;
        } catch (e) {
          notifyError(String(e));
        }
      }
      if (applied) activateTab("parameters");
    }
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
