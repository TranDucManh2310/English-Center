const crypto = require('crypto');
const db = require('./db');

const DEMO_ACCOUNTS = [
  { key: 'admin', email: 'nhom3@englishcenter.edu.vn', password: 'admin123C', name: 'Quan Tri Vien', role: 'admin' },
  { key: 'teacher-demo', email: 'demo@englishcenter.vn', password: '123456', name: 'Giao Vien Demo', role: 'teacher' },
  { key: 'teacher-gv', email: 'giaovien@englishcenter.vn', password: 'giaovien123', name: 'Nguyen Thi Giao Vien', role: 'teacher' },
  { key: 'student-demo', email: 'test@gmail.com', password: 'password', name: 'Hoc Sinh Demo', role: 'student' },
  { key: 'teacher-lan', email: 'lan.nguyen@englishcenter.vn', password: 'teacher123', name: 'Nguyen Thi Lan', role: 'teacher' },
  { key: 'teacher-minh', email: 'minh.tran@englishcenter.vn', password: 'teacher123', name: 'Tran Duc Minh', role: 'teacher' },
  { key: 'teacher-anh', email: 'anh.le@englishcenter.vn', password: 'teacher123', name: 'Le Phuong Anh', role: 'teacher' },
  { key: 'student-an', email: 'an.nguyen@example.com', password: 'student123', name: 'Nguyen Van An', role: 'student' },
  { key: 'student-hoa', email: 'hoa.le@example.com', password: 'student123', name: 'Le Thi Hoa', role: 'student' },
  { key: 'student-minh', email: 'minh.tran@example.com', password: 'student123', name: 'Tran Quang Minh', role: 'student' },
  { key: 'student-linh', email: 'linh.pham@example.com', password: 'student123', name: 'Pham Khanh Linh', role: 'student' },
  { key: 'student-hung', email: 'hung.pham@example.com', password: 'student123', name: 'Pham Minh Hung', role: 'student' },
  { key: 'student-mai', email: 'mai.hoang@example.com', password: 'student123', name: 'Hoang Thi Mai', role: 'student' },
  { key: 'student-long', email: 'long.vu@example.com', password: 'student123', name: 'Vu Hoang Long', role: 'student' },
  { key: 'student-ha', email: 'ha.le@example.com', password: 'student123', name: 'Le Thu Ha', role: 'student' },
  { key: 'student-khoa', email: 'khoa.dinh@example.com', password: 'student123', name: 'Dinh Van Khoa', role: 'student' },
  { key: 'student-ngoc', email: 'ngoc.bui@example.com', password: 'student123', name: 'Bui Thi Ngoc', role: 'student' },
  { key: 'student-tu', email: 'tu.dang@example.com', password: 'student123', name: 'Dang Van Tu', role: 'student' },
  { key: 'student-thanh', email: 'thanh.ngo@example.com', password: 'student123', name: 'Ngo Thi Thanh', role: 'student' }
];

const COURSE_DEFS = [
  {
    key: 'grammar',
    slug: 'ngu-phap-thptqg',
    name: 'Ngu Phap THPTQG Trong Tam',
    level: 'Co ban - nang cao',
    price: 3200000,
    durationWeeks: 8,
    capacity: 36,
    teacherKey: 'teacher-lan'
  },
  {
    key: 'mock',
    slug: 'luyen-de-thptqg',
    name: 'Luyen De Tieng Anh THPTQG',
    level: 'Nang cao',
    price: 3800000,
    durationWeeks: 10,
    capacity: 34,
    teacherKey: 'teacher-minh'
  },
  {
    key: 'fast',
    slug: 'cap-toc-4-tuan',
    name: 'On Thi Cap Toc 4 Tuan',
    level: 'Cap toc',
    price: 2500000,
    durationWeeks: 4,
    capacity: 32,
    teacherKey: 'teacher-anh'
  },
  {
    key: 'vocab',
    slug: 'tu-vung-theo-chu-de',
    name: 'Tu Vung Theo Chu De THPTQG',
    level: 'Co ban',
    price: 2200000,
    durationWeeks: 6,
    capacity: 40,
    teacherKey: 'teacher-gv'
  },
  {
    key: 'pronunciation',
    slug: 'phat-am-ai',
    name: 'Phat Am Chuan va Luyen Tap voi AI',
    level: 'Ung dung',
    price: 2800000,
    durationWeeks: 6,
    capacity: 30,
    teacherKey: 'teacher-demo'
  },
  {
    key: 'advanced',
    slug: 'tieng-anh-nang-cao',
    name: 'Tieng Anh Nang Cao San Diem 9',
    level: 'Nang cao',
    price: 4200000,
    durationWeeks: 12,
    capacity: 28,
    teacherKey: 'teacher-lan'
  }
];

