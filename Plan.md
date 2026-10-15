This is a **Tauri** (`src`: `pnpm` + `Javascript` / `src-tauri`: `cargo` + `Rust`) program to train LoRA for Anima models

---

## Dataset Configs

- Remove "Dataset Path" from "Paths" tab
- Add a new "Dataset" tab between "Paths" and "Parameters"

> Reference https://raw.githubusercontent.com/kohya-ss/sd-scripts/refs/heads/main/docs/config_README-en.md for how the `.toml` works

- At the top of the "Dataset" tab, add a drag & drop field that accepts only folders
    - If the Tauri-native feature cannot block files, then simply do nothing when a file is dropped

- Next are multiple entries (created dynamically), each entry refers to a folder and includes "is_reg" (default `false`), "image_dir", "class_tokens", "keep_tokens" (default `0`), and "num_repeats" fields. Also add a remove button to delete the entry.

- If the dropped folder contains multiple subfolders with name `<num>_<name>`, load each subfolder as an entry, with the "class_tokens" set to the `<name>` and the "num_repeats" set to the `<num>`
- ElseIf the dropped folder is named `<num>_<name>`, load it as an entry with the same rule
- Else, load the folder still, with the "class_tokens" being the folder name and "num_repeats" default to `1`

- When starting training, serialize these into `<YYYYMMDD-hhmmss>-D.toml` in the same `training` folder, and pass to the training call using the `--dataset_config` flag
    - Exclude the `[general]` part, those are already handled in "Parameters" ; the parent `[[datasets]]` should contain no values either, those are already handled in `[[datasets.subsets]]`

## Parameters

- Remove "Keep Tokens" field
