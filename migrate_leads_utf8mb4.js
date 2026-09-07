const db = require('./db');

async function migrate() {
    try {
        // Convert the table default charset & collation
        await db.query(`
            ALTER TABLE admin_leads
            CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
        `);
        console.log('✅ Converted admin_leads charset to utf8mb4');

        // Add chat_transcript column if it doesn't exist yet
        const [cols] = await db.query(`
            SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'admin_leads'
              AND COLUMN_NAME = 'chat_transcript'
        `);

        if (cols.length === 0) {
            await db.query(`
                ALTER TABLE admin_leads
                ADD COLUMN chat_transcript LONGTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL
            `);
            console.log('✅ Added chat_transcript column');
        } else {
            // Ensure the existing column uses utf8mb4
            await db.query(`
                ALTER TABLE admin_leads
                MODIFY COLUMN chat_transcript LONGTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL
            `);
            console.log('✅ Updated chat_transcript column charset to utf8mb4');
        }

        console.log('Migration complete.');
        process.exit(0);
    } catch (e) {
        console.error('Migration failed:', e);
        process.exit(1);
    }
}

migrate();
