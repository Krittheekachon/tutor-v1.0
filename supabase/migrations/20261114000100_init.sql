-- ============================================================
-- ตารางสอนของฉัน — Supabase schema
-- วิธีใช้: เปิด Supabase Dashboard > SQL Editor > New query
-- วางทั้งไฟล์แล้วกด Run เพียงครั้งเดียว
-- ============================================================

create extension if not exists pgcrypto;

-- ---------- ฟังก์ชันกลาง ----------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ป้องกันการลบข้อมูลที่มีประวัติการสอน/การรับเงินแล้ว
-- ผู้ใช้ต้องใช้การเก็บเข้าคลังแทน
create or replace function public.guard_history_delete()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_table_name = 'sessions' then
    if exists (select 1 from public.lesson_logs where session_id = old.id) then
      raise exception using
        errcode = '23503',
        message = 'HAS_HISTORY: session has a lesson record';
    end if;
    return old;
  end if;

  if tg_table_name = 'courses' then
    if exists (select 1 from public.lesson_logs where course_id = old.id)
       or exists (select 1 from public.payments where course_id = old.id) then
      raise exception using
        errcode = '23503',
        message = 'HAS_HISTORY: course has lesson or payment history';
    end if;
    return old;
  end if;

  if tg_table_name = 'students' then
    if exists (
      select 1
      from public.lesson_logs l
      join public.courses c on c.id = l.course_id and c.owner_id = l.owner_id
      where c.student_id = old.id
    ) or exists (
      select 1
      from public.payments p
      join public.courses c on c.id = p.course_id and c.owner_id = p.owner_id
      where c.student_id = old.id
    ) then
      raise exception using
        errcode = '23503',
        message = 'HAS_HISTORY: student has lesson or payment history';
    end if;
    return old;
  end if;

  return old;
end;
$$;

-- ---------- ตารางข้อมูล ----------
create table public.students (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nickname text not null,
  color_hex text not null default '#F5A9C0',
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint students_nickname_length check (char_length(btrim(nickname)) between 1 and 80),
  constraint students_color_hex check (color_hex ~ '^#[0-9A-Fa-f]{6}$'),
  constraint students_id_owner_unique unique (id, owner_id)
);

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  student_id uuid not null,
  subject text not null,
  start_date date not null,
  content text not null default '',
  purchased_minutes integer not null,
  price_baht numeric(12, 2) not null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint courses_subject_length check (char_length(btrim(subject)) between 1 and 120),
  constraint courses_content_length check (char_length(content) <= 5000),
  constraint courses_purchased_minutes check (purchased_minutes between 1 and 1000000),
  constraint courses_price_baht check (price_baht >= 0 and price_baht <= 100000000),
  constraint courses_id_owner_unique unique (id, owner_id),
  constraint courses_student_owner_fk foreign key (student_id, owner_id)
    references public.students (id, owner_id) on delete cascade
);

create table public.schedule_rules (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  course_id uuid not null,
  weekday smallint not null,
  start_time time not null,
  end_time time not null,
  effective_from date not null,
  effective_to date,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint schedule_rules_weekday check (weekday between 1 and 7),
  constraint schedule_rules_time_order check (end_time > start_time),
  constraint schedule_rules_effective_range check (effective_to is null or effective_to >= effective_from),
  constraint schedule_rules_id_owner_unique unique (id, owner_id),
  constraint schedule_rules_course_owner_fk foreign key (course_id, owner_id)
    references public.courses (id, owner_id) on delete cascade
);

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  course_id uuid not null,
  rule_id uuid,
  kind text not null default 'regular',
  recurrence_key text not null,
  session_date date not null,
  start_time time not null,
  end_time time not null,
  original_date date not null,
  original_start_time time not null,
  original_end_time time not null,
  status text not null default 'scheduled',
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sessions_kind check (kind in ('regular', 'extra')),
  constraint sessions_status check (status in ('scheduled', 'moved', 'canceled')),
  constraint sessions_time_order check (end_time > start_time),
  constraint sessions_original_time_order check (original_end_time > original_start_time),
  constraint sessions_note_length check (char_length(note) <= 5000),
  constraint sessions_rule_by_kind check (
    (kind = 'regular' and rule_id is not null)
    or (kind = 'extra' and rule_id is null)
  ),
  constraint sessions_recurrence_key_length check (char_length(recurrence_key) between 3 and 200),
  constraint sessions_id_owner_unique unique (id, owner_id),
  constraint sessions_id_course_owner_unique unique (id, course_id, owner_id),
  constraint sessions_owner_recurrence_unique unique (owner_id, recurrence_key),
  constraint sessions_course_owner_fk foreign key (course_id, owner_id)
    references public.courses (id, owner_id) on delete cascade,
  constraint sessions_rule_owner_fk foreign key (rule_id, owner_id)
    references public.schedule_rules (id, owner_id) on delete cascade
);

