-- GPS.SQL: Hạ tầng dữ liệu cho hệ thống giám sát xe buýt theo thời gian thực
-- Bao gồm:
--   1. gps_devices        : thiết bị GPS gắn trên xe (hộp đen)
--   2. gps_locations      : dữ liệu vị trí thô gửi về từ thiết bị (lưu lịch sử hành trình)
--   3. route_polylines    : quỹ đạo tuyến xe (để so sánh lệch tuyến)
--   4. gps_alerts         : cảnh báo (lệch tuyến / quá tốc độ / dừng đỗ bất thường)
--   5. alert_rules        : cấu hình rule cho từng loại cảnh báo
--
-- Thiết kế: lưu raw location ở bảng riêng, giữ schema gọn, dễ mở rộng.
-- Xem thêm: docs/GPS_TRACKING.md

-- ============== Bảng 1: GPS_DEVICES ==============
CREATE TABLE IF NOT EXISTS gps_devices (
    device_id SERIAL PRIMARY KEY,
    bus_id INT NOT NULL,
    device_code VARCHAR(50) UNIQUE NOT NULL,    -- mã thiết bị do nhà sản xuất cấp
    vendor VARCHAR(100),                         -- hãng (ví dụ: Concox, Teltonika)
    sim_number VARCHAR(20),
    protocol VARCHAR(30) DEFAULT 'http',         -- http, tcp, mqtt
    status VARCHAR(20) NOT NULL DEFAULT 'active',-- active, inactive, lost
    last_seen_at TIMESTAMP,                      -- lần cuối nhận tín hiệu
    installed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_gps_devices_buses FOREIGN KEY (bus_id) REFERENCES buses(bus_id) ON DELETE CASCADE,
    CONSTRAINT chk_gps_devices_status CHECK (status IN ('active', 'inactive', 'lost'))
);

-- ============== Bảng 2: GPS_LOCATIONS ==============
CREATE TABLE IF NOT EXISTS gps_locations (
    location_id BIGSERIAL PRIMARY KEY,
    device_id INT NOT NULL,
    bus_id INT NOT NULL,
    latitude NUMERIC(10, 7) NOT NULL,           -- vĩ độ
    longitude NUMERIC(10, 7) NOT NULL,          -- kinh độ
    speed_kmh NUMERIC(6, 2) DEFAULT 0,         -- tốc độ km/h
    heading NUMERIC(5, 2) DEFAULT 0,           -- hướng di chuyển 0-359 độ
    altitude NUMERIC(7, 2),                     -- độ cao (m) - optional
    accuracy_m NUMERIC(7, 2),                   -- sai số GPS (m) - optional
    recorded_at TIMESTAMP NOT NULL,             -- thời điểm thiết bị ghi nhận
    received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- thời điểm server nhận
    CONSTRAINT fk_gps_locations_devices FOREIGN KEY (device_id) REFERENCES gps_devices(device_id) ON DELETE CASCADE,
    CONSTRAINT fk_gps_locations_buses FOREIGN KEY (bus_id) REFERENCES buses(bus_id) ON DELETE CASCADE,
    CONSTRAINT chk_gps_locations_lat CHECK (latitude BETWEEN -90 AND 90),
    CONSTRAINT chk_gps_locations_lng CHECK (longitude BETWEEN -180 AND 180)
);

