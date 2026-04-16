# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Bounce Dance School 2.0 — a full-stack booking portal for a dance school. React/TypeScript frontend + Django REST Framework backend, with real-time features via WebSockets and async task processing via Celery/Kafka.

## Commands

### Frontend (`cd frontend/`)

```bash
npm run dev          # Dev server at http://localhost:5173
npm run build        # Production build
npm run test:run     # Run tests (Vitest, headless)
npm run test:ui      # Run tests with interactive UI
```

### Backend (`cd backend/`)

```bash
pytest                          # Run all tests
pytest path/to/test_file.py    # Run a single test file
python manage.py migrate        # Apply migrations
python manage.py makemigrations # Create new migrations
```

### Full Stack

```bash
docker-compose up   # Start all infrastructure services
docker-compose up -d --build   # Rebuild and start in background
```

Docker Compose runs: PostgreSQL (5432), Redis (6379), Kafka + Zookeeper, Django/Daphne (8000), Celery worker, Flower/5555, Kafka UI/8080, MailHog SMTP+UI/8025.

## Architecture

### Frontend (`frontend/src/`)

- **`app/pages/`** — Top-level pages: Home, Events, Login, Register, AdminDashboard, StudentDashboard
- **`app/components/`** — Reusable UI: Chatbot, DirectMessages, FestivalEventForm, Friends, SocialFeed, Trips, etc.
- **`app/contexts/`** — React Context for Auth state and Language/i18n
- **`app/routes.tsx`** — React Router v7 route definitions

UI uses MUI v7 + Radix UI + Tailwind CSS v4. Forms use react-hook-form. Vite proxies `/api` requests to `localhost:8000` in development.

### Backend (`backend/`)

- **`core/`** — Django settings, root URLs, ASGI/WSGI entry points, Celery app config
- **`users/`** — Custom User model (email-based login), JWT auth endpoints, registration with async email confirmation
- **`notification/`** — Real-time notifications via Django Channels (WebSocket) and Kafka event streaming

The custom User model has roles (`student`/`teacher`/`admin`), location fields (Country → Region → City hierarchy), and ACSI certification fields.

### Auth Flow

JWT via `djangorestframework-simplejwt`. Tokens issued at `POST /api/auth/token/` (email + password). Registration at `POST /api/auth/register/` triggers an async Celery task for confirmation email (routed through MailHog in dev).

### Async / Real-time

- **Celery** uses Redis as broker and result backend. Worker runs as a separate Docker service.
- **Kafka** (`kafka-python-ng`, `aiokafka`) handles event streaming between services.
- **Django Channels** + Redis channel layer powers WebSocket connections for notifications and messaging.

### API Documentation

- Swagger UI: `GET /api/docs/`
- ReDoc: `GET /api/redoc/`
- OpenAPI schema: `GET /api/schema/`

## Key Configuration

| File | Purpose |
|------|---------|
| `.env` | `DJANGO_SECRET_KEY`, `DATABASE_URL`, `CELERY_BROKER_URL`, `KAFKA_BOOTSTRAP_SERVERS`, email config |
| `backend/core/settings.py` | Django settings; CORS allows `localhost:5173` |
| `backend/pytest.ini` | Pytest config; sets Django settings module, asyncio mode |
| `frontend/vite.config.ts` | Vite config; proxies `/api` to `:8000` |
