# FairShare

Peer evaluation and team contribution app — ISDS 4125, Team Tigers (Abby Hall, Isaac Morris, Rylie Richard, Sarah Jeffrey, Ben Taylor).

Instructors set up a private channel per team from a roster CSV. Students log the work they finish; teammates confirm or dispute each entry; disputes go to the instructor. At each completed milestone students rate teammates 1–5 (anonymously by default). The app flags suspicious rating patterns, and warns the instructor about struggling teams. Only instructors can sign up; students join through invite links.

**Live:** https://fairshare.page (production database starts empty — sign up as an instructor, then invite students from a roster).

**Stack:** Next.js 16 (App Router, TypeScript) on Cloudflare Workers via `@opennextjs/cloudflare` · Cloudflare D1 · Resend · Tailwind CSS 4 · Vitest.

---

## Quick start (local)

Requires Node 20+ (tested on Node 24).

```bash
npm install
cp .dev.vars.example .dev.vars     # then set SESSION_SECRET to a long random string
npm run dev                        # applies D1 migrations, seeds demo data if empty, starts http://localhost:3000
```

`npm run dev` runs `next dev` against the **local** D1 database in `.wrangler/state` (through OpenNext's dev proxy), so no Cloudflare account is needed for local work.

> **npm 12 note:** install scripts are blocked by default. This repo pre-approves `esbuild` and `workerd` in `package.json → allowScripts`. If `npm install` still warns, run `npm install-scripts approve esbuild workerd`.

> **OneDrive note:** if the project lives in a OneDrive folder, OneDrive syncing `node_modules` can make Turbopack pause ("waiting for the filesystem to settle"). Mark the folder *Always keep on this device* or move the project outside OneDrive if dev feels slow.

### Environment variables

| Name | Where | Required | Purpose |
|---|---|---|---|
| `SESSION_SECRET` | `.dev.vars` locally; `wrangler secret put SESSION_SECRET` in production | **Yes** (≥ 32 chars) | HMAC key that signs the HttpOnly session cookie. |
| `RESEND_API_KEY` | `.dev.vars` / `wrangler secret put RESEND_API_KEY` | No | Sends sign-up, welcome and invite emails through Resend. **When missing, every email (including its invite link) is printed to the terminal instead** — handy for demos. |
| `APP_URL` | `.dev.vars` / `wrangler.jsonc vars` | No | Base URL used in emailed links. Defaults to the request's own origin. |
| `EMAIL_FROM` | `wrangler.jsonc vars` | No | Sender address. Defaults to `FairShare <onboarding@resend.dev>` (Resend's test sender, which only delivers to your own Resend account email — verify a domain to email real students). |
| `SHOW_DEMO_LOGINS` | build env | No | Set to `1` to show the demo-account box on the login page in a production build (it always shows in dev). |

### Database scripts

| Command | What it does |
|---|---|
| `npm run db:migrate` | Apply migrations in `db/migrations/` to the local D1 database. |
| `npm run db:seed` | Regenerate `db/seed.sql` and load it locally (wipes existing rows first). |
| `npm run db:reset` | Migrate + reload demo data. Use this before every demo. |
| `npm run db:seed:remote` | Load the demo data into the production D1 database. |

The seed (`scripts/generate-seed.ts`) computes dates relative to *now*, so "no work logged in 3 weeks" always shows up. It hashes passwords and raises integrity flags with the app's own code.

### Tests

```bash
npm test          # Vitest: permission check for every role, business rules, crypto, password reset (42 tests)
npm run lint      # TypeScript type check
```

---

## Deploy to Cloudflare (one command after first-time setup)

First time only:

```bash
npx wrangler login
npx wrangler d1 create fairshare-db          # copy the printed database_id into wrangler.jsonc
npx wrangler secret put SESSION_SECRET       # paste a long random string
npx wrangler secret put RESEND_API_KEY       # optional
```

Every deploy:

```bash
npm run deploy     # builds with OpenNext, applies D1 migrations remotely, deploys the Worker
```

Optional: `npm run db:seed:remote` to load demo data into production. To try the production build locally in the real Workers runtime: `npm run preview`.

---

## Demo logins

Every demo account uses the password **`FairShare2026!`**.

| Role | Email | Notes |
|---|---|---|
| Instructor | `linda.harris@fairshare.demo` | Dr. Linda Harris — MGT 3200 Principles of Management, Section 2 |
| Student | `marcus.reed@fairshare.demo` | Team Tigers — Project Lead |
| Student | `priya.shah@fairshare.demo` | Team Tigers — Documentation |
| Student | `devon.brooks@fairshare.demo` | Team Tigers — Prototype (no work in 3+ weeks; gave everyone 5s) |
| Student | `aaliyah.johnson@fairshare.demo` | Team Tigers — Presentation |
| Student | `jordan.miller@fairshare.demo`, `alex.rivera@…`, `sam.chen@…`, `taylor.nguyen@…` | Team Pelicans (healthy; charter waiting on Taylor) |
| Student | `chris.lopez@fairshare.demo`, `emma.davis@…`, `noah.patel@…`, `olivia.kim@…` | Team Magnolias (finished channel) |

A ready-to-use invite link (Team Pelicans, not yet accepted): **`/invite/demo-invite-riley`**.

### Suggested demo script

1. **Linda** → Dashboard: *"Team Tigers in Section 2 may need attention"* (Devon inactive, one dispute, one unusual rating).
2. **Linda** → Reviews: uphold Devon's disputed "login screen" entry with a note; dismiss or confirm the all-5s flag.
3. **Linda** → Team Tigers: review the peer ratings; reassign "Prototype test plan" from Devon to Priya.
4. **Marcus** (narrow your browser to phone width) → Log & Verify: confirm Aaliyah's entry, log a task in under a minute.
5. **Linda** → New project → upload `public/sample-roster.csv` → review settings → Publish. Invite links appear in the terminal; open one to join as a new student.
6. **Linda** → Project → mark Milestone 2 complete; **Marcus** → Ratings → rate teammates.
7. **Linda** → Team Pelicans → Finish channel; students can still read it but not log work.

---

## Integrity checks

Integrity and early-warning thresholds live in [`src/config/integrity-rules.ts`](src/config/integrity-rules.ts):
- **Identical scores:** a rater who rated every teammate (≥ 2) and gave all the same score.
- **Reciprocal inflation:** two members rate each other ≥ 4 *and* ≥ (team average + 1.0).
- **Inactive member:** no logged work in 21 days (only for live channels, and only after the member has been on the team for 21 days).

---

## Architecture (PBI P04)

```
UI (app/ pages, server actions)
  → Auth            src/lib/auth/        who is asking (signed HttpOnly cookie, PBKDF2 passwords)
  → Permission      src/lib/permissions.ts   can(user, action, resource) — the single rule book
  → Services        src/lib/services/    class-setup · contribution-service · team-health · peer-evaluation
  → Data Access     src/lib/data/        plain SQL with .bind(); the ONLY code that touches env.DB
  → Cloudflare D1   db/migrations/
```

- Pages and server actions call **services only**. Every service calls `authorize()` (which calls `can()`) with facts loaded from the database before it reads or writes.
- Pure business rules (verification majority, charter completion, integrity flags, roster parsing) live in `src/lib/rules.ts` and `src/config/` with no I/O, so they're unit-tested.
- Server actions are bound with their ids in server components (`action.bind(null, teamId)`), so ids are encrypted and can't be swapped in the browser; services re-check permissions regardless.

Project layout:

```
db/migrations/          D1 schema (16 tables, CHECKs, FKs, indexes)
scripts/                generate-seed.ts, db-setup.mjs
src/app/                routes: /login /signup /invite/[token] /instructor/** /teams/**
src/app/actions/        server actions (thin: parse form → call service → return message)
src/components/         design-system components (Button, Field, Chip, HeaderBar, ContributionCard)
src/config/             integrity and early-warning thresholds
src/lib/                auth, permissions, rules, services, data access
tests/                  Vitest unit tests
```

See [DECISIONS.md](DECISIONS.md) for choices made where the spec was silent or ambiguous.
