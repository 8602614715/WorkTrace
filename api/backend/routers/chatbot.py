"""Chatbot router - natural language task assistant."""
import re
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models import Task, User
from dependencies import get_current_user, DbSession, CurrentUser

router = APIRouter(prefix="/chatbot", tags=["chatbot"])


class ChatbotRequest(BaseModel):
    message: str


class ChatbotResponse(BaseModel):
    reply: str


def _extract_intent(message: str) -> str:
    msg = message.lower().strip()
    if any(w in msg for w in ["create", "add", "new", "make"]) and "task" in msg:
        return "create"
    if any(w in msg for w in ["update", "edit", "change", "modify"]) and "task" in msg:
        return "update"
    if any(w in msg for w in ["delete", "remove"]) and "task" in msg:
        return "delete"
    if any(w in msg for w in ["list", "show", "display", "my tasks"]):
        return "list"
    if any(w in msg for w in ["status", "progress", "statistics"]):
        return "status"
    if any(w in msg for w in ["help", "commands"]):
        return "help"
    if any(w in msg for w in ["hi", "hello", "hey"]):
        return "greeting"
    return "unknown"


def _extract_task_id(message: str):
    for p in [r'task\s*(?:#|id|number)?\s*(\d+)', r'#(\d+)']:
        m = re.search(p, message.lower())
        if m:
            try:
                return int(m.group(1))
            except ValueError:
                pass
    return None


def _extract_title(message: str) -> str | None:
    msg = re.sub(
        r'^(create|add|new|make)\s+(?:a\s+)?(?:new\s+)?(?:task|todo)[\s:]*',
        '',
        message.strip(),
        flags=re.IGNORECASE
    )
    quoted = re.search(r'["\']([^"\']+)["\']', msg)
    if quoted:
        return quoted.group(1).strip()
    if ':' in msg:
        parts = msg.split(':', 1)
        if len(parts) > 1:
            return parts[1].strip().split(',')[0].strip() or None
    words = msg.split()
    return ' '.join(words[:10]) if words else None


def _handle_greeting() -> str:
    return (
        "Hello! I'm your task assistant. I can help you create, update, delete, "
        "and list tasks. Try: 'Create task: Buy groceries' or 'Show all my tasks'"
    )


def _handle_help() -> str:
    return (
        "Create: 'Create task: [title]'\n"
        "Update: 'Update task #1: [new title]'\n"
        "Delete: 'Delete task #1'\n"
        "List: 'Show all tasks'\n"
        "Status: 'What's my task status?'"
    )


def _handle_list(db: Session, user_id: str) -> str:
    tasks = db.query(Task).filter(Task.user_id == user_id).order_by(Task.created_at.desc()).all()
    if not tasks:
        return "You don't have any tasks yet."
    lines = [f"📋 Your tasks ({len(tasks)}):"]
    for i, t in enumerate(tasks[:15], 1):
        emoji = "✅" if t.status == "completed" else "🔄" if t.status == "inProgress" else "⏳"
        lines.append(f"{emoji} {t.title} (Status: {t.status})")
    return "\n".join(lines)


def _handle_status(db: Session, user_id: str) -> str:
    tasks = db.query(Task).filter(Task.user_id == user_id).all()
    if not tasks:
        return "You don't have any tasks yet."
    total = len(tasks)
    completed = len([t for t in tasks if t.status == "completed"])
    pct = (completed / total * 100) if total else 0
    return (
        f"Total: {total}, Completed: {completed}, "
        f"In Progress: {len([t for t in tasks if t.status == 'inProgress'])}, "
        f"Todo: {len([t for t in tasks if t.status == 'todo'])}\n"
        f"Completion rate: {pct:.1f}%"
    )


def _handle_create(message: str, db: Session, user_id: str) -> str:
    title = _extract_title(message)
    if not title:
        return "Please provide a task title. Try: 'Create task: [your task]'"
    task = Task(title=title, description="Created via chatbot", user_id=user_id)
    db.add(task)
    db.commit()
    db.refresh(task)
    return f"✅ Task created: {task.title}"


def _handle_update(message: str, db: Session, user_id: str) -> str:
    task_id = _extract_task_id(message)
    if task_id is None:
        return "Please specify task ID. Try: 'Update task #1: [new title]'"
    tasks = db.query(Task).filter(Task.user_id == user_id).order_by(Task.created_at.desc()).all()
    task = next((t for t in tasks if t.id == str(task_id)), None)
    if not task and 1 <= task_id <= len(tasks):
        task = tasks[task_id - 1]
    if not task:
        return f"Task #{task_id} not found."
    title = _extract_title(message)
    if title:
        task.title = title
        db.commit()
        return f"✅ Task updated: {task.title}"
    return "No changes specified."


def _handle_delete(message: str, db: Session, user_id: str) -> str:
    task_id = _extract_task_id(message)
    if task_id is None:
        return "Please specify task ID. Try: 'Delete task #1'"
    tasks = db.query(Task).filter(Task.user_id == user_id).order_by(Task.created_at.desc()).all()
    task = next((t for t in tasks if t.id == str(task_id)), None)
    if not task and 1 <= task_id <= len(tasks):
        task = tasks[task_id - 1]
    if not task:
        return f"Task #{task_id} not found."
    title = task.title
    db.delete(task)
    db.commit()
    return f"✅ Task '{title}' deleted."


@router.post("/chat", response_model=ChatbotResponse)
async def chatbot(
    request: ChatbotRequest,
    current_user: CurrentUser,
    db: DbSession,
):
    msg = request.message.strip()
    if not msg:
        return ChatbotResponse(reply="Please type a message.")
    intent = _extract_intent(msg)
    user_id = current_user.id
    try:
        if intent == "greeting":
            reply = _handle_greeting()
        elif intent == "help":
            reply = _handle_help()
        elif intent == "list":
            reply = _handle_list(db, user_id)
        elif intent == "status":
            reply = _handle_status(db, user_id)
        elif intent == "create":
            reply = _handle_create(msg, db, user_id)
        elif intent == "update":
            reply = _handle_update(msg, db, user_id)
        elif intent == "delete":
            reply = _handle_delete(msg, db, user_id)
        else:
            reply = "I didn't understand. Type 'help' for commands."
        return ChatbotResponse(reply=reply)
    except Exception as e:
        return ChatbotResponse(reply=f"Error: {str(e)}")
