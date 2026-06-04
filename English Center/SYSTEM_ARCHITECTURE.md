# English Center - System Architecture

Tai lieu nay mo ta kien truc he thong cua web English Center theo huong product, dua tren code hien tai va mo rong de trien khai production.

## 1. Tong quan kien truc

```mermaid
flowchart TB
  User[User: Admin / Teacher / Student]
  Browser[User Browser]
  CDN[CDN / Static Cache\nHTML, CSS, JS, images]
  LB[Reverse Proxy / Load Balancer\nNginx / IIS / Cloudflare Tunnel]
  App1[Node.js App Instance 1\nHTTP Server + REST API]
  App2[Node.js App Instance 2\nOptional scale-out]
  DB[(MySQL Database\nEnglishCenterDB)]
  Backup[Backup Storage\nDaily DB dump]
  Mail[Email / SMTP Service\nGmail, Outlook, Mail service]
  AI[AI Assistant Service\nExternal provider]
  FileStore[File / Media Storage\nDrive, S3, local uploads]

  User --> Browser
  Browser -->|Static resources| CDN
  Browser -->|HTTP/HTTPS API| LB
  CDN --> Browser
  LB --> App1
  LB --> App2
  App1 --> DB
  App2 --> DB
  DB --> Backup
  App1 --> Mail
  App2 --> Mail
  App1 --> AI
  App2 --> AI
  App1 --> FileStore
  App2 --> FileStore
```

## 2. Kien truc hien tai trong source code

```mermaid
flowchart LR
  FE[Frontend static pages\nHTML + CSS + JS]
  API[Backend Node.js\nserver.js + src layers]
  DB[(MySQL\nmysql2)]

  FE -->|fetch /api/*| API
  API -->|SQL queries| DB

  subgraph Frontend
    Public[index, khoahoc, dangnhap, dangky]
    Admin[admin.html + admin ops modules]
    Teacher[dashboard_giaovien.html + teacher-dashboard.js]
    Student[dashboard_hocsinh_new.html + student-dashboard.js]
    Core[assets/js/app/core\nAPI client + auth + integration]
    Template[assets/js/app/template\nUI template behavior only]
    Features[assets/js/app/features\nadmin / teacher / student]
  end

  Public --> Core
  Admin --> Core
  Teacher --> Core
  Student --> Core
  Admin --> Features
  Teacher --> Features
  Student --> Features
  Public --> Template
  Admin --> Template
  Teacher --> Template
  Student --> Template

  subgraph Backend
    Entry[server.js\nHTTP/WS bootstrap]
    Router[src/api/router.js\nREST routing + auth guard]
    Services[src/services\nbusiness helpers]
    Repositories[src/repositories\nDB access facade]
    Data[db.js\nMySQL query + domain data access]
  end

  Entry --> Router
  Router --> Services
  Router --> Repositories
  Services --> Repositories
  Repositories --> Data
```

## 3. Thanh phan chinh

| Layer | Thanh phan | Vai tro |
| --- | --- | --- |
| Client | Browser | Nguoi dung truy cap web, dashboard, form dang nhap/dang ky |
| Static frontend | `frontend/*.html`, `frontend/assets/js/*.js` | Giao dien public, admin, giao vien, hoc sinh |
| Frontend core | `frontend/assets/js/app/core/*` | API client, auth/session, API-only guards, site integration |
| Frontend features | `frontend/assets/js/app/features/*` | Logic rieng theo role admin/giao vien/hoc sinh |
| Frontend template | `frontend/assets/js/app/template/*` | Hanh vi UI/UX cua template, khong chua data demo |
| Web server | `backend/server.js` | Entry point mong: nhan HTTP/WS, dieu huong sang static/API/realtime |
| API routing | `backend/src/api/router.js` | REST API, phan quyen, validate request va goi service/repository |
| HTTP/static | `backend/src/http/*` | Parse body, JSON response, serve static frontend |
| Services | `backend/src/services/*` | Xu ly nghiep vu dung chung: user/password, session, assistant service |
| Realtime | `backend/src/realtime/online-gateway.js` | WebSocket online presence cho admin |
| Repository facade | `backend/src/repositories/index.js` | Cong truy cap data layer cho API/service |
| Data access | `backend/db.js` | Query MySQL va mapping du lieu domain |
| Database | `backend/database.sql` | Schema users, courses, enrollments, lessons, exams, material requests |
| Migration | `backend/migrate-db.js` | Cap nhat DB cu khi them cot/bang moi |
| Seed/setup | `setup-db.js`, `seed.js` | Tao DB va du lieu khoi tao |

