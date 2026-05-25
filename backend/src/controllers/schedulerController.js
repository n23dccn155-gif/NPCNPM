const { Pool } = require('pg');
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

function timeToMinutes(timeStr) {
    if (!timeStr) return 0;
    const parts = timeStr.split(':');
    return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
}

function calculateDriverSchedule(driver, targetDateStr, buses, config, driversCountForRoute = 0) {
    const anchorDate = new Date('2026-05-25T00:00:00Z');
    const targetDate = new Date(targetDateStr + 'T00:00:00Z');
    const diffTime = targetDate - anchorDate;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    const morningStart = timeToMinutes(config.morning_shift_start);
    const morningEnd = timeToMinutes(config.morning_shift_end);
    const afternoonStart = timeToMinutes(config.afternoon_shift_start);
    const afternoonEnd = timeToMinutes(config.afternoon_shift_end);
    
    const duration = parseInt(config.trip_duration_minutes, 10) || 75;
    const breakMin = parseInt(config.min_break_minutes, 10) || 10;
    const freqMin = parseInt(config.trip_frequency_minutes, 10) || 15;
    
    const cycleTime = 2 * (duration + breakMin);
    const driversPerShift = Math.ceil(cycleTime / freqMin);
    
    const morningNeeded = driversPerShift;
    const afternoonNeeded = driversPerShift;
    
    // We add Standby drivers based on percentage
    const morningStandby = Math.round(morningNeeded * (config.standby_percentage / 100));
    const afternoonStandby = Math.round(afternoonNeeded * (config.standby_percentage / 100));
    
    const totalSlots = morningNeeded + morningStandby + afternoonNeeded + afternoonStandby;
    
    let currentSlot;
    if (driver.base_slot >= totalSlots) {
        // Permanent extra, do not rotate
        currentSlot = driver.base_slot;
    } else {
        // Rotate only within active slots
        currentSlot = (driver.base_slot + diffDays) % totalSlots;
        if (currentSlot < 0) currentSlot = (currentSlot + totalSlots) % totalSlots;
    }
    
    let shift, departureTime, isStandby, shiftBadge;
    let bus_id = 'STANDBY';
    let baseMin = 0;
    
    if (currentSlot < morningNeeded) {
        shift = 'Ca Sáng';
        shiftBadge = 'primary';
        baseMin = morningStart + currentSlot * config.trip_frequency_minutes;
        isStandby = false;
        if (buses && buses.length > 0) bus_id = buses[currentSlot % buses.length].bus_id;
    } else if (currentSlot < morningNeeded + morningStandby) {
        shift = 'Dự Bị Sáng';
        shiftBadge = 'danger';
        baseMin = morningStart;
        isStandby = true;
    } else if (currentSlot < morningNeeded + morningStandby + afternoonNeeded) {
        shift = 'Ca Chiều';
        shiftBadge = 'warning';
        const offset = currentSlot - (morningNeeded + morningStandby);
        baseMin = afternoonStart + offset * config.trip_frequency_minutes;
        isStandby = false;
        if (buses && buses.length > 0) bus_id = buses[offset % buses.length].bus_id;
    } else if (currentSlot < totalSlots) {
        shift = 'Dự Bị Chiều';
        shiftBadge = 'info';
        baseMin = afternoonStart;
        isStandby = true;
    } else {
        shift = 'Nhân sự thừa';
        shiftBadge = 'secondary';
        baseMin = 0;
        isStandby = true;
        bus_id = 'Không có xe';
        departureTime = '--:--';
    }
    
    if (shift !== 'Nhân sự thừa') {
        departureTime = `${String(Math.floor(baseMin/60)).padStart(2,'0')}:${String(baseMin%60).padStart(2,'0')}`;
    }
    
    const trips = [];
    if (!isStandby && departureTime) {
        let currentMin = baseMin;
        
        let shiftEndMin;
        if (shift === 'Ca Sáng') {
            shiftEndMin = morningEnd; // Strict cutoff at 14:00
        } else {
            shiftEndMin = afternoonEnd; // Strict cutoff at 22:30
        }

        let tripCount = 0;
        // Generate in PAIRS (1 vòng: chiều đi + chiều về) to ensure the bus returns to the start terminal
        while (currentMin < shiftEndMin && tripCount < 10) {
            // 1. Chiều đi (Outbound)
            let tripCode = `TR${driver.route_code}-${targetDateStr.replace(/-/g,'').substring(4)}-${driver.driver_code.substring(3)}-${tripCount+1}`;
            let hStart = Math.floor(currentMin / 60) % 24;
            let mStart = currentMin % 60;
            let depTime = `${String(hStart).padStart(2, '0')}:${String(mStart).padStart(2, '0')}`;
            
            let endMin = currentMin + config.trip_duration_minutes;
            let hEnd = Math.floor(endMin / 60) % 24;
            let mEnd = endMin % 60;
            let arrTime = `${String(hEnd).padStart(2, '0')}:${String(mEnd).padStart(2, '0')}`;
            
            trips.push({
                tripCode, direction: 'Chiều đi', depTime, arrTime
            });
            tripCount++;
            
            // Lên lịch chuyến về (Inbound) - Cần cộng thêm thời gian nghỉ
            currentMin = endMin + config.min_break_minutes;
            if (currentMin % config.trip_frequency_minutes !== 0) {
                currentMin += (config.trip_frequency_minutes - (currentMin % config.trip_frequency_minutes));
            }

            // 2. Chiều về (Inbound)
            tripCode = `TR${driver.route_code}-${targetDateStr.replace(/-/g,'').substring(4)}-${driver.driver_code.substring(3)}-${tripCount+1}`;
            hStart = Math.floor(currentMin / 60) % 24;
            mStart = currentMin % 60;
            depTime = `${String(hStart).padStart(2, '0')}:${String(mStart).padStart(2, '0')}`;
            
            endMin = currentMin + config.trip_duration_minutes;
            hEnd = Math.floor(endMin / 60) % 24;
            mEnd = endMin % 60;
            arrTime = `${String(hEnd).padStart(2, '0')}:${String(mEnd).padStart(2, '0')}`;
            
            trips.push({
                tripCode, direction: 'Chiều về', depTime, arrTime
            });
            tripCount++;
            
            // Xong vòng, nghỉ ngơi chuẩn bị vòng mới
            currentMin = endMin + config.min_break_minutes;
            if (currentMin % config.trip_frequency_minutes !== 0) {
                currentMin += (config.trip_frequency_minutes - (currentMin % config.trip_frequency_minutes));
            }
        }
    }

    return {
        driver_code: driver.driver_code,
        full_name: driver.full_name,
        route_code: driver.route_code,
        route_name: driver.route_name,
        currentSlot,
        shift,
        shiftBadge,
        departureTime,
        isStandby,
        bus_id,
        status: targetDate < new Date().setHours(0,0,0,0) ? 'COMPLETED' : 'SCHEDULED',
        trips
    };
}
exports.calculateDriverSchedule = calculateDriverSchedule;