create table public.lesson_logs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  session_id uuid not null,
  course_id uuid not null,
  taught_on date not null,
  actual_minutes integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lesson_logs_actual_minutes check (actual_minutes between 1 and 1440),
  constraint lesson_logs_session_unique unique (session_id),
  constraint lesson_logs_id_owner_unique unique (id, owner_id),
  constraint lesson_logs_session_course_owner_fk foreign key (session_id, course_id, owner_id)
    references public.sessions (id, course_id, owner_id) on delete cascade,
  constraint lesson_logs_course_owner_fk foreign key (course_id, owner_id)
    references public.courses (id, owner_id) on delete cascade
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  course_id uuid not null,
  received_on date not null,
  amount_baht numeric(12, 2) not null,
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payments_amount check (amount_baht > 0 and amount_baht <= 100000000),
  constraint payments_note_length check (char_length(note) <= 1000),
  constraint payments_id_owner_unique unique (id, owner_id),
  constraint payments_course_owner_fk foreign key (course_id, owner_id)
    references public.courses (id, owner_id) on delete cascade
);

create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  course_id uuid not null,
  storage_path text not null,
  file_name text not null,
  mime_type text,
  size_bytes bigint,
  created_at timestamptz not null default now(),
  constraint attachments_file_name_length check (char_length(file_name) between 1 and 255),
  constraint attachments_path_owner check (storage_path like owner_id::text || '/%'),
  constraint attachments_path_unique unique (storage_path),
  constraint attachments_id_owner_unique unique (id, owner_id),
  constraint attachments_course_owner_fk foreign key (course_id, owner_id)
    references public.courses (id, owner_id) on delete cascade
);

-- ---------- Indexes ----------
create index students_owner_archived_idx on public.students (owner_id, archived_at);
create index courses_owner_student_idx on public.courses (owner_id, student_id);
create index courses_owner_archived_idx on public.courses (owner_id, archived_at);
create index schedule_rules_owner_course_active_idx on public.schedule_rules (owner_id, course_id, active);
create index sessions_owner_date_idx on public.sessions (owner_id, session_date, start_time);
create index sessions_owner_course_date_idx on public.sessions (owner_id, course_id, session_date);
create index sessions_owner_status_idx on public.sessions (owner_id, status);
create index lesson_logs_owner_course_taught_idx on public.lesson_logs (owner_id, course_id, taught_on);
create index payments_owner_course_date_idx on public.payments (owner_id, course_id, received_on);
create index attachments_owner_course_idx on public.attachments (owner_id, course_id);

-- ---------- Triggers ----------
create trigger students_set_updated_at
before update on public.students
for each row execute function public.set_updated_at();

create trigger courses_set_updated_at
before update on public.courses
for each row execute function public.set_updated_at();

create trigger schedule_rules_set_updated_at
before update on public.schedule_rules
for each row execute function public.set_updated_at();

create trigger sessions_set_updated_at
before update on public.sessions
for each row execute function public.set_updated_at();

create trigger lesson_logs_set_updated_at
before update on public.lesson_logs
for each row execute function public.set_updated_at();

create trigger payments_set_updated_at
before update on public.payments
for each row execute function public.set_updated_at();

create trigger sessions_guard_delete
before delete on public.sessions
for each row execute function public.guard_history_delete();

create trigger courses_guard_delete
before delete on public.courses
for each row execute function public.guard_history_delete();

create trigger students_guard_delete
before delete on public.students
for each row execute function public.guard_history_delete();

-- ---------- สิทธิ์ระดับฐานข้อมูล ----------
revoke all on table public.students from anon, authenticated;
revoke all on table public.courses from anon, authenticated;
revoke all on table public.schedule_rules from anon, authenticated;
revoke all on table public.sessions from anon, authenticated;
revoke all on table public.lesson_logs from anon, authenticated;
revoke all on table public.payments from anon, authenticated;
revoke all on table public.attachments from anon, authenticated;

grant select, insert, update, delete on table public.students to authenticated;
grant select, insert, update, delete on table public.courses to authenticated;
grant select, insert, update, delete on table public.schedule_rules to authenticated;
grant select, insert, update, delete on table public.sessions to authenticated;
grant select, insert, update, delete on table public.lesson_logs to authenticated;
grant select, insert, update, delete on table public.payments to authenticated;
grant select, insert, update, delete on table public.attachments to authenticated;

-- ฟังก์ชัน trigger ไม่ต้องให้เรียกผ่าน API
revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.guard_history_delete() from public, anon, authenticated;

-- ---------- Row Level Security ----------
alter table public.students enable row level security;
alter table public.courses enable row level security;
alter table public.schedule_rules enable row level security;
alter table public.sessions enable row level security;
alter table public.lesson_logs enable row level security;
alter table public.payments enable row level security;
alter table public.attachments enable row level security;

