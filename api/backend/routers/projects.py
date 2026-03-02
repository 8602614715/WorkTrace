"""Projects router - REST API for projects."""
from datetime import datetime
from fastapi import APIRouter, HTTPException
from sqlalchemy import func, or_

from database import get_db
from models import Project, Task, User
from schemas import ProjectCreate, ProjectUpdate, ProjectResponse, ProjectMemberResponse, TaskResponse
from dependencies import get_current_user, DbSession, CurrentUser
from services.email_service import send_project_added_notification

router = APIRouter(prefix="/projects", tags=["projects"])


def _resolve_project_members(
    db: DbSession,
    owner: User,
    member_ids: list[str] | None,
    member_emails: list[str] | None,
) -> list[User]:
    """Resolve project members from IDs and/or emails, always including owner."""
    unique_members = {owner.id: owner}

    normalized_ids = list(dict.fromkeys(member_ids or []))
    if normalized_ids:
        member_users = db.query(User).filter(User.id.in_(normalized_ids)).all()
        if len(member_users) != len(normalized_ids):
            raise HTTPException(status_code=400, detail="One or more memberIds are invalid")
        for member in member_users:
            unique_members[member.id] = member

    normalized_emails = list(dict.fromkeys([email.strip().lower() for email in (member_emails or []) if email.strip()]))
    if normalized_emails:
        email_users = db.query(User).filter(func.lower(User.email).in_(normalized_emails)).all()
        found_emails = {u.email.lower() for u in email_users if u.email}
        missing_emails = [email for email in normalized_emails if email not in found_emails]
        if missing_emails:
            raise HTTPException(
                status_code=400,
                detail=f"One or more memberEmails are invalid or not registered: {', '.join(missing_emails)}",
            )
        for member in email_users:
            unique_members[member.id] = member

    return list(unique_members.values())


def _send_project_member_notifications(
    project: Project,
    current_user: User,
    new_member_ids: set[str],
):
    """Send best-effort notifications to newly added project members."""
    if not new_member_ids:
        return

    added_by_name = current_user.name or current_user.email or "A teammate"
    for member in (project.members or []):
        if member.id not in new_member_ids:
            continue
        send_project_added_notification(
            to_email=member.email,
            recipient_name=member.name or member.email,
            project_name=project.name,
            added_by_name=added_by_name,
        )


def _member_to_response(u: User) -> ProjectMemberResponse:
    return ProjectMemberResponse(
        id=u.id,
        name=u.name,
        email=u.email,
        role=u.role,
        avatar=u.avatar,
    )


def _task_to_response(task: Task) -> TaskResponse:
    return TaskResponse(
        id=task.id,
        title=task.title,
        description=task.description,
        status=task.status,
        priority=task.priority,
        dueDate=task.due_date,
        assignedTo=task.assigned_to,
        progress=task.progress,
        icon=task.icon or "file",
        projectId=task.project_id,
        sprintId=task.sprint_id,
        createdAt=task.created_at.isoformat() if task.created_at else "",
        updatedAt=task.updated_at.isoformat() if task.updated_at else "",
    )


def _project_to_response(p: Project) -> ProjectResponse:
    tasks = list(p.tasks or [])
    total = len(tasks)
    completed = len([t for t in tasks if t.status == "completed"])
    progress = int((completed / total) * 100) if total > 0 else 0
    return ProjectResponse(
        id=p.id,
        name=p.name,
        description=p.description,
        deadline=p.deadline,
        status=p.status or "active",
        progress=progress,
        totalTasks=total,
        completedTasks=completed,
        members=[_member_to_response(u) for u in (p.members or [])],
        tasks=[_task_to_response(t) for t in tasks],
        createdAt=p.created_at.isoformat() if p.created_at else "",
    )


@router.get("", response_model=list[ProjectResponse])
async def get_projects(current_user: CurrentUser, db: DbSession):
    projects = (
        db.query(Project)
        .filter(
            or_(
                Project.owner_id == current_user.id,
                Project.members.any(User.id == current_user.id),
            )
        )
        .all()
    )
    return [_project_to_response(p) for p in projects]


@router.get("/overview")
async def get_project_overview(current_user: CurrentUser, db: DbSession):
    tasks = db.query(Task).filter(Task.user_id == current_user.id).all()
    total = len(tasks)
    completed = len([t for t in tasks if t.status == "completed"])
    progress = int((completed / total * 100)) if total > 0 else 0
    return {
        "progress": progress,
        "completionPercentage": progress,
        "totalTasks": total,
        "completedTasks": completed,
        "inProgressTasks": len([t for t in tasks if t.status == "inProgress"]),
        "todoTasks": len([t for t in tasks if t.status == "todo"]),
    }


