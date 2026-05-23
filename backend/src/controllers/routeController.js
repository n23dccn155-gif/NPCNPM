// routeController.js
const pool = require('../config/database');
const { success, error } = require('../utils/responseHelper');

const routeController = {
  getAll: async (req, res, next) => {
    try {
      const { status } = req.query;
      let query = 'SELECT * FROM routes';
      const params = [];
      if (status) { query += ' WHERE status = $1'; params.push(status); }
      query += ' ORDER BY route_code';
      const result = await pool.query(query, params);
      return success(res, result.rows);
    } catch (err) { next(err); }
  },

  getOne: async (req, res, next) => {
    try {
      const result = await pool.query('SELECT * FROM routes WHERE route_code = $1', [req.params.routeCode]);
      if (!result.rows.length) return error(res, 'Không tìm thấy tuyến xe', 404);
      return success(res, result.rows[0]);
    } catch (err) { next(err); }
  },

  create: async (req, res, next) => {
    try {
      const { route_code, route_name, start_point, end_point, estimated_minutes } = req.body;
      if (!route_code || !route_name || !start_point || !end_point || !estimated_minutes)
        return error(res, 'Thiếu thông tin bắt buộc', 400);
      
      const parsedMinutes = parseInt(estimated_minutes, 10);
      if (isNaN(parsedMinutes) || parsedMinutes <= 0) {
        return error(res, 'Thời gian chạy dự kiến phải là số nguyên dương', 400);
      }

      const result = await pool.query(
        'INSERT INTO routes (route_code, route_name, start_point, end_point, estimated_minutes) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [route_code, route_name, start_point, end_point, parsedMinutes]
      );
      return success(res, result.rows[0], 'Thêm tuyến xe thành công', 201);
    } catch (err) {
      if (err.code === '23505') return error(res, 'Mã tuyến đã tồn tại', 409);
      next(err);
    }
  },

  update: async (req, res, next) => {
    try {
      const { route_name, start_point, end_point, estimated_minutes } = req.body;
      if (!route_name || !start_point || !end_point || !estimated_minutes)
        return error(res, 'Thiếu thông tin bắt buộc', 400);

      const parsedMinutes = parseInt(estimated_minutes, 10);
      if (isNaN(parsedMinutes) || parsedMinutes <= 0) {
        return error(res, 'Thời gian chạy dự kiến phải là số nguyên dương', 400);
      }

      const result = await pool.query(
        'UPDATE routes SET route_name = $1, start_point = $2, end_point = $3, estimated_minutes = $4 WHERE route_code = $5 RETURNING *',
        [route_name, start_point, end_point, parsedMinutes, req.params.routeCode]
      );
      if (!result.rows.length) return error(res, 'Không tìm thấy tuyến xe', 404);
      return success(res, result.rows[0], 'Cập nhật tuyến xe thành công');
    } catch (err) { next(err); }
  },

  updateStatus: async (req, res, next) => {
    try {
      const { status } = req.body;
      if (!['active', 'inactive'].includes(status)) return error(res, 'Trạng thái không hợp lệ', 400);
      const result = await pool.query(
        'UPDATE routes SET status = $1 WHERE route_code = $2 RETURNING *',
        [status, req.params.routeCode]
      );
      if (!result.rows.length) return error(res, 'Không tìm thấy tuyến xe', 404);
      return success(res, result.rows[0], 'Cập nhật trạng thái tuyến xe thành công');
    } catch (err) { next(err); }
  },
};
module.exports = routeController;
