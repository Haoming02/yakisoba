This is a **Tauri** (`src`: `pnpm` + `Javascript` / `src-tauri`: `cargo` + `Rust`) program to train LoRA for Anima models

---

## Installation

- Default the installation path to "sd-scripts" folder under "Documents" (filled in, not just placeholder)
- Error if the path is a file (current behavior)
- If the path is not empty, try to `git clone` into it
    - e.g. Given "Documents", result in "Documents/sd-scripts"
    - Error if "sd-scripts" already exists
- If the path is empty, treat it as the target folder
    - i.e. `cd` the parent folder, and `git clone` with that folder as the name
- If the path does not exists, treat it as the target folder too, and create all intermediate folders as needed
- Remember to save the actual final folder to the config
- Hide the logs box if it's empty after an error (e.g. when the given path is invalid)
- When the installation succeed, change the button to green and the text to "Installed" (only on fresh install ; in future launches, just disable the button (current behavior))
- Set the status indicators to use default cursor (instead of text)

## Paths

- Add the placeholders:
    - Checkpoint: "anima-base-v1.0.safetensors"
    - Text Encoder: "qwen_3_06b_base.safetensors"
    - VAE: "qwen_image_vae.safetensors"
- Remove the placeholder for Output Filename
- Fix the "Open Folder" buttons
    - Right now they open the desired folders correctly, but also open a file dialogue. Stop the latter.
