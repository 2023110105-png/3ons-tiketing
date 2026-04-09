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

`VITE_USE_FIREBASE` can stay enabled for auth compatibility while data sync uses Supabase.

## 3) Run app

```bash
npm run dev
```

On startup, workspace reads/writes use `public.workspace_state` row with `id='default'`.

