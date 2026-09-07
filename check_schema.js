const db = require('./db');
async function check() {
    try {
        const [schema] = await db.query('SHOW CREATE TABLE service_applications');
        console.log(schema[0]['Create Table']);
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
check();
