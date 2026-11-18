# FairShare: instructions for Claude

FairShare is a peer evaluation and team contribution app (ISDS 4125 group project). Next.js App Router on Cloudflare Workers, Cloudflare D1 database, Resend email. Live at https://fairshare.page. Five people push to this repo, often through their own Claude.

@AGENTS.md

## Git workflow (read before committing or pushing)

- Work on `main` and push directly; no pull request is needed. Short feature branches are fine too.
- **Every push to `main` deploys to the live site** (GitHub Actions: lint, test, then deploy). Treat a push as a release.
- Before you start and again right before you push: `git pull --rebase`. If a push is rejected ("fetch first" or "non-fast-forward"), pull with rebase and push again.
- **Never force-push** (`--force`, `--force-with-lease`). It is blocked on `main`, and it would erase teammates' work. Never rewrite history that is already on GitHub.
- If a rebase hits a conflict, resolve it keeping both people's intent. If you can't tell which version is right, stop and ask the user.
- Commit only what the user asked for. Don't commit `.dev.vars`, `.env*`, `db/seed.sql`, or `fairshare-fluid-theme_1.patch`.

## Before every push

```
npm run lint   # TypeScript check
npm test       # Vitest
```
Both must pass. If a test fails, fix the cause; don't delete or weaken the test to make it pass. For UI changes, check the page in `npm run dev` (http://localhost:3000, demo logins in README.md, password `FairShare2026!`).

## Never do these

- **Don't run `npm run deploy`, `npm run db:seed:remote`, or any `wrangler ... --remote` command.** They need the project owner's Cloudflare login and change the live site or live database. Deploys happen automatically on push.
- Don't run `wrangler login`, and don't create or ask for Cloudflare or Resend keys.
- Don't put secrets, tokens or passwords in code, commits, or messages.
- Don't edit `.github/workflows/` or `wrangler.jsonc` unless the user specifically asks.

## Database changes

- Schema changes go in a **new** numbered file in `db/migrations/`, e.g. `0004_short_name.sql`. Never edit an existing migration; they have already run on the live database.
- Check `db/migrations/` for the next number, and tell the user to confirm it with the group so two people don't both add the same number.
- The deploy applies new migrations to the live database automatically. Write migrations that only add things (new tables or nullable columns); never drop or rename columns without the user agreeing first.
- If the seed data should change too, update `scripts/generate-seed.ts`, then `npm run db:reset` locally.

## Architecture rules (keep them)

The layers are: UI (`src/app`) → server actions (`src/app/actions`) → services (`src/lib/services`) → data layer (`src/lib/data`) → D1.

- Pages and server actions call **services only**, never the data layer or D1 directly.
- Every service function checks permission first with `authorize(...)` / `authorizeTeam(...)` from `src/lib/permissions.ts` and `src/lib/services/common.ts`. New actions get a rule in `can()` plus tests in `tests/permissions.test.ts`.
- Only `src/lib/data/` touches the database. Use `.bind()` parameters, never string-built SQL with user input. Multi-step writes go in one `batch(...)`.
- Bind server actions in **server components** (`action.bind(null, id)` passed as a prop), not inside client components. Binding in client components breaks no-JS form posts.
- Pure rules (no I/O) live in `src/lib/rules.ts` and `src/config/`, with tests in `tests/`.
- Roles: `instructor` and `student` only. Students pick their own role in the team charter. There are no viewers, public channels, or read-only members.

## UI style

- Use the design tokens in `src/app/globals.css` and the components in `src/components/ui.tsx` (Button, Field, Chip, HeaderBar, Page).
- Primary blue for actions, green for confirmed, red for disputed, orange only for brand accents.
- Copy is short and plain: buttons name the action ("Next", "Dismiss", "Reject dispute"), success messages are a few words, **no em dashes or en dashes** in on-screen text, no hints that repeat the label.
- Phone layout first; check that new screens work at phone width.

## Useful files

- `README.md`: setup, scripts, demo accounts
- `DECISIONS.md`: why things work the way they do. Add a numbered entry when you make a notable design choice.
