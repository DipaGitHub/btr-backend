const db = require('./db');
async function migrate() {
    try {
        await db.query(`
            CREATE TABLE IF NOT EXISTS admin_leads (
                id INT NOT NULL AUTO_INCREMENT,
                name VARCHAR(255) NOT NULL,
                email VARCHAR(255) NOT NULL,
                phone VARCHAR(50) NOT NULL,
                service VARCHAR(255) NOT NULL,
                pricing_plan VARCHAR(255) DEFAULT NULL,
                source VARCHAR(100) DEFAULT 'website',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (id)
            ) ENGINE=MyISAM DEFAULT CHARSET=latin1;
        `);
        console.log("Leads table created");
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
migrate();
