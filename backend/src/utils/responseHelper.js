// responseHelper.js: Chuẩn hóa response API
const success = (res, data, message = 'Thành công', statusCode = 200) => {
  return res.status(statusCode).json({ success: true, message, data });
};
const error = (res, message = 'Đã xảy ra lỗi', statusCode = 500) => {
  return res.status(statusCode).json({ success: false, message });
};
module.exports = { success, error };
