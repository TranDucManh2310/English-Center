const crypto = require('crypto');
const db = require('../repositories');
const { sendJson, parseBody, getBearerToken, idFromPath } = require('../http/request');
const { createUserRecord, normalizeEmail, publicUser, slugify, verifyPassword } = require('../services/user-service');
const { assistantFallbackReply, callAssistantService } = require('../services/assistant-service');
const { createSession } = require('../services/session-service');

async function findSessionUser(req) {
  const token = getBearerToken(req);
  if (!token) return null;
  return db.findSessionUser(token);
}

async function requireUser(req, res, roles) {
  const user = await findSessionUser(req);
  if (!user) {
    sendJson(res, 401, { ok: false, message: 'Chua dang nhap.' });
    return null;
  }
  if (roles && roles.length && !roles.includes(user.role)) {
    sendJson(res, 403, { ok: false, message: 'Khong co quyen truy cap.' });
    return null;
  }
  return user;
}

async function handleApi(req, res, pathname) {
  if (req.method === 'GET' && pathname === '/api/health') {
    try {
      await db.pingDatabase();
      return sendJson(res, 200, {
        ok: true,
        name: 'English Center API',
        database: db.DB_CONFIG.database,
        time: new Date().toISOString()
      });
    } catch (error) {
      return sendJson(res, 503, {
        ok: false,
        name: 'English Center API',
        database: db.DB_CONFIG.database,
        message: 'Khong ket noi duoc MySQL. Hay bat MySQL trong XAMPP va import backend/database.sql.',
        detail: error.message
      });
    }
  }

  if (req.method === 'GET' && pathname === '/api/public/courses') {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const courses = await db.listCourses({
      status: url.searchParams.get('status') || 'active',
      teacherId: url.searchParams.get('teacherId') || ''
    });
    return sendJson(res, 200, { ok: true, courses });
  }

  if (req.method === 'GET' && pathname === '/api/public/teachers') {
    const teachers = await db.listUsers({
      role: 'teacher',
      q: '',
      limit: 100
    });
    const courses = await db.listCourses({ status: 'active' });
    const courseCountByTeacher = courses.reduce((map, course) => {
      if (course.teacherId) map[course.teacherId] = (map[course.teacherId] || 0) + 1;
      return map;
    }, {});
    return sendJson(res, 200, {
      ok: true,
      teachers: teachers.map(teacher => ({
        ...publicUser(teacher),
        courseCount: courseCountByTeacher[teacher.id] || 0
      }))
    });
  }

  if (req.method === 'GET' && pathname === '/api/public/materials') {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const requests = await db.listMaterialRequests({
      courseId: url.searchParams.get('courseId') || '',
      status: 'approved',
      limit: url.searchParams.get('limit') || 100
    });
    return sendJson(res, 200, { ok: true, materials: requests });
  }

  if (req.method === 'POST' && pathname === '/api/auth/register') {
    const body = await parseBody(req);
    const email = normalizeEmail(body.email);
    const password = String(body.password || '');
    const firstName = String(body.firstName || '').trim();
    const lastName = String(body.lastName || '').trim();
    const name = String(body.name || `${firstName} ${lastName}`.trim() || email).trim();

    if (!email || !/\S+@\S+\.\S+/.test(email)) {
      return sendJson(res, 400, { ok: false, message: 'Email khong hop le.' });
    }
    if (password.length < 6) {
      return sendJson(res, 400, { ok: false, message: 'Mat khau phai co it nhat 6 ky tu.' });
    }

    const existingUser = await db.findUserByEmail(email);
    if (existingUser) {
      return sendJson(res, 409, { ok: false, message: 'Email da duoc dang ky.' });
    }

    const userRecord = createUserRecord({
      email,
      password,
      name,
      role: body.role === 'teacher' ? 'teacher' : 'student',
      phone: body.phone,
      education: body.education,
      experience: body.experience,
      motivation: body.motivation,
      schedule: body.schedule,
      newsletter: body.newsletter
    });
    const user = await db.createUser(userRecord);

    const token = await createSession(user.id);
    return sendJson(res, 201, { ok: true, token, user: publicUser(user) });
  }

  if (req.method === 'POST' && pathname === '/api/auth/login') {
    const body = await parseBody(req);
    const email = normalizeEmail(body.email);
    const password = String(body.password || '');
    const user = await db.findUserByEmail(email);

    if (!user || !verifyPassword(password, user.passwordHash)) {
      return sendJson(res, 401, { ok: false, message: 'Email hoac mat khau khong dung.' });
    }

    const token = await createSession(user.id);
    return sendJson(res, 200, { ok: true, token, user: publicUser(user) });
  }

  if (req.method === 'GET' && pathname === '/api/auth/me') {
    const user = await findSessionUser(req);
    if (!user) return sendJson(res, 401, { ok: false, message: 'Chua dang nhap.' });
    return sendJson(res, 200, { ok: true, user: publicUser(user) });
  }

  if (req.method === 'POST' && pathname === '/api/auth/logout') {
    const token = getBearerToken(req);
    if (token) await db.deleteSession(token);
    return sendJson(res, 200, { ok: true });
  }

  if (req.method === 'POST' && pathname === '/api/contact') {
    const body = await parseBody(req);
    await db.createSubmission({
      id: crypto.randomUUID(),
      type: body.type || 'contact',
      data: body
    });
    return sendJson(res, 201, { ok: true, message: 'Da ghi nhan thong tin.' });
  }

  if (req.method === 'POST' && pathname === '/api/chat') {
    const body = await parseBody(req);
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const payload = {
      system: body.system || '',
      messages,
      context: body.context || {},
      source: 'english-center-web'
    };
    let reply = '';
    let source = 'service';
    try {
      reply = await callAssistantService(payload);
    } catch (error) {
      console.warn('[assistant] service unavailable:', error.message);
    }
    if (!reply) {
      reply = assistantFallbackReply(messages);
      source = 'fallback';
    }
    await db.createSubmission({
      id: crypto.randomUUID(),
      type: 'chat',
      data: {
        source,
        system: payload.system,
        messages,
        reply,
        createdAt: new Date().toISOString()
      }
    }).catch(error => console.warn('[assistant] log failed:', error.message));
    return sendJson(res, 200, { ok: true, content: [{ text: reply }] });
  }

  if (req.method === 'POST' && pathname === '/api/speaking-submissions') {
    const user = await requireUser(req, res, ['student', 'admin']);
    if (!user) return;
    const body = await parseBody(req);
    await db.createSubmission({
      id: crypto.randomUUID(),
      type: 'speaking',
      data: {
        ...body,
        userId: user.role === 'admin' && body.userId ? body.userId : user.id,
        submittedAt: body.submittedAt || new Date().toISOString()
      }
    });
    return sendJson(res, 201, { ok: true, message: 'Da ghi nhan bai speaking.' });
  }

  if (req.method === 'GET' && pathname === '/api/speaking-submissions') {
    const user = await requireUser(req, res, ['student', 'teacher', 'admin']);
    if (!user) return;
    const url = new URL(req.url, `http://${req.headers.host}`);
    const filters = {
      type: 'speaking',
      limit: url.searchParams.get('limit') || 100
    };
    if (user.role === 'student') filters.userId = user.id;
    else if (url.searchParams.get('userId')) filters.userId = url.searchParams.get('userId');
    const submissions = await db.listSubmissions(filters);
    return sendJson(res, 200, { ok: true, submissions });
  }

  const speakingSubmissionId = idFromPath(pathname, '/api/speaking-submissions/');
  if (req.method === 'PATCH' && speakingSubmissionId && !speakingSubmissionId.includes('/')) {
    const user = await requireUser(req, res, ['teacher', 'admin']);
    if (!user) return;
    const current = await db.findSubmissionById(speakingSubmissionId);
    if (!current || current.type !== 'speaking') {
      return sendJson(res, 404, { ok: false, message: 'Khong tim thay bai speaking.' });
    }
    const body = await parseBody(req);
    const updated = await db.updateSubmission(speakingSubmissionId, {
      status: body.status || 'reviewed',
      score: body.score,
      feedback: body.feedback || '',
      reviewedBy: user.id,
      reviewedAt: new Date().toISOString()
    });
    return sendJson(res, 200, { ok: true, submission: updated });
  }

  if (req.method === 'POST' && pathname === '/api/analytics') {
    const user = await requireUser(req, res, ['admin', 'teacher', 'student']);
    if (!user) return;
    const body = await parseBody(req);
    await db.createSubmission({
      id: crypto.randomUUID(),
      type: 'analytics',
      data: {
        ...body,
        userId: body.userId || user.id,
        role: user.role,
        receivedAt: new Date().toISOString()
      }
    });
    return sendJson(res, 201, { ok: true });
  }

  if (req.method === 'GET' && pathname === '/api/submissions') {
    const user = await requireUser(req, res, ['admin']);
    if (!user) return;
    const url = new URL(req.url, `http://${req.headers.host}`);
    const submissions = await db.listSubmissions({
      type: url.searchParams.get('type') || '',
      userId: url.searchParams.get('userId') || '',
      limit: url.searchParams.get('limit') || 100
    });
    return sendJson(res, 200, { ok: true, submissions });
  }

  if (req.method === 'GET' && pathname === '/api/dashboard/admin') {
    const user = await requireUser(req, res, ['admin']);
    if (!user) return;
    const dashboard = await db.getAdminDashboard();
    return sendJson(res, 200, { ok: true, dashboard });
  }

  if (req.method === 'GET' && pathname === '/api/dashboard/teacher') {
    const user = await requireUser(req, res, ['teacher', 'admin']);
    if (!user) return;
    const url = new URL(req.url, `http://${req.headers.host}`);
    const teacherId = user.role === 'admin' && url.searchParams.get('teacherId')
      ? url.searchParams.get('teacherId')
      : user.id;
    const dashboard = await db.getTeacherDashboard(teacherId);
    return sendJson(res, 200, { ok: true, dashboard });
  }

  if (req.method === 'GET' && pathname === '/api/dashboard/student') {
    const user = await requireUser(req, res, ['student', 'admin']);
    if (!user) return;
    const url = new URL(req.url, `http://${req.headers.host}`);
    const studentId = user.role === 'admin' && url.searchParams.get('studentId')
      ? url.searchParams.get('studentId')
      : user.id;
    const dashboard = await db.getStudentDashboard(studentId);
    return sendJson(res, 200, { ok: true, dashboard });
  }

  const examId = idFromPath(pathname, '/api/exams/');
  if (req.method === 'GET' && examId && !examId.includes('/')) {
    const user = await requireUser(req, res, ['student', 'teacher', 'admin']);
    if (!user) return;
    const exam = await db.getExamDetail(examId);
    if (!exam) {
      return sendJson(res, 404, { ok: false, message: 'Exam not found' });
    }
    return sendJson(res, 200, { ok: true, exam });
  }

  if (req.method === 'GET' && pathname === '/api/users') {
    const user = await requireUser(req, res, ['admin', 'teacher']);
    if (!user) return;
    const url = new URL(req.url, `http://${req.headers.host}`);
    const role = url.searchParams.get('role') || '';
    if (user.role === 'teacher' && role && role !== 'student') {
      return sendJson(res, 403, { ok: false, message: 'Giao vien chi duoc xem danh sach hoc vien.' });
    }
    const users = await db.listUsers({
      role: user.role === 'teacher' ? 'student' : role,
      q: url.searchParams.get('q') || '',
      limit: url.searchParams.get('limit') || 100
    });
    return sendJson(res, 200, { ok: true, users: users.map(publicUser) });
  }

  if (req.method === 'POST' && pathname === '/api/users') {
    const actor = await requireUser(req, res, ['admin', 'teacher']);
    if (!actor) return;
    const body = await parseBody(req);
    const email = normalizeEmail(body.email);
    const password = String(body.password || '123456');
    let role = ['student', 'teacher', 'admin'].includes(body.role) ? body.role : 'student';
    if (actor.role === 'teacher') role = 'student';
    const name = String(body.name || email).trim();

    if (!email || !/\S+@\S+\.\S+/.test(email)) {
      return sendJson(res, 400, { ok: false, message: 'Email khong hop le.' });
    }
    if (!name) return sendJson(res, 400, { ok: false, message: 'Ten nguoi dung la bat buoc.' });
    if (password.length < 6) return sendJson(res, 400, { ok: false, message: 'Mat khau phai co it nhat 6 ky tu.' });

    const existing = await db.findUserByEmail(email);
    if (existing) return sendJson(res, 409, { ok: false, message: 'Email da ton tai.' });

    let teacherCourse = null;
    if (actor.role === 'teacher') {
      if (!body.courseId) return sendJson(res, 400, { ok: false, message: 'Vui long chon lop hoc.' });
      teacherCourse = await db.findCourseById(body.courseId);
      if (!teacherCourse) return sendJson(res, 404, { ok: false, message: 'Khong tim thay lop hoc.' });
      if (teacherCourse.teacherId !== actor.id) {
        return sendJson(res, 403, { ok: false, message: 'Giao vien chi duoc them hoc vien vao lop cua minh.' });
      }
    }

    const user = await db.createUser({
      id: crypto.randomUUID(),
      email,
      name,
      role,
      phone: body.phone || '',
      education: body.education || '',
      experience: body.experience || '',
      motivation: body.motivation || '',
      schedule: body.schedule || '',
      newsletter: Boolean(body.newsletter),
      enrolled: [],
      passwordHash: hashPassword(password)
    });
    if (teacherCourse) {
      await db.enrollUser({
        id: crypto.randomUUID(),
        userId: user.id,
        courseId: teacherCourse.id,
        status: 'active',
        progress: 0,
        completedLessons: 0,
        xp: 0,
        paidAmount: 0,
        paymentStatus: 'pending'
      });
    }
    return sendJson(res, 201, { ok: true, user: publicUser(user), defaultPassword: password });
  }

  const userId = idFromPath(pathname, '/api/users/');
  if (req.method === 'PATCH' && userId && !userId.includes('/')) {
    const user = await requireUser(req, res, ['admin']);
    if (!user) return;
    const body = await parseBody(req);
    if (Object.prototype.hasOwnProperty.call(body, 'email')) {
      body.email = normalizeEmail(body.email);
      if (!body.email || !/\S+@\S+\.\S+/.test(body.email)) {
        return sendJson(res, 400, { ok: false, message: 'Email khong hop le.' });
      }
      const existing = await db.findUserByEmail(body.email);
      if (existing && existing.id !== userId) {
        return sendJson(res, 409, { ok: false, message: 'Email da ton tai.' });
      }
    }
    const updated = await db.updateUser(userId, body);
    if (!updated) return sendJson(res, 404, { ok: false, message: 'Khong tim thay nguoi dung.' });
    return sendJson(res, 200, { ok: true, user: publicUser(updated) });
  }

  if (req.method === 'DELETE' && userId && !userId.includes('/')) {
    const admin = await requireUser(req, res, ['admin']);
    if (!admin) return;
    if (admin.id === userId) return sendJson(res, 400, { ok: false, message: 'Khong the xoa tai khoan dang dang nhap.' });
    const deleted = await db.deleteUser(userId);
    if (!deleted) return sendJson(res, 404, { ok: false, message: 'Khong tim thay nguoi dung.' });
    return sendJson(res, 200, { ok: true });
  }

  if (req.method === 'GET' && pathname === '/api/courses') {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const courses = await db.listCourses({
      status: url.searchParams.get('status') || '',
      teacherId: url.searchParams.get('teacherId') || ''
    });
    return sendJson(res, 200, { ok: true, courses });
  }

  if (req.method === 'POST' && pathname === '/api/courses') {
    const user = await requireUser(req, res, ['admin']);
    if (!user) return;
    const body = await parseBody(req);
    const name = String(body.name || '').trim();
    if (!name) return sendJson(res, 400, { ok: false, message: 'Ten khoa hoc la bat buoc.' });

    const course = await db.createCourse({
      id: crypto.randomUUID(),
      slug: body.slug ? slugify(body.slug) : slugify(name),
      name,
      description: body.description,
      level: body.level,
      status: body.status || 'active',
      price: Number(body.price || 0),
      durationWeeks: Number(body.durationWeeks || body.duration_weeks || 8),
      capacity: Number(body.capacity || 40),
      teacherId: body.teacherId || body.teacher_id || null,
      startDate: body.startDate || body.start_date || null,
      endDate: body.endDate || body.end_date || null
    });
    return sendJson(res, 201, { ok: true, course });
  }

  const courseId = idFromPath(pathname, '/api/courses/');
  if (req.method === 'GET' && courseId && !courseId.includes('/')) {
    const course = await db.findCourseById(courseId);
    if (!course) return sendJson(res, 404, { ok: false, message: 'Khong tim thay khoa hoc.' });
    return sendJson(res, 200, { ok: true, course });
  }

  if (req.method === 'PATCH' && courseId && !courseId.includes('/')) {
    const user = await requireUser(req, res, ['admin']);
    if (!user) return;
    const body = await parseBody(req);
    const updates = { ...body };
    if (body.slug) updates.slug = slugify(body.slug);
    else delete updates.slug;
    const updated = await db.updateCourse(courseId, updates);
    if (!updated) return sendJson(res, 404, { ok: false, message: 'Khong tim thay khoa hoc.' });
    return sendJson(res, 200, { ok: true, course: updated });
  }

  if (req.method === 'DELETE' && courseId && !courseId.includes('/')) {
    const user = await requireUser(req, res, ['admin']);
    if (!user) return;
    const deleted = await db.deleteCourse(courseId);
    if (!deleted) return sendJson(res, 404, { ok: false, message: 'Khong tim thay khoa hoc.' });
    return sendJson(res, 200, { ok: true });
  }

  if (req.method === 'GET' && pathname === '/api/enrollments') {
    const user = await requireUser(req, res, ['admin', 'teacher', 'student']);
    if (!user) return;
    const url = new URL(req.url, `http://${req.headers.host}`);
    const filters = {
      userId: url.searchParams.get('userId') || '',
      courseId: url.searchParams.get('courseId') || '',
      status: url.searchParams.get('status') || '',
      limit: url.searchParams.get('limit') || 200
    };
    if (user.role === 'student') filters.userId = user.id;
    if (user.role === 'teacher') filters.teacherId = user.id;
    const enrollments = await db.listEnrollments(filters);
    return sendJson(res, 200, { ok: true, enrollments });
  }

  if (req.method === 'POST' && pathname === '/api/enrollments') {
    const user = await requireUser(req, res, ['admin', 'student']);
    if (!user) return;
    const body = await parseBody(req);
    const userId = user.role === 'admin' ? body.userId : user.id;
    const courseId = body.courseId;
    if (!userId || !courseId) {
      return sendJson(res, 400, { ok: false, message: 'Thieu userId hoac courseId.' });
    }
    const enrollment = await db.enrollUser({
      id: crypto.randomUUID(),
      userId,
      courseId,
      status: body.status || 'active',
      progress: Number(body.progress || 0),
      completedLessons: Number(body.completedLessons || 0),
      xp: Number(body.xp || 0),
      paidAmount: Number(body.paidAmount || 0),
      paymentStatus: body.paymentStatus || 'pending'
    });
    return sendJson(res, 201, { ok: true, enrollment });
  }

  const enrollmentId = idFromPath(pathname, '/api/enrollments/');
  if (req.method === 'PATCH' && enrollmentId && !enrollmentId.includes('/')) {
    const user = await requireUser(req, res, ['admin']);
    if (!user) return;
    const body = await parseBody(req);
    const updates = { ...body };
    const validStatus = ['active', 'completed', 'paused', 'cancelled'];
    const validPaymentStatus = ['paid', 'pending', 'overdue', 'refunded'];
    if (updates.status && !validStatus.includes(updates.status)) {
      return sendJson(res, 400, { ok: false, message: 'Trang thai ghi danh khong hop le.' });
    }
    if (updates.paymentStatus && !validPaymentStatus.includes(updates.paymentStatus)) {
      return sendJson(res, 400, { ok: false, message: 'Trang thai hoc phi khong hop le.' });
    }
    const updated = await db.updateEnrollment(enrollmentId, updates);
    if (!updated) return sendJson(res, 404, { ok: false, message: 'Khong tim thay ghi danh.' });
    return sendJson(res, 200, { ok: true, enrollment: updated });
  }

  if (req.method === 'GET' && pathname === '/api/exams') {
    const user = await requireUser(req, res, ['admin', 'teacher', 'student']);
    if (!user) return;
    const url = new URL(req.url, `http://${req.headers.host}`);
    const filters = {
      courseId: url.searchParams.get('courseId') || '',
      status: url.searchParams.get('status') || '',
      limit: url.searchParams.get('limit') || 200
    };
    if (user.role === 'teacher') filters.teacherId = user.id;
    const exams = await db.listExams(filters);
    return sendJson(res, 200, { ok: true, exams });
  }

  if (req.method === 'POST' && pathname === '/api/exams') {
    const user = await requireUser(req, res, ['admin', 'teacher']);
    if (!user) return;
    const body = await parseBody(req);
    const title = String(body.title || '').trim();
    if (!title) return sendJson(res, 400, { ok: false, message: 'Ten de kiem tra la bat buoc.' });
    if (!body.courseId) return sendJson(res, 400, { ok: false, message: 'Vui long chon khoa hoc.' });
    const course = await db.findCourseById(body.courseId);
    if (!course) return sendJson(res, 404, { ok: false, message: 'Khong tim thay khoa hoc.' });
    if (user.role === 'teacher' && course.teacherId !== user.id) {
      return sendJson(res, 403, { ok: false, message: 'Giao vien chi duoc tao de cho lop cua minh.' });
    }
    const typeMap = {
      'Trac nghiem': 'quiz',
      'Tu luan': 'homework',
      'Ket hop': 'mock_test',
      'Trắc nghiệm': 'quiz',
      'Tự luận': 'homework',
      'Kết hợp': 'mock_test'
    };
    const exam = await db.createExam({
      id: crypto.randomUUID(),
      courseId: body.courseId,
      title,
      type: typeMap[body.type] || body.type || 'quiz',
      totalScore: Number(body.totalScore || 10),
      durationMinutes: Number(body.durationMinutes || body.duration || 60),
      status: body.status || 'published',
      dueAt: body.dueAt || body.due_at || null
    });
    return sendJson(res, 201, { ok: true, exam });
  }

  if (req.method === 'GET' && pathname === '/api/class-sessions') {
    const user = await requireUser(req, res, ['admin', 'teacher', 'student']);
    if (!user) return;
    const url = new URL(req.url, `http://${req.headers.host}`);
    const filters = {
      courseId: url.searchParams.get('courseId') || '',
      teacherId: url.searchParams.get('teacherId') || '',
      status: url.searchParams.get('status') || '',
      dateFrom: url.searchParams.get('dateFrom') || '',
      dateTo: url.searchParams.get('dateTo') || '',
      limit: url.searchParams.get('limit') || 200
    };
    if (user.role === 'teacher') filters.teacherId = user.id;
    if (user.role === 'student') filters.studentId = user.id;
    const sessions = await db.listClassSessions(filters);
    return sendJson(res, 200, { ok: true, sessions });
  }

  if (req.method === 'POST' && pathname === '/api/class-sessions') {
    const user = await requireUser(req, res, ['admin', 'teacher']);
    if (!user) return;
    const body = await parseBody(req);
    if (!body.courseId || !body.title || !body.startAt || !body.endAt) {
      return sendJson(res, 400, { ok: false, message: 'Thieu khoa hoc, tieu de hoac thoi gian lich hoc.' });
    }
    const course = await db.findCourseById(body.courseId);
    if (!course) return sendJson(res, 404, { ok: false, message: 'Khong tim thay khoa hoc.' });
    if (user.role === 'teacher' && course.teacherId !== user.id) {
      return sendJson(res, 403, { ok: false, message: 'Giao vien chi duoc them lich cho lop cua minh.' });
    }
    const session = await db.createClassSession({
      id: crypto.randomUUID(),
      courseId: body.courseId,
      teacherId: user.role === 'teacher' ? user.id : (body.teacherId || course.teacherId || null),
      title: body.title,
      sessionNo: Number(body.sessionNo || 1),
      startAt: body.startAt,
      endAt: body.endAt,
      meetingUrl: body.meetingUrl || '',
      status: body.status || 'scheduled'
    });
    return sendJson(res, 201, { ok: true, session });
  }

  const classSessionId = idFromPath(pathname, '/api/class-sessions/');
  if (req.method === 'PATCH' && classSessionId && !classSessionId.includes('/')) {
    const user = await requireUser(req, res, ['admin', 'teacher']);
    if (!user) return;
    const current = await db.updateClassSession(classSessionId, {});
    if (!current) return sendJson(res, 404, { ok: false, message: 'Khong tim thay lich hoc.' });
    if (user.role === 'teacher' && current.teacherId !== user.id) {
      return sendJson(res, 403, { ok: false, message: 'Giao vien chi duoc sua lich cua minh.' });
    }
    const body = await parseBody(req);
    const validSessionStatus = ['scheduled', 'done', 'cancelled'];
    if (body.status && !validSessionStatus.includes(body.status)) {
      return sendJson(res, 400, { ok: false, message: 'Trang thai lich hoc khong hop le.' });
    }
    const updated = await db.updateClassSession(classSessionId, body);
    return sendJson(res, 200, { ok: true, session: updated });
  }

  if (req.method === 'DELETE' && classSessionId && !classSessionId.includes('/')) {
    const user = await requireUser(req, res, ['admin']);
    if (!user) return;
    const deleted = await db.deleteClassSession(classSessionId);
    if (!deleted) return sendJson(res, 404, { ok: false, message: 'Khong tim thay lich hoc.' });
    return sendJson(res, 200, { ok: true });
  }

  if (req.method === 'POST' && pathname === '/api/lesson-progress') {
    const user = await requireUser(req, res, ['student', 'admin']);
    if (!user) return;
    const body = await parseBody(req);
    const userId = user.role === 'admin' ? body.userId : user.id;
    if (!userId || !body.lessonId) {
      return sendJson(res, 400, { ok: false, message: 'Thieu userId hoac lessonId.' });
    }
    await db.updateLessonProgress({
      id: crypto.randomUUID(),
      userId,
      lessonId: body.lessonId,
      status: body.status || 'in_progress',
      score: body.score,
      xp: Number(body.xp || 0)
    });
    return sendJson(res, 200, { ok: true });
  }

  if (req.method === 'POST' && pathname === '/api/exam-results') {
    const user = await requireUser(req, res, ['student', 'teacher', 'admin']);
    if (!user) return;
    const body = await parseBody(req);
    const isTeacher = user.role === 'teacher' || user.role === 'admin';
    const userId = isTeacher ? body.userId : user.id;
    if (!userId || !body.examId) {
      return sendJson(res, 400, { ok: false, message: 'Thieu userId hoac examId.' });
    }
    await db.createExamResult({
      id: crypto.randomUUID(),
      examId: body.examId,
      userId,
      teacherId: isTeacher ? user.id : body.teacherId,
      score: body.score,
      status: body.status || (body.score == null ? 'submitted' : 'graded'),
      feedback: body.feedback || '',
      xp: Number(body.xp || 0)
    });
    return sendJson(res, 200, { ok: true });
  }

  if (req.method === 'GET' && pathname === '/api/exam-results') {
    const user = await requireUser(req, res, ['student', 'teacher', 'admin']);
    if (!user) return;
    const url = new URL(req.url, `http://${req.headers.host}`);
    const filters = {
      examId: url.searchParams.get('examId') || '',
      status: url.searchParams.get('status') || '',
      limit: url.searchParams.get('limit') || 100
    };
    if (user.role === 'student') filters.userId = user.id;
    else if (user.role === 'teacher') filters.courseTeacherId = user.id;
    else if (url.searchParams.get('userId')) filters.userId = url.searchParams.get('userId');
    const results = await db.listExamResults(filters);
    return sendJson(res, 200, { ok: true, results });
  }

  const examResultId = idFromPath(pathname, '/api/exam-results/');
  if (req.method === 'PATCH' && examResultId && !examResultId.includes('/')) {
    const user = await requireUser(req, res, ['teacher', 'admin']);
    if (!user) return;
    const current = await db.findExamResultById(examResultId);
    if (!current) return sendJson(res, 404, { ok: false, message: 'Khong tim thay bai nop.' });
    if (user.role === 'teacher' && current.courseTeacherId !== user.id) {
      return sendJson(res, 403, { ok: false, message: 'Giao vien chi duoc cham bai cua lop minh.' });
    }
    const body = await parseBody(req);
    const score = Number(body.score);
    if (!Number.isFinite(score) || score < 0 || score > 10) {
      return sendJson(res, 400, { ok: false, message: 'Diem phai nam trong khoang 0 den 10.' });
    }
    const updated = await db.gradeExamResult(examResultId, {
      teacherId: user.id,
      score,
      feedback: body.feedback || '',
      status: body.status || 'graded',
      xp: body.xp == null ? Math.round(score * 10) : Number(body.xp)
    });
    return sendJson(res, 200, { ok: true, result: updated });
  }

  if (req.method === 'POST' && pathname === '/api/attendance') {
    const user = await requireUser(req, res, ['teacher', 'admin']);
    if (!user) return;
    const body = await parseBody(req);
    if (!body.sessionId || !body.userId) {
      return sendJson(res, 400, { ok: false, message: 'Thieu sessionId hoac userId.' });
    }
    await db.markAttendance({
      id: crypto.randomUUID(),
      sessionId: body.sessionId,
      userId: body.userId,
      status: body.status || 'present',
      note: body.note || ''
    });
    return sendJson(res, 200, { ok: true });
  }

  if (req.method === 'GET' && pathname === '/api/material-requests') {
    const user = await requireUser(req, res, ['admin', 'teacher', 'student']);
    if (!user) return;
    const url = new URL(req.url, `http://${req.headers.host}`);
    const filters = {
      courseId: url.searchParams.get('courseId') || '',
      status: url.searchParams.get('status') || '',
      limit: url.searchParams.get('limit') || 100
    };
    if (user.role === 'teacher') filters.teacherId = user.id;
    else if (user.role === 'student') {
      filters.studentId = user.id;
      filters.status = 'approved';
    } else {
      filters.teacherId = url.searchParams.get('teacherId') || '';
    }
    const requests = await db.listMaterialRequests(filters);
    return sendJson(res, 200, { ok: true, requests });
  }

  if (req.method === 'POST' && pathname === '/api/material-requests') {
    const user = await requireUser(req, res, ['teacher', 'admin']);
    if (!user) return;
    const body = await parseBody(req);
    const title = String(body.title || '').trim();
    if (!title) return sendJson(res, 400, { ok: false, message: 'Tieu de la bat buoc.' });
    const validTypes = ['lesson', 'exam', 'document'];
    const type = validTypes.includes(body.type) ? body.type : 'lesson';
    let teacherId = user.id;
    if (user.role === 'admin' && body.teacherId) teacherId = body.teacherId;
    if (body.courseId) {
      const course = await db.findCourseById(body.courseId);
      if (!course) return sendJson(res, 404, { ok: false, message: 'Khong tim thay khoa hoc.' });
      if (user.role === 'teacher' && course.teacherId !== user.id) {
        return sendJson(res, 403, { ok: false, message: 'Giao vien chi duoc gui noi dung cho lop cua minh.' });
      }
    }
    const request = await db.createMaterialRequest({
      id: crypto.randomUUID(),
      teacherId,
      courseId: body.courseId || null,
      title,
      type,
      status: body.status || 'submitted',
      description: body.description || body.note || '',
      videoUrl: body.videoUrl || body.video_url || '',
      documentUrl: body.documentUrl || body.document_url || '',
      adminNote: body.adminNote || '',
      submittedAt: body.status === 'pending' ? null : new Date()
    });
    return sendJson(res, 201, { ok: true, request });
  }

  const materialRequestId = idFromPath(pathname, '/api/material-requests/');
  if (req.method === 'PATCH' && materialRequestId && !materialRequestId.includes('/')) {
    const user = await requireUser(req, res, ['admin']);
    if (!user) return;
    const body = await parseBody(req);
    const validMaterialStatus = ['pending', 'submitted', 'approved', 'rejected'];
    if (body.status && !validMaterialStatus.includes(body.status)) {
      return sendJson(res, 400, { ok: false, message: 'Trang thai tai lieu khong hop le.' });
    }
    const updates = {};
    ['status', 'title', 'type', 'description', 'videoUrl', 'documentUrl', 'adminNote', 'submittedAt'].forEach(key => {
      if (Object.prototype.hasOwnProperty.call(body, key)) updates[key] = body[key];
    });
    const updated = await db.updateMaterialRequest(materialRequestId, updates);
    if (!updated) return sendJson(res, 404, { ok: false, message: 'Khong tim thay yeu cau tai lieu.' });
    if (updated.teacherId && (body.status === 'approved' || body.status === 'rejected')) {
      await db.createNotification({
        id: crypto.randomUUID(),
        userId: updated.teacherId,
        title: body.status === 'approved' ? 'Tai lieu da duoc duyet' : 'Tai lieu can chinh sua',
        body: `${updated.title}${body.adminNote ? ` - ${body.adminNote}` : ''}`,
        type: 'material'
      });
    }
    return sendJson(res, 200, { ok: true, request: updated });
  }

  if (req.method === 'GET' && pathname === '/api/notifications') {
    const user = await requireUser(req, res, ['admin', 'teacher', 'student']);
    if (!user) return;
    const url = new URL(req.url, `http://${req.headers.host}`);
    const filters = {
      type: url.searchParams.get('type') || '',
      limit: url.searchParams.get('limit') || 100
    };
    if (user.role === 'admin') filters.onlyUserId = url.searchParams.get('userId') || '';
    else filters.userId = user.id;
    const notifications = await db.listNotifications(filters);
    return sendJson(res, 200, { ok: true, notifications });
  }

  if (req.method === 'POST' && pathname === '/api/notifications') {
    const user = await requireUser(req, res, ['admin', 'teacher']);
    if (!user) return;
    const body = await parseBody(req);
    if (!body.title) return sendJson(res, 400, { ok: false, message: 'Tieu de thong bao la bat buoc.' });
    await db.createNotification({
      id: crypto.randomUUID(),
      userId: body.userId || null,
      title: body.title,
      body: body.body || '',
      type: body.type || 'system'
    });
    return sendJson(res, 201, { ok: true });
  }

  if (req.method === 'POST' && pathname === '/api/notifications/read-all') {
    const user = await requireUser(req, res, ['admin', 'teacher', 'student']);
    if (!user) return;
    await db.markAllNotificationsRead(user.id);
    return sendJson(res, 200, { ok: true });
  }

  const notificationId = idFromPath(pathname, '/api/notifications/');
  if (req.method === 'PATCH' && notificationId && !notificationId.includes('/')) {
    const user = await requireUser(req, res, ['admin', 'teacher', 'student']);
    if (!user) return;
    const scopeUserId = user.role === 'admin' ? null : user.id;
    const updated = await db.markNotificationRead(notificationId, scopeUserId);
    if (!updated) return sendJson(res, 404, { ok: false, message: 'Khong tim thay thong bao.' });
    return sendJson(res, 200, { ok: true });
  }

  if (req.method === 'GET' && pathname === '/api/questions') {
    const user = await requireUser(req, res, ['admin', 'teacher', 'student']);
    if (!user) return;
    const url = new URL(req.url, `http://${req.headers.host}`);
    const filters = {
      status: url.searchParams.get('status') || '',
      limit: url.searchParams.get('limit') || 100
    };
    if (user.role === 'student') {
      filters.studentId = user.id;
    } else if (user.role === 'teacher') {
      filters.teacherId = user.id;
    } else if (url.searchParams.get('studentId')) {
      filters.studentId = url.searchParams.get('studentId');
    }
    const questions = await db.listQuestions(filters);
    return sendJson(res, 200, { ok: true, questions });
  }

  if (req.method === 'POST' && pathname === '/api/questions') {
    const user = await requireUser(req, res, ['student', 'admin']);
    if (!user) return;
    const body = await parseBody(req);
    const text = String(body.body || body.question || '').trim();
    if (!text) return sendJson(res, 400, { ok: false, message: 'Noi dung cau hoi la bat buoc.' });
    let teacherId = body.teacherId || null;
    if (body.courseId) {
      const course = await db.findCourseById(body.courseId);
      if (!course) return sendJson(res, 404, { ok: false, message: 'Khong tim thay khoa hoc.' });
      if (!teacherId) teacherId = course.teacherId || null;
    }
    const question = await db.createQuestion({
      id: crypto.randomUUID(),
      studentId: user.role === 'admin' && body.studentId ? body.studentId : user.id,
      courseId: body.courseId || null,
      teacherId,
      title: String(body.title || '').trim().slice(0, 190),
      body: text
    });
    if (teacherId) {
      await db.createNotification({
        id: crypto.randomUUID(),
        userId: teacherId,
        title: 'Co cau hoi moi tu hoc vien',
        body: question.title || text.slice(0, 120),
        type: 'qa'
      });
    }
    return sendJson(res, 201, { ok: true, question });
  }

  const questionId = idFromPath(pathname, '/api/questions/');
  if (req.method === 'PATCH' && questionId && !questionId.includes('/')) {
    const user = await requireUser(req, res, ['teacher', 'admin']);
    if (!user) return;
    const body = await parseBody(req);
    const answer = String(body.answer || '').trim();
    if (!answer) return sendJson(res, 400, { ok: false, message: 'Noi dung tra loi la bat buoc.' });
    const existing = await db.findQuestionById(questionId);
    if (!existing) return sendJson(res, 404, { ok: false, message: 'Khong tim thay cau hoi.' });
    const updated = await db.answerQuestion(questionId, { answer, teacherId: user.id });
    await db.createNotification({
      id: crypto.randomUUID(),
      userId: updated.studentId,
      title: 'Giao vien da tra loi cau hoi cua ban',
      body: updated.title || updated.body.slice(0, 120),
      type: 'qa'
    });
    return sendJson(res, 200, { ok: true, question: updated });
  }

  if (req.method === 'GET' && pathname === '/api/badges') {
    const user = await requireUser(req, res, ['admin', 'teacher', 'student']);
    if (!user) return;
    const url = new URL(req.url, `http://${req.headers.host}`);
    let targetId = user.id;
    if (user.role !== 'student') {
      targetId = url.searchParams.get('studentId') || '';
    }
    if (!targetId) {
      const badges = await db.listBadges();
      return sendJson(res, 200, { ok: true, badges });
    }
    const badges = await db.getStudentBadges(targetId);
    return sendJson(res, 200, { ok: true, badges });
  }

  if (req.method === 'GET' && pathname === '/api/flashcard-sets') {
    const user = await requireUser(req, res, ['admin', 'teacher', 'student']);
    if (!user) return;
    const sets = await db.listFlashcardSets();
    return sendJson(res, 200, { ok: true, sets });
  }

  const flashcardSetId = idFromPath(pathname, '/api/flashcard-sets/');
  if (req.method === 'GET' && flashcardSetId && !flashcardSetId.includes('/')) {
    const user = await requireUser(req, res, ['admin', 'teacher', 'student']);
    if (!user) return;
    const set = await db.getFlashcardSet(flashcardSetId);
    if (!set) return sendJson(res, 404, { ok: false, message: 'Khong tim thay bo flashcard.' });
    return sendJson(res, 200, { ok: true, set });
  }

  return sendJson(res, 404, { ok: false, message: 'API endpoint not found.' });
}

module.exports = {
  handleApi,
  requireUser,
  findSessionUser
};
