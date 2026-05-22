-- INDEXES.SQL: Tạo index hỗ trợ truy vấn và ràng buộc dữ liệu

-- Partial Unique Index quan trọng nhất: Bảo đảm mỗi chuyến chỉ có một phiếu phân công active tại một thời điểm
CREATE UNIQUE INDEX uq_trip_active_assignment 
ON trip_assignments (trip_code) 
WHERE status = 'active';

-- Index hỗ trợ tìm kiếm và báo cáo
CREATE INDEX idx_trips_date ON trips (trip_date);
CREATE INDEX idx_assignments_driver ON trip_assignments (driver_code);
CREATE INDEX idx_assignments_bus ON trip_assignments (bus_id);
CREATE INDEX idx_leave_requests_driver ON leave_requests (driver_code);
CREATE INDEX idx_incident_reports_status ON incident_reports (status);
