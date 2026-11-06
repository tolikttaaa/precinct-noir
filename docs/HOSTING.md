<!-- App-facing excerpt (§1–§6) of home-infra docs/APP-HOSTING.md, copied 2026-11-06.
     The source of truth is the private repo tolikttaaa/home-infra. Server operations,
     troubleshooting and secret locations (§7–§10) are intentionally not published here. -->

# Hosting an app on ttaaa-home — guide for developers and AI agents

This document describes the platform that hosts my personal web apps and the
exact contract an app must follow to be deployed on it. It is written to be
given to an AI coding agent as context when building a new application.

**How to use it in a new app repo:** copy this file into the app repo (e.g. as
`docs/HOSTING.md`) and add a line to the repo's `CLAUDE.md` / `AGENTS.md`:

> Deployment target and constraints are described in `docs/HOSTING.md`. Follow it
> for the Dockerfile, configuration, database access and CI workflow.

Source of truth: private repo `tolikttaaa/home-infra`, checked out on the server
at `/srv/infra`.

---

## 1. Platform summary (what an app gets)

| Thing | Value |
|---|---|
| Public URL | `https://<app>.ttaaa.dev` (one subdomain per app) |
| TLS | Terminated at Cloudflare. The app receives **plain HTTP** |
| Ingress path | Cloudflare → Cloudflare Tunnel (`cloudflared`) → Caddy → `http://<app>:<port>` |
| Container runtime | Docker Compose, one stack per app in `/srv/apps/<app>/` |
| Image registry | `ghcr.io/tolikttaaa/<app>` (private, lowercase name) |
| Database | Shared PostgreSQL **18** container; the app gets its **own database and role**, both named `<app>` |
| Persistent files | `/srv/data/<app>` on the host, mounted at **`/data`** in the container |
| Memory limit | **768 MB** per app container (`mem_limit: 768m`) |
| Runs as | uid/gid **1000:1000** (non-root) |
| Default port | **8080** (configurable per app; passed as `SERVER_PORT`) |
| CPU arch | linux/amd64 (Intel x86_64) |
| Logs | stdout/stderr → Docker json-file, rotated (10 MB × 3) |
| Backups | Nightly: `pg_dumpall` of all databases + restic snapshot of `/srv` (incl. `/srv/data/<app>`) to Cloudflare R2 |
| Deploys | Push to `main` → image built on GitHub → deployed on the server automatically |

Host: GEEKOM IT15 mini PC (Core Ultra 9 285H, 32 GB RAM, 1 TB NVMe), Ubuntu 26.04,
hostname `ttaaa-home`, reachable only via Tailscale (`ssh ttaaa-home`). No ports are
open to the internet; everything public goes through the tunnel.

---

## 2. The app contract (requirements for every app image)

An app is deployable if its Docker image satisfies all of these:

1. **Listens on `0.0.0.0:$SERVER_PORT`** (default 8080) and speaks plain HTTP.
   Spring Boot reads `SERVER_PORT` automatically.
2. **Runs as a non-root user (uid 1000).** The server forces `user: "1000:1000"`.
   Do not write anywhere except `/data` and `/tmp`.
3. **Persistent files go to `/data`** (e.g. uploaded Garmin FIT files). Everything
   else in the container filesystem is lost on every deploy.
4. **Configuration via environment variables**, not baked-in files. Secrets are
   never in the image or the repo.
5. **Fits in 768 MB.** For the JVM, `JAVA_TOOL_OPTIONS=-XX:MaxRAMPercentage=75` is
   set, i.e. a heap of about 576 MB. Don't set `-Xmx` in the image.
6. **Database schema is managed by the app** (Flyway or Liquibase migrations on
   startup). The app's role owns its database and can create tables in `public`.
   It cannot create databases or roles and cannot connect to other apps' databases.
7. **Starts and stays up.** After a deploy, every container must be `running` with
   zero restarts for 30 s, and — if the image defines a `HEALTHCHECK` — become
   `healthy` within 180 s. Otherwise the deploy fails and **rolls back** to the
   previous image automatically.
