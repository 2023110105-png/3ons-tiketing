# Supabase Integration Setup

This project now supports data sync through Supabase.

## 1) Create table in Supabase SQL Editor

```sql
create table if not exists public.workspace_state (
  id text primary key,
  tenant_registry jsonb not null default '{}'::jsonb,
  store jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
```

## 2) Configure environment

Set these variables:

- `VITE_DATA_BACKEND=supabase`
- `VITE_SUPABASE_URL=<your-project-url>`
- `VITE_SUPABASE_ANON_KEY=<your-anon-key>`
- `VITE_ENABLE_OWNER_FEATURES=false` (fokus tenant default)
- `VITE_USE_FIREBASE=false` (potong jalur Firebase sementara)

## 3) Run app

```bash
npm run dev
```

On startup, workspace reads/writes use `public.workspace_state` row with `id='default'`.

## 4) Realtime requirement (mandatory)

For live sync between admin, gate1, and gate2, ensure Supabase Realtime is enabled for table `public.workspace_state`.

Quick checks:

1. In Supabase Dashboard, open `Database` -> `Replication`.
2. Ensure `public.workspace_state` is included for realtime changes.
3. Keep RLS policies for `select` and `upsert` on `workspace_state` active.

## 5) In-app integration check (no terminal)

From app UI:

1. Login as admin.
2. Open `Pengaturan`.
3. Run **Tes Integrasi Supabase**.
4. Confirm toast result:
   - success: read/write works and probe timestamp is saved.
   - failed: fix env or RLS policy before go-live.

## 6) Small-scale go-live validation

Run this in two browsers/devices (Admin + Gate):

1. Add participant from Admin, verify appears on Gate after short delay.
2. Import participants, then refresh both clients.
3. Send ticket/mark sent, then verify ticket/QR status stays consistent.
4. Scan check-in from Gate, verify Ops Monitor/Admin updates.
5. Delete participant, refresh/reopen app, ensure deleted data does not reappear.

