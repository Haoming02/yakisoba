This is a **Tauri** (`src`: `pnpm` + `Javascript` / `src-tauri`: `cargo` + `Rust`) program to train LoRA for Anima models

---

## Installation

- Update the `git clone` command to clone the `v0.12.0` tag specifically, with `--filter blob:none` and `--depth 1` flags added

## Paths

- Remove "Masked Loss" and "Conditioning Data Path" fields (and the related visibility logics)

## Dataset

- Change the text of the drag&drop field to "Drag & Drop Dataset Folder(s) Here"
- Change the text of the button to "Add Empty Entry"
- Within each Entry, change the layout to two rows
    - Change "Image Dir" to "Image Folder"; Keep "Class Tokens" ; Move "Reg" checkbox to the end, and rename to "Is Reg"
    - Add a `conditioning_data_dir` (also use "folder" in label) field with browse button ; move the "Keep Tokens" and "Num Repeats" here (equal width as "Class Tokens") ; Keep "Remove" button
- Error if not **all** or **none** of entries contain `conditioning_data_dir`
    - i.e. cannot mix
- When serializing, omit `conditioning_data_dir` if empty (same behavior as `is_reg`)
- If all subsets contain `conditioning_data_dir`, then add `masked_loss = true` to the parameter `.toml` again

> These have been verified to work ; no need to validate

## Parameters

- Reorder **Data & Buckets**:

```
Resolution ; Caption Extension ; Shuffle Caption, Cache Text Encoder Outputs
Caption Dropout Rate ; Caption Tag Dropout Rate ; Cache Latents ; Skip Cache Check
Enable Bucket ; Bucket No Upscale ; Bucket Reso Steps
```

- Make disabling "Enable Bucket" also hide "Bucket No Upscale"
- Flatten "Shuffle Caption" & "Cache Text Encoder Outputs" horizontally (instead of stacking vertically)
- Join their background together, so the radio appears as the same group, span across 2 "columns"
