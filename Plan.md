This is a **Tauri** (`src`: `pnpm` + `Javascript` / `src-tauri`: `cargo` + `Rust`) program to train LoRA for Anima models

---

## Installation

- Remove the green color style after installation. Instead, streamline both fresh successful install and future launches (if installed):
    1. Disable the "Install" button (current behavior)
    2. Darken the color slightly (current behavior)
    3. Change the text to "Installed"
    4. Keep the default cursor

## Paths

- Add tool tips:
    - Open Config Folder: Open the folder that contains the config file that saves the paths
    - Open Temp Folder: Open the folder that contains the last training `.toml`
    - (rewrite for better clarity)

## Parameters

- Update the styling for checkbox types
    - Right now items within a row are aligned on the top. But since other types have the texts, the background of checkbox thus appears higher than others.
    - Within the background, the text appears lower than the checkbox instead
    - Fix both
- Move the "Resume From Weights" into the Paths tab, under "Output Path", with a Browse button too
    - Make the Browse button file extension for Checkpoint, Text Encoder, VAE, and Resume From Weights filter `.safetensors` only
- Remove "W&B Run Name"

## Masked Training

- Move the "Masked Loss" checkbox into the Paths tab, under "Dataset Path", and default it to disabled
- Add a new folder "Conditioning Data Path" with browse button, which only shows up when "Masked Loss" is enabled
- When training, if "Masked Loss" is enabled, additionally pass the following flag at the end of the call

    ```bash
    --conditioning_data_dir <path-to-Conditioning-Data>
    ```

    - `masked_loss` is still saved to the `.toml` (current behavior)
    - If "Masked Loss" is enabled, error if "Conditioning Data Path" is not provided
