-- SEED.SQL: Dữ liệu mẫu đầy đủ phù hợp cấu trúc CSDL mới (14 bảng)
-- Mật khẩu mặc định cho tất cả tài khoản: 123456 (đã hash bằng bcrypt)

-- 1. Tài khoản người dùng (users)
-- Mật khẩu hash bên dưới tương ứng với chuỗi '123456'
INSERT INTO users (username, password_hash, full_name, role, status) VALUES 
('manager1',    '$2b$10$rV/jSfQXxZnVSK9dcYg4T.p4JOq0OnNxmypDw.VlkXYlYv/NVE.Ry', 'Trần Hồng Quân', 'manager',    'active'),
('dispatcher1', '$2b$10$rV/jSfQXxZnVSK9dcYg4T.p4JOq0OnNxmypDw.VlkXYlYv/NVE.Ry', 'Lê Văn Hùng',    'dispatcher', 'active')
ON CONFLICT (username) DO NOTHING;

-- 3. Xe buýt (buses)
INSERT INTO buses (license_plate, seat_count, status) VALUES 
('51B-100.01', 45, 'active'),
('51B-100.02', 45, 'active'),
('51B-100.03', 45, 'active'),
('51B-100.04', 45, 'active'),
('51B-100.05', 45, 'active'),
('51B-100.06', 40, 'active'),
('51B-100.07', 40, 'active'),
('51B-100.08', 40, 'active'),
('51B-100.09', 40, 'active'),
('51B-100.10', 40, 'active'),
('51B-100.11', 45, 'active'), -- standby
('51B-100.12', 45, 'active'), -- standby
('51B-100.13', 40, 'active'), -- standby
('51B-100.14', 40, 'broken'), -- hỏng
('51B-100.15', 40, 'inactive') -- ngưng hoạt động
ON CONFLICT (license_plate) DO NOTHING;

-- 4. Tạo tài khoản cho tài xế trong users và drivers
-- Thêm 10 tài xế
DO $$
DECLARE
    i INTEGER;
    u_id INTEGER;
    username_val VARCHAR(50);
BEGIN
    FOR i IN 1..10 LOOP
        username_val := 'driver' || i;
        -- Thêm user
        INSERT INTO users (username, password_hash, full_name, role, status)
        VALUES (
            username_val,
            '$2b$10$rV/jSfQXxZnVSK9dcYg4T.p4JOq0OnNxmypDw.VlkXYlYv/NVE.Ry',
            'Tài xế Nguyễn Văn ' || CHR(64 + i),
            'driver',
            'active'
        )
        ON CONFLICT (username) DO UPDATE SET status = 'active'
        RETURNING user_id INTO u_id;

        -- Thêm driver
        INSERT INTO drivers (user_id, full_name, phone, license_class, status)
        VALUES (
            u_id,
            'Tài xế Nguyễn Văn ' || CHR(64 + i),
            '09081230' || LPAD(i::text, 2, '0'),
            'E',
            'working'
        )
        ON CONFLICT (user_id) DO NOTHING;
    END LOOP;
END $$;

-- 5. Tuyến xe (routes)
INSERT INTO routes (route_code, route_name, status, start_time, end_time, expected_trips_per_day, headway_minutes, confirmed_operating_buses) VALUES 
('01', 'Bến Thành - Chợ Lớn', 'active', '05:00:00', '21:00:00', 33, 30.00, 8),
('08', 'Bến xe Quận 8 - Đại học Quốc gia TP.HCM', 'active', '05:00:00', '20:00:00', 25, 37.50, 6),
('99', 'Tuyến phụ ngưng hoạt động', 'inactive', '06:00:00', '18:00:00', 10, 80.00, 2)
ON CONFLICT (route_code) DO NOTHING;

-- 6. Hướng tuyến (route_directions)
INSERT INTO route_directions (route_code, direction_type, start_point, end_point, distance_km, travel_time_minutes, turnaround_time_minutes) VALUES 
('01', 'outbound', 'Bến Thành', 'Chợ Lớn', 8.5, 45, 15),
('01', 'inbound',  'Chợ Lớn', 'Bến Thành', 8.5, 45, 15),
('08', 'outbound', 'Bến xe Quận 8', 'Đại học Quốc gia', 25.2, 90, 20),
('08', 'inbound',  'Đại học Quốc gia', 'Bến xe Quận 8', 25.2, 90, 20)
ON CONFLICT (route_code, direction_type) DO NOTHING;

-- 7. Điểm dừng (bus_stops)
-- Lấy direction_id cho tuyến 01 outbound
DO $$
DECLARE
    dir_01_out INT;
    dir_01_in INT;
    dir_08_out INT;
    dir_08_in INT;
