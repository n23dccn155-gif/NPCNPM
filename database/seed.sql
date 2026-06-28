-- SEED.SQL: Dữ liệu mẫu (1 Manager, 1 Dispatcher, 50 Driver, 50 Bus, 3 Tuyến đầy đủ)
-- Mật khẩu mặc định cho tất cả tài khoản: 123456 (đã hash bằng bcrypt)

-- Dọn dẹp dữ liệu cũ
TRUNCATE TABLE users, buses, routes, drivers, route_directions, bus_stops, route_buses, operation_plans, trips, trip_groups, assignments, route_drivers CASCADE;

-- 1. Tài khoản quản lý và điều phối
INSERT INTO users (username, password_hash, full_name, role, status) VALUES 
('manager1',    '$2b$10$rV/jSfQXxZnVSK9dcYg4T.p4JOq0OnNxmypDw.VlkXYlYv/NVE.Ry', 'Trần Hồng Quân', 'manager',    'active'),
('dispatcher1', '$2b$10$rV/jSfQXxZnVSK9dcYg4T.p4JOq0OnNxmypDw.VlkXYlYv/NVE.Ry', 'Lê Văn Hùng',    'dispatcher', 'active');

-- 2. Xe buýt (buses) - 50 xe
DO $$
DECLARE
    i INTEGER;
    plate VARCHAR(20);
BEGIN
    FOR i IN 1..50 LOOP
        plate := '51B-100.' || LPAD(i::text, 2, '0');
        INSERT INTO buses (license_plate, seat_count, status)
        VALUES (plate, 45, 'active');
    END LOOP;
END $$;

-- 3. Tạo tài khoản cho tài xế trong users và drivers (50 tài xế)
DO $$
DECLARE
    i INTEGER;
    u_id INTEGER;
    username_val VARCHAR(50);
BEGIN
    FOR i IN 1..50 LOOP
        username_val := 'driver' || i;
        -- Thêm user
        INSERT INTO users (username, password_hash, full_name, role, status)
        VALUES (
            username_val,
            '$2b$10$rV/jSfQXxZnVSK9dcYg4T.p4JOq0OnNxmypDw.VlkXYlYv/NVE.Ry',
            'Tài xế Nguyễn Văn ' || i,
            'driver',
            'active'
        )
        RETURNING user_id INTO u_id;

        -- Thêm driver
        INSERT INTO drivers (user_id, full_name, phone, license_class, status)
        VALUES (
            u_id,
            'Tài xế Nguyễn Văn ' || i,
            '09081230' || LPAD(i::text, 2, '0'),
            'E',
            'working'
        );
    END LOOP;
END $$;

-- 4. Tuyến xe (routes) - 3 tuyến
INSERT INTO routes (
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
    backup_bus_ratio,
    min_rest_time_minutes
) VALUES 
('01', 'Bến Thành - Chợ Lớn', 'active', '05:00:00', '21:00:00', 50, 18, 5, 30, 10, 10, 180, 0.10, 0.20, 30),
('08', 'Bến xe Quận 8 - Đại học Quốc gia TP.HCM', 'active', '05:00:00', '20:00:00', 40, 21, 6, 45, 15, 15, 180, 0.10, 0.30, 30),
('150', 'Bến xe Chợ Lớn - Ngã 3 Tân Vạn', 'active', '04:30:00', '21:00:00', 60, 15, 10, 50, 20, 20, 200, 0.15, 0.20, 40);

-- 5. Hướng tuyến (route_directions)
INSERT INTO route_directions (route_code, direction_type, start_point, end_point, distance_km, travel_time_minutes, turnaround_time_minutes) VALUES 
('01', 'outbound', 'Bến Thành', 'Chợ Lớn', 8.5, 30, 10),
('01', 'inbound',  'Chợ Lớn', 'Bến Thành', 8.5, 30, 10),
('08', 'outbound', 'Bến xe Quận 8', 'Đại học Quốc gia', 25.2, 45, 15),
('08', 'inbound',  'Đại học Quốc gia', 'Bến xe Quận 8', 25.2, 45, 15),
('150', 'outbound', 'Bến xe Chợ Lớn', 'Ngã 3 Tân Vạn', 30.0, 50, 20),
('150', 'inbound',  'Ngã 3 Tân Vạn', 'Bến xe Chợ Lớn', 30.0, 50, 20);

-- 6. Điểm dừng (bus_stops)
DO $$
DECLARE
    dir_01_out INT; dir_01_in INT;
    dir_08_out INT; dir_08_in INT;
    dir_150_out INT; dir_150_in INT;