const ENROLLMENT_MATRIX = [
  ['student-demo', 'grammar', 68, 14, 340, 'paid'],
  ['student-demo', 'mock', 42, 8, 210, 'pending'],
  ['student-an', 'grammar', 28, 5, 120, 'overdue'],
  ['student-an', 'mock', 35, 7, 165, 'pending'],
  ['student-hoa', 'mock', 76, 16, 520, 'paid'],
  ['student-hoa', 'vocab', 64, 13, 390, 'paid'],
  ['student-minh', 'fast', 58, 10, 310, 'paid'],
  ['student-linh', 'grammar', 91, 20, 760, 'paid'],
  ['student-hung', 'fast', 22, 4, 90, 'overdue'],
  ['student-mai', 'pronunciation', 82, 15, 610, 'paid'],
  ['student-long', 'mock', 48, 9, 240, 'paid'],
  ['student-ha', 'vocab', 73, 14, 470, 'paid'],
  ['student-khoa', 'grammar', 55, 11, 285, 'pending'],
  ['student-khoa', 'advanced', 44, 8, 230, 'pending'],
  ['student-ngoc', 'pronunciation', 67, 12, 360, 'paid'],
  ['student-tu', 'fast', 39, 7, 190, 'paid'],
  ['student-thanh', 'vocab', 100, 18, 900, 'paid'],
  ['student-thanh', 'advanced', 88, 21, 740, 'paid']
];

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function stableId(label) {
  const hex = crypto.createHash('sha1').update(`english-center:${label}`).digest('hex').slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.pbkdf2Sync(String(password), salt, 120000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

function daysFromNow(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}

function addHours(date, hours) {
  const next = new Date(date);
  next.setHours(next.getHours() + hours);
  return next;
}

function toSqlDate(date) {
  return date.toISOString().slice(0, 10);
}

function toSqlDateTime(date) {
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

async function ensureUser(item) {
  const email = normalizeEmail(item.email);
  const exists = await db.findUserByEmail(email);
  if (exists) return exists;

  return db.createUser({
    id: stableId(`user:${item.key}`),
    email,
    name: item.name,
    role: item.role,
    phone: item.role === 'student' ? '0900000000' : '0911000000',
    education: item.role === 'teacher' ? 'Dai hoc Su pham' : 'THPT',
    experience: item.role === 'teacher' ? '5 nam' : '',
    schedule: 'Toi 19:00-21:00',
    passwordHash: hashPassword(item.password),
    enrolled: []
  });
}

async function seedUsers() {
  const map = {};
  for (const [index, account] of DEMO_ACCOUNTS.entries()) {
    map[account.key] = await ensureUser(account);
    const createdAt = toSqlDateTime(daysFromNow(-Math.max(1, DEMO_ACCOUNTS.length - index) * 3));
    await db.query(
      'UPDATE users SET created_at = ?, updated_at = ? WHERE id = ?',
      [createdAt, createdAt, map[account.key].id]
    );
  }
  return map;
}

async function seedCourses(users) {
  const courses = {};
  for (const item of COURSE_DEFS) {
    const id = stableId(`course:${item.key}`);
    const teacher = users[item.teacherKey];
    await db.query(
      `INSERT INTO courses
        (id, slug, name, description, level, status, price, duration_weeks,
         capacity, teacher_id, start_date, end_date)
       VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         name = VALUES(name),
         description = VALUES(description),
         level = VALUES(level),
         status = VALUES(status),
         price = VALUES(price),
         duration_weeks = VALUES(duration_weeks),
         capacity = VALUES(capacity),
         teacher_id = VALUES(teacher_id),
         start_date = VALUES(start_date),
         end_date = VALUES(end_date)`,
      [
        id,
        item.slug,
        item.name,
        `Khoa ${item.name} voi lo trinh co du bai hoc, de thi va lich live.`,
        item.level,
        item.price,
        item.durationWeeks,
        item.capacity,
        teacher ? teacher.id : null,
        toSqlDate(daysFromNow(-21)),
        toSqlDate(daysFromNow(item.durationWeeks * 7 - 21))
      ]
    );
    courses[item.key] = await db.findCourseById(id);
  }
  return courses;
}

async function seedEnrollments(users, courses) {
  for (const [index, row] of ENROLLMENT_MATRIX.entries()) {
    const [studentKey, courseKey, progress, completedLessons, xp, paymentStatus] = row;
    const student = users[studentKey];
    const course = courses[courseKey];
    if (!student || !course) continue;

    const enrollmentId = stableId(`enrollment:${studentKey}:${courseKey}`);
    await db.enrollUser({
      id: enrollmentId,
      userId: student.id,
      courseId: course.id,
      status: progress >= 100 ? 'completed' : 'active',
      progress,
      completedLessons,
      xp,
      paidAmount: paymentStatus === 'paid' ? Number(course.price || 0) : Math.round(Number(course.price || 0) * 0.35),
      paymentStatus
    });
    const enrolledAt = toSqlDateTime(daysFromNow(-45 + index * 3));
    await db.query(
      'UPDATE enrollments SET enrolled_at = ?, updated_at = ? WHERE id = ?',
      [enrolledAt, enrolledAt, enrollmentId]
    );
  }
}

async function seedLessons(courses) {
  const lessons = {};
  for (const [courseKey, course] of Object.entries(courses)) {
    lessons[courseKey] = [];
    for (let index = 1; index <= 8; index += 1) {
      const id = stableId(`lesson:${courseKey}:${index}`);
      await db.query(
        `INSERT INTO lessons (id, course_id, title, position, duration_minutes, status)
         VALUES (?, ?, ?, ?, ?, 'published')
         ON DUPLICATE KEY UPDATE title = VALUES(title), duration_minutes = VALUES(duration_minutes), status = VALUES(status)`,
        [id, course.id, `Buoi ${index}: Trong tam ${index}`, index, 45 + (index % 3) * 10]
      );
      lessons[courseKey].push({ id, courseId: course.id });
    }
  }
  return lessons;
}

async function seedLessonProgress(users, lessons) {
  for (const [studentKey, courseKey, progress] of ENROLLMENT_MATRIX.map(row => [row[0], row[1], row[2]])) {
    const student = users[studentKey];
    const lessonList = lessons[courseKey] || [];
    if (!student) continue;
    const done = Math.max(1, Math.round((progress / 100) * lessonList.length));
    for (let index = 0; index < Math.min(done, lessonList.length); index += 1) {
      const completed = progress > 15 || index < done - 1;
      await db.updateLessonProgress({
        id: stableId(`lesson-progress:${studentKey}:${courseKey}:${index + 1}`),
        userId: student.id,
        lessonId: lessonList[index].id,
        status: completed ? 'completed' : 'in_progress',
        score: completed ? Math.min(10, 5.5 + (progress / 100) * 4 + (index % 2) * 0.2) : null,
        xp: completed ? 25 + index * 5 : 5
      });
    }
  }
}

async function seedSessions(users, courses) {
  const courseEntries = Object.entries(courses);
  for (const [courseKey, course] of courseEntries) {
    const def = COURSE_DEFS.find(item => item.key === courseKey);
    const teacher = users[def.teacherKey];
    for (let index = -2; index <= 5; index += 1) {
      const start = daysFromNow(index);
      start.setHours(19 + (Math.abs(index) % 2), 0, 0, 0);
      const id = stableId(`session:${courseKey}:${index}`);
      await db.query(
        `INSERT INTO class_sessions
          (id, course_id, teacher_id, title, session_no, start_at, end_at, meeting_url, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           teacher_id = VALUES(teacher_id),
           title = VALUES(title),
           start_at = VALUES(start_at),
           end_at = VALUES(end_at),
           meeting_url = VALUES(meeting_url),
           status = VALUES(status)`,
        [
          id,
          course.id,
          teacher ? teacher.id : null,
          `${course.name} - Buoi live ${index + 3}`,
          index + 3,
          toSqlDateTime(start),
          toSqlDateTime(addHours(start, 2)),
          `https://zoom.us/j/${Math.abs(stableId(`zoom:${courseKey}`).replace(/\D/g, '').slice(0, 9)) || 123456789}`,
          index < 0 ? 'done' : 'scheduled'
        ]
      );
    }
  }

  const enrollmentRows = await db.listEnrollments({ limit: 1000 });
  const pastSessions = await db.query(
    `SELECT cs.id, cs.course_id AS courseId
       FROM class_sessions cs
      WHERE cs.status = 'done'`
  );
  for (const session of pastSessions) {
    const students = enrollmentRows.filter(row => row.courseId === session.courseId);
    for (const [index, student] of students.entries()) {
      const absent = (index + session.id.charCodeAt(0)) % 5 === 0;
      await db.markAttendance({
        id: stableId(`attendance:${session.id}:${student.userId}`),
        sessionId: session.id,
        userId: student.userId,
        status: absent ? 'absent' : 'present',
        note: absent ? 'Vang khong phep' : ''
      });
    }
  }
}

async function seedExamsAndResults(users, courses) {
  const exams = {};
  for (const [courseKey, course] of Object.entries(courses)) {
    exams[courseKey] = [];
    for (let index = 1; index <= 3; index += 1) {
      const id = stableId(`exam:${courseKey}:${index}`);
      await db.query(
        `INSERT INTO exams (id, course_id, title, type, total_score, duration_minutes, status, due_at)
         VALUES (?, ?, ?, ?, 10, ?, 'published', ?)
         ON DUPLICATE KEY UPDATE title = VALUES(title), type = VALUES(type), duration_minutes = VALUES(duration_minutes), due_at = VALUES(due_at)`,
        [
          id,
          course.id,
          index === 3 ? `De thi thu ${course.name}` : `Bai tap tuan ${index} - ${course.name}`,
          index === 3 ? 'mock_test' : 'homework',
          index === 3 ? 60 : 30,
          toSqlDateTime(daysFromNow(index * 3))
        ]
      );
      exams[courseKey].push({ id, courseId: course.id });
    }
  }

  const enrollmentRows = await db.listEnrollments({ limit: 1000 });
  for (const enrollment of enrollmentRows) {
    const courseKey = Object.keys(courses).find(key => courses[key].id === enrollment.courseId);
    const courseExams = exams[courseKey] || [];
    for (const [index, exam] of courseExams.entries()) {
      if (Number(enrollment.progress) < 25 && index > 0) continue;
      const base = Math.max(4.5, Math.min(9.6, 4.8 + Number(enrollment.progress) / 18 + index * 0.25));
      const pending = index === 2 && Number(enrollment.progress) < 55;
      const resultId = stableId(`result:${exam.id}:${enrollment.userId}`);
      await db.createExamResult({
        id: resultId,
        examId: exam.id,
        userId: enrollment.userId,
        teacherId: enrollment.teacherId,
        score: pending ? null : Math.round(base * 10) / 10,
        status: pending ? 'submitted' : 'graded',
        feedback: pending ? '' : 'Can tiep tuc on tap cac cau doc hieu va tu vung.',
        xp: pending ? 0 : 30 + index * 10
      });
      const submittedAt = toSqlDateTime(daysFromNow(-24 + index * 7 + (Number(enrollment.progress) % 5)));
      const gradedAt = pending ? null : toSqlDateTime(daysFromNow(-23 + index * 7 + (Number(enrollment.progress) % 5)));
      await db.query(
        'UPDATE exam_results SET submitted_at = ?, graded_at = ? WHERE id = ?',
        [submittedAt, gradedAt, resultId]
      );
    }
  }
}

async function seedReviews(users, courses) {
  const reviews = [
    ['teacher-lan', 'student-demo', 'grammar', 4.8],
    ['teacher-lan', 'student-linh', 'grammar', 4.9],
    ['teacher-minh', 'student-hoa', 'mock', 4.7],
    ['teacher-minh', 'student-long', 'mock', 4.5],
    ['teacher-anh', 'student-hung', 'fast', 4.6],
    ['teacher-anh', 'student-minh', 'fast', 4.8],
    ['teacher-gv', 'student-ha', 'vocab', 4.4],
    ['teacher-demo', 'student-mai', 'pronunciation', 4.9]
  ];

  for (const [teacherKey, studentKey, courseKey, rating] of reviews) {
    await db.query(
      `INSERT INTO teacher_reviews (id, teacher_id, student_id, course_id, rating, comment)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE rating = VALUES(rating), comment = VALUES(comment)`,
      [
        stableId(`review:${teacherKey}:${studentKey}:${courseKey}`),
        users[teacherKey].id,
        users[studentKey].id,
        courses[courseKey].id,
        rating,
        'Bai giang ro rang va co phan hoi kip thoi.'
      ]
    );
  }
}

async function seedActivities(users, courses) {
  const activities = [
    ['student-demo', 'grammar', 'lesson', 'Hoan thanh bai hoc Menh de quan he', 35, -1],
    ['student-demo', 'mock', 'exam', 'Nop de thi thu THPTQG 2024', 45, 0],
    ['student-hoa', 'mock', 'exam', 'Dat 8+ trong de luyen tap', 70, -2],
    ['student-linh', 'grammar', 'lesson', 'Hoan thanh chuong ngu phap nang cao', 60, -3],
    ['student-mai', 'pronunciation', 'speaking', 'Luyen phat am voi AI', 40, 0],
    ['student-thanh', 'vocab', 'lesson', 'Hoan thanh khoa tu vung', 90, -4],
    ['student-long', 'mock', 'lesson', 'Xem lai video chua de', 25, -5],
    ['student-khoa', 'grammar', 'quiz', 'Lam quiz thi dong tu', 20, -6]
  ];

  for (const [studentKey, courseKey, type, title, xp, dayOffset] of activities) {
    await db.query(
      `INSERT INTO learning_activities (id, user_id, course_id, type, title, xp, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE title = VALUES(title), xp = VALUES(xp), created_at = VALUES(created_at)`,
      [
        stableId(`activity:${studentKey}:${courseKey}:${type}:${dayOffset}`),
        users[studentKey].id,
        courses[courseKey].id,
        type,
        title,
        xp,
        JSON.stringify({ seeded: true }),
        toSqlDateTime(daysFromNow(dayOffset))
      ]
    );
  }
}

async function seedNotifications(users) {
  const notifications = [
    [null, 'He thong da cap nhat dashboard moi', 'Du lieu dashboard hien duoc tinh tu MySQL.', 'system'],
    ['student-demo', 'Lich live sap dien ra', 'Ban co buoi live Ngu phap vao toi nay.', 'schedule'],
    ['student-demo', 'Bai thi da duoc cham', 'De thi thu gan nhat da co diem va nhan xet.', 'exam'],
    ['teacher-lan', 'Co bai nop can cham', 'Hoc vien vua nop bai tap tuan 3.', 'grading'],
    ['teacher-minh', 'Can theo doi hoc vien cham tien do', 'Co hoc vien tien do duoi 45%.', 'alert']
  ];

  for (const [userKey, title, body, type] of notifications) {
    await db.query(
      `INSERT INTO notifications (id, user_id, title, body, type)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE title = VALUES(title), body = VALUES(body), type = VALUES(type)`,
      [
        stableId(`notification:${userKey || 'all'}:${title}`),
        userKey ? users[userKey].id : null,
        title,
        body,
        type
      ]
    );
  }
}

async function seedMaterialRequests(users, courses) {
  const rows = [
    ['teacher-lan', 'grammar', 'Tinh chinh bai giang Menh de quan he', 'lesson', 'pending'],
    ['teacher-minh', 'mock', 'Bo de thi thu so 4', 'exam', 'submitted'],
    ['teacher-anh', 'fast', 'Tai lieu on cap toc tuan 2', 'document', 'approved']
  ];
  for (const [teacherKey, courseKey, title, type, status] of rows) {
    await db.query(
      `INSERT INTO teaching_material_requests
        (id, teacher_id, course_id, title, type, status, admin_note, submitted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE title = VALUES(title), type = VALUES(type), status = VALUES(status), admin_note = VALUES(admin_note)`,
      [
        stableId(`material:${teacherKey}:${courseKey}:${title}`),
        users[teacherKey].id,
        courses[courseKey].id,
        title,
        type,
        status,
        status === 'pending' ? 'Bo sung them bai tap van dung.' : '',
        status === 'submitted' ? toSqlDateTime(daysFromNow(-1)) : null
      ]
    );
  }
}

const BADGE_DEFS = [
  ['xp-100', 'Khoi dau', 'Dat 100 XP dau tien', '\u{1F331}', 'xp', 100, 1],
  ['xp-500', 'Cham chi', 'Tich luy 500 XP', '\u{1F525}', 'xp', 500, 2],
  ['xp-1000', 'Bac thay XP', 'Tich luy 1000 XP', '⚡', 'xp', 1000, 3],
  ['lessons-10', 'Hoc deu', 'Hoan thanh 10 bai hoc', '\u{1F4D8}', 'completed_lessons', 10, 4],
  ['lessons-30', 'Kien tri', 'Hoan thanh 30 bai hoc', '\u{1F4DA}', 'completed_lessons', 30, 5],
  ['score-8', 'Hoc sinh gioi', 'Diem trung binh tu 8.0 tro len', '\u{1F3AF}', 'average_score', 8, 6],
  ['score-9', 'Xuat sac', 'Diem trung binh tu 9.0 tro len', '\u{1F3C6}', 'average_score', 9, 7],
  ['courses-2', 'Da nhiem', 'Tham gia 2 khoa hoc cung luc', '\u{1F680}', 'active_courses', 2, 8],
  ['exams-5', 'Chien binh de thi', 'Hoan thanh 5 bai thi', '✍️', 'exam_count', 5, 9]
];

const FLASHCARD_DEFS = [
  {
    slug: 'tu-vung-giao-duc',
    title: 'Tu vung chu de Giao duc',
    topic: 'Education',
    description: 'Tu vung thuong gap chu de giao duc trong de THPTQG.',
    position: 1,
    cards: [
      ['curriculum', 'chuong trinh hoc', 'The school updated its curriculum this year.'],
      ['tuition', 'hoc phi', 'Tuition fees have increased recently.'],
      ['scholarship', 'hoc bong', 'She won a full scholarship to university.'],
      ['literacy', 'biet doc viet', 'The literacy rate has improved a lot.'],
      ['vocational', 'thuoc ve day nghe', 'He chose a vocational training course.'],
      ['enroll', 'ghi danh, nhap hoc', 'Many students enroll in online courses.']
    ]
  },
  {
    slug: 'tu-vung-moi-truong',
    title: 'Tu vung chu de Moi truong',
    topic: 'Environment',
    description: 'Tu vung trong tam chu de moi truong.',
    position: 2,
    cards: [
      ['pollution', 'o nhiem', 'Air pollution is a serious problem in big cities.'],
      ['deforestation', 'nan pha rung', 'Deforestation destroys animal habitats.'],
      ['renewable', 'co the tai tao', 'Solar power is a renewable energy source.'],
      ['emission', 'su phat thai', 'We must reduce carbon emissions.'],
      ['sustainable', 'ben vung', 'Sustainable development protects the future.'],
      ['conserve', 'bao ton, tiet kiem', 'We should conserve water and energy.']
    ]
  },
  {
    slug: 'tu-vung-cong-nghe',
    title: 'Tu vung chu de Cong nghe',
    topic: 'Technology',
    description: 'Tu vung cong nghe pho bien trong de doc hieu.',
    position: 3,
    cards: [
      ['device', 'thiet bi', 'Smartphones are popular electronic devices.'],
      ['innovation', 'su doi moi', 'Innovation drives economic growth.'],
      ['artificial intelligence', 'tri tue nhan tao', 'Artificial intelligence is changing our lives.'],
      ['automation', 'su tu dong hoa', 'Automation increases factory productivity.'],
      ['cybersecurity', 'an ninh mang', 'Cybersecurity protects our personal data.']
    ]
  }
];

const QUESTION_DEFS = [
  ['student-demo', 'grammar', 'Cach dung menh de quan he', 'Em chua ro khi nao dung "which" va khi nao dung "that" trong menh de quan he, thay/co giai thich giup em voi a.', null],
  ['student-an', 'mock', 'Quan ly thoi gian khi lam de', 'Lam sao de phan bo thoi gian hop ly cho tung phan trong de thi thu a?', 'Em nen danh khoang 10 phut cho phan tu vung-ngu phap, 25 phut cho doc hieu va de lai 5 phut soat loi nhe.'],
  ['student-hoa', 'vocab', 'Phan biet tu de nham lan', 'Em hay bi nham giua "affect" va "effect", lam sao de nho a?', null]
];

async function seedBadges() {
  for (const [code, name, description, icon, criteriaType, criteriaValue, position] of BADGE_DEFS) {
    await db.query(
      `INSERT INTO badges (id, code, name, description, icon, criteria_type, criteria_value, position)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE name = VALUES(name), description = VALUES(description),
         icon = VALUES(icon), criteria_type = VALUES(criteria_type),
         criteria_value = VALUES(criteria_value), position = VALUES(position)`,
      [stableId(`badge:${code}`), code, name, description, icon, criteriaType, criteriaValue, position]
    );
  }
}

async function seedFlashcards() {
  for (const set of FLASHCARD_DEFS) {
    const setId = stableId(`flashcard-set:${set.slug}`);
    await db.query(
      `INSERT INTO flashcard_sets (id, slug, title, topic, description, position)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE title = VALUES(title), topic = VALUES(topic),
         description = VALUES(description), position = VALUES(position)`,
      [setId, set.slug, set.title, set.topic, set.description, set.position]
    );
    for (const [index, card] of set.cards.entries()) {
      const [front, back, example] = card;
      await db.query(
        `INSERT INTO flashcards (id, set_id, front, back, example, position)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE front = VALUES(front), back = VALUES(back), example = VALUES(example)`,
        [stableId(`flashcard:${set.slug}:${index + 1}`), setId, front, back, example, index + 1]
      );
    }
  }
}

async function seedQuestions(users, courses) {
  for (const [studentKey, courseKey, title, body, answer] of QUESTION_DEFS) {
    const student = users[studentKey];
    const course = courses[courseKey];
    if (!student || !course) continue;
    const id = stableId(`question:${studentKey}:${courseKey}`);
    await db.query(
      `INSERT INTO questions (id, student_id, course_id, teacher_id, title, body, answer, status, answered_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE title = VALUES(title), body = VALUES(body),
         answer = VALUES(answer), status = VALUES(status), answered_at = VALUES(answered_at)`,
      [
        id,
        student.id,
        course.id,
        course.teacherId || null,
        title,
        body,
        answer,
        answer ? 'answered' : 'open',
        answer ? toSqlDateTime(daysFromNow(-1)) : null
      ]
    );
  }
}

async function seedDemoUsers() {
  const users = await seedUsers();
  const courses = await seedCourses(users);
  const lessons = await seedLessons(courses);

  await seedEnrollments(users, courses);
  await seedLessonProgress(users, lessons);
  await seedSessions(users, courses);
  await seedExamsAndResults(users, courses);
  await seedReviews(users, courses);
  await seedActivities(users, courses);
  await seedNotifications(users);
  await seedMaterialRequests(users, courses);
  await seedBadges();
  await seedFlashcards();
  await seedQuestions(users, courses);
}

if (require.main === module) {
  seedDemoUsers()
    .then(() => {
      console.log('Seeded demo users, courses, enrollments, dashboards and learning data.');
      process.exit(0);
    })
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { seedDemoUsers };
