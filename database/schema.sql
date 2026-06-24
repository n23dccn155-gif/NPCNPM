-- SCHEMA.SQL: Tạo các bảng dữ liệu đầy đủ theo tài liệu thiết kế mới (14 bảng)

-- Drop existing tables if they exist.
-- Nhóm đầu là các bảng thuộc thiết kế cũ, không còn xuất hiện trong tài liệu
-- 03_Thiet_ke_CSDL_PostgreSQL.docx. Cần drop để database thật không còn rác
-- khi khởi tạo lại trên một CSDL đã từng chạy phiên bản cũ.
DROP TABLE IF EXISTS configuration_schedules CASCADE;
DROP TABLE IF EXISTS configurations CASCADE;
DROP TABLE IF EXISTS trip_logs CASCADE;
DROP TABLE IF EXISTS trip_assignments CASCADE;
DROP TABLE IF EXISTS roles CASCADE;

-- system_configs thuộc phiên bản cấu hình động cũ; vẫn drop để làm sạch DB khi khởi tạo lại.
DROP TABLE IF EXISTS system_configs CASCADE;
-- Nhóm dưới là 14 bảng chính của thiết kế hiện tại.
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS incident_reports CASCADE;
DROP TABLE IF EXISTS leave_requests CASCADE;
DROP TABLE IF EXISTS assignments CASCADE;
DROP TABLE IF EXISTS trips CASCADE;
DROP TABLE IF EXISTS trip_groups CASCADE;
DROP TABLE IF EXISTS operation_plans CASCADE;
DROP TABLE IF EXISTS route_buses CASCADE;
DROP TABLE IF EXISTS drivers CASCADE;
DROP TABLE IF EXISTS buses CASCADE;
DROP TABLE IF EXISTS bus_stops CASCADE;
DROP TABLE IF EXISTS route_directions CASCADE;
DROP TABLE IF EXISTS routes CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- 1. Bảng users: Lưu tài khoản đăng nhập và vai trò người dùng (không có bảng roles riêng)
CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    role VARCHAR(30) NOT NULL, -- manager, dispatcher, driver
    status VARCHAR(20) NOT NULL DEFAULT 'active' -- active, locked
);

-- 2. Bảng routes: Lưu thông tin tuyến xe và thông tin hoạt động hiện hành của tuyến
CREATE TABLE routes (
    route_code VARCHAR(20) PRIMARY KEY, -- ví dụ: 01, 08
    route_name VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active', -- active, inactive
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    expected_trips_per_day INT NOT NULL,
    headway_minutes NUMERIC(6,2) NOT NULL,
    confirmed_operating_buses INT NOT NULL,
    travel_time_minutes INT DEFAULT 0,
    short_layover_minutes INT DEFAULT 0,
    long_layover_minutes INT DEFAULT 0,
    max_driving_minutes INT DEFAULT 240,
    standby_ratio NUMERIC(4,2) DEFAULT 0.1,
    inbound_start_time TIME,
    backup_bus_ratio NUMERIC(4,2) DEFAULT 0.20,
    min_rest_time_minutes INT DEFAULT 60
);

-- 3. Bảng route_directions: Lưu thông tin lượt đi và lượt về của tuyến
CREATE TABLE route_directions (
    direction_id SERIAL PRIMARY KEY,
    route_code VARCHAR(20) NOT NULL,
    direction_type VARCHAR(20) NOT NULL, -- outbound, inbound
    start_point VARCHAR(255) NOT NULL,
    end_point VARCHAR(255) NOT NULL,
    distance_km NUMERIC(5,2),
    travel_time_minutes INT NOT NULL,
    turnaround_time_minutes INT NOT NULL
);

-- 4. Bảng bus_stops: Lưu danh sách điểm dừng theo từng hướng tuyến
CREATE TABLE bus_stops (
    stop_id SERIAL PRIMARY KEY,
    direction_id INT NOT NULL,
    stop_order INT NOT NULL,
    stop_name VARCHAR(255) NOT NULL,
    minute_from_start INT NOT NULL
);