## 3.1. Backend layered architecture

```mermaid
flowchart TB
  Browser[Browser / Frontend JS]
  Server[server.js\nNode HTTP server]
  Static[src/http/static-server.js]
  Router[src/api/router.js]
  Services[src/services/*]
  Repo[src/repositories/index.js]
  DBAccess[db.js\nSQL + mapping]
  MySQL[(MySQL)]
  Realtime[src/realtime/online-gateway.js]
  Assistant[External assistant API]

  Browser -->|GET static| Server
  Browser -->|fetch /api/*| Server
  Browser -->|WebSocket /ws/online| Server
  Server --> Static
  Server --> Router
  Server --> Realtime
  Router --> Services
  Router --> Repo
  Services --> Repo
  Repo --> DBAccess
  DBAccess --> MySQL
  Services --> Assistant
  Realtime --> Repo
```

Quy uoc khi them chuc nang moi:

1. `server.js` chi bootstrap, khong viet logic nghiep vu moi tai day.
2. Endpoint moi dat trong `src/api/router.js` hoac tach controller rieng neu module lon.
3. Logic dung chung dat trong `src/services`.
4. Moi truy van database di qua `src/repositories` va `db.js`.
5. Frontend chi goi `/api/*`, khong render bang demo khi API chua tra ve du lieu.

## 3.2. Frontend layered architecture

```mermaid
flowchart TB
  Pages[HTML pages\npublic + admin + teacher + student]
  Template[assets/js/app/template\nUI/UX template behavior]
  Core[assets/js/app/core\nAPI client + auth + integration]
  Features[assets/js/app/features\nrole modules]
  API[/Backend REST API/]

  Pages --> Template
  Pages --> Core
  Pages --> Features
  Features --> Core
  Core --> API
```

Quy uoc frontend:

1. `template/` chi dieu khien UI/UX giong mau: sidebar, collapse, animation, chart helper.
2. `core/api-client.js` la cua ngo duy nhat de goi `/api/*`.
3. `features/admin`, `features/teacher`, `features/student` chi render du lieu that tu API.
4. Template/demo cu khong duoc dashboard product load thi xoa, khong giu fallback demo trong product.

## 4. Role va phan quyen

```mermaid
flowchart TD
  Admin[Admin]
  Teacher[Teacher]
  Student[Student]

  Admin --> ManageUsers[Quan ly giao vien, hoc sinh, admin]
  Admin --> ManageCourses[Quan ly khoa hoc, lop hoc]
  Admin --> ApproveContent[Duyet bai giang, tai lieu, de thi]
  Admin --> Finance[Theo doi hoc phi, doanh thu]

  Teacher --> ManageOwnClasses[Quan ly lop/khoa duoc phan cong]
  Teacher --> UploadLessons[Tao bai giang, video, tai lieu]
  Teacher --> Grade[Cham bai, tra loi cau hoi]
  Teacher --> Schedule[Len lich hoc, diem danh]

  Student --> Enroll[Dang ky khoa hoc]
  Student --> Study[Xem bai giang da duyet]
  Student --> Exam[Lam bai, xem ket qua]
  Student --> AskQuestion[Hoi dap giao vien]
```

## 5. Luong bai giang: Teacher upload -> Admin approve -> Student view

```mermaid
sequenceDiagram
  participant T as Teacher Dashboard
  participant API as Node.js API
  participant DB as MySQL
  participant A as Admin Dashboard
  participant S as Student Dashboard

  T->>API: POST /api/material-requests
  Note over T,API: title, courseId, description, videoUrl, documentUrl, status=submitted
  API->>DB: INSERT teaching_material_requests
  DB-->>API: request pending/submitted
  API-->>T: Created

  A->>API: GET /api/material-requests
  API->>DB: SELECT submitted requests
  DB-->>API: list
  API-->>A: Requests waiting for approval

  A->>API: PATCH /api/material-requests/:id
  Note over A,API: status=approved or rejected, adminNote
  API->>DB: UPDATE teaching_material_requests
  API->>DB: INSERT notification for teacher
  API-->>A: Updated

  S->>API: GET /api/dashboard/student
  API->>DB: SELECT approved materials for enrolled courses
  DB-->>API: approved videos/documents
  API-->>S: materials[]
  S->>S: Render Xem video / Mo tai lieu
```

## 6. API groups

