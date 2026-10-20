The stack runs as Niteshift services (`ns services status`), not `docker compose`, so the
`docker compose exec backend ...` commands in CLAUDE.md don't apply here. Run backend
commands natively from `backend/` with `venv/bin/...` (e.g. `venv/bin/python -m pytest tests/ -v`,
`venv/bin/alembic upgrade head`); the dev database is on `localhost:5432`.

`CLERK_SECRET_KEY` is not in the shell environment; it's a Niteshift secret, so there is one copy to
rotate. When a command needs it (e.g. creating a Clerk sign-in token to verify a signed-in flow), inject
it without printing it: `ns secrets exec --env CLERK_SECRET_KEY=CLERK_SECRET_KEY -- <command>`.
Never echo or log the value.
