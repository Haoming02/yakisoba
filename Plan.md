This is a **Tauri** (`src`: `pnpm` + `Javascript` / `src-tauri`: `cargo` + `Rust`) program to train LoRA for Anima models

---

## Target

- Update `git clone` tag from `0.12.0` to `0.12.2`

## Parameters

> reference: https://github.com/kohya-ss/sd-scripts/blob/main/docs/anima_train_network.md#5-lora-target-modules--lora%E3%81%AE%E5%AD%A6%E7%BF%92%E5%AF%BE%E8%B1%A1%E3%83%A2%E3%82%B8%E3%83%A5%E3%83%BC%E3%83%AB

- Add a new checkbox "Train adaLN"
    - When enabled, append `include_patterns = ['.*adaln.*']` in the `.toml`
