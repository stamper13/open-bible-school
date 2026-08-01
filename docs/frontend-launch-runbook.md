# Frontend launch and rollback runbook

Operator guide for the Next.js app in `web/`. Covers required configuration,
verification before promoting a build, and how to back out.

No secret values appear in this file, and none should be added to it. Only
variable *names* are listed.

---

## 1. Environment variables

Set these in the Vercel project (Project → Settings → Environment Variables) and
in `web/.env.local` for local development. `web/.env.example` lists the same
names with empty values.

| Variable | Scope | Required | Purpose |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Browser + server | Yes | Supabase project URL. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser + server | Yes | Anonymous/publishable key. RLS-restricted. |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server only** | Only for admin console | Bypasses RLS. |
| `OBS_ADMIN_EMAILS` | Server only | Only for admin console | Comma-separated allowlist for `/admin/questions`. |
| `NEXT_PUBLIC_NT_PILOT_ENABLED` | Browser | No | Set to `false` to hide the New Testament assessment. Defaults to enabled. |

### Service-role key is server-only

`SUPABASE_SERVICE_ROLE_KEY` must **never** be given a `NEXT_PUBLIC_` prefix.
Anything prefixed `NEXT_PUBLIC_` is inlined into the JavaScript bundle and is
readable by every visitor.

It is currently read only by `web/lib/supabase/admin.ts` and
`web/lib/admin/authorize.ts`. Both begin with `import "server-only"`, so a build
fails if either is ever pulled into a client component. Keep that import when
editing those files.

To confirm no secret leaked into a build:

```bash
cd web && npm run build && grep -rl "service_role" .next/static 2>/dev/null || echo "clean"
```

### Missing public variables fail loudly

`web/lib/supabase/client.ts` throws on startup naming whichever public variable
is absent, rather than failing later with an opaque `Failed to fetch`. If the
deployed app shows that error, the environment variables are missing for the
deployed environment (Production and Preview are configured separately in
Vercel).

---

## 2. Local verification

```bash
cd web
npm run lint
npm run build
npm audit --omit=dev
npm run test:e2e
```

`npm run test:e2e` reuses a dev server on port 3000 if one is running and starts
one otherwise. Override the port with `PLAYWRIGHT_PORT`.

Note: the suite targets `http://localhost`, **not** `127.0.0.1`. Next's dev-mode
cross-origin protection refuses to hydrate the app when the host differs from
the dev server's own, which silently leaves every page stuck on its
server-rendered loading state and produces confusing failures.

Run a dev server manually with:

```bash
cd web && npm run dev
```

Next refuses to run two dev servers from the same directory, so stop any
existing one first.

---

## 3. Automated smoke coverage

`web/tests/e2e/smoke.spec.ts` runs at 1440x900 and 390x844. It is read-only:
nothing signs in, submits an answer, or writes to the database, so it is safe
against any environment. It covers:

- `/`, `/about`, `/knowledge-map`, `/bli` return 200 and log no hydration errors
- the dashboard and knowledge-map headings render
- the assessment selector exposes both Old and New Testament entry points
- New Testament opens the broad `scope=NT` path, not an obsolete pilot chooser
- signed-out users see Sign in and never Sign out
- reduced motion suppresses long and infinite animations
- no horizontal overflow at 390px on any public route

---

## 4. Manual checklist (needs a signed-in test account)

Automated coverage stops at the sign-in boundary deliberately. Run these by hand
against a **test account**, never a real user's. Do not commit credentials.

- [ ] Magic-link sign-in completes and lands on the dashboard.
- [ ] An expired or reused sign-in link shows "Sign-in did not complete" with
      working "Back to sign in" and "Continue as a guest" actions.
- [ ] Anonymous progress transfers on sign-in; if transfer fails the page says
      you are signed in and that guest progress was left untouched.
- [ ] Start an OT assessment, answer several questions, and confirm the score
      and progress update.
- [ ] Submit the same answer twice rapidly. The first answer must stand and the
      assessment must continue, showing "Your first answer to that question was
      already recorded, so it has been kept." It must not dead-end in an error.
- [ ] Answer a sequence-ordering question using **only** the keyboard, via the
      ↑/↓ move buttons.
- [ ] Start an NT assessment and confirm it scores to a separate NT BLI.
- [ ] Open `/results/<attemptId>`; check filters and expandable review rows.
- [ ] Force an error (pause the Supabase project) and confirm the results page
      and knowledge map both show a "Try again" action that recovers once the
      project resumes.
- [ ] Sign out and confirm dashboard scopes read "Not yet assessed" rather than
      showing a score of zero.
- [ ] `/admin/questions` is reachable only for an email in `OBS_ADMIN_EMAILS`.

---

## 5. Deploying

1. Push the branch. Vercel builds a **Preview** deployment.
2. Confirm Preview has its own environment variables set.
3. Run the smoke suite against the preview:
   ```bash
   cd web && PLAYWRIGHT_BASE_URL=<preview-url> npx playwright test
   ```
   (Set `use.baseURL` from that variable first if you want this wired in; by
   default the config targets localhost.)
4. Walk the manual checklist above on the preview URL.
5. Confirm security headers survive the deploy:
   ```bash
   curl -sI <preview-url> | grep -iE "x-content-type|referrer-policy|x-frame|permissions-policy|strict-transport"
   ```
   All five of `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`,
   `Permissions-Policy` and `Strict-Transport-Security` should be present. They
   come from `headers()` in `web/next.config.ts`.
6. Promote to Production only after the above passes.

---

## 6. Rollback

**Vercel.** Deployments → pick the last known-good production deployment →
"Promote to Production". This is near-instant and needs no rebuild. Do this
first; diagnose afterwards.

**Supabase.** The database is shared across deployments, so a frontend rollback
does not undo a migration. Backend rollback is owned separately — see the
Supabase migration notes rather than reverting schema from here.

### Diagnosing a paused or unreachable Supabase project

Free-tier projects pause after inactivity. Symptoms: pages load but every data
panel shows its "temporary connection problem" message and retry, and the
browser console logs failing requests to the Supabase URL.

1. Check the project status in the Supabase dashboard; resume it if paused.
2. Resuming takes a minute or two. The in-app "Try again" actions recover
   without a page reload once it is back.
3. If the project is running but requests still fail, verify
   `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` match the
   project, and check whether the anon key was rotated.

A paused project is not a frontend regression and rolling back the frontend
will not fix it.
