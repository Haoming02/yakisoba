This is a **Tauri** (`src`: `pnpm` + `Javascript` / `src-tauri`: `cargo` + `Rust`) program to train LoRA for Anima models

---

## Parameters

- When serializing, additionally save 2 keys, `min_bucket_reso` and `max_bucket_reso`, with values equal to half of and `1.5` times of `resolution` respectively
    - e.g. if "Resolution" is `1024`, save `min` as `512` and `max` as `1536`

## Training

- When launching the training process, force the console window to `PAUSE` after the original script finishes
    - i.e. do not close the window automatically, so the user can review the logs / errors
- The "Terminate" button should return to "Train" once the script itself finishes
    - Do not kill the console on Terminate
- If Train is clicked again when the console is still open, kill the console and start a new process as usual
