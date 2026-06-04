const crypto = require('crypto');
const mysql = require('mysql2/promise');

const DB_CONFIG = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'english_center',
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 10),
  queueLimit: 0,
  charset: 'utf8mb4'
};

let pool;

function getPool() {
  if (!pool) {
    pool = mysql.createPool(DB_CONFIG);
  }
  return pool;
}

async function query(sql, params = []) {
  const [rows] = await getPool().query(sql, params);
  return rows;
}

async function pingDatabase() {
  const rows = await query('SELECT 1 AS ok');
  return rows[0] && rows[0].ok === 1;
}

async function findUserByEmail(email) {
  const rows = await query(
    `SELECT id, email, name, role, phone, education, experience, motivation,
            preferred_schedule AS schedule, newsletter, enrolled, password_hash AS passwordHash,
            (SELECT MAX(last_active_at) FROM sessions WHERE sessions.user_id = users.id) AS lastActiveAt,
            created_at AS createdAt, updated_at AS updatedAt
       FROM users
      WHERE email = ?
      LIMIT 1`,
    [email]
  );
  return rows[0] || null;
}

async function findUserById(id) {
  const rows = await query(
    `SELECT id, email, name, role, phone, education, experience, motivation,
            preferred_schedule AS schedule, newsletter, enrolled, password_hash AS passwordHash,
            (SELECT MAX(last_active_at) FROM sessions WHERE sessions.user_id = users.id) AS lastActiveAt,
            created_at AS createdAt, updated_at AS updatedAt
       FROM users
      WHERE id = ?
      LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

async function createUser(user) {
  await query(
    `INSERT INTO users
      (id, email, name, role, phone, education, experience, motivation,
       preferred_schedule, newsletter, enrolled, password_hash)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      user.id,
      user.email,
      user.name,
      user.role,
      user.phone || '',
      user.education || '',
      user.experience || '',
      user.motivation || '',
      user.schedule || '',
      user.newsletter ? 1 : 0,
      JSON.stringify(user.enrolled || []),
      user.passwordHash
    ]
  );
  return findUserById(user.id);
}

async function deleteUser(id) {
  const result = await query('DELETE FROM users WHERE id = ?', [id]);
  return result.affectedRows > 0;
}

async function createSession(token, userId) {
  await query(
    'INSERT INTO sessions (token, user_id, last_active_at) VALUES (?, ?, CURRENT_TIMESTAMP)',
    [token, userId]
  );
}

async function touchSession(token, page = '') {
  if (!token) return;
  await query(
    `UPDATE sessions
        SET last_active_at = CURRENT_TIMESTAMP,
            current_page = ?
      WHERE token = ?`,
    [String(page || '').slice(0, 255), token]
  );
}

async function findSessionUser(token) {
  const rows = await query(
    `SELECT u.id, u.email, u.name, u.role, u.phone, u.education, u.experience,
            u.motivation, u.preferred_schedule AS schedule, u.newsletter, u.enrolled,
            u.password_hash AS passwordHash, s.last_active_at AS lastActiveAt,
            u.created_at AS createdAt, u.updated_at AS updatedAt
       FROM sessions s
       JOIN users u ON u.id = s.user_id
      WHERE s.token = ?
      LIMIT 1`,
    [token]
  );
  return rows[0] || null;
}

async function deleteSession(token) {
  await query('DELETE FROM sessions WHERE token = ?', [token]);
}

async function createSubmission(submission) {
  await query(
    'INSERT INTO submissions (id, type, payload) VALUES (?, ?, ?)',
    [submission.id, submission.type, JSON.stringify(submission.data || {})]
  );
}

function parsePayload(value) {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

async function findSubmissionById(id) {
  const rows = await query(
    `SELECT id, type, payload, created_at AS createdAt
       FROM submissions
      WHERE id = ?
      LIMIT 1`,
    [id]
  );
  const row = rows[0];
  if (!row) return null;
  return { id: row.id, type: row.type, createdAt: row.createdAt, payload: parsePayload(row.payload) };
}

async function listSubmissions(filters = {}) {
  const where = [];
  const params = [];
  if (filters.type) {
    where.push('type = ?');
    params.push(filters.type);
  }
  if (filters.userId) {
    where.push("JSON_UNQUOTE(JSON_EXTRACT(payload, '$.userId')) = ?");
    params.push(filters.userId);
  }
  const rows = await query(
    `SELECT id, type, payload, created_at AS createdAt
       FROM submissions
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY created_at DESC
      LIMIT ?`,
    [...params, Math.min(Number(filters.limit || 100), 500)]
  );
  return rows.map(row => ({
    id: row.id,
    type: row.type,
    createdAt: row.createdAt,
    payload: parsePayload(row.payload)
  }));
}

async function updateSubmission(id, patch = {}) {
  const current = await findSubmissionById(id);
  if (!current) return null;
  const payload = { ...current.payload, ...patch };
  await query(
    'UPDATE submissions SET payload = ? WHERE id = ?',
    [JSON.stringify(payload), id]
  );
  return findSubmissionById(id);
}

function firstRow(rows, fallback = {}) {
  return rows[0] || fallback;
}

function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function isoDate(value) {
  return value ? new Date(value).toISOString() : null;
}

async function listUsers(filters = {}) {
  const where = [];
  const params = [];
  if (filters.role) {
    where.push('role = ?');
    params.push(filters.role);
  }
  if (filters.q) {
    where.push('(name LIKE ? OR email LIKE ? OR phone LIKE ?)');
    params.push(`%${filters.q}%`, `%${filters.q}%`, `%${filters.q}%`);
  }

  const rows = await query(
    `SELECT id, email, name, role, phone, education, experience, motivation,
            preferred_schedule AS schedule, newsletter, enrolled,
            (SELECT MAX(last_active_at) FROM sessions WHERE sessions.user_id = users.id) AS lastActiveAt,
            created_at AS createdAt, updated_at AS updatedAt
       FROM users
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY created_at DESC
      LIMIT ?`,
    [...params, Math.min(Number(filters.limit || 100), 500)]
  );
  return rows;
}

async function updateUser(id, updates) {
  const allowed = {
    email: 'email',
    name: 'name',
    role: 'role',
    phone: 'phone',
    education: 'education',
    experience: 'experience',
    motivation: 'motivation',
    schedule: 'preferred_schedule',
    newsletter: 'newsletter',
    passwordHash: 'password_hash'
  };
  const sets = [];
  const params = [];
  Object.entries(allowed).forEach(([key, column]) => {
    if (Object.prototype.hasOwnProperty.call(updates, key)) {
      sets.push(`${column} = ?`);
      params.push(key === 'newsletter' ? (updates[key] ? 1 : 0) : updates[key]);
    }
  });
  if (!sets.length) return findUserById(id);

  await query(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, [...params, id]);
  return findUserById(id);
}

async function listCourses(filters = {}) {
  const where = [];
  const params = [];
  if (filters.status) {
    where.push('c.status = ?');
    params.push(filters.status);
  }
  if (filters.teacherId) {
    where.push('c.teacher_id = ?');
    params.push(filters.teacherId);
  }
  if (filters.studentId) {
    where.push(`EXISTS (
      SELECT 1 FROM enrollments se
       WHERE se.course_id = c.id
         AND se.user_id = ?
         AND se.status IN ('active', 'completed')
    )`);
    params.push(filters.studentId);
  }

  return query(
    `SELECT c.id, c.slug, c.name, c.description, c.level, c.status, c.price,
            c.duration_weeks AS durationWeeks, c.capacity, c.teacher_id AS teacherId,
            t.name AS teacherName, c.start_date AS startDate, c.end_date AS endDate,
            COUNT(e.id) AS enrolledCount,
            ROUND(COALESCE(AVG(e.progress), 0), 1) AS averageProgress
       FROM courses c
       LEFT JOIN users t ON t.id = c.teacher_id
       LEFT JOIN enrollments e ON e.course_id = c.id AND e.status IN ('active', 'completed')
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      GROUP BY c.id
      ORDER BY c.created_at DESC`,
    params
  );
}

async function findCourseById(id) {
  const rows = await query(
    `SELECT c.id, c.slug, c.name, c.description, c.level, c.status, c.price,
            c.duration_weeks AS durationWeeks, c.capacity, c.teacher_id AS teacherId,
            t.name AS teacherName, c.start_date AS startDate, c.end_date AS endDate
       FROM courses c
       LEFT JOIN users t ON t.id = c.teacher_id
      WHERE c.id = ?
      LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

async function createCourse(course) {
  await query(
    `INSERT INTO courses
      (id, slug, name, description, level, status, price, duration_weeks,
       capacity, teacher_id, start_date, end_date)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      course.id,
      course.slug,
      course.name,
      course.description || '',
      course.level || '',
      course.status || 'active',
      course.price || 0,
      course.durationWeeks || 8,
      course.capacity || 40,
      course.teacherId || null,
      course.startDate || null,
      course.endDate || null
    ]
  );
  return findCourseById(course.id);
}

async function updateCourse(id, updates) {
  const allowed = {
    slug: 'slug',
    name: 'name',
    description: 'description',
    level: 'level',
    status: 'status',
    price: 'price',
    durationWeeks: 'duration_weeks',
    capacity: 'capacity',
    teacherId: 'teacher_id',
    startDate: 'start_date',
    endDate: 'end_date'
  };
  const sets = [];
  const params = [];
  Object.entries(allowed).forEach(([key, column]) => {
    if (Object.prototype.hasOwnProperty.call(updates, key)) {
      sets.push(`${column} = ?`);
      params.push(updates[key] === '' ? null : updates[key]);
    }
  });
  if (!sets.length) return findCourseById(id);
  await query(`UPDATE courses SET ${sets.join(', ')} WHERE id = ?`, [...params, id]);
  return findCourseById(id);
}