-- 5. Bảng buses: Lưu thông tin xe buýt
CREATE TABLE buses (
    bus_id SERIAL PRIMARY KEY,
    license_plate VARCHAR(20) UNIQUE NOT NULL,
    seat_count INT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active' -- active, broken, inactive
);

-- 6. Bảng drivers: Lưu thông tin tài xế
CREATE TABLE drivers (
    driver_id SERIAL PRIMARY KEY,
    user_id INT UNIQUE NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    license_class VARCHAR(20),
    status VARCHAR(20) NOT NULL DEFAULT 'working' -- working, on_leave, inactive
);

-- 7. Bảng route_buses: Lưu thông tin bố trí xe vận doanh và xe dự phòng cho tuyến
CREATE TABLE route_buses (
    route_bus_id SERIAL PRIMARY KEY,
    route_code VARCHAR(20) NOT NULL,
    bus_id INT NOT NULL,
    bus_role VARCHAR(20) NOT NULL -- operating, standby
);

-- 7b. Bảng route_drivers: Lưu thông tin tài xế thuộc tuyến
CREATE TABLE route_drivers (
    route_driver_id SERIAL PRIMARY KEY,
    route_code VARCHAR(20) NOT NULL,
    driver_id INT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active'
);

-- 8. Bảng operation_plans: Lưu kế hoạch vận doanh theo tuyến và ngày
CREATE TABLE operation_plans (
    plan_id SERIAL PRIMARY KEY,
    route_code VARCHAR(20) NOT NULL,
    operation_date DATE NOT NULL,
    created_by INT NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'draft', -- draft, pending_approval, approved, rejected
    submitted_by INT,
    reviewed_by INT,
    reject_reason TEXT
);

-- 9. Bảng trip_groups: Lưu nhóm chuyến dùng để phân công xe và tài xế theo khối
CREATE TABLE trip_groups (
    group_id SERIAL PRIMARY KEY,
    plan_id INT NOT NULL,
    group_name VARCHAR(50),
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'unassigned' -- unassigned, assigned
);

-- 10. Bảng trips: Lưu danh sách chuyến được sinh và thông tin thực tế khi thực hiện
CREATE TABLE trips (
    trip_id SERIAL PRIMARY KEY,
    plan_id INT NOT NULL,
    direction_id INT NOT NULL,
    group_id INT,
    trip_order INT,
    scheduled_departure TIMESTAMP NOT NULL,
    scheduled_arrival TIMESTAMP NOT NULL,
    actual_departure TIMESTAMP,
    actual_arrival TIMESTAMP,
    delay_minutes INT DEFAULT 0,
    status VARCHAR(30) NOT NULL DEFAULT 'scheduled' -- scheduled, assigned, running, completed, cancelled
);

-- 11. Bảng assignments: Lưu phân công xe và tài xế cho nhóm chuyến
CREATE TABLE assignments (
    assignment_id SERIAL PRIMARY KEY,
    plan_id INT NOT NULL,
    group_id INT,
    bus_id INT,
    driver_id INT NOT NULL,
    assignment_type VARCHAR(20) NOT NULL DEFAULT 'main', -- main, standby_morning, standby_afternoon
    assigned_by INT NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'active' -- active, replaced, cancelled
);

-- 12. Bảng leave_requests: Lưu yêu cầu nghỉ của tài xế
CREATE TABLE leave_requests (
    leave_id SERIAL PRIMARY KEY,
    driver_id INT NOT NULL,
    leave_date DATE NOT NULL,
    reason TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, approved, rejected
    reviewed_by INT
);

-- 13. Bảng incident_reports: Lưu báo cáo sự cố hoặc xe hỏng
CREATE TABLE incident_reports (
    incident_id SERIAL PRIMARY KEY,
    reported_by INT NOT NULL,
    bus_id INT,
    trip_id INT,
    incident_type VARCHAR(30) NOT NULL, -- bus_broken, delay, cancelled, other
    description TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' -- pending, processing, resolved
);

-- 14. Bảng notifications: Lưu thông báo nội bộ dạng chuông
CREATE TABLE notifications (
    notification_id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
