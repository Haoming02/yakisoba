This is a **Tauri** (`src`: `pnpm` + `Javascript` / `src-tauri`: `cargo` + `Rust`) program to train LoRA for Anima models

---

### Rust

- Use the `rust-skills` skill to review and optimize the Rust implementation (`src-tauri/lib.rs`)
    - **Key Features**
        - `git clone` the specified repository
        - `uv pip install` the dependencies
        - serialze and deserialize `.toml` files
        - call the `.py` script to start training

- Ensure that the `.exit` file is deleted afterwards
- Make comments concise and remove redundent ones
- Use the `toml` crate to handle `.toml` files
