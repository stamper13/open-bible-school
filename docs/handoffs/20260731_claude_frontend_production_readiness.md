# Claude Handoff: Frontend Production Readiness

Use this prompt in the Claude task that will handle the remaining work.

---

You are collaborating on Open Bible Assessment with another coding agent. Work
only on the lower-risk frontend and launch-readiness tranche described below.
The other agent owns the live Supabase backend, router, scoring, migrations,
rollback SQL, and database verification. Do not duplicate or revise that work.

## Project

- Repository: `/Users/stamper35/open-bible-school`
- Next.js app: `/Users/stamper35/open-bible-school/web`
- Stack: Next.js 16.2.12, React 19.2.8, Tailwind v4, Supabase JS 2.111.0
- Production URL: `https://web-navy-zeta-62.vercel.app/`
- Current branch: `knowledge-map-star-hierarchy`
- The worktree is intentionally dirty. Preserve all existing user and agent
  changes. Never reset, checkout, clean, or rewrite unrelated files.

## Ownership Boundary

You may edit:

- `/Users/stamper35/open-bible-school/web/app/**`
- `/Users/stamper35/open-bible-school/web/lib/**`
- `/Users/stamper35/open-bible-school/web/next.config.ts`
- `/Users/stamper35/open-bible-school/web/package.json`
- `/Users/stamper35/open-bible-school/web/package-lock.json`
- Frontend-focused documentation under
  `/Users/stamper35/open-bible-school/docs/**`

Do not edit or execute schema changes in:

- `/Users/stamper35/open-bible-school/supabase/**`
- `/Users/stamper35/open-bible-school/scripts/check-supabase-migrations.sh`
- Router, scoring, question-bank, RLS, RPC, or database migration code

Do not deploy to production without explicit user approval. A Vercel preview is
acceptable after local verification if credentials are already available.

## Backend State You Can Rely On

The other agent has applied and verified these live changes:

1. OT answer submission is first-write-wins. Exact retries return the original
   result; changed retries are rejected.
2. NT answer submission now has the same retry behavior. A broken existing-row
   `is_idk` lookup was repaired.
3. The OT V4 router already handles global improvement and fatigue. A new
   dimension-local brake lowers difficulty after two misses in one dimension,
   permits one possible confirmation item, then moves on.
4. IDK theta weighting is live.
5. Anonymous progress transfer is destination-authorized.
6. Legacy answer-key and cross-user RPCs are service-role only.
7. Dormant credential-exam mutation RPCs are service-role only because their
   result path trusted caller-supplied totals.
8. Transactional authenticated OT and NT lifecycle tests pass: start, serve
   without an answer key, submit, retry, status/summary, and review.
9. Frontend `npm run lint`, `npm run build`, and `npm audit --omit=dev` all pass;
   the audit reports zero vulnerabilities.

Do not rename or change frontend RPC calls unless you find a demonstrated
frontend bug. Current production RPC names are intentional.

## Objective

Make the frontend genuinely beta-production-ready without redesigning the
product or disturbing its visual identity. Focus on resilience, accessibility,
state clarity, deployment parity, and repeatable verification.

## Work Order

### 1. Audit current frontend state before editing

- Read the real files first, especially:
  - `web/app/assess/page.tsx`
  - `web/app/page.tsx`
  - `web/app/results/[attemptId]/page.tsx`
  - `web/app/auth/callback/page.tsx`
  - `web/app/knowledge-map/page.tsx`
  - `web/app/knowledge-map/SemanticKnowledgeGraph.tsx`
  - `web/app/about/page.tsx`
  - `web/lib/supabase/client.ts`
  - `web/next.config.ts`
- Inspect `git diff` for every file before changing it. Work with existing
  modifications; do not overwrite them.
- Remove only indisputably generated junk such as `web/app/.DS_Store`. Do not
  delete an apparently unused component until `rg` proves it has no imports and
  the current experience does not rely on it.

### 2. Add explicit public environment validation

- Replace the non-null assertions in `web/lib/supabase/client.ts` with a clear,
  fail-fast check for `NEXT_PUBLIC_SUPABASE_URL` and
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- The browser bundle must never reference `SUPABASE_SERVICE_ROLE_KEY`.
- Keep admin-only service-role access confined to existing server-only modules.
- Provide a concise operator-facing error that identifies missing variable
  names without printing secret values.

### 3. Harden loading, empty, error, and retry states

Audit the dashboard, assessment, results, knowledge map, auth callback, and
admin question console. Implement missing states where a network delay, paused
Supabase project, expired session, missing attempt, empty result, or rejected
duplicate submission currently leaves a spinner forever or an ambiguous error.

Required behavior:

- Loading states must explain what is loading and must not cause layout jumps.
- Recoverable failures need a retry command.
- Authentication failures should route to the correct sign-in/anonymous flow,
  not display raw database errors.
- A rejected changed-answer retry should not overwrite the first answer and
  should recover by loading the next question or recorded result.
