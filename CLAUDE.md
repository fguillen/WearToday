# Wear Today

Vanilla JS + Vite PWA that recommends what to wear in Berlin today. See [PRODUCT.md](PRODUCT.md) for the spec.

- `npm test`: Vitest (jsdom)
- `npm run dev`: dev server; `/?fixture=cold-rain&now=15:30` opens the weather simulator
- Pushing to `main` deploys to GitHub Pages

## Workflow

- **Bump the version with every user-facing change.** Edit `APP_VERSION` in [src/version.js](src/version.js): patch for fixes, minor for new features. Set `"version"` in `package.json` to the same value with `npm version <x.y.z> --no-git-tag-version`. The footer shows this version, and it's how the user checks that an installed phone copy has updated. A test fails if the two differ.
- **Commit after every finished task.** Stage files explicitly and write an imperative message. `.claude/hooks/require-commit.sh` checks this.
- All user-facing strings live in [src/copy.js](src/copy.js).
