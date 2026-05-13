# Website

This website is built using [Docusaurus](https://docusaurus.io/), a modern static website generator.

## Installation

Use **Node.js 20 or newer** (see `package.json` → `engines`). Older Node versions can fail the build with errors such as `crypto is not defined` from bundler dependencies.

```bash
yarn
```

## Local Development

```bash
yarn start
```

This command starts a local development server and opens up a browser window. Most changes are reflected live without having to restart the server.

### Homepage / `src/pages` crashes at runtime?

If you see **"This page crashed"** with a message like *the page … doesn't have a **default export***, the cause is almost always a file under **`src/pages/`** (including `index.tsx` for `/`) that only uses named exports. Docusaurus maps each page file to a URL and expects **`export default` of a React component** (either `export default function Page()` or `export default Page` at the bottom). Rename-only refactors sometimes drop the default export; restore it and reload.

For context, **`baseUrl`** in `docusaurus.config.ts` only changes the URL prefix (e.g. `/flixelgdx-website/` on GitHub Pages); it does not replace this requirement.

## Build

```bash
yarn build
```

This command generates static content into the `build` directory and can be served using any static contents hosting service.

## Deployment

Using SSH:

```bash
USE_SSH=true yarn deploy
```

Not using SSH:

```bash
GIT_USER=<Your GitHub username> yarn deploy
```

If you are using GitHub pages for hosting, this command is a convenient way to build the website and push to the `gh-pages` branch.
