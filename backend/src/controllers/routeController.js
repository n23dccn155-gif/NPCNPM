const pool = require('../config/database');
const { success, error } = require('../utils/responseHelper');

function timeToMinutes(value) {
  if (!value) return null;
  const [hours, minutes] = String(value).split(':').map(Number);
  return hours * 60 + minutes;
}

function getCalculatedHeadway(startTime, endTime, expectedTrips) {
  const startMin = timeToMinutes(startTime);
  const endMin = timeToMinutes(endTime);
  const trips = Number(expectedTrips);

  if (startMin === null || endMin === null || endMin <= startMin || trips < 2) {
    return null;
  }

  return (endMin - startMin) / (trips - 1);
}

function validateRouteInput({ start_time, end_time, expected_trips_per_day, headway_minutes, confirmed_operating_buses }) {
  const calculatedHeadway = getCalculatedHeadway(start_time, end_time, expected_trips_per_day);
  const headway = Number(headway_minutes);
  const confirmedBuses = Number(confirmed_operating_buses);

  if (calculatedHeadway === null) {
    return { message: 'Giờ hoạt động không hợp lệ hoặc số lượt mỗi chiều phải lớn hơn hoặc bằng 2' };
  }
  if (!Number.isFinite(headway) || headway <= 0) {
    return { message: 'Giãn cách khai thác phải lớn hơn 0' };
  }
  if (headway - calculatedHeadway > 0.001) {
    return {
      message: `Giãn cách khai thác không được lớn hơn giãn cách tính từ số lượt (${Number(calculatedHeadway.toFixed(2))} phút)`
    };
  }
  if (!Number.isInteger(confirmedBuses) || confirmedBuses < 1) {
    return { message: 'Số xe vận doanh xác nhận phải lớn hơn hoặc bằng 1' };
  }

  return { calculatedHeadway };
}

function addRouteMetrics(route) {
  const startMin = timeToMinutes(route.start_time);
  const endMin = timeToMinutes(route.end_time);
  const expectedTrips = Number(route.expected_trips_per_day);
  const headway = Number(route.headway_minutes);
  const outboundTravel = Number(route.outbound_travel_time_minutes);
  const outboundTurnaround = Number(route.outbound_turnaround_time_minutes);
  const inboundTravel = Number(route.inbound_travel_time_minutes);
  const inboundTurnaround = Number(route.inbound_turnaround_time_minutes);

  const totalOperationMinutes = startMin !== null && endMin !== null ? endMin - startMin : null;
  const calculatedHeadwayMinutes = totalOperationMinutes && expectedTrips > 1
    ? totalOperationMinutes / (expectedTrips - 1)
    : null;
  const roundTripTimeMinutes = [
    outboundTravel,
    outboundTurnaround,
    inboundTravel,
    inboundTurnaround
  ].every(Number.isFinite)
    ? outboundTravel + outboundTurnaround + inboundTravel + inboundTurnaround
    : null;
  let suggestedOperatingBuses = null;
  let requiredRecoveryBuses = null;
  let requiredBackupBuses = null;
  let requiredTotalBuses = null;

  if (Number.isFinite(headway) && headway > 0 && roundTripTimeMinutes) {
    const baseBuses = Math.ceil(roundTripTimeMinutes / headway);
    const minRestTime = route.min_rest_time_minutes ? Number(route.min_rest_time_minutes) : 60;
    const backupRatio = route.backup_bus_ratio ? Number(route.backup_bus_ratio) : 0.20;
    
    requiredRecoveryBuses = Math.ceil(minRestTime / headway);
    suggestedOperatingBuses = baseBuses + requiredRecoveryBuses;
    requiredBackupBuses = Math.ceil(suggestedOperatingBuses * backupRatio);
    requiredTotalBuses = suggestedOperatingBuses + requiredBackupBuses;
  }

  return {
    ...route,
    total_operation_minutes: totalOperationMinutes,
    calculated_headway_minutes: calculatedHeadwayMinutes !== null ? Number(calculatedHeadwayMinutes.toFixed(2)) : null,
    average_headway_minutes: route.headway_minutes !== undefined ? Number(headway.toFixed(2)) : null,
    headway_minutes: route.headway_minutes !== undefined ? Number(headway.toFixed(2)) : null,
    round_trip_time_minutes: roundTripTimeMinutes,
    suggested_operating_buses: suggestedOperatingBuses,
    required_recovery_buses: requiredRecoveryBuses,
    required_backup_buses: requiredBackupBuses,
    required_total_buses: requiredTotalBuses
  };
}