-- Index phục vụ truy vấn lịch sử & realtime
CREATE INDEX IF NOT EXISTS idx_gps_locations_bus_time ON gps_locations (bus_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_gps_locations_device_time ON gps_locations (device_id, recorded_at DESC);

-- Partial Unique: một xe chỉ có 1 thiết bị active tại 1 thời điểm
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_device_per_bus
ON gps_devices (bus_id)
WHERE status = 'active';

-- ============== Bảng 3: ROUTE_POLYLINES ==============
CREATE TABLE IF NOT EXISTS route_polylines (
    polyline_id SERIAL PRIMARY KEY,
    route_code VARCHAR(20) NOT NULL,
    direction_type VARCHAR(20) NOT NULL,        -- outbound, inbound
    direction_id INT,                           -- FK tới route_directions (optional)
    point_order INT NOT NULL,
    latitude NUMERIC(10, 7) NOT NULL,
    longitude NUMERIC(10, 7) NOT NULL,
    CONSTRAINT fk_polylines_routes FOREIGN KEY (route_code) REFERENCES routes(route_code) ON DELETE CASCADE,
    CONSTRAINT fk_polylines_directions FOREIGN KEY (direction_id) REFERENCES route_directions(direction_id) ON DELETE SET NULL,
    CONSTRAINT chk_polylines_direction_type CHECK (direction_type IN ('outbound', 'inbound')),
    CONSTRAINT uq_route_direction_point UNIQUE (route_code, direction_type, point_order)
);

CREATE INDEX IF NOT EXISTS idx_polylines_route_dir ON route_polylines (route_code, direction_type);

-- ============== Bảng 4: GPS_ALERTS ==============
CREATE TABLE IF NOT EXISTS gps_alerts (
    alert_id BIGSERIAL PRIMARY KEY,
    bus_id INT NOT NULL,
    location_id BIGINT,                         -- tham chiếu vị trí gây cảnh báo
    alert_type VARCHAR(30) NOT NULL,            -- off_route | over_speed | long_stop
    severity VARCHAR(20) NOT NULL DEFAULT 'warning', -- info | warning | critical
    message TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,          -- chi tiết rule: khoảng cách, tốc độ, thời gian dừng...
    status VARCHAR(20) NOT NULL DEFAULT 'new',  -- new | acknowledged | resolved
    acknowledged_by INT,
    acknowledged_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_alerts_buses FOREIGN KEY (bus_id) REFERENCES buses(bus_id) ON DELETE CASCADE,
    CONSTRAINT fk_alerts_locations FOREIGN KEY (location_id) REFERENCES gps_locations(location_id) ON DELETE SET NULL,
    CONSTRAINT fk_alerts_acknowledged_by FOREIGN KEY (acknowledged_by) REFERENCES users(user_id),
    CONSTRAINT chk_alerts_type CHECK (alert_type IN ('off_route', 'over_speed', 'long_stop', 'no_signal', 'other')),
    CONSTRAINT chk_alerts_severity CHECK (severity IN ('info', 'warning', 'critical')),
    CONSTRAINT chk_alerts_status CHECK (status IN ('new', 'acknowledged', 'resolved'))
);

CREATE INDEX IF NOT EXISTS idx_alerts_status_created ON gps_alerts (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_bus_type ON gps_alerts (bus_id, alert_type);

-- ============== Bảng 5: ALERT_RULES ==============
-- Cấu hình rule cho mỗi loại alert (có thể bật/tắt và chỉnh ngưỡng)
CREATE TABLE IF NOT EXISTS alert_rules (
    rule_id SERIAL PRIMARY KEY,
    alert_type VARCHAR(30) UNIQUE NOT NULL,
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    threshold_value NUMERIC(8, 2),              -- ngưỡng: off_route (m), over_speed (km/h), long_stop (giây)
    cooldown_seconds INT DEFAULT 300,           -- thời gian chờ giữa 2 alert cùng loại cho cùng xe
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_rules_alert_type CHECK (alert_type IN ('off_route', 'over_speed', 'long_stop', 'no_signal', 'other'))
);

-- Seed rule mặc định (mỗi loại 1 rule, có thể điều chỉnh sau)
INSERT INTO alert_rules (alert_type, is_enabled, threshold_value, cooldown_seconds) VALUES
('off_route',  TRUE, 500.00, 300),    -- lệch tuyến > 500m
('over_speed', TRUE, 60.00,  120),    -- quá tốc độ > 60km/h
('long_stop',  TRUE, 600.00, 600),    -- dừng đỗ > 600 giây (10 phút)
('no_signal',  TRUE, NULL,   600)     -- mất tín hiệu (threshold_value không áp dụng)
ON CONFLICT (alert_type) DO NOTHING;