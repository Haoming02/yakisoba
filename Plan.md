This is a **Tauri** (`src`: `pnpm` + `Javascript` / `src-tauri`: `cargo` + `Rust`) program to train LoRA for Anima models

---

### General Bug Fix

- Make the "Train" to "Terminate" change synchronous first
    - prevent accidental double-click when the `async` function is still firing
- Also raise error if text encoder / vae are missing
- Make every "separated by comma" field behave like CSV format
    - i.e. respect quotations when splitting
- When checking whether to serialize Epoch or Steps, raise error if both are `0`
- Change the `first line contains "sd-scripts"` check to whether `anima_train_network.py` exists
    - and remove the check inside the training function
- When loading a `-P.toml`, the model paths get deserialized onto the UI surrounded with `'` character, making the next train fail
    - This does not happen with the `-D.toml` paths however
