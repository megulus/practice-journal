# Handoff: manager for the #287 / #300 / #305 batch

You own management of an in-flight batch. Read `CLAUDE.md` → **"Shepherding a batch of agents"** first;
it is the process, and this document is only the state that process needs.

Two tasks are already running. **Nothing has been posted to any PR. The board has not been touched.**

---

## 1. The tasks you are shepherding

Both `claude-opus-5`, both created 2026-09-17, neither had pushed a branch or PR as of this handoff.

| Ticket(s) | Task id | Branch it was told to use | Effort |
|---|---|---|---|
| #300 + #287 (one workspace, one PR) | `task_e25m76c7wtobr8zj` | `issue-300-287-insights-week-start-and-empty-state` | high |
| #305 Capacitor spike | `task_0kf77y4itwk9ybdy` | `issue-305-capacitor-spike` | xhigh |

**Parentage caveat:** both were created from a third task, so `list_tasks` with `parentTaskId=<your id>`
will **not** show them. Use `repo: megulus/practice-journal`, or the task ids above.

**Why #300 and #287 share a workspace:** file overlap, not theme.
`frontend/src/components/progress/InsightsPanel.tsx` owns both the `Promise.all` data load that #300
must add `getSettings()` to (line ~61) and the `hasAnyPractice` render gate that #287 rewrites (line ~101).
The spike shares no files with anything.

---

## 2. Calls already made in the dispatch prompts

Do not re-litigate these; **do** verify them against the code during review.

### #287 (a `design-decision` ticket — these were made deliberately)
- Distinguish "never practised" from "nothing in these windows" via `Instrument.last_practiced_at`
  (the un-windowed signal), passed down as a prop from the Progress page, which already holds `instruments`.
  Agent was told to verify how it is computed server-side (`backend/app/api/instruments_api.py:67`),
  including whether it counts only completed sessions.
- **Lapsed user → render the charts, not a placeholder** (an empty January after a dense December is the
  truer story), with a short line acknowledging the history.
