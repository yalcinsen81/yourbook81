-- ============================================================================
-- yourbook — Supabase Cloud Sync şeması
-- ============================================================================
-- Bu betiği Supabase Dashboard → SQL Editor'de bir kez çalıştırın.
-- `src/lib/syncEngine.ts` bu tabloya `user_sync_store` adıyla erişir.
-- ============================================================================

-- 1) Senkron depolama tablosu
create table if not exists public.user_sync_store (
  user_id    uuid        primary key references auth.users (id) on delete cascade,
  data       jsonb       not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

comment on table public.user_sync_store is
  'yourbook: kullanıcı başına senkronlanan localStorage verisi (tek satır).';

-- 2) Satır Düzeyi Güvenlik (RLS) — zorunlu
alter table public.user_sync_store enable row level security;

-- Her kullanıcı YALNIZCA kendi satırını okuyabilir/yazabilir.
drop policy if exists "user_sync_store_select_own" on public.user_sync_store;
create policy "user_sync_store_select_own"
  on public.user_sync_store for select
  using (auth.uid() = user_id);

drop policy if exists "user_sync_store_insert_own" on public.user_sync_store;
create policy "user_sync_store_insert_own"
  on public.user_sync_store for insert
  with check (auth.uid() = user_id);

drop policy if exists "user_sync_store_update_own" on public.user_sync_store;
create policy "user_sync_store_update_own"
  on public.user_sync_store for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "user_sync_store_delete_own" on public.user_sync_store;
create policy "user_sync_store_delete_own"
  on public.user_sync_store for delete
  using (auth.uid() = user_id);

-- 3) updated_at otomatik güncellensin
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists user_sync_store_touch on public.user_sync_store;
create trigger user_sync_store_touch
  before update on public.user_sync_store
  for each row execute function public.touch_updated_at();

-- ============================================================================
-- 4) ANON KİMLİK DOĞRULAMA (opsiyonel ama önerilir)
-- ============================================================================
-- Uygulama şu an `signInAnonymously()` kullanıyor. Supabase panelinde
-- Authentication → Providers → Anonymous Sign-Ins seçeneğini AÇIN.
--
-- ============================================================================
-- 5) ⚠️  GÜVENLİK UYARISI — İSTEMCİ ANAHTARI
-- ============================================================================
-- Vite, `VITE_` ile başlayan TÜM değişkenleri istemci paketine dahil eder.
-- Bu yüzden VITE_SUPABASE_ANON_KEY şu OLMALIDIR:
--     ✔ Publishable key  (sb_publishable_...)
--     ✔ veya eski "anon" JWT (payload.role = "anon")
-- Şu OLMAMALIDIR:
--     ✘ Service-role key (sb_secret_... / payload.role = "service_role")
-- Service-role anahtarı RLS'i tamamen atlar → herkes tüm veriyi okuyup
-- yazabilir. Böyle bir anahtar sızdıysa Supabase panelinden **derhal
-- rotate edin** (Project Settings → API → Rotate).
