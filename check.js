const db = require('./db');

async function check() {
    try {
        const [servicesSchema] = await db.query('SHOW CREATE TABLE admin_services');
        console.log(servicesSchema[0]['Create Table']);
        const [pricingSchema] = await db.query('SHOW CREATE TABLE admin_pricing');
        console.log(pricingSchema[0]['Create Table']);
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
check();
