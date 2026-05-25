const pool = require('./src/config/database');

async function createTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS configuration_schedules (
        id SERIAL PRIMARY KEY,
        effective_date DATE NOT NULL,
        morning_shift_start VARCHAR(5) NOT NULL,
        morning_shift_end VARCHAR(5) NOT NULL,
        afternoon_shift_start VARCHAR(5) NOT NULL,
        afternoon_shift_end VARCHAR(5) NOT NULL,
        standby_percentage INT NOT NULL,
        min_break_minutes INT NOT NULL,
        trip_duration_minutes INT NOT NULL,
        trip_frequency_minutes INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      -- Create a unique constraint on effective_date so we only have one config per date
      CREATE UNIQUE INDEX IF NOT EXISTS idx_config_effective_date ON configuration_schedules(effective_date);
    `);
    
    // Seed initial configuration (the current one)
    const res = await pool.query('SELECT COUNT(*) FROM configuration_schedules');
    if (parseInt(res.rows[0].count) === 0) {
      await pool.query(`
        INSERT INTO configuration_schedules (
          effective_date, morning_shift_start, morning_shift_end, 
          afternoon_shift_start, afternoon_shift_end, standby_percentage, 
          min_break_minutes, trip_duration_minutes, trip_frequency_minutes
        ) VALUES (
          '2026-05-25', '05:30', '14:00', '14:00', '22:30', 10, 10, 75, 15
        )
      `);
      console.log("Seeded initial config.");
    }
    console.log("Table created.");
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

createTable();
