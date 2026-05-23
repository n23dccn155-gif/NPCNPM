-- SEED.SQL: Dữ liệu mẫu đầy đủ phù hợp cấu trúc CSDL và tài liệu nghiệp vụ
-- Mật khẩu mặc định cho tất cả tài khoản: 123456

-- 1. Vai trò
INSERT INTO roles (role_name) VALUES 
('admin'), 
('manager'), 
('dispatcher'), 
('driver')
ON CONFLICT DO NOTHING;

-- 2. Cấu hình hệ thống
INSERT INTO configurations (config_key, config_value, config_data_type, description) VALUES 
('min_break_time_minutes', '15', 'INT', 'Thời gian nghỉ tối thiểu giữa hai chuyến (phút)'),
('max_continuous_driving_minutes', '240', 'INT', 'Thời gian lái xe liên tục tối đa (phút)'),
('session_timeout_minutes', '30', 'INT', 'Thời gian tự động đăng xuất khi không thao tác (phút)')
ON CONFLICT DO NOTHING;

-- 3. Tài khoản người dùng (mật khẩu: 123456)
INSERT INTO users (username, password, full_name, phone, role_id, status) VALUES 
('admin',       '$2b$10$rV/jSfQXxZnVSK9dcYg4T.p4JOq0OnNxmypDw.VlkXYlYv/NVE.Ry', 'Quản trị viên', '0901234567', 1, 'active'),
('manager1',    '$2b$10$rV/jSfQXxZnVSK9dcYg4T.p4JOq0OnNxmypDw.VlkXYlYv/NVE.Ry', 'Trần Hồng Quân', '0907654321', 2, 'active'),
('dispatcher1', '$2b$10$rV/jSfQXxZnVSK9dcYg4T.p4JOq0OnNxmypDw.VlkXYlYv/NVE.Ry', 'Lê Văn Hùng',    '0911223344', 3, 'active'),
('driver1',     '$2b$10$rV/jSfQXxZnVSK9dcYg4T.p4JOq0OnNxmypDw.VlkXYlYv/NVE.Ry', 'Nguyễn Văn A',  '0988776655', 4, 'active'),
('driver2',     '$2b$10$rV/jSfQXxZnVSK9dcYg4T.p4JOq0OnNxmypDw.VlkXYlYv/NVE.Ry', 'Trần Văn B',    '0977665544', 4, 'active'),
('driver3',     '$2b$10$rV/jSfQXxZnVSK9dcYg4T.p4JOq0OnNxmypDw.VlkXYlYv/NVE.Ry', 'Lê Văn C',      '0966554433', 4, 'active')
ON CONFLICT DO NOTHING;

-- 4. Tuyến xe
INSERT INTO routes (route_code, route_name, start_point, end_point, estimated_minutes, status) VALUES 
('01', 'Bến Thành - Chợ Lớn', 'Bến Thành', 'Chợ Lớn', 45, 'active'),
('08', 'Bến xe Quận 8 - Đại học Quốc gia TP.HCM', 'Bến xe Quận 8', 'Đại học Quốc gia', 90, 'active'),
('99', 'Tuyến thử nghiệm đã ngưng', 'Bến xe Miền Đông', 'Bến xe Miền Tây', 60, 'inactive')
ON CONFLICT DO NOTHING;

-- 5. Xe buýt
INSERT INTO buses (bus_id, license_plate, capacity, status) VALUES 
('51B-123.45', '51B-123.45', 45, 'active'),
('51B-678.90', '51B-678.90', 40, 'active'),
('51B-999.99', '51B-999.99', 45, 'broken')
ON CONFLICT DO NOTHING;

-- 6. Tài xế
INSERT INTO drivers (driver_code, full_name, user_id, license_type, status) VALUES 
('TX001', 'Nguyễn Văn A', 4, 'E', 'active'),
('TX002', 'Trần Văn B',   5, 'E', 'active'),
('TX003', 'Lê Văn C',     6, 'D', 'inactive')
ON CONFLICT DO NOTHING;

-- 7. Chuyến xe (Lập sẵn một số chuyến mẫu chưa phân công và đã phân công)
INSERT INTO trips (trip_code, route_code, trip_date, direction, scheduled_departure, scheduled_arrival, status) VALUES
('CX001', '01', CURRENT_DATE, 'outbound', '07:00:00', '07:45:00', 'assigned'),
('CX002', '01', CURRENT_DATE, 'inbound',  '08:00:00', '08:45:00', 'unassigned'),
('CX003', '08', CURRENT_DATE, 'outbound', '09:00:00', '10:30:00', 'assigned'),
('CX004', '08', CURRENT_DATE, 'inbound',  '11:00:00', '12:30:00', 'unassigned')
ON CONFLICT DO NOTHING;

-- 8. Phân công chuyến xe mẫu
INSERT INTO trip_assignments (trip_code, bus_id, driver_code, dispatcher_id, status) VALUES
('CX001', '51B-123.45', 'TX001', 3, 'active'),
('CX003', '51B-678.90', 'TX002', 3, 'active')
ON CONFLICT DO NOTHING;