async function deleteCourse(id) {
  const result = await query('DELETE FROM courses WHERE id = ?', [id]);
  return result.affectedRows > 0;
}

async function enrollUser(enrollment) {
  await query(
    `INSERT INTO enrollments
      (id, user_id, course_id, status, progress, completed_lessons, xp, paid_amount, payment_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       status = VALUES(status),
       progress = VALUES(progress),
       completed_lessons = VALUES(completed_lessons),
       xp = VALUES(xp),
       paid_amount = VALUES(paid_amount),
       payment_status = VALUES(payment_status)`,
    [
      enrollment.id,
      enrollment.userId,
      enrollment.courseId,
      enrollment.status || 'active',
      enrollment.progress || 0,
      enrollment.completedLessons || 0,
      enrollment.xp || 0,
      enrollment.paidAmount || 0,
      enrollment.paymentStatus || 'pending'
    ]
  );
  return getEnrollment(enrollment.userId, enrollment.courseId);
}

async function getEnrollment(userId, courseId) {
  const rows = await query(
    `SELECT e.id, e.user_id AS userId, e.course_id AS courseId, c.name AS courseName,
            e.status, e.progress, e.completed_lessons AS completedLessons,
            e.xp, e.paid_amount AS paidAmount, e.payment_status AS paymentStatus,
            e.enrolled_at AS enrolledAt, e.completed_at AS completedAt
       FROM enrollments e
       JOIN courses c ON c.id = e.course_id
      WHERE e.user_id = ? AND e.course_id = ?
      LIMIT 1`,
    [userId, courseId]
  );
  return rows[0] || null;
}

async function findEnrollmentById(id) {
  const rows = await query(
    `SELECT e.id, e.user_id AS userId, u.name AS studentName, u.email AS studentEmail,
            u.phone AS studentPhone, u.education AS studentClass,
            e.course_id AS courseId, c.name AS courseName, c.price AS coursePrice,
            c.teacher_id AS teacherId, t.name AS teacherName,
            e.status, e.progress, e.completed_lessons AS completedLessons,
            e.xp, e.paid_amount AS paidAmount, e.payment_status AS paymentStatus,
            e.enrolled_at AS enrolledAt, e.completed_at AS completedAt
       FROM enrollments e
       JOIN users u ON u.id = e.user_id
       JOIN courses c ON c.id = e.course_id
       LEFT JOIN users t ON t.id = c.teacher_id
      WHERE e.id = ?
      LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

async function listEnrollments(filters = {}) {
  const where = [];
  const params = [];
  if (filters.userId) {
    where.push('e.user_id = ?');
    params.push(filters.userId);
  }
  if (filters.courseId) {
    where.push('e.course_id = ?');
    params.push(filters.courseId);
  }
  if (filters.status) {
    where.push('e.status = ?');
    params.push(filters.status);
  }
  if (filters.teacherId) {
    where.push('c.teacher_id = ?');
    params.push(filters.teacherId);
  }

  return query(
    `SELECT e.id, e.user_id AS userId, u.name AS studentName, u.email AS studentEmail,
            u.phone AS studentPhone, u.education AS studentClass,
            e.course_id AS courseId, c.name AS courseName, c.teacher_id AS teacherId,
            t.name AS teacherName, e.status, e.progress,
            e.completed_lessons AS completedLessons, e.xp, e.paid_amount AS paidAmount,
            e.payment_status AS paymentStatus, e.enrolled_at AS enrolledAt, e.completed_at AS completedAt,
            (SELECT COUNT(*)
               FROM lessons l
              WHERE l.course_id = e.course_id) AS totalLessons,
            (SELECT COUNT(*)
               FROM class_sessions cs
               JOIN attendance a ON a.session_id = cs.id AND a.user_id = e.user_id
              WHERE cs.course_id = e.course_id AND a.status = 'absent') AS absences,
            (SELECT COUNT(*)
               FROM exams ex
               JOIN exam_results er ON er.exam_id = ex.id AND er.user_id = e.user_id
              WHERE ex.course_id = e.course_id) AS submissions,
            (SELECT ROUND(COALESCE(AVG(er.score), 0), 1)
               FROM exams ex
               JOIN exam_results er ON er.exam_id = ex.id AND er.user_id = e.user_id
              WHERE ex.course_id = e.course_id AND er.status IN ('graded','returned')) AS averageScore
       FROM enrollments e
       JOIN users u ON u.id = e.user_id
       JOIN courses c ON c.id = e.course_id
       LEFT JOIN users t ON t.id = c.teacher_id
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY e.enrolled_at DESC
      LIMIT ?`,
    [...params, Math.min(Number(filters.limit || 200), 1000)]
  );
}

async function updateEnrollment(id, updates) {
  const allowed = {
    status: 'status',
    progress: 'progress',
    completedLessons: 'completed_lessons',
    xp: 'xp',
    paidAmount: 'paid_amount',
    paymentStatus: 'payment_status',
    completedAt: 'completed_at'
  };
  const sets = [];
  const params = [];
  Object.entries(allowed).forEach(([key, column]) => {
    if (Object.prototype.hasOwnProperty.call(updates, key)) {
      sets.push(`${column} = ?`);
      params.push(updates[key] === '' ? null : updates[key]);
    }
  });
  if (!sets.length) return findEnrollmentById(id);
  await query(`UPDATE enrollments SET ${sets.join(', ')} WHERE id = ?`, [...params, id]);
  return findEnrollmentById(id);
}

async function listClassSessions(filters = {}) {
  const where = [];
  const params = [];
  if (filters.courseId) {
    where.push('cs.course_id = ?');
    params.push(filters.courseId);
  }
  if (filters.teacherId) {
    where.push('cs.teacher_id = ?');
    params.push(filters.teacherId);
  }
  if (filters.studentId) {
    where.push('EXISTS (SELECT 1 FROM enrollments se WHERE se.course_id = cs.course_id AND se.user_id = ?)');
    params.push(filters.studentId);
  }
  if (filters.status) {
    where.push('cs.status = ?');
    params.push(filters.status);
  }
  if (filters.dateFrom) {
    where.push('cs.start_at >= ?');
    params.push(filters.dateFrom);
  }
  if (filters.dateTo) {
    where.push('cs.start_at <= ?');
    params.push(filters.dateTo);
  }

  return query(
    `SELECT cs.id, cs.course_id AS courseId, c.name AS courseName,
            cs.teacher_id AS teacherId, t.name AS teacherName,
            cs.title, cs.session_no AS sessionNo, cs.start_at AS startAt,
            cs.end_at AS endAt, cs.meeting_url AS meetingUrl, cs.status,
            COUNT(DISTINCT e.user_id) AS expectedStudents,
            COUNT(DISTINCT CASE WHEN a.status = 'present' THEN a.id END) AS presentCount,
            COUNT(DISTINCT CASE WHEN a.status = 'late' THEN a.id END) AS lateCount,
            COUNT(DISTINCT CASE WHEN a.status = 'absent' THEN a.id END) AS absentCount
       FROM class_sessions cs
       JOIN courses c ON c.id = cs.course_id
       LEFT JOIN users t ON t.id = cs.teacher_id
       LEFT JOIN enrollments e ON e.course_id = c.id AND e.status = 'active'
       LEFT JOIN attendance a ON a.session_id = cs.id
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      GROUP BY cs.id
      ORDER BY cs.start_at ASC
      LIMIT ?`,
    [...params, Math.min(Number(filters.limit || 200), 1000)]
  );
}

async function findClassSessionById(id) {
  const rows = await query(
    `SELECT cs.id, cs.course_id AS courseId, c.name AS courseName,
            cs.teacher_id AS teacherId, t.name AS teacherName,
            cs.title, cs.session_no AS sessionNo, cs.start_at AS startAt,
            cs.end_at AS endAt, cs.meeting_url AS meetingUrl, cs.status,
            COUNT(DISTINCT e.user_id) AS expectedStudents,
            COUNT(DISTINCT CASE WHEN a.status = 'present' THEN a.id END) AS presentCount,
            COUNT(DISTINCT CASE WHEN a.status = 'late' THEN a.id END) AS lateCount,
            COUNT(DISTINCT CASE WHEN a.status = 'absent' THEN a.id END) AS absentCount
       FROM class_sessions cs
       JOIN courses c ON c.id = cs.course_id
       LEFT JOIN users t ON t.id = cs.teacher_id
       LEFT JOIN enrollments e ON e.course_id = c.id AND e.status = 'active'
       LEFT JOIN attendance a ON a.session_id = cs.id
      WHERE cs.id = ?
      GROUP BY cs.id
      LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

async function createClassSession(session) {
  await query(
    `INSERT INTO class_sessions
      (id, course_id, teacher_id, title, session_no, start_at, end_at, meeting_url, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      session.id,
      session.courseId,
      session.teacherId || null,
      session.title,
      session.sessionNo || 1,
      session.startAt,
      session.endAt,
      session.meetingUrl || '',
      session.status || 'scheduled'
    ]
  );
  return findClassSessionById(session.id);
}

async function updateClassSession(id, updates) {
  const allowed = {
    courseId: 'course_id',
    teacherId: 'teacher_id',
    title: 'title',
    sessionNo: 'session_no',
    startAt: 'start_at',
    endAt: 'end_at',
    meetingUrl: 'meeting_url',
    status: 'status'
  };
  const sets = [];
  const params = [];
  Object.entries(allowed).forEach(([key, column]) => {
    if (Object.prototype.hasOwnProperty.call(updates, key)) {
      sets.push(`${column} = ?`);
      params.push(updates[key] === '' ? null : updates[key]);
    }
  });
  if (!sets.length) return findClassSessionById(id);
  await query(`UPDATE class_sessions SET ${sets.join(', ')} WHERE id = ?`, [...params, id]);
  return findClassSessionById(id);
}

async function deleteClassSession(id) {
  const result = await query('DELETE FROM class_sessions WHERE id = ?', [id]);
  return result.affectedRows > 0;
}

async function updateLessonProgress(progress) {
  await query(
    `INSERT INTO lesson_progress
      (id, user_id, lesson_id, status, score, xp, last_opened_at, completed_at)
     VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)
     ON DUPLICATE KEY UPDATE
       status = VALUES(status),
       score = VALUES(score),
       xp = VALUES(xp),
       last_opened_at = CURRENT_TIMESTAMP,
       completed_at = VALUES(completed_at)`,
    [
      progress.id,
      progress.userId,
      progress.lessonId,
      progress.status || 'in_progress',
      progress.score ?? null,
      progress.xp || 0,
      progress.status === 'completed' ? new Date() : null
    ]
  );
}

async function findExamById(id) {
  const rows = await query(
    `SELECT ex.id, ex.course_id AS courseId, c.name AS courseName,
            c.teacher_id AS teacherId, ex.title, ex.type,
            ex.total_score AS totalScore, ex.duration_minutes AS durationMinutes,
            ex.status, ex.published_at AS publishedAt, ex.due_at AS dueAt,
            ex.created_at AS createdAt,
            COUNT(er.id) AS submissions,
            SUM(er.status = 'submitted') AS pendingSubmissions,
            ROUND(COALESCE(AVG(CASE WHEN er.status IN ('graded','returned') THEN er.score END), 0), 1) AS averageScore
       FROM exams ex
       LEFT JOIN courses c ON c.id = ex.course_id
       LEFT JOIN exam_results er ON er.exam_id = ex.id
      WHERE ex.id = ?
      GROUP BY ex.id
      LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

async function listExams(filters = {}) {
  const where = [];
  const params = [];
  if (filters.teacherId) {
    where.push('c.teacher_id = ?');
    params.push(filters.teacherId);
  }
  if (filters.courseId) {
    where.push('ex.course_id = ?');
    params.push(filters.courseId);
  }
  if (filters.studentId) {
    where.push(`EXISTS (
      SELECT 1 FROM enrollments se
       WHERE se.course_id = ex.course_id
         AND se.user_id = ?
         AND se.status IN ('active', 'completed')
    )`);
    params.push(filters.studentId);
  }
  if (filters.status) {
    where.push('ex.status = ?');
    params.push(filters.status);
  }

  return query(
    `SELECT ex.id, ex.course_id AS courseId, c.name AS courseName,
            c.teacher_id AS teacherId, ex.title, ex.type,
            ex.total_score AS totalScore, ex.duration_minutes AS durationMinutes,
            ex.status, ex.published_at AS publishedAt, ex.due_at AS dueAt,
            ex.created_at AS createdAt,
            COUNT(er.id) AS submissions,
            SUM(er.status = 'submitted') AS pendingSubmissions,
            ROUND(COALESCE(AVG(CASE WHEN er.status IN ('graded','returned') THEN er.score END), 0), 1) AS averageScore
       FROM exams ex
       LEFT JOIN courses c ON c.id = ex.course_id
       LEFT JOIN exam_results er ON er.exam_id = ex.id
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      GROUP BY ex.id
      ORDER BY ex.created_at DESC
      LIMIT ?`,
    [...params, Math.min(Number(filters.limit || 200), 500)]
  );
}

async function createExam(exam) {
  await query(
    `INSERT INTO exams
      (id, course_id, title, type, total_score, duration_minutes, status, due_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      exam.id,
      exam.courseId || null,
      exam.title,
      exam.type || 'quiz',
      exam.totalScore || 10,
      exam.durationMinutes || 60,
      exam.status || 'published',
      exam.dueAt || null
    ]
  );
  if (Array.isArray(exam.questions) && exam.questions.length) {
    const typeMap = {
      multiple_choice: 'multiple_choice',
      true_false: 'true_false',
      essay: 'essay',
      tn: 'multiple_choice',
      tl: 'essay'
    };
    for (let index = 0; index < exam.questions.length; index += 1) {
      const question = exam.questions[index] || {};
      const content = String(question.content || question.body || '').trim();
      if (!content) continue;
      await query(
        `INSERT INTO exam_questions
          (id, exam_id, question_no, content, type, options, correct_answer, explanation)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          question.id || crypto.randomUUID(),
          exam.id,
          Number(question.questionNo || index + 1),
          content,
          typeMap[question.type] || 'multiple_choice',
          question.options ? JSON.stringify(question.options) : null,
          question.correctAnswer || question.correct_answer || '',
          question.explanation || ''
        ]
      );
    }
  }
  return findExamById(exam.id);
}

