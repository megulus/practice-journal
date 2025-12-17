# Practice Journal

A full-stack web application for tracking music practice sessions across multiple instruments. Built with FastAPI, PostgreSQL, and Next.js.

## Features

- 📅 **Structured Practice Plans**: Follow customizable rotation schedules designed for systematic skill development
- ✏️ **Session Logging**: Record detailed practice sessions including warm-ups, scales, technical exercises, and repertoire work
- 📊 **Progress Analytics**: Track total sessions, practice minutes, and average session duration
- 🎻 **Multi-Instrument Support**: Manage practice routines for different instruments (currently includes Violin, expandable to others)
- 🎯 **Technical Focus Areas**: Organized practice blocks covering tone, shifting, articulation, double stops, and more

## Technology Stack

### Backend
- **FastAPI** - Modern, fast Python web framework
- **PostgreSQL** - Robust relational database
- **SQLAlchemy** - SQL toolkit and ORM
- **Alembic** - Database migration tool
- **Pydantic** - Data validation

### Frontend
- **Next.js 14** - React framework with App Router
- **React 18** - UI library
- **TypeScript** - Type-safe JavaScript
- **Tailwind CSS** - Utility-first CSS framework

### Development
- **Docker Compose** - Containerized development environment

## Prerequisites

- Docker and Docker Compose
- Git

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

In a new terminal, run the database migrations and seed data:

```bash
# Run migrations
docker compose exec backend alembic upgrade head

# Seed the database with violin practice data
docker compose exec backend python seed_data.py
```

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
│   │   ├── api/              # API route handlers
│   │   │   ├── instruments.py
│   │   │   ├── templates.py
│   │   │   ├── logs.py
│   │   │   └── analytics.py
│   │   ├── models/           # SQLAlchemy database models
│   │   ├── schemas/          # Pydantic validation schemas
│   │   ├── config.py         # Configuration settings
│   │   ├── database.py       # Database connection
│   │   └── main.py           # FastAPI application
│   ├── alembic/              # Database migrations
│   ├── seed_data.py          # Initial data population
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── app/              # Next.js pages (App Router)
│   │   │   ├── [instrument]/ # Dynamic instrument routes
│   │   │   │   ├── plan/     # Practice plan viewer
│   │   │   │   ├── log/      # Practice session logger
│   │   │   │   └── history/  # Practice history & analytics
│   │   ├── components/       # Reusable React components
│   │   └── lib/              # API client and TypeScript types
│   └── package.json
└── docker-compose.yml
```

## API Endpoints

### Instruments

```
GET    /api/instruments/              # List all instruments
GET    /api/instruments/{id}          # Get specific instrument
```

### Practice Templates

```
GET    /api/templates/                # List all templates
GET    /api/templates/?instrument_id={id}  # Filter by instrument
GET    /api/templates/{id}            # Get template with all days
GET    /api/templates/{id}/days/{day} # Get specific day from template
```

### Practice Logs

```
POST   /api/logs/                     # Create new practice log
GET    /api/logs/                     # List all logs
GET    /api/logs/?template_id={id}   # Filter logs by template
GET    /api/logs/{id}                 # Get specific log
```

### Analytics

```
GET    /api/analytics/                # Get practice statistics
GET    /api/analytics/?template_id={id}  # Filter analytics by template
```

## Database Schema

The application uses a normalized database schema designed for flexibility and future expansion:

- **instruments** - Different types of instruments (violin, piano, etc.)
- **practice_templates** - Practice rotation templates (e.g., 14-day rotation)
- **practice_days** - Individual days within a template
- **exercise_blocks** - Technical focus blocks (Block A, Block B)
- **exercises** - Individual exercises within blocks
- **practice_logs** - Recorded practice sessions
- **practice_log_details** - Detailed content of practice sections

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
docker compose exec backend python seed_data.py
```

## Adding a New Instrument

1. Run the seed script with new instrument data, or manually add via API/database
2. Create a practice template for the instrument
3. Add practice days with exercises
4. The frontend will automatically display the new instrument

## Future Enhancements

### Planned Features
- 🔐 User authentication and authorization (JWT)
- 👤 Multi-user support with personalized practice plans
- ✏️ Custom template creation and editing UI
- 📱 Mobile app using Capacitor
- 🤖 AI-powered practice suggestions and feedback
- 📈 Advanced analytics and progress visualization
- 🔔 Practice reminders and notifications
- 📄 Export practice logs to PDF/CSV
- 🎵 Integration with music notation software
- 🔗 Template sharing between users

### Architecture Notes for Future Development

The application is designed with future expansion in mind:

- **Authentication-ready**: Add a `users` table and foreign keys to `practice_templates` and `practice_logs`
- **API-first design**: Backend is completely decoupled from frontend, enabling mobile app development
- **Structured data**: Practice logs store structured data for AI analysis
- **Flexible rotations**: Support for any rotation length, not just 14 days
- **Mobile-ready**: Next.js frontend works seamlessly with Capacitor for iOS/Android apps

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
- Make sure you ran the seed script: `docker compose exec backend python seed_data.py`
- Check if backend is accessible: http://localhost:8000/health
- Verify API calls in browser console

## License

MIT License - feel free to use this project for your own music practice tracking!

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.


