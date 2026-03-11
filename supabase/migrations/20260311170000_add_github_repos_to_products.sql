alter table public.products
  add column if not exists github_repo_owner text,
  add column if not exists github_repo_name text,
  add column if not exists github_repo_url text,
  add column if not exists github_default_branch text,
  add column if not exists github_clone_url text,
  add column if not exists github_is_private boolean not null default true,
  add column if not exists github_sync_status text not null default 'pending',
  add column if not exists github_last_synced_at timestamptz,
  add column if not exists github_last_sync_error text;

alter table public.products
  drop constraint if exists products_github_sync_status_check;

alter table public.products
  add constraint products_github_sync_status_check
  check (github_sync_status in ('pending', 'synced', 'failed'));