8. **Logs to stdout/stderr.** No log files.
9. **Built for linux/amd64** (the default on GitHub's `ubuntu-latest` runners).
10. **Behind a proxy:** TLS ends at Cloudflare and requests reach the app over HTTP
    from Caddy with `X-Forwarded-For` (real client IP) and other forwarded headers.
    For Spring Boot set `server.forward-headers-strategy=framework` (or env
    `SERVER_FORWARD_HEADERS_STRATEGY=framework`) so redirects/absolute URLs use
    `https://` and the client IP is correct. Verify after the first deploy.

### Environment variables the server provides

Set in `/srv/apps/<app>/compose.yaml` (generated from `templates/app-compose.yaml`):

```
SERVER_PORT=<port>                                   # default 8080
JAVA_TOOL_OPTIONS=-XX:MaxRAMPercentage=75
SPRING_DATASOURCE_URL=jdbc:postgresql://postgres:5432/<app>
SPRING_DATASOURCE_USERNAME=<app>
SPRING_DATASOURCE_PASSWORD=<from /srv/apps/<app>/.env DB_PASSWORD>
```

A non-Spring app can read the same variables (DB host `postgres`, port `5432`,
database = user = `<app>`). Additional variables/secrets are added on the server
(see §6), not in the app repo.

### App name rules

`^[a-z][a-z0-9-]{0,29}$`, must not end with `-`. Reserved: `postgres`, `caddy`,
`cloudflared`, `infra`, `test`, `www`, `template0`, `template1`.
The same name is used for: the subdomain, the Docker service/DNS name, the image
name, the database, the DB role and the `/srv/apps` and `/srv/data` directories.
Prefer names without hyphens (a hyphenated DB/role name must be double-quoted in SQL).

---

## 3. Adding a new app — end-to-end checklist

### 3.1 On the server (once per app)

```bash
ssh ttaaa-home
/srv/infra/bin/new-app.sh <app> [port]        # port defaults to 8080
cd /srv/infra && git add Caddyfile && git commit -m "Add <app>" && git push
```

`new-app.sh` is idempotent and never prints secrets. It creates:

- Postgres role `<app>` (random password) and database `<app>` owned by it;
  `CONNECT` revoked from other roles;
- `/srv/apps/<app>/compose.yaml` (from `templates/app-compose.yaml`) and
  `/srv/apps/<app>/.env` (mode 600) with `DB_PASSWORD` and `IMAGE_TAG=latest`;
- `/srv/data/<app>/` (mode 750, owned by uid 1000);
- a Caddy site block `http://<app>.ttaaa.dev { reverse_proxy <app>:<port> }`,
  validated and reloaded.

It does **not** start the app; the first deploy does. Until then, browsers opening
`https://<app>.ttaaa.dev` see the "temporarily unavailable" fallback page (served by a Cloudflare
Worker, status 503), and API clients get Caddy's raw 502.

Fallback pages only replace *proxy-level* failures (app unreachable, server/tunnel down) and
only for browser page loads. An app's own responses, including its own 404 and 503 pages and any
JSON error, are passed through unchanged.

### 3.2 In the app repo

1. **`Dockerfile` at the repo root** satisfying §2 (examples in §5).
2. **`.github/workflows/deploy.yml`** = copy of `templates/deploy-workflow.yaml`
   from home-infra, with `APP_NAME: <app>` set.
3. **Repository secret `HOME_INFRA_DEPLOY_TOKEN`** (Settings → Secrets and
   variables → Actions): a *fine-grained* personal access token with
   - Resource owner: `tolikttaaa`
   - Repository access: **only** `tolikttaaa/home-infra`
   - Permissions: **Actions: Read and write** (nothing else).
   The same token can be reused by all app repos. It can only trigger/watch the
   deploy workflow, not change code.
4. Push to `main`.

### 3.3 Verify

- GitHub → app repo → Actions: `build` and `deploy` jobs green. The deploy job
  log prints the URL of the `deploy` run in home-infra.
- `curl -sS https://<app>.ttaaa.dev/` (or `/actuator/health` for Spring Boot).
- On the server: `docker compose -f /srv/apps/<app>/compose.yaml ps`.

---

## 4. How a deploy works (CI/CD flow)

```
push to main (app repo)
  └─ build  [GitHub-hosted, ubuntu-latest]
       docker build → push ghcr.io/tolikttaaa/<app>:<full-sha> and :latest   (GITHUB_TOKEN, packages: write)
  └─ deploy [GitHub-hosted]
       gh workflow run deploy.yml -R tolikttaaa/home-infra -f app=<app> -f tag=<sha>
       waits for that run (gh run watch) and fails if it fails
            └─ home-infra "deploy" workflow  [self-hosted runner on ttaaa-home, labels: self-hosted, home]
                 validates inputs (app name, 40-char SHA, /srv/apps/<app> exists)
                 /srv/infra/bin/deploy.sh <app> <sha>:
                   IMAGE_TAG=<sha> written to /srv/apps/<app>/.env
                   docker compose pull && docker compose up -d
                   wait until running/healthy and stable 30 s
                   on failure: print logs, restore previous IMAGE_TAG, up -d, exit 1
```

Key properties:

- **No app code runs on the server** — only the image built on GitHub. App repos
  may therefore be public. `home-infra` must stay **private** (its workflows run on
  the home server with Docker access).
- Images are tagged with the **full commit SHA**; `/srv/apps/<app>/.env` always
  holds the currently deployed tag, so a manual `docker compose up -d` keeps the
  deployed version.
- Deploys of the same app are serialized; only `main` deploys.
- The server pulls private images using a `read:packages` token stored for user
  `ttaaa` (`docker login ghcr.io`).

### Rollback / redeploy a specific version

- GitHub UI: `home-infra` → Actions → **deploy** → *Run workflow* → app + full SHA.
- Or on the server: `/srv/infra/bin/deploy.sh <app> <full-sha>`.

---

## 5. Dockerfile starting points

These are templates, not yet battle-tested on this server — adjust versions to
the project.

### Kotlin / Spring Boot (Gradle)

```dockerfile
# syntax=docker/dockerfile:1
# Use the JDK version the project targets (e.g. 21 or 25) in both stages.
FROM eclipse-temurin:21-jdk AS build
WORKDIR /src
COPY . .
RUN ./gradlew --no-daemon bootJar -x test

FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /src/build/libs/*.jar /app/app.jar
USER 1000:1000
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
```

Recommended `application.yaml` pieces:

```yaml
server:
  forward-headers-strategy: framework
  shutdown: graceful
spring:
  flyway:
    enabled: true          # migrations in src/main/resources/db/migration
management:
  endpoints.web.exposure.include: health
app:
  data-dir: /data          # where to store uploaded files
```

Add a `.dockerignore` (`build/`, `.gradle/`, `.idea/`, `node_modules/`, `.git/`).

### React / TypeScript (Vite) as a separate static app

```dockerfile
FROM node:24-alpine AS build
WORKDIR /src
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# nginx-unprivileged listens on 8080 and runs as non-root
FROM nginxinc/nginx-unprivileged:stable-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /src/dist /usr/share/nginx/html
EXPOSE 8080
```

`nginx.conf` (SPA routing):

```nginx
server {
  listen 8080;
  root /usr/share/nginx/html;
  location / { try_files $uri $uri/ /index.html; }
}
```

A frontend-only app still goes through `new-app.sh` (it gets an unused database;
the Spring env vars in its compose file are harmless and can be removed).

### Full-stack: backend + frontend

Simplest option: **one app** — build the React app and serve it from Spring Boot's
static resources (`src/main/resources/static`), API under `/api`. One container,
one subdomain, no CORS.

Alternative: two apps (e.g. `garmin` for the UI and `garmin-api`), each with its
own `new-app.sh`, Dockerfile and workflow (set `context:`/`file:` of
`docker/build-push-action` for a monorepo). Then configure CORS, or route both under
one hostname by editing the Caddyfile (e.g. `handle /api/* { reverse_proxy garmin-api:8080 }`)
and running `/srv/infra/bin/caddy-reload.sh`.

---

## 6. Server-side configuration of an app

Files on the server (not in the app repo):

| Path | Purpose |
|---|---|
| `/srv/apps/<app>/compose.yaml` | Compose stack (image, env, mounts, networks) |
| `/srv/apps/<app>/.env` | Secrets + deployed tag (mode 600): `DB_PASSWORD`, `IMAGE_TAG`, any app secrets |
| `/srv/data/<app>/` | Persistent files (`/data` in the container) |

**Adding an env var / secret for an app:**

```bash
ssh ttaaa-home
nano /srv/apps/<app>/.env                 # add e.g. GARMIN_API_KEY=...
nano /srv/apps/<app>/compose.yaml         # under environment:  GARMIN_API_KEY: ${GARMIN_API_KEY}
docker compose -f /srv/apps/<app>/compose.yaml up -d
```

Rules for `compose.yaml` (enforced by convention, keep them):

- **Never add `ports:`** — Docker bypasses the host firewall. Apps are reached
  only through Caddy on the `web` network.
- Keep networks `web` and `db` (both `external: true`).
- Keep `restart: unless-stopped`, `mem_limit`, `user: "1000:1000"`.
- `new-app.sh` never overwrites a customised `compose.yaml`.

---

## 7–10. Operations, troubleshooting, secrets, repo layout

Not published in this public repository. See `docs/APP-HOSTING.md` in the private
`tolikttaaa/home-infra` repo. App-specific operational steps are in [RUNBOOK.md](RUNBOOK.md).
