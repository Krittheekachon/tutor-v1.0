# ตารางสอนของฉัน

เว็บแอปสำหรับติวเตอร์ หนึ่งบัญชีต่อหนึ่งพื้นที่ตารางสอน ใช้ดูตารางสอนรายเดือน บันทึกเวลาที่สอนจริง ติดตามชั่วโมงคงเหลือ ประเมินวันจบ และจัดการค่าเรียน/การรับเงิน โดยเก็บข้อมูลจริงทั้งหมดบน Supabase และแยกข้อมูลแต่ละบัญชีด้วย RLS

- **Frontend:** React 18 + TypeScript + Vite + CSS (ไม่มี UI framework)
- **Backend:** Supabase PostgreSQL, Auth และ Storage (private bucket)
- **Auth:** Email/password และ Google OAuth (Google เป็นตัวเลือก ต้องตั้งค่าเพิ่ม)
- **Deploy:** Cloudflare Pages (static SPA)
- **Timezone:** `Asia/Bangkok` และแสดงเวลาแบบ 24 ชั่วโมง
- **ภาษา:** ภาษาไทยทั้งแอป รวม loading / empty / error state

---

## 1. ฟีเจอร์หลัก

### การเข้าสู่ระบบ

- หนึ่งบัญชี = หนึ่งพื้นที่ข้อมูล หลายบัญชีใช้แอปได้พร้อมกันโดยไม่เห็นข้อมูลกัน
- รองรับ **email/password** และ **Google OAuth**
- Google account ใหม่สามารถสร้างพื้นที่ว่างของตัวเองได้ทันทีเมื่อเปิดรับสมัคร
- ปุ่ม Google ใช้ PKCE flow และ redirect กลับ origin ปัจจุบัน
- ตั้งชื่อที่แสดงของเจ้าของ เช่น **“อาจารย์หยก”** ได้จากมุมขวาบนของแอป
- ไม่มีหน้าสมัครสมาชิกแยกในแอป — Google Login ทำหน้าที่เริ่มพื้นที่ใหม่ให้อัตโนมัติ
- ข้อมูลนักเรียน ตาราง ไฟล์ และการเงินของแต่ละบัญชีถูกแยกด้วย RLS
- หากต้องการโหมดส่วนตัวบัญชีเดียว ให้ปิด **Allow new users to sign up** และสร้างบัญชีเจ้าของใน Dashboard

### ปฏิทินและบันทึกการสอน

- ปฏิทินรายเดือนแบบ Google Calendar มีปุ่ม **เดือนก่อนหน้า / วันนี้ / เดือนถัดไป**
- เปิดมาที่วันปัจจุบัน แสดงนัดเป็นแถบแนวนอนพร้อมเวลาเริ่มและชื่อนักเรียน เรียงตามเวลา
- ถ้าพื้นที่ช่องวันไม่พอ แสดง **«+อีก N นัด»** และแสดงครบในรายละเอียดใต้ปฏิทินเมื่อเลือกวัน
- รายละเอียดนัด: ชื่อ วิชา เวลาเริ่ม–จบ ระยะเวลา เนื้อหาที่วางไว้ ไฟล์แนบ และป้าย **«นอกรอบ» / «สอนแล้ว»**
- บันทึกหลังสอนเป็นชั่วโมง + นาที โดยเสนอเวลาตามนัดเป็นค่าเริ่มต้น และต้องกดยืนยัน
- นัดหนึ่งมีบันทึกได้หนึ่งรายการด้วย `unique(session_id)` และใช้ upsert จึงกดซ้ำหรือแก้ไขแล้วยอดไม่บวกซ้ำ
- แก้ไข/ยกเลิกบันทึกย้อนหลังได้ แสดงเวลาสอนจริง ยอดสะสม และชั่วโมงคงเหลือทันทีหลังบันทึก
- เลื่อนนัดหรือยกเลิกนัดครั้งนี้ได้เฉพาะนัดที่ยังไม่บันทึกว่าสอนแล้ว
- เตือนเมื่อเวลาใหม่ซ้อนกับนัดอื่น แต่อนุญาตให้นัดต่อกันพอดี (09:00–10:00 ต่อ 10:00–11:00)
- มีทางลัดเปิด **Google Meet** และ **ChatGPT** ในแท็บใหม่

### นักเรียน คอร์ส และตารางประจำ

