-- SEED.SQL: Dữ liệu mẫu đầy đủ phục vụ kiểm thử và demo
-- Mật khẩu mặc định cho tất cả tài khoản: 123456

-- 1. Vai trò
INSERT INTO roles (role_name) VALUES 
('admin'), 
('manager'), 
('dispatcher'), 
('driver')
ON CONFLICT DO NOTHING;

-- 2. Cấu hình hệ thống
INSERT INTO configurations (config_key, config_value, description) VALUES 
('MIN_REST_TIME_MINUTES', '15', 'Thời gian nghỉ tối thiểu giữa 2 chuyến của cùng 1 tài xế hoặc xe (phút)'),
('MAX_CONTINUOUS_DRIVING_MINUTES', '240', 'Thời gian lái xe liên tục tối đa (phút)')
ON CONFLICT DO NOTHING;

-- 3. Tài khoản người dùng (mật khẩu: 123456)
INSERT INTO users (username, password, role_id) VALUES 
('admin',       '$2b$10$rV/jSfQXxZnVSK9dcYg4T.p4JOq0OnNxmypDw.VlkXYlYv/NVE.Ry', 1),
('manager1',    '$2b$10$rV/jSfQXxZnVSK9dcYg4T.p4JOq0OnNxmypDw.VlkXYlYv/NVE.Ry', 2),
('dispatcher1', '$2b$10$rV/jSfQXxZnVSK9dcYg4T.p4JOq0OnNxmypDw.VlkXYlYv/NVE.Ry', 3),
('driver1',     '$2b$10$rV/jSfQXxZnVSK9dcYg4T.p4JOq0OnNxmypDw.VlkXYlYv/NVE.Ry', 4),
('driver2',     '$2b$10$rV/jSfQXxZnVSK9dcYg4T.p4JOq0OnNxmypDw.VlkXYlYv/NVE.Ry', 4),
('driver3',     '$2b$10$rV/jSfQXxZnVSK9dcYg4T.p4JOq0OnNxmypDw.VlkXYlYv/NVE.Ry', 4)
ON CONFLICT DO NOTHING;

-- 4. Tuyến xe
INSERT INTO routes (route_code, route_name, status) VALUES 
('01', 'Bến Thành - Chợ Lớn', 'active'),
('08', 'Bến xe Quận 8 - Đại học Quốc gia TP.HCM', 'active'),
('99', 'Tuyến thử nghiệm đã ngưng', 'inactive')
ON CONFLICT DO NOTHING;

-- 5. Xe buýt
INSERT INTO buses (bus_id, license_plate, capacity, status) VALUES 
('51B-123.45', '51B-123.45', 45, 'active'),
('51B-678.90', '51B-678.90', 40, 'active'),
('51B-999.99', '51B-999.99', 45, 'broken')
ON CONFLICT DO NOTHING;

-- 6. Tài xế
INSERT INTO drivers (driver_code, full_name, user_id, status) VALUES 
('TX001', 'Nguyễn Văn A', 4, 'working'),
('TX002', 'Trần Văn B',   5, 'working'),
('TX003', 'Lê Văn C',     6, 'inactive')
ON CONFLICT DO NOTHING;
