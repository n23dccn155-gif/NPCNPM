const pool = require('./src/config/database');
const { calculateDriverSchedule } = require('./src/controllers/schedulerController');

async function trigger() {
  const targetDate = new Date().toISOString().split('T')[0];
  const driverRes = await pool.query("SELECT * FROM drivers WHERE status = 'active'");
  const busRes = await pool.query("SELECT * FROM buses WHERE status = 'active'");
  
  for (const driver of driverRes.rows) {
    const s = calculateDriverSchedule(driver, targetDate, busRes.rows);
    if (!s.isStandby) {
      const [baseH, baseM] = s.departureTime.split(':').map(Number);
      let currentMin = baseH * 60 + baseM;

      for (let i = 0; i < 6; i++) {
        const direction = i % 2 === 0 ? 'outbound' : 'inbound';
        const tripCode = `TR${s.route_code}-${targetDate.replace(/-/g,'').substring(4)}-${s.driver_code.substring(3)}-${i+1}`;
        
        const hStart = Math.floor(currentMin / 60) % 24;
        const mStart = currentMin % 60;
        const depTime = `${String(hStart).padStart(2, '0')}:${String(mStart).padStart(2, '0')}`;
        
        const endMin = currentMin + 75; // 75 mins driving per trip
        
        const hEnd = Math.floor(endMin / 60) % 24;
        const mEnd = endMin % 60;
        const arrTime = `${String(hEnd).padStart(2, '0')}:${String(mEnd).padStart(2, '0')}`;

        await pool.query(
          `INSERT INTO trips (trip_code, route_code, trip_date, direction, scheduled_departure, scheduled_arrival, status) 
           VALUES ($1, $2, $3, $4, $5, $6, 'assigned') ON CONFLICT DO NOTHING`,
          [tripCode, s.route_code, targetDate, direction, depTime, arrTime]
        );
        await pool.query(
          `INSERT INTO trip_assignments (trip_code, driver_code, bus_id, dispatcher_id, status) 
           VALUES ($1, $2, $3, 1, 'active') ON CONFLICT DO NOTHING`,
          [tripCode, s.driver_code, s.bus_id]
        );

        // 10 phút nghỉ ngơi trước khi bắt đầu chuyến tiếp theo
        currentMin = endMin + 10;
        // Đợi đến slot 15 phút tiếp theo
        if (currentMin % 15 !== 0) {
          currentMin += (15 - (currentMin % 15));
        }
      }
    }
  }
  console.log("DONE");
  process.exit(0);
}

trigger();