-- students
create policy students_select_own on public.students
  for select to authenticated
  using ((select auth.uid()) = owner_id);
create policy students_insert_own on public.students
  for insert to authenticated
  with check ((select auth.uid()) = owner_id);
create policy students_update_own on public.students
  for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
create policy students_delete_own on public.students
  for delete to authenticated
  using ((select auth.uid()) = owner_id);

-- courses
create policy courses_select_own on public.courses
  for select to authenticated
  using ((select auth.uid()) = owner_id);
create policy courses_insert_own on public.courses
  for insert to authenticated
  with check ((select auth.uid()) = owner_id);
create policy courses_update_own on public.courses
  for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
create policy courses_delete_own on public.courses
  for delete to authenticated
  using ((select auth.uid()) = owner_id);

-- schedule_rules
create policy schedule_rules_select_own on public.schedule_rules
  for select to authenticated
  using ((select auth.uid()) = owner_id);
create policy schedule_rules_insert_own on public.schedule_rules
  for insert to authenticated
  with check ((select auth.uid()) = owner_id);
create policy schedule_rules_update_own on public.schedule_rules
  for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
create policy schedule_rules_delete_own on public.schedule_rules
  for delete to authenticated
  using ((select auth.uid()) = owner_id);

-- sessions
create policy sessions_select_own on public.sessions
  for select to authenticated
  using ((select auth.uid()) = owner_id);
create policy sessions_insert_own on public.sessions
  for insert to authenticated
  with check ((select auth.uid()) = owner_id);
create policy sessions_update_own on public.sessions
  for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
create policy sessions_delete_own on public.sessions
  for delete to authenticated
  using ((select auth.uid()) = owner_id);

-- lesson_logs
create policy lesson_logs_select_own on public.lesson_logs
  for select to authenticated
  using ((select auth.uid()) = owner_id);
create policy lesson_logs_insert_own on public.lesson_logs
  for insert to authenticated
  with check ((select auth.uid()) = owner_id);
create policy lesson_logs_update_own on public.lesson_logs
  for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
create policy lesson_logs_delete_own on public.lesson_logs
  for delete to authenticated
  using ((select auth.uid()) = owner_id);

-- payments
create policy payments_select_own on public.payments
  for select to authenticated
  using ((select auth.uid()) = owner_id);
create policy payments_insert_own on public.payments
  for insert to authenticated
  with check ((select auth.uid()) = owner_id);
create policy payments_update_own on public.payments
  for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
create policy payments_delete_own on public.payments
  for delete to authenticated
  using ((select auth.uid()) = owner_id);

-- attachments
create policy attachments_select_own on public.attachments
  for select to authenticated
  using ((select auth.uid()) = owner_id);
create policy attachments_insert_own on public.attachments
  for insert to authenticated
  with check ((select auth.uid()) = owner_id);
create policy attachments_update_own on public.attachments
  for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
create policy attachments_delete_own on public.attachments
  for delete to authenticated
  using ((select auth.uid()) = owner_id);

-- ---------- Storage: private bucket สำหรับไฟล์การสอน ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'course-files',
  'course-files',
  false,
  20971520,
  array[
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/webp',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists course_files_select_own on storage.objects;
drop policy if exists course_files_insert_own on storage.objects;
drop policy if exists course_files_update_own on storage.objects;
drop policy if exists course_files_delete_own on storage.objects;

create policy course_files_select_own on storage.objects
  for select to authenticated
  using (
    bucket_id = 'course-files'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy course_files_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'course-files'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy course_files_update_own on storage.objects
  for update to authenticated
  using (
    bucket_id = 'course-files'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  )
  with check (
    bucket_id = 'course-files'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy course_files_delete_own on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'course-files'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

-- ---------- หมายเหตุ ----------
comment on table public.sessions is
  'นัดแต่ละครั้ง ถูกสร้างแบบ idempotent จาก schedule_rules ด้วย recurrence_key = rule_id:วันที่ และ upsert ignore duplicate จึงไม่ต้องใช้ cron';
comment on column public.sessions.recurrence_key is
  'คีย์คงที่ของนัดประจำ ใช้กันสร้างซ้ำเวลาเปิดปฏิทินหรือรีเฟรช';
comment on column public.sessions.original_date is
  'วันเดิมของนัด ใช้เก็บประวัติเมื่อเลื่อนนัด';
comment on table public.lesson_logs is
  'บันทึกเวลาสอนจริง หนึ่งนัดมีได้หนึ่งรายการ ด้วย unique(session_id) และ upsert';
comment on table public.attachments is
  'ไฟล์การสอนใน private bucket course-files path เริ่มต้นด้วย UUID ของเจ้าของ';
