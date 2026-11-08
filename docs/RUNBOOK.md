# Runbook: one-time setup & operations

Steps the **repo owner** runs because they need server access or personal credentials. Agents
prepare these commands but never run them. Hosting contract: [HOSTING.md](HOSTING.md).

App name: **`precinctnoir`**, URL: **https://precinctnoir.ttaaa.dev**, port **8080**.

---

## 1. Before the first deploy (do this before merging the M1 PR)
Merging to `main` runs `.github/workflows/deploy.yml`, which needs both steps below.

### 1.1 Create the app on the server
```bash
ssh ttaaa-home
/srv/infra/bin/new-app.sh precinctnoir
cd /srv/infra && git add Caddyfile && git commit -m "Add precinctnoir" && git push
```
This creates the Postgres role and database `precinctnoir`, `/srv/apps/precinctnoir/{compose.yaml,.env}`,
`/srv/data/precinctnoir/` and the Caddy route. The compose file already provides everything the app
needs: `SERVER_PORT`, `JAVA_TOOL_OPTIONS` and `SPRING_DATASOURCE_*`.

### 1.2 Deploy trigger secret
The same fine-grained PAT can serve every app repo. If you already have one, reuse it.
1. Create one at https://github.com/settings/personal-access-tokens/new with:
   - Resource owner: `tolikttaaa`
   - Repository access: **Only select repositories** → `tolikttaaa/home-infra`
   - Permissions: **Actions: Read and write** (nothing else)
2. Store it in this repo (paste at the prompt):
   ```bash
   gh secret set HOME_INFRA_DEPLOY_TOKEN -R tolikttaaa/precinct-noir
   ```

### 1.3 Branch protection (done: ruleset "Protect main")
`main` is protected by the repository ruleset **Protect main**
(Settings → Rules → Rulesets; id `26715638`). It is the only protection; there is no classic branch protection.
- **Pull request required:** no direct pushes. 0 approvals, because GitHub doesn't let you approve your own PR.
- **Required status checks** (from GitHub Actions): `Engine & server (Gradle)`, `Web client`, `Docker image (build only)`,
  `Browser games (TV + 2 phones)`.
  `build-and-deploy` is deliberately excluded because it runs after the merge.
- **Blocked:** deleting `main` and force-pushes.
- **Bypass:** repository admins may merge a PR despite failing checks, for emergencies only. They still can't push directly.

**Adding the browser games check (M5b).** It appears in the picker once it has run on a PR.
Settings → Rules → Rulesets → *Protect main* → Require status checks to pass → Add checks → type
`Browser games (TV + 2 phones)` → pick it (source: GitHub Actions) → Save changes. Or from a terminal:
```bash
gh api repos/tolikttaaa/precinct-noir/rulesets/26715638 \
  | jq '{name, target, enforcement, conditions, bypass_actors, rules: (.rules | map(
      if .type == "required_status_checks"
      then .parameters.required_status_checks += [{"context": "Browser games (TV + 2 phones)", "integration_id": 15368}]
      else . end))}' \
  | gh api -X PUT repos/tolikttaaa/precinct-noir/rulesets/26715638 --input -
```

If you rename a CI job in `.github/workflows/ci.yml`, update the ruleset's required checks too,
or PRs will wait forever for a check that no longer exists. Inspect the rules with:
```bash
gh api repos/tolikttaaa/precinct-noir/rules/branches/main
```

## 2. Verify a deploy
1. GitHub → Actions → `build-and-deploy`: both jobs green. The deploy log links the home-infra run.
2. Health check:
   ```bash
   curl -sS https://precinctnoir.ttaaa.dev/actuator/health        # {"groups":[...],"status":"UP"}
   ```
3. Open https://precinctnoir.ttaaa.dev and press **Open a room**. The board screen should show a stamped
   room code. Join it from a phone: the name appearing on the board proves WebSockets pass through
   Cloudflare → tunnel → Caddy → app. Optional CLI check (the socket closes with 4002 after 5 s
   because it never says hello):
   ```bash
   websocat -H 'Origin: https://precinctnoir.ttaaa.dev' wss://precinctnoir.ttaaa.dev/ws
   ```
4. On the server:
   ```bash
   docker compose -f /srv/apps/precinctnoir/compose.yaml ps
   ```

## 3. Operations
```bash
# logs
docker compose -f /srv/apps/precinctnoir/compose.yaml logs -f --tail=200
# roll back / redeploy a specific commit (from any machine with gh)
gh workflow run deploy.yml -R tolikttaaa/home-infra -f app=precinctnoir -f tag=<full-commit-sha>
```
Every deploy restarts the container and drops live WebSockets. From M3, rooms are snapshotted to
Postgres and clients reconnect automatically, so a game in progress resumes after a few seconds.

---

## 4. Anti-abuse keys (M3b)
How these fit together: [SECURITY.md](SECURITY.md).

### 4.1 Cloudflare Turnstile (bot check on "Host a game" only)
**Required before the M3b PR merges.** Without the secret key, production refuses to create rooms
(`503 captcha_unavailable`); everything else keeps working.
1. Cloudflare dashboard → **Turnstile** → **Add widget**: name `Precinct Noir`,
   hostname `precinctnoir.ttaaa.dev`, widget mode **Invisible**.
2. On the server, add the keys:
   ```bash
   ssh ttaaa-home
   nano /srv/apps/precinctnoir/.env           # TURNSTILE_SITE_KEY=...  TURNSTILE_SECRET_KEY=...
   nano /srv/apps/precinctnoir/compose.yaml   # under environment:
                                              #   APP_TURNSTILE_SITE_KEY: ${TURNSTILE_SITE_KEY}
                                              #   APP_TURNSTILE_SECRET_KEY: ${TURNSTILE_SECRET_KEY}
   docker compose -f /srv/apps/precinctnoir/compose.yaml up -d
   ```
3. Check that the app picked up the site key (it is public, so this is safe to run anywhere):
   ```bash
   curl -sS https://precinctnoir.ttaaa.dev/api/config     # {"turnstileSiteKey":"0x4AAAA..."}
   ```
   `{}` means the variables didn't reach the container. The secret key is never exposed; a missing
   secret shows up as `Turnstile secret key is not set` in the logs at startup.

### 4.2 Cloudflare rate-limiting rule (edge layer)
Cloudflare dashboard → `ttaaa.dev` → **Security → WAF → Rate limiting rules → Create rule**:
- **If incoming requests match:** `(http.host eq "precinctnoir.ttaaa.dev" and starts_with(http.request.uri.path, "/api/"))`
- **With the same characteristics:** IP
- **When rate exceeds:** 60 requests per 10 seconds
- **Then:** Block for 10 seconds

The free plan allows one rate-limiting rule. If yours is already used, skip this; the app enforces
its own per-client limits regardless (SECURITY.md §3).
