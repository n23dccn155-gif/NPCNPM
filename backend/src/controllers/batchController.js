const pool = require('../config/database');
const { success, error } = require('../utils/responseHelper');
const { planController } = require('./planController');

// Helper to add days to a date string YYYY-MM-DD
function addDays(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

const batchController = {
  generateSchedule: async (req, res, next) => {
    // This could take a while, we might not want to do it all inside a single HTTP request transaction
    // But for simplicity, we do it in a loop here.
    const { routeCode } = req.params;
    const { startDate, cycles } = req.body;
    const userId = req.user.id;

    if (!routeCode) return error(res, 'Missing route code', 400);
    if (!startDate) return error(res, 'Missing startDate', 400);
    if (!cycles || cycles < 1) return error(res, 'Invalid cycles', 400);

    const client = await pool.connect();
    try {
      const routeRes = await client.query('SELECT * FROM routes WHERE route_code = $1', [routeCode]);
      if (!routeRes.rows.length) {
        client.release();
        return error(res, 'Tuyến không tồn tại', 404);
      }
      
      const route = routeRes.rows[0];
      if (route.status !== 'active') {
        client.release();
        return error(res, 'Tuyến không hoạt động', 400);
      }

      // Check working drivers assigned to this route to calculate cycle length
      const driversRes = await client.query(`
        SELECT COUNT(*) FROM route_drivers rd 
        JOIN drivers d ON rd.driver_id = d.driver_id 
        WHERE rd.route_code = $1 AND rd.status = 'active' AND d.status = 'working'
      `, [routeCode]);
      
      const driverCount = parseInt(driversRes.rows[0].count);

      if (driverCount === 0) {
        client.release();
        return error(res, 'Tuyến chưa có tài xế nào đang làm việc trong danh sách, không thể sinh lịch', 400);
      }

      client.release();

      let currentDate = startDate;
      const NUM_DAYS = cycles * driverCount;
      
      let successCount = 0;
      let errorCount = 0;

      // Check for overlap before starting
      const endDate = addDays(startDate, NUM_DAYS - 1);
      const overlapRes = await pool.query(
        'SELECT operation_date FROM operation_plans WHERE route_code = $1 AND operation_date >= $2 AND operation_date <= $3 LIMIT 1',
        [routeCode, startDate, endDate]
      );
      if (overlapRes.rows.length > 0) {
        const overlapDate = formatDate(overlapRes.rows[0].operation_date);
        return error(res, `Đã có lịch tồn tại trong khoảng thời gian từ ${formatDate(startDate)} đến ${formatDate(endDate)} (ngày trùng: ${overlapDate}). Không thể ghi đè.`, 400);
      }

      // Import the internal functions from planController and assignmentController
      // Since they are written to respond to Express req/res, we can mock req/res OR write direct DB logic.
      // Writing direct DB logic is better. Or we can just import them and mock req, res.
      const planCtrl = require('./planController');
      const assignmentCtrl = require('./assignmentController');

      for (let i = 0; i < NUM_DAYS; i++) {
        const operationDate = currentDate;
        currentDate = addDays(currentDate, 1);

        try {
          // 1. Check if plan exists
          const existPlan = await pool.query('SELECT plan_id FROM operation_plans WHERE route_code = $1 AND operation_date = $2', [routeCode, operationDate]);
          let planId;
          
          if (existPlan.rows.length > 0) {
            planId = existPlan.rows[0].plan_id;
            // If exists, delete all existing trips and assignments to regenerate
            await pool.query('DELETE FROM trips WHERE plan_id = $1', [planId]);
            await pool.query('DELETE FROM assignments WHERE plan_id = $1', [planId]);
            await pool.query('UPDATE operation_plans SET status = $1 WHERE plan_id = $2', ['draft', planId]);
          } else {
            // Create plan
            const newPlan = await pool.query(
              `INSERT INTO operation_plans (route_code, operation_date, created_by, status) VALUES ($1, $2, $3, 'draft') RETURNING plan_id`,
              [routeCode, operationDate, userId]
            );
            planId = newPlan.rows[0].plan_id;
          }

          // 2. Generate Trips (Mock Req/Res)
          await new Promise((resolve, reject) => {
            const mockReq = { params: { planId }, body: {} };
            const mockRes = {
              status: () => mockRes,
              json: (data) => {
                if (data.success) resolve();
                else reject(new Error(data.message));
              }
            };
            planCtrl.generateTrips(mockReq, mockRes, reject);
          });

          // 3. Auto Assign
          await new Promise((resolve, reject) => {
            const mockReq = { params: { planId }, body: {}, user: { id: userId } };
            const mockRes = {
              status: () => mockRes,
              json: (data) => {
                if (data.success) resolve();
                else {
                   console.log('AUTO ASSIGN ERROR:', data);
                   reject(new Error(data.message));
                }
              }
            };
            assignmentCtrl.autoAssignPlan(mockReq, mockRes, reject);
          });

          // 4. Keep plan as draft (allow dispatcher to preview)
          await pool.query('UPDATE operation_plans SET status = $1 WHERE plan_id = $2', ['draft', planId]);
          
          successCount++;
        } catch (e) {
          console.error(`Error generating schedule for ${operationDate}:`, e);
          errorCount++;
        }
      }

      return success(res, { successCount, errorCount }, `Đã sinh lịch thành công cho ${successCount} ngày, lỗi ${errorCount} ngày.`);
    } catch (err) {
      if (client) client.release();
      next(err);
    }
  }
};

module.exports = batchController;
