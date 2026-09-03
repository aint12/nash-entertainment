# Nash Entertainment — client delivery platform

A self-hosted client portal for a sports media production company. Clients log in to collect finished video deliverables and upload raw footage; the operator manages accounts and reviews inbound quote requests from an admin panel.

Built to replace a workflow of Dropbox links, email threads, and manual password resets.

## What it does

**Public site** — marketing pages plus a quote request form that writes into the operator's queue.

**Client portal** (`/portal`) — authenticated clients see only their own deliverables, download finished work, and upload source footage directly rather than sending links.

**Admin panel** (`/admin`) — create and remove client accounts, reset passwords, review submitted quote requests.

## Design notes

**Auth.** Passwords hashed with bcrypt; sessions issued as JWTs with an 8-hour expiry. Role claim (`admin` / `client`) rides in the token, and an `authMiddleware` guards every protected route. Admin-only routes check the role claim separately, so a valid client token can't reach account management.

**File isolation.** Deliveries and uploads are scoped per client — the download route resolves paths against the authenticated user rather than trusting a path from the request, so one client can't enumerate or fetch another's files.

**Zero-config first run.** On boot the server creates its data files and directories if they don't exist and seeds a default admin and client account, printing the credentials to the console. Clone and `npm start` gives you a working system with nothing to configure.

**Flat-file storage.** Users, quotes, and file metadata live in JSON on disk rather than a database. At this scale — a handful of clients and a few deliveries a week — a database would be overhead without benefit. It's the honest trade for the actual load.

## Running it

```bash
npm install
npm start
```

Runs on port 4000. Set `JWT_SECRET` in the environment before exposing it anywhere real:

```bash
JWT_SECRET="$(openssl rand -hex 32)" npm start
```

## Stack

Node.js · Express · JWT (jsonwebtoken) · bcryptjs · multer

No frontend framework — vanilla JS, hand-written CSS.

## Scope and limits

Built for a specific small business with a known client list, and the constraints reflect that:

- **Flat-file storage** doesn't handle concurrent writes. Fine for this load; wrong past it.
- **Default seeded credentials** must be changed on any real deployment. They exist so a fresh clone runs immediately.
- **No email integration** — quote requests land in the admin panel, not an inbox.
- **Local filesystem storage** — no S3 or CDN, so it scales with the disk it's on.
- **No automated tests.**

Moving past a handful of clients would mean a real database, object storage for media, and email notifications on quote submission.
