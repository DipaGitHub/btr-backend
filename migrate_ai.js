const db = require('./db');

async function migrateAI() {
    try {
        console.log('Starting AI Database Migration...');

        // 1. Create ai_conversations table
        await db.query(`
            CREATE TABLE IF NOT EXISTS ai_conversations (
                id INT AUTO_INCREMENT PRIMARY KEY,
                session_id VARCHAR(100) NOT NULL UNIQUE,
                status ENUM('active', 'completed', 'handoff_requested', 'archived') DEFAULT 'active',
                user_name VARCHAR(255) DEFAULT NULL,
                user_email VARCHAR(255) DEFAULT NULL,
                user_phone VARCHAR(50) DEFAULT NULL,
                company_name VARCHAR(255) DEFAULT NULL,
                business_type VARCHAR(255) DEFAULT NULL,
                project_type VARCHAR(255) DEFAULT NULL,
                project_description TEXT DEFAULT NULL,
                budget_range VARCHAR(100) DEFAULT NULL,
                timeline VARCHAR(100) DEFAULT NULL,
                preferred_contact_method VARCHAR(50) DEFAULT NULL,
                detected_service VARCHAR(255) DEFAULT NULL,
                intent VARCHAR(100) DEFAULT NULL,
                lead_score INT DEFAULT 0,
                lead_status ENUM('cold', 'warm', 'hot') DEFAULT 'cold',
                ai_summary TEXT DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_session_id (session_id),
                INDEX idx_lead_status (lead_status),
                INDEX idx_created_at (created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);
        console.log('✓ ai_conversations table verified/created');

        // 2. Create ai_messages table
        await db.query(`
            CREATE TABLE IF NOT EXISTS ai_messages (
                id INT AUTO_INCREMENT PRIMARY KEY,
                conversation_id INT NOT NULL,
                role ENUM('user', 'assistant', 'model', 'system', 'tool') NOT NULL,
                content TEXT DEFAULT NULL,
                tool_name VARCHAR(100) DEFAULT NULL,
                tool_call_id VARCHAR(100) DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (conversation_id) REFERENCES ai_conversations(id) ON DELETE CASCADE,
                INDEX idx_conversation_id (conversation_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);
        console.log('✓ ai_messages table verified/created');

        // 3. Create ai_settings table
        await db.query(`
            CREATE TABLE IF NOT EXISTS ai_settings (
                id INT AUTO_INCREMENT PRIMARY KEY,
                is_active BOOLEAN DEFAULT TRUE,
                bot_name VARCHAR(100) DEFAULT 'BTR AI Assistant',
                welcome_message TEXT DEFAULT NULL,
                enable_lead_capture BOOLEAN DEFAULT TRUE,
                enable_pricing_answers BOOLEAN DEFAULT TRUE,
                enable_portfolio_answers BOOLEAN DEFAULT TRUE,
                enable_faq_answers BOOLEAN DEFAULT TRUE,
                enable_human_handoff BOOLEAN DEFAULT TRUE,
                system_prompt_override TEXT DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);
        console.log('✓ ai_settings table verified/created');

        // Initialize default settings if table is empty
        const [existingSettings] = await db.query('SELECT id FROM ai_settings LIMIT 1');
        if (existingSettings.length === 0) {
            await db.query(`
                INSERT INTO ai_settings (
                    is_active, bot_name, welcome_message,
                    enable_lead_capture, enable_pricing_answers, enable_portfolio_answers,
                    enable_faq_answers, enable_human_handoff
                ) VALUES (
                    TRUE, 'BTR AI Assistant', 
                    '👋 Hello! I am BTR Communication\\'s AI Assistant. How can I assist you with your project today?',
                    TRUE, TRUE, TRUE, TRUE, TRUE
                )
            `);
            console.log('✓ Initialized default ai_settings');
        }

        // 4. Safely extend admin_leads table columns if they do not already exist
        const columnsToAdd = [
            { name: 'conversation_id', type: 'INT NULL' },
            { name: 'company_name', type: 'VARCHAR(255) NULL' },
            { name: 'business_type', type: 'VARCHAR(255) NULL' },
            { name: 'project_type', type: 'VARCHAR(255) NULL' },
            { name: 'project_description', type: 'TEXT NULL' },
            { name: 'budget_range', type: 'VARCHAR(100) NULL' },
            { name: 'timeline', type: 'VARCHAR(100) NULL' },
            { name: 'location', type: 'VARCHAR(255) NULL' },
            { name: 'lead_score', type: 'INT DEFAULT 0' },
            { name: 'lead_status', type: 'VARCHAR(50) DEFAULT "cold"' },
            { name: 'preferred_contact_method', type: 'VARCHAR(50) NULL' },
            { name: 'ai_summary', type: 'TEXT NULL' },
            { name: 'ai_recommendation', type: 'TEXT NULL' }
        ];

        const [existingColumns] = await db.query(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'admin_leads'
        `);
        const existingColNames = existingColumns.map(c => c.COLUMN_NAME.toLowerCase());

        for (const col of columnsToAdd) {
            if (!existingColNames.includes(col.name.toLowerCase())) {
                await db.query(`ALTER TABLE admin_leads ADD COLUMN ${col.name} ${col.type}`);
                console.log(`✓ Added column ${col.name} to admin_leads`);
            }
        }

        console.log('🎉 AI Migration completed successfully!');
        process.exit(0);
    } catch (err) {
        console.error('❌ Migration failed:', err);
        process.exit(1);
    }
}

migrateAI();
