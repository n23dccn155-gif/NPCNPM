const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const planController = require('./src/controllers/planController');

async function test() {
    try {
        const req = { params: { planId: 783 } };
        const res = {
            status: (s) => ({ json: (d) => console.log(s, d) }),
            json: (d) => console.log(200, d)
        };
        const next = (err) => console.error("NEXT ERR:", err);
        await planController.getOne(req, res, next);
    } catch(e) { console.error(e); }
}
test();
