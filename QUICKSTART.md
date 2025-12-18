# Quick Start Guide

(Check out the full [README.md](README.md) for more details)

## Prerequisites
- Docker and Docker Compose installed
- Git installed

## 1. Start the Application

```bash
# Clone and enter the directory (if not already there)
cd practice-journal

# Start all services
docker compose up --build
```

Wait for all services to start. You should see output indicating:
- PostgreSQL is ready
- Backend is running on port 8000
- Frontend is running on port 3000

## 2. Initialize the Database

Open a new terminal window and run:

```bash
# Run database migrations
docker compose exec backend alembic upgrade head

# Seed with violin practice data
docker compose exec backend python seed_data.py
```

You should see confirmation that the database has been seeded successfully.

## 3. Access the Application

Open your browser and navigate to:

**http://localhost:3000**


## Useful Commands

### Stop the application
```bash
docker compose down
```

### View logs
```bash
docker compose logs -f
```

### Restart after code changes
```bash
docker compose restart backend
docker compose restart frontend
```

### Access API documentation
Open: http://localhost:8000/docs

### Reset everything (fresh start)
```bash
docker compose down
docker volume rm practice-journal_postgres_data
docker compose up --build
# Then run step 2 again
```

## Common Issues

**Port already in use?**
- Stop other applications using ports 3000, 8000, or 5432
- Or modify the ports in `docker-compose.yml`

**No data showing?**
- Make sure you ran the seed script in step 2
- Check that the backend is running: http://localhost:8000/health

**Backend won't start?**
- Check logs: `docker compose logs backend`
- Ensure PostgreSQL is healthy: `docker compose ps`

## API docs

- Explore the API at http://localhost:8000/docs



