# Agent instructions

## General rules
- Always use local resources; never use CDNs for libraries, fonts, icons, or assets
- Never commit or push git changes unless explicitly asked
- Always use latest stable versions
  - if it's a package, research it with `pnpm info <package name> version`
  - otherwise research the version numbers online with your web_tool
- Always pin explicit versions

## Languages, style, linting
- All new code in TypeScript
- Include `.editorconfig` (2-space indent, LF, trim trailing whitespace)
- Use **ESLint** with flat config
  - No semicolons
  - Always use Single quotes
  - Disallow unnecessary type assertions
  - Disallow floating promises
  - Remove unused imports

## pnpm, node
- Use **pnpm** for all package management, never npm
- Pin Node via `.nvmrc` to `24.11.1`
- use `.npmrc`
  - package-lock=false
  - fund=false
  - audit=false
  - update-notifier=false
  - package-lock=false
  - lockfile=false

- Add scripts
  - `start:dev`
  - `start:prod`
  - `build:prod`
  - `install:deps`
- Add checks to scripts
  - `fix:lint` (do not add plain `lint`)
  - `check:type` (`tsc --noEmit`)
  - `check:build`
  - `check:docker` (prints out the logs from the docker container; assume it's running)
  - `check:all` (runs all; fix:lint, check:type, check:build, check:docker)
  - `pre-handoff-check` (runs all checks that are needed before handoff: default `check`)

## Framework/language specifics

### General Typescript
- Dev: `tsx watch src/main.ts`
- Prod: use **esbuild**
- `tsconfig.json`:
  - `"module": "nodenext"`
  - `"moduleResolution": "nodenext"`
  - `"experimentalDecorators": true`
  - `"emitDecoratorMetadata": true`
  - `"strict": true`

### Angular
- Use Material Symbols
- Always use
  - standalone components
  - OnPush change detection
  - SASS (indentation syntax)
  - `@if` / `@for`, never use `*ngIf` / `*ngFor`

### NestJS
- Dev: `tsx watch src/main.ts` (never `ts-node`)
- Prod: esbuild (never Nest/Webpack builder)
- Always enable Swagger
- Always add global HTTP request logging middleware (method, path, status, duration)

## Shared libraries
- Place all cross-project logic inside a dedicated `libs/` workspace folder
- Each shared lib must:
  - Be written in TypeScript only
  - Provide a clear public API via `index.ts`
  - Use path aliasing (`@lib/...`) and never deep relative imports
- All logic must be pure or framework-agnostic

## Nx workspace
- Use **Nx** as the workspace orchestrator for all apps and libs
- Never mix Nx with ad-hoc scripts that duplicate workspace functions
- Enable Nx caching for builds, lint, type-checking, and tests
- Always generate new applications and libraries via Nx generators (no manual boilerplate)
- use Nx implicit dependencies to connect frontend ↔ backend ↔ shared libs
- Docker Compose (`start:dev` / `start:prod`) must use Nx targets instead of raw commands
- NX_DAEMON=false, nxCloud=skip

## Coding guidelines
- Keep functions small and focused
- Use descriptive names
- Keep code simple and self-explanatory (no comments; refactor instead)
- Use `@` path alias; avoid deep relative paths
- Prefer `T[]` over `Array<T>`
- Avoid `as`; never double-assert using `unknown`

## Docker
- Use Docker Compose for dev and prod; never run services directly on host
- `node_modules` folder must be a defined named volume; never mount host node_modules!
- apply that also to other temp folders (e.g., Angular `.angular/cache`)
- when a container is being restarted, always make sure the pnpm install step is run first to ensure dependencies are up to date
- `start:dev` and `start:prod` orchestrate backend + frontend via Docker Compose
- use docker compose target and one multi-stage build Dockerfile for both (dev and prod)
- docker-compose files:
  - `docker-compose.yml` (dev)
  - `docker-compose.prod.yml`

## Traefik
- configure as the reverse proxy for dev and prod
- Do not use Angular `--proxy-config`
- Always bind port 80 to frontend (if present) via Traefik (never bind 4200/4173)
- use `/api` routing to backend; all other paths to frontend
- Additional ports: define Traefik entrypoints (e.g. `:8080`), never bind app containers directly
- Keep Traefik config inline in `docker-compose.*.yml` via labels and a `traefik` service

## Pre-handoff
- Run `pnpm run pre-handoff-check`
- Perform container restarts, endpoint checks, and UI verification yourself
- Never ask user to run commands you can run
- Restart containers only when necessary, but do it by yourself when needed
- If something fails:
  - Explain the failure
  - Suggest how to avoid or solve it next time