BEGIN
    SELECT direction_id INTO dir_01_out FROM route_directions WHERE route_code = '01' AND direction_type = 'outbound';
    SELECT direction_id INTO dir_01_in FROM route_directions WHERE route_code = '01' AND direction_type = 'inbound';
    SELECT direction_id INTO dir_08_out FROM route_directions WHERE route_code = '08' AND direction_type = 'outbound';
    SELECT direction_id INTO dir_08_in FROM route_directions WHERE route_code = '08' AND direction_type = 'inbound';

    IF dir_01_out IS NOT NULL THEN
        INSERT INTO bus_stops (direction_id, stop_order, stop_name, minute_from_start) VALUES 
        (dir_01_out, 1, 'Trạm Trung chuyển Bến Thành', 0),
        (dir_01_out, 2, 'Trạm Hàm Nghi', 5),
        (dir_01_out, 3, 'Trạm Trần Hưng Đạo', 15),
        (dir_01_out, 4, 'Bệnh viện Chấn thương Chỉnh hình', 25),
        (dir_01_out, 5, 'Bến xe Chợ Lớn', 45)
        ON CONFLICT (direction_id, stop_order) DO NOTHING;
    END IF;

    IF dir_01_in IS NOT NULL THEN
        INSERT INTO bus_stops (direction_id, stop_order, stop_name, minute_from_start) VALUES 
        (dir_01_in, 1, 'Bến xe Chợ Lớn', 0),
        (dir_01_in, 2, 'Trạm Nguyễn Trãi', 10),
        (dir_01_in, 3, 'Trạm Hàm Nghi', 35),
        (dir_01_in, 4, 'Trạm Trung chuyển Bến Thành', 45)
        ON CONFLICT (direction_id, stop_order) DO NOTHING;
    END IF;

    IF dir_08_out IS NOT NULL THEN
        INSERT INTO bus_stops (direction_id, stop_order, stop_name, minute_from_start) VALUES 
        (dir_08_out, 1, 'Bến xe Quận 8', 0),
        (dir_08_out, 2, 'Trạm Tạ Quang Bửu', 10),
        (dir_08_out, 3, 'Trạm Ngã tư Hàng Xanh', 40),
        (dir_08_out, 4, 'Trạm Suối Tiên', 75),
        (dir_08_out, 5, 'Trạm ĐHQG Khu B', 90)
        ON CONFLICT (direction_id, stop_order) DO NOTHING;
    END IF;

    IF dir_08_in IS NOT NULL THEN
        INSERT INTO bus_stops (direction_id, stop_order, stop_name, minute_from_start) VALUES 
        (dir_08_in, 1, 'Trạm ĐHQG Khu B', 0),
        (dir_08_in, 2, 'Trạm Suối Tiên', 15),
        (dir_08_in, 3, 'Trạm Ngã tư Hàng Xanh', 50),
        (dir_08_in, 4, 'Bến xe Quận 8', 90)
        ON CONFLICT (direction_id, stop_order) DO NOTHING;
    END IF;
END $$;

-- 8. Bố trí xe cho tuyến (route_buses)
-- Tuyến 01: Xe operating (buses 1..5), standby (bus 11)
-- Tuyến 08: Xe operating (buses 6..10), standby (bus 12)
DO $$
DECLARE
    b_id INT;
BEGIN
    -- Tuyến 01 Operating
    FOR b_id IN 1..8 LOOP
        INSERT INTO route_buses (route_code, bus_id, bus_role) 
        VALUES ('01', b_id, 'operating')
        ON CONFLICT (route_code, bus_id) DO NOTHING;
    END LOOP;
    -- Tuyến 01 Standby
    INSERT INTO route_buses (route_code, bus_id, bus_role) VALUES ('01', 11, 'standby') ON CONFLICT (route_code, bus_id) DO NOTHING;

    -- Tuyến 08 Operating
    FOR b_id IN 6..10 LOOP
        INSERT INTO route_buses (route_code, bus_id, bus_role) 
        VALUES ('08', b_id, 'operating')
        ON CONFLICT (route_code, bus_id) DO NOTHING;
    END LOOP;
    INSERT INTO route_buses (route_code, bus_id, bus_role) VALUES ('08', 13, 'operating') ON CONFLICT (route_code, bus_id) DO NOTHING;
    -- Tuyến 08 Standby
    INSERT INTO route_buses (route_code, bus_id, bus_role) VALUES ('08', 12, 'standby') ON CONFLICT (route_code, bus_id) DO NOTHING;
END $$;
