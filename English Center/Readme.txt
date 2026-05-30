English Center

Day la web demo trung tam on thi Tieng Anh THPTQG, gom frontend HTML/CSS/JS va backend Node.js dung MySQL/MariaDB cua XAMPP.

Cau truc thu muc:
- frontend/: HTML, CSS, JS, assets, forms tinh.
- backend/: Node.js API, MySQL config, schema va scripts.

Yeu cau moi truong:
- Node.js 18 tro len.
- npm 9 tro len.
- MySQL/MariaDB 10.2 tro len, khuyen dung MySQL trong XAMPP.
- Cong 3000 con trong de chay backend mac dinh. Co the doi bang bien moi truong PORT.
- Frontend admin/hoc sinh/giao vien can mo qua http://localhost:3000/ de goi API. Neu mo bang file:// se chi chay du lieu offline/localStorage.

Dependencies backend:
- mysql2: driver ket noi MySQL/MariaDB.
- Cac module con lai la built-in cua Node.js: http, fs, path, crypto.

Cai dat database bang XAMPP:
1. Mo XAMPP Control Panel va start MySQL.
2. Mo terminal tai thu muc backend.
3. Chay:
   npm install
   npm run db:setup

Cach chay full-stack:
1. Dam bao MySQL trong XAMPP dang chay.
2. Mo terminal tai thu muc backend.
3. Chay:
   npm start
4. Mo:
   http://localhost:3000/

Thong tin database mac dinh:
- DB_HOST=127.0.0.1
- DB_PORT=3306
- DB_USER=root
- DB_PASSWORD=
- DB_NAME=english_center

Neu muon import thu cong bang phpMyAdmin:
1. Mo http://localhost/phpmyadmin
2. Import file backend/database.sql
3. Chay trong backend:
   npm run seed

Tai khoan demo:
- Hoc sinh: test@gmail.com / password
- Giao vien: demo@englishcenter.vn / 123456
- Admin: nhom3@englishcenter.edu.vn / admin123C

API chinh:
- GET /api/health
- POST /api/auth/register
- POST /api/auth/login
- GET /api/auth/me
- POST /api/auth/logout
- POST /api/contact
- GET /api/dashboard/admin
- GET /api/dashboard/teacher
- GET /api/dashboard/student
- GET/POST /api/courses
- GET/PATCH /api/courses/:id
- GET/POST /api/enrollments
- GET /api/users
- PATCH /api/users/:id
- POST /api/lesson-progress
- POST /api/exam-results
- POST /api/attendance
- POST /api/notifications

Ghi chu:
- Backend serve frontend tu thu muc ../frontend.
- Dang nhap, dang ky, session va form lien he duoc luu trong MySQL.
- Dashboard admin/giao vien/hoc sinh tinh so lieu tu MySQL: courses, enrollments, lessons, class_sessions, attendance, exams, exam_results, teacher_reviews, notifications.
- Neu mo truc tiep file HTML bang file://, frontend van fallback ve localStorage de demo offline.
