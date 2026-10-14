This is a **Tauri** (`src`: `pnpm` + `Javascript` / `src-tauri`: `cargo` + `Rust`) program to train LoRA for Anima models

---

## Parameters

- Default "Max Train Steps" to 0
- Default "Seed" to 1337
- Default "Learning Rate" & "DiT Learning Rate" to 1.0
- Default "Optimizer Type" to "Prodigy"
- Default "Prior Loss Weight" to 1.0
- Default "VAE Batch Size" to 1

## Training

- Change the training config path from `<tauri-temp-folder>/yakisoba_param.toml` to `<tauri-config-folder>/training/<YYYYMMDD-hhmmss>.toml`
- Update the training process call with the new path
- Change "Open Temp Folder" to "Open Training Folder", and opens the new path on click
