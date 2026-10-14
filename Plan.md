This is a **Tauri** (`src`: `pnpm` + `Javascript` / `src-tauri`: `cargo` + `Rust`) program to train LoRA for Anima models

---

## Installation

- Update the `sd-scripts` check to:
    1. The path exists & is folder & is not empty
    2. README.md exists & contains "sd-scripts" in the first line
    3. The path contains a "venv" subfolder
    4. Trying to `import library` (inside `venv`) succeed

- Perform the above checks when "Installation Path" is edited too
    - i.e. pointing the path to an existing installation should greenlight the indicator too

- Additionally, when clicking install, perform the above checks again. If 3. or 4. fails, then skip the `git clone` and simply install the Python packages as usual
    - i.e. to support cloned but not setup repo
