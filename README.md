# Break The System

Production-oriented MVP for in-person hackathon judging with:

- `Next.js` App Router on Vercel
- `Supabase` Postgres/Auth
- Mobile-first judge flow with QR entry
- Dynamic coverage-first pairwise assignment
- Live admin dashboard with ranking freeze support

## Included routes

- `/submit` public project intake
- `/judge/[token]` judge mobile flow
- `/admin` authenticated organizer dashboard
- `/results` live or frozen read-only board
- `/login` Supabase admin login

## Local setup

1. Install dependencies:

```bash
npm install
```

2. Create environment variables:

```bash
cp .env.example .env.local
```

Fill in:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

3. Run the SQL migration in Supabase:

- Open the SQL editor in your Supabase project.
- Run [`supabase/migrations/202504250001_initial_schema.sql`](/Users/arenung/BreakTheSystem/supabase/migrations/202504250001_initial_schema.sql)
- Then run [`supabase/migrations/202504250002_admin_controls_and_duplicate_tables.sql`](/Users/arenung/BreakTheSystem/supabase/migrations/202504250002_admin_controls_and_duplicate_tables.sql)
- Then run [`supabase/migrations/202504250003_allow_judge_completion_until_release.sql`](/Users/arenung/BreakTheSystem/supabase/migrations/202504250003_allow_judge_completion_until_release.sql)

That migration creates:

- the event, project, judge, assignment, comparison, ranking, and admin tables
- RLS policies
- judge assignment RPC functions
- one default event row

4. Create at least one admin auth user in Supabase Auth.

5. Add that email to `public.admin_users`, for example:

```sql
insert into public.admin_users (email)
values ('organizer@example.com');
```

6. Start the app:

```bash
npm run dev
```

## Deployment on Vercel

1. Push this project to a Git repository.
2. Import it into Vercel as a Next.js project.
3. Add the same environment variables from `.env.local`.
4. Make sure the Supabase migration has already been applied in the production project.
5. Create the organizer auth users in Supabase Auth and whitelist their emails in `admin_users`.

## How the judging model works

- Judges enter through QR codes generated in `/admin`.
- Each assignment starts as `reserved_find` for 1 minute.
- When the judge taps `Found team`, the reservation becomes `reserved_judge` for 2 minutes.
- If the judge skips, cannot find the participant, or the lease expires, the project returns to the pool.
- `get_next_assignment` always prefers the lowest-visit eligible projects first, excludes live reservations, and excludes projects already finished or skipped by that judge.
- Pairwise outcomes update a simple Elo-style rating in `project_rankings`.
- Freezing results copies the current ranking order into `ranking_snapshots` and switches admin/results pages to that frozen snapshot.
- Admins can withdraw submissions, revoke judge links, delete unused judge links, and enlarge QR codes into a full-screen overlay for faster scanning.

## Operational notes

- Duplicate table numbers are allowed. Judges route by table number first, then disambiguate by project title and team name.
- Submission links are normalized to `https://` automatically when a team omits the scheme.
- `visit_count` increases only when a project was actually reached during the judging stage.
- Find-stage leases use a small 15-second backend grace window to absorb mobile latency. Once a judge has found a team, completion remains available until that reservation is released, expired, skipped, or completed.
- Admin updates use polling every 10 seconds. This keeps the MVP simple while still giving live coverage visibility.

## Validation

Run:

```bash
npm run lint
npm run typecheck
npm run build
```
