# Kantelo (Practice Journal)

A practice coach for musicians. Practice smarter, not just more. The repository is named `practice-journal` for historical reasons but the application is now Kantelo — see `docs/kantelo-product-spec.md` for the full product spec.

## Features

- 📋 **Structured practice plans** with rotation support and per-session focus
- ✏️ **Session logging** with directional ratings (step back / steady / step forward), per-block notes, and a guided post-session reflection prompt
- 🎼 **Repertoire library** with pieces and spots — coaching can track progress on "the trouble spots in mm. 24-28," not just whole pieces
- 📊 **Progress insights** including a contribution-style heatmap, week-over-week comparisons, and rating trends
- 🤖 **Coaching suggestions engine** with 9 rules across pre-session, in-the-moment, post-session, and pattern-level tiers
- 🎻 **Multi-instrument** with per-instrument practice frequency (daily / few times a week / weekly / occasionally)

## Technology Stack

### Backend
- **FastAPI** + **SQLModel** (async)
- **PostgreSQL**
- **Alembic** for migrations
- **Clerk** for authentication

### Frontend
- **Next.js** (App Router)
- **React** + **TypeScript**
- **Tailwind CSS**

### Development
- **Docker Compose**
- **pytest** (backend) + **Vitest** (frontend)

## Prerequisites

- Docker and Docker Compose

## Getting Started

### 1. Clone the Repository

```bash
git clone <repository-url>
cd practice-journal
```

### 2. Start the Application

```bash
docker compose up --build
```

This will start three services:
- **PostgreSQL** database on port 5432
- **Backend API** on http://localhost:8000
- **Frontend** on http://localhost:3000

### 3. Initialize the Database

In a new terminal, run the database migrations:

```bash
# Run migrations
docker compose exec backend alembic upgrade head

# Optional: seed the global curated block library (popular practice
# blocks per instrument category — used by the block library UI)
docker compose exec backend python scripts/seed_curated_blocks.py
```

User-owned data (instruments, templates, pieces, practice logs) is created
through the application — there's no per-user seed step. Sign in via Clerk
on the frontend and your user record will be created automatically on first
API call.

### 4. Access the Application

Open your browser and navigate to:
- **Frontend**: http://localhost:3000
- **API Documentation**: http://localhost:8000/docs (Swagger UI)
- **Alternative API Docs**: http://localhost:8000/redoc (ReDoc)

## Project Structure

```
practice-journal/
├── backend/
│   ├── app/
│   │   ├── api/                # FastAPI routers (one per resource)
│   │   │   ├── user_api.py
│   │   │   ├── settings_api.py
│   │   │   ├── instruments_api.py
│   │   │   ├── pieces_api.py
│   │   │   ├── library_api.py
│   │   │   ├── templates_api.py
│   │   │   ├── sessions_sections_blocks_api.py
│   │   │   ├── practice_api.py
│   │   │   ├── suggestions_api.py
│   │   │   ├── today_api.py
│   │   │   ├── progress_api.py
│   │   │   └── ownership.py    # Shared ownership-validation helpers
│   │   ├── models/             # SQLModel database models (package)
│   │   ├── schemas/            # Pydantic request/response schemas
│   │   ├── services/           # Reusable business logic
│   │   ├── suggestions/        # Coaching engine (rules + orchestrator)
│   │   ├── auth.py             # Clerk integration
│   │   ├── config.py
│   │   ├── database.py
│   │   └── main.py
│   ├── alembic/                # Database migrations
│   ├── scripts/
│   │   ├── seed_curated_blocks.py  # Global block library seed
│   │   ├── setup-dev-env.sh        # Local Python dev environment
│   │   └── clean-test-dbs.sh       # Remove leftover test databases
│   ├── tests/                  # pytest integration suite
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── app/                # Next.js pages (App Router)
│   │   ├── components/
│   │   └── lib/                # API client and TypeScript types
│   └── package.json
├── docs/                       # Product spec, schema/API docs, wireframes
└── docker-compose.yml
```

## API Endpoints

All endpoints are under `/api`. Authentication is via Clerk — most endpoints require a logged-in user. See `http://localhost:8000/docs` for the live OpenAPI explorer, and `docs/kantelo-schema-api.md` for the canonical specification. Major resource groups:

