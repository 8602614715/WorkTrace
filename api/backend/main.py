"""WorkTrace API - FastAPI backend with database integration."""
import asyncio
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI  # pyright: ignore[reportMissingImports]
from fastapi.middleware.cors import CORSMiddleware  # pyright: ignore[reportMissingImports]
from fastapi.responses import RedirectResponse  # pyright: ignore[reportMissingImports]
from dotenv import load_dotenv  # pyright: ignore[reportMissingImports]

from database import engine, Base
from models import User, Task, Project, Deadline, DeadlineReminderLog
from routers import auth, todos, users, projects, deadlines, team, analytics, dashboard, admin, chatbot, reports, sprints, settings
from services.cleanup import completed_task_cleanup_scheduler
from services.reminders import reminder_scheduler

load_dotenv()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup hooks."""
    # Keep schema creation opt-in. Production/dev should use Alembic migrations.
    if os.getenv("AUTO_CREATE_TABLES", "false").lower() == "true":
        Base.metadata.create_all(bind=engine)
    stop_event = asyncio.Event()
    reminder_task = None
    cleanup_task = None
    if os.getenv("ENABLE_REMINDER_SCHEDULER", "true").lower() == "true":
        reminder_task = asyncio.create_task(reminder_scheduler(stop_event))
    if os.getenv("ENABLE_TASK_CLEANUP", "true").lower() == "true":
        cleanup_task = asyncio.create_task(completed_task_cleanup_scheduler(stop_event))
    yield
    stop_event.set()
    if reminder_task:
        await reminder_task
    if cleanup_task:
        await cleanup_task



app = FastAPI(
    title="WorkTrace API",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS
frontend_url = os.getenv("FRONTEND_URL")
allowed_origins = [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
]
if frontend_url:
    allowed_origins.append(frontend_url.rstrip("/"))

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=r"^https://.*\.vercel\.app$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers under /api
app.include_router(auth.router, prefix="/api")
app.include_router(todos.router, prefix="/api")
app.include_router(users.router, prefix="/api")
app.include_router(projects.router, prefix="/api")
app.include_router(deadlines.router, prefix="/api")
app.include_router(team.router, prefix="/api")
app.include_router(analytics.router, prefix="/api")
app.include_router(dashboard.router, prefix="/api")
app.include_router(admin.router, prefix="/api")
app.include_router(chatbot.router, prefix="/api")
app.include_router(reports.router, prefix="/api")
app.include_router(sprints.router, prefix="/api")
app.include_router(settings.router, prefix="/api")


@app.get("/", include_in_schema=False)
async def root():
    """Redirect to API docs for convenience."""
    return RedirectResponse(url="/docs")


@app.get("/api/health")
async def health_check():
    return {"status": "ok", "message": "WorkTrace API is running"}


if __name__ == "__main__":
    import uvicorn  # pyright: ignore[reportMissingImports]
    port = int(os.getenv("PORT", 5000))
    uvicorn.run(app, host="0.0.0.0", port=port)
