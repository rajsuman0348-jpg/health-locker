# Health Locker — MVP

A working first build of Health Locker: a patient-controlled digital health
record that connects patients, doctors, and family guardians, with
consent-based access to everything shared.

This implements the MVP feature set from the product spec (section 44):
registration/login, patient profile, medical history (conditions +
allergies), document locker, prescriptions, medication reminders with
adherence tracking, doctor accounts, appointments + follow-ups, guardian
accounts with granular consent, emergency contacts/profile/SOS, an access
audit log, and basic JWT-based security.

## Stack

- **Backend:** Node.js + TypeScript + Express, SQLite (via `better-sqlite3`),
  JWT auth, bcrypt password hashing, Zod validation, Multer for document
  uploads. SQLite keeps the MVP dependency-free to run locally; swapping in
  PostgreSQL later means changing `src/db.ts` and the SQL dialect only — the
  route/service layer is unaffected.
- **Frontend:** React + TypeScript + Vite + Tailwind CSS, React Router.

## Project layout

```
backend/
  src/
    db.ts               SQLite schema + connection
    access.ts            Role/consent-based access control + audit logging
    middleware/auth.ts    JWT auth middleware
    routes/               One file per resource group
    index.ts              Express app entry point
frontend/
  src/
    lib/api.ts            Fetch wrapper (adds auth header, parses errors)
    lib/types.ts           Shared TS types matching API responses
    context/AuthContext.tsx
    components/            Layout/nav, route guard, shared UI bits
    pages/                  One file per screen, patient/doctor/guardian
```

## Running it locally

Requires Node.js 18+.

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env    # edit JWT_SECRET for anything beyond local dev
npm run dev              # http://localhost:4000
```

The SQLite database file is created automatically at `backend/data/health-locker.db`
on first run — no separate database setup needed.

An optional end-to-end check is included: with the server running,
`python3 smoke_test.py` from the `backend/` folder exercises the full flow
(registration, consent, medications, emergency, audit log, access revocation)
against a live server and prints pass/fail for each step.

### 2. Frontend

```bash
cd frontend
npm install
cp .env.example .env    # points at the backend; edit if you changed PORT
npm run dev              # http://localhost:5173
```

Open http://localhost:5173, register a **patient** account, then (in a
second browser or incognito window) register a **doctor** and a **guardian**
account to try the full flow:

1. As the patient: fill in your profile, add a condition/allergy, add a
   doctor, book an appointment with them.
2. As the doctor: you'll now see that patient on your dashboard (doctors
   only gain access once a patient books with them) — write a prescription.
3. As the patient: invite the guardian by email, then grant specific
   permissions (medicines, appointments, etc.).
4. As the guardian: accept the invite — you'll now see only what was shared.
5. Back as the patient: check **Access History** to see every view logged,
   and try revoking the guardian's access.

## What's implemented vs. what's next

Covered: everything in the MVP list (spec section 44), plus follow-ups,
daily-adherence alerts for missed medication confirmations, and a
consolidated "who has access to my information" consent view.

Deliberately out of scope for this first build (see the spec's later
phases): Elderly Mode's voice assistance, wearable/device integration,
AI assistance, SOS as a real SMS/push fan-out (it currently logs the event
and returns who *would* be notified), a native Android app, and
production-grade document storage (documents currently live on local disk
under `backend/uploads/` — fine for a demo, not for production).

## Security notes for going further

This MVP covers the basics (hashed passwords, JWT auth, role + consent
checks on every patient-data route, an audit trail). Before any real
patient data touches this: add HTTPS termination, MFA/OTP, rate limiting,
encryption at rest for the database and uploaded files, and a real
object-storage backend (S3-compatible) instead of local disk.
