This is a **Tauri** (`src`: `pnpm` + `Javascript` / `src-tauri`: `cargo` + `Rust`) program to train LoRA for Anima models

---

## Layouts

- Make the content container slightly wider. No need to squeeze everything in a square.
- For the Parameters tab
    - Change to 4 instead of 3 columns
    - Right now a checkbox is way higher than number or dropdown in the same row. Reorder the fields so that different types are in different rows, to look more aligned.
    - Right now, the field only takes up ~75% of the width, causing the right side looks way emptier than the left side. Make the field span across its column (with margin).

## Installation

- Add hover tooltip to the "git", "uv", "sd-scripts" indicators that shows whether the item is installed
- Add hover tooltip to the "Install" button that shows which item is still missing, or that the sd-scripts is already installed

## Paths

- Add 2 buttons that open the config and the temp folder respectively

## Parameters

- Remove the Sampling section

---

## Sanity Check

- Go over all functions again to check if the inputs are always validated
- Ensure that dependencies are installed within the venv, and the training call is using the venv
