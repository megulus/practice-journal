The stack runs as Niteshift services (`ns services status`), not `docker compose`, so the
`docker compose exec backend ...` commands in CLAUDE.md don't apply here. Run backend
commands natively from `backend/` with `venv/bin/...` (e.g. `venv/bin/python -m pytest tests/ -v`,
`venv/bin/alembic upgrade head`); the dev database is on `localhost:5432`.

When a command needs `CLERK_SECRET_KEY` (e.g. creating a Clerk sign-in token to verify a signed-in
flow), read it with `ns secrets exec --env CLERK_SECRET_KEY=CLERK_SECRET_KEY -- <command>`. That
returns the live value from the environment settings; any copy captured at sandbox setup goes stale
when the key is rotated. Never echo or log the value.
