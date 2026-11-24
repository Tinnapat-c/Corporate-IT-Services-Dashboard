# IT Service Desk Dashboard

React dashboard with a local ASP.NET Core gateway. Layout follows Build Spec V3;
all metrics count Jobs and use the corporate DashboardV2 API.

## Project structure

- `frontend/` — React, TypeScript, Vite, TanStack Query and local Prompt fonts.
- `backend/` — ASP.NET Core gateway, API schema validation and page authorization.
- `tests/gateway/` — isolated gateway tests; no company connection required.
- `scripts/` — build and start commands for Windows.

## Requirements

- Windows with Node.js 22+ and pnpm 10+.
- .NET 10 SDK to build; ASP.NET Core Runtime 10 to run the published application.
- Corporate network/VPN and a Windows account authorized by the corporate API
  to load actual dashboard data.

## Build and run

From the repository root, in PowerShell:

```powershell
./scripts/build.ps1
./scripts/start.ps1
```

Open http://127.0.0.1:8766/#LIVE. Start the gateway using the Windows account
that can access the corporate API. A GitHub repository or GitHub Pages alone
cannot supply this Windows authentication or the corporate network connection.

The build script installs locked frontend dependencies, runs frontend and gateway
tests, builds the web files and publishes the local host to `artifacts/local`.
Generated web files, dependencies and compiled binaries are excluded from Git.

## Frontend development

Start the local gateway, then run:

```powershell
pnpm --dir frontend dev
```

Use Vite's printed localhost URL. Its proxy forwards API requests to port 8766.

## Current behavior

- Opens directly to Dashboard; no Login page or Microsoft SSO button.
- API access uses the Windows identity of the local gateway process.
- V2 API routes are under `/api2/dashboard/`; legacy Help views and `my-access`
  use `/api/dashboard/`.
- Today and selected-period priority summaries use V2 Job counts. Today follows
  the Asia/Bangkok calendar date; an unclassified-priority note preserves totals.
- Person focus uses its actual API response and the eight reference cards.
- API `ResultText` errors are forwarded as plain text, including JSON HTTP errors.
- There is no Excel, mock-data or alternate-user fallback.

Microsoft SSO is not implemented. It requires a separate identity-provider and
API integration; this source does not claim a user is authenticated via SSO.

## Tests

```powershell
pnpm --dir frontend test
dotnet run --project tests/gateway/GatewayTests.csproj
```

## Publishing source on GitHub

This repository contains corporate source, an internal API hostname/schema and
brand assets. Confirm company authorization before making it Public. A Private
repository can be shared by inviting collaborators. Public allows anyone to read,
copy and download the source; sharing source does not grant access to the API.

No employee API responses, Excel workbooks, screenshots, credentials, access tokens
or build outputs are included. Do not commit secrets or real API response exports.

No open-source license is granted by this project. Obtain the owner's approval
before assigning a license. Prompt font licensing is in
`frontend/public/fonts/OFL.txt`; other dependencies retain their own licenses.
