# Agent Instructions

- Always run the project's checks before committing. At minimum, run
  `npm run lint` and `npm run build` from the `frontend` directory.
- Ensure the git pre-commit hook at `.githooks/pre-commit` is configured (use
  `git config core.hooksPath .githooks`) so commits fail if these checks do not
  pass.
- Do not commit code that fails these checks or CI/CD.
