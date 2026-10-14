This is a **Tauri** (`src`: `pnpm` + `Javascript` / `src-tauri`: `cargo` + `Rust`) program to train LoRA for Anima models

---

## Parameters

- Default "max_data_loader_n_workers" to `window.navigator.hardwareConcurrency / 2` (floor) or `0` (if error)

- Change "Epoch" to "Max Train Epochs", and serialize as "max_train_epochs"
- Make it so that, between "Max Train Epochs" and "Max Train Steps", only the last edited one that is not `0` gets serialized, and indicate it in the UI
    - e.g. dim the other one

- Change "shuffle_caption" to single-choice Radio buttons, with another choice "cache_text_encoder_outputs"
    - Only the selected one gets serialized with value `true`

- Add "lr_warmup_steps" (`int` ; default `0`)
- Add "max_grad_norm" (`float` ; default `1.0`)
- Add "scale_weight_norms" (`float` ; default `0.0`)
- Add "network_dropout", "caption_dropout_rate", "caption_tag_dropout_rate" (`float` ; default `0.0`)
- Add "debiased_estimation_loss" (`bool` ; default `false`)
- Add "lowram" (`bool` ; default `false`)
- Add "cuda_allow_tf32" (`bool` ; default `false`)
- Add "persistent_data_loader_workers" (`bool` ; default `false`)

## Training

- When serializing parameters, check the `Size on Disk` of the `VAE`. If it is under 200 MB, additionally add `qwen_image_vae_2d` with value `true` to the `.toml` ; otherwise, omit this key
