-- SCHEMA.SQL: Tạo các bảng dữ liệu đầy đủ theo tài liệu thiết kế

DROP TABLE IF EXISTS configurations CASCADE;
DROP TABLE IF EXISTS incident_reports CASCADE;
DROP TABLE IF EXISTS leave_requests CASCADE;
DROP TABLE IF EXISTS trip_logs CASCADE;
DROP TABLE IF EXISTS trip_assignments CASCADE;
DROP TABLE IF EXISTS trips CASCADE;
DROP TABLE IF EXISTS drivers CASCADE;
DROP TABLE IF EXISTS buses CASCADE;
DROP TABLE IF EXISTS routes CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS roles CASCADE;

-- 1. Vai trò người dùng
CREATE TABLE roles (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    role_name VARCHAR(50) NOT NULL UNIQUE
);

-- 2. Người dùng
CREATE TABLE users (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL DEFAULT 'User',
    phone VARCHAR(20) NULL,
    role_id INTEGER NOT NULL,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Tuyến xe
CREATE TABLE routes (
    route_code VARCHAR(20) PRIMARY KEY,
    route_name VARCHAR(255) NOT NULL,
    start_point VARCHAR(100) NOT NULL DEFAULT 'Bến xe',
    end_point VARCHAR(100) NOT NULL DEFAULT 'Bến xe',
    estimated_minutes INTEGER NOT NULL DEFAULT 60 CHECK (estimated_minutes > 0),
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Xe buýt
CREATE TABLE buses (
    bus_id VARCHAR(50) PRIMARY KEY,
    license_plate VARCHAR(20) NOT NULL UNIQUE,
    capacity INTEGER NOT NULL,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Tài xế
CREATE TABLE drivers (
    driver_code VARCHAR(50) PRIMARY KEY,
    full_name VARCHAR(255) NOT NULL,
    user_id INTEGER UNIQUE,
    license_type VARCHAR(20) NOT NULL DEFAULT 'E',
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. Chuyến xe
CREATE TABLE trips (
    trip_code VARCHAR(50) PRIMARY KEY,
    route_code VARCHAR(20) NOT NULL,
    trip_date DATE NOT NULL,
    direction VARCHAR(20) NOT NULL DEFAULT 'outbound', -- outbound, inbound
    scheduled_departure TIME NOT NULL,
    scheduled_arrival TIME NOT NULL,
    status VARCHAR(20) DEFAULT 'unassigned', -- unassigned, assigned, in_progress, completed, delayed, cancelled
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 7. Phiếu phân công chuyến
CREATE TABLE trip_assignments (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    trip_code VARCHAR(50) NOT NULL,
    bus_id VARCHAR(50) NOT NULL,
    driver_code VARCHAR(50) NOT NULL,
    dispatcher_id INTEGER NOT NULL,
    status VARCHAR(20) DEFAULT 'active', -- active, replaced, cancelled
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 8. Theo dõi thực hiện chuyến
CREATE TABLE trip_logs (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    trip_code VARCHAR(50) NOT NULL UNIQUE,
    assignment_id INTEGER NOT NULL,
    actual_departure TIMESTAMP,
    actual_arrival TIMESTAMP,
    delay_minutes INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'completed', -- in_progress, completed, delayed, cancelled
    note VARCHAR(255),
    logged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 9. Yêu cầu xin nghỉ
CREATE TABLE leave_requests (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    driver_code VARCHAR(50) NOT NULL,
    leave_date DATE NOT NULL,
    shift_type VARCHAR(20) NOT NULL DEFAULT 'full_day', -- morning, afternoon, full_day
    reason TEXT,
    status VARCHAR(20) DEFAULT 'pending', -- pending, approved, rejected
    reviewed_by INTEGER,
    reviewed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 10. Báo sự cố
CREATE TABLE incident_reports (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    driver_code VARCHAR(50) NOT NULL,
    bus_id VARCHAR(50),
    trip_code VARCHAR(50),
    incident_type VARCHAR(30) NOT NULL DEFAULT 'other', -- bus_broken, traffic_delay, other
    description TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending', -- pending, processing, resolved
    report_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 11. Cấu hình hệ thống
CREATE TABLE configurations (
    config_key VARCHAR(100) PRIMARY KEY,
    config_value VARCHAR(255) NOT NULL,
    config_data_type VARCHAR(20) NOT NULL DEFAULT 'INT', -- INT, STRING, BOOLEAN
    description TEXT
);
