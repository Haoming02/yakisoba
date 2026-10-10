This is a **Tauri** (`src`: `pnpm` + `Javascript` / `src-tauri`: `cargo` + `Rust`) program to train LoRA for Anima models

---

## Frontend

- Style: Modern (Dark/Blue/Grey) Theme
- The UI should be responsive to be able to handle window resize

### Navbar

- Logo on the left
- 3 tab buttons on the right: "Installation", "Paths", "Parameters"

### Content Body

- Below the navbar row is a container for the actual contents
    - The page itself should not have any scrollbar
        - The navbar is fixed to the top ; the footer button is fixed to the bottom
    - Put the contents within the container
        - Only the container scrolls

#### Installation

- 1 text field with browse button:
    - installation path
- 3 status indicators above the button: "git", "uv", "sd-scripts"
- One big "Install" button

#### Paths

- 5 text fields with browse buttons:
    - checkpoint path
    - text encoder path
    - vae path
    - dataset path
    - output path
- 1 text field:
    - output filename

#### Parameters

- Place the input fields (e.g. steps / scheduler)
    - reference `example.toml` for what are needed
        - reference https://github.com/kohya-ss/sd-scripts/blob/main/docs/anima_train_network.md if unsure
    - infer the input type for each parameter (e.g. dropdown for optimizer / number field for epoch)
    - treat the values as the default values (excluding the paths)
    - group parameters logically

### Footer

- A full-width "Train" button

---

## Backend

### Configs

- Use the Tauri native function to create a persistent `config.json`, which stores the paths to installation, checkpoint, text encoder, vae, and output. When these fields are changed on the frontend, update the value in the config.
    - Do not save the dataset path or the output filename

### Init

- When the application is launched, read the `config.json` if exists and fill in the values.
- Try running `git --version`. If successful, set the "git" status green.
- Try running `uv --version`. If successful, set the "uv" status green.
- If installation path is in the config, check if the folder exists, and also contains a `venv` folder inside. If successful, set the "sd-scripts" status green.

### Install

- If "sd-scripts" is green, disable the "Install" button
- ElseIf "git" and "uv" are not green, disable the "Install" button
- Else, enable the "Install" button. When clicked:
    1. `git clone` the project to the given path
        - if the path is a file / is not empty, return with an error message
        - otherwise, (create the folder if not exist), clone the project under the given path
        - e.g. given "C:/project/train"

    ```bash
    cd C:/project/train
    git clone https://github.com/kohya-ss/sd-scripts
    ```

    2. `cd` into the project, create the virtual environment

    ```bash
    cd sd-scripts
    uv venv venv
    ```

    3. Install the dependencies inside the virtual environment

    ```
    uv pip install torch==2.14.0+cu130 torchvision==0.29.0+cu130 xformers --extra-index-url https://download.pytorch.org/whl/cu130
    uv pip install -r requirements.txt
    ```

    4. Once done, update the installation path to point to the `sd-scripts` folder itself

### Train

- When the "Train" button is clicked, collect the parameters and write to a temporary `param.toml` (same data types as `example.toml`), then start the training by calling in the virtual environment:
    - The console should be visible (it includes the training logs)

```bash
python sd-scripts/anima_train_network.py --config_file <temporary-path>/param.toml
```

- The "Train" button should also change to a red "Terminate" button, which kills the training process when clicked.
- When the training stops (terminated/failed/finished), the button reverts to "Train".

### Pop Up

- If any error is encountered, use the Tauri native function to send a desktop notification containing the error logs

---

If there is still anything unsure, reference https://github.com/bmaltais/kohya_ss , which is also another GUI wrapper
