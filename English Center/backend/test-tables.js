const mysql = require('mysql2/promise');
const { DB_CONFIG } = require('./db');

(async () => {
  const conn = await mysql.createConnection(DB_CONFIG);
  try {
    console.log('Creating exam tables...');
    
    // Create exam_questions
    await conn.execute(`
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
        CONSTRAINT fk_exam_questions_exam FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✓ exam_questions table ready');
    
    // Create exam_answer_choices
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS exam_answer_choices (
        id CHAR(36) PRIMARY KEY,
        question_id CHAR(36) NOT NULL,
        choice_no INT NOT NULL DEFAULT 1,
        content TEXT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_answer_choices_question_choice (question_id, choice_no),
        CONSTRAINT fk_answer_choices_question FOREIGN KEY (question_id) REFERENCES exam_questions(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✓ exam_answer_choices table ready');
    
    process.exit(0);
  } catch(e) {
    console.error('Error:', e.message);
    process.exit(1);
  } finally {
    await conn.end();
  }
})();
