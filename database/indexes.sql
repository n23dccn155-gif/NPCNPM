-- INDEXES.SQL: Tạo các index và Partial Unique Index hỗ trợ nghiệp vụ và truy vấn

-- 1. Partial Unique Index quan trọng nhất: Bảo đảm mỗi nhóm chuyến chỉ có một phân công active tại một thời điểm
CREATE UNIQUE INDEX IF NOT EXISTS uq_group_active_assignment 
ON assignments (group_id) 
WHERE status = 'active';

-- 2. Index hỗ trợ tìm kiếm, lọc và báo cáo
CREATE INDEX IF NOT EXISTS idx_trips_plan ON trips (plan_id);
CREATE INDEX IF NOT EXISTS idx_trips_departure ON trips (scheduled_departure);
CREATE INDEX IF NOT EXISTS idx_assignments_driver ON assignments (driver_id);
CREATE INDEX IF NOT EXISTS idx_assignments_bus ON assignments (bus_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_driver ON leave_requests (driver_id);
CREATE INDEX IF NOT EXISTS idx_incident_reports_status ON incident_reports (status);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications (user_id) WHERE is_read = FALSE;
