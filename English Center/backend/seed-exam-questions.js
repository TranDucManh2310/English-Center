const crypto = require('crypto');
const mysql = require('mysql2/promise');
const { DB_CONFIG } = require('./db');

(async () => {
  const conn = await mysql.createConnection(DB_CONFIG);
  try {
    console.log('Seeding exam questions...');
    
    // Get first exam from database
    const [exams] = await conn.execute('SELECT id FROM exams LIMIT 1');
    if (!exams.length) {
      console.log('No exams found. Create an exam first.');
      process.exit(1);
    }
    
    const examId = exams[0].id;
    console.log(`Adding questions to exam: ${examId}`);
    
    // Sample questions
    const questions = [
      {
        content: 'What is the capital of France?',
        type: 'multiple_choice',
        options: ['Paris', 'London', 'Berlin', 'Madrid'],
        correctAnswer: 'Paris'
      },
      {
        content: 'Paris is the capital of France.',
        type: 'true_false',
        options: ['true', 'false'],
        correctAnswer: 'true'
      },
      {
        content: 'Describe the history of the English language.',
        type: 'essay',
        options: [],
        correctAnswer: null
      },
      {
        content: 'Which of these is a verb?',
        type: 'multiple_choice',
        options: ['happy', 'run', 'blue', 'cat'],
        correctAnswer: 'run'
      }
    ];
    
    let count = 0;
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const questionId = crypto.randomUUID();
      
      await conn.execute(
        `INSERT INTO exam_questions 
          (id, exam_id, question_no, content, type, options, correct_answer) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          questionId,
          examId,
          i + 1,
          q.content,
          q.type,
          JSON.stringify(q.options),
          q.correctAnswer
        ]
      );
      count++;
      console.log(`✓ Question ${i + 1} added`);
    }
    
    console.log(`\n✓ Added ${count} questions to exam`);
    process.exit(0);
  } catch(e) {
    console.error('Error:', e.message);
    process.exit(1);
  } finally {
    await conn.end();
  }
})();
