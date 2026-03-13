# API Contract (Sprint 0)

## Auth
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`
- `GET /api/v1/auth/me`

## RBAC & Users
- `GET /api/v1/roles`
- `POST /api/v1/roles`
- `POST /api/v1/roles/assign`
- `GET /api/v1/users`
- `POST /api/v1/users`
- `PUT /api/v1/users/{id}`

## Masters
- `GET /api/v1/masters/departments`
- `GET /api/v1/masters/work-policies`

## Projects
- `GET /api/v1/projects`
- `GET /api/v1/projects/{id}`
- `POST /api/v1/projects`
- `PUT /api/v1/projects/{id}`
- `DELETE /api/v1/projects/{id}`
- `POST /api/v1/projects/{id}/archive`
- `PUT /api/v1/projects/{id}/members`
- `GET /api/v1/projects/{id}/members`

## Task Categories
- `GET /api/v1/task-categories`
- `GET /api/v1/task-categories/admin`
- `POST /api/v1/task-categories`
- `PUT /api/v1/task-categories/{id}`
- `DELETE /api/v1/task-categories/{id}`

## Timesheets
- `GET /api/v1/timesheets/entry-options`
- `POST /api/v1/timesheets/submit`