- ค้นหาชื่อเล่น เพิ่มนักเรียน และดูรายการแบบตารางบนเดสก์ท็อป / การ์ดบนมือถือ
- แสดงชื่อเล่น วิชา ตารางประจำ ชั่วโมงสะสม ชั่วโมงคงเหลือ เปอร์เซ็นต์ความคืบหน้า และวันจบโดยประมาณ
- นักเรียนหนึ่งคนมีหลายคอร์สได้ (ต่อคอร์สหรือเรียนอีกวิชา)
- แต่ละคอร์สมีวันที่เริ่ม เนื้อหา เวลาที่ซื้อ (8, 12 ชั่วโมง ฯลฯ) และค่าเรียนต่อคอร์ส
- สีประจำตัวนักเรียนเลือกจากพาเลตพาสเทลหรือกรอก `#RRGGBB` พร้อมแถบตัวอย่างและสีข้อความที่อ่านง่าย
- ตั้งตารางประจำได้หลายช่วงต่อสัปดาห์ (วัน + เวลาเริ่ม–จบ)
- เพิ่ม **นัดนอกรอบ** โดยค้นหานักเรียนเดิม เลือกคอร์ส วัน เวลา และเนื้อหาของครั้งนั้น ใช้สีเดิมของนักเรียน
- แก้ตารางประจำตามวันที่มีผล โดยเก็บประวัตินัดเดิม นัดที่สอนแล้ว/เลื่อน/ยกเลิกไว้
- เปิดปฏิทินซ้ำหรือรีเฟรชแล้วไม่สร้างนัดซ้ำ (อธิบายกลไกในหัวข้อ 5)
- ลบข้อมูลที่ยังไม่มีประวัติได้หลังยืนยัน ถ้ามีประวัติการสอน/รับเงินจะใช้ **เก็บเข้าคลัง** แทน
- นักเรียน/คอร์สในคลังถูกซ่อนจากรายการและนัดในอนาคต แต่เปิดดูประวัติ ไฟล์แนบ และการรับเงินได้

### ชั่วโมง วันจบ และค่าเรียน

- เก็บระยะเวลาเป็นนาทีทั้งหมด
- ความคืบหน้า = เวลาที่สอนจริง ÷ เวลาที่ซื้อ (สูงสุด 100%)
- ชั่วโมงคงเหลือต่ำสุด 0 นาที และแสดงเวลาส่วนเกินถ้าสอนเกิน
- วันจบโดยประมาณ = วันแรกที่นัดในอนาคตซึ่งยังมีผลสะสมครบเวลาคงเหลือ
  - นับทั้งนัดประจำและนัดนอกรอบ
  - ข้ามนัดที่ยกเลิก นัดที่บันทึกสอนแล้ว และนัดที่เลยเวลาแล้ว
  - ถ้าเวลาในตารางไม่พอ แสดง **«ยังประเมินไม่ได้»** พร้อมจำนวนเวลาที่ยังต้องนัดเพิ่ม
- เมื่อสอนครบ แสดง **วันที่สอนครบจริง** ตามลำดับวันที่สอน
- แสดงแยกกันระหว่าง **ค่าเรียนทั้งคอร์ส**, **มูลค่าที่สอนไป** (ไม่เกินราคาคอร์ส) และ **ยอดรับเงินจริง**
- บันทึกการรับเงินได้หลายรายการพร้อมวันที่ จำนวนเงิน และหมายเหตุ

ตัวอย่างตรวจสอบที่มีในระบบ:

| รายการ | ค่า |
| --- | --- |
| คอร์ส | 8 ชั่วโมง ราคา 4,000 บาท |
| บันทึกครั้งที่ 1 | 2 ชั่วโมง |
| บันทึกครั้งที่ 2 | 1 ชั่วโมง 30 นาที |
| ยอดสะสม | 3 ชั่วโมง 30 นาที = 43.75% |
| ชั่วโมงคงเหลือ | 4 ชั่วโมง 30 นาที |
| มูลค่าที่สอนไป | 1,750 บาท |
| แก้ครั้งที่ 2 เป็น 1 ชั่วโมง | ยอดสะสมเหลือ 3 ชั่วโมง |

---

## 2. โครงสร้างโปรเจกต์

