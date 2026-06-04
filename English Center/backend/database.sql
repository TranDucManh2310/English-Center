CREATE DATABASE IF NOT EXISTS english_center
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE english_center;

CREATE TABLE IF NOT EXISTS users (
  id CHAR(36) PRIMARY KEY,
  email VARCHAR(190) NOT NULL UNIQUE,
  name VARCHAR(190) NOT NULL,
  role ENUM('student', 'teacher', 'admin') NOT NULL DEFAULT 'student',
  phone VARCHAR(40) NOT NULL DEFAULT '',
  education VARCHAR(100) NOT NULL DEFAULT '',
  experience VARCHAR(100) NOT NULL DEFAULT '',
  motivation TEXT NULL,
  preferred_schedule VARCHAR(100) NOT NULL DEFAULT '',
  newsletter TINYINT(1) NOT NULL DEFAULT 0,
  enrolled JSON NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sessions (
  token CHAR(64) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  last_active_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  current_page VARCHAR(255) NOT NULL DEFAULT '',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_sessions_last_active (last_active_at),
  CONSTRAINT fk_sessions_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS submissions (
  id CHAR(36) PRIMARY KEY,
  type VARCHAR(40) NOT NULL DEFAULT 'contact',
  payload JSON NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS courses (
  id CHAR(36) PRIMARY KEY,
  slug VARCHAR(120) NOT NULL UNIQUE,
  name VARCHAR(190) NOT NULL,
  description TEXT NULL,
  level VARCHAR(80) NOT NULL DEFAULT '',
  status ENUM('draft', 'active', 'completed', 'archived') NOT NULL DEFAULT 'active',
  price DECIMAL(12,2) NOT NULL DEFAULT 0,
  duration_weeks INT NOT NULL DEFAULT 8,
  capacity INT NOT NULL DEFAULT 40,
  teacher_id CHAR(36) NULL,
  start_date DATE NULL,
  end_date DATE NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_courses_teacher
    FOREIGN KEY (teacher_id) REFERENCES users(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS enrollments (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  course_id CHAR(36) NOT NULL,
  status ENUM('active', 'completed', 'paused', 'cancelled') NOT NULL DEFAULT 'active',
  progress DECIMAL(5,2) NOT NULL DEFAULT 0,
  completed_lessons INT NOT NULL DEFAULT 0,
  xp INT NOT NULL DEFAULT 0,
  paid_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  payment_status ENUM('paid', 'pending', 'overdue', 'refunded') NOT NULL DEFAULT 'pending',
  enrolled_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP NULL DEFAULT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_enrollments_user_course (user_id, course_id),
  INDEX idx_enrollments_course (course_id),
  CONSTRAINT fk_enrollments_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_enrollments_course
    FOREIGN KEY (course_id) REFERENCES courses(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS lessons (
  id CHAR(36) PRIMARY KEY,
  course_id CHAR(36) NOT NULL,
  title VARCHAR(190) NOT NULL,
  position INT NOT NULL DEFAULT 1,
  duration_minutes INT NOT NULL DEFAULT 45,
  status ENUM('draft', 'published', 'archived') NOT NULL DEFAULT 'published',
  published_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_lessons_course_position (course_id, position),
  CONSTRAINT fk_lessons_course
    FOREIGN KEY (course_id) REFERENCES courses(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS lesson_progress (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  lesson_id CHAR(36) NOT NULL,
  status ENUM('not_started', 'in_progress', 'completed') NOT NULL DEFAULT 'not_started',
  score DECIMAL(4,2) NULL,
  xp INT NOT NULL DEFAULT 0,
  last_opened_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP NULL DEFAULT NULL,
  UNIQUE KEY uq_lesson_progress_user_lesson (user_id, lesson_id),
  CONSTRAINT fk_lesson_progress_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_lesson_progress_lesson
    FOREIGN KEY (lesson_id) REFERENCES lessons(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS class_sessions (
  id CHAR(36) PRIMARY KEY,
  course_id CHAR(36) NOT NULL,
  teacher_id CHAR(36) NULL,
  title VARCHAR(190) NOT NULL,
  session_no INT NOT NULL DEFAULT 1,
  start_at DATETIME NOT NULL,
  end_at DATETIME NOT NULL,
  meeting_url VARCHAR(255) NOT NULL DEFAULT '',
  status ENUM('scheduled', 'done', 'cancelled') NOT NULL DEFAULT 'scheduled',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_class_sessions_start (start_at),
  CONSTRAINT fk_class_sessions_course
    FOREIGN KEY (course_id) REFERENCES courses(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_class_sessions_teacher
    FOREIGN KEY (teacher_id) REFERENCES users(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS attendance (
  id CHAR(36) PRIMARY KEY,
  session_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  status ENUM('present', 'late', 'absent', 'excused') NOT NULL DEFAULT 'present',
  note VARCHAR(255) NOT NULL DEFAULT '',
  marked_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_attendance_session_user (session_id, user_id),
  CONSTRAINT fk_attendance_session
    FOREIGN KEY (session_id) REFERENCES class_sessions(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_attendance_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS exams (
  id CHAR(36) PRIMARY KEY,
  course_id CHAR(36) NULL,
  title VARCHAR(190) NOT NULL,
  type ENUM('mock_test', 'homework', 'quiz', 'speaking') NOT NULL DEFAULT 'mock_test',
  total_score DECIMAL(5,2) NOT NULL DEFAULT 10,
  duration_minutes INT NOT NULL DEFAULT 60,
  status ENUM('draft', 'published', 'archived') NOT NULL DEFAULT 'published',
  published_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  due_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_exams_course
    FOREIGN KEY (course_id) REFERENCES courses(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS exam_results (
  id CHAR(36) PRIMARY KEY,
  exam_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  teacher_id CHAR(36) NULL,
  score DECIMAL(5,2) NULL,
  status ENUM('submitted', 'graded', 'returned') NOT NULL DEFAULT 'submitted',
  feedback TEXT NULL,
  xp INT NOT NULL DEFAULT 0,
  submitted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  graded_at TIMESTAMP NULL DEFAULT NULL,
  UNIQUE KEY uq_exam_results_exam_user (exam_id, user_id),
  INDEX idx_exam_results_user (user_id),
  CONSTRAINT fk_exam_results_exam
    FOREIGN KEY (exam_id) REFERENCES exams(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_exam_results_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_exam_results_teacher
    FOREIGN KEY (teacher_id) REFERENCES users(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS exam_questions (
  id CHAR(36) PRIMARY KEY,
  exam_id CHAR(36) NOT NULL,
  question_no INT NOT NULL DEFAULT 1,
  content TEXT NOT NULL,
  type ENUM('multiple_choice', 'true_false', 'essay') NOT NULL DEFAULT 'multiple_choice',
  options JSON NULL,
  correct_answer VARCHAR(255) NULL,
  explanation TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_exam_questions_exam_no (exam_id, question_no),
  CONSTRAINT fk_exam_questions_exam
    FOREIGN KEY (exam_id) REFERENCES exams(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS exam_answer_choices (
  id CHAR(36) PRIMARY KEY,
  question_id CHAR(36) NOT NULL,
  choice_no INT NOT NULL DEFAULT 1,
  content TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_answer_choices_question_choice (question_id, choice_no),
  CONSTRAINT fk_answer_choices_question
    FOREIGN KEY (question_id) REFERENCES exam_questions(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS teacher_reviews (
  id CHAR(36) PRIMARY KEY,
  teacher_id CHAR(36) NOT NULL,
  student_id CHAR(36) NULL,
  course_id CHAR(36) NULL,
  rating DECIMAL(3,2) NOT NULL,
  comment TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_teacher_reviews_teacher
    FOREIGN KEY (teacher_id) REFERENCES users(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_teacher_reviews_student
    FOREIGN KEY (student_id) REFERENCES users(id)
    ON DELETE SET NULL,
  CONSTRAINT fk_teacher_reviews_course
    FOREIGN KEY (course_id) REFERENCES courses(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS notifications (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NULL,
  title VARCHAR(190) NOT NULL,
  body TEXT NULL,
  type VARCHAR(40) NOT NULL DEFAULT 'system',
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_notifications_user (user_id, is_read),
  CONSTRAINT fk_notifications_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS learning_activities (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  course_id CHAR(36) NULL,
  type VARCHAR(40) NOT NULL DEFAULT 'study',
  title VARCHAR(190) NOT NULL,
  xp INT NOT NULL DEFAULT 0,
  metadata JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_learning_activities_user_date (user_id, created_at),
  CONSTRAINT fk_learning_activities_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_learning_activities_course
    FOREIGN KEY (course_id) REFERENCES courses(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS questions (
  id CHAR(36) PRIMARY KEY,
  student_id CHAR(36) NOT NULL,
  course_id CHAR(36) NULL,
  teacher_id CHAR(36) NULL,
  title VARCHAR(190) NOT NULL DEFAULT '',
  body TEXT NOT NULL,
  answer TEXT NULL,
  status ENUM('open', 'answered') NOT NULL DEFAULT 'open',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  answered_at TIMESTAMP NULL DEFAULT NULL,
  INDEX idx_questions_student (student_id, created_at),
  INDEX idx_questions_status (status),
  CONSTRAINT fk_questions_student
    FOREIGN KEY (student_id) REFERENCES users(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_questions_course
    FOREIGN KEY (course_id) REFERENCES courses(id)
    ON DELETE SET NULL,
  CONSTRAINT fk_questions_teacher
    FOREIGN KEY (teacher_id) REFERENCES users(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS badges (
  id CHAR(36) PRIMARY KEY,
  code VARCHAR(60) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  description VARCHAR(255) NOT NULL DEFAULT '',
  icon VARCHAR(16) NOT NULL DEFAULT '🏅',
  criteria_type ENUM('xp', 'completed_lessons', 'average_score', 'active_courses', 'exam_count') NOT NULL DEFAULT 'xp',
  criteria_value DECIMAL(10,2) NOT NULL DEFAULT 0,
  position INT NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_badges (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  badge_id CHAR(36) NOT NULL,
  unlocked_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_badges_user_badge (user_id, badge_id),
  CONSTRAINT fk_user_badges_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_user_badges_badge
    FOREIGN KEY (badge_id) REFERENCES badges(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS flashcard_sets (
  id CHAR(36) PRIMARY KEY,
  slug VARCHAR(120) NOT NULL UNIQUE,
  title VARCHAR(190) NOT NULL,
  topic VARCHAR(120) NOT NULL DEFAULT '',
  description VARCHAR(255) NOT NULL DEFAULT '',
  position INT NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS flashcards (
  id CHAR(36) PRIMARY KEY,
  set_id CHAR(36) NOT NULL,
  front VARCHAR(255) NOT NULL,
  back VARCHAR(255) NOT NULL,
  example TEXT NULL,
  position INT NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_flashcards_set_position (set_id, position),
  CONSTRAINT fk_flashcards_set
    FOREIGN KEY (set_id) REFERENCES flashcard_sets(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS teaching_material_requests (
  id CHAR(36) PRIMARY KEY,
  teacher_id CHAR(36) NOT NULL,
  course_id CHAR(36) NULL,
  title VARCHAR(190) NOT NULL,
  type ENUM('lesson', 'exam', 'document') NOT NULL DEFAULT 'lesson',
  status ENUM('pending', 'submitted', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
  description TEXT NULL,
  video_url VARCHAR(500) NOT NULL DEFAULT '',
  document_url VARCHAR(500) NOT NULL DEFAULT '',
  admin_note TEXT NULL,
  submitted_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_material_requests_teacher
    FOREIGN KEY (teacher_id) REFERENCES users(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_material_requests_course
    FOREIGN KEY (course_id) REFERENCES courses(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
