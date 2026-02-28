"""Vercel serverless entrypoint for WorkTrace FastAPI app."""
import sys
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parent.parent
BACKEND_DIR = ROOT / "api" / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

# Import the FastAPI app defined in backend/main.py
from main import app as backend_app  # noqa: E402


async def app(scope: dict[str, Any], receive: Any, send: Any) -> None:
    """ASGI entrypoint used by Vercel.

    Some Vercel route configs forward requests as /auth/login instead of
    /api/auth/login. Normalize those paths so backend routes keep working.
    """
    if scope.get("type") != "http":
        await backend_app(scope, receive, send)
        return

    path = scope.get("path", "") or ""
    if path and path != "/" and not path.startswith("/api"):
        normalized_scope = dict(scope)
        normalized_scope["path"] = f"/api{path}"
        await backend_app(normalized_scope, receive, send)
        return

    await backend_app(scope, receive, send)