```text
tutor-calendar/
├── index.html
├── package.json
├── package-lock.json
├── tsconfig.json
├── vite.config.ts
├── .env.example
├── .gitignore
├── README.md
├── public/
│   └── _redirects
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── base.css
│   ├── styles.css
│   ├── vite-env.d.ts
│   ├── components/
│   │   ├── AttachmentButton.tsx
│   │   ├── ColorPicker.tsx
│   │   ├── CourseDetailModal.tsx
│   │   ├── CourseFormModal.tsx
│   │   ├── DashboardPage.tsx
│   │   ├── ExtraSessionModal.tsx
│   │   ├── FilePickerField.tsx
│   │   ├── LessonModal.tsx
│   │   ├── LoginPage.tsx
│   │   ├── MoveSessionModal.tsx
│   │   ├── PaymentFormModal.tsx
│   │   ├── ProfileModal.tsx
│   │   ├── ScheduleFormModal.tsx
│   │   ├── ScheduleSlotsEditor.tsx
│   │   ├── StudentDetailModal.tsx
│   │   ├── StudentFormModal.tsx
│   │   ├── StudentsPage.tsx
│   │   ├── TimeInput.tsx
│   │   └── ui.tsx
│   ├── lib/
│   │   ├── api.ts
│   │   ├── calc.ts
│   │   ├── color.ts
│   │   ├── date.ts
│   │   ├── errors.ts
│   │   ├── profile.ts
│   │   ├── schedule.ts
│   │   ├── supabase.ts
│   │   └── types.ts
│   └── state/
│       └── AppDataContext.tsx
└── supabase/
    ├── migrations/
    │   └── 20261114000100_init.sql
    └── seed/
        └── demo.sql
```

---

## 3. เริ่มต้นใช้งาน

### 3.1 สร้าง Supabase Project

