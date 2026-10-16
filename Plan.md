This is a **Tauri** (`src`: `pnpm` + `Javascript` / `src-tauri`: `cargo` + `Rust`) program to train LoRA for Anima models

---

### Frontend

- Fix the following linter reports:
    - `lint/style/useTemplate: Template literals are preferred over string concatenation.` x2
    - `lint/suspicious/useIterableCallbackReturn: This callback passed to forEach() iterable method should not return a value.` x4
    - `lint/correctness/noUnusedVariables: This variable e is unused.` x2

- Go through the entire JavaScript (`src/main.js`), clean up / simplify / refactor / optimize the logics