async function createExamResult(result) {
  await query(
    `INSERT INTO exam_results
      (id, exam_id, user_id, teacher_id, score, status, feedback, xp, graded_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       teacher_id = VALUES(teacher_id),
       score = VALUES(score),
       status = VALUES(status),
       feedback = VALUES(feedback),
       xp = VALUES(xp),
       graded_at = VALUES(graded_at)`,
    [
      result.id,
      result.examId,
      result.userId,
      result.teacherId || null,
      result.score ?? null,
      result.status || (result.score == null ? 'submitted' : 'graded'),
      result.feedback || '',
      result.xp || 0,
      result.score == null ? null : new Date()
    ]
  );
}

async function findExamResultById(id) {
  const rows = await query(
    `SELECT er.id, er.exam_id AS examId, ex.title, ex.type,
            er.user_id AS userId, u.name AS studentName, u.email AS studentEmail,
            er.teacher_id AS teacherId, c.teacher_id AS courseTeacherId,
            c.id AS courseId, c.name AS courseName,
            er.score, er.status, er.feedback, er.xp,
            er.submitted_at AS submittedAt, er.graded_at AS gradedAt
       FROM exam_results er
       JOIN exams ex ON ex.id = er.exam_id
       LEFT JOIN courses c ON c.id = ex.course_id
       JOIN users u ON u.id = er.user_id
      WHERE er.id = ?
      LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

async function listExamResults(filters = {}) {
  const where = [];
  const params = [];
  if (filters.userId) {
    where.push('er.user_id = ?');
    params.push(filters.userId);
  }
  if (filters.examId) {
    where.push('er.exam_id = ?');
    params.push(filters.examId);
  }
  if (filters.status) {
    where.push('er.status = ?');
    params.push(filters.status);
  }
  if (filters.courseTeacherId) {
    where.push('c.teacher_id = ?');
    params.push(filters.courseTeacherId);
  }
  const rows = await query(
    `SELECT er.id, er.exam_id AS examId, ex.title, ex.type,
            er.user_id AS userId, u.name AS studentName, u.email AS studentEmail,
            er.teacher_id AS teacherId, c.teacher_id AS courseTeacherId,
            c.id AS courseId, c.name AS courseName,
            er.score, er.status, er.feedback, er.xp,
            er.submitted_at AS submittedAt, er.graded_at AS gradedAt
       FROM exam_results er
       JOIN exams ex ON ex.id = er.exam_id
       LEFT JOIN courses c ON c.id = ex.course_id
       JOIN users u ON u.id = er.user_id
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY er.submitted_at DESC
      LIMIT ?`,
    [...params, Math.min(Number(filters.limit || 100), 500)]
  );
  return rows;
}

async function gradeExamResult(id, updates) {
  const current = await findExamResultById(id);
  if (!current) return null;
  await query(
    `UPDATE exam_results
        SET teacher_id = ?, score = ?, status = ?, feedback = ?, xp = ?, graded_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
    [
      updates.teacherId || current.teacherId || current.courseTeacherId || null,
      updates.score ?? current.score,
      updates.status || 'graded',
      updates.feedback || '',
      updates.xp ?? Math.round(Number(updates.score || 0) * 10),
      id
    ]
  );
  return findExamResultById(id);
}

async function markAttendance(record) {
  await query(
    `INSERT INTO attendance (id, session_id, user_id, status, note)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE status = VALUES(status), note = VALUES(note), marked_at = CURRENT_TIMESTAMP`,
    [record.id, record.sessionId, record.userId, record.status || 'present', record.note || '']
  );
}