- Empty dashboard scopes must say “Not yet assessed,” not imply a score of zero.
- OT and NT errors must retain the selected testament and assessment scope.

Prefer a small shared error/status component only if it removes real
duplication; otherwise keep changes local.

### 4. Accessibility and interaction pass

Verify keyboard, screen-reader, reduced-motion, and touch behavior for:

- Dashboard tabs and testament/profile selectors
- BLI information popover and clickable vessel tiers
- Continue-assessment expanding button
- Knowledge-map zoom, pan, nodes, and recommendation actions
- Multiple-choice answers
- Sequence-order drag questions
- Results filters and expandable review rows
- Navigation, sign-in, and sign-out commands

Requirements:

- Every interactive control must be reachable and operable by keyboard.
- Sequence ordering must have a keyboard alternative using the current dnd-kit
  stack; dragging cannot be the only way to answer.
- Focus must remain visible and move predictably after dialogs/transitions.
- Icon-only buttons need accessible names and tooltips where useful.
- Popovers must remain open while focused/hovered and close with Escape.
- Respect `prefers-reduced-motion`: skip the 3D/spin transition, hover-growth,
  water slosh, shooting stars, and fireworks while preserving navigation.
- Do not flatten the existing visual design merely to satisfy accessibility.

### 5. Responsive visual QA

Run the app locally and inspect at minimum:

- 390x844 mobile
- 768x1024 tablet
- 1440x900 desktop
- 1920x1080 wide desktop

Check `/`, `/assess`, `/results/[attemptId]`, `/knowledge-map`, `/about`, and
`/admin/questions` where authorized. Fix only concrete issues such as clipped
text, overlapping controls, off-screen popovers, unreadable graph labels,
unstable fixed elements, or touch targets below roughly 44px.

Preserve the star-field, glass vessel, knowledge graph, and current typography.
Do not perform a broad aesthetic rewrite.

### 6. Add repeatable frontend smoke coverage

There is currently no browser-test script. Add the smallest maintainable smoke
suite that fits the repo, preferably Playwright, and document how to run it.

At minimum cover public/non-destructive behavior:

- Dashboard renders without hydration errors.
- About and knowledge-map routes open.
- Assessment selector exposes OT and NT entry points.
- NT entry opens the broad NT assessment path, not an obsolete pilot chooser.
- Sign-out is absent when no signed-in user is present.
- Reduced-motion mode suppresses long transition effects.
- Mobile viewport has no horizontal document overflow.

Do not automate destructive tests against the production database. For flows
that require live authenticated data, write a manual checklist using a test
account and clearly label it as manual. Do not store credentials in the repo.

### 7. Beta, privacy, and trust copy

Audit the existing About page before editing; some beta language may already be
present. Ensure users can plainly learn:

- Open Bible Assessment is a beta and its BLI is an educational estimate, not
  an accredited credential or definitive judgment of biblical understanding.
- Scores become more reliable with more responses.
- Anonymous browser progress is temporary; signing in preserves progress.
- What account/assessment data is stored and how a user can request deletion.
- The project welcomes biblical-content and engineering feedback.
- A visible contact/feedback route exists. If no real contact destination is
  configured, add a clearly marked configuration placeholder in documentation,
  not a fake address in the UI.

Do not write legal guarantees. Keep the wording calm and concise.

### 8. Deployment parity and operator runbook

- Verify `web/next.config.ts` headers still apply after changes.
- Document required Vercel variables by name only:
  `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, optional
  `NEXT_PUBLIC_NT_PILOT_ENABLED`, `SUPABASE_SERVICE_ROLE_KEY`, and
  `OBS_ADMIN_EMAILS`.
- Explicitly state that the service-role key is server-only.
- Add a short launch/rollback checklist covering preview deployment, smoke
  checks, production promotion, Vercel rollback, and Supabase pause/status
  diagnosis.
- Do not copy actual environment values into tracked files or chat output.

## Required Verification

Run and report:

```bash
cd /Users/stamper35/open-bible-school/web
npm run lint
npm run build
npm audit --omit=dev
```

Run the new smoke tests and report their exact command and result. Start a local
server on an unused port and provide its URL. If you create a Vercel preview,
provide the preview URL; do not promote it to production without approval.

Before finishing, run:

```bash
cd /Users/stamper35/open-bible-school
git diff --check
git status --short --untracked-files=all
```

## Definition Of Done

- Existing OT and NT flows still compile and open.
- No raw Supabase errors are shown in normal recoverable states.
- Key controls work with keyboard, touch, and reduced motion.
- Public routes have no hydration error or horizontal overflow at the required
  viewports.
- Smoke tests, lint, build, and production dependency audit pass.
- No Supabase SQL or backend files were modified.
- No production deployment occurred without explicit approval.
- Final response lists files changed, tests run, remaining manual checks, and
  any configuration the user must supply.

---
