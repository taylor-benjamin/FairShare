# Decisions

Choices made where the build spec or the Milestone 1/2 documents were silent, ambiguous, or in tension. Each is easy to revisit.

## Data model

1. **`projects.member_access` (migration 0002).** Originally held the instructor's choice of student access. The "Read only" option was removed (Nov 2026): every student can log and confirm work, so the column is always `write`. There are two account types: **instructor** (admin/teacher) and **student** (user); students choose their project role in the team charter.
2. **Invitations don't store names.** The roster CSV has first/last names, but `invitations` only has `invited_email` (per the data dictionary). Students type their name when they accept the invite. If you'd rather prefill it, add `invited_first_name`/`invited_last_name` to `invitations`.
3. **Extra integrity constraints:** `UNIQUE(project_id, team_name)` on teams; a trigger stops a verifier confirming their own contribution; disputes require a reason (`CHECK`); a completed milestone must have a completion date; `UNIQUE(milestone_id, team_id, rater_id, flag_type)` on flags so re-running the checks never duplicates them.
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
15. **Finished channels** are read-only for their students, but can still collect final peer ratings.
16. **Public read-only channels (P17) were removed** (Nov 2026) as out of scope. Every channel is visible only to its members and the course instructor. The `teams.visibility` column stays in the schema but is always `private`.
17. **Instructor dashboards and queues** are scoped by `courses.instructor_id` in SQL, and every mutation re-checks ownership through `can()`.

## Auth & email

18. **Custom auth, not Auth.js.** The architecture diagram says "Auth.js", but the build spec asks for PBKDF2 via Web Crypto and a signed cookie with no Node-only libraries. Sessions are a 7-day HMAC-SHA256-signed token in an `HttpOnly; Secure; SameSite=Lax` cookie. PBKDF2 runs 100,000 iterations (the Cloudflare Workers maximum) with a 16-byte salt per user.
19. **Who can sign up:** open sign-up creates **instructor** accounts only. The "viewer" role was removed (Nov 2026) along with public channels; any leftover viewer account can't sign in, and becomes a student if it accepts a team invite. Students join only through the single-use invite link, which creates their account and membership in one step. If the email already has a student account, the invite asks for that password and just adds the membership.
20. **Resend via HTTP API** (no SDK) so it runs in Workers. Without `RESEND_API_KEY`, emails are logged to the console with their links. Sign-up sends a welcome email (P02 "email sign-up through Resend").
21. **The `Secure` cookie flag is always on.** Browsers treat `http://localhost` as a secure context, so local dev still works.

## UI

22. **Setup wizard order** follows the Epic 1 activity diagram: 1 Project/template → 2 Class list → 3 Settings (explained, accept or adjust) → 4 Publish.
23. **Contribution scores were removed** (Nov 2026). The adjusted-grade formula is out of scope; instructors see peer ratings, confirmed work and integrity flags, and grade outside the app.
24. **Tasks tab.** The schema has `tasks`, but no PBI creates them, so team members can add and update tasks; this is what makes reassignment (P13) and task linking (P09) demonstrable.
25. **Demo accounts box** on the login page shows in dev only (or in production with `SHOW_DEMO_LOGINS=1`).

## Engineering

26. **Server actions are bound in server components** (`action.bind(null, id)` passed as a prop). Binding inside client components made no-JS form posts on the team channel hang on re-render; binding on the server also encrypts the bound ids.
27. **TypeScript 5.x pinned**: `npm install typescript` resolves to 7.x (the native compiler), which Next's build-time type check isn't verified against.
28. **Out of scope** (not built, per spec §8): AI coach, third-party integrations, live LMS sync, non-education templates, native apps, SSO/E2E encryption, cross-project dashboards, payments, multi-step mediation.

## Deleting (added after Milestone 2)

29. **Instructors can permanently delete a project or a team.** Only the course's instructor can (`project.delete`, `team.delete` in `can()`); students never can, even for their own team.
30. **Deletes are explicit and all-or-nothing.** The schema has no `ON DELETE CASCADE`, so `repo.deleteTeam` / `repo.deleteProject` remove child rows in dependency order (flags, ratings, disputes, verifications, work log, reassignments, tasks, charter, invites, memberships, team; then milestones and the project) in one D1 batch.
31. **What is kept:** user accounts (a student may be on other teams) and the course (so a new project can reuse it).
32. **Deleting requires typing the exact name**, and the server re-checks it.