async function createMaterialRequest(request) {
  await query(
    `INSERT INTO teaching_material_requests
      (id, teacher_id, course_id, title, type, status, description, video_url, document_url, admin_note, submitted_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      request.id,
      request.teacherId,
      request.courseId || null,
      request.title,
      request.type || 'lesson',
      request.status || 'submitted',
      request.description || null,
      request.videoUrl || '',
      request.documentUrl || '',
      request.adminNote || null,
      request.submittedAt || new Date()
    ]
  );
  const rows = await listMaterialRequests({ teacherId: request.teacherId, limit: 500 });
  return rows.find(row => row.id === request.id) || null;
}

async function createNotification(notification) {
  await query(
    `INSERT INTO notifications (id, user_id, title, body, type)
     VALUES (?, ?, ?, ?, ?)`,
    [
      notification.id,
      notification.userId || null,
      notification.title,
      notification.body || '',
      notification.type || 'system'
    ]
  );
}

async function listNotifications(filters = {}) {
  const where = [];
  const params = [];
  if (filters.userId) {
    where.push('(n.user_id IS NULL OR n.user_id = ?)');
    params.push(filters.userId);
  }
  if (filters.onlyUserId) {
    where.push('n.user_id = ?');
    params.push(filters.onlyUserId);
  }
  if (filters.type) {
    where.push('n.type = ?');
    params.push(filters.type);
  }
  return query(
    `SELECT n.id, n.user_id AS userId, u.name AS userName,
            n.title, n.body, n.type, n.is_read AS isRead,
            n.created_at AS createdAt
       FROM notifications n
       LEFT JOIN users u ON u.id = n.user_id
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY n.created_at DESC
      LIMIT ?`,
    [...params, Math.min(Number(filters.limit || 100), 500)]
  );
}

async function listMaterialRequests(filters = {}) {
  const where = [];
  const params = [];
  if (filters.teacherId) {
    where.push('mr.teacher_id = ?');
    params.push(filters.teacherId);
  }
  if (filters.courseId) {
    where.push('mr.course_id = ?');
    params.push(filters.courseId);
  }
  if (filters.status) {
    where.push('mr.status = ?');
    params.push(filters.status);
  }
  if (filters.studentId) {
    where.push(`mr.status = 'approved'`);
    where.push(`EXISTS (
      SELECT 1 FROM enrollments se
       WHERE se.course_id = mr.course_id
         AND se.user_id = ?
         AND se.status IN ('active', 'completed')
    )`);
    params.push(filters.studentId);
  }

  return query(
    `SELECT mr.id, mr.teacher_id AS teacherId, t.name AS teacherName,
            mr.course_id AS courseId, c.name AS courseName,
            mr.title, mr.type, mr.status, mr.admin_note AS adminNote,
            mr.description, mr.video_url AS videoUrl, mr.document_url AS documentUrl,
            mr.submitted_at AS submittedAt, mr.created_at AS createdAt
       FROM teaching_material_requests mr
       JOIN users t ON t.id = mr.teacher_id
       LEFT JOIN courses c ON c.id = mr.course_id
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY COALESCE(mr.submitted_at, mr.created_at) DESC
      LIMIT ?`,
    [...params, Math.min(Number(filters.limit || 100), 500)]
  );
}

async function updateMaterialRequest(id, updates) {
  const allowed = {
    status: 'status',
    title: 'title',
    type: 'type',
    description: 'description',
    videoUrl: 'video_url',
    documentUrl: 'document_url',
    adminNote: 'admin_note',
    submittedAt: 'submitted_at'
  };
  const sets = [];
  const params = [];
  Object.entries(allowed).forEach(([key, column]) => {
    if (Object.prototype.hasOwnProperty.call(updates, key)) {
      sets.push(`${column} = ?`);
      params.push(updates[key] === '' ? null : updates[key]);
    }
  });
  if (!sets.length) {
    const rows = await listMaterialRequests({ limit: 500 });
    return rows.find(row => row.id === id) || null;
  }
  await query(`UPDATE teaching_material_requests SET ${sets.join(', ')} WHERE id = ?`, [...params, id]);
  const rows = await listMaterialRequests({ limit: 500 });
  return rows.find(row => row.id === id) || null;
}

async function markNotificationRead(id, userId) {
  const params = [id];
  let scope = '';
  if (userId) {
    scope = ' AND (user_id = ? OR user_id IS NULL)';
    params.push(userId);
  }
  const result = await query(`UPDATE notifications SET is_read = 1 WHERE id = ?${scope}`, params);
  return Number(result.affectedRows || 0) > 0;
}

async function markAllNotificationsRead(userId) {
  await query(
    `UPDATE notifications SET is_read = 1
      WHERE is_read = 0 AND (user_id = ? OR user_id IS NULL)`,
    [userId]
  );
}

function mapQuestion(row) {
  return {
    id: row.id,
    studentId: row.studentId,
    studentName: row.studentName,
    courseId: row.courseId,
    courseName: row.courseName,
    teacherId: row.teacherId,
    teacherName: row.teacherName,
    title: row.title,
    body: row.body,
    answer: row.answer,
    status: row.status,
    createdAt: isoDate(row.createdAt),
    answeredAt: isoDate(row.answeredAt)
  };
}

const QUESTION_SELECT = `SELECT q.id, q.student_id AS studentId, s.name AS studentName,
            q.course_id AS courseId, c.name AS courseName,
            q.teacher_id AS teacherId, t.name AS teacherName,
            q.title, q.body, q.answer, q.status,
            q.created_at AS createdAt, q.answered_at AS answeredAt
       FROM questions q
       JOIN users s ON s.id = q.student_id
       LEFT JOIN courses c ON c.id = q.course_id
       LEFT JOIN users t ON t.id = q.teacher_id`;

async function findQuestionById(id) {
  const rows = await query(`${QUESTION_SELECT} WHERE q.id = ? LIMIT 1`, [id]);
  return rows[0] ? mapQuestion(rows[0]) : null;
}

async function createQuestion(question) {
  await query(
    `INSERT INTO questions (id, student_id, course_id, teacher_id, title, body, status)
     VALUES (?, ?, ?, ?, ?, ?, 'open')`,
    [
      question.id,
      question.studentId,
      question.courseId || null,
      question.teacherId || null,
      question.title || '',
      question.body
    ]
  );
  return findQuestionById(question.id);
}

async function listQuestions(filters = {}) {
  const where = [];
  const params = [];
  if (filters.studentId) {
    where.push('q.student_id = ?');
    params.push(filters.studentId);
  }
  if (filters.status) {
    where.push('q.status = ?');
    params.push(filters.status);
  }
  if (filters.teacherId) {
    where.push('(q.teacher_id = ? OR c.teacher_id = ?)');
    params.push(filters.teacherId, filters.teacherId);
  }
  const rows = await query(
    `${QUESTION_SELECT}
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY q.status ASC, q.created_at DESC
      LIMIT ?`,
    [...params, Math.min(Number(filters.limit || 100), 500)]
  );
  return rows.map(mapQuestion);
}

async function answerQuestion(id, updates) {
  const current = await findQuestionById(id);
  if (!current) return null;
  await query(
    `UPDATE questions
        SET answer = ?, teacher_id = COALESCE(?, teacher_id),
            status = 'answered', answered_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
    [updates.answer, updates.teacherId || null, id]
  );
  return findQuestionById(id);
}

async function listBadges() {
  return query(
    `SELECT id, code, name, description, icon, criteria_type AS criteriaType,
            criteria_value AS criteriaValue, position
       FROM badges
      ORDER BY position ASC, criteria_value ASC`
  );
}

async function getStudentMetrics(userId) {
  const rows = await query(
    `SELECT
        (SELECT COUNT(*) FROM enrollments WHERE user_id = ? AND status = 'active') AS activeCourses,
        (SELECT COALESCE(SUM(completed_lessons), 0) FROM enrollments WHERE user_id = ?) AS completedLessons,
        ((SELECT COALESCE(SUM(xp), 0) FROM enrollments WHERE user_id = ?)
          + (SELECT COALESCE(SUM(xp), 0) FROM exam_results WHERE user_id = ?)
          + (SELECT COALESCE(SUM(xp), 0) FROM learning_activities WHERE user_id = ?)) AS totalXp,
        (SELECT ROUND(COALESCE(AVG(score), 0), 1) FROM exam_results WHERE user_id = ? AND status IN ('graded','returned')) AS averageScore,
        (SELECT COUNT(*) FROM exam_results WHERE user_id = ?) AS examCount`,
    [userId, userId, userId, userId, userId, userId, userId]
  );
  const m = firstRow(rows);
  return {
    xp: toNumber(m.totalXp),
    completed_lessons: toNumber(m.completedLessons),
    average_score: toNumber(m.averageScore),
    active_courses: toNumber(m.activeCourses),
    exam_count: toNumber(m.examCount)
  };
}

async function getStudentBadges(userId) {
  const [badges, metrics, ownedRows] = await Promise.all([
    listBadges(),
    getStudentMetrics(userId),
    query('SELECT badge_id AS badgeId, unlocked_at AS unlockedAt FROM user_badges WHERE user_id = ?', [userId])
  ]);
  const owned = new Map(ownedRows.map(row => [row.badgeId, row.unlockedAt]));
  const toAward = [];
  const result = badges.map(badge => {
    const metricValue = toNumber(metrics[badge.criteriaType]);
    const target = toNumber(badge.criteriaValue);
    const meets = target > 0 && metricValue >= target;
    let unlocked = owned.has(badge.id);
    let unlockedAt = owned.get(badge.id) || null;
    if (meets && !unlocked) {
      unlocked = true;
      unlockedAt = new Date();
      toAward.push(badge.id);
    }
    return {
      id: badge.id,
      code: badge.code,
      name: badge.name,
      description: badge.description,
      icon: badge.icon,
      criteriaType: badge.criteriaType,
      target,
      current: metricValue,
      progress: target > 0 ? Math.min(100, Math.round((metricValue / target) * 100)) : (unlocked ? 100 : 0),
      unlocked,
      unlockedAt: isoDate(unlockedAt)
    };
  });
  for (const badgeId of toAward) {
    await query(
      `INSERT INTO user_badges (id, user_id, badge_id)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE unlocked_at = unlocked_at`,
      [crypto.randomUUID(), userId, badgeId]
    );
  }
  return result;
}

