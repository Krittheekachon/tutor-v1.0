-- ============================================================
-- ข้อมูลตัวอย่างสำหรับสาธิต (ไม่ใช่ขั้นตอนติดตั้งจริง)
-- ใช้หลังรัน migration และสร้างบัญชีเจ้าของแล้วเท่านั้น
-- เปลี่ยนอีเมลด้านล่างให้ตรงกับบัญชีที่สร้างใน Supabase Authentication
-- จากนั้นเปิด SQL Editor แล้ว Run ทั้งไฟล์
-- ============================================================
do $$
declare
  v_email text := 'owner@example.com';
  v_owner uuid;
  v_student uuid := gen_random_uuid();
  v_course uuid := gen_random_uuid();
  v_rule uuid := gen_random_uuid();
  v_extra uuid := gen_random_uuid();
  v_session_old uuid := gen_random_uuid();
  v_session_recent uuid := gen_random_uuid();
  v_today date := (now() at time zone 'Asia/Bangkok')::date;
  v_start date := v_today - 28;
  v_old_date date := v_today - 14;
  v_recent_date date := v_today - 7;
  v_weekday smallint := extract(isodow from v_today)::smallint;
begin
  select id into v_owner
  from auth.users
  where lower(email) = lower(v_email)
  limit 1;

  if v_owner is null then
    raise exception 'ไม่พบบัญชีอีเมล % กรุณาสร้างบัญชีใน Authentication ก่อน', v_email;
  end if;

  if exists (
    select 1 from public.students
    where owner_id = v_owner and nickname = 'น้ำตาลนม'
  ) then
    raise notice 'มีข้อมูลตัวอย่างอยู่แล้ว ข้ามการโหลดซ้ำ';
    return;
  end if;

  insert into public.students (id, owner_id, nickname, color_hex)
  values (v_student, v_owner, 'น้ำตาลนม', '#F5A9C0');

  insert into public.courses (
    id, owner_id, student_id, subject, start_date, content,
    purchased_minutes, price_baht
  )
  values (
    v_course, v_owner, v_student, 'คณิตศาสตร์ ม.3', v_start,
    'ทบทวนบทที่ 1–3 และทำโจทย์เตรียมสอบกลางภาค',
    480, 4000
  );

  insert into public.schedule_rules (
    id, owner_id, course_id, weekday, start_time, end_time,
    effective_from, active
  )
  values (
    v_rule, v_owner, v_course, v_weekday, '16:00', '17:30',
    v_start, true
  );

  insert into public.sessions (
    id, owner_id, course_id, rule_id, kind, recurrence_key,
    session_date, start_time, end_time,
    original_date, original_start_time, original_end_time, status
  )
  values
    (
      v_session_old, v_owner, v_course, v_rule, 'regular',
      v_rule::text || ':' || v_old_date::text,
      v_old_date, '16:00', '17:30',
      v_old_date, '16:00', '17:30', 'scheduled'
    ),
    (
      v_session_recent, v_owner, v_course, v_rule, 'regular',
      v_rule::text || ':' || v_recent_date::text,
      v_recent_date, '16:00', '17:30',
      v_recent_date, '16:00', '17:30', 'scheduled'
    );

  insert into public.lesson_logs (
    owner_id, session_id, course_id, taught_on, actual_minutes
  )
  values
    (v_owner, v_session_old, v_course, v_old_date, 120),
    (v_owner, v_session_recent, v_course, v_recent_date, 90);

  insert into public.payments (
    owner_id, course_id, received_on, amount_baht, note
  )
  values (
    v_owner, v_course, v_today - 20, 2000, 'โอนรอบแรก'
  );

  -- นัดนอกรอบวันนี้ 13:00–14:30
  insert into public.sessions (
    id, owner_id, course_id, rule_id, kind, recurrence_key,
    session_date, start_time, end_time,
    original_date, original_start_time, original_end_time, status, note
  )
  values (
    v_extra, v_owner, v_course, null, 'extra',
    'extra:' || v_extra::text,
    v_today, '13:00', '14:30',
    v_today, '13:00', '14:30', 'scheduled',
    'ทบทวนโจทย์เสริมก่อนสอบ'
  );

  raise notice 'โหลดข้อมูลตัวอย่างแล้ว: 8 ชั่วโมง ราคา 4,000 บาท สอนแล้ว 3 ชั่วโมง 30 นาที (43.75%%)';
end;
$$;
