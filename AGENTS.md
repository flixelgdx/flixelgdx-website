# AGENTS.md

## Cursor Cloud specific instructions

This repository (`flixelgdx-website`) is currently an empty scaffold — it contains only a `README.md`. There are no source files, dependency manifests, build configs, tests, or CI pipelines.

**Current state (as of initial setup):**
- No application code exists; nothing to build, run, lint, or test.
- No package manager lockfiles or dependency manifests are present.
- No Docker, devcontainer, or CI configuration exists.

**When code is added**, future agents should:
1. Re-evaluate the tech stack (the README mentions Java/FlixelGDX, but the website itself may use a different stack).
2. Install dependencies matching whatever manifest appears (e.g., `package.json` → `npm install`, `pom.xml` → `mvn install`, etc.).
3. Update the VM update script accordingly via `SetupVmEnvironment`.
