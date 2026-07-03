# HoraSard — Master Index / Architecture Map



สารบัญกลางของโปรเจกต์ (อัปเดต: `be/m2-close`, ก.ค. 2026)



## ภาพรวมสถาปัตยกรรม



```

UI (src/app, src/components)  →  เรียก API เท่านั้น ไม่มี business logic

API (src/app/api/*)           →  validate (Zod) + authorize (rbac) + handle()

Service (src/server/*)        →  business logic ทั้งหมด

DB (prisma/)                  →  PostgreSQL + Prisma 6 (Supabase pooler บน Vercel)

```



**กฎเหล็ก:** ห้ามเรียก AI จาก browser · API key อยู่ใน env เท่านั้น · หักเครดิตหลัง AI สำเร็จ + `Idempotency-Key`



**เอกสารอ้างอิง:** `README.md` · `PROJECT_STRUCTURE.md` · `BACKEND_TASKS.md` · `FRONTEND_TASKS.md`



## Milestone ปัจจุบัน



| Milestone | สถานะรวม |

|-----------|----------|

| **M2** — Schema chat, Auth, Birth profile, Admin CMS พื้นฐาน | ✅ ปิดงานบน `be/m2-close` (รอ PR merge) |

| **M3** — แชท AI จริง, message-service, ประวัติเธรด | 🚧 เริ่มแล้วบางส่วน (ดูด้านล่าง) |

| **M4** — Payment, Dashboard, Deploy | ⏳ ยังไม่เริ่ม |



**Feature gating:** `src/config/features.ts` — ตั้ง `NEXT_PUBLIC_APP_PHASE=2` บน Vercel จะปิด AI chat + Admin AI CMS; dev ไม่ตั้ง = เปิดทั้งหมด



---



## โมดูล Backend



| โมดูล | สถานะ | บันทึก | โค้ดหลัก |

| ----- | ----- | ------ | -------- |

| Chat schema (Conversation/Message, BirthProfile fields) | ✅ M2 | [backend_chat_schema.md](./backend_chat_schema.md) | `prisma/schema.prisma`, `prisma/migrations/*` |

| Birth profile API (พ.ศ.→ค.ศ., editCount≤1) | ✅ M2 | [backend_birth_profile.md](./backend_birth_profile.md) | `src/server/user/birth-profile-service.ts`, `src/app/api/me/birth-profile` |

| Thailand geo API | ✅ M2 | [backend_geo_api.md](./backend_geo_api.md) | `src/data/thailand-geo.ts`, `src/app/api/geo/thailand` |

| Google auth + auto-create user | ✅ M2 | [backend_google_auth.md](./backend_google_auth.md) | `src/server/auth/provisioning.ts`, `src/auth.ts` |
| Register + password reset (หน้า login เดียว) | ✅ | [backend_auth_register_reset.md](./backend_auth_register_reset.md) | `sign-in-form.tsx`, `/api/auth/*` |

| User API (`/api/me`, package, credits) | ✅ M2 | [backend_me_api.md](./backend_me_api.md) | `src/server/user/account-service.ts`, `src/app/api/me/*` |

| Admin API (users, categories, packages) | ✅ M2 | [backend_admin_api.md](./backend_admin_api.md) | `src/server/admin/user-admin-service.ts`, `catalog-admin-service.ts` |

| Admin AI CMS (prompts, models, knowledge) | 🚧 M3 บางส่วน | [backend_ai_admin.md](./backend_ai_admin.md) | `src/server/admin/ai-admin-service.ts`, `src/app/api/admin/{prompts,ai-configs,knowledge}` |

| AI engine (Gemini/OpenAI, readings) | 🚧 M3 บางส่วน | [backend_ai_engine.md](./backend_ai_engine.md) | `src/server/ai/*`, `src/server/horoscope/reading-service.ts`, `POST /api/horoscope/readings` |



## โมดูล Frontend



| โมดูล | สถานะ | บันทึก | โค้ดหลัก |

| ----- | ----- | ------ | -------- |

| App UI (mockups, chat, birth form, admin) | ✅ M2 UI | [frontend_app_ui.md](./frontend_app_ui.md) | `src/components/app/*`, `src/components/birth/*`, `src/components/admin/*` |

| จังหวัด/อำเภอ (dropdown) | ✅ API + shim | [backend_geo_api.md](./backend_geo_api.md) | `GET /api/geo/thailand`, `src/lib/th-geo.ts` |



---



## API ที่มีบน main (สรุป)



**Auth:** `POST /api/auth/register` · `POST /api/auth/check-email` · `POST /api/auth/forgot-password` · `POST /api/auth/reset-password` · NextAuth `[...nextauth]`



**User:** `GET /api/me` · `GET /api/me/package` · `GET /api/me/credits` · `GET|PUT /api/me/birth-profile`



**Horoscope:** `GET /api/horoscope/categories` · `POST /api/horoscope/readings` *(gated `FEATURES.aiChat`)*



**Public:** `GET /api/packages` · `GET /api/geo/thailand`



**Admin M2:** `/api/admin/users/*` · `/api/admin/categories/*` · `/api/admin/packages/*`



**Admin M3:** `/api/admin/prompts/*` · `/api/admin/ai-configs/*` (+ `POST .../test`) · `/api/admin/knowledge/*` *(gated `FEATURES.aiAdmin`)*



**ยังไม่มี:** `/api/conversations/*` · `GET /api/admin/ai-usage` · payment/dashboard (M3/M4)



---



## รอ PM ยืนยัน



- ดวงจร (transit) อยู่ Phase 1 ไหม — enum `TRANSIT` มีใน schema แต่ยังไม่ทำ auto-คำนวณ
- ~~Sign-in อีเมล~~ → **ตัดสินใจแล้ว:** อีเมล+รหัสผ่าน สมัครตรง เก็บ DB (ไม่ใช้ magic-link)

- แหล่งข้อมูลจังหวัด/อำเภอเต็ม — อำเภอยังชุดย่อใน `thailand-geo.ts`

- Free/Pro quota, ราคา, Pro หมดอายุรายเดือนหรือไม่



## งานค้างข้าม milestone



- [x] Unit tests พื้นฐาน M2 (`npm run test` — `tests/date.test.ts`, `tests/birth-profile-rules.test.ts`)

- [x] Migration สำหรับ `KnowledgeDoc` (`20260703100000_knowledge_docs`)

- [ ] รัน `db:migrate` + `db:seed` บน Supabase (ต้องมี `DIRECT_URL` ใน `.env`)

- [ ] Refactor `reading-service` → `message-service` + `/api/conversations/*`

- [ ] `suggestedQuestions` ใน `GET /api/horoscope/categories`

- [ ] นโยบายความเป็นส่วนตัว/เงื่อนไข (M4)
- [ ] **เชื่อมส่งอีเมลจริง** (password reset) — ตอนนี้ dev fallback เท่านั้น ดู [backend_auth_register_reset.md](./backend_auth_register_reset.md)

