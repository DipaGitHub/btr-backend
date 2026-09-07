const db = require('./db');

async function migrate() {
    try {
        await db.query(`
            CREATE TABLE IF NOT EXISTS admin_service_pricing (
                service_id INT NOT NULL,
                pricing_id INT NOT NULL,
                PRIMARY KEY (service_id, pricing_id)
            ) ENGINE=MyISAM DEFAULT CHARSET=latin1;
        `);
        console.log("Migration successful");
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
migrate();
