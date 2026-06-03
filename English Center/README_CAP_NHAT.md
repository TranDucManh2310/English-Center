#  README Cập Nhật — Bổ Sung 4 Module (trừ AI)

Tài liệu này mô tả các **sửa đổi & bổ sung** được thêm vào hệ thống English Center.
Bốn module trước đây còn thiếu / chưa hoàn chỉnh nay đã được code đầy đủ (backend + frontend),
**không bao gồm** phần tích hợp AI thật (Speaking/Chatbot).

> Ngày cập nhật: 2026-06-03 · Trạng thái: Hoàn thành · Đã qua kiểm tra cú pháp.

---

## Tổng quan các module đã bổ sung

| # | Module | Trước đây | Sau khi sửa |
|---|--------|-----------|-------------|
| 1 | **Hỏi-Đáp Giáo viên (Q&A)** | Chỉ có giao diện, không có API → luôn trống | HS đặt câu hỏi, GV trả lời, có thông báo 2 chiều |
| 2 | **Đánh dấu đã đọc thông báo** | Chỉ có GET/POST, không đánh dấu được | PATCH từng cái + "đọc tất cả", đếm chưa đọc |
| 3 | **Huy hiệu / Gamification** | UI luôn "Chưa mở khóa" | Tự trao huy hiệu theo thành tích + bảng xếp hạng |
| 4 | **Flashcard ôn từ vựng** | Chưa có | Bộ thẻ + modal lật thẻ (mặt trước/sau, ví dụ) |

---

## 1. Cơ sở dữ liệu — `backend/database.sql`

Thêm **5 bảng mới** (dùng `CREATE TABLE IF NOT EXISTS` → an toàn với dữ liệu cũ):

| Bảng | Mục đích |
|------|----------|
| `questions` | Câu hỏi của học sinh + câu trả lời của giáo viên |
| `badges` | Danh mục huy hiệu + tiêu chí mở khóa |
| `user_badges` | Huy hiệu mà mỗi học sinh đã mở khóa |
| `flashcard_sets` | Bộ thẻ ghi nhớ (theo chủ đề) |
| `flashcards` | Từng thẻ (mặt trước / mặt sau / ví dụ) |

**Tiêu chí huy hiệu** (`badges.criteria_type`): `xp`, `completed_lessons`, `average_score`, `active_courses`, `exam_count`.

---

## 2. Backend

### `backend/db.js` — hàm mới
- **Thông báo:** `markNotificationRead(id, userId)`, `markAllNotificationsRead(userId)`
- **Q&A:** `createQuestion`, `listQuestions`, `findQuestionById`, `answerQuestion`
- **Huy hiệu:** `listBadges`, `getStudentMetrics`, `getStudentBadges` (tự trao huy hiệu khi đủ điều kiện)
- **Flashcard:** `listFlashcardSets`, `getFlashcardSet`
- **Tích hợp:** `getStudentDashboard` nay trả thêm `badges` và đánh dấu `isCurrentUser` trong `leaderboard`

### `backend/server.js` — endpoint mới

| Method | Đường dẫn | Quyền | Mô tả |
|--------|-----------|-------|-------|
| `PATCH` | `/api/notifications/:id` | tất cả | Đánh dấu 1 thông báo đã đọc |
| `POST` | `/api/notifications/read-all` | tất cả | Đánh dấu tất cả đã đọc |
| `GET` | `/api/questions` | tất cả | Danh sách câu hỏi (lọc theo vai trò) |
| `POST` | `/api/questions` | student/admin | Gửi câu hỏi mới |
| `PATCH` | `/api/questions/:id` | teacher/admin | Trả lời câu hỏi |
| `GET` | `/api/badges` | tất cả | Huy hiệu của học sinh (hoặc danh mục) |
| `GET` | `/api/flashcard-sets` | tất cả | Danh sách bộ thẻ |
| `GET` | `/api/flashcard-sets/:id` | tất cả | Chi tiết 1 bộ thẻ + các thẻ |

### `backend/seed.js` — dữ liệu mẫu
- **9 huy hiệu** (Khởi đầu, Chăm chỉ, Bậc thầy XP, Học đều, Kiên trì, Học sinh giỏi, Xuất sắc, Đa nhiệm, Chiến binh đề thi)
- **3 bộ flashcard:** Giáo dục · Môi trường · Công nghệ
- **3 câu hỏi mẫu** (có cả câu đã được trả lời)

---

## 3. Frontend

### Học sinh — `frontend/assets/js/student-dashboard.js`
- **Hỏi-Đáp:** form gửi câu hỏi (chọn khóa học, tiêu đề, nội dung) + danh sách câu hỏi và câu trả lời
- **Flashcard:** lưới bộ thẻ trong mục "Tài liệu ôn thi" + modal lật thẻ (Trước/Tiếp, hiển thị ví dụ)
- **Thông báo:** render dropdown từ dữ liệu thật, đếm số chưa đọc, click để đọc, nút "đọc tất cả"
- **Huy hiệu & Xếp hạng:** nhận dữ liệu thật từ dashboard (mở khóa/khóa, đánh dấu chính mình trên BXH)

### Giáo viên — `frontend/dashboard_giaovien.html`
- Mục **"Nhận xét & Phản hồi"** nay nạp câu hỏi học sinh thật qua `/api/questions`
- Nút **"Gửi phản hồi"** gọi `PATCH /api/questions/:id` → học sinh nhận thông báo

---

## 4. Cách chạy / áp dụng thay đổi

> Yêu cầu: bật **MySQL** (XAMPP) trước.

```powershell
cd "English Center\backend"
npm install          # cài dependency (mysql2, ...)
node setup-db.js     # tạo 5 bảng mới — KHÔNG mất dữ liệu cũ
node seed.js         # seed huy hiệu, flashcard, câu hỏi mẫu
node server.js       # chạy server
```

**Tài khoản demo để thử:**
- Học sinh: `test@gmail.com` / `password`
- Giáo viên: `giaovien@englishcenter.vn` / `giaovien123`
- Admin: `nhom3@englishcenter.edu.vn` / `admin123C`

**Kiểm thử nhanh:**
1. Đăng nhập học sinh → "Hỏi đáp GV" → gửi câu hỏi.
2. Đăng nhập giáo viên → "Nhận xét & Phản hồi" → trả lời.
3. Quay lại học sinh → thấy câu trả lời + thông báo (đánh dấu đã đọc được).
4. Vào "Tài liệu ôn thi" → mở 1 bộ Flashcard → lật thẻ.
5. Vào "Huy hiệu & Xếp hạng" → huy hiệu mở khóa theo XP/điểm.

---

## Phạm vi CHƯA làm (cố ý loại trừ)

- Tích hợp **AI thật** (chấm Speaking, Chatbot bằng LLM) — hiện chatbot vẫn là rule-based.
- Real-time **WebSocket** cho thông báo (đang dùng tải lại).
- **Video lesson player**, offline/Service Worker.
- **Unit/Integration test** tự động.

---

## Danh sách file đã thay đổi

```
backend/database.sql                       (+5 bảng)
backend/db.js                              (+12 hàm, sửa getStudentDashboard)
backend/server.js                          (+8 endpoint)
backend/seed.js                            (+seed badges/flashcards/questions)
frontend/assets/js/student-dashboard.js    (Q&A, flashcard, thông báo)
frontend/dashboard_giaovien.html           (Q&A giáo viên)
```
