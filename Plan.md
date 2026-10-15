This is a **Tauri** (`src`: `pnpm` + `Javascript` / `src-tauri`: `cargo` + `Rust`) program to train LoRA for Anima models

---

## Training

- Error if "Output Filename" is empty
- Serialize the parameter `.toml` with a suffix `-P`
    - as opposed to `-D` for the dataset `.toml`

## Dataset

- Replace "Class Tokens" with "Overrides", add the same "comma separated" placeholder, and make the field span across 2 "columns"
    - i.e. align with the 2 fields below
    - When serializing, split the string by comma (and trim), then add the lines to the subset
    - (remove `class_tokens` key)
- Error if both `conditioning_data_dir` and `is_reg` are enabled at the same time

## Preset

- Add a new tab "Preset" after "Parameters"
- The tab contains two drag & drop fields, one for dataset config, one for parameter config
- They only accept `.toml` files ; do nothing otherwise
- On drop, deserialize the values to the respective tabs
    - For Dataset, dynamically rebuild the entires
- Then, switch to the tab afterwards
