This is a **Tauri** (`src`: `pnpm` + `Javascript` / `src-tauri`: `cargo` + `Rust`) program to train LoRA for Anima models

---

## Parameters

#### Training

- Remove "Dynamo Backend"
- Reorder Checkbox: Persistent Data Loader Workers, Gradient Checkpoint, xformers (change label to lower case), CUDA Allow TF32, High VRAM, Low RAM

#### Learning Rate & Optimizer

- Move "Optimizer Type" to the first field
- Add "polynomial" as the last option to "LR Scheduler"
- Hide "LR Scheduler Num Cycles" and "LR Scheduler Power" by default
    - Only show them when "LR Scheduler" is `cosine_with_restarts` or `polynomial`
- Swap the order between "LR Warmup Steps & Scale Weight Norms" with "LR Scheduler Num Cycles & LR Scheduler Power"
    - i.e. place the 2 now-hidden fields at the end

#### Data & Buckets

- Remove "Min Bucket Reso" and "Max Bucket Reso"
- Disable "Bucket No Upscale" (still serialize)
- Hide "Bucket Reso Steps" and "Bucket No Upscale" if "Enable Bucket" is disabled

#### Loss & Timestep

- Hide "Huber Scale", "Huber C", "Huber Schedule" by default
    - Only show them when "Loss Type" is `huber` or `smooth_l1`
- For "Timestep Sampling", keep only "sigmoid" and "shift" options
- Remove "Discrete Flow Shift" and "Sigmoid Scale"
- If "Timestep Sampling" is "shift", additionally serialize "discrete_flow_shift" with value of `3` (otherwise omit)
- Move "Prior Loss Weight" to before "Debiased Estimation Loss"

## Install

- In the call that installs `torch` & `xformers`, add "triton-windows<3.9.0" or "triton<3.9.0" depending on OS
