# Decisions

Choices made where the build spec or the Milestone 1/2 documents were silent, ambiguous, or in tension. Each is easy to revisit.

## Data model

1. **`projects.member_access` (migration 0002).** P07 lets the instructor change the template's default student access, but the Milestone 2 schema only stores `anonymous_evals` on `projects`. A nullable `member_access` column holds the choice (NULL = template default). Kept in its own migration so the deviation from the data dictionary is visible.
2. **Invitations don't store names.** The roster CSV has first/last names, but `invitations` only has `invited_email` (per the data dictionary). Students type their name when they accept the invite. If you'd rather prefill it, add `invited_first_name`/`invited_last_name` to `invitations`.
3. **Extra integrity constraints:** `UNIQUE(project_id, team_name)` on teams; public channels must be finished (`CHECK`); a trigger stops a verifier confirming their own contribution; disputes require a reason (`CHECK`); a completed milestone must have a completion date; `UNIQUE(milestone_id, team_id, rater_id, flag_type)` on flags so re-running the checks never duplicates them.
4. **Emails are stored lower-case and compared case-insensitively.**

## Business rules

5. **"Majority of the other team members"** counts teammates with **write** access, excluding the author, and needs a strict majority (team of 4 → 2 of 3 confirms; pair → 1 of 1).
6. **Dispute outcomes.** *Upheld* = the disputing teammate was right; the entry stays `disputed` and earns no credit. *Rejected* = the claim stands; the instructor's review counts as verification and the entry becomes `confirmed`. A resolution note is required (the team sees it).
7. **Once settled, an entry can't be re-verified.** Confirm/Dispute only appear on `pending` entries.
8. **"Credit follows the new owner" (P13).** Reassignment moves `tasks.user_id` and records history. A student can only link logged work to a task they own (or an unassigned one), so future work on a reassigned task is credited to its new owner. Past entries keep their original author.
9. **Ratings** must cover every teammate in one submission (one set per milestone, no edits) so the identical-score check is meaningful. Integrity checks run after every submission and are idempotent.
10. **Rating comments are instructor-only.** The ratings form says "Optional comment for your instructor", and P12 asks that answers stay hidden, so students see the scores they received (names hidden when anonymous) but never comments.
11. **`anonymous_evals` NULL is treated as anonymous** (the safe default).
12. **Early warning** uses *logged_date* within 21 days, only for `published` channels, and only for members who joined more than 21 days ago (so new teams aren't flagged on day one). The spec's "weekly pulse check-ins" (Milestone 1) aren't in the PBI list, so the warning is driven by work logs, disputes and flags.
13. **Hours** must be 0.5–24 per entry (the design system's example error message); the column itself allows 0–999.9.

## Permissions

14. **Students can't read a `draft` channel** even if listed; draft teams only have pending invitations anyway.
15. **Finished-but-private channels** are read-only for students, but can still collect final peer ratings. Once public, nobody can write or rate.
16. **Both instructors and team members may make a finished channel public** (P17 says "as a student"; the build spec says "instructor or team member").
17. **Instructor dashboards and queues** are scoped by `courses.instructor_id` in SQL, and every mutation re-checks ownership through `can()`.

## Auth & email

18. **Custom auth, not Auth.js.** The architecture diagram says "Auth.js", but the build spec asks for PBKDF2 via Web Crypto and a signed cookie with no Node-only libraries. Sessions are a 7-day HMAC-SHA256-signed token in an `HttpOnly; Secure; SameSite=Lax` cookie. PBKDF2 runs 100,000 iterations (the Cloudflare Workers maximum) with a 16-byte salt per user.
19. **Who can sign up:** open sign-up is for **instructors and viewers**. Students join only through the single-use invite link, which creates their account and membership in one step. If the email already has a student account, the invite asks for that password and just adds the membership.
20. **Resend via HTTP API** (no SDK) so it runs in Workers. Without `RESEND_API_KEY`, emails are logged to the console with their links. Sign-up sends a welcome email (P02 "email sign-up through Resend").
21. **The `Secure` cookie flag is always on.** Browsers treat `http://localhost` as a secure context, so local dev still works.

## UI

22. **Setup wizard order** follows the Epic 1 activity diagram: 1 Project/template → 2 Class list → 3 Settings (explained, accept or adjust) → 4 Publish.
23. **The team grade for the formula** isn't in the schema, so the instructor types it on the team page (a URL parameter, not stored). Store it later if grades should persist.
24. **Tasks tab.** The schema has `tasks`, but no PBI creates them, so team members can add and update tasks; this is what makes reassignment (P13) and task linking (P09) demonstrable.
25. **Demo accounts box** on the login page shows in dev only (or in production with `SHOW_DEMO_LOGINS=1`).

## Engineering

26. **Server actions are bound in server components** (`action.bind(null, id)` passed as a prop). Binding inside client components made no-JS form posts on the team channel hang on re-render; binding on the server also encrypts the bound ids.
27. **TypeScript 5.x pinned**: `npm install typescript` resolves to 7.x (the native compiler), which Next's build-time type check isn't verified against.
28. **Out of scope** (not built, per spec §8): AI coach, third-party integrations, live LMS sync, non-education templates, native apps, SSO/E2E encryption, cross-project dashboards, payments, multi-step mediation.

## Deleting (added after Milestone 2)

29. **Instructors can permanently delete a project or a team, and take a public channel back to private.** Only the course's instructor can (`project.delete`, `team.delete`, `team.unpublish` in `can()`); students and viewers never can, even for their own team.
30. **Deletes are explicit and all-or-nothing.** The schema has no `ON DELETE CASCADE`, so `repo.deleteTeam` / `repo.deleteProject` remove child rows in dependency order (flags, ratings, disputes, verifications, work log, reassignments, tasks, charter, invites, memberships, team; then milestones and the project) in one D1 batch.
31. **What is kept:** user accounts (a student may be on other teams) and the course (so a new project can reuse it).
32. **"Delete a public channel" = two options.** *Remove from public channels* makes it private and keeps everything; *Delete team* removes it entirely. The confirmation requires typing the exact name, and the server re-checks it.
