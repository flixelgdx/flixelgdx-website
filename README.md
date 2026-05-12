# flixelgdx-website

The website for the powerful Java game development framework
[**FlixelGDX**](https://github.com/flixelgdx/flixelgdx). Built with
[Docusaurus 3](https://docusaurus.io/) and styled to feel like a
GitHub-flavoured Javadoc page, with red and pitch-black as the
primary colours.

It hosts:

- A welcoming **home page** with feature highlights, animations, and
  per-section scroll fades.
- A **Getting Started** page with a fully client-side **project
  generator** that produces a downloadable Gradle project (Java /
  Groovy / Kotlin, IDE-specific configs, JitPack-wired FlixelGDX
  dependency, optional expert mode with custom JVM flags and Gradle
  config).
- A **Your First Project** tutorial (build classic **Pong** step by
  step) with per-snippet language switching.
- An **API reference** generated from the framework's Java sources
  via [Dokka GFM](https://kotlinlang.org/docs/dokka-introduction.html)
  and embedded as Docusaurus docs.

## Repository layout

    site/                 Docusaurus 3 project (npm)
      docs/               Hand-written docs (getting-started, your-first-project)
      api/                Auto-generated API docs (Dokka GFM → markdown)
      src/components/     React components (project generator, fade-in, tooltips)
      src/pages/index.tsx Home page
    scripts/
      build-api.sh        Clones flixelgdx/flixelgdx + runs Dokka GFM
    .github/workflows/
      deploy.yml          Builds + deploys to GitHub Pages
      framework-trigger.md Snippet to put in the framework repo for auto-rebuild

## Local development

```bash
cd site
npm install
npm run start       # http://localhost:3000/flixelgdx-website/
```

To regenerate the API docs (requires JDK 17+ and Gradle on PATH):

```bash
./scripts/build-api.sh
```

The result is dropped under `site/api/`. Docusaurus picks it up
automatically.

## Production build

```bash
cd site
npm run build       # outputs to site/build/
npm run serve       # preview locally
```

## Deployment

The site is deployed automatically to GitHub Pages from
`.github/workflows/deploy.yml`. It rebuilds on:

- Any push to this repo's `main` branch.
- A `repository_dispatch` event of type `framework-updated` (sent by
  the framework repo whenever `master` is updated — see
  [`.github/workflows/framework-trigger.md`](.github/workflows/framework-trigger.md)).
- Manual `workflow_dispatch` invocations.
- A daily cron fallback.

## License

The website content is licensed MIT, matching the framework.
