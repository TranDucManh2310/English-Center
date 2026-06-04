# English Center — Hệ thống quản lý trung tâm tiếng Anh

Ứng dụng web full-stack quản lý trung tâm luyện thi THPTQG: học viên, giáo viên, khóa học, tài chính, nội dung bài giảng, và trợ lý AI.

---

## Mục lục

1. [Kiến trúc hệ thống](#1-kiến-trúc-hệ-thống)
2. [Luồng dữ liệu (Dataflow)](#2-luồng-dữ-liệu-dataflow)
3. [Workflow theo role](#3-workflow-theo-role)
4. [Cài đặt nhanh với Docker](#4-cài-đặt-nhanh-với-docker-khuyến-nghị)
5. [Cài đặt thủ công](#5-cài-đặt-thủ-công)
6. [Biến môi trường](#6-biến-môi-trường)
7. [Quản lý Database](#7-quản-lý-database)
8. [Tính năng AI](#8-tính-năng-ai)
9. [Cấu trúc thư mục](#9-cấu-trúc-thư-mục)

---

## 1. Kiến trúc hệ thống

```
┌─────────────────────────────────────────────────────────────┐
│                        BROWSER                              │
│                                                             │
│  ┌──────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ Public   │  │  Dashboard   │  │   Admin Panel        │  │
│  │ Pages    │  │  (Student /  │  │   (SPA - admin.html) │  │
│  │ (HTML)   │  │   Teacher)   │  │                      │  │
│  └────┬─────┘  └──────┬───────┘  └──────────┬───────────┘  │
└───────┼───────────────┼─────────────────────┼──────────────┘
        │  HTTP/Fetch   │                     │
        ▼               ▼                     ▼
┌───────────────────────────────────────────────────────────┐
│                  Node.js HTTP Server (port 3000)          │
│                                                           │
│  ┌─────────────────┐    ┌──────────────────────────────┐  │
│  │  Static Server  │    │        REST API              │  │
│  │  /frontend/**   │    │  /api/*  (router.js)         │  │
│  └─────────────────┘    └──────────────┬───────────────┘  │
│                                        │                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Services: UserService · SessionService · AIService  │  │
│  └──────────────────────────┬───────────────────────────┘  │
│                             │                              │
│  ┌──────────────────────────┴───────────────────────────┐  │
│  │              db.js  (mysql2/promise pool)             │  │
│  └──────────────────────────┬───────────────────────────┘  │
└───────────────────────────────────────────────────────────┘
                              │
                              ▼
              ┌───────────────────────────┐
              │      MySQL 8 Database     │
              │   (english_center DB)     │
              └───────────────────────────┘
                              │
              ┌───────────────┘
              ▼
     ┌─────────────────────┐
     │  DeepSeek / AI API  │
     │  (OpenAI-compatible)│
     └─────────────────────┘
```

**Thành phần chính:**

| Thành phần | Công nghệ | 
|-----------|-----------|
| Frontend | Vanilla JS + Bootstrap 5 |
| Backend | Node.js 20 |
| Database | MySQL 8 | 
| AI | OpenAI-compatible API |
| Real-time | WebSocket (tự viết) | 

---

## 2. Luồng dữ liệu (Dataflow)

### Xác thực (Authentication)
```
Browser                    Backend                    DB
  │                           │                       │
  ├── POST /api/auth/login ──►│                       │
  │                           ├── findUserByEmail ───►│
  │                           │◄── user row ──────────┤
  │                           ├── verifyPassword()    │
  │                           ├── createSession() ───►│
  │◄── { token, user } ───────┤                       │
  │                           │                       │
  ├── [Mọi request sau]       │                       │
  │   Authorization: Bearer   │                       │
  │   <token> ───────────────►│                       │
  │                           ├── findSessionUser() ──►│
  │                           │◄── user ──────────────┤
```

### Luồng AI Chat
```
Browser          Backend               AI Provider
  │                 │                      │
  ├─ POST /api/chat─►│                      │
  │  { messages }   ├─ listCourses() ──►DB  │
  │                 │◄── course list        │
  │                 ├─ buildSystemPrompt()  │
  │                 ├─ callDeepSeek() ─────►│
  │                 │◄── reply ─────────────┤
  │                 ├─ createSubmission()─►DB│
  │◄── { content } ─┤                      │
```

### Luồng duyệt bài giảng có AI
```
Teacher          Admin UI           Backend              AI
  │                 │                  │                  │
  ├─ Nộp bài ──────►│                  │                  │
  │  (material)     ├─ PATCH status ──►│                  │
  │                 │                  ├── updateDB()     │
  │                 │                  │                  │
  │           [Admin review]           │                  │
  │                 ├─ AI phân tích ──►│                  │
  │                 │  POST            ├─ callDeepSeek() ►│
  │                 │  /api/ai/review  │◄── JSON review ──┤
  │                 │◄── review ───────┤                  │
  │                 │  {recommend,     │                  │
  │                 │   score, note}   │                  │
  │                 │                  │                  │
  │                 ├─ Duyệt/Từ chối ─►│                  │
  │◄── Thông báo ───┤  PATCH + note    ├── notify() ─────►│
```

---

## 3. Workflow theo role

### Admin
1. Đăng nhập → Dashboard tổng quan (KPI từ DB)
2. **Quản lý học viên/giáo viên**: CRUD, theo dõi tiến độ
3. **Duyệt nội dung**: Bài giảng, đề thi, tài liệu — có nút "🤖 AI phân tích"
4. **Tài chính**: Doanh thu, học phí, coupon
5. **Thông báo**: Gửi thông báo hàng loạt
6. **Báo cáo**: Export CSV

### Teacher (Giáo viên)
1. Đăng nhập → Dashboard giáo viên
2. Xem danh sách lớp, học viên
3. Nộp bài giảng/đề thi (chờ admin duyệt)
4. Chấm điểm bài nộp, trả lời hỏi đáp
5. Dùng AI soạn giáo án

### Student (Học viên)
1. Đăng ký tài khoản → Chọn khóa học
2. Dashboard: Xem tiến độ, bài tập, thông báo
3. Nộp bài, làm đề thi thử
4. Hỏi đáp, flashcard, bảng xếp hạng
5. Chat với trợ lý AI

---

## 4. Cài đặt nhanh với Docker (Khuyến nghị)

### Yêu cầu
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Windows/Mac/Linux)
- Git

### Các bước

```bash
# 1. Clone repository
git clone <repo-url>
cd "English Center"

# 2. Tạo file .env cho Docker (copy từ backend/.env và chỉnh sửa)
# Tạo file .env ở thư mục hiện tại (cùng cấp docker-compose.yml):
cat backend/.env   # xem các biến cần thiết

# 3. Tạo file .env với thông tin thực tế
# Ví dụ (Windows PowerShell):
@"
DB_PASSWORD=your_db_password
DB_NAME=english_center
DEEPSEEK_API_KEY=your_api_key_here
DEEPSEEK_MODEL=deepseek-chat
DEEPSEEK_API_URL=https://api.deepseek.com/v1/chat/completions
PORT=3000
"@ | Out-File -Encoding utf8 .env

# 4. Build và chạy
docker compose up --build

# 5. (Lần đầu) Seed dữ liệu mẫu
docker compose exec app node seed.js
```

Truy cập: **http://localhost:3000**

### Tắt / Khởi động lại
```bash
docker compose down          # dừng (giữ data)
docker compose down -v       # dừng + xóa database
docker compose up -d         # chạy nền
docker compose logs -f app   # xem log
```

---

## 5. Cài đặt thủ công

### Yêu cầu
- **Node.js** ≥ 18 ([nodejs.org](https://nodejs.org))
- **MySQL** 8.0 ([dev.mysql.com](https://dev.mysql.com/downloads/))
- Git

### Các bước

```bash
# 1. Clone repository
git clone <repo-url>
cd "English Center"

# 2. Cài dependencies
cd backend
npm install

# 3. Tạo database MySQL
mysql -u root -p -e "CREATE DATABASE english_center CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# 4. Cấu hình môi trường
# Mở backend/.env và điền thông tin:
#   DB_HOST, DB_USER, DB_PASSWORD, DB_NAME
#   DEEPSEEK_API_KEY, DEEPSEEK_MODEL, DEEPSEEK_API_URL

# 5. Tạo bảng và migrate
node setup-db.js      # tạo bảng từ database.sql
node migrate-db.js    # áp dụng migrations

# 6. (Tuỳ chọn) Seed dữ liệu mẫu
node seed.js

# 7. Khởi động server
node server.js
# Hoặc:
npm start
```

Truy cập: **http://localhost:3000**

### Tài khoản mặc định (sau khi seed)
| Role | Email | Mật khẩu |
|------|-------|---------|
| Admin | admin@english-center.vn | admin123 |
| Giáo viên | teacher@english-center.vn | teacher123 |
| Học viên | student@english-center.vn | student123 |

---

## 6. Biến môi trường

Tất cả biến được đặt trong `backend/.env`:

```env
# ── AI ────────────────────────────────────────────────────────
AI_API_KEY=             # API key (OpenAI: sk-..., DeepSeek: tp-...)
AI_MODEL=gpt-4o-mini    # Tên model: gpt-4o, gpt-4o-mini, deepseek-chat...
AI_API_URL=https://api.openai.com/v1/chat/completions
                        # DeepSeek: https://api.deepseek.com/v1/chat/completions

# ── Database ──────────────────────────────────────────────────
DB_HOST=127.0.0.1       # Host MySQL (Docker: tự override thành "db")
DB_PORT=3306
DB_USER=root
DB_PASSWORD=            # Mật khẩu MySQL
DB_NAME=english_center  # Tên database

# ── Server ────────────────────────────────────────────────────
PORT=3000               # Cổng HTTP server
```

> **Lưu ý Docker**: `DB_HOST` tự động được override thành `db` (tên service trong docker-compose). Không cần sửa thủ công.

---

## 7. Quản lý Database

```bash
# Tạo bảng lần đầu
node setup-db.js

# Áp dụng migrations (thêm cột mới, v.v.)
node migrate-db.js

# Seed dữ liệu mẫu (học viên, giáo viên, khóa học demo)
node seed.js

# Xóa sạch toàn bộ data (giữ cấu trúc bảng)
node empty-db.js
```

**Docker:**
```bash
docker compose exec app node seed.js
docker compose exec app node migrate-db.js
```

---

## 8. Tính năng AI

Hệ thống dùng **bất kỳ API nào tương thích OpenAI format** (DeepSeek, GPT-4o, Gemini, Mimo, v.v.).

### Các tính năng AI hiện có

| Tính năng | Endpoint | Mô tả |
|-----------|----------|-------|
| Chatbot trợ lý | `POST /api/chat` | Chat hỏi đáp về khóa học, lịch học, đăng ký — hiển thị trên mọi trang |
| AI soạn giáo án | Dashboard giáo viên | Giáo viên nhập chủ đề → AI tạo giáo án |
| AI duyệt bài giảng | `POST /api/ai/review-material` | Admin nhấn "AI phân tích" → nhận recommendation + điểm chất lượng |

### Cấu hình AI provider

Hỗ trợ **DeepSeek, OpenAI, Mimo, OpenRouter** hoặc bất kỳ provider nào dùng định dạng:

```
POST {DEEPSEEK_API_URL}
Authorization: Bearer {DEEPSEEK_API_KEY}
Body: { model, messages: [{role, content}], max_tokens, temperature }
```

---

## 9. Cấu trúc thư mục

```
English Center/
├── backend/                    # Node.js API server
│   ├── server.js               # Entry point, HTTP + WebSocket
│   ├── db.js                   # MySQL connection pool + queries
│   ├── database.sql            # Schema đầy đủ
│   ├── migrate-db.js           # Migration runner
│   ├── setup-db.js             # Tạo bảng từ schema
│   ├── seed.js                 # Dữ liệu mẫu
│   ├── .env                    # Biến môi trường (KHÔNG commit)
│   └── src/
│       ├── api/router.js       # Tất cả REST endpoints
│       ├── config/app.js       # Cấu hình server
│       ├── http/               # Request parser, response helpers
│       ├── realtime/           # WebSocket gateway (online users)
│       ├── repositories/       # DB facade (re-export db.js)
│       └── services/
│           ├── assistant-service.js  # AI/DeepSeek integration
│           ├── user-service.js       # Auth, password hashing
│           └── session-service.js   # JWT-like session
│
├── frontend/                   # Static files (served by backend)
│   ├── index.html              # Trang chủ
│   ├── admin.html              # Admin SPA (hash routing)
│   ├── dashboard_giaovien.html # Dashboard giáo viên
│   ├── dashboard_hocsinh_new.html  # Dashboard học viên
│   ├── dangnhap.html           # Đăng nhập
│   ├── dangky.html             # Đăng ký
│   └── assets/
│       ├── css/                # Stylesheets
│       └── js/app/
│           ├── core/
│           │   ├── auth.js           # Authentication client
│           │   ├── site-integration.js  # Shared logic + AI chatbot widget
│           │   └── api-client.js     # Fetch wrapper
│           ├── features/
│           │   ├── admin/            # Admin modules (core, courses, finance…)
│           │   ├── teacher/          # Teacher dashboard
│           │   └── student/          # Student dashboard
│           └── template/             # UI behavior (nav, collapse…)
│
├── Dockerfile                  # Build image Node.js app
├── docker-compose.yml          # Orchestrate app + MySQL
├── .dockerignore
└── README.md                   # File này
```

---

## API Endpoints chính

| Method | Path | Auth | Mô tả |
|--------|------|------|-------|
| POST | `/api/auth/login` | — | Đăng nhập |
| POST | `/api/auth/register` | — | Đăng ký |
| GET | `/api/auth/me` | ✓ | Thông tin user hiện tại |
| POST | `/api/auth/logout` | ✓ | Đăng xuất |
| GET | `/api/courses` | — | Danh sách khóa học |
| GET | `/api/users` | Admin | Danh sách user |
| GET | `/api/dashboard/admin` | Admin | Thống kê tổng quan |
| GET | `/api/enrollments` | ✓ | Ghi danh |
| GET | `/api/notifications` | ✓ | Thông báo |
| GET | `/api/questions` | ✓ | Hỏi đáp |
| GET | `/api/material-requests` | ✓ | Bài giảng |
| POST | `/api/chat` | — | AI chatbot |
| POST | `/api/ai/review-material` | Admin | AI duyệt bài giảng |

---

*Built with Node.js · MySQL 8 · Bootstrap 5 · DeepSeek AI*
