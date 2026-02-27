"""Helpers for uploading files to Supabase Storage via REST API."""
import os
import uuid
import urllib.error
import urllib.request
from pathlib import Path

from fastapi import HTTPException


def _require_env(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise HTTPException(
            status_code=500,
            detail=f"Missing required environment variable: {name}",
        )
    return value


def upload_avatar_to_supabase(*, user_id: str, filename: str, content_type: str, data: bytes) -> dict:
    """Upload an avatar image to Supabase Storage and return public URL metadata."""
    supabase_url = _require_env("SUPABASE_URL").rstrip("/")
    supabase_key = _require_env("SUPABASE_SERVICE_ROLE_KEY")
    bucket = os.getenv("SUPABASE_STORAGE_BUCKET", "avatars")

    ext = Path(filename).suffix.lower() or ".jpg"
    unique_name = f"{uuid.uuid4().hex}{ext}"
    object_path = f"users/{user_id}/{unique_name}"
    upload_url = f"{supabase_url}/storage/v1/object/{bucket}/{object_path}"

    req = urllib.request.Request(
        upload_url,
        data=data,
        method="POST",
        headers={
            "Authorization": f"Bearer {supabase_key}",
            "apikey": supabase_key,
            "Content-Type": content_type,
            "x-upsert": "true",
        },
    )

    try:
        with urllib.request.urlopen(req, timeout=30):
            pass
    except urllib.error.HTTPError as exc:
        try:
            message = exc.read().decode("utf-8")
        except Exception:
            message = str(exc)
        raise HTTPException(status_code=502, detail=f"Supabase upload failed: {message}") from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail="Unable to upload avatar to Supabase") from exc

    public_url = f"{supabase_url}/storage/v1/object/public/{bucket}/{object_path}"
    return {"avatarUrl": public_url, "path": object_path}