async function listFlashcardSets() {
  const rows = await query(
    `SELECT fs.id, fs.slug, fs.title, fs.topic, fs.description, fs.position,
            COUNT(f.id) AS cardCount
       FROM flashcard_sets fs
       LEFT JOIN flashcards f ON f.set_id = fs.id
      GROUP BY fs.id
      ORDER BY fs.position ASC, fs.title ASC`
  );
  return rows.map(row => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    topic: row.topic,
    description: row.description,
    cardCount: toNumber(row.cardCount)
  }));
}

async function getFlashcardSet(idOrSlug) {
  const setRows = await query(
    `SELECT id, slug, title, topic, description
       FROM flashcard_sets
      WHERE id = ? OR slug = ?
      LIMIT 1`,
    [idOrSlug, idOrSlug]
  );
  const set = setRows[0];
  if (!set) return null;
  const cards = await query(
    `SELECT id, front, back, example, position
       FROM flashcards
      WHERE set_id = ?
      ORDER BY position ASC`,
    [set.id]
  );
  return {
    id: set.id,
    slug: set.slug,
    title: set.title,
    topic: set.topic,
    description: set.description,
    cards: cards.map(card => ({
      id: card.id,
      front: card.front,
      back: card.back,
      example: card.example,
      position: toNumber(card.position)
    }))
  };
}

