This is a **Tauri** (`src`: `pnpm` + `Javascript` / `src-tauri`: `cargo` + `Rust`) program to train LoRA for Anima models

---

## Web

- Disable auto-complete for every text input

## Installation

- For the "git" and "uv" indicators, when they are not installed, change the cursor to `pointer`, and open the following site when clicked:
    - git: https://git-scm.com/install
    - uv: https://github.com/astral-sh/uv#installation

## Paths

- Change the tool tip of "Open Config Folder" to "Open the folder containing the paths config (.json)"

## Parameters

- Disable the interaction for "Network Module", "Train DiT Only", "DiT Learning Rate", "Save Model As"
    - still serialize them
- Sync "DiT Learning Rate" to "Learning Rate"
    - i.e. when Learning Rate is changed, update "DiT Learning Rate" to be the same
- Remove "Network Args", "Noise Offset Type", "Max Timestep"
- Remove "no_save" option from "Save Precision"
- Default "High VRAM" and "Skip Cache Check" to off
- Change "Resolution" to a dropdown, with option 512, 768, 1024, 1280, 1536. When serializing, still save as "512,512", etc.
