"""Deadline reminder scheduler and sender."""
from __future__ import annotations

import asyncio
import os
from dataclasses import dataclass
from datetime import date, datetime, timedelta

from sqlalchemy import func, or_

from database import SessionLocal
from models import Deadline, DeadlineReminderLog, Project, Task, User
from services.email_service import send_email, smtp_configured


@dataclass
class ReminderItem:
    key: str
    title: str
    due_date: date
    source: str


def _parse_date(value: str | None) -> date | None:
    if not value:
        return None
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except ValueError:
        return None


def _collect_user_items(db, user: User, now_date: date) -> list[ReminderItem]:
    """Collect upcoming reminders from deadlines, project deadlines, and task due dates."""
    items: list[ReminderItem] = []

    user_project_ids = [
        p.id
        for p in db.query(Project.id).filter(
            Project.owner_id == user.id,
            or_(Project.status.is_(None), func.lower(Project.status) != "completed"),
        ).all()
    ]

    deadlines = db.query(Deadline).filter(
        (Deadline.project_id == None) | (Deadline.project_id.in_(user_project_ids))
    ).all()
    for deadline in deadlines:
        parsed = _parse_date(deadline.date)
        if not parsed or parsed < now_date:
            continue
        items.append(
            ReminderItem(
                key=f"deadline:{deadline.id}",
                title=deadline.title,
                due_date=parsed,
                source="deadline",
            )
        )

    project_deadlines = db.query(Project).filter(
        Project.owner_id == user.id,
        Project.deadline.isnot(None),
        or_(Project.status.is_(None), func.lower(Project.status) != "completed"),
    ).all()
    for project in project_deadlines:
        parsed = _parse_date(project.deadline)
        if not parsed or parsed < now_date:
            continue
        items.append(
            ReminderItem(
                key=f"project:{project.id}",
                title=f"{project.name} (project deadline)",
                due_date=parsed,
                source="project",
            )
        )

    task_deadlines = db.query(Task).filter(
        Task.user_id == user.id,
        Task.due_date.isnot(None),
        or_(Task.status.is_(None), func.lower(Task.status) != "completed"),
    ).all()
    for task in task_deadlines:
        parsed = _parse_date(task.due_date)
        if not parsed or parsed < now_date:
            continue
        items.append(
            ReminderItem(
                key=f"task:{task.id}",
                title=f"{task.title} (task due date)",
                due_date=parsed,
                source="task",
            )
        )
    return items


def _build_email(user_name: str, items: list[ReminderItem]) -> tuple[str, str]:
    lines = [
        f"Hi {user_name},",
        "",
        "These items are coming up soon:",
        "",
    ]
    for item in sorted(items, key=lambda i: i.due_date):
        days_left = (item.due_date - date.today()).days
        day_label = "today" if days_left == 0 else f"in {days_left} day(s)"
        lines.append(f"- {item.title} on {item.due_date.isoformat()} ({day_label})")
    lines.extend(["", "WorkTrace reminder bot"])

    text_body = "\n".join(lines)
    html_rows = "".join(
        [
            f"<li><strong>{item.title}</strong> - {item.due_date.isoformat()}</li>"
            for item in sorted(items, key=lambda i: i.due_date)
        ]
    )
    html_body = (
        f"<p>Hi {user_name},</p>"
        "<p>These items are coming up soon:</p>"
        f"<ul>{html_rows}</ul>"
        "<p>WorkTrace reminder bot</p>"
    )
    return text_body, html_body


def run_deadline_reminders_once() -> None:
    """Run one reminder cycle for all users with email notifications enabled."""
    if not smtp_configured():
        return

    db = SessionLocal()
    today = date.today()
    reminder_date = today.isoformat()
    try:
        users = db.query(User).filter(User.notify_email == 1).all()
        for user in users:
            reminder_hours = user.reminder_hours or 24
            horizon = datetime.now() + timedelta(hours=reminder_hours)
            horizon_date = horizon.date()

            candidate_items = _collect_user_items(db, user, today)
            in_window = [item for item in candidate_items if item.due_date <= horizon_date]
            if not in_window:
                continue

            pending_items: list[ReminderItem] = []
            for item in in_window:
                already_sent = db.query(DeadlineReminderLog).filter(
                    DeadlineReminderLog.user_id == user.id,
                    DeadlineReminderLog.item_key == item.key,
                    DeadlineReminderLog.reminder_date == reminder_date,
                ).first()
                if not already_sent:
                    pending_items.append(item)

            if not pending_items:
                continue

            subject = f"WorkTrace reminders: {len(pending_items)} upcoming deadline(s)"
            text_body, html_body = _build_email(user.name, pending_items)
            sent = send_email(
                to_email=user.email,
                subject=subject,
                text_body=text_body,
                html_body=html_body,
            )
            if not sent:
                continue

            for item in pending_items:
                db.add(
                    DeadlineReminderLog(
                        user_id=user.id,
                        item_key=item.key,
                        reminder_date=reminder_date,
                        due_date=item.due_date.isoformat(),
                    )
                )
            db.commit()
    finally:
        db.close()


async def reminder_scheduler(stop_event: asyncio.Event) -> None:
    """Run reminder loop until stop_event is set."""
    interval = int(os.getenv("REMINDER_INTERVAL_SECONDS", "3600"))
    while not stop_event.is_set():
        try:
            run_deadline_reminders_once()
        except Exception as exc:  # pragma: no cover
            print(f"[reminder_scheduler] Cycle failed: {exc}")
        try:
            await asyncio.wait_for(stop_event.wait(), timeout=interval)
        except asyncio.TimeoutError:
            continue
