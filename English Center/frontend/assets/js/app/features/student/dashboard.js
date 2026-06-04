/**
 * Student Dashboard - Dynamic Features
 * Quản lý tất cả các chức năng của Dashboard Học Sinh
 * Kết nối với API backend để lấy dữ liệu động
 */

(function() {
 'use strict';

 // ========== STATE & CONFIG ==========
 const state = {
 user: null,
 dashboard: null,
 enrollments: [],
 courses: [],
 exams: [],
 examResults: [],
 classSessions: [],
 notif: {
 notifOpen: false,
 unreadCount: 0,
 allNotifs: []
 },
 currentView: 'dashboard'
 };

 const API_BASE = '';
 
 // ========== INITIALIZATION ==========
 window.initDashboard = async function() {
 try {
 // Load user từ localStorage
 const userData = localStorage.getItem('ec_current_user');
 if (!userData) {
 window.location.replace('dangnhap.html');
 return;
 }
 
 state.user = JSON.parse(userData);
 if (!state.user || !state.user.email) {
 window.location.replace('dangnhap.html');
 return;
 }
 if (state.user.role && !['student', 'admin'].includes(state.user.role)) {
 window.location.replace(window.EC_AUTH ? window.EC_AUTH.roleHome(state.user.role) : 'dangnhap.html');
 return;
 }
 
 // Cập nhật UI với thông tin user
 updateUserUI();
 
 // Load dashboard data
 await loadDashboardData();
 
 // Initialize event listeners
 setupEventListeners();
 
 // Render dashboard view
 switchView('dashboard');
 } catch (error) {
 console.error('Error initializing dashboard:', error);
 }
 };

 // ========== API CALLS ==========
 async function apiCall(path, options = {}) {
 const token = localStorage.getItem('ec_auth_token');
 if (window.location.protocol === 'file:' || !token) {
 throw new Error('API unavailable without an authenticated session.');
 }
 
 const headers = {
 'Content-Type': 'application/json',
 Authorization: `Bearer ${token}`,
 ...options.headers
 };

 try {
 const response = await fetch(path, {
 ...options,
 headers
 });

 const data = await response.json().catch(() => ({}));
 if (!response.ok || data.ok === false) {
 if (response.status === 401) {
 localStorage.removeItem('ec_auth_token');
 localStorage.removeItem('ec_current_user');
 window.location.replace('dangnhap.html');
 }
 throw new Error(data.message || `API error: ${response.status}`);
 }

 return data;
 } catch (error) {
 console.error('API call failed:', error);
 throw error;
 }
 }

 async function loadDashboardData() {
 try {
 // Load dashboard stats - contains everything we need
 const dashboardRes = await apiCall('/api/dashboard/student');
 const dashboard = dashboardRes.dashboard || {};
 
 state.dashboard = dashboard.stats || {};
 state.dashboard.badges = dashboard.badges || [];
 state.dashboard.leaderboard = dashboard.leaderboard || [];
 state.enrollments = dashboard.courses || [];
 state.examResults = dashboard.recentExamResults || [];
 state.classSessions = dashboard.upcomingSessions || [];
 state.notif.allNotifs = dashboard.notifications || [];
 state.notif.unreadCount = (dashboard.notifications || []).filter(n => !n.isRead).length;
 try {
 const examsRes = await apiCall('/api/exams?limit=200');
 state.exams = examsRes.exams || [];
 } catch (error) {
 console.error('Error loading exams:', error);
 state.exams = [];
 }
 renderNotifList();

 console.log('Dashboard data loaded:', {
 stats: state.dashboard,
 enrollments: state.enrollments,
 exams: state.exams,
 examResults: state.examResults,
 sessions: state.classSessions
 });
 } catch (error) {
 console.error('Error loading dashboard data:', error);
 }
 }

 // ========== UI UPDATES ==========
 function updateUserUI() {
 const user = state.user;
 const displayName = user.name || user.email || 'Hoc sinh';
 
 // Update sidebar
 const initials = displayName
 .split(' ')
 .map(n => n[0])
 .join('')
 .toUpperCase()
 .slice(0, 2);
 
 setText('sAvatar', initials);
 setText('sName', displayName);
 setText('sEmail', user.email || '');
 
 // Update greeting
 const hour = new Date().getHours();
 let greeting = 'Chào buổi sáng! ';
 if (hour >= 12 && hour < 18) greeting = 'Chào buổi chiều! ';
 if (hour >= 18) greeting = 'Chào buổi tối! ';
 
 setText('wTitle', greeting);
 }

 function setText(id, value) {
 const el = document.getElementById(id);
 if (el) el.textContent = value;
 }

 // ========== DASHBOARD VIEW ==========
 window.switchView = function(viewName) {
 // Hide all views
 document.querySelectorAll('[id^="view-"]').forEach(el => {
 el.style.display = 'none';
 });
 
 // Show selected view
 const viewEl = document.getElementById(`view-${viewName}`);
 if (viewEl) {
 viewEl.style.display = 'block';
 }
 
 // Update navigation
 document.querySelectorAll('[id^="nav-"]').forEach(el => {
 el.classList.remove('active');
 });
 const navEl = document.getElementById(`nav-${viewName}`);
 if (navEl) {
 navEl.classList.add('active');
 }
 
 state.currentView = viewName;
 
 // Load view-specific content
 switch(viewName) {
 case 'dashboard':
 renderDashboardView();
 break;
 case 'lichhoc':
 renderScheduleView();
 break;
 case 'dethithu':
 renderExamsView();
 break;
 case 'spk':
 renderSpeakingView();
 break;
 case 'tailieu':
 renderMaterialsView();
 break;
 case 'hoidap':
 renderQAView();
 break;
 case 'ketqua':
 renderResultsView();
 break;
 case 'huyhieu':
 renderBadgesView();
 break;
 case 'settings':
 renderSettingsView();
 break;
 }
 };

 // ========== DASHBOARD RENDER ==========
 function renderDashboardView() {
 // Render stats - using correct field names from backend
 const stats = state.dashboard || {
 activeCourses: 0,
 completedLessons: 0,
 totalXp: 0,
 averageExamScore: 0,
 todayXp: 0
 };
 
 // Update stat cards with backend field names
 updateStatCard(0, stats.activeCourses, 'Khóa học');
 updateStatCard(1, stats.completedLessons, 'Bài học');
 updateStatCard(2, stats.totalXp, 'XP');
 updateStatCard(3, stats.averageExamScore || 0, 'Điểm TB');
 
 // Render active courses
 renderActiveCourses();
 
 // Render upcoming class sessions
 renderUpcomingClasses();
 }

 function updateStatCard(index, value, label) {
 const cards = document.querySelectorAll('.stat-card');
 if (cards[index]) {
 const valueEl = cards[index].querySelector('.stat-value');
 const labelEl = cards[index].querySelector('.stat-label');
 if (valueEl) valueEl.textContent = value;
 if (labelEl) labelEl.textContent = label;
 }
 }

 function renderActiveCourses() {
 const container = document.querySelector('[id*="course"]');
 if (!container) return;
 
 const html = state.enrollments
 .filter(e => e.status === 'active')
 .map(enrollment => {
 const progress = enrollment.progress || 0;
 return `
 <div class="course-item">
 <div class="course-thumb" style="background: linear-gradient(135deg, #1a6ef5, #60a5fa)">
 ${enrollment.courseIcon || ''}
 </div>
 <div style="flex: 1; min-width: 0">
 <div class="course-name">${enrollment.courseName}</div>
 <div class="course-meta">${enrollment.completedLessons}/${enrollment.totalLessons} bài học</div>
 <div class="prog-bg">
 <div class="prog-fill" style="width: ${progress}%; background: linear-gradient(90deg, #1a6ef5, #60a5fa)"></div>
 </div>
 </div>
 <a href="baihoc.html" class="btn-continue">Tiếp tục</a>
 </div>
 `;
 })
 .join('');
 
 if (html) {
 container.innerHTML = html;
 }
 }

 function renderUpcomingClasses() {
 const container = document.querySelector('[id*="upcoming"]');
 if (!container) return;
 
 const upcoming = state.classSessions
 .filter(s => new Date(s.startAt) > new Date())
 .sort((a, b) => new Date(a.startAt) - new Date(b.startAt))
 .slice(0, 5);
 
 const html = upcoming.map(session => {
 const startTime = new Date(session.startAt).toLocaleString('vi-VN');
 return `
 <div class="upcoming-item">
 <div class="udot" style="background: #1a6ef5"></div>
 <div style="flex: 1; min-width: 0">
 <div style="font-size: 13px; font-weight: 600; color: var(--text)">${session.title}</div>
 <div style="font-size: 11.5px; color: var(--text-muted); margin-top: 2px">${startTime}</div>
 </div>
 <span class="ubadge" style="background: #e8f0fe; color: #1a6ef5">Sắp tới</span>
 </div>
 `;
 }).join('');
 
 if (html) {
 container.innerHTML = html;
 }
 }

 // ========== SCHEDULE VIEW ==========
 function renderScheduleView() {
 const container = document.getElementById('view-lichhoc');
 if (!container) {
 createView('lichhoc', 'Lịch học');
 return;
 }
 
 const html = `
 <div style="padding: 24px">
 <h2 style="font-size: 20px; font-weight: 800; margin-bottom: 20px"> Lịch học của bạn</h2>
 
 <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 14px; padding: 20px">
 <div id="scheduleContent">Đang tải lịch học...</div>
 </div>
 </div>
 `;
 
 container.innerHTML = html;
 renderScheduleContent();
 }

 function renderScheduleContent() {
 const container = document.getElementById('scheduleContent');
 if (!container) return;
 
 // Group sessions by date
 const grouped = {};
 state.classSessions.forEach(session => {
 const date = new Date(session.startAt).toLocaleDateString('vi-VN');
 if (!grouped[date]) grouped[date] = [];
 grouped[date].push(session);
 });
 
 const html = Object.entries(grouped)
 .sort()
 .map(([date, sessions]) => `
 <div style="margin-bottom: 20px">
 <div style="font-size: 13px; font-weight: 800; color: var(--blue); margin-bottom: 10px">${date}</div>
 ${sessions.map(session => `
 <div style="padding: 12px; border: 1px solid var(--border); border-radius: 8px; margin-bottom: 8px; background: var(--bg)">
 <div style="font-weight: 600; margin-bottom: 4px">${session.title}</div>
 <div style="font-size: 12px; color: var(--text-muted)">${new Date(session.startAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</div>
 ${session.meetingUrl ? `<a href="${session.meetingUrl}" target="_blank" style="font-size: 12px; color: var(--blue); text-decoration: underline; margin-top: 8px; display: inline-block">Vào lớp</a>` : ''}
 </div>
 `).join('')}
 </div>
 `).join('');
 
 container.innerHTML = html || '<div style="text-align: center; color: var(--text-muted); padding: 40px">Không có lịch học nào</div>';
 }

 // ========== EXAMS VIEW ==========
 function renderExamsView() {
 const container = document.getElementById('view-dethithu');
 if (!container) {
 createView('dethithu', 'Đề thi thử');
 return;
 }
 
 const html = `
 <div style="padding: 24px">
 <h2 style="font-size: 20px; font-weight: 800; margin-bottom: 20px"> Đề thi thử</h2>
 
 <div id="examsContent" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px">
 Đang tải đề thi...
 </div>
 </div>
 `;
 
 container.innerHTML = html;
 renderExamsContent();
 }

 function renderExamsContent() {
 const container = document.getElementById('examsContent');
 if (!container) return;

 const apiExamRows = state.exams || [];
 container.innerHTML = apiExamRows.length ? apiExamRows.map(exam => {
 const statusText = exam.status === 'published' ? 'Da mo' : (exam.status || 'De thi');
 const questionCount = exam.questionCount || (Array.isArray(exam.questions) ? exam.questions.length : 0);
 const attempts = Number(exam.submissions || exam.attempts || 0);
 return `
 <div class="db-exam-card">
 <div class="db-exam-thumb">
 <div style="width: 100%; height: 100%; background: linear-gradient(135deg, #1a3fbf, #4a2da8); display: flex; align-items: center; justify-content: center; font-size: 48px">EX</div>
 <span class="db-ex-year">${escapeHtml(exam.type || 'exam')}</span>
 <span class="db-ex-lvl lvl-medium">${escapeHtml(statusText)}</span>
 </div>
 <div class="db-exam-body">
 <h6>${escapeHtml(exam.title || 'De thi')}</h6>
 <div class="db-exam-source">${escapeHtml(exam.courseName || (exam.type === 'mock_test' ? 'De thi thu' : 'Bai tap'))}</div>
 <div class="db-exam-meta">
 <span><i class="bi bi-clock"></i> ${Number(exam.durationMinutes || 0)} phut</span>
 <span><i class="bi bi-question-circle"></i> ${questionCount || 'Dang cap nhat'} cau</span>
 </div>
 </div>
 <div class="db-exam-footer">
 <span class="db-exam-attempts" style="font-size: 11px; color: var(--text-muted)">Da lam: ${attempts}</span>
 <button class="db-btn-start" onclick="startExam('${escapeHtml(exam.id)}')">
 <i class="bi bi-play-fill"></i> Lam bai
 </button>
 </div>
 </div>
 `;
 }).join('') : '<div style="text-align: center; color: var(--text-muted); grid-column: 1/-1; padding: 40px">Khong co de thi nao tu API</div>';
 return;
 
 const html = state.exams
 .map(exam => {
 const levelClass = exam.level === 'easy' ? 'lvl-easy' : exam.level === 'medium' ? 'lvl-medium' : 'lvl-hard';
 const levelText = exam.level === 'easy' ? 'Dễ' : exam.level === 'medium' ? 'Trung bình' : 'Khó';
 
 return `
 <div class="db-exam-card">
 <div class="db-exam-thumb">
 <div style="width: 100%; height: 100%; background: linear-gradient(135deg, #1a3fbf, #4a2da8); display: flex; align-items: center; justify-content: center; font-size: 48px"></div>
 <span class="db-ex-year">${new Date().getFullYear()}</span>
 <span class="db-ex-lvl ${levelClass}">${levelText}</span>
 </div>
 <div class="db-exam-body">
 <h6>${exam.title}</h6>
 <div class="db-exam-source">${exam.type === 'mock_test' ? 'Đề thi thử' : 'Bài tập'}</div>
 <div class="db-exam-meta">
 <span><i class="bi bi-clock"></i> ${exam.durationMinutes} phút</span>
 <span><i class="bi bi-question-circle"></i> ${exam.questions || '50'} câu</span>
 </div>
 </div>
 <div class="db-exam-footer">
 <span class="db-exam-attempts" style="font-size: 11px; color: var(--text-muted)">Đã làm: ${exam.attempts || 0}</span>
 <button class="db-btn-start" onclick="startExam('${exam.id}')">
 <i class="bi bi-play-fill"></i> Làm bài
 </button>
 </div>
 </div>
 `;
 })
 .join('');
 
 container.innerHTML = html || '<div style="text-align: center; color: var(--text-muted); grid-column: 1/-1; padding: 40px">Không có đề thi nào</div>';
 }

 // ========== SPEAKING PRACTICE VIEW ==========
 function renderSpeakingView() {
 const container = document.getElementById('view-spk');
 if (!container) {
 createView('spk', 'Luyện Speaking AI');
 return;
 }
 
 container.innerHTML = `
 <div style="padding: 24px">
 <h2 style="font-size: 20px; font-weight: 800; margin-bottom: 20px"> Luyện Speaking với AI</h2>
 
 <div style="background: linear-gradient(135deg, #0f172a, #1a1040); border-radius: 14px; padding: 40px; text-align: center; color: #fff">
 <div style="font-size: 48px; margin-bottom: 16px"></div>
 <h3 style="font-size: 18px; font-weight: 800; margin-bottom: 8px">AI Phát âm & Luyện nói</h3>
 <p style="font-size: 14px; color: rgba(255, 255, 255, 0.7); margin-bottom: 24px">Luyện tập phát âm chuẩn và kỹ năng nói tiếng Anh với AI thông minh</p>
 <button onclick="startSpeakingPractice()" style="background: var(--blue); color: #fff; border: none; border-radius: 8px; padding: 12px 28px; font-size: 14px; font-weight: 700; cursor: pointer; font-family: 'Be Vietnam Pro', sans-serif;">
 Bắt đầu luyện tập
 </button>
 </div>
 </div>
 `;
 }

 // ========== MATERIALS VIEW ==========
 function renderMaterialsView() {
 const container = document.getElementById('view-tailieu');
 if (!container) {
 createView('tailieu', 'Tài liệu ôn thi');
 return;
 }
 
 container.innerHTML = `
 <div style="padding: 24px">
 <h2 style="font-size: 20px; font-weight: 800; margin-bottom: 20px"> Tài liệu ôn thi</h2>

 <div id="materialsContent" style="display: grid; gap: 12px; max-width: 600px">
 Đang tải tài liệu...
 </div>

 <h3 style="font-size: 16px; font-weight: 800; margin: 28px 0 14px">🃏 Thẻ ghi nhớ (Flashcard)</h3>
 <div id="flashcardSets" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 14px">
 Đang tải bộ thẻ...
 </div>
 </div>
 `;

 renderMaterialsContent();
 loadFlashcardSets();
 }

 async function loadFlashcardSets() {
 const container = document.getElementById('flashcardSets');
 if (!container) return;
 try {
 const res = await apiCall('/api/flashcard-sets');
 const sets = res.sets || [];
 if (!sets.length) {
 container.innerHTML = '<div style="color: var(--text-muted); font-size: 14px; grid-column: 1/-1">Chưa có bộ thẻ nào.</div>';
 return;
 }
 container.innerHTML = sets.map(set => `
 <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 12px; padding: 16px; cursor: pointer; transition: border-color .15s" onmouseover="this.style.borderColor='var(--blue)'" onmouseout="this.style.borderColor='var(--border)'" onclick="openFlashcardSet('${set.id}')">
 <div style="font-size: 28px; margin-bottom: 8px">🃏</div>
 <div style="font-size: 14px; font-weight: 700; color: var(--text)">${escapeHtml(set.title)}</div>
 <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px">${escapeHtml(set.topic || '')}</div>
 <div style="font-size: 12px; color: var(--blue); font-weight: 700; margin-top: 8px">${set.cardCount} thẻ →</div>
 </div>
 `).join('');
 } catch (error) {
 container.innerHTML = '<div style="color: var(--text-muted); font-size: 14px; grid-column: 1/-1">Không tải được bộ thẻ.</div>';
 }
 }

 window.openFlashcardSet = async function(setId) {
 try {
 const res = await apiCall(`/api/flashcard-sets/${setId}`);
 const set = res.set;
 if (!set || !set.cards.length) {
 alert('Bộ thẻ này chưa có thẻ nào.');
 return;
 }
 displayFlashcardModal(set);
 } catch (error) {
 alert('Không mở được bộ thẻ. Vui lòng thử lại.');
 }
 };

 function displayFlashcardModal(set) {
 const existing = document.getElementById('flashcardModal');
 if (existing) existing.remove();

 window.currentFlashcards = { cards: set.cards, index: 0, flipped: false };

 const modalHtml = `
 <div id="flashcardModal" style="position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 10000">
 <div style="background: var(--bg); border-radius: 14px; width: 90%; max-width: 520px; padding: 24px; box-shadow: 0 20px 60px rgba(0,0,0,0.3)">
 <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px">
 <h3 style="margin: 0; font-size: 16px; font-weight: 800">${escapeHtml(set.title)}</h3>
 <button onclick="document.getElementById('flashcardModal').remove()" style="background: none; border: none; font-size: 24px; cursor: pointer; color: var(--text-muted)">&times;</button>
 </div>
 <div id="flashcardCard" onclick="flipFlashcard()" style="min-height: 200px; border: 1px solid var(--border); border-radius: 12px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 24px; cursor: pointer; background: var(--bg-card)"></div>
 <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 16px">
 <button onclick="prevFlashcard()" style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; padding: 8px 16px; cursor: pointer; font-weight: 600">← Trước</button>
 <span id="flashcardCounter" style="font-size: 12px; color: var(--text-muted)"></span>
 <button onclick="nextFlashcard()" style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; padding: 8px 16px; cursor: pointer; font-weight: 600">Tiếp →</button>
 </div>
 <div style="text-align: center; font-size: 12px; color: var(--text-muted); margin-top: 10px">Nhấp vào thẻ để lật</div>
 </div>
 </div>
 `;
 document.body.insertAdjacentHTML('beforeend', modalHtml);
 renderFlashcard();
 }

 function renderFlashcard() {
 const fc = window.currentFlashcards;
 const cardEl = document.getElementById('flashcardCard');
 const counterEl = document.getElementById('flashcardCounter');
 if (!fc || !cardEl) return;
 const card = fc.cards[fc.index];
 if (fc.flipped) {
 cardEl.innerHTML = `
 <div style="font-size: 22px; font-weight: 800; color: var(--blue)">${escapeHtml(card.back)}</div>
 ${card.example ? `<div style="font-size: 13px; color: var(--text-muted); margin-top: 12px; font-style: italic">${escapeHtml(card.example)}</div>` : ''}
 `;
 } else {
 cardEl.innerHTML = `<div style="font-size: 24px; font-weight: 800; color: var(--text)">${escapeHtml(card.front)}</div>`;
 }
 if (counterEl) counterEl.textContent = `${fc.index + 1} / ${fc.cards.length}`;
 }

 window.flipFlashcard = function() {
 if (!window.currentFlashcards) return;
 window.currentFlashcards.flipped = !window.currentFlashcards.flipped;
 renderFlashcard();
 };

 window.nextFlashcard = function() {
 const fc = window.currentFlashcards;
 if (!fc || fc.index >= fc.cards.length - 1) return;
 fc.index += 1;
 fc.flipped = false;
 renderFlashcard();
 };

 window.prevFlashcard = function() {
 const fc = window.currentFlashcards;
 if (!fc || fc.index <= 0) return;
 fc.index -= 1;
 fc.flipped = false;
 renderFlashcard();
 };

 function renderMaterialsContent() {
 const container = document.getElementById('materialsContent');
 if (!container) return;
 
 const materials = state.dashboard.materials || [];
 
 if (materials && materials.length > 0) {
 const html = materials.map(mat => `
 <div class="db-pdf-card" style="align-items:flex-start">
 <div class="db-pdf-icon">
 <i class="bi ${mat.videoUrl ? 'bi-play-btn' : 'bi-file-earmark-text'}"></i>
 </div>
 <div class="db-pdf-info" style="flex:1">
 <h6>${escapeHtml(mat.title || mat.name || 'Bai hoc')}</h6>
 <small>${escapeHtml(mat.courseName || '')}${mat.teacherName ? ' - ' + escapeHtml(mat.teacherName) : ''}</small>
 ${mat.description
  ? `<div style="font-size:12px;color:var(--text-muted);margin-top:6px;line-height:1.5">
      ${escapeHtml(mat.description).replace(/\n/g, '<br>')}
    </div>`
  : ''
 }
 <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
 ${mat.videoUrl ? `<a href="${escapeHtml(mat.videoUrl)}" target="_blank" rel="noopener" class="db-btn-dl" style="text-decoration:none;color:inherit"><i class="bi bi-play-circle"></i> Xem video</a>` : ''}
 ${mat.documentUrl ? `<a href="${escapeHtml(mat.documentUrl)}" target="_blank" rel="noopener" class="db-btn-dl" style="text-decoration:none;color:inherit"><i class="bi bi-box-arrow-up-right"></i> Mo tai lieu</a>` : ''}
 </div>
 </div>
 </div>
 `).join('');
 
 container.innerHTML = html;
 } else {
 container.innerHTML = `
 <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 14px; padding: 40px; text-align: center; grid-column: 1/-1">
 <div style="font-size: 48px; margin-bottom: 12px"></div>
 <p style="color: var(--text-muted); font-size: 14px">Chua co bai giang hoac tai lieu nao da duoc duyet.</p>
 </div>
 `;
 }
 }

 // ========== Q&A VIEW ==========
 function renderQAView() {
 const container = document.getElementById('view-hoidap');
 if (!container) {
 createView('hoidap', 'Hỏi đáp');
 return;
 }

 const courseOptions = (state.enrollments || [])
 .map(c => `<option value="${c.id}">${c.name}</option>`)
 .join('');

 container.innerHTML = `
 <div style="padding: 24px">
 <h2 style="font-size: 20px; font-weight: 800; margin-bottom: 20px"> Hỏi đáp giáo viên</h2>

 <div style="max-width: 600px; margin-bottom: 20px">
 ${courseOptions ? `<select id="qaCourse" style="width: 100%; margin-bottom: 10px; border: 1px solid var(--border); border-radius: 8px; padding: 10px; font-family: 'Be Vietnam Pro', sans-serif; font-size: 14px; background: var(--bg)">
 <option value="">-- Chọn khóa học (không bắt buộc) --</option>
 ${courseOptions}
 </select>` : ''}
 <input id="qaTitle" type="text" placeholder="Tiêu đề câu hỏi (không bắt buộc)" style="width: 100%; margin-bottom: 10px; border: 1px solid var(--border); border-radius: 8px; padding: 10px; font-family: 'Be Vietnam Pro', sans-serif; font-size: 14px">
 <textarea id="qaBody" placeholder="Đặt câu hỏi của bạn..." style="width: 100%; border: 1px solid var(--border); border-radius: 8px; padding: 12px; font-family: 'Be Vietnam Pro', sans-serif; font-size: 14px; resize: vertical; min-height: 100px"></textarea>
 <button onclick="submitQuestion()" style="margin-top: 10px; background: var(--blue); color: #fff; border: none; border-radius: 8px; padding: 10px 20px; font-size: 14px; font-weight: 700; cursor: pointer; font-family: 'Be Vietnam Pro', sans-serif;">Gửi câu hỏi</button>
 </div>

 <div id="qaContent" style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 14px; padding: 20px">
 <div style="text-align: center; color: var(--text-muted)">Đang tải câu hỏi...</div>
 </div>
 </div>
 `;

 loadQAContent();
 }

 function escapeHtml(value) {
 return String(value == null ? '' : value)
 .replace(/&/g, '&amp;')
 .replace(/</g, '&lt;')
 .replace(/>/g, '&gt;')
 .replace(/"/g, '&quot;');
 }

 async function loadQAContent() {
 const container = document.getElementById('qaContent');
 if (!container) return;
 try {
 const res = await apiCall('/api/questions');
 const questions = res.questions || [];
 if (!questions.length) {
 container.innerHTML = '<div style="text-align: center; color: var(--text-muted)">Chưa có câu hỏi nào. Hãy đặt câu hỏi đầu tiên!</div>';
 return;
 }
 container.innerHTML = questions.map(q => {
 const answered = q.status === 'answered';
 const answerBlock = answered
 ? `<div style="margin-top: 10px; padding: 12px; background: var(--bg); border-left: 3px solid var(--blue); border-radius: 6px">
 <div style="font-size: 12px; font-weight: 700; color: var(--blue); margin-bottom: 4px"> ${escapeHtml(q.teacherName || 'Giáo viên')} trả lời:</div>
 <div style="font-size: 14px; color: var(--text)">${escapeHtml(q.answer)}</div>
 </div>`
 : `<div style="margin-top: 8px; font-size: 12px; color: var(--text-muted); font-style: italic">⏳ Đang chờ giáo viên trả lời...</div>`;
 return `
 <div style="padding: 14px 0; border-bottom: 1px solid var(--border)">
 <div style="display: flex; justify-content: space-between; gap: 10px; align-items: flex-start">
 <div style="font-size: 14px; font-weight: 700; color: var(--text)">${escapeHtml(q.title || 'Câu hỏi')}</div>
 <span style="flex-shrink: 0; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 20px; background: ${answered ? '#e6f7ee' : '#fff4e5'}; color: ${answered ? '#15803d' : '#b45309'}">${answered ? 'Đã trả lời' : 'Chờ trả lời'}</span>
 </div>
 ${q.courseName ? `<div style="font-size: 12px; color: var(--text-muted); margin-top: 2px">${escapeHtml(q.courseName)}</div>` : ''}
 <div style="font-size: 14px; color: var(--text); margin-top: 6px">${escapeHtml(q.body)}</div>
 ${answerBlock}
 </div>
 `;
 }).join('');
 } catch (error) {
 container.innerHTML = '<div style="text-align: center; color: var(--text-muted)">Không tải được câu hỏi. Vui lòng thử lại.</div>';
 }
 }

 window.submitQuestion = async function() {
 const bodyEl = document.getElementById('qaBody');
 const titleEl = document.getElementById('qaTitle');
 const courseEl = document.getElementById('qaCourse');
 const body = (bodyEl && bodyEl.value || '').trim();
 if (!body) {
 alert('Vui lòng nhập nội dung câu hỏi.');
 return;
 }
 try {
 await apiCall('/api/questions', {
 method: 'POST',
 body: JSON.stringify({
 body,
 title: titleEl ? titleEl.value.trim() : '',
 courseId: courseEl ? courseEl.value : ''
 })
 });
 if (bodyEl) bodyEl.value = '';
 if (titleEl) titleEl.value = '';
 alert('Đã gửi câu hỏi tới giáo viên!');
 loadQAContent();
 } catch (error) {
 alert('Không gửi được câu hỏi. Vui lòng thử lại.');
 }
 };

 // ========== RESULTS VIEW ==========
 function renderResultsView() {
 const container = document.getElementById('view-ketqua');
 if (!container) {
 createView('ketqua', 'Kết quả');
 return;
 }
 
 // Get stats from API data
 const stats = state.dashboard || {};
 const averageScore = stats.averageExamScore || 0;
 const completedExams = state.examResults ? state.examResults.length : 0;
 const completionRate = stats.completionRate || 0;
 
 // Render stats cards (only if there's data)
 let statsHtml = '';
 if (averageScore > 0 || completedExams > 0 || completionRate > 0) {
 statsHtml = `
 <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px">
 ${averageScore > 0 ? `
 <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 12px; padding: 16px; text-align: center">
 <div style="font-size: 28px; font-weight: 900; color: var(--blue)">${averageScore.toFixed(1)}</div>
 <div style="font-size: 12px; color: var(--text-muted); margin-top: 4px">Điểm trung bình</div>
 </div>
 ` : ''}
 ${completedExams > 0 ? `
 <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 12px; padding: 16px; text-align: center">
 <div style="font-size: 28px; font-weight: 900; color: var(--green)">${completedExams}</div>
 <div style="font-size: 12px; color: var(--text-muted); margin-top: 4px">Bài kiểm tra</div>
 </div>
 ` : ''}
 ${completionRate > 0 ? `
 <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 12px; padding: 16px; text-align: center">
 <div style="font-size: 28px; font-weight: 900; color: var(--orange)">${completionRate}%</div>
 <div style="font-size: 12px; color: var(--text-muted); margin-top: 4px">Tỉ lệ hoàn thành</div>
 </div>
 ` : ''}
 </div>
 `;
 }
 
 // Render exam results table (only if there's data)
 let resultsHtml = '';
 if (state.examResults && state.examResults.length > 0) {
 const examsTableRows = state.examResults.map(exam => {
 const score = exam.score || 0;
 const maxScore = exam.maxScore || 100;
 const percentage = Math.round((score / maxScore) * 100);
 const scoreClass = percentage >= 70 ? 's-high' : percentage >= 50 ? 's-mid' : 's-low';
 const rank = exam.rank || '-';
 
 return `
 <tr>
 <td>${exam.title || 'Bài thi'}</td>
 <td><span class="score-pill ${scoreClass}">${score}/${maxScore}</span></td>
 <td>${rank}</td>
 </tr>
 `;
 }).join('');
 
 resultsHtml = `
 <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 14px; padding: 20px">
 <h3 style="font-size: 14px; font-weight: 800; margin-bottom: 16px">Điểm theo kỳ thi</h3>
 <table class="score-table">
 <thead>
 <tr>
 <th>Kỳ thi</th>
 <th>Điểm</th>
 <th>Xếp hạng</th>
 </tr>
 </thead>
 <tbody>
 ${examsTableRows}
 </tbody>
 </table>
 </div>
 `;
 } else {
 resultsHtml = `
 <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 14px; padding: 40px; text-align: center">
 <div style="font-size: 48px; margin-bottom: 12px"></div>
 <p style="color: var(--text-muted); font-size: 14px">Chưa có kết quả bài kiểm tra nào. Hãy bắt đầu làm bài để xem tiến độ của bạn!</p>
 </div>
 `;
 }
 
 container.innerHTML = `
 <div style="padding: 24px">
 <h2 style="font-size: 20px; font-weight: 800; margin-bottom: 20px"> Kết quả & Tiến độ</h2>
 
 ${statsHtml}
 ${resultsHtml}
 </div>
 `;
 }

 // ========== BADGES VIEW ==========
 function renderBadgesView() {
 const container = document.getElementById('view-huyhieu');
 if (!container) {
 createView('huyhieu', 'Huy hiệu');
 return;
 }
 
 const badges = state.dashboard.badges || [];
 const leaderboard = state.dashboard.leaderboard || [];
 
 // Render badges section
 let badgesHtml = '';
 if (badges && badges.length > 0) {
 badgesHtml = `
 <div style="margin-bottom: 24px">
 <h3 style="font-size: 14px; font-weight: 800; margin-bottom: 12px">Huy hiệu của bạn</h3>
 <div class="badges-grid">
 ${badges.map(badge => `
 <div class="badge-item ${badge.unlocked ? '' : 'locked'}">
 <div class="badge-icon">${badge.icon || ''}</div>
 <div class="badge-name">${badge.name}</div>
 <div class="badge-desc">${badge.description}</div>
 </div>
 `).join('')}
 </div>
 </div>
 `;
 } else {
 badgesHtml = `
 <div style="margin-bottom: 24px; background: var(--bg-card); border: 1px solid var(--border); border-radius: 14px; padding: 40px; text-align: center">
 <div style="font-size: 48px; margin-bottom: 12px"></div>
 <p style="color: var(--text-muted); font-size: 14px">Chưa mở khóa huy hiệu nào. Hãy tiếp tục học để mở khóa huy hiệu!</p>
 </div>
 `;
 }
 
 // Render leaderboard section
 let leaderboardHtml = '';
 if (leaderboard && leaderboard.length > 0) {
 const leaderboardItems = leaderboard.map((user, index) => {
 const isCurrentUser = user.isCurrentUser || false;
 const initials = (user.name || 'User')
 .split(' ')
 .map(n => n[0])
 .join('')
 .toUpperCase()
 .slice(0, 2);
 
 return `
 <div class="lb-item ${isCurrentUser ? 'me' : ''}">
 <div class="lb-rank">${index + 1}</div>
 <div class="lb-avatar" style="background: linear-gradient(135deg, ${user.avatarColor || '#1a6ef5'}, ${user.avatarColorLight || '#60a5fa'})">${initials}</div>
 <div class="lb-name ${isCurrentUser ? 'me-name' : ''}">${user.name || 'Học sinh'}</div>
 <div class="lb-xp">${user.xp || 0} XP</div>
 </div>
 `;
 }).join('');
 
 leaderboardHtml = `
 <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 14px; padding: 20px">
 <h3 style="font-size: 14px; font-weight: 800; margin-bottom: 16px">Bảng xếp hạng</h3>
 <div id="leaderboard" style="margin-top: 16px">
 ${leaderboardItems}
 </div>
 </div>
 `;
 } else {
 leaderboardHtml = `
 <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 14px; padding: 40px; text-align: center">
 <div style="font-size: 48px; margin-bottom: 12px"></div>
 <p style="color: var(--text-muted); font-size: 14px">Bảng xếp hạng hiện chưa có dữ liệu. Hãy làm bài để xuất hiện trong bảng xếp hạng!</p>
 </div>
 `;
 }
 
 container.innerHTML = `
 <div style="padding: 24px">
 <h2 style="font-size: 20px; font-weight: 800; margin-bottom: 20px"> Huy hiệu & Xếp hạng</h2>
 
 ${badgesHtml}
 ${leaderboardHtml}
 </div>
 `;
 }

 // ========== SETTINGS VIEW ==========
 function renderSettingsView() {
 const container = document.getElementById('view-settings');
 if (!container) {
 createView('settings', 'Cài đặt');
 return;
 }
 
 container.innerHTML = `
 <div style="padding: 24px; max-width: 600px">
 <h2 style="font-size: 20px; font-weight: 800; margin-bottom: 24px"> Cài đặt tài khoản</h2>
 
 <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 14px; padding: 20px; margin-bottom: 20px">
 <h3 style="font-size: 14px; font-weight: 800; margin-bottom: 16px">Thông tin cá nhân</h3>
 
 <div style="margin-bottom: 16px">
 <label style="display: block; font-size: 12px; font-weight: 700; margin-bottom: 6px; color: var(--text-muted)">Tên</label>
 <input id="stName" type="text" value="${escapeHtml(state.user.name || '')}" style="width: 100%; border: 1px solid var(--border); border-radius: 8px; padding: 10px; font-family: 'Be Vietnam Pro', sans-serif; font-size: 14px;">
 </div>
 
 <div style="margin-bottom: 16px">
 <label style="display: block; font-size: 12px; font-weight: 700; margin-bottom: 6px; color: var(--text-muted)">Email</label>
 <input id="stEmail" type="email" value="${escapeHtml(state.user.email || '')}" disabled style="width: 100%; border: 1px solid var(--border); border-radius: 8px; padding: 10px; font-family: 'Be Vietnam Pro', sans-serif; font-size: 14px; background: var(--bg);">
 </div>
 
 <div style="margin-bottom: 16px">
 <label style="display: block; font-size: 12px; font-weight: 700; margin-bottom: 6px; color: var(--text-muted)">Số điện thoại</label>
 <input id="stPhone" type="tel" value="${escapeHtml(state.user.phone || '')}" style="width: 100%; border: 1px solid var(--border); border-radius: 8px; padding: 10px; font-family: 'Be Vietnam Pro', sans-serif; font-size: 14px;">
 </div>
 
 <button onclick="stSaveProfile()" style="background: var(--blue); color: #fff; border: none; border-radius: 8px; padding: 10px 20px; font-size: 14px; font-weight: 700; cursor: pointer; font-family: 'Be Vietnam Pro', sans-serif;">Lưu thay đổi</button>
 </div>
 
 <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 14px; padding: 20px">
 <h3 style="font-size: 14px; font-weight: 800; margin-bottom: 16px">Bảo mật</h3>
 <input id="stCurrentPassword" type="password" placeholder="Mat khau hien tai" style="width: 100%; margin-bottom: 10px; border: 1px solid var(--border); border-radius: 8px; padding: 10px; font-family: 'Be Vietnam Pro', sans-serif; font-size: 14px;">
 <input id="stNewPassword" type="password" placeholder="Mat khau moi" style="width: 100%; margin-bottom: 10px; border: 1px solid var(--border); border-radius: 8px; padding: 10px; font-family: 'Be Vietnam Pro', sans-serif; font-size: 14px;">
 <input id="stConfirmPassword" type="password" placeholder="Nhap lai mat khau moi" style="width: 100%; margin-bottom: 12px; border: 1px solid var(--border); border-radius: 8px; padding: 10px; font-family: 'Be Vietnam Pro', sans-serif; font-size: 14px;">
 <button onclick="stChangePassword()" style="width: 100%; background: none; border: 1px solid var(--border); border-radius: 8px; padding: 12px; font-size: 14px; font-weight: 600; cursor: pointer; font-family: 'Be Vietnam Pro', sans-serif; color: var(--blue); transition: all 0.15s;">Đổi mật khẩu</button>
 </div>
 </div>
 `;
 }

 // ========== HELPER FUNCTIONS ==========
 function createView(name, title) {
 const mainEl = document.querySelector('main');
 if (!mainEl) return;
 
 const viewEl = document.createElement('div');
 viewEl.id = `view-${name}`;
 viewEl.style.display = 'none';
 mainEl.appendChild(viewEl);
 }

 // ========== EVENT LISTENERS ==========
 function setupEventListeners() {
 // Notification handling
 window.toggleNotif = function(event) {
 const dropdown = document.getElementById('notifDropdown');
 state.notif.notifOpen = !state.notif.notifOpen;
 dropdown.style.display = state.notif.notifOpen ? 'block' : 'none';
 event.stopPropagation();
 };

 // Close notification on click outside
 document.addEventListener('click', function(event) {
 const dropdown = document.getElementById('notifDropdown');
 if (dropdown && !dropdown.contains(event.target) && !event.target.closest('.btn-notif')) {
 dropdown.style.display = 'none';
 state.notif.notifOpen = false;
 }
 });

 // Logout
 window.logout = function() {
 localStorage.removeItem('ec_auth_token');
 localStorage.removeItem('ec_current_user');
 window.location.replace('dangnhap.html');
 };

 // Handle register click
 window.handleRegisterClick = function() {
 const enrollmentCount = state.enrollments.filter(e => e.status === 'active').length;
 if (enrollmentCount >= 2) {
 document.getElementById('courseSlotNotice').classList.add('show');
 } else {
 window.location.href = 'khoahoc.html';
 }
 };
 }

 // ========== PLACEHOLDER FUNCTIONS ==========
 window.startExam = async function(examId) {
 try {
 console.log('Starting exam:', examId);
 
 // Fetch exam details from API
 const response = await apiCall(`/api/exams/${examId}`);
 if (!response.ok || !response.exam) {
 alert('Không thể tải bài thi. Vui lòng thử lại.');
 return;
 }
 
 const exam = response.exam;
 displayExamModal(exam);
 } catch (error) {
 console.error('Error starting exam:', error);
 alert('Có lỗi xảy ra. Vui lòng thử lại.');
 }
 };

 function displayExamModal(exam) {
 // Check if modal already exists, remove it
 const existing = document.getElementById('examModal');
 if (existing) existing.remove();

 const questions = exam.questions || [];
 let currentQuestion = 0;
 const answers = {};

 const modalHtml = `
 <div id="examModal" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 10000">
 <div style="background: var(--bg); border-radius: 14px; width: 90%; max-width: 900px; max-height: 90vh; display: flex; flex-direction: column; box-shadow: 0 20px 60px rgba(0,0,0,0.3)">
 <!-- Header -->
 <div style="padding: 20px 24px; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center">
 <h2 style="margin: 0; font-size: 18px; font-weight: 800">${exam.title}</h2>
 <button onclick="document.getElementById('examModal').remove()" style="background: none; border: none; font-size: 24px; cursor: pointer; color: var(--text-muted)">&times;</button>
 </div>

 <!-- Question Container -->
 <div style="flex: 1; overflow-y: auto; padding: 24px">
 <div id="examContent">
 <!-- Question content inserted here -->
 </div>
 </div>

 <!-- Footer with navigation -->
 <div style="padding: 20px 24px; border-top: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; gap: 12px">
 <div style="font-size: 12px; color: var(--text-muted)">
 Câu <span id="currentQuestionNo">${currentQuestion + 1}</span>/${questions.length}
 <span id="timerDisplay" style="margin-left: 16px">⏱ ${exam.durationMinutes}:00</span>
 </div>
 <div style="display: flex; gap: 8px">
 <button id="prevBtn" onclick="previousQuestion()" style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; padding: 8px 16px; cursor: pointer; font-weight: 600">← Trước</button>
 <button id="nextBtn" onclick="nextQuestion()" style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; padding: 8px 16px; cursor: pointer; font-weight: 600">Tiếp →</button>
 <button onclick="submitExam()" style="background: var(--blue); color: #fff; border: none; border-radius: 8px; padding: 8px 16px; cursor: pointer; font-weight: 600">Nộp bài</button>
 </div>
 </div>
 </div>
 </div>
 `;

 document.body.insertAdjacentHTML('beforeend', modalHtml);

 // Store exam state globally for navigation
 window.currentExamState = {
 exam: exam,
 currentQuestion: 0,
 answers: {},
 questions: questions
 };

 // Display first question
 displayQuestion(0);

 // Start timer
 startExamTimer(exam.durationMinutes);
 }

 function displayQuestion(index) {
 if (index < 0 || index >= window.currentExamState.questions.length) return;

 window.currentExamState.currentQuestion = index;
 const question = window.currentExamState.questions[index];
 const contentEl = document.getElementById('examContent');
 
 let questionHtml = `
 <div>
 <h3 style="font-size: 16px; font-weight: 700; margin-bottom: 16px">Câu ${index + 1}: ${question.content}</h3>
 `;

 if (question.type === 'multiple_choice' && question.options && question.options.length > 0) {
 questionHtml += `<div style="display: flex; flex-direction: column; gap: 10px">`;
 question.options.forEach((option, i) => {
 const checked = window.currentExamState.answers[question.id] === option ? 'checked' : '';
 questionHtml += `
 <label style="display: flex; align-items: center; padding: 12px; border: 1px solid var(--border); border-radius: 8px; cursor: pointer; transition: all 0.2s">
 <input type="radio" name="question_${question.id}" value="${option}" ${checked} style="margin-right: 10px" onchange="saveAnswer('${question.id}', '${option}')">
 <span>${option}</span>
 </label>
 `;
 });
 questionHtml += `</div>`;
 } else if (question.type === 'true_false') {
 const trueChecked = window.currentExamState.answers[question.id] === 'true' ? 'checked' : '';
 const falseChecked = window.currentExamState.answers[question.id] === 'false' ? 'checked' : '';
 questionHtml += `
 <div style="display: flex; gap: 16px">
 <label style="display: flex; align-items: center; padding: 12px; border: 1px solid var(--border); border-radius: 8px; cursor: pointer">
 <input type="radio" name="question_${question.id}" value="true" ${trueChecked} onchange="saveAnswer('${question.id}', 'true')">
 <span style="margin-left: 8px">Đúng</span>
 </label>
 <label style="display: flex; align-items: center; padding: 12px; border: 1px solid var(--border); border-radius: 8px; cursor: pointer">
 <input type="radio" name="question_${question.id}" value="false" ${falseChecked} onchange="saveAnswer('${question.id}', 'false')">
 <span style="margin-left: 8px">Sai</span>
 </label>
 </div>
 `;
 } else if (question.type === 'essay') {
 const answer = window.currentExamState.answers[question.id] || '';
 questionHtml += `
 <textarea style="width: 100%; min-height: 150px; padding: 12px; border: 1px solid var(--border); border-radius: 8px; font-family: 'Be Vietnam Pro', sans-serif; font-size: 14px; resize: vertical" onchange="saveAnswer('${question.id}', this.value)" placeholder="Nhập câu trả lời của bạn...">${answer}</textarea>
 `;
 }

 questionHtml += `</div>`;
 contentEl.innerHTML = questionHtml;

 // Update button states
 document.getElementById('prevBtn').disabled = index === 0;
 document.getElementById('nextBtn').disabled = index === window.currentExamState.questions.length - 1;
 document.getElementById('currentQuestionNo').textContent = index + 1;
 }

 window.previousQuestion = function() {
 if (window.currentExamState.currentQuestion > 0) {
 displayQuestion(window.currentExamState.currentQuestion - 1);
 }
 };

 window.nextQuestion = function() {
 if (window.currentExamState.currentQuestion < window.currentExamState.questions.length - 1) {
 displayQuestion(window.currentExamState.currentQuestion + 1);
 }
 };

 window.saveAnswer = function(questionId, answer) {
 window.currentExamState.answers[questionId] = answer;
 console.log('Answer saved:', questionId, answer);
 };

 window.submitExam = async function() {
 if (!confirm('Bạn chắc chắn muốn nộp bài thi')) return;

 const examId = window.currentExamState.exam.id;
 const answers = window.currentExamState.answers;

 try {
 // Submit exam result
 const response = await apiCall(`/api/exam-results`, {
 method: 'POST',
 body: JSON.stringify({
 examId: examId,
 answers: answers,
 submittedAt: new Date().toISOString()
 })
 });

 if (response.ok) {
 alert('Nộp bài thành công! Bạn sẽ sớm nhận được kết quả.');
 document.getElementById('examModal').remove();
 // Reload dashboard
 location.reload();
 } else {
 alert('Có lỗi xảy ra khi nộp bài. Vui lòng thử lại.');
 }
 } catch (error) {
 console.error('Error submitting exam:', error);
 alert('Có lỗi xảy ra. Vui lòng thử lại.');
 }
 };

 function startExamTimer(durationMinutes) {
 let totalSeconds = durationMinutes * 60;
 const timerEl = document.getElementById('timerDisplay');

 const interval = setInterval(() => {
 totalSeconds--;
 const minutes = Math.floor(totalSeconds / 60);
 const seconds = totalSeconds % 60;
 timerEl.textContent = `⏱ ${minutes}:${seconds.toString().padStart(2, '0')}`;

 if (totalSeconds <= 0) {
 clearInterval(interval);
 window.submitExam();
 }
 }, 1000);
 }

 window.startSpeakingPractice = function() {
 console.log('Starting speaking practice');
 alert('Tính năng này sẽ sớm ra mắt!');
 };

 window.stSaveProfile = async function() {
 const name = (document.getElementById('stName') || {}).value || '';
 const phone = (document.getElementById('stPhone') || {}).value || '';
 if (!name.trim()) {
 alert('Vui long nhap ten.');
 return;
 }
 try {
 const data = await apiCall('/api/profile', {
 method: 'PATCH',
 body: JSON.stringify({ name: name.trim(), phone: phone.trim() })
 });
 state.user = data.user || { ...state.user, name: name.trim(), phone: phone.trim() };
 localStorage.setItem('ec_current_user', JSON.stringify(state.user));
 updateUserUI();
 alert('Da luu thong tin ca nhan.');
 } catch (error) {
 alert('Khong luu duoc thong tin. Vui long thu lai.');
 }
 };

 window.stChangePassword = async function() {
 const currentPassword = (document.getElementById('stCurrentPassword') || {}).value || '';
 const newPassword = (document.getElementById('stNewPassword') || {}).value || '';
 const confirmPassword = (document.getElementById('stConfirmPassword') || {}).value || '';
 if (!currentPassword || !newPassword) {
 alert('Vui long nhap day du mat khau.');
 return;
 }
 if (newPassword !== confirmPassword) {
 alert('Mat khau moi khong khop.');
 return;
 }
 try {
 await apiCall('/api/profile/password', {
 method: 'PATCH',
 body: JSON.stringify({ currentPassword, newPassword })
 });
 ['stCurrentPassword', 'stNewPassword', 'stConfirmPassword'].forEach(id => {
 const el = document.getElementById(id);
 if (el) el.value = '';
 });
 alert('Da doi mat khau.');
 } catch (error) {
 alert(error.message || 'Khong doi duoc mat khau.');
 }
 };

 window.startSpeakingPractice = async function() {
 if (!window.speakingPractice || typeof window.speakingPractice.startRecording !== 'function') {
 alert('Trinh duyet chua san sang ghi am. Vui long thu lai.');
 return;
 }
 const ok = await window.speakingPractice.startRecording();
 if (!ok) return;
 alert('Dang ghi am. Bam OK de dung va gui bai speaking.');
 window.speakingPractice.stopRecording();
 await window.speakingPractice.submitRecording({
 topic: 'Dashboard speaking practice',
 prompt: 'Free speaking practice from student dashboard',
 status: 'submitted',
 submittedAt: new Date().toISOString()
 });
 };

 window.filterNotif = function(type, button) {
 document.querySelectorAll('.ntab').forEach(b => b.style.color = 'var(--text-muted)');
 document.querySelectorAll('.ntab').forEach(b => b.style.borderBottomColor = 'transparent');
 button.style.color = 'var(--blue)';
 button.style.borderBottomColor = 'var(--blue)';
 };

 window.markAllRead = async function() {
 try {
 await apiCall('/api/notifications/read-all', { method: 'POST' });
 state.notif.allNotifs = (state.notif.allNotifs || []).map(n => ({ ...n, isRead: true }));
 state.notif.unreadCount = 0;
 renderNotifList();
 } catch (error) {
 console.error('Error marking all read:', error);
 }
 };

 window.markNotifRead = async function(id, event) {
 if (event) event.stopPropagation();
 try {
 await apiCall(`/api/notifications/${id}`, { method: 'PATCH' });
 const item = (state.notif.allNotifs || []).find(n => n.id === id);
 if (item && !item.isRead) {
 item.isRead = true;
 state.notif.unreadCount = Math.max(0, state.notif.unreadCount - 1);
 }
 renderNotifList();
 } catch (error) {
 console.error('Error marking notification read:', error);
 }
 };

 function renderNotifList() {
 const list = document.getElementById('notifList');
 const notifs = state.notif.allNotifs || [];
 const unread = notifs.filter(n => !n.isRead).length;
 state.notif.unreadCount = unread;

 const label = document.getElementById('notifUnreadLabel');
 if (label) label.textContent = `${unread} chưa đọc`;
 const dot = document.getElementById('notifDot');
 if (dot) dot.style.display = unread > 0 ? 'block' : 'none';

 if (!list) return;
 if (!notifs.length) {
 list.innerHTML = '<div style="padding: 24px; text-align: center; color: var(--text-muted); font-size: 13px">Không có thông báo nào</div>';
 return;
 }
 const iconFor = type => type === 'exam' ? '' : type === 'material' ? '' : type === 'qa' ? '' : type === 'schedule' ? '' : '';
 list.innerHTML = notifs.map(n => `
 <div style="display: flex; gap: 10px; padding: 12px 16px; border-bottom: 1px solid var(--border); background: ${n.isRead ? 'transparent' : 'var(--blue-light, #eef4ff)'}; cursor: ${n.isRead ? 'default' : 'pointer'}" ${n.isRead ? '' : `onclick="markNotifRead('${n.id}', event)"`}>
 <div style="font-size: 18px; line-height: 1.2">${iconFor(n.type)}</div>
 <div style="flex: 1; min-width: 0">
 <div style="font-size: 13px; font-weight: 700; color: var(--text)">${escapeHtml(n.title)}</div>
 <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px">${escapeHtml(n.body || '')}</div>
 </div>
 ${n.isRead ? '' : '<div style="width: 8px; height: 8px; border-radius: 50%; background: var(--blue); flex-shrink: 0; margin-top: 4px"></div>'}
 </div>
 `).join('');
 }

 // ========== AUTO-INITIALIZE ==========
 document.addEventListener('DOMContentLoaded', initDashboard);

})();