- **`/user/me`, `/settings`** — current user and preferences
- **`/instruments`** — user-owned instruments with practice frequency
- **`/instruments/{id}/pieces`, `/pieces/{id}`, `/spots/{id}`** — repertoire library (pieces and their practiced spots)
- **`/library/blocks`, `/library/recent`, `/library/repertoire`** — block library for the template editor
- **`/instruments/{id}/templates`, `/templates/{id}`** — practice templates with sessions, sections, and blocks
- **`/practice/start`, `/practice/{id}`, `/practice/{id}/finish`** — practice session lifecycle
- **`/today`** — what's due to practice now
- **`/progress/history`, `/progress/insights/...`** — session history and analytics (heatmap, week comparison, rating trends)
- **`/suggestions/pre-session`, `/suggestions/in-session/{logId}`, `/suggestions/dismiss`, `/suggestions/interact`** — coaching suggestions

## Database Schema

The schema is documented in full in `docs/kantelo-schema-api.md`. Top-level tables:

- **users**, **user_settings** — Clerk-backed users and per-user preferences
- **instruments** — user-owned instruments with practice frequency
- **pieces**, **spots**, **template_block_spots** — repertoire library (pieces, their spots, and links to repertoire blocks in templates)
- **templates**, **template_sessions**, **sections**, **blocks** — practice plans with rotation support
- **curated_blocks** — global library of common practice blocks per instrument category
- **practice_logs**, **section_logs**, **block_logs** — logged practice sessions
- **suggestion_dismissals**, **suggestion_interactions** — coaching engine state and analytics

## Development Workflow

### Running the Development Server

```bash
docker compose up
```

The frontend and backend will automatically reload when you make changes to the code.

### Stopping the Services

```bash
docker compose down
```

### Viewing Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f backend
docker compose logs -f frontend
```

### Accessing the Database

```bash
docker compose exec db psql -U practice_user -d practice_journal
```

### Creating a New Database Migration

```bash
# After modifying models
docker compose exec backend alembic revision --autogenerate -m "Description of changes"

# Apply migration
docker compose exec backend alembic upgrade head
```

### Resetting the Database

```bash
# Stop services
docker compose down

# Remove volumes
docker volume rm practice-journal_postgres_data

# Restart and re-initialize
docker compose up -d
docker compose exec backend alembic upgrade head
docker compose exec backend python scripts/seed_curated_blocks.py  # optional
```

### UI primitives preview

The frontend serves a dev-only route at `/preview` that renders every
design-system primitive in both light and dark scope side by side —
useful for eyeballing variants while retoning screens during the Phase 0
rebuild.

- **Local dev:** http://localhost:3000/preview (no flag needed).
- **Production:** The route's server component redirects to `/today`
  unless the build was made with `NEXT_PUBLIC_PREVIEW_ENABLED=1`.
  Because it's a `NEXT_PUBLIC_*` variable it's inlined at build time, so
  toggling it requires a fresh image — set it as a build arg, not a
  runtime env var. The plumbing is already wired through `Dockerfile`,
  `railway.toml`, and `docker-compose.yml`; enable it on a staging or
  preview environment to share the showcase without exposing it on prod.

## Future Enhancements

Tracked in GitHub Issues. High-level themes:

- 📱 PWA / mobile app
- 👨‍🏫 Teacher–student integration (assigning templates, contextual feedback)
- 🎼 Structured measure-range parsing on spots
- 📚 Shared catalog of standard repertoire (IMSLP-style)
- 🔔 Practice reminder notifications
- 🔗 Template and spot sharing between users

See `docs/kantelo-product-spec.md` §10 for the full future-scope list.

## Troubleshooting

### Backend won't start
- Check if port 8000 is already in use
- Verify PostgreSQL is running: `docker compose ps`
- Check logs: `docker compose logs backend`

### Frontend won't start
- Check if port 3000 is already in use
- Verify Node modules are installed
- Check logs: `docker compose logs frontend`

### Database connection errors
- Ensure PostgreSQL container is healthy: `docker compose ps`
- Verify DATABASE_URL in backend config
- Try restarting: `docker compose restart db`

### "No data" in frontend
- Verify you're signed in via Clerk on the frontend
- The application starts with no per-user data — create an instrument and template via the UI
- Check if backend is accessible: http://localhost:8000/health
- Verify API calls in browser devtools network tab



