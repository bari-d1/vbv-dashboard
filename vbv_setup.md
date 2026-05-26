# VBV Creative Pipeline — Setup Guide

## 1. Install dependencies

```bash
cd vbv-dashboard/backend
npm install
```

New packages added: `bcrypt`, `jsonwebtoken`, `nodemailer`.

---

## 2. Environment variables

Add these to `backend/.env` (already appended by the build):

```env
JWT_SECRET=change_this_to_a_long_random_string
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your@email.com
SMTP_PASS=yourpassword
EMAIL_FROM=noreply@versebyverse.com
VBV_DASHBOARD_URL=https://your-deployed-url.com/vbv-pipeline/vbv.html
```

> **SMTP is optional at launch.** If SMTP is not configured, user creation and review notifications will still work — the email step is wrapped in a try/catch and logs the error without crashing.

---

## 3. Database migration

The schema was applied with `prisma db push` (non-interactive environment).

For fresh environments or CI:

```bash
cd vbv-dashboard/backend
npx prisma db push
npx prisma generate
```

For a proper migration history going forward:

```bash
npx prisma migrate dev --name vbv_pipeline
```

> Note: The original migration history was SQLite-based and has been removed. The Postgres DB schema is now the source of truth via `db push`.

---

## 4. Create the first admin user

There is no seed script — create the first admin directly in the database:

```bash
node -e "
const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const pw = 'Admin1234!';
  const hash = await bcrypt.hash(pw, 10);
  const user = await prisma.vbvUser.create({
    data: {
      name: 'Admin',
      email: 'admin@versebyverse.com',
      passwordHash: hash,
      role: 'admin',
      credential: { create: { email: 'admin@versebyverse.com', plainPassword: pw } }
    }
  });
  console.log('Admin created:', user.email, '/ password:', pw);
  await prisma.\$disconnect();
})();
"
```

After logging in as admin, use the User Management panel to add all other users. Passwords are auto-generated and emailed.

---

## 5. How VBV routes are mounted

In `server.js`:

```js
app.use('/vbv/auth', vbvAuthRoutes);
app.use('/vbv/users', vbvUsersRoutes);
app.use('/vbv/jobs', vbvJobsRoutes);
app.use('/vbv/submissions', vbvSubmissionsRoutes);
app.use('/vbv/logs', vbvLogsRoutes);
```

All VBV API routes live under `/vbv/`. The existing `/api/` routes are untouched.

---

## 6. Accessing the dashboard

The frontend is served as a static file by the existing Express static middleware.

Open: `http://localhost:3001/vbv-pipeline/vbv.html`

The dashboard is a single HTML file — no build step, no bundler.

---

## 7. API route reference

| Method | Path | Role | Description |
|--------|------|------|-------------|
| POST | /vbv/auth/login | — | Login, returns JWT |
| GET | /vbv/users | admin | List all users (with passwords) |
| POST | /vbv/users | admin | Create user (auto-generates password) |
| PATCH | /vbv/users/:id | admin | Update role or active status |
| DELETE | /vbv/users/:id | admin | Delete user |
| GET | /vbv/logs/activity | admin | Activity log (filterable) |
| GET | /vbv/logs/timeline/:jobId | any | Timeline for a job |
| POST | /vbv/jobs | social_media | Create edit brief |
| GET | /vbv/jobs/mine | social_media | Own briefs |
| GET | /vbv/jobs/pool | editor, lead_editor | Open unassigned jobs |
| POST | /vbv/jobs/:id/claim | editor | Claim a job (5-job cap enforced) |
| GET | /vbv/jobs/assigned | editor | Editor's own jobs |
| POST | /vbv/submissions/:jobId | editor | Submit finished edit |
| POST | /vbv/jobs/:id/assign | lead_editor | Assign job to editor |
| GET | /vbv/jobs/review-queue | lead_editor | Submitted jobs awaiting review |
| POST | /vbv/jobs/:id/approve | lead_editor | Approve → moves to lead_approved |
| POST | /vbv/jobs/:id/send-back | lead_editor | Send back → sent_back_by_lead |
| GET | /vbv/jobs/for-review | social_media | Jobs at lead_approved created by this user |
| POST | /vbv/jobs/:id/sm-approve | social_media | Final SM approval → sm_approved |
| POST | /vbv/jobs/:id/sm-send-back | social_media | SM correction request → sent_back_by_sm |
| GET | /vbv/jobs/in-sm-review | lead_editor | Read-only: jobs at lead_approved |
| GET | /vbv/jobs/completed | lead_editor | Read-only: sm_approved jobs |
| GET | /vbv/users/editors | lead_editor, admin | Active editors list for assignment |

---

## 8. Option A Extension — SM Review Stage

### Updated status flow

```
open → in_progress → submitted → lead_approved → sm_approved
                         ↓               ↓
                  sent_back_by_lead  sent_back_by_sm
                         ↓               ↓
                    (editor revises and resubmits → submitted → lead re-reviews)
```

### Status meanings

| Status | Who acts next |
|---|---|
| `open` | Editor (claim) or Lead Editor (assign) |
| `in_progress` | Editor (submit) |
| `submitted` | Lead Editor (approve or send back) |
| `sent_back_by_lead` | Editor (revise and resubmit) |
| `lead_approved` | Social Media (approve or request correction) |
| `sent_back_by_sm` | Editor (revise and resubmit) → Lead re-reviews |
| `sm_approved` | Pipeline complete |

### 5-job cap update

A slot only frees when a job reaches `sm_approved`. All other active statuses count toward the cap:
- `in_progress`, `submitted`, `sent_back_by_lead`, `lead_approved`, `sent_back_by_sm`

### Migration

The v2 migration was applied via `vbv_migrate_v2.js`. This script:
- Added new `VbvJobStatus` enum values and migrated existing data
- Added `VbvSmReviewAction` enum
- Added SM review columns to `VbvSubmission`

For fresh environments, `npx prisma db push` applies the full schema including all v2 changes.
