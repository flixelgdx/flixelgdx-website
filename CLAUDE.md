# Instructions for Claude

---

## What is this repository?

This is a website for the Java-based game development framework *FlixelGDX*. It holds the main page, project generator (the "Getting Started" page),
the tutorial for beginners, and (most importantly) the API pages that hold the parsed Javadocs from the framework's source code.

## Web Development Best Practices

Even though this is a set-it-and-forget-it system, we need the code to be stable and clean to ensure that if anything
needs to be changed (whether it would be changed by an AI or a human), it doesn't break the entire system down.

### TypeScript

- Enable `"strict": true` in `tsconfig.json`
- Prefer `type` over `interface` unless you need declaration merging
- Never use `any`. Use `unknown` and narrow it, or use generics
- Use discriminated unions for exclusive state shapes:
  ```ts
  type Result<T> = { status: 'ok'; data: T } | { status: 'error'; message: string };
  ```
- Derive types from data using `typeof`, `ReturnType<>`, `z.infer<>`. **Don't duplicate them**

### React

- Function components only, no class components
- Keep state as close to where it's used as possible; lift only when truly shared
- Extract repeated `useEffect` + `useState` patterns into custom `useXxx` hooks
- `useEffect` is for external sync (DOM, subscriptions, timers), not for reacting to state changes
- Never use array index as a key for dynamic lists, use stable unique IDs instead
- Memoize (`useMemo`/`useCallback`) only after profiling, not by default
- Wrap major UI sections in error boundaries

### JavaScript

- `const` by default, `let` when needed, never `var`
- `async/await` over raw Promise chains
- Use `??` (nullish coalescing) instead of `||` for defaults — it won't swallow `0`, `""`, or `false`
- Use `?.` (optional chaining) for deep property access
- Keep functions pure, small, and single-purpose

### Docusaurus

- Structure docs around the user's journey, not your internal repo layout
- Define `sidebars.js` explicitly. Don't rely on auto-generation
- Use MDX for interactive content (code playgrounds, tabs, callouts)
- Don't version docs until users are genuinely on incompatible versions
- Customize via `--ifm-*` CSS variables first; swizzle only when necessary, and prefer "Wrap" over "Eject"
- Never hardcode environment-specific values, use `docusaurus.config.js` env vars

### General

- Colocate tests, styles, and types with the code they describe
- Enforce ESLint (`typescript-eslint`) + Prettier in CI
- Configure `@/` path aliases in `tsconfig.json` to avoid deep relative imports
- Do not use special characters in comments or doc comments. This includes en dashes, em dashes, special arrows,
  or workarounds like `--`. Keep it pure ASCII and use pure clarity.
