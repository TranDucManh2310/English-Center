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
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    };

    try {
      const response = await fetch(path, {
        ...options,
        headers
      });

      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem('ec_auth_token');
          localStorage.removeItem('ec_current_user');
          window.location.replace('dangnhap.html');
        }
        throw new Error(`API error: ${response.status}`);
      }

      return await response.json();
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
      state.enrollments = dashboard.courses || [];
      state.exams = dashboard.recentExamResults || [];
      state.classSessions = dashboard.upcomingSessions || [];
      
      console.log('Dashboard data loaded:', {
        stats: state.dashboard,
        enrollments: state.enrollments,
        exams: state.exams,
        sessions: state.classSessions
      });
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    }
  }

  // ========== UI UPDATES ==========
  function updateUserUI() {
    const user = state.user;
    
    // Update sidebar
    const initials = user.name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
    
    document.getElementById('sAvatar').textContent = initials;
    document.getElementById('sName').textContent = user.name;
    document.getElementById('sEmail').textContent = user.email;
    
    // Update greeting
    const hour = new Date().getHours();
    let greeting = 'Chào buổi sáng! 👋';
    if (hour >= 12 && hour < 18) greeting = 'Chào buổi chiều! ☀️';
    if (hour >= 18) greeting = 'Chào buổi tối! 🌙';
    
    document.getElementById('wTitle').textContent = greeting;
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
              ${enrollment.courseIcon || '📚'}
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
        <h2 style="font-size: 20px; font-weight: 800; margin-bottom: 20px">📅 Lịch học của bạn</h2>
        
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
        <h2 style="font-size: 20px; font-weight: 800; margin-bottom: 20px">📝 Đề thi thử</h2>
        
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
    
    const html = state.exams
      .map(exam => {
        const levelClass = exam.level === 'easy' ? 'lvl-easy' : exam.level === 'medium' ? 'lvl-medium' : 'lvl-hard';
        const levelText = exam.level === 'easy' ? 'Dễ' : exam.level === 'medium' ? 'Trung bình' : 'Khó';
        
        return `
          <div class="db-exam-card">
            <div class="db-exam-thumb">
              <div style="width: 100%; height: 100%; background: linear-gradient(135deg, #1a3fbf, #4a2da8); display: flex; align-items: center; justify-content: center; font-size: 48px">📋</div>
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
        <h2 style="font-size: 20px; font-weight: 800; margin-bottom: 20px">🎙️ Luyện Speaking với AI</h2>
        
        <div style="background: linear-gradient(135deg, #0f172a, #1a1040); border-radius: 14px; padding: 40px; text-align: center; color: #fff">
          <div style="font-size: 48px; margin-bottom: 16px">🤖</div>
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
        <h2 style="font-size: 20px; font-weight: 800; margin-bottom: 20px">📚 Tài liệu ôn thi</h2>
        
        <div id="materialsContent" style="display: grid; gap: 12px; max-width: 600px">
          Đang tải tài liệu...
        </div>
      </div>
    `;
    
    renderMaterialsContent();
  }

  function renderMaterialsContent() {
    const container = document.getElementById('materialsContent');
    if (!container) return;
    
    const materials = [
      { name: 'Từ vựng THPTQG 2024', size: '2.5 MB' },
      { name: 'Ngữ pháp trọng tâm', size: '1.8 MB' },
      { name: 'Đáp án 100 đề thi', size: '5.2 MB' }
    ];
    
    const html = materials.map(mat => `
      <div class="db-pdf-card">
        <div class="db-pdf-icon">
          <i class="bi bi-file-pdf"></i>
        </div>
        <div class="db-pdf-info">
          <h6>${mat.name}</h6>
          <small>${mat.size}</small>
        </div>
        <button class="db-btn-dl">
          <i class="bi bi-download"></i> Tải
        </button>
      </div>
    `).join('');
    
    container.innerHTML = html;
  }

  // ========== Q&A VIEW ==========
  function renderQAView() {
    const container = document.getElementById('view-hoidap');
    if (!container) {
      createView('hoidap', 'Hỏi đáp');
      return;
    }
    
    container.innerHTML = `
      <div style="padding: 24px">
        <h2 style="font-size: 20px; font-weight: 800; margin-bottom: 20px">💬 Hỏi đáp giáo viên</h2>
        
        <div style="max-width: 600px; margin-bottom: 20px">
          <textarea placeholder="Đặt câu hỏi của bạn..." style="width: 100%; border: 1px solid var(--border); border-radius: 8px; padding: 12px; font-family: 'Be Vietnam Pro', sans-serif; font-size: 14px; resize: vertical; min-height: 100px"></textarea>
          <button style="margin-top: 10px; background: var(--blue); color: #fff; border: none; border-radius: 8px; padding: 10px 20px; font-size: 14px; font-weight: 700; cursor: pointer; font-family: 'Be Vietnam Pro', sans-serif;">Gửi câu hỏi</button>
        </div>
        
        <div id="qaContent" style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 14px; padding: 20px">
          <div style="text-align: center; color: var(--text-muted)">Chưa có câu hỏi nào</div>
        </div>
      </div>
    `;
  }

  // ========== RESULTS VIEW ==========
  function renderResultsView() {
    const container = document.getElementById('view-ketqua');
    if (!container) {
      createView('ketqua', 'Kết quả');
      return;
    }
    
    container.innerHTML = `
      <div style="padding: 24px">
        <h2 style="font-size: 20px; font-weight: 800; margin-bottom: 20px">📊 Kết quả & Tiến độ</h2>
        
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px">
          <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 12px; padding: 16px; text-align: center">
            <div style="font-size: 28px; font-weight: 900; color: var(--blue)">85</div>
            <div style="font-size: 12px; color: var(--text-muted); margin-top: 4px">Điểm trung bình</div>
          </div>
          <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 12px; padding: 16px; text-align: center">
            <div style="font-size: 28px; font-weight: 900; color: var(--green)">45</div>
            <div style="font-size: 12px; color: var(--text-muted); margin-top: 4px">Bài kiểm tra</div>
          </div>
          <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 12px; padding: 16px; text-align: center">
            <div style="font-size: 28px; font-weight: 900; color: var(--orange)">68%</div>
            <div style="font-size: 12px; color: var(--text-muted); margin-top: 4px">Tỉ lệ hoàn thành</div>
          </div>
        </div>
        
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
              <tr>
                <td>Đề thi thử 1</td>
                <td><span class="score-pill s-high">82/100</span></td>
                <td>Top 15%</td>
              </tr>
              <tr>
                <td>Đề thi thử 2</td>
                <td><span class="score-pill s-mid">75/100</span></td>
                <td>Top 25%</td>
              </tr>
              <tr>
                <td>Đề thi thử 3</td>
                <td><span class="score-pill s-low">68/100</span></td>
                <td>Top 40%</td>
              </tr>
            </tbody>
          </table>
        </div>
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
    
    container.innerHTML = `
      <div style="padding: 24px">
        <h2 style="font-size: 20px; font-weight: 800; margin-bottom: 20px">🏆 Huy hiệu & Xếp hạng</h2>
        
        <div style="margin-bottom: 24px">
          <h3 style="font-size: 14px; font-weight: 800; margin-bottom: 12px">Huy hiệu của bạn</h3>
          <div class="badges-grid">
            <div class="badge-item">
              <div class="badge-icon">🌟</div>
              <div class="badge-name">Bắt đầu tốt</div>
              <div class="badge-desc">Hoàn thành 1 khóa</div>
            </div>
            <div class="badge-item">
              <div class="badge-icon">🔥</div>
              <div class="badge-name">Chiến binh</div>
              <div class="badge-desc">7 ngày liên tiếp</div>
            </div>
            <div class="badge-item locked">
              <div class="badge-icon">👑</div>
              <div class="badge-name">Vua học tập</div>
              <div class="badge-desc">Hoàn thành 5 khóa</div>
            </div>
          </div>
        </div>
        
        <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 14px; padding: 20px">
          <h3 style="font-size: 14px; font-weight: 800; margin-bottom: 16px">Bảng xếp hạng hàng tuần</h3>
          <div class="tab-row">
            <button class="tab-btn active">Hàng tuần</button>
            <button class="tab-btn">Hàng tháng</button>
            <button class="tab-btn">Tất cả thời gian</button>
          </div>
          
          <div id="leaderboard" style="margin-top: 16px">
            <div class="lb-item me">
              <div class="lb-rank">1</div>
              <div class="lb-avatar" style="background: linear-gradient(135deg, var(--blue), #60a5fa)">Bạn</div>
              <div class="lb-name me-name">Bạn (2500 XP)</div>
              <div class="lb-xp">🔥 Đỉnh cao</div>
            </div>
            <div class="lb-item">
              <div class="lb-rank">2</div>
              <div class="lb-avatar" style="background: linear-gradient(135deg, #f59e0b, #fbbf24)">ND</div>
              <div class="lb-name">Nguyễn Duy</div>
              <div class="lb-xp">2400 XP</div>
            </div>
            <div class="lb-item">
              <div class="lb-rank">3</div>
              <div class="lb-avatar" style="background: linear-gradient(135deg, #8b5cf6, #a78bfa)">TL</div>
              <div class="lb-name">Trần Linh</div>
              <div class="lb-xp">2300 XP</div>
            </div>
          </div>
        </div>
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
        <h2 style="font-size: 20px; font-weight: 800; margin-bottom: 24px">⚙️ Cài đặt tài khoản</h2>
        
        <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 14px; padding: 20px; margin-bottom: 20px">
          <h3 style="font-size: 14px; font-weight: 800; margin-bottom: 16px">Thông tin cá nhân</h3>
          
          <div style="margin-bottom: 16px">
            <label style="display: block; font-size: 12px; font-weight: 700; margin-bottom: 6px; color: var(--text-muted)">Tên</label>
            <input type="text" value="${state.user.name}" style="width: 100%; border: 1px solid var(--border); border-radius: 8px; padding: 10px; font-family: 'Be Vietnam Pro', sans-serif; font-size: 14px;">
          </div>
          
          <div style="margin-bottom: 16px">
            <label style="display: block; font-size: 12px; font-weight: 700; margin-bottom: 6px; color: var(--text-muted)">Email</label>
            <input type="email" value="${state.user.email}" disabled style="width: 100%; border: 1px solid var(--border); border-radius: 8px; padding: 10px; font-family: 'Be Vietnam Pro', sans-serif; font-size: 14px; background: var(--bg);">
          </div>
          
          <div style="margin-bottom: 16px">
            <label style="display: block; font-size: 12px; font-weight: 700; margin-bottom: 6px; color: var(--text-muted)">Số điện thoại</label>
            <input type="tel" value="${state.user.phone || ''}" style="width: 100%; border: 1px solid var(--border); border-radius: 8px; padding: 10px; font-family: 'Be Vietnam Pro', sans-serif; font-size: 14px;">
          </div>
          
          <button style="background: var(--blue); color: #fff; border: none; border-radius: 8px; padding: 10px 20px; font-size: 14px; font-weight: 700; cursor: pointer; font-family: 'Be Vietnam Pro', sans-serif;">Lưu thay đổi</button>
        </div>
        
        <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 14px; padding: 20px">
          <h3 style="font-size: 14px; font-weight: 800; margin-bottom: 16px">Bảo mật</h3>
          <button style="width: 100%; background: none; border: 1px solid var(--border); border-radius: 8px; padding: 12px; font-size: 14px; font-weight: 600; cursor: pointer; font-family: 'Be Vietnam Pro', sans-serif; color: var(--blue); transition: all 0.15s;">
            Đổi mật khẩu
          </button>
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
  window.startExam = function(examId) {
    console.log('Starting exam:', examId);
    // Redirect to exam page
    window.location.href = `dethithu.html?exam=${examId}`;
  };

  window.startSpeakingPractice = function() {
    console.log('Starting speaking practice');
    alert('Tính năng này sẽ sớm ra mắt!');
  };

  window.filterNotif = function(type, button) {
    document.querySelectorAll('.ntab').forEach(b => b.style.color = 'var(--text-muted)');
    document.querySelectorAll('.ntab').forEach(b => b.style.borderBottomColor = 'transparent');
    button.style.color = 'var(--blue)';
    button.style.borderBottomColor = 'var(--blue)';
  };

  window.markAllRead = function() {
    // Mark all notifications as read
    console.log('Marking all as read');
  };

  // ========== AUTO-INITIALIZE ==========
  document.addEventListener('DOMContentLoaded', initDashboard);

})();
