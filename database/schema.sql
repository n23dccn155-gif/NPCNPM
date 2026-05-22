-- SCHEMA.SQL: Tạo các bảng dữ liệu

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

CREATE TABLE roles (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    role_name VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE users (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role_id INTEGER NOT NULL,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE routes (
    route_code VARCHAR(20) PRIMARY KEY,
    route_name VARCHAR(255) NOT NULL,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE buses (
    bus_id VARCHAR(50) PRIMARY KEY,
    license_plate VARCHAR(20) NOT NULL UNIQUE,
    capacity INTEGER NOT NULL,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE drivers (
    driver_code VARCHAR(50) PRIMARY KEY,
    full_name VARCHAR(255) NOT NULL,
    user_id INTEGER UNIQUE,
    status VARCHAR(20) DEFAULT 'working',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE trips (
    trip_code VARCHAR(50) PRIMARY KEY,
    route_code VARCHAR(20) NOT NULL,
    trip_date DATE NOT NULL,
    scheduled_departure TIME NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE trip_assignments (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    trip_code VARCHAR(50) NOT NULL,
    bus_id VARCHAR(50) NOT NULL,
    driver_code VARCHAR(50) NOT NULL,
    dispatcher_id INTEGER NOT NULL,
    status VARCHAR(20) DEFAULT 'active',
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE trip_logs (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    trip_code VARCHAR(50) NOT NULL UNIQUE,
    assignment_id INTEGER NOT NULL,
    actual_departure TIME,
    delay_minutes INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'completed',
    logged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE leave_requests (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    driver_code VARCHAR(50) NOT NULL,
    leave_date DATE NOT NULL,
    reason TEXT,
    status VARCHAR(20) DEFAULT 'pending',
    reviewed_by INTEGER,
    reviewed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE incident_reports (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    driver_code VARCHAR(50) NOT NULL,
    bus_id VARCHAR(50),
    trip_code VARCHAR(50),
    description TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    report_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE configurations (
    config_key VARCHAR(50) PRIMARY KEY,
    config_value VARCHAR(255) NOT NULL,
    description TEXT
);