async function getAdminDashboard() {
  const [
    overviewRows,
    onlineRows,
    weeklyRows,
    revenueRows,
    feeRows,
    attentionRows,
    ratingRows,
    distributionRows,
    statusRows,
    progressRows,
    topRows,
    materialRows,
    newStudentTrendRows,
    submissionRateRows,
    activityHeatmapRows,
    skillRows,
    courseRevenueRows,
    systemAlertRows,
    recentOnlineRows
  ] = await Promise.all([
    query(
      `SELECT
          SUM(role = 'student') AS totalStudents,
          SUM(role = 'teacher') AS totalTeachers,
          SUM(role = 'admin') AS totalAdmins,
          SUM(role = 'student' AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)) AS newStudentsThisWeek,
          SUM(role = 'teacher' AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)) AS newTeachersThisMonth
         FROM users`
    ),
    query(
      `SELECT
          COUNT(DISTINCT s.user_id) AS total,
          COUNT(DISTINCT CASE WHEN u.role = 'student' THEN s.user_id END) AS students,
          COUNT(DISTINCT CASE WHEN u.role = 'teacher' THEN s.user_id END) AS teachers,
          COUNT(DISTINCT CASE WHEN s.current_page LIKE '%baihoc%' OR s.current_page LIKE '%dashboard_hocsinh%' THEN s.user_id END) AS learning
         FROM sessions s
         JOIN users u ON u.id = s.user_id
        WHERE s.last_active_at >= DATE_SUB(NOW(), INTERVAL 90 SECOND)`
    ),
    query(
      `SELECT
          (SELECT COUNT(*) FROM courses WHERE status = 'active') AS activeCourses,
          (SELECT COUNT(*) FROM exam_results WHERE status = 'submitted') AS pendingGrading,
          (SELECT ROUND(COALESCE(AVG(progress), 0), 1) FROM enrollments WHERE status IN ('active', 'completed')) AS averageCompletion,
          (SELECT ROUND(COALESCE(SUM(paid_amount), 0), 0)
             FROM enrollments
            WHERE payment_status = 'paid'
              AND YEAR(enrolled_at) = YEAR(CURDATE())
              AND MONTH(enrolled_at) = MONTH(CURDATE())) AS monthRevenue,
          ((SELECT COALESCE(SUM(xp), 0) FROM enrollments)
            + (SELECT COALESCE(SUM(xp), 0) FROM exam_results)
            + (SELECT COALESCE(SUM(xp), 0) FROM learning_activities)) AS totalXp,
          (SELECT COUNT(*) FROM learning_activities WHERE DATE(created_at) = CURDATE()) AS activitiesToday`
    ),
    query(
      `SELECT YEAR(enrolled_at) AS year, MONTH(enrolled_at) AS month,
              ROUND(SUM(CASE WHEN payment_status = 'paid' THEN paid_amount ELSE 0 END), 0) AS revenue
         FROM enrollments
        WHERE enrolled_at >= DATE_SUB(CURDATE(), INTERVAL 18 MONTH)
        GROUP BY YEAR(enrolled_at), MONTH(enrolled_at)
        ORDER BY year, month`
    ),
    query(
      `SELECT payment_status AS status, ROUND(SUM(paid_amount), 0) AS amount, COUNT(*) AS count
         FROM enrollments
        GROUP BY payment_status`
    ),
    query(
      `SELECT u.id, u.name, u.email, c.name AS courseName, e.progress,
              ROUND(COALESCE(AVG(er.score), 0), 1) AS averageScore,
              COUNT(DISTINCT CASE WHEN a.status = 'absent' THEN a.id END) AS absences
         FROM enrollments e
         JOIN users u ON u.id = e.user_id
         JOIN courses c ON c.id = e.course_id
         LEFT JOIN exams ex ON ex.course_id = c.id
         LEFT JOIN exam_results er ON er.exam_id = ex.id AND er.user_id = u.id AND er.status IN ('graded','returned')
         LEFT JOIN class_sessions cs ON cs.course_id = c.id
         LEFT JOIN attendance a ON a.session_id = cs.id AND a.user_id = u.id
        WHERE e.status = 'active'
        GROUP BY u.id, c.id, e.progress
       HAVING e.progress < 45 OR averageScore < 6 OR absences >= 2
        ORDER BY e.progress ASC, averageScore ASC
        LIMIT 10`
    ),
    query(
      `SELECT t.id, t.name, ROUND(COALESCE(AVG(r.rating), 0), 2) AS rating, COUNT(r.id) AS reviewCount
         FROM users t
         LEFT JOIN teacher_reviews r ON r.teacher_id = t.id
        WHERE t.role = 'teacher'
        GROUP BY t.id
        ORDER BY rating DESC, reviewCount DESC`
    ),
    query(
      `SELECT c.id, c.name, COUNT(e.id) AS students
         FROM courses c
         LEFT JOIN enrollments e ON e.course_id = c.id AND e.status IN ('active','completed')
        WHERE c.status <> 'archived'
        GROUP BY c.id
        ORDER BY students DESC`
    ),
    query(
      `SELECT c.id, c.name,
              SUM(e.status = 'active' AND e.progress >= 60) AS learning,
              SUM(e.status = 'active' AND e.progress >= 30 AND e.progress < 60) AS slow,
              SUM(e.status = 'active' AND e.progress < 30) AS risk,
              SUM(e.status = 'completed') AS completed
         FROM courses c
         LEFT JOIN enrollments e ON e.course_id = c.id
        WHERE c.status <> 'archived'
        GROUP BY c.id
        ORDER BY c.created_at ASC`
    ),
    query(
      `SELECT c.id, c.name,
              YEARWEEK(er.graded_at, 1) AS weekKey,
              MIN(DATE(er.graded_at)) AS weekStart,
              ROUND(AVG(er.score), 1) AS averageScore
         FROM courses c
         LEFT JOIN exams ex ON ex.course_id = c.id
         LEFT JOIN exam_results er ON er.exam_id = ex.id AND er.status IN ('graded','returned')
        WHERE er.graded_at >= DATE_SUB(CURDATE(), INTERVAL 8 WEEK)
        GROUP BY c.id, YEARWEEK(er.graded_at, 1)
        ORDER BY c.name, weekKey`
    ),
    query(
      `SELECT u.id, u.name, ROUND(AVG(er.score), 1) AS averageScore, SUM(er.xp) AS xp
         FROM users u
         JOIN exam_results er ON er.user_id = u.id AND er.status IN ('graded','returned')
        WHERE u.role = 'student'
        GROUP BY u.id
        ORDER BY averageScore DESC, xp DESC
        LIMIT 10`
    ),
    query(
      `SELECT status, COUNT(*) AS count
         FROM teaching_material_requests
        GROUP BY status`
    ),
    query(
      `SELECT YEARWEEK(created_at, 1) AS weekKey,
              MIN(DATE(created_at)) AS weekStart,
              COUNT(*) AS count
         FROM users
        WHERE role = 'student'
          AND created_at >= DATE_SUB(CURDATE(), INTERVAL 12 WEEK)
        GROUP BY YEARWEEK(created_at, 1)
        ORDER BY weekKey`
    ),
    query(
      `SELECT YEARWEEK(er.submitted_at, 1) AS weekKey,
              MIN(DATE(er.submitted_at)) AS weekStart,
              SUM(er.status IN ('graded','returned')) AS graded,
              SUM(er.status = 'submitted') AS pending,
              SUM(ex.due_at IS NOT NULL AND er.submitted_at > ex.due_at) AS late,
              COUNT(*) AS total
         FROM exam_results er
         JOIN exams ex ON ex.id = er.exam_id
        WHERE er.submitted_at >= DATE_SUB(CURDATE(), INTERVAL 8 WEEK)
        GROUP BY YEARWEEK(er.submitted_at, 1)
        ORDER BY weekKey`
    ),
    query(
      `SELECT WEEKDAY(created_at) AS dayIndex,
              HOUR(created_at) AS hour,
              COUNT(*) AS count
         FROM learning_activities
        WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        GROUP BY WEEKDAY(created_at), HOUR(created_at)
        ORDER BY dayIndex, hour`
    ),
    query(
      `SELECT ex.type,
              ROUND(COALESCE(AVG(er.score), 0), 1) AS averageScore,
              COUNT(er.id) AS attempts
         FROM exams ex
         LEFT JOIN exam_results er ON er.exam_id = ex.id AND er.status IN ('graded','returned')
       GROUP BY ex.type
       ORDER BY attempts DESC`
    ),
    query(
      `SELECT c.id, c.name,
              ROUND(COALESCE(SUM(CASE WHEN e.payment_status = 'paid' THEN e.paid_amount ELSE 0 END), 0), 0) AS revenue,
              COUNT(e.id) AS enrollments
         FROM courses c
         LEFT JOIN enrollments e ON e.course_id = c.id
        WHERE c.status <> 'archived'
        GROUP BY c.id
        ORDER BY revenue DESC, enrollments DESC`
    ),
    query(
      `SELECT
          (SELECT COUNT(*)
             FROM exam_results
            WHERE status = 'submitted') AS pendingGrading,
          (SELECT COUNT(*)
             FROM exam_results
            WHERE status = 'submitted'
              AND submitted_at < DATE_SUB(NOW(), INTERVAL 48 HOUR)) AS overdueGrading,
          (SELECT COUNT(*)
             FROM enrollments
            WHERE payment_status = 'overdue') AS overdueFees,
          (SELECT ROUND(COALESCE(SUM(paid_amount), 0), 0)
             FROM enrollments
            WHERE payment_status = 'overdue') AS overdueFeeAmount,
          (SELECT COUNT(*)
             FROM teaching_material_requests
            WHERE status IN ('pending', 'submitted')) AS pendingMaterials,
          (SELECT COUNT(*)
             FROM courses
            WHERE status = 'active'
              AND teacher_id IS NULL) AS coursesWithoutTeacher,
          (SELECT COUNT(*)
             FROM users u
            WHERE u.role = 'student'
              AND NOT EXISTS (
                SELECT 1
                  FROM enrollments e
                 WHERE e.user_id = u.id
              )) AS studentsWithoutEnrollment,
          (SELECT COUNT(*)
             FROM users u
            WHERE u.role = 'student'
              AND NOT EXISTS (
                SELECT 1
                  FROM sessions s
                 WHERE s.user_id = u.id
                   AND s.last_active_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
              )) AS inactiveStudents,
          (SELECT COUNT(*)
             FROM (
               SELECT e.user_id
                 FROM enrollments e
                 LEFT JOIN exams ex ON ex.course_id = e.course_id
                 LEFT JOIN exam_results er ON er.exam_id = ex.id
                  AND er.user_id = e.user_id
                  AND er.status IN ('graded','returned')
                 LEFT JOIN class_sessions cs ON cs.course_id = e.course_id
                 LEFT JOIN attendance a ON a.session_id = cs.id
                  AND a.user_id = e.user_id
                WHERE e.status = 'active'
                GROUP BY e.user_id
               HAVING MIN(e.progress) < 45
                   OR ROUND(COALESCE(AVG(er.score), 0), 1) < 6
                   OR SUM(a.status = 'absent') >= 2
             ) risk_students) AS riskStudents`
    ),
    query(
      `SELECT u.id, u.name, u.role,
              MAX(s.last_active_at) AS lastActiveAt,
              SUBSTRING_INDEX(MAX(CONCAT(DATE_FORMAT(s.last_active_at, '%Y%m%d%H%i%s'), '|', s.current_page)), '|', -1) AS currentPage
         FROM users u
         JOIN sessions s ON s.user_id = u.id AND s.last_active_at >= DATE_SUB(NOW(), INTERVAL 90 SECOND)
        WHERE u.role IN ('student','teacher','admin')
        GROUP BY u.id
        ORDER BY lastActiveAt DESC
        LIMIT 8`
    )
  ]);

  const overview = { ...firstRow(overviewRows), ...firstRow(weeklyRows) };

  return {
    overview: {
      totalStudents: toNumber(overview.totalStudents),
      totalTeachers: toNumber(overview.totalTeachers),
      totalAdmins: toNumber(overview.totalAdmins),
      activeCourses: toNumber(overview.activeCourses),
      pendingGrading: toNumber(overview.pendingGrading),
      monthRevenue: toNumber(overview.monthRevenue),
      averageCompletion: toNumber(overview.averageCompletion),
      totalXp: toNumber(overview.totalXp),
      activitiesToday: toNumber(overview.activitiesToday),
      newStudentsThisWeek: toNumber(overview.newStudentsThisWeek),
      newTeachersThisMonth: toNumber(overview.newTeachersThisMonth)
    },
    online: {
      total: toNumber(firstRow(onlineRows).total),
      students: toNumber(firstRow(onlineRows).students),
      teachers: toNumber(firstRow(onlineRows).teachers),
      learning: toNumber(firstRow(onlineRows).learning),
      updatedAt: new Date().toISOString()
    },
    revenueByMonth: revenueRows.map(row => ({
      year: toNumber(row.year),
      month: toNumber(row.month),
      revenue: toNumber(row.revenue)
    })),
    feeStatus: feeRows.map(row => ({
      status: row.status,
      amount: toNumber(row.amount),
      count: toNumber(row.count)
    })),
    studentAttention: attentionRows.map(row => ({
      id: row.id,
      name: row.name,
      email: row.email,
      courseName: row.courseName,
      progress: toNumber(row.progress),
      averageScore: toNumber(row.averageScore),
      absences: toNumber(row.absences)
    })),
    teacherRatings: ratingRows.map(row => ({
      id: row.id,
      name: row.name,
      rating: toNumber(row.rating),
      reviewCount: toNumber(row.reviewCount)
    })),
    courseDistribution: distributionRows.map(row => ({
      id: row.id,
      name: row.name,
      students: toNumber(row.students)
    })),
    studentStatusByCourse: statusRows.map(row => ({
      id: row.id,
      name: row.name,
      learning: toNumber(row.learning),
      slow: toNumber(row.slow),
      risk: toNumber(row.risk),
      completed: toNumber(row.completed)
    })),
    courseProgress: progressRows.map(row => ({
      id: row.id,
      name: row.name,
      weekKey: String(row.weekKey),
      weekStart: isoDate(row.weekStart),
      averageScore: toNumber(row.averageScore)
    })),
    topStudents: topRows.map(row => ({
      id: row.id,
      name: row.name,
      averageScore: toNumber(row.averageScore),
      xp: toNumber(row.xp)
    })),
    materialRequests: materialRows.map(row => ({
      status: row.status,
      count: toNumber(row.count)
    })),
    newStudentTrend: newStudentTrendRows.map(row => ({
      weekKey: String(row.weekKey),
      weekStart: isoDate(row.weekStart),
      count: toNumber(row.count)
    })),
    submissionRate: submissionRateRows.map(row => ({
      weekKey: String(row.weekKey),
      weekStart: isoDate(row.weekStart),
      graded: toNumber(row.graded),
      pending: toNumber(row.pending),
      late: toNumber(row.late),
      total: toNumber(row.total)
    })),
    activityHeatmap: activityHeatmapRows.map(row => ({
      dayIndex: toNumber(row.dayIndex),
      hour: toNumber(row.hour),
      count: toNumber(row.count)
    })),
    skillAverages: skillRows.map(row => ({
      type: row.type,
      averageScore: toNumber(row.averageScore),
      attempts: toNumber(row.attempts)
    })),
    courseRevenue: courseRevenueRows.map(row => ({
      id: row.id,
      name: row.name,
      revenue: toNumber(row.revenue),
      enrollments: toNumber(row.enrollments)
    })),
    systemAlerts: {
      pendingGrading: toNumber(firstRow(systemAlertRows).pendingGrading),
      overdueGrading: toNumber(firstRow(systemAlertRows).overdueGrading),
      overdueFees: toNumber(firstRow(systemAlertRows).overdueFees),
      overdueFeeAmount: toNumber(firstRow(systemAlertRows).overdueFeeAmount),
      pendingMaterials: toNumber(firstRow(systemAlertRows).pendingMaterials),
      coursesWithoutTeacher: toNumber(firstRow(systemAlertRows).coursesWithoutTeacher),
      studentsWithoutEnrollment: toNumber(firstRow(systemAlertRows).studentsWithoutEnrollment),
      inactiveStudents: toNumber(firstRow(systemAlertRows).inactiveStudents),
      riskStudents: toNumber(firstRow(systemAlertRows).riskStudents)
    },
    recentOnlineUsers: recentOnlineRows.map(row => ({
      id: row.id,
      name: row.name,
      role: row.role,
      lastActiveAt: isoDate(row.lastActiveAt),
      currentPage: row.currentPage || ''
    }))
  };
}

