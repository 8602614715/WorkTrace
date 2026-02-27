# Backend API Documentation

This document outlines the required backend API endpoints for the WorkTrace application.

## Base URL
```
http://localhost:5000/api
```
(Configurable via `REACT_APP_API_URL` environment variable)

## Authentication

All endpoints except `/auth/login` and `/auth/register` require a Bearer token in the Authorization header:
```
Authorization: Bearer <token>
```

### POST /auth/login
Login user and receive authentication token.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "token": "jwt_token_here",
  "user": {
    "id": "user_id",
    "name": "User Name",
    "email": "user@example.com",
    "role": "user" | "manager" | "admin",
    "avatar": "url_to_avatar"
  }
}
```

### POST /auth/logout
Logout user (optional, token can be invalidated on frontend).

**Response:**
```json
{
  "message": "Logged out successfully"
}
```

### GET /auth/me
Get current authenticated user information.

**Response:**
```json
{
  "user": {
    "id": "user_id",
    "name": "User Name",
    "email": "user@example.com",
    "role": "user" | "manager" | "admin",
    "avatar": "url_to_avatar"
  }
}
```

### POST /auth/register
Register new user (optional, if registration is allowed).

**Request Body:**
```json
{
  "name": "User Name",
  "email": "user@example.com",
  "password": "password123",
  "role": "user"
}
```

## Tasks

### GET /tasks
Get all tasks for the authenticated user.

**Response:**
```json
[
  {
    "id": "task_id",
    "title": "Task Title",
    "description": "Task description",
    "status": "todo" | "inProgress" | "completed",
    "priority": "low" | "medium" | "high",
    "dueDate": "2026-01-26",
    "assignedTo": "user_id",
    "progress": 60,
    "icon": "cpu" | "grid" | "file" | "settings" | "clock" | "cart" | "monitor" | "users" | "box",
    "createdAt": "2026-01-26T00:00:00Z",
    "updatedAt": "2026-01-26T00:00:00Z"
  }
]
```

### GET /tasks/:id
Get a specific task by ID.

**Response:**
```json
{
  "id": "task_id",
  "title": "Task Title",
  "description": "Task description",
  "status": "todo",
  "priority": "medium",
  "dueDate": "2026-01-26",
  "assignedTo": "user_id",
  "progress": 0,
  "icon": "file",
  "createdAt": "2026-01-26T00:00:00Z",
  "updatedAt": "2026-01-26T00:00:00Z"
}
```

### POST /tasks
Create a new task.

**Request Body:**
```json
{
  "title": "New Task",
  "description": "Task description",
  "status": "todo",
  "priority": "medium",
  "dueDate": "2026-01-26",
  "assignedTo": "user_id",
  "progress": 0,
  "icon": "file"
}
```

**Response:**
```json
{
  "id": "new_task_id",
  "title": "New Task",
  ...
}
```

### PUT /tasks/:id
Update an existing task.

**Request Body:**
```json
{
  "title": "Updated Task",
  "description": "Updated description",
  "status": "inProgress",
  "priority": "high",
  "dueDate": "2026-01-28",
  "assignedTo": "user_id",
  "progress": 50,
  "icon": "settings"
}
```

**Response:**
```json
{
  "id": "task_id",
  "title": "Updated Task",
  ...
}
```

### PATCH /tasks/:id/status
Update only the status of a task.

**Request Body:**
```json
{
  "status": "completed"
}
```

**Response:**
```json
{
  "id": "task_id",
  "status": "completed",
  ...
}
```

### DELETE /tasks/:id
Delete a task.

**Response:**
```json
{
  "message": "Task deleted successfully"
}
```

## Projects

### GET /projects
Get all projects.

**Response:**
```json
[
  {
    "id": "project_id",
    "name": "Project Name",
    "description": "Project description",
    "status": "active",
    "createdAt": "2026-01-26T00:00:00Z"
  }
]
```

### GET /projects/:id
Get a specific project by ID.

### GET /projects/overview
Get project overview statistics.

**Response:**
```json
{
  "progress": 75,
  "completionPercentage": 75,
  "totalTasks": 100,
  "completedTasks": 75,
  "inProgressTasks": 15,
  "todoTasks": 10
}
```

## Team

### GET /team/members
Get all team members.

**Response:**
```json
[
  {
    "id": "member_id",
    "name": "Team Member Name",
    "email": "member@example.com",
    "avatar": "url_to_avatar",
    "status": "working" | "completed",
    "tasks": ["Task 1", "Task 2"],
    "currentTask": "Current Task Name",
    "date": "Jan 26, 2026"
  }
]
```

### GET /team/members/:id
Get a specific team member by ID.

## Deadlines

### GET /deadlines
Get all upcoming deadlines.

**Response:**
```json
[
  {
    "id": "deadline_id",
    "title": "Feature Freeze",
    "name": "Feature Freeze",
    "date": "2026-02-10",
    "description": "Deadline description",
    "projectId": "project_id"
  }
]
```

### POST /deadlines
Create a new deadline.

**Request Body:**
```json
{
  "title": "New Deadline",
  "date": "2026-02-20",
  "description": "Deadline description",
  "projectId": "project_id"
}
```

### PUT /deadlines/:id
Update a deadline.

### DELETE /deadlines/:id
Delete a deadline.

## Analytics

### GET /analytics/task-completion
Get task completion rate data.

**Response:**
```json
{
  "data": [30, 45, 60, 75, 80, 85, 90, 88],
  "labels": ["Week 1", "Week 2", ...]
}
```

### GET /analytics/productivity
Get productivity score.

**Response:**
```json
{
  "score": 9.2,
  "trend": 15,
  "previousScore": 8.0,
  "period": "month"
}
```

## Role-Based Access Control

The application supports three roles:
- **user**: Basic access, can create/edit own tasks
- **manager**: Can manage team tasks and projects
- **admin**: Full access to all features

### Task Permissions
- **user**: Can create, edit, and delete own tasks
- **manager**: Can create, edit, and delete any task
- **admin**: Full access to all tasks

### Protected Routes
Use the `ProtectedRoute` component with role requirements:
```jsx
<ProtectedRoute requiredRole="admin">
  <AdminPanel />
</ProtectedRoute>

<ProtectedRoute requiredAnyRole={['admin', 'manager']}>
  <ManagementPanel />
</ProtectedRoute>
```

## Error Handling

All API errors should follow this format:

```json
{
  "message": "Error message",
  "error": "Error code",
  "statusCode": 400
}
```

Common HTTP status codes:
- `200`: Success
- `201`: Created
- `400`: Bad Request
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found
- `500`: Internal Server Error
