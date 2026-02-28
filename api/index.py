"""Vercel serverless entrypoint for WorkTrace FastAPI app."""
import os
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
BACKEND_DIR = ROOT / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

# Import the FastAPI app defined in backend/main.py
from main import app  # noqa: E402,F401