async function getConfigForDate(targetDateStr) {
    const res = await pool.query(`
        SELECT * FROM configuration_schedules 
        WHERE effective_date <= $1 
        ORDER BY effective_date DESC LIMIT 1
    `, [targetDateStr]);
    
    if (res.rows.length > 0) return res.rows[0];
    
    // Fallback if no config matches (should not happen if seeded)
    return {
        morning_shift_start: '05:30',
        morning_shift_end: '14:00',
        afternoon_shift_start: '14:00',
        afternoon_shift_end: '22:30',
        standby_percentage: 10,
        min_break_minutes: 10,
        trip_duration_minutes: 75,
        trip_frequency_minutes: 15
    };
}
exports.getConfigForDate = getConfigForDate;

exports.getDailySchedule = async (req, res, next) => {
    try {
        const dateStr = req.query.date || new Date().toISOString().split('T')[0];
        const routeCode = req.query.route_code || '';
        
        const config = await getConfigForDate(dateStr);
        
        // Fetch drivers with route_name
        let driverQuery = `
            SELECT d.*, r.route_name 
            FROM drivers d
            LEFT JOIN routes r ON d.route_code = r.route_code
            WHERE d.status = $1
        `;
        const driverParams = ['active'];
        if (routeCode) {
            driverParams.push(routeCode);
            driverQuery += ` AND d.route_code = $2`;
        }
        const driverRes = await pool.query(driverQuery, driverParams);
        const drivers = driverRes.rows;
        
        // Fetch active buses
        const busRes = await pool.query('SELECT * FROM buses WHERE status = $1', ['active']);
        const buses = busRes.rows;
        
        const routeDriverCounts = {};
        drivers.forEach(d => {
            routeDriverCounts[d.route_code] = (routeDriverCounts[d.route_code] || 0) + 1;
        });
        
        const schedule = drivers.map(d => calculateDriverSchedule(d, dateStr, buses, config, routeDriverCounts[d.route_code]));
        
        // Dynamic requirements stats
        const activeBusesCount = buses.length;
        
        const duration = parseInt(config.trip_duration_minutes, 10) || 75;
        const breakMin = parseInt(config.min_break_minutes, 10) || 10;
        const freqMin = parseInt(config.trip_frequency_minutes, 10) || 15;

        const cycleTime = 2 * (duration + breakMin);
        const driversPerShift = Math.ceil(cycleTime / freqMin);
        
        const morningNeeded = driversPerShift;
        const afternoonNeeded = driversPerShift;
        const morningStandby = Math.round(morningNeeded * (config.standby_percentage / 100));
        const afternoonStandby = Math.round(afternoonNeeded * (config.standby_percentage / 100));
        const routeNeeded = morningNeeded + morningStandby + afternoonNeeded + afternoonStandby;
        
        // Estimate needed drivers based on route or all routes
        let totalNeededDrivers = routeCode ? routeNeeded : (routeNeeded * 2); // 2 routes approx
        
        const availableDrivers = drivers.length;
        
        res.json({
            date: dateStr,
            route_code: routeCode,
            stats: {
        active_buses: routeCode ? Math.floor(activeBusesCount / 2) : activeBusesCount, // Rough estimate for display
                needed_drivers: totalNeededDrivers,
                available_drivers: availableDrivers,
                alert: availableDrivers < totalNeededDrivers
            },
            schedule: schedule.sort((a, b) => {
                const timeToMins = (timeStr) => {
                    if (!timeStr || timeStr === '--:--') return 99999;
                    const parts = timeStr.split(':');
                    return parseInt(parts[0]) * 60 + parseInt(parts[1]);
                };
                
                const minA = timeToMins(a.departureTime);
                const minB = timeToMins(b.departureTime);
                
                if (minA !== minB) {
                    return minA - minB;
                }
                // If times are same (e.g. Ca Sáng and Dự Bị Sáng both at 05:30), sort by currentSlot
                return a.currentSlot - b.currentSlot;
            })
        });
    } catch (error) {
        next(error);
    }
};

