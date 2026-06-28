const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/controllers/assignmentController.js');
let content = fs.readFileSync(filePath, 'utf8');

const targetFunctionStart = content.indexOf('  autoAssignPlan: async (req, res, next) => {');
let targetFunctionEnd = content.indexOf('  autoReallocateBuses:');
let hasReallocate = true;

if (targetFunctionEnd === -1) {
    targetFunctionEnd = content.lastIndexOf('module.exports = assignmentController;');
    hasReallocate = false;
}

if (targetFunctionStart === -1 || targetFunctionEnd === -1) {
    console.error('Could not find autoAssignPlan');
    process.exit(1);
}

const newFunction = `  autoAssignPlan: async (req, res, next) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { planId } = req.params;
      const dispatcherId = req.user.id;

      // 1. Lấy thông tin kế hoạch vận doanh
      const planRes = await client.query('SELECT * FROM operation_plans WHERE plan_id = $1', [planId]);
      if (!planRes.rows.length) {
        await client.query('ROLLBACK');
        return error(res, 'Không tìm thấy kế hoạch', 404);
      }
      const plan = planRes.rows[0];

      // 2. Xóa các phân công cũ và reset trạng thái nhóm chuyến để thực hiện phân công mới (Đảm bảo tính Idempotent)
      await client.query('DELETE FROM assignments WHERE plan_id = $1', [planId]);
      await client.query("DELETE FROM trip_groups WHERE plan_id = $1 AND status = 'standby'", [planId]);
      await client.query("UPDATE trip_groups SET status = 'unassigned' WHERE plan_id = $1", [planId]);

      // 3. Lấy toàn bộ nhóm chuyến vận doanh (operating) chưa được phân công
      const groupsRes = await client.query(
        "SELECT * FROM trip_groups WHERE plan_id = $1 AND status = 'unassigned' ORDER BY start_time, group_id",
        [planId]
      );
      if (!groupsRes.rows.length) {
        await client.query('ROLLBACK');
        return error(res, 'Không có nhóm chuyến nào cần phân công (hoặc đã phân công hết)', 400);
      }
      const groups = groupsRes.rows;

      // 4. Lấy cấu hình tuyến đường
      const routeRes = await client.query('SELECT * FROM routes WHERE route_code = $1', [plan.route_code]);
      const route = routeRes.rows[0];

      // 5. Lấy danh sách tài xế làm việc thuộc tuyến
      const routeDriversRes = await client.query(
        \`SELECT rd.driver_id, d.full_name
         FROM route_drivers rd
         JOIN drivers d ON rd.driver_id = d.driver_id
         WHERE rd.route_code = $1 AND rd.status = 'active' AND d.status = 'working'
         ORDER BY rd.driver_id\`,
        [plan.route_code]
      );
      const allDrivers = routeDriversRes.rows;
      if (allDrivers.length === 0) {
         await client.query('ROLLBACK');
         return error(res, 'Tuyến chưa có tài xế nào hoạt động, không thể phân công', 400);
      }

      // 6. Tạo danh sách 7 ngày trong tuần dựa trên ngày bắt đầu kế hoạch
      const daysList = [];
      const baseDate = new Date(plan.operation_date);
      for (let d = 0; d < 7; d++) {
        const cur = new Date(baseDate);
        cur.setDate(baseDate.getDate() + d);
        const dateStr = cur.toISOString().split('T')[0];
        daysList.push(dateStr);
      }

      // Nhóm các ca chạy theo từng ngày
      const groupsByDay = {};
      for (const g of groups) {
        const dateStr = new Date(g.start_time).toISOString().split('T')[0];
        if (!groupsByDay[dateStr]) groupsByDay[dateStr] = [];
        groupsByDay[dateStr].push(g);
      }

      // 7. Kiểm tra tổng số lượng tài xế tối thiểu cần thiết để xoay vòng ca (đảm bảo nghỉ ít nhất 1 ngày/tuần)
      let maxDailyShifts = 0;
      daysList.forEach(dateStr => {
        const shiftsToday = groupsByDay[dateStr] || [];
        if (shiftsToday.length > maxDailyShifts) {
          maxDailyShifts = shiftsToday.length;
        }
      });

      const minWeeklyDrivers = Math.max(maxDailyShifts, Math.ceil(groups.length / 6));
      if (allDrivers.length < minWeeklyDrivers) {
         await client.query('ROLLBACK');
         return error(res, \`Tuyến không đủ tài xế để xoay vòng ca (đảm bảo nghỉ ít nhất 1 ngày/tuần). Yêu cầu tối thiểu \${minWeeklyDrivers} tài xế, nhưng tuyến chỉ có \${allDrivers.length}.\`, 400);
      }

      // 8. Lấy danh sách xe hoạt động của tuyến và ánh xạ vào các slot xe (ví dụ: "Xe 1")
      const busesRes = await client.query(
        \`SELECT rb.bus_id, b.license_plate, rb.bus_role
         FROM route_buses rb
         JOIN buses b ON rb.bus_id = b.bus_id
         WHERE rb.route_code = $1 AND b.status = 'active'
         ORDER BY rb.bus_role DESC, b.license_plate\`,
        [plan.route_code]
      );
      const operatingBuses = busesRes.rows.filter(b => b.bus_role === 'operating');
      const standbyBuses = busesRes.rows.filter(b => b.bus_role === 'standby');

      const busMapping = {};
      const slotNames = new Set();
      groups.forEach(g => {
        const baseName = g.group_name.split(' - ')[0];
        slotNames.add(baseName);
      });
      const sortedSlotNames = Array.from(slotNames).sort();

      if (operatingBuses.length < sortedSlotNames.length) {
         await client.query('ROLLBACK');
         return error(res, \`Tuyến thiếu xe vận doanh. Yêu cầu tối thiểu \${sortedSlotNames.length} xe, hiện chỉ có \${operatingBuses.length} xe hoạt động.\`, 400);
      }

      for (let i = 0; i < sortedSlotNames.length; i++) {
        busMapping[sortedSlotNames[i]] = operatingBuses[i].bus_id;
      }

      // 9. Thực hiện xoay vòng ca chạy và gán dự phòng hàng ngày
      for (let day = 0; day < 7; day++) {
        const dateStr = daysList[day];
        const shiftsToday = groupsByDay[dateStr] || [];
        // Sắp xếp ca chạy theo giờ xuất bến sớm trước muộn sau
        shiftsToday.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

        // Lấy danh sách tài xế đã được duyệt nghỉ phép vào ngày này
        const leaveRes = await client.query(
          "SELECT driver_id FROM leave_requests WHERE leave_date = $1 AND status = 'approved'",
          [dateStr]
        );
        const onLeaveIds = leaveRes.rows.map(r => r.driver_id);
        const driversAvailableToday = allDrivers.filter(d => !onLeaveIds.includes(d.driver_id));

        if (driversAvailableToday.length < shiftsToday.length) {
           await client.query('ROLLBACK');
           return error(res, \`Ngày \${dateStr} không đủ tài xế đi làm để vận hành. Ca chạy yêu cầu: \${shiftsToday.length}, tài xế đi làm: \${driversAvailableToday.length}\`, 400);
        }

        const M = driversAvailableToday.length;
        const S = shiftsToday.length;
        // Mỗi ngày, bắt đầu lấy tài xế từ vị trí dịch chuyển tiếp theo (xoay vòng)
        const startIndex = day % M;

        const workingDrivers = [];
        const standbyDrivers = [];

        for (let i = 0; i < S; i++) {
          const idx = (startIndex + i) % M;
          workingDrivers.push(driversAvailableToday[idx]);
        }

        const workingDriverIds = workingDrivers.map(d => d.driver_id);
        for (const d of driversAvailableToday) {
          if (!workingDriverIds.includes(d.driver_id)) {
            standbyDrivers.push(d);
          }
        }

        // 9a. Gán tài xế chính thức và xe vận doanh cho các ca chạy chính
        for (let i = 0; i < S; i++) {
          const shift = shiftsToday[i];
          const baseName = shift.group_name.split(' - ')[0];
          const busId = busMapping[baseName];
          const driverId = workingDrivers[i].driver_id;

          await client.query(
            \`INSERT INTO assignments (plan_id, group_id, bus_id, driver_id, assignment_type, assigned_by, status)
             VALUES ($1, $2, $3, $4, 'main', $5, 'active')\`,
            [plan.plan_id, shift.group_id, busId, driverId, dispatcherId]
          );

          await client.query(
            \`UPDATE trip_groups SET status = 'assigned' WHERE group_id = $1\`,
            [shift.group_id]
          );
        }

        // 9b. Gán tài xế dự phòng và xe dự phòng (nếu có)
        if (standbyDrivers.length > 0) {
          const formatTimeStr = (tStr) => {
            if (!tStr) return '05:00:00';
            const parts = tStr.split(':');
            const hh = String(parts[0]).padStart(2, '0');
            const mm = String(parts[1] || '00').padStart(2, '0');
            const ss = String(parts[2] || '00').padStart(2, '0');
            return \`\${hh}:\${mm}:\${ss}\`;
          };

          const sbStart = \`\${dateStr}T\${formatTimeStr(route.start_time)}\`;
          const sbEnd = \`\${dateStr}T\${formatTimeStr(route.end_time)}\`;

          // Tạo nhóm chuyến dự phòng để hiển thị lên UI
          const sbRes = await client.query(
            \`INSERT INTO trip_groups (plan_id, group_name, start_time, end_time, status)
             VALUES ($1, 'Dự phòng (Nghỉ)', $2, $3, 'standby') RETURNING group_id\`,
            [plan.plan_id, sbStart, sbEnd]
          );
          const sbGroupId = sbRes.rows[0].group_id;

          for (let j = 0; j < standbyDrivers.length; j++) {
            const driverId = standbyDrivers[j].driver_id;
            const type = j < standbyDrivers.length / 2 ? 'standby_morning' : 'standby_afternoon';
            const standbyBusId = standbyBuses[j % standbyBuses.length]?.bus_id || null;

            await client.query(
              \`INSERT INTO assignments (plan_id, group_id, bus_id, driver_id, assignment_type, assigned_by, status)
               VALUES ($1, $2, $3, $4, $5, $6, 'active')\`,
              [plan.plan_id, sbGroupId, standbyBusId, driverId, type, dispatcherId]
            );
          }
        }
      }

      await client.query('COMMIT');
      return success(res, null, 'Phân công tự động thành công (Thuật toán xoay vòng và dự bị công bằng)!');
    } catch (err) {
      await client.query('ROLLBACK');
      next(err);
    } finally {
      client.release();
    }
  }`;

let finalContent;
if (hasReallocate) {
    finalContent = content.substring(0, targetFunctionStart) + newFunction + ",\n\n" + content.substring(targetFunctionEnd);
} else {
    finalContent = content.substring(0, targetFunctionStart) + newFunction + "\nmodule.exports = assignmentController;";
}

fs.writeFileSync(filePath, finalContent);
console.log('Successfully rewrote autoAssignPlan logic.');
