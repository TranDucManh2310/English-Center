/**
 * Student Dashboard - Extended Features
 * Các chức năng bổ sung cho dashboard học sinh
 */

(function() {
  'use strict';

  // ========== NOTIFICATION SYSTEM ==========
  class NotificationManager {
    constructor() {
      this.notifications = [];
      this.container = null;
      this.init();
    }

    init() {
      // Create container if not exists
      if (!this.container) {
        this.container = document.createElement('div');
        this.container.id = 'notification-container';
        this.container.style.cssText = `
          position: fixed;
          top: 80px;
          right: 20px;
          z-index: 10000;
          display: flex;
          flex-direction: column;
          gap: 12px;
        `;
        document.body.appendChild(this.container);
      }
    }

    show(message, type = 'success', duration = 3000) {
      const id = Date.now();
      const notifEl = document.createElement('div');
      
      const bgColor = type === 'success' ? '#16a34a' :
                      type === 'error' ? '#dc2626' :
                      type === 'warning' ? '#ea580c' : '#1a6ef5';
      
      notifEl.style.cssText = `
        background: ${bgColor};
        color: #fff;
        padding: 12px 16px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        font-size: 13px;
        font-weight: 600;
        animation: slideInRight 0.3s ease;
      `;
      notifEl.textContent = message;
      
      this.container.appendChild(notifEl);
      
      setTimeout(() => {
        notifEl.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => notifEl.remove(), 300);
      }, duration);
    }
  }

  window.notificationManager = new NotificationManager();

  // ========== SPEAKING PRACTICE ==========
  class SpeakingPractice {
    constructor() {
      this.recorder = null;
      this.mediaStream = null;
      this.isRecording = false;
    }

    async startRecording() {
      try {
        this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const source = audioContext.createMediaStreamSource(this.mediaStream);
        
        // Simple audio processing
        const analyser = audioContext.createAnalyser();
        source.connect(analyser);
        
        this.isRecording = true;
        return true;
      } catch (error) {
        console.error('Error accessing microphone:', error);
        window.notificationManager.show('Không thể truy cập microphone', 'error');
        return false;
      }
    }

    stopRecording() {
      if (this.mediaStream) {
        this.mediaStream.getTracks().forEach(track => track.stop());
      }
      this.isRecording = false;
    }

    async submitRecording(data) {
      try {
        const token = localStorage.getItem('ec_auth_token');
        const response = await fetch('/api/speaking-submissions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(data)
        });
        
        if (response.ok) {
          window.notificationManager.show('Bài speaking được gửi thành công!', 'success');
          return true;
        }
      } catch (error) {
        console.error('Error submitting recording:', error);
        window.notificationManager.show('Lỗi khi gửi bài speaking', 'error');
        return false;
      }
    }
  }

  window.speakingPractice = new SpeakingPractice();

  // ========== PROGRESS TRACKING ==========
  class ProgressTracker {
    static updateProgress(enrollmentId, lessonId, progress) {
      const token = localStorage.getItem('ec_auth_token');
      return fetch('/api/lesson-progress', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          enrollmentId,
          lessonId,
          progress,
          completedAt: new Date().toISOString()
        })
      });
    }

    static async submitExamResult(examId, answers, timeSpent) {
      const token = localStorage.getItem('ec_auth_token');
      try {
        const response = await fetch('/api/exam-results', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            examId,
            answers,
            timeSpent,
            submittedAt: new Date().toISOString()
          })
        });

        if (response.ok) {
          const data = await response.json();
          window.notificationManager.show('Bài thi được gửi thành công!', 'success');
          return data;
        }
      } catch (error) {
        console.error('Error submitting exam result:', error);
        window.notificationManager.show('Lỗi khi gửi kết quả thi', 'error');
      }
    }
  }

  window.progressTracker = ProgressTracker;

  // ========== EXAM TIMER ==========
  class ExamTimer {
    constructor(durationMinutes, onTimeUp) {
      this.duration = durationMinutes * 60 * 1000; // Convert to ms
      this.startTime = Date.now();
      this.onTimeUp = onTimeUp;
      this.intervalId = null;
    }

    start() {
      this.intervalId = setInterval(() => {
        const elapsed = Date.now() - this.startTime;
        const remaining = this.duration - elapsed;

        if (remaining <= 0) {
          this.stop();
          this.onTimeUp();
        } else {
          this.updateDisplay(remaining);
        }
      }, 1000);
    }

    stop() {
      if (this.intervalId) {
        clearInterval(this.intervalId);
      }
    }

    updateDisplay(remaining) {
      const minutes = Math.floor(remaining / 60000);
      const seconds = Math.floor((remaining % 60000) / 1000);
      
      const timerEl = document.querySelector('[id*="timer"]');
      if (timerEl) {
        timerEl.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        
        // Warning when less than 5 minutes
        if (remaining < 5 * 60 * 1000) {
          timerEl.style.color = '#dc2626';
        }
      }
    }
  }

  window.ExamTimer = ExamTimer;

  // ========== SEARCH & FILTER ==========
  class SearchFilter {
    static createFilterUI(containerId, options = {}) {
      const container = document.getElementById(containerId);
      if (!container) return;

      const filterEl = document.createElement('div');
      filterEl.style.cssText = `
        display: flex;
        gap: 8px;
        margin-bottom: 16px;
        flex-wrap: wrap;
      `;

      Object.entries(options).forEach(([key, values]) => {
        const buttons = values.map(value => `
          <button onclick="filterBy('${key}', '${value}')" style="
            padding: 6px 12px;
            border: 1px solid var(--border);
            border-radius: 20px;
            background: none;
            cursor: pointer;
            font-size: 12px;
            font-weight: 600;
            transition: all 0.15s;
            font-family: 'Be Vietnam Pro', sans-serif;
          ">${value}</button>
        `).join('');

        filterEl.innerHTML += buttons;
      });

      container.insertBefore(filterEl, container.firstChild);
    }

    static filter(items, criteria) {
      return items.filter(item => {
        return Object.entries(criteria).every(([key, value]) => {
          return item[key] === value;
        });
      });
    }
  }

  window.searchFilter = SearchFilter;

  // ========== DATA EXPORT ==========
  class DataExport {
    static exportToCSV(data, filename = 'export.csv') {
      if (!Array.isArray(data) || data.length === 0) return;

      const headers = Object.keys(data[0]);
      const rows = data.map(item => 
        headers.map(h => `"${item[h]}"`).join(',')
      );

      const csv = [headers.join(','), ...rows].join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      
      window.URL.revokeObjectURL(url);
    }

    static exportToPDF(elementId, filename = 'export.pdf') {
      const element = document.getElementById(elementId);
      if (!element) return;

      // Simple HTML to PDF - in production use html2pdf library
      const printWindow = window.open('', '', 'height=600,width=800');
      printWindow.document.write(element.innerHTML);
      printWindow.document.close();
      printWindow.print();
    }
  }

  window.dataExport = DataExport;

  // ========== CHART HELPER ==========
  class ChartHelper {
    static createProgressBar(containerId, percentage, label) {
      const container = document.getElementById(containerId);
      if (!container) return;

      const html = `
        <div style="margin-bottom: 16px">
          <div style="display: flex; justify-content: space-between; margin-bottom: 6px">
            <span style="font-size: 13px; font-weight: 600; color: var(--text)">${label}</span>
            <span style="font-size: 13px; font-weight: 600; color: var(--blue)">${Math.round(percentage)}%</span>
          </div>
          <div style="height: 8px; background: var(--border); border-radius: 4px; overflow: hidden">
            <div style="height: 100%; background: linear-gradient(90deg, var(--blue), #60a5fa); width: ${percentage}%; transition: width 1s ease"></div>
          </div>
        </div>
      `;

      container.innerHTML += html;
    }

    static createStatCard(label, value, icon) {
      return `
        <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 12px; padding: 16px; text-align: center">
          <div style="font-size: 24px; margin-bottom: 8px">${icon}</div>
          <div style="font-size: 22px; font-weight: 900; color: var(--blue); font-family: 'JetBrains Mono', monospace">${value}</div>
          <div style="font-size: 12px; color: var(--text-muted); margin-top: 4px">${label}</div>
        </div>
      `;
    }
  }

  window.chartHelper = ChartHelper;

  // ========== KEYBOARD SHORTCUTS ==========
  class KeyboardShortcuts {
    static init() {
      document.addEventListener('keydown', (event) => {
        // Ctrl/Cmd + S: Save
        if ((event.ctrlKey || event.metaKey) && event.key === 's') {
          event.preventDefault();
          console.log('Save triggered');
        }

        // Ctrl/Cmd + F: Focus search
        if ((event.ctrlKey || event.metaKey) && event.key === 'f') {
          event.preventDefault();
          const searchInput = document.querySelector('input[placeholder*="tìm"]');
          if (searchInput) searchInput.focus();
        }

        // Esc: Close modals
        if (event.key === 'Escape') {
          const modals = document.querySelectorAll('[id*="modal"]');
          modals.forEach(modal => {
            if (modal.style.display !== 'none') {
              modal.style.display = 'none';
            }
          });
        }
      });
    }
  }

  window.KeyboardShortcuts = KeyboardShortcuts;
  KeyboardShortcuts.init();

  // ========== LOCAL STORAGE UTILS ==========
  class StorageUtils {
    static set(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch (error) {
        console.error('Error saving to localStorage:', error);
      }
    }

    static get(key) {
      try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : null;
      } catch (error) {
        console.error('Error reading from localStorage:', error);
        return null;
      }
    }

    static remove(key) {
      localStorage.removeItem(key);
    }

    static clear() {
      localStorage.clear();
    }

    static getAllDashboardData() {
      return {
        user: this.get('ec_current_user'),
        token: localStorage.getItem('ec_auth_token'),
        preferences: this.get('dashboard_preferences')
      };
    }
  }

  window.storageUtils = StorageUtils;

  // ========== ANALYTICS ==========
  class Analytics {
    static trackEvent(eventName, eventData = {}) {
      const event = {
        name: eventName,
        timestamp: new Date().toISOString(),
        data: eventData,
        userId: StorageUtils.get('ec_current_user').id
      };

      // Send to backend
      const token = localStorage.getItem('ec_auth_token');
      fetch('/api/analytics', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(event)
      }).catch(err => console.log('Analytics error:', err));
    }

    static trackPageView(pageName) {
      this.trackEvent('page_view', { page: pageName });
    }

    static trackCourseEnrollment(courseId) {
      this.trackEvent('course_enrolled', { courseId });
    }

    static trackExamStart(examId) {
      this.trackEvent('exam_started', { examId });
    }

    static trackExamSubmit(examId, score) {
      this.trackEvent('exam_submitted', { examId, score });
    }
  }

  window.analytics = Analytics;

  // ========== PERFORMANCE MONITORING ==========
  class PerformanceMonitor {
    static init() {
      if ('PerformanceObserver' in window) {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            console.log(`[Perf] ${entry.name}: ${entry.duration.toFixed(2)}ms`);
          }
        });

        observer.observe({ entryTypes: ['measure', 'navigation'] });
      }
    }

    static measure(name, startMark, endMark) {
      performance.mark(endMark);
      performance.measure(name, startMark, endMark);
    }
  }

  PerformanceMonitor.init();
  window.performanceMonitor = PerformanceMonitor;

  // ========== ADD STYLES ==========
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideInRight {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }

    @keyframes slideOutRight {
      from { transform: translateX(0); opacity: 1; }
      to { transform: translateX(100%); opacity: 0; }
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.7; }
    }

    .loading { animation: pulse 1.5s ease-in-out infinite; }
  `;
  document.head.appendChild(style);

})();
