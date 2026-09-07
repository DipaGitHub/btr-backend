const db = require('./db');

async function migrate() {
  try {
    await db.query('SET FOREIGN_KEY_CHECKS=0');
    await db.query('DROP TABLE IF EXISTS chat_questions');
    await db.query('DROP TABLE IF EXISTS chat_topics');
    await db.query('SET FOREIGN_KEY_CHECKS=1');
    
    // Create chat_topics referencing existing admin_services table
    await db.query(`
      CREATE TABLE chat_topics (
        id INT AUTO_INCREMENT PRIMARY KEY,
        service_id INT NOT NULL,
        is_active BOOLEAN DEFAULT true,
        order_index INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_service (service_id)
      ) ENGINE=InnoDB
    `);
    console.log('chat_topics created');
    
    // Create chat_questions tied to a topic
    await db.query(`
      CREATE TABLE chat_questions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        topic_id INT NOT NULL,
        question_text TEXT NOT NULL,
        order_index INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (topic_id) REFERENCES chat_topics(id) ON DELETE CASCADE
      ) ENGINE=InnoDB
    `);
    console.log('chat_questions created');
    
    console.log('Migration complete!');
    process.exit(0);
  } catch(e) {
    console.error(e.message);
    process.exit(1);
  }
}

migrate();
