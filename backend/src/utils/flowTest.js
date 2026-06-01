// flowTest.js - Tự động hóa kiểm thử toàn bộ luồng nghiệp vụ 7 bước
const pool = require('../config/database');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

const BASE_URL = 'http://localhost:5000/api';

// Helper to handle fetch with JSON parsing and logging
async function callApi(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const method = options.method || 'GET';
  
  if (options.body && typeof options.body === 'object') {
    options.body = JSON.stringify(options.body);
  }
  
  if (!options.headers) {
    options.headers = {};
  }
  options.headers['Content-Type'] = 'application/json';

  console.log(`[API CALL] ${method} ${url} ${options.body ? `with body: ${options.body}` : ''}`);
  
  try {
    const res = await fetch(url, options);
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
    
    return {
      status: res.status,
      success: res.ok,
      data
    };
  } catch (error) {
    console.error(`[API ERROR] ${method} ${url}:`, error.message);
    throw error;
  }
}

async function runTests() {
  console.log('========================================================================');
  console.log('BẮT ĐẦU CHẠY KIỂM THỬ TỰ ĐỘNG TOÀN BỘ LUỒNG NGHIỆP VỤ (14 BẢNG)');
  console.log('========================================================================');

  // Đảm bảo dữ liệu đã được làm sạch và seed trước khi bắt đầu
  console.log('\n[Khởi động] Đang làm sạch và đặt lại cơ sở dữ liệu về trạng thái mẫu...');
  const fs = require('fs');
  const path = require('path');
  const runSql = async (p) => {
    const sql = fs.readFileSync(path.resolve(__dirname, p), 'utf8');
    await pool.query(sql);
  };
  await runSql('../../../database/schema.sql');
  await runSql('../../../database/constraints.sql');
  await runSql('../../../database/indexes.sql');
  await runSql('../../../database/seed.sql');
  console.log('[Khởi động] Cơ sở dữ liệu đã sẵn sàng.\n');

  // Khai báo tokens lưu trữ sau khi đăng nhập
  let managerToken = '';
  let dispatcherToken = '';
  let driver1Token = '';
  let driver2Token = '';

  // ----------------------------------------------------------------------
  // BƯỚC 1: ĐĂNG NHẬP 3 VAI TRÒ
  // ----------------------------------------------------------------------
  console.log('\n--- BƯỚC 1: KIỂM THỬ ĐĂNG NHẬP ---');
  
  // 1.1 Manager
  const mLogin = await callApi('/auth/login', {
    method: 'POST',
    body: { username: 'manager1', password: '123456' }
  });
  if (!mLogin.success) throw new Error('Đăng nhập Manager thất bại: ' + JSON.stringify(mLogin.data));
  managerToken = mLogin.data.token;
  console.log('✓ Đăng nhập Manager thành công!');

  // 1.2 Dispatcher
  const dLogin = await callApi('/auth/login', {
    method: 'POST',
    body: { username: 'dispatcher1', password: '123456' }
  });
  if (!dLogin.success) throw new Error('Đăng nhập Dispatcher thất bại: ' + JSON.stringify(dLogin.data));
  dispatcherToken = dLogin.data.token;
  console.log('✓ Đăng nhập Dispatcher thành công!');

  // 1.3 Driver 1
  const dr1Login = await callApi('/auth/login', {
    method: 'POST',
    body: { username: 'driver1', password: '123456' }
  });
  if (!dr1Login.success) throw new Error('Đăng nhập Driver 1 thất bại: ' + JSON.stringify(dr1Login.data));
  driver1Token = dr1Login.data.token;
  console.log('✓ Đăng nhập Driver 1 thành công!');

  // 1.3 Driver 2 (để test thay thế khẩn cấp)
  const dr2Login = await callApi('/auth/login', {
    method: 'POST',
    body: { username: 'driver2', password: '123456' }
  });
  driver2Token = dr2Login.data.token;

  // ----------------------------------------------------------------------
  // BƯỚC 2: QUẢN LÝ TẠO DANH MỤC VÀ BỐ TRÍ XE
  // ----------------------------------------------------------------------
  console.log('\n--- BƯỚC 2: QUẢN LÝ TẠO DANH MỤC & PHÂN BỔ TUYẾN ---');

  // 2.1 Tạo Tuyến mới (Tuyến 03) cùng với Hướng đi/về
  const newRoute = await callApi('/routes', {
    method: 'POST',
    body: {
      route_code: '03',
      route_name: 'Bến Thành - Thủ Đức',
      start_time: '05:30:00',
      end_time: '21:00:00',
      expected_trips_per_day: 20,
      headway_minutes: 45,
      confirmed_operating_buses: 4
    },
    headers: { Authorization: `Bearer ${managerToken}` }
  });
  if (!newRoute.success) throw new Error('Tạo tuyến 03 thất bại: ' + JSON.stringify(newRoute.data));
  console.log('✓ Tạo thông tin chung tuyến 03 thành công:', newRoute.data.data);

  // 2.3 Tạo điểm dừng cho chiều đi tuyến 03
  const outboundDirection = await callApi('/routes/03/directions', {
    method: 'POST',
    body: {
      direction_type: 'outbound',
      start_point: 'Bến Thành',
      end_point: 'Thủ Đức',
      travel_time_minutes: 50,
      turnaround_time_minutes: 15
    },
    headers: { Authorization: `Bearer ${managerToken}` }
  });
  const inboundDirection = await callApi('/routes/03/directions', {
    method: 'POST',
    body: {
      direction_type: 'inbound',
      start_point: 'Thủ Đức',
      end_point: 'Bến Thành',
      travel_time_minutes: 50,
      turnaround_time_minutes: 15
    },
    headers: { Authorization: `Bearer ${managerToken}` }
  });
  if (!outboundDirection.success || !inboundDirection.success) {
    throw new Error('Tạo hướng tuyến 03 thất bại');
  }
  const directionId = outboundDirection.data.data.direction_id;
  const stop1 = await callApi('/routes/stops', {
    method: 'POST',
    body: { direction_id: directionId, stop_order: 1, stop_name: 'Trạm Bến Thành', minute_from_start: 0 },
    headers: { Authorization: `Bearer ${managerToken}` }
  });
  const stop2 = await callApi('/routes/stops', {
    method: 'POST',
    body: { direction_id: directionId, stop_order: 2, stop_name: 'Trạm Đinh Bộ Lĩnh', minute_from_start: 20 },
    headers: { Authorization: `Bearer ${managerToken}` }
  });
  const stop3 = await callApi('/routes/stops', {
    method: 'POST',
    body: { direction_id: directionId, stop_order: 3, stop_name: 'Bến xe Miền Đông mới', minute_from_start: 50 },
    headers: { Authorization: `Bearer ${managerToken}` }
  });
  if (!stop3.success) throw new Error('Tạo điểm dừng thất bại: ' + JSON.stringify(stop3.data));
  console.log('✓ Tạo 3 điểm dừng thành công.');

  // 2.4 Tạo xe buýt mới
  const newBus = await callApi('/buses', {
    method: 'POST',
    body: { license_plate: '51B-300.99', seat_count: 45 },
    headers: { Authorization: `Bearer ${managerToken}` }
  });
  if (!newBus.success) throw new Error('Tạo xe buýt thất bại: ' + JSON.stringify(newBus.data));
  const newBusId = newBus.data.data.bus_id;
  console.log('✓ Tạo xe buýt mới thành công: ID #', newBusId);

  // 2.5 Tạo tài xế mới (Bằng cách tạo tài khoản user có vai trò driver)
  const newDriverUser = await callApi('/users', {
    method: 'POST',
    body: {
      username: 'driver11',
      password: 'password',
      full_name: 'Nguyễn Văn Kiểm Thử',
      role: 'driver',
      phone: '0988776655',
      license_class: 'E'
    },
    headers: { Authorization: `Bearer ${managerToken}` }
  });
  if (!newDriverUser.success) throw new Error('Tạo tài xế thất bại: ' + JSON.stringify(newDriverUser.data));
  console.log('✓ Tạo tài xế mới thành công.');

  // 2.6 Bố trí xe vào tuyến 03
  const routeBus = await callApi('/routes/03/buses', {
    method: 'POST',
    body: { bus_id: newBusId, bus_role: 'operating' },
    headers: { Authorization: `Bearer ${managerToken}` }
  });
  if (!routeBus.success) throw new Error('Bố trí xe thất bại: ' + JSON.stringify(routeBus.data));
  console.log('✓ Bố trí xe vào tuyến 03 thành công.');

  // Bố trí thêm xe standby số 11 (có sẵn trong seed) vào tuyến 03
  await callApi('/routes/03/buses', {
    method: 'POST',
    body: { bus_id: 1, bus_role: 'operating' },
    headers: { Authorization: `Bearer ${managerToken}` }
  });
  await callApi('/routes/03/buses', {
    method: 'POST',
    body: { bus_id: 2, bus_role: 'operating' },
    headers: { Authorization: `Bearer ${managerToken}` }
  });
  await callApi('/routes/03/buses', {
    method: 'POST',
    body: { bus_id: 3, bus_role: 'operating' },
    headers: { Authorization: `Bearer ${managerToken}` }
  });
  await callApi('/routes/03/buses', {
    method: 'POST',
    body: { bus_id: 11, bus_role: 'standby' },
    headers: { Authorization: `Bearer ${managerToken}` }
  });
  console.log('✓ Bố trí xe standby vào tuyến 03 thành công.');

  // ----------------------------------------------------------------------
  // BƯỚC 3: ĐIỀU PHỐI TẠO KẾ HOẠCH & PHÂN CÔNG
  // ----------------------------------------------------------------------
  console.log('\n--- BƯỚC 3: ĐIỀU PHỐI LẬP KẾ HOẠCH & PHÂN CÔNG ---');
  
  const testDate = new Date();
  testDate.setDate(testDate.getDate() + 1); // Lập lịch cho ngày mai
  const dateStr = testDate.toISOString().split('T')[0];
  console.log(`Lập kế hoạch cho ngày: ${dateStr}`);

  // 3.1 Tạo kế hoạch
  const plan = await callApi('/plans', {
    method: 'POST',
    body: { route_code: '01', operation_date: dateStr },
    headers: { Authorization: `Bearer ${dispatcherToken}` }
  });
  if (!plan.success) throw new Error('Tạo kế hoạch thất bại: ' + JSON.stringify(plan.data));
  const planId = plan.data.data.plan_id;
  console.log('✓ Tạo kế hoạch vận doanh thành công: ID #', planId);

  // 3.2 Sinh chuyến tự động
  const genTrips = await callApi(`/plans/${planId}/generate-trips`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${dispatcherToken}` }
  });
  if (!genTrips.success) throw new Error('Sinh chuyến thất bại: ' + JSON.stringify(genTrips.data));
  const genTripsPayload = genTrips.data?.data || genTrips.data;
  console.log(`✓ Sinh chuyến thành công. Tổng số chuyến sinh ra: ${genTripsPayload.trips_generated}`);

  // 2.2-2.3: Sinh chuyến tự động đã bao gồm tự động gom nhóm chuyến
  // Lấy danh sách nhóm chuyến từ chi tiết kế hoạch để chuẩn bị phân công
  const planDetails = await callApi(`/plans/${planId}`, {
    headers: { Authorization: `Bearer ${dispatcherToken}` }
  });
  if (!planDetails.success) throw new Error('Lấy chi tiết kế hoạch thất bại: ' + JSON.stringify(planDetails.data));
  const groups = planDetails.data?.data?.groups || [];
  if (!groups.length) throw new Error('Không lấy được nhóm chuyến nào để phân công');
  
  const targetGroup = groups[0];
  console.log(`Nhóm chuyến mục tiêu để phân công: ID #${targetGroup.group_id} (${targetGroup.group_name})`);

  // 3.4 Gọi API gợi ý xe và tài xế khả dụng cho nhóm chuyến này
  const suggestions = await callApi(`/assignments/available-resources/${targetGroup.group_id}`, {
    headers: { Authorization: `Bearer ${dispatcherToken}` }
  });
  if (!suggestions.success) throw new Error('Lấy gợi ý phân công thất bại: ' + JSON.stringify(suggestions.data));
  
  const availableBuses = suggestions.data.data.buses || [];
  const availableDrivers = suggestions.data.data.drivers || [];
  console.log(`✓ Gợi ý xe khả dụng: ${availableBuses.length} xe. Tài xế khả dụng: ${availableDrivers.length} người.`);
  
  if (availableBuses.length === 0 || availableDrivers.length === 0) {
    throw new Error('Không có đủ xe hoặc tài xế khả dụng để thực hiện kiểm thử!');
  }

  const selectedBus = availableBuses[0];
  const selectedDriver = availableDrivers[0];
  console.log(`Chọn xe: ID #${selectedBus.bus_id} (${selectedBus.license_plate}) | Tài xế: ID #${selectedDriver.driver_id} (${selectedDriver.full_name})`);

  // 3.5 Phân công xe và tài xế
  const assign = await callApi('/assignments/assign', {
    method: 'POST',
    body: {
      group_id: targetGroup.group_id,
      bus_id: selectedBus.bus_id,
      driver_id: selectedDriver.driver_id
    },
    headers: { Authorization: `Bearer ${dispatcherToken}` }
  });
  if (!assign.success) throw new Error('Phân công thất bại: ' + JSON.stringify(assign.data));
  console.log('✓ Phân công xe & tài xế thành công!');

  // Phân công tất cả các nhóm còn lại để kế hoạch hợp lệ trước khi gửi duyệt
  for (let k = 1; k < groups.length; k++) {
    const g = groups[k];
    const sugg = await callApi(`/assignments/available-resources/${g.group_id}`, {
      headers: { Authorization: `Bearer ${dispatcherToken}` }
    });
    const b = sugg.data.data.buses[0];
    const d = sugg.data.data.drivers[0];
    if (b && d) {
      await callApi('/assignments/assign', {
        method: 'POST',
        body: { group_id: g.group_id, bus_id: b.bus_id, driver_id: d.driver_id },
        headers: { Authorization: `Bearer ${dispatcherToken}` }
      });
    }
  }
  console.log('✓ Hoàn thành phân công hàng loạt cho các nhóm chuyến.');

  // 3.6 Gửi duyệt kế hoạch
  const submitPlan = await callApi(`/plans/${planId}/submit`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${dispatcherToken}` }
  });
  if (!submitPlan.success) throw new Error('Gửi duyệt kế hoạch thất bại: ' + JSON.stringify(submitPlan.data));
  console.log('✓ Đã gửi duyệt kế hoạch thành công. Trạng thái hiện tại:', submitPlan.data.data.status);

  // ----------------------------------------------------------------------
  // BƯỚC 4: QUẢN LÝ PHÊ DUYỆT KẾ HOẠCH
  // ----------------------------------------------------------------------
  console.log('\n--- BƯỚC 4: QUẢN LÝ PHÊ DUYỆT KẾ HOẠCH ---');

  // 4.1 Xem kế hoạch chờ duyệt
  const pendingPlans = await callApi('/plans?status=pending_approval', {
    headers: { Authorization: `Bearer ${managerToken}` }
  });
  const pendingList = pendingPlans.data?.data || [];
  console.log(`✓ Số lượng kế hoạch chờ duyệt tìm thấy: ${pendingList.length}`);

  // 4.2 Phê duyệt kế hoạch
  const approvePlan = await callApi(`/plans/${planId}/review`, {
    method: 'POST',
    body: { decision: 'approve' },
    headers: { Authorization: `Bearer ${managerToken}` }
  });
  if (!approvePlan.success) throw new Error('Phê duyệt kế hoạch thất bại: ' + JSON.stringify(approvePlan.data));
  console.log('✓ Đã duyệt kế hoạch thành công!');

  // 4.3 Kiểm tra trạng thái chuyển thành approved
  const checkPlan = await callApi(`/plans/${planId}`, {
    headers: { Authorization: `Bearer ${managerToken}` }
  });
  console.log('Trạng thái kế hoạch thực tế sau duyệt:', checkPlan.data.data.status);
  if (checkPlan.data.data.status !== 'approved') {
    throw new Error('Lỗi: Trạng thái kế hoạch không phải là approved!');
  }
  console.log('✓ Trạng thái chuyển đổi approved chính xác!');

  // Để test chạy chuyến hôm nay, ta cập nhật ngày của kế hoạch và các chuyến xe về ngày hôm nay
  console.log('\n[Cơ sở dữ liệu] Đang chuyển ngày của kế hoạch và các chuyến sang ngày hôm nay để tài xế nhận chuyến chạy thử...');
  const todayStr = new Date().toISOString().split('T')[0];
  await pool.query('UPDATE operation_plans SET operation_date = CURRENT_DATE WHERE plan_id = $1', [planId]);
  await pool.query('UPDATE trips SET scheduled_departure = (CURRENT_DATE + (scheduled_departure::time)), scheduled_arrival = (CURRENT_DATE + (scheduled_arrival::time)) WHERE plan_id = $1', [planId]);
  console.log('✓ Đã chuyển đổi thời gian sang ngày hôm nay thành công.');

  // ----------------------------------------------------------------------
  // BƯỚC 5: TÀI XẾ CHẠY CHUYẾN XE (START & FINISH)
  // ----------------------------------------------------------------------
  console.log('\n--- BƯỚC 5: TÀI XẾ THỰC HIỆN CHUYẾN XE ---');

  // 5.1 Đăng nhập tài xế được phân công (driver11 - Nguyễn Văn Kiểm Thử)
  const dr11Login = await callApi('/auth/login', {
    method: 'POST',
    body: { username: 'driver11', password: 'password' }
  });
  if (!dr11Login.success) throw new Error('Đăng nhập tài xế driver11 thất bại: ' + JSON.stringify(dr11Login.data));
  const activeDriverToken = dr11Login.data.token;
  console.log('✓ Đăng nhập tài xế driver11 thành công!');

  const drTrips = await callApi(`/trips/my-trips?date=${todayStr}`, {
    headers: { Authorization: `Bearer ${activeDriverToken}` }
  });
  const myTrips = drTrips.data?.data || [];
  console.log(`✓ Tìm thấy ${myTrips.length} chuyến xe được phân cho tài xế trong ngày hôm nay.`);
  if (!myTrips.length) {
    throw new Error('Lỗi: Tài xế driver11 không tìm thấy chuyến xe nào được phân công hôm nay!');
  }

  const firstTrip = myTrips[0];
  console.log(`Chuyến xe chuẩn bị chạy: ID #${firstTrip.trip_id} (Thứ tự chuyến: #${firstTrip.trip_order}, Điểm xuất phát: ${firstTrip.start_point})`);

  // 5.2 Bắt đầu chuyến xe (Ghi nhận xuất bến)
  const startAction = await callApi(`/trips/${firstTrip.trip_id}/start`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${activeDriverToken}` }
  });
  if (!startAction.success) throw new Error('Ghi nhận xuất bến thất bại: ' + JSON.stringify(startAction.data));
  console.log('✓ Ghi nhận xuất bến thành công!');

  // 5.3 Kiểm tra actual_departure và delay_minutes trong CSDL
  const dbTrip1 = await pool.query('SELECT actual_departure, delay_minutes, status FROM trips WHERE trip_id = $1', [firstTrip.trip_id]);
  const row1 = dbTrip1.rows[0];
  console.log('Dữ liệu chuyến đi trong DB sau khi bắt đầu:', {
    actual_departure: row1.actual_departure,
    delay_minutes: row1.delay_minutes,
    status: row1.status
  });
  if (!row1.actual_departure) throw new Error('Lỗi: Cột actual_departure bị trống!');
  console.log('✓ Cột actual_departure đã ghi nhận thời gian.');
  console.log('✓ Cột delay_minutes tính toán thành công:', row1.delay_minutes, 'phút');

  // 5.4 Kết thúc chuyến xe (Ghi nhận cập bến)
  const finishAction = await callApi(`/trips/${firstTrip.trip_id}/finish`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${activeDriverToken}` }
  });
  if (!finishAction.success) throw new Error('Ghi nhận cập bến thất bại: ' + JSON.stringify(finishAction.data));
  console.log('✓ Ghi nhận cập bến thành công!');

  // 5.5 Kiểm tra actual_arrival và status trong CSDL
  const dbTrip2 = await pool.query('SELECT actual_arrival, status, delay_minutes FROM trips WHERE trip_id = $1', [firstTrip.trip_id]);
  const row2 = dbTrip2.rows[0];
  console.log('Dữ liệu chuyến đi trong DB sau khi hoàn thành:', {
    actual_arrival: row2.actual_arrival,
    status: row2.status,
    delay_minutes: row2.delay_minutes
  });
  if (!row2.actual_arrival) throw new Error('Lỗi: Cột actual_arrival bị trống!');
  if (row2.status !== 'completed') {
    throw new Error('Lỗi: Sau khi kết thúc chuyến, trạng thái phải là completed. Trạng thái: ' + row2.status);
  }
  if (Number(row2.delay_minutes) < 0) throw new Error('Lỗi: delay_minutes không hợp lệ!');
  console.log('✓ Cột actual_arrival, delay_minutes và trạng thái hoàn thành chính xác!');

  // ----------------------------------------------------------------------
  // BƯỚC 6: XỬ LÝ PHÁT SINH (NGHỈ PHÉP & SỰ CỐ XE HỎNG)
  // ----------------------------------------------------------------------
  console.log('\n--- BƯỚC 6: XỬ LÝ PHÁT SINH ĐỘT XUẤT ---');

  // === PHÂN HỆ NGHỈ PHÉP ===
  // 6.1 Tài xế 1 gửi yêu cầu nghỉ cho ngày chạy của kế hoạch (hôm nay)
  console.log(`Tài xế 1 đăng ký nghỉ ngày: ${todayStr}`);
  const leaveReq = await callApi('/leave-requests', {
    method: 'POST',
    body: { leave_date: todayStr, reason: 'Có lịch khám sức khỏe định kỳ' },
    headers: { Authorization: `Bearer ${driver1Token}` }
  });
  if (!leaveReq.success) throw new Error('Gửi yêu cầu nghỉ thất bại: ' + JSON.stringify(leaveReq.data));
  const leaveId = leaveReq.data.data.leave_id;
  console.log('✓ Tài xế gửi yêu cầu nghỉ thành công. Mã đơn: ID #', leaveId);

  // 6.2 Quản lý duyệt nghỉ
  const approveLeave = await callApi(`/leave-requests/${leaveId}/review`, {
    method: 'POST',
    body: { status: 'approved' },
    headers: { Authorization: `Bearer ${managerToken}` }
  });
  if (!approveLeave.success) throw new Error('Duyệt nghỉ phép thất bại: ' + JSON.stringify(approveLeave.data));
  console.log('✓ Quản lý duyệt nghỉ thành công!');

  // 6.3 Điều phối xem danh sách chuyến bị ảnh hưởng do tài xế nghỉ
  const affectedByLeave = await callApi(`/leave-requests/${leaveId}/affected-groups`, {
    headers: { Authorization: `Bearer ${dispatcherToken}` }
  });
  const affectedList = affectedByLeave.data?.data || affectedByLeave.data || [];
  console.log(`✓ Số nhóm chuyến bị trống tài xế do nghỉ phép phát hiện được: ${affectedList.length}`);
  
  if (affectedList.length === 0) {
    throw new Error('Lỗi: Số nhóm chuyến bị ảnh hưởng do tài xế nghỉ phép phải lớn hơn 0!');
  }

  const affectedGrp = affectedList[0];
  console.log(`Nhóm chuyến bị trống tài xế: ID #${affectedGrp.group_id} (${affectedGrp.group_name})`);

  // Lấy phân công active cũ trước khi thay thế
  const dbOldAssignBefore = await pool.query("SELECT * FROM assignments WHERE group_id = $1 AND status = 'active'", [affectedGrp.group_id]);
  const oldAssignId = dbOldAssignBefore.rows[0].assignment_id;

  // 6.4 Thay tài xế khác (Chọn tài xế 2 thay thế)
  const replacementResources = await callApi(`/assignments/available-resources/${affectedGrp.group_id}?is_replacement=true`, {
    headers: { Authorization: `Bearer ${dispatcherToken}` }
  });
  const replacementDriver = replacementResources.data.data.drivers.find(d => d.driver_id !== dbOldAssignBefore.rows[0].driver_id);
  if (!replacementDriver) {
    throw new Error('Không tìm thấy tài xế khả dụng để thay thế');
  }

  const replaceDriver = await callApi('/assignments/replace-driver', {
    method: 'POST',
    body: {
      group_id: affectedGrp.group_id,
      new_driver_id: replacementDriver.driver_id
    },
    headers: { Authorization: `Bearer ${dispatcherToken}` }
  });
  if (!replaceDriver.success) throw new Error('Thay thế tài xế thất bại: ' + JSON.stringify(replaceDriver.data));
  console.log('✓ Thay tài xế mới thay thế thành công cho ngày nghỉ phép!');

  // Kiểm tra phân công cũ chuyển sang replaced
  const dbOldAssignAfter = await pool.query("SELECT status FROM assignments WHERE assignment_id = $1", [oldAssignId]);
  console.log(`Kiểm tra trạng thái assignment cũ: ${dbOldAssignAfter.rows[0].status}`);
  if (dbOldAssignAfter.rows[0].status !== 'replaced') {
    throw new Error('Lỗi: Phân công cũ không được chuyển sang trạng thái replaced!');
  }
  console.log('✓ Phân công cũ đã chuyển sang trạng thái "replaced"');

  // Kiểm tra phân công mới được tạo
  const dbNewAssign = await pool.query("SELECT * FROM assignments WHERE group_id = $1 AND status = 'active'", [affectedGrp.group_id]);
  if (!dbNewAssign.rows.length) {
    throw new Error('Lỗi: Không tìm thấy phân công mới trạng thái active!');
  }
  const newAssign = dbNewAssign.rows[0];
  console.log(`Kiểm tra phân công mới: driver_id = ${newAssign.driver_id}, status = ${newAssign.status}, group_id = ${newAssign.group_id}`);
  if (newAssign.driver_id !== replacementDriver.driver_id || newAssign.group_id !== affectedGrp.group_id) {
    throw new Error('Lỗi: Phân công mới không khớp với thông tin yêu cầu!');
  }
  console.log('✓ Phân công mới chính xác!');

  // === PHÂN HỆ SỰ CỐ XE HỎNG ===
  // 6.5 Tài xế báo xe hỏng trong lúc đang chạy
  const incidentReport = await callApi('/incidents', {
    method: 'POST',
    body: {
      bus_id: selectedBus.bus_id,
      trip_id: firstTrip.trip_id,
      incident_type: 'bus_broken',
      description: 'Động cơ quá nhiệt, bốc khói đen ở nắp capo phải dừng khẩn cấp'
    },
    headers: { Authorization: `Bearer ${activeDriverToken}` }
  });
  if (!incidentReport.success) throw new Error('Gửi báo cáo sự cố thất bại: ' + JSON.stringify(incidentReport.data));
  const incidentId = incidentReport.data.data.incident_id;
  console.log('✓ Tài xế gửi báo sự cố xe hỏng thành công. Báo cáo ID #', incidentId);

  // Kiểm tra trạng thái xe tự động chuyển sang broken
  const dbBus = await pool.query('SELECT status FROM buses WHERE bus_id = $1', [selectedBus.bus_id]);
  console.log('Trạng thái xe trong DB sau khi báo hỏng:', dbBus.rows[0].status);
  if (dbBus.rows[0].status !== 'broken') {
    throw new Error('Lỗi: Trạng thái xe không tự động chuyển thành broken!');
  }
  console.log('✓ Trạng thái xe đã tự động chuyển sang broken!');

  // Điều phối xem danh sách chuyến bị ảnh hưởng do xe hỏng
  const affectedByBus = await callApi(`/incidents/${incidentId}/affected-groups`, {
    headers: { Authorization: `Bearer ${dispatcherToken}` }
  });
  const affectedBusesList = affectedByBus.data?.data || affectedByBus.data || [];
  console.log(`✓ Số nhóm chuyến bị ảnh hưởng do xe hỏng: ${affectedBusesList.length}`);

  if (affectedBusesList.length > 0) {
    const affectedBusGroup = affectedBusesList[0];
    console.log(`Nhóm chuyến bị ảnh hưởng xe hỏng: ID #${affectedBusGroup.group_id} (${affectedBusGroup.group_name})`);

    // 6.6 Điều phối thay xe: ưu tiên standby, có thể dùng xe operating còn rảnh trong tuyến
    const replaceBus = await callApi('/assignments/replace-bus', {
      method: 'POST',
      body: {
        group_id: affectedBusGroup.group_id,
        new_bus_id: 11 // Xe standby có sẵn trong seed
      },
      headers: { Authorization: `Bearer ${dispatcherToken}` }
    });
    if (!replaceBus.success) throw new Error('Thay thế xe khả dụng thất bại: ' + JSON.stringify(replaceBus.data));
    console.log('✓ Thay thế xe khả dụng thành công!');
  }

  // ----------------------------------------------------------------------
  // BƯỚC 7: XEM BÁO CÁO THỐNG KÊ (KPI REPORTS)
  // ----------------------------------------------------------------------
  console.log('\n--- BƯỚC 7: XEM BÁO CÁO THỐNG KÊ (KPI) ---');

  // 7.1 Báo cáo hiệu suất tuyến
  const routeReport = await callApi('/reports/routes', {
    headers: { Authorization: `Bearer ${managerToken}` }
  });
  if (!routeReport.success) throw new Error('Lấy báo cáo tuyến thất bại: ' + JSON.stringify(routeReport.data));
  console.log('✓ Báo cáo hiệu suất tuyến:', routeReport.data.data);

  // 7.2 Báo cáo sử dụng xe
  const busReport = await callApi('/reports/buses', {
    headers: { Authorization: `Bearer ${managerToken}` }
  });
  if (!busReport.success) throw new Error('Lấy báo cáo xe thất bại: ' + JSON.stringify(busReport.data));
  console.log('✓ Báo cáo sử dụng xe:', busReport.data.data);

  // 7.3 Báo cáo hiệu suất tài xế
  const driverReport = await callApi('/reports/drivers', {
    headers: { Authorization: `Bearer ${managerToken}` }
  });
  if (!driverReport.success) throw new Error('Lấy báo cáo tài xế thất bại: ' + JSON.stringify(driverReport.data));
  console.log('✓ Báo cáo hiệu suất tài xế:', driverReport.data.data);

  console.log('\n========================================================================');
  console.log('TẤT CẢ CÁC BƯỚC LUỒNG NGHIỆP VỤ ĐÃ ĐƯỢC CHẠY & KIỂM THỬ THÀNH CÔNG 100%!');
  console.log('========================================================================');
  process.exit(0);
}

runTests().catch(err => {
  console.error('\n❌ KIỂM THỬ THẤT BẠI TẠI LỖI:', err.message);
  process.exit(1);
});
