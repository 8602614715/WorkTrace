"""SQLAlchemy models for WorkTrace."""
import uuid
from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Text, Table, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from database import Base


def generate_uuid():
    return str(uuid.uuid4())


class User(Base):
    """User model."""
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=generate_uuid, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False, index=True)
    password = Column(String, nullable=False)
    role = Column(String, default="user")  # user, manager, admin
    avatar = Column(String, nullable=True)
    theme_pref = Column(String, default="dark")
    notify_email = Column(Integer, default=1)
    notify_inapp = Column(Integer, default=1)
    reminder_hours = Column(Integer, default=24)
    workspace_name = Column(String, nullable=True)
    workspace_timezone = Column(String, nullable=True)
    integrations = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now()
    )

    tasks = relationship("Task", back_populates="owner", cascade="all, delete-orphan")
    projects = relationship("Project", back_populates="owner", cascade="all, delete-orphan")
    sprints = relationship("Sprint", back_populates="owner", cascade="all, delete-orphan")
    member_projects = relationship(
        "Project",
        secondary="project_members",
        back_populates="members",
    )


project_members = Table(
    "project_members",
    Base.metadata,
    Column("project_id", String, ForeignKey("projects.id", ondelete="CASCADE"), primary_key=True),
    Column("user_id", String, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
    Column("added_at", DateTime(timezone=True), server_default=func.now()),
)


class Project(Base):
    """Project model."""
    __tablename__ = "projects"

    id = Column(String, primary_key=True, default=generate_uuid, index=True)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    deadline = Column(String, nullable=True)  # YYYY-MM-DD
    status = Column(String, default="active")
    owner_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now()
    )

    owner = relationship("User", back_populates="projects")
    members = relationship(
        "User",
        secondary="project_members",
        back_populates="member_projects",
    )
    tasks = relationship("Task", back_populates="project", cascade="all, delete-orphan")
    sprints = relationship("Sprint", back_populates="project", cascade="all, delete-orphan")
    deadlines = relationship("Deadline", back_populates="project", cascade="all, delete-orphan")


class Task(Base):
    """Task model - matches BACKEND_API spec."""
    __tablename__ = "tasks"

    id = Column(String, primary_key=True, default=generate_uuid, index=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    status = Column(String, default="todo")  # todo, inProgress, completed
    priority = Column(String, default="medium")  # low, medium, high
    due_date = Column(String, nullable=True)  # YYYY-MM-DD
    assigned_to = Column(String, nullable=True)
    progress = Column(Integer, default=0)
    icon = Column(String, default="file")
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    project_id = Column(String, ForeignKey("projects.id", ondelete="SET NULL"), nullable=True)
    sprint_id = Column(String, ForeignKey("sprints.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now()
    )

    owner = relationship("User", back_populates="tasks")
    project = relationship("Project", back_populates="tasks")
    sprint = relationship("Sprint", back_populates="tasks")
    subtasks = relationship("SubTask", back_populates="task", cascade="all, delete-orphan")


class SubTask(Base):
    """Sub-task model linked to a task."""
    __tablename__ = "subtasks"

    id = Column(String, primary_key=True, default=generate_uuid, index=True)
    title = Column(String, nullable=False)
    completed = Column(Integer, default=0)
    sort_order = Column(Integer, default=0)
    task_id = Column(String, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now()
    )

    task = relationship("Task", back_populates="subtasks")


class Sprint(Base):
    """Sprint model for agile workflows."""
    __tablename__ = "sprints"

    id = Column(String, primary_key=True, default=generate_uuid, index=True)
    name = Column(String, nullable=False)
    goal = Column(Text, nullable=True)
    start_date = Column(String, nullable=False)  # YYYY-MM-DD
    end_date = Column(String, nullable=False)  # YYYY-MM-DD
    status = Column(String, default="planned")  # planned, active, completed
    project_id = Column(String, ForeignKey("projects.id", ondelete="CASCADE"), nullable=True)
    owner_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now()
    )

    project = relationship("Project", back_populates="sprints")
    owner = relationship("User", back_populates="sprints")
    tasks = relationship("Task", back_populates="sprint", cascade="all, delete-orphan")


class Deadline(Base):
    """Deadline model."""
    __tablename__ = "deadlines"

    id = Column(String, primary_key=True, default=generate_uuid, index=True)
    title = Column(String, nullable=False)
    date = Column(String, nullable=False)  # YYYY-MM-DD
    description = Column(Text, nullable=True)
    project_id = Column(String, ForeignKey("projects.id", ondelete="CASCADE"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now()
    )

    project = relationship("Project", back_populates="deadlines")


class DeadlineReminderLog(Base):
    """Track sent reminders and avoid duplicate reminder emails."""
    __tablename__ = "deadline_reminder_logs"
    __table_args__ = (
        UniqueConstraint("user_id", "item_key", "reminder_date", name="uq_deadline_reminder_logs_user_item_date"),
    )

    id = Column(String, primary_key=True, default=generate_uuid, index=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    item_key = Column(String, nullable=False)  # e.g. deadline:<id>, project:<id>, task:<id>
    reminder_date = Column(String, nullable=False)  # YYYY-MM-DD (day reminder was sent)
    due_date = Column(String, nullable=True)  # YYYY-MM-DD (item due date)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