| API | Vai tro |
| --- | --- |
| `/api/auth/login`, `/api/auth/register`, `/api/auth/me`, `/api/auth/logout` | Dang nhap, dang ky, session |
| `/api/users` | Quan ly hoc sinh/giao vien/admin |
| `/api/courses` | Quan ly khoa hoc/lop hoc |
| `/api/enrollments` | Ghi danh hoc sinh vao khoa hoc |
| `/api/class-sessions` | Lich hoc, phong hoc, diem danh |
| `/api/material-requests` | Teacher gui bai giang/tai lieu, admin duyet, student xem noi dung approved |
| `/api/exams`, `/api/exam-results` | De thi, bai nop, cham diem |
| `/api/questions` | Hoi dap hoc sinh - giao vien |
| `/api/notifications` | Thong bao trong dashboard |
| `/api/chat` | Tro ly ao / AI service adapter |

## 7. Database core entities

```mermaid
erDiagram
  USERS ||--o{ SESSIONS : has
  USERS ||--o{ ENROLLMENTS : enrolls
  COURSES ||--o{ ENROLLMENTS : contains
  USERS ||--o{ COURSES : teaches
  COURSES ||--o{ CLASS_SESSIONS : schedules
  CLASS_SESSIONS ||--o{ ATTENDANCE : tracks
  COURSES ||--o{ LESSONS : contains
  LESSONS ||--o{ LESSON_PROGRESS : tracks
  COURSES ||--o{ TEACHING_MATERIAL_REQUESTS : receives
  USERS ||--o{ TEACHING_MATERIAL_REQUESTS : submits
  COURSES ||--o{ EXAMS : contains
  EXAMS ||--o{ EXAM_RESULTS : receives
  USERS ||--o{ QUESTIONS : asks
  USERS ||--o{ NOTIFICATIONS : receives
```

## 8. Production deployment de xuat

```mermaid
flowchart TB
  DNS[Domain DNS]
  CF[Cloudflare\nTLS, cache, DDoS protection]
  Nginx[Nginx Reverse Proxy\nHTTPS, gzip, static cache]
  PM2[PM2 / Node Cluster\n2+ app processes]
  Node[Node.js English Center API]
  MySQL[(MySQL 8)]
  Backup[Automated Backup\nDaily SQL dump]
  Logs[Log files / Monitoring]

  DNS --> CF
  CF --> Nginx
  Nginx --> PM2
  PM2 --> Node
  Node --> MySQL
  MySQL --> Backup
  Node --> Logs
```

### Production notes

- Dat sau Nginx/Cloudflare de co HTTPS, cache static, gzip va rate limit.
- Chay Node bang PM2 hoac Windows Service de app tu restart khi loi.
- Tach `.env` cho DB password, session secret, API keys.
- Backup MySQL hang ngay va giu it nhat 7 ban gan nhat.
- Neu upload file that, nen dung S3/Cloudinary/Google Drive thay vi luu truc tiep vao repo.
- Neu co AI assistant, backend chi nen giu adapter `/api/chat`; API key khong dua ra frontend.

## 9. Data flow theo chuc nang product

### Admin quan ly he thong

1. Admin dang nhap.
2. Dashboard goi `/api/dashboard/admin`, `/api/users`, `/api/courses`, `/api/enrollments`.
3. Admin tao/sua khoa hoc, gan giao vien, quan ly hoc sinh.
4. Admin duyet material request tu giao vien.

### Giao vien tao noi dung

1. Giao vien dang nhap vao dashboard.
2. He thong chi load khoa hoc/lop hoc cua giao vien do.
3. Giao vien tao bai giang, nhap link video/tai lieu, gui duyet.
4. Trang thai bai giang: `pending`, `submitted`, `approved`, `rejected`.

### Hoc sinh hoc bai

1. Hoc sinh dang ky/dang nhap.
2. Hoc sinh ghi danh vao khoa hoc.
3. Dashboard hoc sinh goi `/api/dashboard/student`.
4. API chi tra bai giang/tai lieu `approved` thuoc khoa hoc hoc sinh da ghi danh.
5. Hoc sinh xem video, mo tai lieu, lam de thi va xem tien do.

## 10. Huong nang cap tiep theo

- Them file upload that: multipart upload -> storage -> save URL vao `teaching_material_requests`.
- Them table `lesson_contents` neu muon bien material approved thanh lesson chinh thuc.
- Them audit log cho admin action: ai duyet, duyet luc nao, ly do tu choi.
- Them RBAC middleware ro hon cho tung API.
- Them health check `/api/health` cho load balancer.
- Them monitoring: request logs, slow query logs, error alert.
