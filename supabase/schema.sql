-- Jelajah Bahasa — skema database Supabase
-- Jalankan seluruh isi file ini pada Supabase Dashboard > SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default 'Siswa',
  class_name text not null default 'VI',
  role text not null default 'student' check (role in ('student', 'teacher')),
  student_code text unique,
  created_at timestamptz not null default now()
);

create table if not exists public.attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  assessment_type text not null default 'Uji pemahaman acak',
  score numeric(5,2) not null default 0 check (score >= 0 and score <= 100),
  total integer not null default 0 check (total >= 0),
  correct_count integer not null default 0 check (correct_count >= 0),
  duration_seconds integer not null default 0 check (duration_seconds >= 0),
  responses jsonb not null default '[]'::jsonb,
  essay_score numeric(5,2) check (essay_score is null or (essay_score >= 0 and essay_score <= 100)),
  teacher_feedback text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

-- Buat profil siswa otomatis ketika akun Auth baru didaftarkan.
create or replace function public.handle_new_jelajah_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, class_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1), 'Siswa'),
    coalesce(new.raw_user_meta_data->>'class_name', 'VI'),
    'student'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_jelajah on auth.users;
create trigger on_auth_user_created_jelajah
after insert on auth.users
for each row execute procedure public.handle_new_jelajah_user();

alter table public.profiles enable row level security;
alter table public.attempts enable row level security;

-- Fungsi SECURITY DEFINER menghindari rekursi RLS ketika memeriksa peran guru.
create or replace function public.is_jelajah_teacher()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'teacher'
  );
$$;
revoke all on function public.is_jelajah_teacher() from public;
grant execute on function public.is_jelajah_teacher() to authenticated;

-- Profil: siswa membaca/memperbarui profil sendiri. Guru dapat membaca semua profil.
drop policy if exists "profiles_select_own_or_teacher" on public.profiles;
create policy "profiles_select_own_or_teacher" on public.profiles
for select to authenticated
using (
  id = auth.uid()
  or public.is_jelajah_teacher()
);

drop policy if exists "profiles_insert_self_student" on public.profiles;
create policy "profiles_insert_self_student" on public.profiles
for insert to authenticated
with check (id = auth.uid() and role = 'student');

drop policy if exists "profiles_update_self_student" on public.profiles;
create policy "profiles_update_self_student" on public.profiles
for update to authenticated
using (id = auth.uid() and role = 'student')
with check (id = auth.uid() and role = 'student');

-- Hasil: siswa hanya dapat menambah dan membaca hasil miliknya.
-- Guru dengan role teacher dapat membaca semua hasil dan memperbarui penilaian uraian.
drop policy if exists "attempts_select_own_or_teacher" on public.attempts;
create policy "attempts_select_own_or_teacher" on public.attempts
for select to authenticated
using (
  user_id = auth.uid()
  or public.is_jelajah_teacher()
);

drop policy if exists "attempts_insert_own" on public.attempts;
create policy "attempts_insert_own" on public.attempts
for insert to authenticated
with check (user_id = auth.uid());

drop policy if exists "attempts_update_teacher" on public.attempts;
create policy "attempts_update_teacher" on public.attempts
for update to authenticated
using (public.is_jelajah_teacher())
with check (public.is_jelajah_teacher());

-- Aktifkan publikasi realtime untuk tabel hasil (abaikan jika sudah ditambahkan).
do $$
begin
  alter publication supabase_realtime add table public.attempts;
exception when duplicate_object then
  null;
when undefined_object then
  raise notice 'Publikasi supabase_realtime belum tersedia pada proyek ini. Aktifkan Realtime untuk tabel attempts dari Dashboard.';
end $$;

-- Setelah akun guru dibuat melalui menu Daftar aplikasi, jalankan perintah ini.
-- Ganti alamat email dengan email akun guru yang telah didaftarkan.
-- UPDATE public.profiles
-- SET role = 'teacher'
-- WHERE id = (SELECT id FROM auth.users WHERE email = 'guru@sekolah.sch.id');
