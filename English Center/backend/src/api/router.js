const crypto = require('crypto');
const db = require('../repositories');
const { sendJson, parseBody, getBearerToken, idFromPath } = require('../http/request');
const { createUserRecord, hashPassword, normalizeEmail, publicUser, slugify, verifyPassword } = require('../services/user-service');
const { assistantFallbackReply, callAssistantService, callDeepSeek } = require('../services/assistant-service');
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

async function isStudentEnrolled(userId, courseId) {
  if (!userId || !courseId) return false;
  const rows = await db.listEnrollments({ userId, courseId, limit: 1 });
  return rows.some(row => ['active', 'completed'].includes(row.status));
}

async function teacherCanAccessStudent(teacherId, studentId) {
  if (!teacherId || !studentId) return false;
  const rows = await db.listEnrollments({ teacherId, userId: studentId, limit: 1 });
  return rows.length > 0;
}

async function requireTeacherCourse(user, res, courseId, message) {
  const course = await db.findCourseById(courseId);
  if (!course) {
    sendJson(res, 404, { ok: false, message: 'Khong tim thay khoa hoc.' });
    return null;
  }
  if (user.role === 'teacher' && course.teacherId !== user.id) {
    sendJson(res, 403, { ok: false, message: message || 'Giao vien chi duoc thao tac voi lop cua minh.' });
    return null;
  }
  return course;
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

  if (req.method === 'PATCH' && pathname === '/api/profile') {
    const user = await requireUser(req, res, ['admin', 'teacher', 'student']);
    if (!user) return;
    const body = await parseBody(req);
    const updates = {};
    ['name', 'phone', 'education', 'experience', 'motivation', 'schedule', 'newsletter'].forEach(key => {
      if (Object.prototype.hasOwnProperty.call(body, key)) updates[key] = body[key];
    });
    if (!Object.keys(updates).length) return sendJson(res, 400, { ok: false, message: 'Khong co du lieu can cap nhat.' });
    const updated = await db.updateUser(user.id, updates);
    return sendJson(res, 200, { ok: true, user: publicUser(updated) });
  }

  if (req.method === 'PATCH' && pathname === '/api/profile/password') {
    const user = await requireUser(req, res, ['admin', 'teacher', 'student']);
    if (!user) return;
    const body = await parseBody(req);
    const currentPassword = String(body.currentPassword || '');
    const newPassword = String(body.newPassword || '');
    if (!verifyPassword(currentPassword, user.passwordHash)) {
      return sendJson(res, 400, { ok: false, message: 'Mat khau hien tai khong dung.' });
    }
    if (newPassword.length < 6) {
      return sendJson(res, 400, { ok: false, message: 'Mat khau moi phai co it nhat 6 ky tu.' });
    }
    const updated = await db.updateUser(user.id, { passwordHash: hashPassword(newPassword) });
    return sendJson(res, 200, { ok: true, user: publicUser(updated) });
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
    let reply = '';
    let source = 'deepseek';

    try {
      // Build context-aware system prompt from DB
      const courses = await db.listCourses({ status: 'active' }).catch(() => []);
      const courseList = courses.slice(0, 12).map(c => {
        const price = c.price ? `${Math.round(Number(c.price) / 1000)}k` : 'Miễn phí';
        const weeks = c.durationWeeks ? `${c.durationWeeks} tuần` : '';
        const teacher = c.teacherName ? `, GV: ${c.teacherName}` : '';
        const level = c.level ? ` [${c.level}]` : '';
        return `- ${c.name}${level}: ${price}${weeks ? '/' + weeks : ''}${teacher}`;
      }).join('\n');

      const systemPrompt = `Bạn là trợ lý AI của English Center - trung tâm luyện thi tiếng Anh THPTQG.

NHIỆM VỤ: Tư vấn và giải đáp mọi thắc mắc của học viên về khóa học, đăng ký, lịch học, học phí và các dịch vụ của trung tâm.

CÁC KHÓA HỌC HIỆN TẠI:
${courseList || '- Đang cập nhật, vui lòng liên hệ admin để biết thêm'}

QUY TRÌNH ĐĂNG KÝ:
1. Vào website → Nhấn "Đăng ký" → Tạo tài khoản học sinh
2. Chọn khóa học phù hợp trong trang "Chọn khóa học"
3. Xác nhận ghi danh → Truy cập Dashboard để bắt đầu học

DỊCH VỤ:
- Dashboard học sinh: Theo dõi tiến độ, nộp bài tập, nhận thông báo
- Đề thi thử: Luyện tập với đề thi thực tế (miễn phí)
- Tài liệu ôn thi: Download tài liệu học tập
- Hỏi & Đáp: Đặt câu hỏi trực tiếp cho giáo viên phụ trách
- Flashcard: Công cụ ôn từ vựng thông minh
- Huy hiệu & Bảng xếp hạng: Gamification khuyến khích học tập

HƯỚNG DẪN TRẢ LỜI:
- Luôn dùng tiếng Việt, thân thiện và chuyên nghiệp
- Trả lời ngắn gọn, tối đa 180 từ
- Không bịa đặt thông tin không có trong dữ liệu trên
- Nếu không biết, hướng dẫn học viên liên hệ qua trang Liên hệ hoặc nhắn tin cho admin`;

      reply = await callDeepSeek(systemPrompt, messages);
    } catch (error) {
      console.warn('[chat] DeepSeek failed:', error.message);
    }

    if (!reply) {
      try {
        reply = await callAssistantService({ messages, system: '', context: {}, source: 'english-center-web' });
        source = 'service';
      } catch (_) {}
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
        messages,
        reply,
        createdAt: new Date().toISOString()
      }
    }).catch(error => console.warn('[assistant] log failed:', error.message));
    return sendJson(res, 200, { ok: true, content: [{ text: reply }] });
  }

  // ── Demo fallback khi không có AI API key ────────────────────────────────
  function normalizeStr(s) {
    return String(s || '').toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]/g, ' ').trim();
  }

  function analyzeUrl(url, fileType, title, courseName) {
    const issues = [];
    let penalty = 0;
    if (!url) return { issues, penalty };

    const lower = url.toLowerCase();
    // Lấy tên file từ URL (bỏ query string)
    const filename = normalizeStr(decodeURIComponent(lower.split('/').pop().split('?')[0]));

    // Kiểm tra định dạng file có khớp loại không
    const videoExts = ['mp4', 'mov', 'avi', 'webm', 'mkv', 'flv', 'wmv'];
    const docExts = ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xlsx', 'xls'];
    const imgExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'];
    const videoHosts = ['youtube.com', 'youtu.be', 'vimeo.com', 'loom.com', 'drive.google.com', 'zoom.us'];
    const docHosts = ['drive.google.com', 'docs.google.com', 'dropbox.com', 'onedrive.live.com'];

    const isVideoHost = videoHosts.some(h => lower.includes(h));
    const isDocHost = docHosts.some(h => lower.includes(h));
    const ext = filename.split(' ').pop();

    if (fileType === 'video') {
      if (imgExts.includes(ext)) {
        issues.push(`URL video trỏ đến file ảnh (.${ext}) — không phải video`);
        penalty += 4;
      } else if (docExts.includes(ext)) {
        issues.push(`URL video trỏ đến tài liệu (.${ext}) — không phải video bài giảng`);
        penalty += 3;
      } else if (!isVideoHost && !videoExts.includes(ext)) {
        issues.push('Đường dẫn video không rõ định dạng, khó xác minh nội dung');
        penalty += 1;
      }
    }

    if (fileType === 'document') {
      if (videoExts.includes(ext)) {
        issues.push(`URL tài liệu trỏ đến file video (.${ext}) — nên đính kèm vào mục video`);
        penalty += 3;
      } else if (imgExts.includes(ext)) {
        issues.push(`URL tài liệu trỏ đến file ảnh (.${ext}) — không phải tài liệu học tập`);
        penalty += 3;
      }
    }

    // Kiểm tra tên file có liên quan đến tiêu đề/khóa học không
    const titleWords = normalizeStr(title + ' ' + (courseName || ''))
      .split(/\s+/).filter(w => w.length >= 4);
    const matchCount = titleWords.filter(w => filename.includes(w)).length;

    // Từ khóa không liên quan rõ ràng
    const irrelevant = ['cat', 'dog', 'meme', 'funny', 'troll', 'random', 'untitled',
      'test123', 'abc123', 'sample', 'demo', 'clip', 'video1', 'file1', 'anh', 'chup',
      'hinh', 'anh chup', 'screenshot', 'wallpaper', 'avatar', 'profile'];
    const foundIrrelevant = irrelevant.filter(w => filename.includes(w));

    if (foundIrrelevant.length > 0 && !isVideoHost && !isDocHost) {
      issues.push(`Tên file "${foundIrrelevant[0]}" có vẻ không liên quan đến nội dung bài giảng`);
      penalty += 3;
    } else if (matchCount === 0 && filename.length > 3 && !isVideoHost && !isDocHost) {
      issues.push('Tên file không có từ khóa trùng với tiêu đề bài giảng');
      penalty += 1;
    }

    return { issues, penalty, filename };
  }

  function generateDemoReview(material) {
    const hasVideo = !!material.videoUrl;
    const hasDoc = !!material.documentUrl;
    const hasDesc = !!(material.description && material.description.trim().length > 20);
    const titleLen = (material.title || '').length;
    const type = material.type || 'lesson';
    const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
    const typeLabel = type === 'lesson' ? 'bài giảng' : type === 'exam' ? 'đề thi' : 'tài liệu';

    // Phân tích URL video và tài liệu
    const videoAnalysis = analyzeUrl(material.videoUrl, 'video', material.title, material.courseName);
    const docAnalysis = analyzeUrl(material.documentUrl, 'document', material.title, material.courseName);
    const urlIssues = [...videoAnalysis.issues, ...docAnalysis.issues];
    const urlPenalty = videoAnalysis.penalty + docAnalysis.penalty;

    // Tính điểm
    let score = 4;
    if (hasVideo) score += 2;
    if (hasDoc) score += 1;
    if (hasDesc) score += 1;
    if (titleLen > 15) score += 1;
    if (hasVideo && hasDoc) score += 1;
    score = Math.max(1, Math.min(10, score - urlPenalty));

    const hasNeither = !hasVideo && !hasDoc;
    const hasUrlProblems = urlPenalty >= 3;

    let recommendation, confidence, summary, reason, adminNote;
    const teacher = material.teacherName || 'giáo viên';
    const course = material.courseName ? ` cho khóa "${material.courseName}"` : '';

    if (hasUrlProblems || (hasNeither) || score <= 3) {
      recommendation = 'reject';
      confidence = urlPenalty >= 4 ? 'high' : 'medium';
      const urlIssueText = urlIssues.length ? ` Cụ thể: ${urlIssues.join('; ')}.` : '';
      summary = `${cap(typeLabel)} "${material.title}" của ${teacher}${course} có vấn đề nghiêm trọng cần chỉnh sửa trước khi duyệt.`;
      reason = hasNeither
        ? 'Bài nộp không có file đính kèm (video hoặc tài liệu). Cần bổ sung nội dung thực tế để học viên có thể học.'
        : `Phát hiện vấn đề với file đính kèm.${urlIssueText} ${!hasDesc ? 'Ngoài ra thiếu mô tả nội dung chi tiết.' : ''}`.trim();
      adminNote = `Bài nộp "${material.title}" chưa được duyệt do:${urlIssues.map((i, idx) => `\n(${idx+1}) ${i}`).join('')}${!hasDesc ? '\n- Thiếu mô tả nội dung' : ''}.\n\nVui lòng kiểm tra lại file đính kèm đúng với nội dung bài giảng và nộp lại.`;
    } else if (score >= 8 && urlIssues.length === 0) {
      recommendation = 'approve';
      confidence = score >= 9 ? 'high' : 'medium';
      summary = `${cap(typeLabel)} "${material.title}" của ${teacher}${course} đầy đủ nội dung${hasVideo ? ', có video minh họa' : ''}${hasDoc ? ' và tài liệu đính kèm' : ''}${hasDesc ? ', mô tả chi tiết' : ''}.`;
      reason = `Bài nộp đáp ứng đầy đủ tiêu chí: tiêu đề rõ ràng${hasDesc ? ', mô tả chi tiết' : ''}${hasVideo ? ', video phù hợp' : ''}${hasDoc ? ', tài liệu hợp lệ' : ''}. Nội dung liên quan đến khóa học.`;
      adminNote = `Đã xem xét và chấp thuận ${typeLabel} "${material.title}". Nội dung chất lượng tốt, phù hợp chương trình. Cảm ơn ${teacher}!`;
    } else {
      recommendation = 'review';
      confidence = 'medium';
      const missing = [!hasDesc && 'mô tả nội dung chi tiết', !hasVideo && 'video minh họa', !hasDoc && 'tài liệu tham khảo'].filter(Boolean);
      const urlWarn = urlIssues.length ? ` Lưu ý: ${urlIssues[0]}.` : '';
      summary = `${cap(typeLabel)} "${material.title}" đã có một số thành phần nhưng cần bổ sung thêm.${urlWarn}`;
      reason = `Bài nộp có ${hasVideo ? 'video' : hasDoc ? 'tài liệu' : 'tiêu đề'} nhưng còn thiếu: ${missing.join(', ') || 'một số yêu cầu'}.${urlWarn}`;
      adminNote = `Bài nộp "${material.title}" cần bổ sung: ${missing.join(', ') || 'xem chi tiết bên trên'}. ${urlIssues.length ? 'Kiểm tra lại tính phù hợp của file đính kèm.' : 'Nộp lại sau khi hoàn chỉnh.'}`;
    }

    return { recommendation, confidence, qualityScore: score, summary, reason, adminNote };
  }

  if (req.method === 'POST' && pathname === '/api/ai/review-material') {
    const user = await requireUser(req, res, ['admin']);
    if (!user) return;
    const body = await parseBody(req);
    const materialId = String(body.materialId || '').trim();
    if (!materialId) return sendJson(res, 400, { ok: false, message: 'materialId la bat buoc.' });

    const materials = await db.listMaterialRequests({ limit: 500 });
    const material = materials.find(m => m.id === materialId);
    if (!material) return sendJson(res, 404, { ok: false, message: 'Khong tim thay bai giang.' });

    const typeLabel = material.type === 'lesson' ? 'Bài giảng' : material.type === 'exam' ? 'Đề thi' : 'Tài liệu';
    const hasVideo = material.videoUrl ? 'Có' : 'Không';
    const hasDoc = material.documentUrl ? 'Có' : 'Không';
    const descText = material.description ? material.description.slice(0, 600) : 'Không có mô tả';

    const systemPrompt = `Bạn là AI hỗ trợ quản trị viên của English Center duyệt nội dung giảng dạy do giáo viên nộp.
Nhiệm vụ: Phân tích bài nộp và đưa ra khuyến nghị CHÍNH XÁC dưới dạng JSON.
Quy tắc:
- "approve" nếu tiêu đề rõ ràng, mô tả đầy đủ, có đính kèm (video hoặc tài liệu), phù hợp khóa học
- "reject" nếu thiếu mô tả, tiêu đề chung chung, không có file đính kèm, nội dung không phù hợp
- "review" nếu cần bổ sung thêm nhưng không có vấn đề nghiêm trọng
Trả về JSON thuần (không markdown, không code block):
{"recommendation":"approve|reject|review","confidence":"high|medium|low","qualityScore":1-10,"summary":"...","reason":"...","adminNote":"..."}`;

    const userPrompt = `THÔNG TIN BÀI NỘP:
Loại: ${typeLabel}
Tiêu đề: ${material.title}
Giáo viên: ${material.teacherName || 'Không rõ'}
Khóa học: ${material.courseName || 'Không gắn khóa'}
Mô tả: ${descText}
Video đính kèm: ${hasVideo}
Tài liệu đính kèm: ${hasDoc}
Trạng thái hiện tại: ${material.status}

Phân tích và trả về JSON như hướng dẫn.`;

    let review = null;
    try {
      const raw = await callDeepSeek(systemPrompt, [{ role: 'user', content: userPrompt }]);
      const jsonStr = raw.replace(/```json|```/g, '').trim();
      try { review = JSON.parse(jsonStr); } catch (_) {
        const match = jsonStr.match(/\{[\s\S]*\}/);
        if (match) review = JSON.parse(match[0]);
      }
    } catch (err) {
      console.warn('[ai/review-material] DeepSeek error:', err.message);
    }

    if (!review || typeof review !== 'object') {
      review = generateDemoReview(material);
    }

    return sendJson(res, 200, { ok: true, review, material: { id: material.id, title: material.title, type: material.type } });
  }

  if (req.method === 'POST' && pathname === '/api/ai/generate-lesson-plan') {
    const user = await requireUser(req, res, ['teacher', 'admin']);
    if (!user) return;
    const body = await parseBody(req);
    const topic = String(body.topic || '').trim();
    const level = String(body.level || 'Trung bình').trim();
    const duration = String(body.duration || '90 phút').trim();
    const objective = String(body.objective || '').trim();
    if (!topic) return sendJson(res, 400, { ok: false, message: 'topic là bắt buộc.' });

    let lessonPlan = '';
    try {
      const systemPrompt = `Bạn là chuyên gia soạn giáo án tiếng Anh THPTQG Việt Nam.
Hãy tạo giáo án chi tiết, thực tế, đúng chuẩn cho giáo viên luyện thi.
Cấu trúc bắt buộc: Thông tin chung → Mục tiêu → Phương tiện → Tiến trình (Khởi động/Kiểm tra bài cũ/Bài mới/Luyện tập/Củng cố) → Ghi chú.
Trả lời bằng tiếng Việt. Văn phong chuyên nghiệp. Có ví dụ câu cụ thể. Không dùng markdown heading.`;
      const userPrompt = `Soạn giáo án:\nChủ đề: ${topic}\nTrình độ: ${level}\nThời lượng: ${duration}${objective ? '\nMục tiêu đặc biệt: ' + objective : ''}`;
      lessonPlan = await callDeepSeek(systemPrompt, [{ role: 'user', content: userPrompt }]);
    } catch (err) {
      console.warn('[ai/generate-lesson-plan] error:', err.message);
    }

    return sendJson(res, 200, { ok: true, lessonPlan: lessonPlan || '' });
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
    if (user.role === 'teacher' && exam.teacherId !== user.id) {
      return sendJson(res, 403, { ok: false, message: 'Giao vien chi duoc xem de cua lop minh.' });
    }
    if (user.role === 'student') {
      if (exam.status !== 'published') {
        return sendJson(res, 403, { ok: false, message: 'De thi chua duoc mo cho hoc sinh.' });
      }
      const enrolled = await isStudentEnrolled(user.id, exam.courseId);
      if (!enrolled) return sendJson(res, 403, { ok: false, message: 'Hoc sinh chi duoc lam de cua khoa da ghi danh.' });
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
    const user = await requireUser(req, res, ['admin', 'teacher', 'student']);
    if (!user) return;
    const url = new URL(req.url, `http://${req.headers.host}`);
    const filters = {
      status: url.searchParams.get('status') || '',
      teacherId: url.searchParams.get('teacherId') || ''
    };
    if (user.role === 'teacher') filters.teacherId = user.id;
    if (user.role === 'student') filters.studentId = user.id;
    const courses = await db.listCourses(filters);
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
    const user = await requireUser(req, res, ['admin', 'teacher', 'student']);
    if (!user) return;
    const course = await db.findCourseById(courseId);
    if (!course) return sendJson(res, 404, { ok: false, message: 'Khong tim thay khoa hoc.' });
    if (user.role === 'teacher' && course.teacherId !== user.id) {
      return sendJson(res, 403, { ok: false, message: 'Giao vien chi duoc xem khoa hoc cua minh.' });
    }
    if (user.role === 'student' && !(await isStudentEnrolled(user.id, course.id))) {
      return sendJson(res, 403, { ok: false, message: 'Hoc sinh chi duoc xem khoa hoc da ghi danh.' });
    }
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
    const course = await db.findCourseById(courseId);
    if (!course) return sendJson(res, 404, { ok: false, message: 'Khong tim thay khoa hoc.' });
    if (user.role === 'student' && course.status !== 'active') {
      return sendJson(res, 403, { ok: false, message: 'Chi co the dang ky khoa hoc dang mo.' });
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
    if (user.role === 'student') {
      filters.studentId = user.id;
      filters.status = 'published';
    }
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
    const course = await requireTeacherCourse(user, res, body.courseId, 'Giao vien chi duoc tao de cho lop cua minh.');
    if (!course) return;
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
      dueAt: body.dueAt || body.due_at || null,
      questions: Array.isArray(body.questions) ? body.questions : []
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
    const course = await requireTeacherCourse(user, res, body.courseId, 'Giao vien chi duoc them lich cho lop cua minh.');
    if (!course) return;
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
    const exam = await db.findExamById(body.examId);
    if (!exam) return sendJson(res, 404, { ok: false, message: 'Khong tim thay de thi.' });
    if (user.role === 'teacher' && exam.teacherId !== user.id) {
      return sendJson(res, 403, { ok: false, message: 'Giao vien chi duoc tao/cham bai cua lop minh.' });
    }
    if (user.role === 'student') {
      if (exam.status !== 'published') return sendJson(res, 403, { ok: false, message: 'De thi chua duoc mo.' });
      const enrolled = await isStudentEnrolled(user.id, exam.courseId);
      if (!enrolled) return sendJson(res, 403, { ok: false, message: 'Hoc sinh chi duoc nop bai cua khoa da ghi danh.' });
    } else if (user.role === 'teacher' && !(await isStudentEnrolled(userId, exam.courseId))) {
      return sendJson(res, 403, { ok: false, message: 'Hoc sinh khong thuoc lop cua de thi nay.' });
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
    const session = await db.findClassSessionById(body.sessionId);
    if (!session) return sendJson(res, 404, { ok: false, message: 'Khong tim thay buoi hoc.' });
    if (user.role === 'teacher' && session.teacherId !== user.id) {
      return sendJson(res, 403, { ok: false, message: 'Giao vien chi duoc diem danh buoi hoc cua minh.' });
    }
    if (!(await isStudentEnrolled(body.userId, session.courseId))) {
      return sendJson(res, 403, { ok: false, message: 'Hoc sinh khong thuoc lop cua buoi hoc nay.' });
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
      const course = await requireTeacherCourse(user, res, body.courseId, 'Giao vien chi duoc gui noi dung cho lop cua minh.');
      if (!course) return;
      if (user.role === 'admin' && teacherId && course.teacherId && course.teacherId !== teacherId) {
        return sendJson(res, 403, { ok: false, message: 'Giao vien khong phu trach khoa hoc nay.' });
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
    if (user.role === 'teacher') {
      if (!body.userId) {
        return sendJson(res, 403, { ok: false, message: 'Giao vien chi duoc gui thong bao den hoc sinh trong lop minh.' });
      }
      const allowed = await teacherCanAccessStudent(user.id, body.userId);
      if (!allowed) return sendJson(res, 403, { ok: false, message: 'Hoc sinh khong thuoc lop cua giao vien.' });
    }
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
      const studentId = user.role === 'admin' && body.studentId ? body.studentId : user.id;
      if (user.role === 'student' && !(await isStudentEnrolled(user.id, body.courseId))) {
        return sendJson(res, 403, { ok: false, message: 'Hoc sinh chi duoc hoi dap trong khoa da ghi danh.' });
      }
      if (user.role === 'admin' && body.studentId && !(await isStudentEnrolled(studentId, body.courseId))) {
        return sendJson(res, 403, { ok: false, message: 'Hoc sinh khong thuoc khoa hoc nay.' });
      }
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
    if (user.role === 'teacher') {
      if (existing.teacherId && existing.teacherId !== user.id) {
        return sendJson(res, 403, { ok: false, message: 'Cau hoi da duoc gan cho giao vien khac.' });
      }
      if (existing.courseId) {
        const course = await db.findCourseById(existing.courseId);
        if (!course || course.teacherId !== user.id) {
          return sendJson(res, 403, { ok: false, message: 'Giao vien chi duoc tra loi cau hoi cua lop minh.' });
        }
      } else if (!(await teacherCanAccessStudent(user.id, existing.studentId))) {
        return sendJson(res, 403, { ok: false, message: 'Hoc sinh khong thuoc lop cua giao vien.' });
      }
    }
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