BEGIN
    SELECT direction_id INTO dir_01_out FROM route_directions WHERE route_code = '01' AND direction_type = 'outbound';
    SELECT direction_id INTO dir_01_in FROM route_directions WHERE route_code = '01' AND direction_type = 'inbound';
    SELECT direction_id INTO dir_08_out FROM route_directions WHERE route_code = '08' AND direction_type = 'outbound';
    SELECT direction_id INTO dir_08_in FROM route_directions WHERE route_code = '08' AND direction_type = 'inbound';
    SELECT direction_id INTO dir_150_out FROM route_directions WHERE route_code = '150' AND direction_type = 'outbound';
    SELECT direction_id INTO dir_150_in FROM route_directions WHERE route_code = '150' AND direction_type = 'inbound';

    -- Stops for 01
    INSERT INTO bus_stops (direction_id, stop_order, stop_name, minute_from_start) VALUES 
    (dir_01_out, 1, 'Trạm Trung chuyển Bến Thành', 0),
    (dir_01_out, 2, 'Trạm Hàm Nghi', 5),
    (dir_01_out, 3, 'Trạm Trần Hưng Đạo', 10),
    (dir_01_out, 4, 'Bệnh viện Chấn thương Chỉnh hình', 20),
    (dir_01_out, 5, 'Bến xe Chợ Lớn', 30);

    INSERT INTO bus_stops (direction_id, stop_order, stop_name, minute_from_start) VALUES 
    (dir_01_in, 1, 'Bến xe Chợ Lớn', 0),
    (dir_01_in, 2, 'Trạm Nguyễn Trãi', 10),
    (dir_01_in, 3, 'Trạm Hàm Nghi', 20),
    (dir_01_in, 4, 'Trạm Trung chuyển Bến Thành', 30);

    -- Stops for 08
    INSERT INTO bus_stops (direction_id, stop_order, stop_name, minute_from_start) VALUES 
    (dir_08_out, 1, 'Bến xe Quận 8', 0),
    (dir_08_out, 2, 'Trạm Tạ Quang Bửu', 5),
    (dir_08_out, 3, 'Trạm Ngã tư Hàng Xanh', 20),
    (dir_08_out, 4, 'Trạm Suối Tiên', 35),
    (dir_08_out, 5, 'Trạm ĐHQG Khu B', 45);

    INSERT INTO bus_stops (direction_id, stop_order, stop_name, minute_from_start) VALUES 
    (dir_08_in, 1, 'Trạm ĐHQG Khu B', 0),
    (dir_08_in, 2, 'Trạm Suối Tiên', 10),
    (dir_08_in, 3, 'Trạm Ngã tư Hàng Xanh', 25),
    (dir_08_in, 4, 'Bến xe Quận 8', 45);

    -- Stops for 150
    INSERT INTO bus_stops (direction_id, stop_order, stop_name, minute_from_start) VALUES 
    (dir_150_out, 1, 'Bến xe Chợ Lớn', 0),
    (dir_150_out, 2, 'Thuận Kiều Plaza', 10),
    (dir_150_out, 3, 'Ngã tư Hàng Xanh', 35),
    (dir_150_out, 4, 'Ngã 3 Tân Vạn', 50);

    INSERT INTO bus_stops (direction_id, stop_order, stop_name, minute_from_start) VALUES 
    (dir_150_in, 1, 'Ngã 3 Tân Vạn', 0),
    (dir_150_in, 2, 'Ngã tư Hàng Xanh', 15),
    (dir_150_in, 3, 'Thuận Kiều Plaza', 35),
    (dir_150_in, 4, 'Bến xe Chợ Lớn', 50);
END $$;

-- 7. Phân bổ tài xế mặc định cho các tuyến (route_drivers)
-- Tuyến '01': Cần 6 tài xế (driver 1-6)
INSERT INTO route_drivers (route_code, driver_id, status) VALUES
('01', 1, 'active'), ('01', 2, 'active'), ('01', 3, 'active'),
('01', 4, 'active'), ('01', 5, 'active'), ('01', 6, 'active');

-- Tuyến '08': Cần 7 tài xế (driver 7-13)
INSERT INTO route_drivers (route_code, driver_id, status) VALUES
('08', 7, 'active'), ('08', 8, 'active'), ('08', 9, 'active'),
('08', 10, 'active'), ('08', 11, 'active'), ('08', 12, 'active'),
('08', 13, 'active');

-- Tuyến '150': Cần 12 tài xế (driver 14-25)
INSERT INTO route_drivers (route_code, driver_id, status) VALUES
('150', 14, 'active'), ('150', 15, 'active'), ('150', 16, 'active'),
('150', 17, 'active'), ('150', 18, 'active'), ('150', 19, 'active'),
('150', 20, 'active'), ('150', 21, 'active'), ('150', 22, 'active'),
('150', 23, 'active'), ('150', 24, 'active'), ('150', 25, 'active');

-- 8. Phân bổ xe mặc định cho các tuyến (route_buses)
-- Tuyến '01': Cần 5 xe vận doanh (bus 1-5), 1 xe dự phòng (bus 6)
INSERT INTO route_buses (route_code, bus_id, bus_role) VALUES
('01', 1, 'operating'), ('01', 2, 'operating'), ('01', 3, 'operating'),
('01', 4, 'operating'), ('01', 5, 'operating'), ('01', 6, 'standby');

-- Tuyến '08': Cần 6 xe vận doanh (bus 7-12), 2 xe dự phòng (bus 13-14)
INSERT INTO route_buses (route_code, bus_id, bus_role) VALUES
('08', 7, 'operating'), ('08', 8, 'operating'), ('08', 9, 'operating'),
('08', 10, 'operating'), ('08', 11, 'operating'), ('08', 12, 'operating'),
('08', 13, 'standby'), ('08', 14, 'standby');

-- Tuyến '150': Cần 10 xe vận doanh (bus 15-24), 2 xe dự phòng (bus 25-26)
INSERT INTO route_buses (route_code, bus_id, bus_role) VALUES
('150', 15, 'operating'), ('150', 16, 'operating'), ('150', 17, 'operating'),
('150', 18, 'operating'), ('150', 19, 'operating'), ('150', 20, 'operating'),
('150', 21, 'operating'), ('150', 22, 'operating'), ('150', 23, 'operating'),
('150', 24, 'operating'), ('150', 25, 'standby'), ('150', 26, 'standby');
