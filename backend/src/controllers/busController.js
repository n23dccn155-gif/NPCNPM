// busController.js
const pool = require('../config/database');
const { success, error } = require('../utils/responseHelper');

const busController = {
  getAll: async (req, res, next) => {
    try {
      const { status } = req.query;
      let query = 'SELECT * FROM buses';
      const params = [];
      if (status) { query += ' WHERE status = $1'; params.push(status); }
      query += ' ORDER BY bus_id';
      const result = await pool.query(query, params);
      return success(res, result.rows);
    } catch (err) { next(err); }
  },

  getOne: async (req, res, next) => {
    try {
      const result = await pool.query('SELECT * FROM buses WHERE bus_id = $1', [req.params.busId]);
      if (!result.rows.length) return error(res, 'Không tìm thấy xe buýt', 404);
      return success(res, result.rows[0]);
    } catch (err) { next(err); }
  },

  create: async (req, res, next) => {
    try {
      const { bus_id, license_plate, capacity } = req.body;
      if (!bus_id || !license_plate || !capacity) return error(res, 'Thiếu thông tin bắt buộc', 400);
      const result = await pool.query(
        'INSERT INTO buses (bus_id, license_plate, capacity) VALUES ($1, $2, $3) RETURNING *',
        [bus_id, license_plate, capacity]
      );
      return success(res, result.rows[0], 'Thêm xe buýt thành công', 201);
    } catch (err) {
      if (err.code === '23505') return error(res, 'Mã xe hoặc biển số đã tồn tại', 409);
      next(err);
    }
  },

  update: async (req, res, next) => {
    try {
      const { license_plate, capacity } = req.body;
      const result = await pool.query(
        'UPDATE buses SET license_plate = $1, capacity = $2 WHERE bus_id = $3 RETURNING *',
        [license_plate, capacity, req.params.busId]
      );
      if (!result.rows.length) return error(res, 'Không tìm thấy xe buýt', 404);
      return success(res, result.rows[0], 'Cập nhật xe buýt thành công');
    } catch (err) { next(err); }
  },

  updateStatus: async (req, res, next) => {
    try {
      const { status } = req.body;
      if (!['active', 'broken', 'inactive'].includes(status)) return error(res, 'Trạng thái không hợp lệ', 400);
      const result = await pool.query(
        'UPDATE buses SET status = $1 WHERE bus_id = $2 RETURNING *',
        [status, req.params.busId]
      );
      if (!result.rows.length) return error(res, 'Không tìm thấy xe buýt', 404);
      return success(res, result.rows[0], 'Cập nhật trạng thái xe buýt thành công');
    } catch (err) { next(err); }
  },
};
module.exports = busController;