- **Genuinely new user → keep an empty state**, copy reworked in the coaching voice (spec §5.2/§5.3/§5.7).
- **Deferred to write-ups, not built:** a rolling-12-month heatmap window (changes the backend window),
  and rehoming the lapsed case in the suggestions engine (#253). The agent may argue in its PR body that
  either is the real fix — **those are yours to file as tickets** if it does.
- **Copy is Meg's call and is being held open.** The agent must put exact before/after strings in the PR
  description as a decision for her review. Per "Surface human calls, then actually hold them open" — do
  not let a reviewer's "reads fine" stand in for her decision.

### #300
- Implement option (1): thread the setting through, which is what spec §5.8 describes.
- Also told to check the backend's week-boundary computation so the grid agrees with the comparison and
  ratings above it, and to flag rather than paper over a mismatch.
- **Its spec hazard was briefed backwards — see §4 below. Correct this early.**

### #305
- **The sandbox is Linux — no macOS, Xcode, simulator or iPhone — so this task cannot reach a verdict.**
  Scoped to what is genuinely answerable: does static export survive a realistic app shape; does Clerk work
  as a pure static SPA with no middleware (verified in a real browser via agent-browser); what FastAPI's CORS
  does with a `capacitor://localhost` origin (probed against the live backend). Plus the Phase C harness and
  a step-by-step **on-device run-book** for Meg.
- Every finding must be marked **observed / documented-not-observed / needs-device**, with no inferred device
  results. **Spot-check this** — it is the likeliest place for confident-but-stale claims.
- Deliverable: `spikes/capacitor-spike/` scaffold + `FINDINGS.md`, as a **draft PR titled
  "SPIKE — do not merge (#305)", with no "Closes #305"**, so the issue stays open for her device phases.
  The in-repo-draft-PR shape was the previous manager's call, not the ticket's (the ticket says nothing merges
  and names a throwaway repo); the agent was told to say in its PR body if a separate disposable repo is better.
  **Confirm with Meg before anyone merges or closes anything here.**
- The agent was told to record two known repo-side consequences: the `VoiceInput` provider abstraction, and
  that the design-tokens §6 feature check is wrong — `'webkitSpeechRecognition' in window` is true in WKWebView,
  which is **a live bug on the web today** in any iOS in-app browser. It was told to flag whether that deserves
  its own ticket **without filing it**. Filing is yours.

---

## 3. Open human decisions to track (do not let these quietly resolve themselves)

1. **#287 copy** — Meg decides, in the PR.
2. **#305 deliverable shape** — in-repo draft PR vs throwaway repo. One message from her to redirect.
3. **#305 verdict** — not reachable without her device work (Phase C evaluation, D2–D4).
4. **#321** (below) — which spec regressions to restore, and whether the Theme-preference removal was deliberate.

---

## 4. Correction to #300's brief — act on this first

#300's agent was told that #272 had narrowed spec §5.8 to drop the untrue heatmap claim, and that its PR
would be *widening it back*. **That is backwards, and the cause is a wider regression.**

`50268fd` ("Docs: replace product spec with the August v1-scope version", 2026-08-19) replaced
`docs/kantelo-product-spec.md` wholesale from a base predating several merged PRs, silently reverting their
corrections. `docs/kantelo-schema-api.md` was *not* replaced, so the two contract docs now disagree — and in
places the spec contradicts shipped code:

| Spec on `main` today | Reality |
|---|---|
| §5.7: History pills are "All sessions / This week / This month" | ships as "Last 7 days" / "Last 30 days" (`HistoryList.tsx:17`) |
| §5.8 line ~420: Week starts on "affects the practice calendar heatmap" | it does not — that is what #300 is open to fix |
| §5.2 line ~227: coaching example "one more **this week** matches your goal" | shipped string is "one more **and you'll** match your goal" (`rules.py:336`) |
| (missing) the "#149 wireframe labels are illustrative, §5.2 wins" anti-drift note | lost |

Filed as **#321**, written as a decision. It separates the clear factual regressions from possibly-deliberate
v1 descoping (the Theme-preference row is gone from §5.8, but `theme_preference` is still a live column and a
shipped control — that one needs Meg's eye rather than a revert).

**Send #300's task something like:** the §5.8 line already (wrongly) claims heatmap support, so its job is to
make the code match a claim the spec already makes, not to widen the spec; it should read the current text
rather than the pre-#272 or post-#272 wording; and ask whether to fold the §5.7 and §5.2 restorations into its
PR, since it is already editing that file — contingent on Meg's answer on #321.

---

## 5. Shepherding notes specific to this batch

- **No file overlap between the two workspaces.** Only #300 touches `docs/kantelo-product-spec.md` (§5.8);
  **neither touches `docs/kantelo-schema-api.md`**, so the usual batch doc-merge hazard does not apply.
- Separate cloud sandboxes — no port or `practice_journal_test` contention to serialize.
- **Merge order:** the Insights PR is the only thing that merges. The spike PR is a draft that must not.
- **Frontend gate:** `npm test` **and** `npm run typecheck` (its own script since #293 — the only thing that
  type-checks test files). Both agents were told **not** to run `npm run build` in the working tree, since a
  native `next dev` shares `frontend/.next`; CI runs the build.
- **Do not duplicate:** Meg is filing two #297 follow-ups herself — the client idempotency key rotating on
  payload change, and the absence of an expiry job for `idempotency_records`.

---

## 6. Board state (read 2026-09-17)

`Ready` held exactly these three, none `human-only`: **#287**, **#300**, **#305**. `In progress` was empty.

Board writes are propose-then-confirm per `CLAUDE.md`. **Pending Meg's confirmation:** move #287/#300/#305 to
`In progress`, and add **#321** to `Backlog`. The paged GraphQL query is mandatory — the board is ~179 items
and a single `first: 100` silently truncates.

---

## 7. What the previous manager had already done

- Filed **#321** (spec regression).
- Verified the board state above; **made no board writes**.
- **Posted nothing to any PR.**
- Confirmed neither task had pushed a branch or opened a PR.
