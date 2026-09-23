# Architecture Rules

## Stack

- Next.js 14 with App Router
- TypeScript (strict)
- Tailwind CSS
- Reusable UI components
- PostgreSQL
- Prisma ORM
- Secure admin authentication (HTTP-only JWT sessions via `jose`)
- bcryptjs for password hashing
- Zod for all server-side and shared validation
- React Hook Form where appropriate
- lucide-react for icons
- Local file storage for development
- Storage abstraction (`lib/storage.ts`) for future S3-compatible providers

## Project Structure

```text
src/
├── app/                         — Next.js App Router routes and pages
│   ├── api/
│   │   ├── admin/               — Admin-protected API routes
│   │   │   ├── devices/         — Device list, detail, status
│   │   │   ├── requests/        — Registration request approve/reject
│   │   │   ├── files/           — Uploaded files list/delete
│   │   │   └── session/         — Login / logout
│   │   ├── device-requests/     — Public: submit device registration request
│   │   └── upload/              — Public: upload a file
│   ├── admin/
│   │   ├── login/               — Admin login page
│   │   └── (protected)/         — Route group: all require auth
│   │       ├── dashboard/
│   │       ├── users/           — Device list; [deviceId] detail page
│   │       ├── requests/        — Registration request management
│   │       └── files/           — Uploaded files management
│   └── upload/                  — Public upload page
├── components/
│   ├── admin/                   — Admin-specific components
│   └── ui/                      — Shared base UI primitives
│       └── upload/              — Upload page components
├── lib/
│   ├── admin/                   — Admin shared types
│   ├── auth/                    — Session, guard, passwords, actions
│   ├── services/                — Data access / business logic
│   ├── upload/                  — Upload types, format helpers, client
│   ├── validation/              — Shared Zod schemas
│   ├── audit.ts                 — Audit event helper
│   ├── db.ts                    — Prisma singleton
│   ├── env.ts                   — Environment variable validation
│   ├── storage.ts               — Storage driver abstraction
│   └── utils.ts                 — Shared utilities
└── middleware.ts                — Edge auth guard for /admin/* routes

prisma/
├── schema.prisma
├── migrations/
└── seed.ts

storage/                         — Local upload storage (dev only)
specs/                           — RnA, specs, plans, tasks
.antigravity/rules/              — Project rules
```

## Routes

```text
/
├── upload                               — Public upload page
├── admin/login                          — Admin login
└── admin/(protected)/
    ├── dashboard                        — Overview stats and charts
    ├── users                            — Device list
    │   └── [deviceId]                   — Device detail page
    ├── requests                         — Registration request management
    └── files                            — Uploaded files management
```

## API Routes

```text
POST   /api/upload                       — Public: upload file
POST   /api/device-requests              — Public: submit registration request
GET    /api/admin/devices                — Admin: list devices
GET    /api/admin/devices/[id]           — Admin: device detail
PATCH  /api/admin/devices/[id]/status   — Admin: enable/disable device
GET    /api/admin/devices/stats          — Admin: device stats
POST   /api/admin/requests/[id]/approve — Admin: approve request
POST   /api/admin/requests/[id]/reject  — Admin: reject request
GET    /api/admin/files                  — Admin: list files (with filters)
DELETE /api/admin/files/[id]             — Admin: delete file record
GET    /api/admin/files/[id]/download   — Admin: download file
POST   /api/admin/session                — Admin: login
DELETE /api/admin/session                — Admin: logout
```

## Design Principles

- Prefer small, focused modules.
- Reuse existing abstractions before adding new ones.
- Keep server logic server-side; do not trust the client.
- Separate concerns: routes, components, services, data access, validation.
- Use transactions for multi-step data operations.
- Keep changes small, testable, and reversible.
- Never expose internal errors, stack traces, or DB details to clients.
