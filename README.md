# TimeSheet

Timesheet Management system codebase using:
- **Backend**: .NET 8 Web API
- **Frontend**: React + Vite + TypeScript
- **Database**: SQL Server (via EF Core)

## Project Structure
- `apps/api` — ASP.NET Core 8 API
- `apps/api.tests` — backend unit + integration tests
- `apps/web` — React frontend
- `db/schema.sql` — SQL schema reference
- `PROJECT_TASKS.md` — implementation checklist by epic/feature

## Prerequisites
Install the following tools locally:
- **.NET SDK 8.0+** (`dotnet --version`)
- **Node.js 20+ and npm 10+** (`node -v` / `npm -v`)
- **SQL Server** (local instance, Docker container, or hosted)

## 1) Clone and restore dependencies

```bash
git clone <your-repo-url>
cd TimeSheet
npm install
dotnet restore TimeSheet.sln
```

## 2) Configure the backend (`apps/api`)

### Connection string and settings
1. Open `apps/api/appsettings.json`.
2. Update `ConnectionStrings:DefaultConnection` for your SQL Server.
3. Optionally update JWT settings in `Jwt` (`Issuer`, `Audience`, `Key`, token expiry values).

> Keep secrets out of source control; prefer environment-specific overrides such as `appsettings.Development.json` or environment variables.

### Apply database migrations
Run EF Core migration update from repository root:

```bash
dotnet ef database update --project apps/api/TimeSheet.Api.csproj
```

If `dotnet ef` is not installed globally, install it first:

```bash
dotnet tool install --global dotnet-ef
```

## 3) Run backend locally

From repo root:

```bash
dotnet run --project apps/api/TimeSheet.Api.csproj
```

Default API URL is typically available at:
- `http://localhost:5000`
- Swagger/OpenAPI (if enabled): `http://localhost:5000/swagger`

Health endpoint:
- `GET /health`

## 4) Run frontend locally

From repo root:

```bash
npm run dev:web
```

Default frontend URL:
- `http://localhost:5173`

The frontend expects the backend to be running. If needed, update API base URL usage in frontend environment configuration.

## 5) Run tests and quality checks

### Frontend
```bash
npm run test:web
npm run build:web
npm run lint:web
```

### Backend
```bash
dotnet build TimeSheet.sln
dotnet test TimeSheet.sln
```

## Default Seed User
- Username: `admin`
- Password: `admin123`

## Developer workflow
- Feature branches: `feature/<featureNameOrID>`
- Bugfix branches: `bugfix/<bugNameOrID>`
- Before merge: run build + tests and complete code review.