1. เข้า [https://supabase.com/dashboard](https://supabase.com/dashboard) แล้วสร้าง project ใหม่
2. รอจน project พร้อมใช้งาน
3. ไปที่ **SQL Editor → New query**

### 3.2 รัน migration

เปิดไฟล์:

```text
supabase/migrations/20261114000100_init.sql
```

คัดลอกทั้งไฟล์ไปวางใน SQL Editor แล้วกด **Run** ครั้งเดียว

migration นี้จะสร้าง:

- ตาราง `students`, `courses`, `schedule_rules`, `sessions`, `lesson_logs`, `payments`, `attachments`
- primary key, foreign key แบบ composite ที่ผูก `owner_id` ไว้ด้วยกัน
- unique constraint ของบันทึกการสอนหนึ่งนัด และ unique ของ `recurrence_key`
- index ที่จำเป็น
- ฟังก์ชัน `updated_at` และ trigger ป้องกันการลบข้อมูลที่มีประวัติ
- เปิด Row Level Security ทุกตารางพร้อม policies แยก select / insert / update / delete
- storage bucket **private** ชื่อ `course-files` พร้อม policies
- สิทธิ์ฐานข้อมูลให้เฉพาะ role `authenticated` (ไม่ให้ `anon`)

> ถ้าเคยรัน migration บางส่วนแล้ว ให้สร้าง project ใหม่หรือแก้ไขด้วยความระมัดระวัง ไฟล์นี้ถูกออกแบบให้รันครั้งเดียวบน project ใหม่

### 3.3 ตั้งค่าบัญชีและนโยบายการสมัคร

**โหมดที่โปรเจกต์นี้ตั้งใจรองรับ: หนึ่งบัญชี = หนึ่งพื้นที่ข้อมูล**  
Google account ใหม่สามารถสร้างพื้นที่ว่างของตัวเองได้ และจะไม่เห็นข้อมูลของบัญชีอื่น

1. ถ้าจะใช้ email/password ไปที่ **Authentication → Users → Add user**
2. ใส่อีเมลและรหัสผ่านของเจ้าของ
3. เปิด **Auto Confirm User** (หรือยืนยันอีเมลให้เรียบร้อย) เพื่อให้เข้าสู่ระบบได้ทันที
4. ไปที่ **Authentication → Sign In / Providers**
   - เปิด Email provider หากยังต้องการใช้ email/password
   - เปิด **Allow new users to sign up** เพื่อให้ Google account ใหม่สร้างพื้นที่ของตัวเองได้
   - หากต้องการโหมดส่วนตัวบัญชีเดียว ให้ปิดตัวเลือกนี้แทน
5. ปิด **Allow anonymous sign-ins**
6. ไม่มีหน้า Sign up แยกในแอป — Google Login จะสร้างบัญชีใหม่ให้อัตโนมัติเมื่อเปิดรับสมัคร

#### 3.3.1 เปิด Google Login (ไม่บังคับ)

โค้ดแอปมีปุ่ม **ดำเนินการต่อด้วย Google** แล้ว แต่จะใช้ได้หลังตั้งค่า provider และ redirect URL เท่านั้น

**ขั้นที่ 1 — Google Cloud Console**

1. ไปที่ [Google Cloud Console](https://console.cloud.google.com/) แล้วสร้างหรือเลือก project
2. ตั้งค่า **OAuth consent screen** (External) และเพิ่มอีเมลเจ้าของเป็น test user ระหว่างพัฒนา
3. ไปที่ **APIs & Services → Credentials → Create credentials → OAuth client ID**
4. เลือกประเภท **Web application**
5. ใส่ **Authorized JavaScript origins**
   ```text
   http://localhost:5173
   https://<โดเมน Cloudflare Pages ของคุณ>
   ```
6. ใส่ **Authorized redirect URI** ให้ตรงกับ callback ของ Supabase เท่านั้น
   ```text
   https://<project-ref>.supabase.co/auth/v1/callback
   ```
   ไม่ใช่ URL ของหน้าแอป
7. คัดลอก **Client ID** และ **Client Secret**

**ขั้นที่ 2 — Supabase**

1. ไปที่ **Authentication → Sign In / Providers → Google**
2. เปิด provider Google
3. ใส่ Client ID และ Client Secret ที่ได้จาก Google
4. กด Save

**ขั้นที่ 3 — URL Configuration ใน Supabase**

ไปที่ **Authentication → URL Configuration**

ช่วงพัฒนาในเครื่อง:

```text
Site URL:
http://localhost:5173

Redirect URLs:
http://localhost:5173/**
```

หลัง deploy Cloudflare Pages ให้เปลี่ยน Site URL เป็นโดเมนจริง และเพิ่ม:

```text
Redirect URLs:
http://localhost:5173/**
https://<โดเมน Cloudflare Pages ของคุณ>/**
```

ถ้าใช้ custom domain หรือ preview URL ของ Cloudflare Pages ให้เพิ่ม URL เหล่านั้นด้วย

**ขั้นที่ 4 — กำหนดว่าจะให้บัญชี Google เห็นข้อมูลใด**

- **Google account ใหม่ (อีเมลต่างจากเดิม)** จะได้พื้นที่ว่างของตัวเอง และไม่เห็นข้อมูลของบัญชีอื่น
- **Google account ที่ใช้อีเมลเดียวกับบัญชี email/password เดิม** (และอีเมลยืนยันแล้ว) จะถูกเชื่อม identity อัตโนมัติและเห็นข้อมูลเดิม
- ถ้าต้องการให้หลายอีเมลแชร์ข้อมูลชุดเดียวกัน ต้องใช้ manual identity linking หรือระบบ workspace/allowlist ซึ่งแอปนี้ยังไม่ได้เปิดให้ตั้งค่าจากหน้าเว็บ
- เปิด **Allow new users to sign up** สำหรับโหมดหลายบัญชีนี้
- ถ้าต้องการจำกัดเฉพาะบัญชีที่สร้างไว้ ให้ปิด **Allow new users to sign up**

> Client Secret ของ Google เก็บใน Supabase เท่านั้น ห้ามใส่ใน `.env.local` หรือ repository
>
> แอปใช้ PKCE และ `detectSessionInUrl` จึงไม่ต้องเพิ่ม environment variable สำหรับ Google

เอกสารอ้างอิง: [Login with Google](https://supabase.com/docs/guides/auth/social-login/auth-google) และ [Identity Linking](https://supabase.com/docs/guides/auth/auth-identity-linking)

#### 3.3.2 ตั้งชื่อที่แสดง เช่น “อาจารย์หยก”

หลังเข้าสู่ระบบแล้ว:

1. กดที่ชื่อ/อวาตาร์มุมขวาบนของแอป
2. เลือกช่อง **ชื่อที่แสดง**
3. พิมพ์ชื่อที่ต้องการ เช่น `อาจารย์หยก`
4. กด **บันทึกชื่อ**

ถ้ายังไม่เคยตั้งชื่อ ระบบจะแสดง `เจ้าของตารางสอน` และอีเมลบัญชีอยู่ด้านล่าง

ชื่อนี้จะ:

- แสดงบน header และข้อความต้อนรับบน Dashboard แทนอีเมล
- ถูกเก็บใน Supabase Auth ที่ `user_metadata.display_name`
- ติดไปกับบัญชีเดิมเมื่อเปิดเครื่องหรือเบราว์เซอร์อื่น
- ไม่เปลี่ยนอีเมลหรือวิธีเข้าสู่ระบบ

> นี่เป็น “ชื่อที่แสดง” ไม่ใช่ username สำหรับล็อกอิน  
> การเข้าสู่ระบบยังใช้ email/password หรือ Google ตามเดิม  
> ไม่ต้องรัน SQL เพิ่ม เพราะเก็บใน Supabase Auth metadata

### 3.4 ตั้งค่า environment variables

คัดลอกไฟล์:

```powershell
# Windows PowerShell
Copy-Item .env.example .env.local
```

```bash
# macOS / Linux
cp .env.example .env.local
```

หรือสร้างไฟล์ `.env.local` ที่ root โปรเจกต์:

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key_here
```

หาได้จาก **Supabase Dashboard → Project Settings → API**:

- **Project URL**
- **Publishable key** (ถ้า project เก่าใช้ **anon public key** แทนได้)

**ห้ามใส่ใน frontend หรือ repository:**

- `service_role` / secret key
- database password
- รหัสผ่านของเจ้าของ
- JWT secret
- Google OAuth Client Secret (เก็บใน Supabase Provider เท่านั้น)

Frontend ใช้เฉพาะ Project URL และ publishable/anon key เท่านั้น

### 3.5 รันในเครื่อง

ต้องใช้ Node.js 20 ขึ้นไป (แนะนำ Node 20 LTS หรือ 22)

```bash
npm install
npm run dev
```

เปิด `http://localhost:5173` แล้วเข้าสู่ระบบด้วยบัญชีที่สร้างไว้ใน Supabase

### 3.6 ตรวจสอบ build

```bash
npm run typecheck
npm run build
npm run preview
```

ผล build อยู่ที่ `dist/`

---

## 4. Deploy บน Cloudflare Pages

1. push โปรเจกต์ขึ้น Git repository (เช่น GitHub)
2. เข้า Cloudflare Dashboard → **Workers & Pages → Create → Pages → Connect to Git**
3. เลือก repository และตั้งค่า:
   - **Framework preset:** Vite
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
   - **Node version:** 20 หรือ 22 (ตั้ง environment variable `NODE_VERSION=20` หากจำเป็น)
4. เพิ่ม **Environment variables** ทั้ง Production และ Preview:

```text
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key_here
```

5. กด Deploy

ไฟล์ `public/_redirects` มี rule SPA อยู่แล้ว:

```text
/* /index.html 200
```

หลัง deploy ต้องเพิ่ม URL ของ Cloudflare Pages ใน **Supabase → Authentication → URL Configuration** และใน Google OAuth Authorized JavaScript origins ด้วย หากใช้ Google Login (ตามข้อ 3.3.1) มิฉะนั้น OAuth จะ redirect กลับไม่ได้

> **สำคัญ:** environment variables ของ Vite ถูกฝังตอน build ต้องตั้งค่าให้ครบก่อนสั่ง build ทุกครั้ง หากเปลี่ยนค่าให้ redeploy

---

## 5. ระบบสร้างนัดประจำโดยไม่ใช้ cron

แอปนี้ออกแบบให้ทำงานได้โดยไม่มี background worker หรือ cron:

1. ตารางประจำถูกเก็บใน `schedule_rules` โดยมี
   - `weekday` (1 = จันทร์ … 7 = อาทิตย์)
   - `start_time`, `end_time`
   - `effective_from`, `effective_to`
   - `active`
2. ทุกครั้งที่โหลดข้อมูล แอปจะคำนวณนัดที่ยังไม่มีในฐานข้อมูลจาก `schedule_rules`
   - ตั้งแต่ `start_date` ของคอร์ส (ย้อนหลังสูงสุด 60 เดือน) ถึงล่วงหน้า 36 เดือน
   - เฉพาะ rule ที่ `active = true`
3. สร้าง `recurrence_key` คงที่ในรูปแบบ:

```text
<rule_id>:<YYYY-MM-DD>
```

4. บันทึกด้วย unique constraint `(owner_id, recurrence_key)` และ `upsert ... ignoreDuplicates`
   - เปิดปฏิทินซ้ำ กดรีเฟรช หรือเปิดหลายแท็บพร้อมกันจึงไม่เกิดนัดซ้ำ
5. ตัวระบุของแต่ละนัดคือ `sessions.id` (UUID) ซึ่งคงที่ตลอดอายุของนัด
   - การย้ายนัด = update แถวเดิมและเปลี่ยน `status = 'moved'`
   - การยกเลิก = update แถวเดิมและเปลี่ยน `status = 'canceled'`
   - การบันทึกสอน = foreign key ไปยัง `sessions.id` ผ่าน `lesson_logs.session_id`
6. นัดนอกรอบเก็บเป็น session ที่มี `kind = 'extra'`, `rule_id = null` และ
   `recurrence_key = 'extra:<uuid>'`
7. เมื่อแก้ตารางประจำ:
   - ปิด rule เดิม (`active = false`) และกำหนด `effective_to`
   - ลบนัดปกติในอนาคตที่ยังไม่สอน **เฉพาะตั้งแต่ `effective_from` เป็นต้นไป**
   - เก็บนัดที่สอนแล้ว นัดที่เลื่อน และนัดที่ยกเลิกไว้
   - สร้าง rule ใหม่และให้นัดใหม่ถูกสร้างเมื่อโหลดข้อมูลรอบถัดไป
8. ประวัตินัดที่เคยสร้างแล้วจะไม่หาย แม้ rule เดิมจะถูกปิด

ข้อจำกัดที่ตั้งใจ: ระบบสร้างนัดล่วงหน้า 36 เดือน หากเวลาคงเหลือมากกว่าที่ตารางรองรับในช่วงนั้น จะแสดง «ยังประเมินไม่ได้» พร้อมจำนวนเวลาที่ยังต้องนัดเพิ่ม

---

## 6. ความปลอดภัยและ RLS

### ตารางข้อมูล

ทุกตารางมี `owner_id uuid not null default auth.uid()` และเปิด RLS:

- `select` → `using (auth.uid() = owner_id)`
- `insert` → `with check (auth.uid() = owner_id)`
- `update` → ทั้ง `using` และ `with check`
- `delete` → `using (auth.uid() = owner_id)`

foreign key สำคัญใช้ **composite foreign key** ที่มี `owner_id` อยู่ด้วย เช่น:

```text
courses (student_id, owner_id) → students (id, owner_id)
sessions (course_id, owner_id) → courses (id, owner_id)
lesson_logs (session_id, course_id, owner_id) → sessions (id, course_id, owner_id)
```

จึงไม่สามารถอ้างอิงคอร์สของบัญชีอื่นโดยการเดา UUID ได้

บัญชีที่ยังไม่ล็อกอิน:

- ไม่มี policy สำหรับ role `anon`
- ไม่มีสิทธิ์ select/insert/update/delete บนตาราง
- เปิดไฟล์ใน bucket ไม่ได้

### หลายบัญชีแยกข้อมูลกันอย่างไร

- Google account ใหม่แต่ละบัญชีจะได้ `auth.users.id` ของตัวเอง
- แถวข้อมูลทั้งหมดที่บัญชีนั้นสร้างจะมี `owner_id` เป็น UUID ของตัวเอง
- RLS อนุญาตเฉพาะแถวที่ `auth.uid() = owner_id`
- ดังนั้นติวเตอร์แต่ละบัญชีมีนักเรียน ตาราง ไฟล์ และการเงินของตัวเอง โดยไม่เห็นของกัน
- โปรเจกต์นี้ยังไม่มีระบบแชร์ข้อมูลข้ามบัญชี (workspace / invite / allowlist)
- เมื่อเปิด **Allow new users to sign up** ใครก็ตามที่ล็อกอิน Google สำเร็จจะสร้างพื้นที่ส่วนตัวใหม่ได้ ถ้าต้องการจำกัดคน ให้ปิด signup และสร้างเฉพาะบัญชีที่อนุญาต หรือเพิ่มระบบ allowlist ภายหลัง

### Storage

- bucket `course-files` เป็น **private**
- path เริ่มต้นด้วย UUID ของเจ้าของ:

```text
<owner_uuid>/<course_uuid>/<uuid>-<file_name>
```

- มี policies ให้เจ้าของ select / insert / update / delete เฉพาะ path ของตัวเอง
- เปิดไฟล์ด้วย **signed URL อายุ 60 วินาที**
- เก็บ `storage_path` และ `file_name` ในตาราง `attachments`
- ชนิดไฟล์ที่อนุญาต: PDF, PNG, JPG, WEBP, TXT, DOC/DOCX, XLS/XLSX
- ขนาดสูงสุด 20 MB

หลังออกจากระบบ:

- ข้อมูลในฐานข้อมูลถูกปฏิเสธด้วย RLS
- ไม่สามารถสร้าง signed URL ใหม่ได้
- signed URL ที่สร้างไว้ก่อนออกจากระบบจะหมดอายุภายใน 60 วินาที

### การลบข้อมูล

- ฟังก์ชัน trigger ป้องกันการลบคอร์ส/นักเรียน/นัดที่มีประวัติการสอนหรือรายการรับเงิน
- UI จึงซ่อนปุ่มลบถาวรและเสนอ **เก็บเข้าคลัง** แทน
- การเก็บเข้าคลังไม่ลบไฟล์หรือประวัติ และสามารถนำกลับได้

---

## 7. ข้อมูลตัวอย่างสำหรับสาธิต (ไม่บังคับ)

ไฟล์นี้ **แยกจากขั้นตอนติดตั้งจริง**:

```text
supabase/seed/demo.sql
```

วิธีใช้:

1. ต้องรัน migration และสร้างบัญชีเจ้าของก่อน
2. เปิดไฟล์ `supabase/seed/demo.sql`
3. เปลี่ยน `owner@example.com` ให้เป็นอีเมลบัญชีเจ้าของ
4. รันใน SQL Editor

ข้อมูลที่ได้:

- นักเรียน “น้ำตาลนม”
- คอร์สคณิตศาสตร์ 8 ชั่วโมง ราคา 4,000 บาท
- ตารางประจำสัปดาห์
- บันทึกการสอน 2 ชั่วโมง + 1 ชั่วโมง 30 นาที = 43.75%
- รับเงิน 2,000 บาท
- นัดนอกรอบวันนี้

ถ้าไม่ต้องการข้อมูลตัวอย่าง ให้ข้ามหัวข้อนี้ทั้งหมด

---

## 8. สิ่งที่ตรวจแล้วใน environment นี้

ตรวจแล้ว:

- `npm install`
- `npm run typecheck` ผ่าน
- `npm run build` ผ่าน (Vite production build)
- ตรวจ UI responsive ที่ความกว้าง 1440px และ 390px
- ตรวจว่า layout มือถือไม่เกิด horizontal overflow
- รันชุดตรวจสูตรจริงจาก `src/lib/calc.ts` ผ่านทุกกรณี: 8 ชม./4,000 บาท, 2 ชม. + 1 ชม. 30 น. = 43.75%, มูลค่า 1,750 บาท, แก้เป็น 1 ชม. แล้วเหลือ 3 ชม., วันสอนครบจริง, เวลาส่วนเกิน และเพดานราคา
- ตรวจการแสดงหน้า Dashboard, รายชื่อนักเรียน, รายละเอียดนักเรียน/คอร์ส และเปิดฟอร์มเพิ่มนักเรียน/เพิ่มนัดนอกรอบ/บันทึกการสอนด้วยข้อมูลตัวอย่างชั่วคราวในเครื่อง (ไม่ได้ยิง API จริง)
- ตรวจการแสดงเวลา 24 ชั่วโมงในช่องกรอก (ใช้ `TimeInput` แบบบังคับ HH:MM)
- ฟอร์มตั้งตาราง เลื่อน/ยกเลิกนัด การรับเงิน และไฟล์แนบ ตรวจด้วย typecheck และการอ่านโค้ด แต่ยังไม่ได้กดยืนยันกับ Supabase จริง
- เพิ่มโค้ด Google OAuth (PKCE + `detectSessionInUrl`) และตรวจ typecheck/build ผ่านแล้ว
- เพิ่มหน้าต่างแก้ **ชื่อที่แสดง** จากมุมขวาบน เก็บใน Supabase Auth metadata และตรวจ typecheck/build ผ่านแล้ว

**ยังไม่ได้ทดสอบ end-to-end กับ Supabase project จริงใน environment นี้** เนื่องจากไม่มี Project URL, publishable key, บัญชีเจ้าของ และ Google OAuth credentials จริง จึงยังไม่ได้ยืนยัน:

- RLS กับ request จริงของ role `anon` / `authenticated`
- Storage policy และ signed URL กับไฟล์จริง
- การเปิดแอปอีกเบราว์เซอร์แล้วเห็นข้อมูลเดิม
- การเข้าสู่ระบบ/ออกจากระบบด้วย email/password กับบัญชีจริง
- Google OAuth redirect และการเชื่อม identity ของบัญชีเจ้าของ
- การบันทึกชื่อที่แสดงลง `user_metadata.display_name` และการเห็นชื่อเดิมในเบราว์เซอร์อื่น
- การแยกข้อมูลระหว่าง Google account สองบัญชี (บัญชีใหม่ต้องเห็นพื้นที่ว่าง และอ่านข้อมูลของอีกบัญชีไม่ได้)

### Checklist หลังเชื่อม Supabase จริง

1. เข้าสู่ระบบด้วยอีเมล/รหัสผ่านของเจ้าของ
2. ตั้งค่า Google provider ตามข้อ 3.3.1 แล้วออกจากระบบ จากนั้นกด **ดำเนินการต่อด้วย Google** ด้วยอีเมลเดียวกับเจ้าของ ต้องกลับเข้าแอปได้และเห็นข้อมูลเดิม
3. กดชื่อมุมขวาบน ตั้งชื่อที่แสดงเป็น `อาจารย์หยก` แล้วบันทึก จากนั้นรีเฟรชหน้าและเปิดอีกเบราว์เซอร์ ต้องเห็นชื่อเดิม
4. เพิ่มนักเรียน 1 คน พร้อมคอร์ส 8 ชั่วโมง ราคา 4,000 บาท และตารางประจำ 1 ช่วง
5. เปิดปฏิทิน ตรวจว่ามีนัดในอนาคต และรีเฟรชซ้ำแล้วไม่มีนัดซ้ำ
6. เพิ่มนัดนอกรอบ เลือกนักเรียนและคอร์สเดิม
7. กด **บันทึกหลังสอน** 1 ชั่วโมง 30 นาที ตรวจยอดสะสมและชั่วโมงคงเหลือ
8. เปิดแก้ไขบันทึกเป็น 1 ชั่วโมง ตรวจว่ายอดสะสมลดลงและไม่ถูกบวกซ้ำ
9. ทดสอบเลื่อนนัดและยกเลิกนัด แล้วรีเฟรชหน้าจอ
10. อัปโหลดไฟล์แนบ เปิดด้วย signed URL และตรวจว่าลิงก์หมดอายุใน 60 วินาที
11. ออกจากระบบ แล้วลองเข้า URL ตรงของ Supabase REST/Storage ด้วย role `anon` ต้องถูกปฏิเสธ
12. เปิดเบราว์เซอร์อีกตัวหรือหน้าต่างไม่ระบุตัวตน เข้าสู่ระบบด้วยบัญชีเดิม ต้องเห็นข้อมูลเดิม
13. สร้างคอร์สที่มีประวัติการสอน แล้วตรวจว่าปุ่มลบถาวรถูกซ่อน/ถูกปฏิเสธ และใช้ **เก็บเข้าคลัง** ได้
14. ตรวจตารางซ้อนเวลา: นัดต่อกันพอดีต้องผ่าน, นัดซ้อนต้องมีคำเตือน
15. เปิด **Allow new users to sign up** แล้วล็อกอินด้วย Google account ที่สอง (อีเมลต่างกัน) ต้องเห็นพื้นที่ว่าง ไม่เห็นนักเรียนของบัญชีแรก
16. ลองแก้ URL/เรียก REST ด้วย session ของบัญชีที่สองเพื่อขอข้อมูลของบัญชีแรก ต้องถูก RLS ปฏิเสธ

---

## 9. คำสั่งที่ใช้บ่อย

```bash
# ติดตั้ง
npm install

# พัฒนา
npm run dev

# ตรวจ TypeScript
npm run typecheck

# build สำหรับ production
npm run build

# เปิดดู production build ในเครื่อง
npm run preview
```

---

## 10. หมายเหตุการออกแบบ

- ไม่มี React Router — ใช้ hash `#dashboard` / `#students` เพื่อให้ Cloudflare Pages ไม่ต้องตั้งค่า rewrite ซับซ้อน (ยังมี `_redirects` เผื่อไว้)
- ไม่มี chart library หรือ UI library เพื่อให้ bundle เล็กและคุมหน้าตาได้ทั้งหมด
- ใช้ `Intl.DateTimeFormat` กับ `Asia/Bangkok` และคำนวณวันที่จาก date key โดยตรง
- ฟอนต์โหลดจาก Google Fonts (`Noto Sans Thai`, `Mali`) หากไม่โหลดจะ fallback เป็น Tahoma
- วันที่ใน input ของเบราว์เซอร์อาจแสดงตาม locale ของเครื่อง แต่มีข้อความวันที่ภาษาไทยกำกับใต้ช่องวันที่เสมอ
- ข้อมูลทุกอย่างถูกโหลดใหม่จาก Supabase หลังบันทึก เพื่อให้ยอดสะสมและสถานะตรงกันทุกหน้า
