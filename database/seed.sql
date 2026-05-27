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
INSERT INTO drivers (driver_code, full_name, user_id, route_code, base_slot, license_type, status) VALUES 
('TX001', 'Nguyễn Văn A', 4, '01', 0,  'E', 'active'),
('TX002', 'Trần Văn B',   5, '01', 13, 'E', 'active'),
('TX003', 'Lê Văn C',     6, '08', 0,  'D', 'inactive')
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

-- 9. Dữ liệu cấu hình xếp lịch mặc định
INSERT INTO configuration_schedules (
    effective_date, morning_shift_start, morning_shift_end, 
    afternoon_shift_start, afternoon_shift_end, standby_percentage, 
    min_break_minutes, trip_duration_minutes, trip_frequency_minutes
) VALUES (
    '2026-05-25', '05:30', '14:00', '14:00', '22:30', 10, 10, 75, 15
)
ON CONFLICT DO NOTHING;

-- 10. Tự động chèn 10 xe buýt và 10 tài xế chạy thử nghiệm xoay ca
DO $$
DECLARE
    i INTEGER;
    u_id INTEGER;
    d_code VARCHAR(50);
    r_code VARCHAR(20);
    b_slot INTEGER;
BEGIN
    -- Chèn 10 xe buýt hoạt động
    FOR i IN 1..10 LOOP
        INSERT INTO buses (bus_id, license_plate, capacity, status)
        VALUES (
            '51B-500.' || LPAD(i::text, 2, '0'),
            '51B-500.' || LPAD(i::text, 2, '0'),
            45,
            'active'
        ) ON CONFLICT DO NOTHING;
    END LOOP;

    -- Chèn 10 tài khoản người dùng và thông tin tài xế tương ứng
    FOR i IN 1..10 LOOP
        -- Thêm tài khoản người dùng (mật khẩu: 123456)
        INSERT INTO users (username, password, full_name, phone, role_id, status)
        VALUES (
            'driver50_' || i,
            '$2b$10$rV/jSfQXxZnVSK9dcYg4T.p4JOq0OnNxmypDw.VlkXYlYv/NVE.Ry',
            'Tài xế tự động ' || i,
            '090500' || LPAD(i::text, 4, '0'),
            4,
            'active'
        )
        ON CONFLICT (username) DO UPDATE SET status = 'active'
        RETURNING id INTO u_id;

        -- Xác định mã tài xế
        d_code := 'TX500' || LPAD(i::text, 2, '0');

        -- Chia 5 người tuyến '01' và 5 người tuyến '08'
        IF i <= 5 THEN
            r_code := '01';
            b_slot := i - 1;
        ELSE
            r_code := '08';
            b_slot := i - 6;
        END IF;

        -- Thêm tài xế
        INSERT INTO drivers (driver_code, full_name, user_id, route_code, base_slot, license_type, status)
        VALUES (
            d_code,
            'Tài xế tự động ' || i,
            u_id,
            r_code,
            b_slot,
            'E',
            'active'
        )
        ON CONFLICT (driver_code) DO UPDATE 
        SET route_code = EXCLUDED.route_code, 
            base_slot = EXCLUDED.base_slot,
            user_id = EXCLUDED.user_id,
            status = 'active';
    END LOOP;
END $$;
