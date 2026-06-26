const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const pool = require('./src/config/database');

async function fix() {
    try {
        await pool.query(`ALTER TABLE buses DROP CONSTRAINT IF EXISTS chk_buses_status`);
        await pool.query(`ALTER TABLE buses ADD CONSTRAINT chk_buses_status CHECK (status IN ('active', 'inactive', 'maintenance', 'broken'))`);
        console.log("Constraint fixed.");
    } catch(e) {
        console.error(e);
    } finally {
        pool.end();
    }
}
fix();