async function getSuggestedOperatingBuses(routeCode, headwayMinutes) {
  const directionsRes = await pool.query(
    `SELECT direction_type, travel_time_minutes, turnaround_time_minutes
     FROM route_directions
     WHERE route_code = $1
       AND direction_type IN ('outbound', 'inbound')`,
    [routeCode]
  );

  const outbound = directionsRes.rows.find(direction => direction.direction_type === 'outbound');
  const inbound = directionsRes.rows.find(direction => direction.direction_type === 'inbound');
  const headway = Number(headwayMinutes);

  if (!outbound || !inbound || !Number.isFinite(headway) || headway <= 0) {
    return null;
  }

  const roundTripTimeMinutes =
    Number(outbound.travel_time_minutes) +
    Number(outbound.turnaround_time_minutes) +
    Number(inbound.travel_time_minutes) +
    Number(inbound.turnaround_time_minutes);

  return Math.ceil(roundTripTimeMinutes / headway);
}

const routeController = {
  getAll: async (req, res, next) => {
    try {
      const { status } = req.query;
      let query = `
        SELECT r.*,
               outbound.start_point AS outbound_start_point,
               outbound.end_point AS outbound_end_point,
               outbound.travel_time_minutes AS outbound_travel_time_minutes,
               outbound.turnaround_time_minutes AS outbound_turnaround_time_minutes,
               outbound.distance_km AS outbound_distance_km,
               inbound.start_point AS inbound_start_point,
               inbound.end_point AS inbound_end_point,
               inbound.travel_time_minutes AS inbound_travel_time_minutes,
               inbound.turnaround_time_minutes AS inbound_turnaround_time_minutes,
               inbound.distance_km AS inbound_distance_km,
               COALESCE(rb_counts.operating_count, 0)::int AS operating_buses_count,
               COALESCE(rb_counts.standby_count, 0)::int AS standby_buses_count
        FROM routes r
        LEFT JOIN route_directions outbound
          ON r.route_code = outbound.route_code
         AND outbound.direction_type = 'outbound'
        LEFT JOIN route_directions inbound
          ON r.route_code = inbound.route_code
         AND inbound.direction_type = 'inbound'
        LEFT JOIN (
          SELECT route_code,
                 COUNT(*) FILTER (WHERE bus_role = 'operating') AS operating_count,
                 COUNT(*) FILTER (WHERE bus_role = 'standby') AS standby_count
          FROM route_buses
          GROUP BY route_code
        ) rb_counts ON rb_counts.route_code = r.route_code
      `;
      const params = [];

      if (status) {
        params.push(status);
        query += ' WHERE r.status = $1';
      }

      query += ' ORDER BY r.route_code';
      const result = await pool.query(query, params);
      return success(res, result.rows.map(addRouteMetrics));
    } catch (err) {
      next(err);
    }
  },

  getOne: async (req, res, next) => {
    try {
      const { routeCode } = req.params;
      const routeRes = await pool.query('SELECT * FROM routes WHERE route_code = $1', [routeCode]);

      if (!routeRes.rows.length) {
        return error(res, 'Khong tim thay tuyen xe', 404);
      }

      const route = routeRes.rows[0];
      const busCountRes = await pool.query(
        `SELECT COUNT(*) FILTER (WHERE bus_role = 'operating')::int AS operating_buses_count,
                COUNT(*) FILTER (WHERE bus_role = 'standby')::int AS standby_buses_count
         FROM route_buses
         WHERE route_code = $1`,
        [routeCode]
      );
      Object.assign(route, busCountRes.rows[0]);

      const directionsRes = await pool.query(
        `SELECT *
         FROM route_directions
         WHERE route_code = $1
         ORDER BY CASE direction_type WHEN 'outbound' THEN 1 ELSE 2 END`,
        [routeCode]
      );

      route.directions = directionsRes.rows;
      const outbound = route.directions.find(direction => direction.direction_type === 'outbound');
      const inbound = route.directions.find(direction => direction.direction_type === 'inbound');

      Object.assign(route, addRouteMetrics({
        ...route,
        outbound_start_point: outbound?.start_point,
        outbound_end_point: outbound?.end_point,
        outbound_travel_time_minutes: outbound?.travel_time_minutes,
        outbound_turnaround_time_minutes: outbound?.turnaround_time_minutes,
        outbound_distance_km: outbound?.distance_km,
        inbound_start_point: inbound?.start_point,
        inbound_end_point: inbound?.end_point,
        inbound_travel_time_minutes: inbound?.travel_time_minutes,
        inbound_turnaround_time_minutes: inbound?.turnaround_time_minutes,
        inbound_distance_km: inbound?.distance_km
      }));

      for (const direction of route.directions) {
        const stopsRes = await pool.query(
          'SELECT * FROM bus_stops WHERE direction_id = $1 ORDER BY stop_order',
          [direction.direction_id]
        );
        direction.stops = stopsRes.rows;
      }

      return success(res, route);
    } catch (err) {
      next(err);
    }
  },

  create: async (req, res, next) => {
    try {
      const {
        route_code,
        route_name,
        start_time = '05:00:00',
        end_time = '21:00:00',
        expected_trips_per_day = 60,
        headway_minutes,
        confirmed_operating_buses = 10,
        travel_time_minutes = 80,
        short_layover_minutes = 10,
        long_layover_minutes = 15,
        max_driving_minutes = 240,
        standby_ratio = 0.15,
        inbound_start_time = '05:30:00',
        backup_bus_ratio = 0.20,
        min_rest_time_minutes = 60
      } = req.body;

      if (!route_code || !route_name) {
        return error(res, 'Ma tuyen va ten tuyen la bat buoc', 400);
      }

      const calculatedHeadway = getCalculatedHeadway(start_time, end_time, expected_trips_per_day);
      const routeHeadway = headway_minutes ?? (calculatedHeadway !== null ? Number(calculatedHeadway.toFixed(2)) : undefined);
      const validation = validateRouteInput({
        start_time,
        end_time,
        expected_trips_per_day,
        headway_minutes: routeHeadway,
        confirmed_operating_buses
      });
      if (validation.message) {
        return error(res, validation.message, 400);
      }

      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await client.query(
          `INSERT INTO routes (
             route_code,
             route_name,
             status,
             start_time,
             end_time,
             expected_trips_per_day,
             headway_minutes,
             confirmed_operating_buses,
             travel_time_minutes,
             short_layover_minutes,
             long_layover_minutes,
             max_driving_minutes,
             standby_ratio,
             inbound_start_time,
             backup_bus_ratio,
             min_rest_time_minutes
           )
           VALUES ($1, $2, 'active', $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
           RETURNING *`,
          [
            route_code,
            route_name,
            start_time,
            end_time,
            expected_trips_per_day,
            routeHeadway,
            confirmed_operating_buses,
            travel_time_minutes,
            short_layover_minutes,
            long_layover_minutes,
            max_driving_minutes,
            standby_ratio,
            inbound_start_time,
            backup_bus_ratio,
            min_rest_time_minutes
          ]
        );

        if (req.body.outbound_start_point) {
          await client.query(
            `INSERT INTO route_directions (route_code, direction_type, start_point, end_point, distance_km, travel_time_minutes, turnaround_time_minutes)
             VALUES ($1, 'outbound', $2, $3, $4, $5, $6)`,
            [route_code, req.body.outbound_start_point, req.body.outbound_end_point, req.body.outbound_distance || null, travel_time_minutes, short_layover_minutes]
          );
        }
        if (req.body.inbound_start_point) {
          await client.query(
            `INSERT INTO route_directions (route_code, direction_type, start_point, end_point, distance_km, travel_time_minutes, turnaround_time_minutes)
             VALUES ($1, 'inbound', $2, $3, $4, $5, $6)`,
            [route_code, req.body.inbound_start_point, req.body.inbound_end_point, req.body.inbound_distance || null, travel_time_minutes, short_layover_minutes]
          );
        }

        await client.query('COMMIT');
        return success(res, result.rows[0], 'Them tuyen xe thanh cong', 201);
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    } catch (err) {
      if (err.code === '23505') {
        return error(res, 'Ma tuyen da ton tai', 409);
      }
      next(err);
    }
  },

  update: async (req, res, next) => {
    try {
      const { routeCode } = req.params;
      const {
        route_name,
        start_time = '05:00:00',
        end_time = '21:00:00',
        expected_trips_per_day = 60,
        headway_minutes,
        confirmed_operating_buses = 10,
        travel_time_minutes = 80,
        short_layover_minutes = 10,
        long_layover_minutes = 15,
        max_driving_minutes = 240,
        standby_ratio = 0.15,
        inbound_start_time,
        backup_bus_ratio = 0.20,
        min_rest_time_minutes = 60
      } = req.body;

      if (!route_name) {
        return error(res, 'Ten tuyen xe la bat buoc', 400);
      }

      const calculatedHeadway = getCalculatedHeadway(start_time, end_time, expected_trips_per_day);
      const routeHeadway = headway_minutes ?? (calculatedHeadway !== null ? Number(calculatedHeadway.toFixed(2)) : undefined);
      const validation = validateRouteInput({
        start_time,
        end_time,
        expected_trips_per_day,
        headway_minutes: routeHeadway,
        confirmed_operating_buses
      });
      if (validation.message) {
        return error(res, validation.message, 400);
      }

      const suggestedOperatingBuses = await getSuggestedOperatingBuses(routeCode, routeHeadway);
      if (
        suggestedOperatingBuses !== null &&
        Number(confirmed_operating_buses) < suggestedOperatingBuses
      ) {
        return error(
          res,
          `So xe van doanh xac nhan phai lon hon hoac bang so xe toi thieu he thong goi y (${suggestedOperatingBuses})`,
          400
        );
      }

      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await client.query(
          `UPDATE routes
           SET route_name = $1,
               start_time = $2,
               end_time = $3,
               expected_trips_per_day = $4,
               headway_minutes = $5,
               confirmed_operating_buses = $6,
               travel_time_minutes = $8,
               short_layover_minutes = $9,
               long_layover_minutes = $10,
               max_driving_minutes = $11,
               standby_ratio = $12,
               inbound_start_time = $13,
               backup_bus_ratio = $14,
               min_rest_time_minutes = $15
           WHERE route_code = $7
           RETURNING *`,
          [
            route_name,
            start_time,
            end_time,
            expected_trips_per_day,
            routeHeadway,
            confirmed_operating_buses,
            routeCode,
            travel_time_minutes,
            short_layover_minutes,
            long_layover_minutes,
            max_driving_minutes,
            standby_ratio,
            inbound_start_time,
            backup_bus_ratio,
            min_rest_time_minutes
          ]
        );

        if (!result.rows.length) {
          await client.query('ROLLBACK');
          return error(res, 'Khong tim thay tuyen xe', 404);
        }

        if (req.body.outbound_start_point) {
          await client.query(
            `INSERT INTO route_directions (route_code, direction_type, start_point, end_point, distance_km, travel_time_minutes, turnaround_time_minutes)
             VALUES ($1, 'outbound', $2, $3, $4, $5, $6)
             ON CONFLICT (route_code, direction_type)
             DO UPDATE SET start_point = EXCLUDED.start_point, end_point = EXCLUDED.end_point, distance_km = EXCLUDED.distance_km, travel_time_minutes = EXCLUDED.travel_time_minutes, turnaround_time_minutes = EXCLUDED.turnaround_time_minutes`,
            [routeCode, req.body.outbound_start_point, req.body.outbound_end_point, req.body.outbound_distance || null, travel_time_minutes, short_layover_minutes]
          );
        }
        if (req.body.inbound_start_point) {
          await client.query(
            `INSERT INTO route_directions (route_code, direction_type, start_point, end_point, distance_km, travel_time_minutes, turnaround_time_minutes)
             VALUES ($1, 'inbound', $2, $3, $4, $5, $6)
             ON CONFLICT (route_code, direction_type)
             DO UPDATE SET start_point = EXCLUDED.start_point, end_point = EXCLUDED.end_point, distance_km = EXCLUDED.distance_km, travel_time_minutes = EXCLUDED.travel_time_minutes, turnaround_time_minutes = EXCLUDED.turnaround_time_minutes`,
            [routeCode, req.body.inbound_start_point, req.body.inbound_end_point, req.body.inbound_distance || null, travel_time_minutes, short_layover_minutes]
          );
        }

        await client.query('COMMIT');
        return success(res, result.rows[0], 'Cap nhat tuyen xe thanh cong');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    } catch (err) {
      next(err);
    }
  },

  updateStatus: async (req, res, next) => {
    try {
      const { status } = req.body;
      const { routeCode } = req.params;

      if (!['active', 'inactive'].includes(status)) {
        return error(res, 'Trạng thái không hợp lệ', 400);
      }

      const result = await pool.query(
        'UPDATE routes SET status = $1 WHERE route_code = $2 RETURNING *',
        [status, routeCode]
      );

      if (!result.rows.length) {
        return error(res, 'Khong tim thay tuyen xe', 404);
      }
      return success(res, result.rows[0], 'Cap nhat trang thai thanh cong');
    } catch (err) {
      next(err);
    }
  },

  deleteRoute: async (req, res, next) => {
    const client = await pool.connect();
    try {
      const { routeCode } = req.params;
      await client.query('BEGIN');
      
      // Manual cascade delete because no ON DELETE CASCADE constraints
      await client.query('DELETE FROM assignments WHERE group_id IN (SELECT group_id FROM trip_groups WHERE plan_id IN (SELECT plan_id FROM operation_plans WHERE route_code = $1))', [routeCode]);
      await client.query('DELETE FROM trips WHERE plan_id IN (SELECT plan_id FROM operation_plans WHERE route_code = $1)', [routeCode]);
      await client.query('DELETE FROM trip_groups WHERE plan_id IN (SELECT plan_id FROM operation_plans WHERE route_code = $1)', [routeCode]);
      await client.query('DELETE FROM operation_plans WHERE route_code = $1', [routeCode]);
      await client.query('DELETE FROM route_buses WHERE route_code = $1', [routeCode]);
      await client.query('DELETE FROM bus_stops WHERE direction_id IN (SELECT direction_id FROM route_directions WHERE route_code = $1)', [routeCode]);
      await client.query('DELETE FROM route_directions WHERE route_code = $1', [routeCode]);
      
      const result = await client.query('DELETE FROM routes WHERE route_code = $1 RETURNING *', [routeCode]);
      
      if (!result.rows.length) {
        await client.query('ROLLBACK');
        return error(res, 'Không tìm thấy tuyến xe', 404);
      }
      await client.query('COMMIT');
      return success(res, null, 'Xóa tuyến xe vĩnh viễn thành công');
    } catch (err) {
      await client.query('ROLLBACK');
      next(err);
    } finally {
      client.release();
    }
  },


  getDirectionsByRoute: async (req, res, next) => {
    try {
      const { routeCode } = req.params;
      const result = await pool.query(
        `SELECT *
         FROM route_directions
         WHERE route_code = $1
         ORDER BY CASE direction_type WHEN 'outbound' THEN 1 ELSE 2 END`,
        [routeCode]
      );

      return success(res, result.rows);
    } catch (err) {
      next(err);
    }
  },

  createDirection: async (req, res, next) => {
    try {
      const { routeCode } = req.params;
      const {
        direction_type,
        start_point,
        end_point,
        distance_km,
        travel_time_minutes,
        turnaround_time_minutes
      } = req.body;

      if (
        !['outbound', 'inbound'].includes(direction_type) ||
        !start_point ||
        !end_point ||
        travel_time_minutes === undefined ||
        turnaround_time_minutes === undefined
      ) {
        return error(res, 'Thieu thong tin huong tuyen bat buoc', 400);
      }

      const routeRes = await pool.query('SELECT route_code FROM routes WHERE route_code = $1', [routeCode]);
      if (!routeRes.rows.length) {
        return error(res, 'Khong tim thay tuyen xe', 404);
      }

      const result = await pool.query(
        `INSERT INTO route_directions (
           route_code,
           direction_type,
           start_point,
           end_point,
           distance_km,
           travel_time_minutes,
           turnaround_time_minutes
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          routeCode,
          direction_type,
          start_point,
          end_point,
          distance_km || null,
          travel_time_minutes,
          turnaround_time_minutes
        ]
      );

      return success(res, result.rows[0], 'Them huong tuyen thanh cong', 201);
    } catch (err) {
      if (err.code === '23505') {
        return error(res, 'Huong tuyen nay da ton tai', 409);
      }
      next(err);
    }
  },

  updateDirection: async (req, res, next) => {
    try {
      const { routeCode, directionId } = req.params;
      const {
        start_point,
        end_point,
        distance_km,
        travel_time_minutes,
        turnaround_time_minutes
      } = req.body;

      if (
        !start_point ||
        !end_point ||
        travel_time_minutes === undefined ||
        turnaround_time_minutes === undefined
      ) {
        return error(res, 'Thieu thong tin huong tuyen bat buoc', 400);
      }

      const result = await pool.query(
        `UPDATE route_directions
         SET start_point = $1,
             end_point = $2,
             distance_km = $3,
             travel_time_minutes = $4,
             turnaround_time_minutes = $5
         WHERE route_code = $6
           AND direction_id = $7
         RETURNING *`,
        [
          start_point,
          end_point,
          distance_km || null,
          travel_time_minutes,
          turnaround_time_minutes,
          routeCode,
          directionId
        ]
      );

      if (!result.rows.length) {
        return error(res, 'Khong tim thay huong tuyen', 404);
      }

      return success(res, result.rows[0], 'Cap nhat huong tuyen thanh cong');
    } catch (err) {
      next(err);
    }
  },

  getStopsByDirection: async (req, res, next) => {
    try {
      const { directionId } = req.params;
      const result = await pool.query(
        'SELECT * FROM bus_stops WHERE direction_id = $1 ORDER BY stop_order ASC',
        [directionId]
      );
      return success(res, result.rows);
    } catch (err) {
      next(err);
    }
  },

  createStop: async (req, res, next) => {
    try {
      const { direction_id, stop_order, stop_name, minute_from_start } = req.body;

      if (!direction_id || !stop_order || !stop_name || minute_from_start === undefined) {
        return error(res, 'Thieu thong tin diem dung bat buoc', 400);
      }

      const result = await pool.query(
        `INSERT INTO bus_stops (direction_id, stop_order, stop_name, minute_from_start)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [direction_id, stop_order, stop_name, minute_from_start]
      );

      return success(res, result.rows[0], 'Them diem dung thanh cong', 201);
    } catch (err) {
      if (err.code === '23505') {
        return error(res, 'Thu tu diem dung trong huong tuyen nay da ton tai', 409);
      }
      next(err);
    }
  },

  updateStop: async (req, res, next) => {
    try {
      const { stopId } = req.params;
      const { stop_order, stop_name, minute_from_start } = req.body;

      if (!stop_order || !stop_name || minute_from_start === undefined) {
        return error(res, 'Thieu thong tin diem dung bat buoc', 400);
      }

      const result = await pool.query(
        `UPDATE bus_stops
         SET stop_order = $1,
             stop_name = $2,
             minute_from_start = $3
         WHERE stop_id = $4
         RETURNING *`,
        [stop_order, stop_name, minute_from_start, stopId]
      );

      if (!result.rows.length) {
        return error(res, 'Khong tim thay diem dung', 404);
      }

      return success(res, result.rows[0], 'Cap nhat diem dung thanh cong');
    } catch (err) {
      next(err);
    }
  },

  deleteStop: async (req, res, next) => {
    try {
      const { stopId } = req.params;
      const result = await pool.query('DELETE FROM bus_stops WHERE stop_id = $1 RETURNING *', [stopId]);

      if (!result.rows.length) {
        return error(res, 'Khong tim thay diem dung', 404);
      }

      return success(res, null, 'Xoa diem dung thanh cong');
    } catch (err) {
      next(err);
    }
  },

  addBusToRoute: async (req, res, next) => {
    try {
      const { routeCode } = req.params;
      const { bus_id, bus_role } = req.body;

      if (!bus_id || !bus_role) {
        return error(res, 'Thieu thong tin bus_id hoac bus_role', 400);
      }
      if (!['operating', 'standby'].includes(bus_role)) {
        return error(res, 'Vai trò xe không hợp lệ', 400);
      }

      const busRes = await pool.query('SELECT * FROM buses WHERE bus_id = $1', [bus_id]);
      if (!busRes.rows.length) {
        return error(res, 'Xe buýt không tồn tại', 404);
      }
      if (busRes.rows[0].status !== 'active') {
        return error(res, 'Xe buýt hiện không hoạt động bình thường', 400);
      }

      const result = await pool.query(
        `INSERT INTO route_buses (route_code, bus_id, bus_role)
         VALUES ($1, $2, $3)
         ON CONFLICT (route_code, bus_id)
         DO UPDATE SET bus_role = EXCLUDED.bus_role
         RETURNING *`,
        [routeCode, bus_id, bus_role]
      );

      return success(res, result.rows[0], 'Bo tri xe vao tuyen thanh cong', 201);
    } catch (err) {
      next(err);
    }
  },

  getRouteBuses: async (req, res, next) => {
    try {
      const { routeCode } = req.params;
      const result = await pool.query(
        `SELECT rb.*, b.license_plate, b.seat_count, b.status
         FROM route_buses rb
         JOIN buses b ON rb.bus_id = b.bus_id
         WHERE rb.route_code = $1`,
        [routeCode]
      );

      return success(res, result.rows);
    } catch (err) {
      next(err);
    }
  },

  removeBusFromRoute: async (req, res, next) => {
    try {
      const { routeCode, busId } = req.params;
      const result = await pool.query(
        'DELETE FROM route_buses WHERE route_code = $1 AND bus_id = $2 RETURNING *',
        [routeCode, busId]
      );

      if (!result.rows.length) {
        return error(res, 'Khong tim thay bo tri xe nay tren tuyen', 404);
      }

      return success(res, null, 'Go xe khoi tuyen thanh cong');
    } catch (err) {
      next(err);
    }
  },

  addDriverToRoute: async (req, res, next) => {
    try {
      const { routeCode } = req.params;
      const { driver_id } = req.body;

      if (!driver_id) {
        return error(res, 'Vui long cung cap driver_id', 400);
      }

      const driverRes = await pool.query('SELECT * FROM drivers WHERE driver_id = $1 AND status = $2', [driver_id, 'working']);
      if (!driverRes.rows.length) {
        return error(res, 'Tai xe khong ton tai hoac khong hoat dong', 400);
      }

      const exist = await pool.query('SELECT * FROM route_drivers WHERE route_code = $1 AND driver_id = $2', [routeCode, driver_id]);
      if (exist.rows.length) {
        return error(res, 'Tai xe da thuoc tuyen nay', 400);
      }

      const result = await pool.query(
        `INSERT INTO route_drivers (route_code, driver_id, status)
         VALUES ($1, $2, 'active') RETURNING *`,
        [routeCode, driver_id]
      );

      return success(res, result.rows[0], 'Them tai xe vao tuyen thanh cong', 201);
    } catch (err) {
      next(err);
    }
  },

  getRouteDrivers: async (req, res, next) => {
    try {
      const { routeCode } = req.params;
      const result = await pool.query(
        `SELECT rd.*, d.full_name, d.phone, d.license_class, u.username
         FROM route_drivers rd
         JOIN drivers d ON rd.driver_id = d.driver_id
         JOIN users u ON d.user_id = u.user_id
         WHERE rd.route_code = $1`,
        [routeCode]
      );
      return success(res, result.rows);
    } catch (err) {
      next(err);
    }
  },

  removeDriverFromRoute: async (req, res, next) => {
    try {
      const { routeCode, driverId } = req.params;
      const result = await pool.query(
        'DELETE FROM route_drivers WHERE route_code = $1 AND driver_id = $2 RETURNING *',
        [routeCode, driverId]
      );

      if (!result.rows.length) {
        return error(res, 'Khong tim thay tai xe trong tuyen nay', 404);
      }

      return success(res, null, 'Go tai xe khoi tuyen thanh cong');
    } catch (err) {
      next(err);
    }
  }
};

module.exports = routeController;
