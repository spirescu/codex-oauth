# Agent instructions

## Versions & tooling
- Use the latest stable versions for Node.js, JS/TS deps, Docker images, and related tooling.
- Pin Node.js via `.nvmrc`.
- Never use floating Docker tags (`ubuntu:latest`, `node:latest`); always pin explicit stable tags (e.g. `ubuntu:24.04`, `node:25.2.1-alpine`).

## Languages, style, linting
- Prefer TypeScript over JavaScript; all new code should be TypeScript.
- Always include an `.editorconfig` (2-space indent, LF, trim trailing whitespace).
- Use ESLint with a flat config:
    - Semicolons disallowed (`semi: 'never'`)
    - Single quotes (`quotes: 'single'`)
    - Disallow unnecessary type assertions (`@typescript-eslint/no-unnecessary-type-assertion`)
    - Disallow floating promises (`@typescript-eslint/no-floating-promises`)
    - Remove unused imports (`unused-imports/no-unused-imports`)

## npm scripts
- Add: `lint:fix`, `type:check`, `build:check`, `docker:check` (print latest Docker logs), `check` (runs all).
- Do not add a plain `lint` script.

## Framework specifics
- **Angular**
  - Use SASS with indentation syntax.
  - Never use *ngIf or *ngFor, use @if/@for instead.
- **NestJS**
  - Use `tsx watch src/main.ts` (never `ts-node`)
  - always add Swagger.
  - always add a global HTTP request logging middleware (using Nest `NestMiddleware` + `Logger`) that logs method, path, status code, and duration for every request.

## Coding guidelines
- Follow best practices; keep functions small and focused.
- Use clear descriptive names; avoid generic names.
- Keep code simple, readable, and self-explanatory—no comments; refactor instead.
- Use `@` path alias; avoid deep relative paths.
- Prefer `T[]` over `Array<T>`.
- Avoid `as`; never double-assert using `unknown`.

## Hard rules
- Never use CDNs for libraries, fonts, icons, or assets.
- Never commit or push git changes unless explicitly asked.

## Docker & workflow
- Use Docker Compose for both dev and prod; do not run services directly on host.
- Dev containers must run `npm install` on restart with:
    - `--no-audit`
    - `--no-fund`
    - `--no-package-lock`
  - `--no-update-notifier` is unreliable; prefer `NPM_CONFIG_UPDATE_NOTIFIER=false` in the container environment to suppress npm/npx update notices.
- Use `.npmrc` to support these flags.
- Keep `node_modules` only in container anonymous volumes; never mount host `node_modules`.
- Apply the same pattern to framework/tool caches (e.g. Angular `.angular`, Next `.next`, Vite cache): mount those paths as anonymous volumes in containers so cache folders never land in the host workspace.
- `start:dev` and `start:prod` must orchestrate backend + frontend via Docker Compose without extra local scripts.
- Assume the dev Docker profile is usually active.
- Restart containers when necessary, but avoid unnecessary restarts.
- Use Traefik as the single HTTP reverse proxy in both dev and prod:
  - Do not use Angular's `--proxy-config`; instead, let Traefik route `/api` to the backend and all other paths to the frontend.
  - Never use ports like 4200 or 4173 in dev; always use port 80 for frontend dev servers.
  - When ports other than 80/443 are required, expose them as Traefik entrypoints (e.g. `--entrypoints.web-alt.address=:8080`) and still route traffic via Traefik, never by binding app containers directly to host ports.
  - Keep all Traefik configuration inline in `docker-compose.*.yml` using labels on services plus a dedicated `traefik` service; do not introduce separate Traefik config files.

## Pre-handoff
- Run `npm run lint:fix` only.
- Check backend and frontend Docker logs; fix issues found.
- Do not ask the user to run any command you can run yourself.
- Do not perform container restarts when not absolutely necessary. I repeat: perform only when necessary. But always perform container restarts, endpoint checks, and UI verification yourself (including via Docker logs and browser/MCP) if they are necessary; never instruct the user to do these when you have access.
- If something fails:
    - Explain the failure.
    - Suggest how to avoid or solve it next time.