async function getStudentDashboard(userId) {
  const [statsRows, courseRows, examRows, upcomingRows, activityRows, leaderboardRows, notificationRows, weeklyRows, materialRows] = await Promise.all([
    query(
      `SELECT
          (SELECT COUNT(*) FROM enrollments WHERE user_id = ? AND status = 'active') AS activeCourses,
          (SELECT COALESCE(SUM(completed_lessons), 0) FROM enrollments WHERE user_id = ?) AS completedLessons,
          ((SELECT COALESCE(SUM(xp), 0) FROM enrollments WHERE user_id = ?)
            + (SELECT COALESCE(SUM(xp), 0) FROM exam_results WHERE user_id = ?)
            + (SELECT COALESCE(SUM(xp), 0) FROM learning_activities WHERE user_id = ?)) AS totalXp,
          (SELECT ROUND(COALESCE(AVG(score), 0), 1) FROM exam_results WHERE user_id = ? AND status IN ('graded','returned')) AS averageExamScore,
          (SELECT COALESCE(SUM(xp), 0) FROM learning_activities WHERE user_id = ? AND DATE(created_at) = CURDATE()) AS todayXp`,
      [userId, userId, userId, userId, userId, userId, userId]
    ),
    query(
      `SELECT e.id, c.id AS courseId, c.name, c.slug, c.level, c.duration_weeks AS durationWeeks,
              c.price, t.name AS teacherName, e.status, e.progress,
              e.completed_lessons AS completedLessons, e.xp, e.enrolled_at AS enrolledAt,
              COUNT(l.id) AS totalLessons
         FROM enrollments e
         JOIN courses c ON c.id = e.course_id
         LEFT JOIN users t ON t.id = c.teacher_id
         LEFT JOIN lessons l ON l.course_id = c.id AND l.status = 'published'
        WHERE e.user_id = ?
        GROUP BY e.id
        ORDER BY e.enrolled_at DESC`,
      [userId]
    ),
    query(
      `SELECT er.id, er.score, er.status, er.xp, er.submitted_at AS submittedAt,
              er.graded_at AS gradedAt, ex.title, ex.type, c.name AS courseName
         FROM exam_results er
         JOIN exams ex ON ex.id = er.exam_id
         LEFT JOIN courses c ON c.id = ex.course_id
        WHERE er.user_id = ?
        ORDER BY er.submitted_at DESC
        LIMIT 8`,
      [userId]
    ),
    query(
      `SELECT cs.id, cs.title, cs.session_no AS sessionNo, cs.start_at AS startAt,
              cs.end_at AS endAt, cs.meeting_url AS meetingUrl, c.name AS courseName,
              t.name AS teacherName
         FROM class_sessions cs
         JOIN courses c ON c.id = cs.course_id
         JOIN enrollments e ON e.course_id = c.id AND e.user_id = ? AND e.status = 'active'
         LEFT JOIN users t ON t.id = cs.teacher_id
        WHERE cs.start_at >= NOW() AND cs.status = 'scheduled'
        ORDER BY cs.start_at ASC
        LIMIT 6`,
      [userId]
    ),
    query(
      `SELECT id, type, title, xp, created_at AS createdAt
         FROM learning_activities
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT 10`,
      [userId]
    ),
    query(
      `SELECT u.id, u.name,
              COALESCE(ex.xp, 0) + COALESCE(er.xp, 0) + COALESCE(la.xp, 0) AS xp
         FROM users u
         LEFT JOIN (SELECT user_id, SUM(xp) AS xp FROM enrollments GROUP BY user_id) ex ON ex.user_id = u.id
         LEFT JOIN (SELECT user_id, SUM(xp) AS xp FROM exam_results GROUP BY user_id) er ON er.user_id = u.id
         LEFT JOIN (SELECT user_id, SUM(xp) AS xp FROM learning_activities GROUP BY user_id) la ON la.user_id = u.id
        WHERE u.role = 'student'
        ORDER BY xp DESC
        LIMIT 10`
    ),
    query(
      `SELECT id, title, body, type, is_read AS isRead, created_at AS createdAt
         FROM notifications
        WHERE user_id = ? OR user_id IS NULL
        ORDER BY created_at DESC
        LIMIT 10`,
      [userId]
    ),
    query(
      `SELECT YEARWEEK(created_at, 1) AS weekKey,
              SUM(xp) AS xp,
              COUNT(*) AS activities
         FROM learning_activities
        WHERE user_id = ? AND created_at >= DATE_SUB(CURDATE(), INTERVAL 8 WEEK)
        GROUP BY YEARWEEK(created_at, 1)
        ORDER BY weekKey`,
      [userId]
    ),
    query(
      `SELECT mr.id, mr.title, mr.type, mr.description,
              mr.video_url AS videoUrl, mr.document_url AS documentUrl,
              mr.created_at AS createdAt, mr.submitted_at AS submittedAt,
              c.id AS courseId, c.name AS courseName, t.name AS teacherName
         FROM teaching_material_requests mr
         JOIN courses c ON c.id = mr.course_id
         JOIN enrollments e ON e.course_id = c.id AND e.user_id = ? AND e.status IN ('active', 'completed')
         LEFT JOIN users t ON t.id = mr.teacher_id
        WHERE mr.status = 'approved'
        ORDER BY COALESCE(mr.submitted_at, mr.created_at) DESC
        LIMIT 50`,
      [userId]
    )
  ]);

  const stats = firstRow(statsRows);
  const badges = await getStudentBadges(userId);
  return {
    stats: {
      activeCourses: toNumber(stats.activeCourses),
      completedLessons: toNumber(stats.completedLessons),
      averageExamScore: toNumber(stats.averageExamScore),
      totalXp: toNumber(stats.totalXp),
      todayXp: toNumber(stats.todayXp)
    },
    badges,
    courses: courseRows.map(row => ({
      id: row.courseId,
      name: row.name,
      slug: row.slug,
      level: row.level,
      teacherName: row.teacherName,
      status: row.status,
      progress: toNumber(row.progress),
      completedLessons: toNumber(row.completedLessons),
      totalLessons: toNumber(row.totalLessons),
      xp: toNumber(row.xp),
      enrolledAt: isoDate(row.enrolledAt)
    })),
    recentExamResults: examRows.map(row => ({
      id: row.id,
      title: row.title,
      type: row.type,
      courseName: row.courseName,
      score: row.score == null ? null : toNumber(row.score),
      status: row.status,
      xp: toNumber(row.xp),
      submittedAt: isoDate(row.submittedAt),
      gradedAt: isoDate(row.gradedAt)
    })),
    upcomingSessions: upcomingRows.map(row => ({
      id: row.id,
      title: row.title,
      courseName: row.courseName,
      teacherName: row.teacherName,
      sessionNo: toNumber(row.sessionNo),
      startAt: isoDate(row.startAt),
      endAt: isoDate(row.endAt),
      meetingUrl: row.meetingUrl
    })),
    activities: activityRows.map(row => ({
      id: row.id,
      type: row.type,
      title: row.title,
      xp: toNumber(row.xp),
      createdAt: isoDate(row.createdAt)
    })),
    leaderboard: leaderboardRows.map((row, index) => ({
      rank: index + 1,
      id: row.id,
      name: row.name,
      xp: toNumber(row.xp),
      isCurrentUser: row.id === userId
    })),
    notifications: notificationRows.map(row => ({
      id: row.id,
      title: row.title,
      body: row.body,
      type: row.type,
      isRead: Boolean(row.isRead),
      createdAt: isoDate(row.createdAt)
    })),
    weeklyProgress: weeklyRows.map(row => ({
      weekKey: String(row.weekKey),
      xp: toNumber(row.xp),
      activities: toNumber(row.activities)
    })),
    materials: materialRows.map(row => ({
      id: row.id,
      title: row.title,
      name: row.title,
      type: row.type,
      description: row.description || '',
      videoUrl: row.videoUrl || '',
      documentUrl: row.documentUrl || '',
      url: row.documentUrl || row.videoUrl || '',
      courseId: row.courseId,
      courseName: row.courseName,
      teacherName: row.teacherName,
      createdAt: isoDate(row.createdAt),
      submittedAt: isoDate(row.submittedAt)
    }))
  };
}