## Bug fixes (Nov 2026)

33. **Server-side sessions (migration 0003).** The cookie carries a signed session id that must match a `sessions` row. Log out deletes the row, so a copied cookie stops working; a password reset deletes all of the user's sessions. Cookies from before this change are rejected once, so everyone signs in again.
34. **Password-reset emails are limited to one per address every 5 minutes** (`users.reset_requested_date`). The page shows the same message either way.
35. **Confirms are counted inside the same database transaction** that records them (`contributions.recordConfirm`), so simultaneous confirms can't leave an entry stuck at "pending".
36. **Students set only their own charter role**, and setting it confirms it. Goals and expectations stay shared. A new member makes the charter incomplete until they set their role; removing a member re-checks it.
37. **Instructors can add a student to a published team, remove a member, or cancel a pending invite** from the team page. A removed student's logged work stays in the log, and their unfinished tasks become unassigned.
38. **"Completed on" defaults to the student's own local date**, set in the browser. The server accepts dates up to the latest local date anywhere (UTC+14), not 36 hours ahead.

## Task reassignment (Nov 2026)

39. **Any teammate can reassign a task, not just the instructor.** Students do it from the Tasks tab; the instructor still can from the team page. A reason is always required, and every move is recorded with who made it, so the instructor can see if someone moves work (and the future credit that follows it, see #8) without agreement. Only tasks that already have an owner can be reassigned, because `task_reassignments.from_user_id` is `NOT NULL`.

## Charter agreement and UI cleanup (Nov 2026)

40. **Everyone agrees to the charter's goals and expectations, then they lock (migration 0004).** Saving new text resets everyone's agreement; the person saving agrees to their own text. When every member has agreed, the text locks. Any member can reopen it, which records them as the last editor and asks everyone to agree again. A new member joining a locked charter doesn't unlock it; they just need to agree. The charter is complete when everyone has agreed and set a role. Existing complete charters were marked agreed and locked by the migration.
41. **Agreeing checks the version.** The Agree button sends the charter's `updated_date`; if a teammate saved changes in the meantime, the agree is refused so nobody agrees to text they haven't seen.
42. **"Last updated by ... on ..."** uses `team_charters.updated_by_id` and `updated_date`, shown in the reader's own time zone.
43. **The charter lives on the team banner**, not in the tab row, with its status (e.g. "2 of 4 agreed"). Tasks are grouped into To do, In progress and Done buckets. Field hints became placeholders, and dropdowns have rounded lists where the browser allows it (Chrome and Edge 135+).

## Deleting tasks (Nov 2026)

44. **Deleting a task: the owner decides.** For tasks added by mistake. The task's owner deletes it directly, including a task reassigned to them; an unassigned task can be deleted by any teammate. Any other teammate gets "Ask to delete" instead: the owner sees Approve delete / Decline on the task and a to-do on their dashboard, and the asker can cancel. One request at a time; reassigning a task clears a pending request. A task with logged work can never be deleted, so nobody's credit disappears. Deleting **hides** the task (migration 0005: `tasks.deleted_by_id`, `deleted_date`, `delete_requested_by_id`, `delete_requested_date`) instead of removing the row, so its reassignment history stays and the "Task history" list (Tasks tab and instructor team page) shows who deleted it and who asked. `tasks.byId` and `byTeam` skip deleted tasks, so they can't be edited, reassigned, or have work logged against them. The rules are pure functions in `rules.ts` (`taskDeleteMode`, `canAnswerDeleteRequest`) on top of `team.write`, and the final delete re-checks "no logged work" in the same SQL statement (`tasks.softDeleteIfNoWork`).

## Notifications and date picker (Nov 2026)

45. **A bell in the top bar lists what needs the user, built fresh on each page load (no new tables).** Students see overdue tasks they own, everything from the dashboard's To do list (confirm, rate, delete requests, charter steps), their own entries a teammate disputed, and tasks and milestones due in the next 7 days (`DEADLINE_WINDOW_DAYS`). Instructors see open disputes and rating flags, plus open milestones that are past due (ratings only open once a milestone is complete) or due within 7 days. The badge counts the items; there is no "read" state, so an item goes away once it's handled or no longer due. The student list reuses `loadStudentTodos`, so the bell and the dashboard always agree. "Today" is the UTC date, the same calendar due dates are stored in; date math is in `rules.ts` (`addDaysIso`, `daysUntil`, `dueLabel`). If loading the notifications fails, the page still renders with an empty bell.
46. **Date fields use our own calendar (`DatePicker`)** because the browser's built-in calendar popup can't be styled to match the rounded theme. It submits `YYYY-MM-DD` under the same field name as `<input type="date">`, so the server code didn't change, respects `min`/`max`, supports the keyboard (arrows, Page Up/Down, Home/End, Escape), and resets with its form.
47. **The instructor's New project button has a dropdown with New class and Upload class list.** New class opens the same setup form with "A different course or section" already chosen (`?class=new`), because a class is always created together with its first project. Upload class list appears once for each project that has no teams yet and opens its roster page. The dashboard no longer shows the "Upload your class list" next step card (just a short "No teams yet" line) or the "Nothing needs your review" banner.

## Cleaner layout, student side (Nov 2026)

48. **Less clutter, one even card system, still in the brand colors.** The blue page banner stays. Cards have a hairline border and almost no shadow; stat tiles drop their icons and are tinted in their tone (blue, orange, green, red) instead; lists live in `Panel` cards (title row, divided rows) whose title row can be tinted (`tone`), and task columns are tinted by status. Secondary actions move into dropdowns: the profile menu holds Log out, and each task's rarer actions (other status moves, reassign, delete) sit in a "⋯" `MoreMenu` built on `<details>`, so it still works without JavaScript. Students get a "My teams" dropdown in the top bar listing every team with its project and class, even when there is only one, so the label never changes (the phone menu lists them all).
49. **Log & Verify shows accountability at a glance.** Entries waiting on you get their own "Needs your review" card above the team activity, the activity has a filter dropdown (`?show=mine|pending|confirmed|disputed`), and a "Confirmed hours" card compares every teammate's verified hours. The dashboard adds a "Coming up" list of the student's tasks and milestones due in the next two weeks.
50. **The instructor side uses the same cards.** The dashboard has one "To do" card (disputes, flags and each project's next setup step, with its button) and, per project, one row per team showing how many warnings it has (the team page spells them out) and a stacked bar of each member's share of the confirmed hours (`ShareBar`), so a student who isn't contributing stands out (members with 0 h are red). The team page shows "Needs attention", the same "Confirmed hours" card students see (`HoursPanel`), and the work log with a filter. Rarely used actions (remove a member, resend or cancel an invite) sit in "⋯" menus. Page tabs stay on one line and scroll sideways on phones.
51. **The public demo gives each visitor a private copy of the class.** With `DEMO_MODE=1`, the shared professor and student logins create a separate set of ordinary accounts, so the existing permission checks keep copies apart and visitors cannot disturb each other. A demo bar switches between people in the same copy and resets it. Copies expire after 24 hours. Demo mode sends no email, turns off sign up and password reset, and rewrites invited addresses so they stay inside the copy. It must run on its own site and database, never on the real one.

## Percentage ratings (Nov 2026)

52. **Milestone ratings are a percentage split of the work, including yourself (migration 0006).** Each rater divides exactly 100.00% across the whole team with sliders. Shares are stored as whole basis points (2500 = 25.00%) in a new `contribution_shares` table, because `evaluations.score` is limited to 1 to 5 and forbids self ratings, and existing migrations can't change. Past 1 to 5 ratings stay in `evaluations` and still display. Moving a slider adjusts only sliders the rater hasn't set, unless those can't cover the change. Students see their self rating next to their teammates' average; instructors see self, peers and the gap for everyone. Integrity flags now fire on an even split across all members, or two people each giving the other at least 1.5 times an even share.

## One place for to-dos (Nov 2026)

53. **The dashboards no longer have a To do box; the notification bell is the one list.** Instructor next setup steps (publish, add a milestone, send invites) moved into the bell, and a milestone due today now reads "Mark ... complete" there. A complete-milestone step isn't listed twice when the milestone is already in the bell. Uploading a class list stays in the New menu.
