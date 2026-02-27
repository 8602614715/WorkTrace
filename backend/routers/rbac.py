"""Role-Based Access Control utilities."""
from functools import wraps
from typing import List

from fastapi import HTTPException

from models import User

ROLE_HIERARCHY = {"admin": 3, "manager": 2, "user": 1}


def require_role(allowed_roles: List[str]):
    """Decorator to require specific roles."""

    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            user = _extract_user(args, kwargs)
            if not user:
                raise HTTPException(status_code=401, detail="Authentication required")
            role = (user.role or "user").lower()
            if role not in [r.lower() for r in allowed_roles]:
                raise HTTPException(
                    status_code=403,
                    detail=f"Access denied. Required roles: {', '.join(allowed_roles)}",
                )
            return await func(*args, **kwargs)

        return wrapper

    return decorator


def require_min_role(min_role: str):
    """Decorator to require minimum role level."""

    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            user = _extract_user(args, kwargs)
            if not user:
                raise HTTPException(status_code=401, detail="Authentication required")
            role = (user.role or "user").lower()
            min_level = ROLE_HIERARCHY.get(min_role.lower(), 0)
            user_level = ROLE_HIERARCHY.get(role, 0)
            if user_level < min_level:
                raise HTTPException(
                    status_code=403,
                    detail=f"Access denied. Minimum role required: {min_role}",
                )
            return await func(*args, **kwargs)

        return wrapper

    return decorator


def _extract_user(args, kwargs) -> User | None:
    for v in list(kwargs.values()) + list(args):
        if isinstance(v, User):
            return v
    return None


def check_role_access(user: User, required_roles: List[str]) -> bool:
    role = (user.role or "user").lower()
    return role in [r.lower() for r in required_roles]


def is_admin(user: User) -> bool:
    return (user.role or "").lower() in ("admin",)


def is_manager_or_above(user: User) -> bool:
    return check_role_access(user, ["manager", "admin"])