@router.get("/health")
async def get_project_health(current_user: CurrentUser, db: DbSession):
    projects = (
        db.query(Project)
        .filter(
            or_(
                Project.owner_id == current_user.id,
                Project.members.any(User.id == current_user.id),
            )
        )
        .all()
    )

    today = datetime.utcnow().date()
    items = []
    for project in projects:
        tasks = list(project.tasks or [])
        total = len(tasks)
        completed = len([t for t in tasks if t.status == "completed"])
        completion_rate = (completed / total) if total > 0 else 0.0

        overdue_open = 0
        for task in tasks:
            if not task.due_date or task.status == "completed":
                continue
            try:
                if datetime.strptime(task.due_date, "%Y-%m-%d").date() < today:
                    overdue_open += 1
            except ValueError:
                continue
        overdue_ratio = (overdue_open / total) if total > 0 else 0.0

        deadline_factor = 1.0
        deadline_days_left = None
        if project.deadline:
            try:
                deadline_date = datetime.strptime(project.deadline, "%Y-%m-%d").date()
                deadline_days_left = (deadline_date - today).days
                if completion_rate < 1.0:
                    if deadline_days_left <= 0:
                        deadline_factor = 0.0
                    elif deadline_days_left <= 3:
                        deadline_factor = 0.3
                    elif deadline_days_left <= 7:
                        deadline_factor = 0.6
                    else:
                        deadline_factor = 0.85
            except ValueError:
                deadline_factor = 0.75

        health_score = round(
            (completion_rate * 40)
            + ((1 - overdue_ratio) * 35)
            + (deadline_factor * 25),
            2,
        )
        health_score = max(0.0, min(100.0, health_score))

        if health_score >= 75:
            risk_level = "low"
            risk_label = "Healthy"
        elif health_score >= 50:
            risk_level = "medium"
            risk_label = "Watch"
        else:
            risk_level = "high"
            risk_label = "At Risk"

        items.append(
            {
                "projectId": project.id,
                "projectName": project.name,
                "healthScore": health_score,
                "riskLevel": risk_level,
                "riskLabel": risk_label,
                "completionRate": round(completion_rate * 100, 2),
                "overdueOpenTasks": overdue_open,
                "totalTasks": total,
                "deadlineDaysLeft": deadline_days_left,
            }
        )

    items.sort(key=lambda x: x["healthScore"], reverse=True)
    return {"items": items}


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: str,
    current_user: CurrentUser,
    db: DbSession,
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    is_member = any(m.id == current_user.id for m in (project.members or []))
    if project.owner_id != current_user.id and not is_member:
        raise HTTPException(status_code=403, detail="Access denied")
    return _project_to_response(project)


@router.post("", response_model=ProjectResponse, status_code=201)
async def create_project(
    payload: ProjectCreate,
    current_user: CurrentUser,
    db: DbSession,
):
    project = Project(
        name=payload.name,
        description=payload.description,
        deadline=payload.deadline,
        status=payload.status or "active",
        owner_id=current_user.id,
    )
    members = _resolve_project_members(
        db=db,
        owner=current_user,
        member_ids=payload.memberIds,
        member_emails=[str(email) for email in (payload.memberEmails or [])],
    )
    project.members = members
    db.add(project)
    db.commit()
    db.refresh(project)
    newly_added_ids = {m.id for m in members if m.id != current_user.id}
    _send_project_member_notifications(project, current_user, newly_added_ids)
    return _project_to_response(project)


@router.put("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: str,
    payload: ProjectUpdate,
    current_user: CurrentUser,
    db: DbSession,
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    update_data = payload.model_dump(exclude_unset=True)
    member_ids = update_data.pop("memberIds", None)
    member_emails = update_data.pop("memberEmails", None)
    for key, value in update_data.items():
        setattr(project, key, value)
    old_member_ids = {member.id for member in (project.members or [])}
    if member_ids is not None or member_emails is not None:
        project.members = _resolve_project_members(
            db=db,
            owner=current_user,
            member_ids=member_ids,
            member_emails=[str(email) for email in (member_emails or [])],
        )
    db.commit()
    db.refresh(project)
    updated_member_ids = {member.id for member in (project.members or [])}
    newly_added_ids = updated_member_ids - old_member_ids - {current_user.id}
    _send_project_member_notifications(project, current_user, newly_added_ids)
    return _project_to_response(project)


@router.delete("/{project_id}")
async def delete_project(
    project_id: str,
    current_user: CurrentUser,
    db: DbSession,
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    db.delete(project)
    db.commit()
    return {"message": "Project deleted successfully"}
