# WorkTrace FastAPI Backend

This is the FastAPI backend for the WorkTrace application.

## Setup Instructions

### 1. Install Python Dependencies

```bash
cd backend
pip install -r requirements.txt
```

Or using virtual environment (recommended):

```bash
# Create virtual environment
python -m venv venv

# Activate virtual environment
# On Windows:
venv\Scripts\activate
# On Linux/Mac:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### 2. Configure Environment Variables

Create a `.env` file in the `backend` directory:

```bash
cp .env.example .env
```

Edit `.env` and set your `SECRET_KEY`:

```
SECRET_KEY=your-very-long-and-random-secret-key-here
DATABASE_URL=postgresql://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres?sslmode=require
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
SUPABASE_STORAGE_BUCKET=avatars

# Optional: deadline reminder emails
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-smtp-user
SMTP_PASS=your-smtp-password
SMTP_FROM=no-reply@yourdomain.com
SMTP_USE_TLS=true
SMTP_USE_SSL=false
ENABLE_REMINDER_SCHEDULER=true
REMINDER_INTERVAL_SECONDS=3600
ENABLE_TASK_CLEANUP=true
TASK_CLEANUP_INTERVAL_SECONDS=86400
```

### 3. Run the Backend Server

```bash
# Using uvicorn directly
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Or using Python
python main.py
```

The API will be available at: `http://localhost:8000`

**Note:** If you see import errors, see [INSTALL.md](./INSTALL.md) for detailed installation instructions.

API Documentation (Swagger UI): `http://localhost:5000/docs`
Alternative API Docs (ReDoc): `http://localhost:5000/redoc`

### 4. Test the API

Visit `http://localhost:5000/api/health` to check if the server is running.

## API Endpoints

All API endpoints are prefixed with `/api`:

- **Authentication**: `/api/auth/login`, `/api/auth/register`, `/api/auth/logout`, `/api/auth/me`
- **Tasks**: `/api/tasks` (GET, POST), `/api/tasks/{id}` (GET, PUT, DELETE)
- **Projects**: `/api/projects/overview`
- **Team**: `/api/team/members`
- **Deadlines**: `/api/deadlines`
- **Analytics**: `/api/analytics/task-completion`, `/api/analytics/productivity`

## CORS Configuration

The backend is configured to allow requests from:
- `http://localhost:3000` (React dev server)
- `http://localhost:3001`
- `http://127.0.0.1:3000`

To add more origins, edit `main.py` and update the `allow_origins` list in the CORS middleware.

## Database & Migrations

The backend uses SQLite by default (`backend/worktrace.db`) via SQLAlchemy.

Schema changes are managed with Alembic:

```bash
cd backend

# Apply all migrations
python -m alembic -c alembic.ini upgrade head

# Create a new migration after model changes
python -m alembic -c alembic.ini revision -m "describe change"
```

For Supabase Cloud DB, use your Supabase Postgres connection string as `DATABASE_URL` (include `sslmode=require`).
Profile photo upload endpoint `/api/settings/avatar/upload` stores images in Supabase Storage and returns a public URL that is saved in the `avatar` field.

`main.py` no longer auto-creates tables by default. To temporarily enable legacy behavior:

```bash
AUTO_CREATE_TABLES=true
```

## Security Notes

- Change the `SECRET_KEY` in production
- Use environment variables for sensitive data
- Implement rate limiting
- Add input validation
- Use HTTPS in production

## Development

The server runs with auto-reload enabled. Any changes to `main.py` will automatically restart the server.
