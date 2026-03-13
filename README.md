# TimeSheet

Timesheet Management system codebase using:
- **Backend**: .NET 8 Web API
- **Frontend**: React + Vite + TypeScript
- **Database**: SQL Server (EF Core)

## Project Structure
- `apps/api` — ASP.NET Core 8 API
- `apps/web` — React frontend

## Prerequisites
- .NET SDK 8+
- Node.js 20+
- SQL Server

## Run API
```bash
dotnet restore apps/api/TimeSheet.Api.csproj
dotnet ef database update --project apps/api/TimeSheet.Api.csproj
dotnet run --project apps/api/TimeSheet.Api.csproj
```

Default API URL: `http://localhost:5000`

## Run Frontend
```bash
npm install
npm run dev:web
```

Default Web URL: `http://localhost:5173`

## Default Seed User
- Username: `admin`
- Password: `admin123`

## Branching & Delivery Rules
- Feature work: `feature/<featureNameOrID>`
- Bug work: `bugfix/<bugNameOrID>`
- Before merge: code review + lint/test/build + compatibility check.