async function getTeacherDashboard(teacherId) {
  const [statsRows, courseRows, studentRows, attentionRows, pendingRows, todayRows, reviewRows, materialRows] = await Promise.all([
    query(
      `SELECT
          (SELECT COUNT(DISTINCT e.user_id)
             FROM enrollments e
             JOIN courses c ON c.id = e.course_id
            WHERE c.teacher_id = ? AND c.status = 'active' AND e.status = 'active') AS totalStudents,
          (SELECT COUNT(*) FROM courses WHERE teacher_id = ? AND status = 'active') AS activeCourses,
          (SELECT COUNT(*)
             FROM exam_results er
             JOIN exams ex ON ex.id = er.exam_id
             JOIN courses c ON c.id = ex.course_id
            WHERE c.teacher_id = ? AND er.status = 'submitted') AS pendingGrading,
          (SELECT ROUND(COALESCE(AVG(rating), 0), 2) FROM teacher_reviews WHERE teacher_id = ?) AS averageRating`,
      [teacherId, teacherId, teacherId, teacherId]
    ),
    query(
      `SELECT c.id, c.name, c.level, COUNT(DISTINCT e.user_id) AS students,
              ROUND(COALESCE(AVG(e.progress), 0), 1) AS averageProgress,
              ROUND(COALESCE(AVG(er.score), 0), 1) AS averageScore
         FROM courses c
         LEFT JOIN enrollments e ON e.course_id = c.id AND e.status = 'active'
         LEFT JOIN exams ex ON ex.course_id = c.id
         LEFT JOIN exam_results er ON er.exam_id = ex.id AND er.status IN ('graded','returned')
        WHERE c.teacher_id = ?
        GROUP BY c.id
        ORDER BY c.created_at DESC`,
      [teacherId]
    ),
    query(
      `SELECT u.id, u.name, u.email, u.phone, u.education AS className,
              c.name AS courseName, e.progress, e.completed_lessons AS completedLessons,
              ROUND(COALESCE(AVG(er.score), 0), 1) AS averageScore,
              COUNT(DISTINCT CASE WHEN a.status = 'absent' THEN a.id END) AS absences,
              COUNT(DISTINCT er.id) AS submissions
         FROM courses c
         JOIN enrollments e ON e.course_id = c.id AND e.status IN ('active','completed')
         JOIN users u ON u.id = e.user_id
         LEFT JOIN exams ex ON ex.course_id = c.id
         LEFT JOIN exam_results er ON er.exam_id = ex.id AND er.user_id = u.id
         LEFT JOIN class_sessions cs ON cs.course_id = c.id
         LEFT JOIN attendance a ON a.session_id = cs.id AND a.user_id = u.id
        WHERE c.teacher_id = ?
        GROUP BY u.id, u.name, u.email, u.phone, u.education, c.id, c.name, e.progress, e.completed_lessons
        ORDER BY c.name ASC, u.name ASC
        LIMIT 200`,
      [teacherId]
    ),
    query(
      `SELECT u.id, u.name, u.email, c.name AS courseName, e.progress,
              ROUND(COALESCE(AVG(er.score), 0), 1) AS averageScore,
              COUNT(DISTINCT CASE WHEN a.status = 'absent' THEN a.id END) AS absences
         FROM courses c
         JOIN enrollments e ON e.course_id = c.id AND e.status = 'active'
         JOIN users u ON u.id = e.user_id
         LEFT JOIN exams ex ON ex.course_id = c.id
         LEFT JOIN exam_results er ON er.exam_id = ex.id AND er.user_id = u.id AND er.status IN ('graded','returned')
         LEFT JOIN class_sessions cs ON cs.course_id = c.id
         LEFT JOIN attendance a ON a.session_id = cs.id AND a.user_id = u.id
        WHERE c.teacher_id = ?
        GROUP BY u.id, c.id, e.progress
       HAVING e.progress < 45 OR averageScore < 6 OR absences >= 2
        ORDER BY e.progress ASC, averageScore ASC
        LIMIT 8`,
      [teacherId]
    ),
    query(
      `SELECT er.id, u.name AS studentName, ex.title, c.name AS courseName,
              er.submitted_at AS submittedAt
         FROM exam_results er
         JOIN exams ex ON ex.id = er.exam_id
         JOIN courses c ON c.id = ex.course_id
         JOIN users u ON u.id = er.user_id
        WHERE c.teacher_id = ? AND er.status = 'submitted'
        ORDER BY er.submitted_at ASC
        LIMIT 10`,
      [teacherId]
    ),
    query(
      `SELECT cs.id, cs.title, cs.session_no AS sessionNo, cs.start_at AS startAt,
              cs.end_at AS endAt, cs.meeting_url AS meetingUrl, cs.status,
              c.name AS courseName, COUNT(e.user_id) AS expectedStudents,
              SUM(a.status = 'absent') AS absences
         FROM class_sessions cs
         JOIN courses c ON c.id = cs.course_id
         LEFT JOIN enrollments e ON e.course_id = c.id AND e.status = 'active'
         LEFT JOIN attendance a ON a.session_id = cs.id
        WHERE cs.teacher_id = ? AND DATE(cs.start_at) = CURDATE()
        GROUP BY cs.id
        ORDER BY cs.start_at ASC`,
      [teacherId]
    ),
    query(
      `SELECT rating, COUNT(*) AS count
         FROM teacher_reviews
        WHERE teacher_id = ?
        GROUP BY rating
        ORDER BY rating`,
      [teacherId]
    ),
    query(
      `SELECT id, title, type, status, description,
              video_url AS videoUrl, document_url AS documentUrl,
              admin_note AS adminNote,
              submitted_at AS submittedAt, created_at AS createdAt
         FROM teaching_material_requests
        WHERE teacher_id = ?
        ORDER BY created_at DESC
        LIMIT 10`,
      [teacherId]
    )
  ]);

  const stats = firstRow(statsRows);
  return {
    stats: {
      totalStudents: toNumber(stats.totalStudents),
      activeCourses: toNumber(stats.activeCourses),
      pendingGrading: toNumber(stats.pendingGrading),
      averageRating: toNumber(stats.averageRating)
    },
    courses: courseRows.map(row => ({
      id: row.id,
      name: row.name,
      level: row.level,
      students: toNumber(row.students),
      averageProgress: toNumber(row.averageProgress),
      averageScore: toNumber(row.averageScore)
    })),
    students: studentRows.map(row => ({
      id: row.id,
      name: row.name,
      email: row.email,
      phone: row.phone,
      className: row.className,
      courseName: row.courseName,
      progress: toNumber(row.progress),
      completedLessons: toNumber(row.completedLessons),
      averageScore: toNumber(row.averageScore),
      absences: toNumber(row.absences),
      submissions: toNumber(row.submissions)
    })),
    attentionStudents: attentionRows.map(row => ({
      id: row.id,
      name: row.name,
      email: row.email,
      courseName: row.courseName,
      progress: toNumber(row.progress),
      averageScore: toNumber(row.averageScore),
      absences: toNumber(row.absences)
    })),
    pendingSubmissions: pendingRows.map(row => ({
      id: row.id,
      studentName: row.studentName,
      title: row.title,
      courseName: row.courseName,
      submittedAt: isoDate(row.submittedAt)
    })),
    todaySessions: todayRows.map(row => ({
      id: row.id,
      title: row.title,
      courseName: row.courseName,
      sessionNo: toNumber(row.sessionNo),
      startAt: isoDate(row.startAt),
      endAt: isoDate(row.endAt),
      meetingUrl: row.meetingUrl,
      status: row.status,
      expectedStudents: toNumber(row.expectedStudents),
      absences: toNumber(row.absences)
    })),
    ratingDistribution: reviewRows.map(row => ({
      rating: toNumber(row.rating),
      count: toNumber(row.count)
    })),
    materialRequests: materialRows.map(row => ({
      id: row.id,
      title: row.title,
      type: row.type,
      status: row.status,
      description: row.description || '',
      videoUrl: row.videoUrl || '',
      documentUrl: row.documentUrl || '',
      adminNote: row.adminNote,
      submittedAt: isoDate(row.submittedAt),
      createdAt: isoDate(row.createdAt)
    }))
  };
}

async function getExamDetail(examId) {
  const [examRows, questionRows] = await Promise.all([
    query(
      `SELECT ex.id, ex.title, ex.type, ex.total_score AS totalScore,
              ex.duration_minutes AS durationMinutes, ex.status,
              ex.published_at AS publishedAt, ex.due_at AS dueAt,
              ex.course_id AS courseId, c.teacher_id AS teacherId
         FROM exams ex
         LEFT JOIN courses c ON c.id = ex.course_id
        WHERE ex.id = ?
        LIMIT 1`,
      [examId]
    ),
    query(
      `SELECT id, question_no AS questionNo, content, type, options, correct_answer AS correctAnswer,
              explanation
         FROM exam_questions
        WHERE exam_id = ?
        ORDER BY question_no ASC`,
      [examId]
    )
  ]);

  const exam = examRows[0];
  if (!exam) return null;

  return {
    id: exam.id,
    title: exam.title,
    type: exam.type,
    totalScore: toNumber(exam.totalScore),
    durationMinutes: toNumber(exam.durationMinutes),
    status: exam.status,
    publishedAt: isoDate(exam.publishedAt),
    dueAt: isoDate(exam.dueAt),
    courseId: exam.courseId,
    teacherId: exam.teacherId,
    questions: questionRows.map(q => {
      let options = [];
      try {
        options = q.options ? JSON.parse(q.options) : [];
      } catch {
        options = [];
      }
      return {
        id: q.id,
        questionNo: toNumber(q.questionNo),
        content: q.content,
        type: q.type,
        options: options,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation
      };
    })
  };
}

module.exports = {
  DB_CONFIG,
  query,
  pingDatabase,
  findUserByEmail,
  findUserById,
  createUser,
  deleteUser,
  updateUser,
  listUsers,
  createSession,
  findSessionUser,
  touchSession,
  deleteSession,
  createSubmission,
  findSubmissionById,
  listSubmissions,
  updateSubmission,
  listCourses,
  findCourseById,
  createCourse,
  updateCourse,
  deleteCourse,
  enrollUser,
  findEnrollmentById,
  listEnrollments,
  updateEnrollment,
  listClassSessions,
  findClassSessionById,
  createClassSession,
  updateClassSession,
  deleteClassSession,
  updateLessonProgress,
  findExamById,
  listExams,
  createExam,
  createExamResult,
  findExamResultById,
  listExamResults,
  gradeExamResult,
  markAttendance,
  createMaterialRequest,
  createNotification,
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  createQuestion,
  listQuestions,
  findQuestionById,
  answerQuestion,
  listBadges,
  getStudentBadges,
  listFlashcardSets,
  getFlashcardSet,
  listMaterialRequests,
  updateMaterialRequest,
  getAdminDashboard,
  getStudentDashboard,
  getTeacherDashboard,
  getExamDetail
};
