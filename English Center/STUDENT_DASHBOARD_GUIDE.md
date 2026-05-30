# 📚 Hướng Dẫn Hoàn Thiện Dashboard Học Sinh

## 🎯 Tổng Quan

File `student-dashboard.js` cung cấp các chức năng động để hoàn thiện dashboard học sinh, kết nối với API backend để lấy dữ liệu thực tế.

## 📋 Chức Năng Được Thêm

### 1. **Dashboard Tổng Quan** 
- Hiển thị thống kê: Khóa học đã đăng ký, bài học hoàn thành, XP, ngày liên tiếp
- Danh sách khóa học đang học với tiến độ
- Lịch lớp học sắp tới

### 2. **Lịch Học (Lịch Học)**
- Hiển thị tất cả lớp học theo ngày
- Liên kết tham gia vào meeting
- Sắp xếp theo thời gian

### 3. **Đề Thi Thử**
- Hiển thị danh sách đề thi
- Cấp độ (Dễ, Trung bình, Khó)
- Số lần đã làm bài
- Nút bắt đầu bài thi

### 4. **Luyện Speaking AI**
- Giao diện luyện phát âm
- Tích hợp AI nhận dạng giọng nói (chuẩn bị)

### 5. **Tài Liệu Ôn Thi**
- Danh sách file PDF
- Video bài giảng
- Flashcard ôn tập

### 6. **Hỏi Đáp Giáo Viên**
- Form gửi câu hỏi
- Danh sách câu hỏi đã được trả lời

### 7. **Kết Quả & Tiến độ**
- Điểm trung bình
- Biểu đồ cải thiện điểm
- Lịch sử bài thi
- Phân tích 4 kỹ năng

### 8. **Huy Hiệu & Xếp hạng**
- Huy hiệu đã đạt được
- Huy hiệu sắp đạt được
- Bảng xếp hạng học sinh

### 9. **Cài Đặt Tài Khoản**
- Cập nhật thông tin cá nhân
- Đổi mật khẩu
- Quản lý thông báo

## 🔧 Cách Sử Dụng

### Khởi tạo Dashboard
```javascript
// Tự động gọi khi trang tải
window.initDashboard();
```

### Chuyển View
```javascript
// Chuyển đến view lịch học
switchView('lichhoc');

// Chuyển đến đề thi
switchView('dethithu');

// Chuyển đến kết quả
switchView('ketqua');
```

## 📡 API Endpoints Cần Thiết

Dashboard sử dụng các endpoint:

```
GET  /api/dashboard/student          - Lấy thông tin dashboard
GET  /api/enrollments                - Lấy danh sách khóa học đã đăng ký
GET  /api/exams                      - Lấy danh sách đề thi
GET  /api/class-sessions             - Lấy danh sách lớp học
POST /api/exam-results               - Gửi kết quả bài thi
GET  /api/auth/me                    - Lấy thông tin user
POST /api/auth/logout                - Đăng xuất
```

## 🎨 Tùy Chỉnh Giao Diện

### Cập Nhật Màu Sắc
```css
:root {
  --blue:        #1a6ef5;
  --blue-dark:   #1254cc;
  --green:       #16a34a;
  --orange:      #ea580c;
  --red:         #dc2626;
}
```

### Thêm Notification
```javascript
// Trong file student-dashboard.js
window.showNotification = function(message, type = 'success') {
  // Thêm notification logic
};
```

## 📊 Cấu Trúc Dữ liệu State

```javascript
const state = {
  user: {
    id: string,
    email: string,
    name: string,
    role: 'student',
    phone: string,
    education: string
  },
  enrollments: [{
    id: string,
    courseId: string,
    courseName: string,
    progress: number,
    status: 'active|completed|paused',
    completedLessons: number,
    totalLessons: number
  }],
  exams: [{
    id: string,
    title: string,
    type: 'mock_test|homework',
    level: 'easy|medium|hard',
    durationMinutes: number,
    questions: number,
    attempts: number
  }],
  classSessions: [{
    id: string,
    title: string,
    startAt: ISO8601,
    endAt: ISO8601,
    meetingUrl: string,
    status: 'scheduled|done|cancelled'
  }]
};
```

## 🚀 Triển Khai

1. **Đảm bảo API Backend chạy**: `http://localhost:3000`
2. **Kiểm tra token đăng nhập**: localStorage.getItem('ec_auth_token')
3. **Mở console**: F12 để debug
4. **Kiểm tra Network**: Đảm bảo các API call thành công

## ⚙️ Cấu Hình Backend Cần Thiết

### 1. Cập Nhật `/api/dashboard/student`
```javascript
// Backend response
{
  ok: true,
  dashboard: {
    stats: {
      enrolledCourses: 2,
      completedLessons: 45,
      totalXP: 1250,
      currentStreak: 7
    }
  }
}
```

### 2. Cập Nhật `/api/enrollments`
```javascript
{
  ok: true,
  enrollments: [
    {
      id: "uuid",
      courseId: "uuid",
      courseName: "Từ Vựng THPTQG",
      status: "active",
      progress: 65,
      completedLessons: 13,
      totalLessons: 20
    }
  ]
}
```

### 3. Cập Nhật `/api/exams`
```javascript
{
  ok: true,
  exams: [
    {
      id: "uuid",
      title: "Đề thi thử 1 - 2024",
      type: "mock_test",
      level: "medium",
      durationMinutes: 60,
      questions: 50,
      attempts: 2
    }
  ]
}
```

### 4. Cập Nhật `/api/class-sessions`
```javascript
{
  ok: true,
  sessions: [
    {
      id: "uuid",
      title: "Lớp học - Ngữ pháp",
      startAt: "2024-05-30T14:00:00Z",
      endAt: "2024-05-30T15:30:00Z",
      meetingUrl: "https://zoom.us/...",
      status: "scheduled"
    }
  ]
}
```

## 🔐 Bảo Mật

- Token lưu trong localStorage với key: `ec_auth_token`
- Được gửi trong header: `Authorization: Bearer {token}`
- Tự động redirect đến login nếu token hết hạn (401)

## 🐛 Debugging

### Kiểm tra state
```javascript
console.log(state);
```

### Kiểm tra user
```javascript
console.log(state.user);
```

### Test API call
```javascript
await apiCall('/api/dashboard/student');
```

## 📝 Ghi Chú Phát Triển

- [ ] Thêm phân trang cho danh sách dài
- [ ] Thêm search/filter
- [ ] Thêm real-time notifications
- [ ] Tích hợp Chart.js cho biểu đồ
- [ ] Thêm animation khi load dữ liệu
- [ ] Optimize performance với lazy loading
- [ ] Thêm offline support

## 👨‍💼 Hỗ Trợ

Nếu gặp vấn đề:
1. Kiểm tra console (F12)
2. Kiểm tra Network tab
3. Kiểm tra token trong localStorage
4. Kiểm tra API endpoint có phản hồi không
5. Kiểm tra CORS settings
