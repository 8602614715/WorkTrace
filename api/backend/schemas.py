"""Pydantic schemas for API request/response validation."""
from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import datetime


# ----- Auth -----
class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: Optional[str] = "user"


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: str
    name: str
    email: str
    role: str
    avatar: Optional[str] = None


class TokenResponse(BaseModel):
    token: str
    user: UserResponse


# ----- Tasks -----
class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = None
    status: str = "todo"
    priority: str = "medium"
    dueDate: Optional[str] = None
    assignedTo: Optional[str] = None
    progress: int = 0
    icon: Optional[str] = "file"
    projectId: Optional[str] = None
    recurrence: Optional[str] = None


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    dueDate: Optional[str] = None
    assignedTo: Optional[str] = None
    progress: Optional[int] = None
    icon: Optional[str] = None
    recurrence: Optional[str] = None


class TaskStatusUpdate(BaseModel):
    status: str


class SubTaskCreate(BaseModel):
    title: str


class SubTaskUpdate(BaseModel):
    title: Optional[str] = None
    completed: Optional[bool] = None
    sortOrder: Optional[int] = None


class SubTaskResponse(BaseModel):
    id: str
    title: str
    completed: bool
    sortOrder: int
    createdAt: str
    updatedAt: str


class TaskResponse(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    status: str
    priority: str
    dueDate: Optional[str] = None
    assignedTo: Optional[str] = None
    assignedToName: Optional[str] = None
    progress: int
    icon: Optional[str] = None
    projectId: Optional[str] = None
    sprintId: Optional[str] = None
    recurrence: Optional[str] = None
    subtasks: list[SubTaskResponse] = Field(default_factory=list)
    createdAt: str
    updatedAt: str


class TaskBulkUpdateRequest(BaseModel):
    taskIds: list[str] = Field(min_length=1)
    status: Optional[str] = None
    priority: Optional[str] = None
    assignedTo: Optional[str] = None
    sprintId: Optional[str] = None
    recurrence: Optional[str] = None
    delete: bool = False


# ----- Projects -----
class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None
    deadline: Optional[str] = None
    status: Optional[str] = "active"
    memberIds: Optional[list[str]] = None
    memberEmails: Optional[list[EmailStr]] = None


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    deadline: Optional[str] = None
    status: Optional[str] = None
    memberIds: Optional[list[str]] = None
    memberEmails: Optional[list[EmailStr]] = None


class ProjectMemberResponse(BaseModel):
    id: str
    name: str
    email: str
    role: str
    avatar: Optional[str] = None


class ProjectResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    deadline: Optional[str] = None
    status: str
    progress: int
    totalTasks: int
    completedTasks: int
    members: list[ProjectMemberResponse]
    tasks: list[TaskResponse]
    createdAt: str


# ----- Deadlines -----
class DeadlineCreate(BaseModel):
    title: str
    date: str
    description: Optional[str] = None
    projectId: Optional[str] = None


class DeadlineUpdate(BaseModel):
    title: Optional[str] = None
    date: Optional[str] = None
    description: Optional[str] = None
    projectId: Optional[str] = None


class DeadlineResponse(BaseModel):
    id: str
    title: str
    name: str
    date: str
    description: Optional[str] = None
    projectId: Optional[str] = None


# ----- Team -----
class TeamMemberResponse(BaseModel):
    id: str
    name: str
    email: str
    avatar: Optional[str] = None
    role: Optional[str] = None
    status: str
    tasks: Optional[list] = None
    currentTask: Optional[str] = None
    date: Optional[str] = None


class TeamInviteRequest(BaseModel):
    name: str
    email: EmailStr
    role: Optional[str] = "user"
    password: Optional[str] = None


class TeamInviteResponse(UserResponse):
    tempPassword: Optional[str] = None


class RoleUpdateRequest(BaseModel):
    role: str


# ----- Analytics -----
class TaskCompletionResponse(BaseModel):
    data: list
    labels: list


class ProductivityResponse(BaseModel):
    score: float
    trend: float
    previousScore: float
    period: str


# ----- User Verification -----
class UserVerification(BaseModel):
    password: str
    new_password: str


class AccountDeleteRequest(BaseModel):
    password: str


# ----- Task comments / activity -----
class TaskCommentCreate(BaseModel):
    content: str = Field(min_length=1, max_length=2000)


class TaskCommentResponse(BaseModel):
    id: str
    taskId: str
    userId: str
    userName: str
    content: str
    createdAt: str
    updatedAt: str


class ActivityEventResponse(BaseModel):
    id: str
    taskId: str
    actorUserId: Optional[str] = None
    actorName: Optional[str] = None
    eventType: str
    detail: str
    createdAt: str


# ----- Notifications -----
class NotificationResponse(BaseModel):
    id: str
    title: str
    message: str
    entityType: Optional[str] = None
    entityId: Optional[str] = None
    isRead: bool
    createdAt: str


# ----- Sprints -----
class SprintCreate(BaseModel):
    name: str
    goal: Optional[str] = None
    start_date: str
    end_date: str
    status: Optional[str] = "planned"
    project_id: Optional[str] = None


class SprintUpdate(BaseModel):
    name: Optional[str] = None
    goal: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    status: Optional[str] = None
    project_id: Optional[str] = None


class SprintResponse(BaseModel):
    id: str
    name: str
    goal: Optional[str] = None
    start_date: str
    end_date: str
    status: str
    project_id: Optional[str] = None
    totalTasks: int
    completedTasks: int
    progress: int
    velocity: float
    durationDays: int
    createdAt: Optional[str] = None


class SprintTaskAssign(BaseModel):
    taskIds: list[str]


# ----- Settings (extended user info) -----
class UserSettingsResponse(BaseModel):
    id: str
    name: str
    email: str
    role: str
    avatar: Optional[str] = None
    themePreference: Optional[str] = None
    notifyEmail: Optional[bool] = None
    notifyInApp: Optional[bool] = None
    reminderHours: Optional[int] = None
    workspaceName: Optional[str] = None
    workspaceTimezone: Optional[str] = None
    integrations: Optional[list] = None
    createdAt: Optional[str] = None


class UserProfileUpdate(BaseModel):
    name: Optional[str] = None
    avatar: Optional[str] = None


class UserPreferencesUpdate(BaseModel):
    themePreference: Optional[str] = None
    notifyEmail: Optional[bool] = None
    notifyInApp: Optional[bool] = None
    reminderHours: Optional[int] = Field(default=None, ge=1, le=168)


class WorkspaceUpdate(BaseModel):
    workspaceName: Optional[str] = None
    workspaceTimezone: Optional[str] = None


class AvatarUploadResponse(BaseModel):
    avatarUrl: str
    path: str