exports.getMySchedule = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const driverRes = await pool.query(`
            SELECT d.*, r.route_name 
            FROM drivers d
            LEFT JOIN routes r ON d.route_code = r.route_code
            WHERE d.user_id = $1
        `, [userId]);
        
        if (driverRes.rows.length === 0) {
            return res.status(404).json({ message: 'Không tìm thấy thông tin tài xế' });
        }
        
        const driver = driverRes.rows[0];
        const dateStr = req.query.date || new Date().toISOString().split('T')[0];
        
        // Query actual assigned trips from database
        const tripsRes = await pool.query(`
            SELECT t.trip_code AS "tripCode", 
                   CASE WHEN t.direction = 'outbound' THEN 'Chiều đi' ELSE 'Chiều về' END AS direction,
                   t.scheduled_departure AS "depTime",
                   t.scheduled_arrival AS "arrTime"
            FROM trips t
            JOIN trip_assignments ta ON t.trip_code = ta.trip_code
            WHERE ta.driver_code = $1 AND t.trip_date = $2 AND ta.status = 'active'
            ORDER BY t.scheduled_departure
        `, [driver.driver_code, dateStr]);
        
        const countRes = await pool.query('SELECT count(*) FROM drivers WHERE route_code = $1 AND status = $2', [driver.route_code, 'active']);
        const driversCountForRoute = parseInt(countRes.rows[0].count);
        
        // Calculate the base schedule info just for shift info (or we could infer it)
        const config = await getConfigForDate(dateStr);
        const baseInfo = calculateDriverSchedule(driver, dateStr, [], config, driversCountForRoute);
        
        const mySchedule = [{
            date: dateStr,
            shift: baseInfo.shift,
            shiftBadge: baseInfo.shiftBadge,
            departureTime: baseInfo.departureTime,
            isStandby: baseInfo.isStandby,
            bus_id: tripsRes.rows.length > 0 ? tripsRes.rows[0].bus_id : (baseInfo.isStandby ? 'STANDBY' : 'Chưa phân công'),
            status: baseInfo.status,
            trips: tripsRes.rows.length > 0 ? tripsRes.rows : baseInfo.trips
        }];
        
        // Fix bus_id by querying it from assignment
        if (tripsRes.rows.length > 0) {
            const busRes2 = await pool.query('SELECT bus_id FROM trip_assignments WHERE trip_code = $1', [tripsRes.rows[0].tripCode]);
            if (busRes2.rows.length > 0) mySchedule[0].bus_id = busRes2.rows[0].bus_id;
        }

        res.json({
            driver_info: driver,
            schedule: mySchedule
        });
    } catch (error) {
        next(error);
    }
};
