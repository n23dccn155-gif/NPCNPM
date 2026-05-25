-- CONSTRAINTS.SQL: Thêm khóa ngoại và các ràng buộc CHECK đầy đủ theo tài liệu thiết kế

ALTER TABLE users
    ADD CONSTRAINT fk_users_roles FOREIGN KEY (role_id) REFERENCES roles(id),
    ADD CONSTRAINT chk_users_status CHECK (status IN ('active', 'inactive', 'locked'));

ALTER TABLE routes
    ADD CONSTRAINT chk_routes_status CHECK (status IN ('active', 'inactive'));

ALTER TABLE buses
    ADD CONSTRAINT chk_buses_capacity CHECK (capacity > 0),
    ADD CONSTRAINT chk_buses_status CHECK (status IN ('active', 'broken', 'inactive'));

ALTER TABLE drivers
    ADD CONSTRAINT fk_drivers_users FOREIGN KEY (user_id) REFERENCES users(id),
    ADD CONSTRAINT fk_drivers_routes FOREIGN KEY (route_code) REFERENCES routes(route_code),
    ADD CONSTRAINT chk_drivers_status CHECK (status IN ('active', 'suspended', 'inactive'));

ALTER TABLE trips
    ADD CONSTRAINT fk_trips_routes FOREIGN KEY (route_code) REFERENCES routes(route_code),
    ADD CONSTRAINT chk_trips_direction CHECK (direction IN ('outbound', 'inbound')),
    ADD CONSTRAINT chk_trips_status CHECK (status IN ('unassigned', 'assigned', 'in_progress', 'completed', 'delayed', 'cancelled'));

ALTER TABLE trip_assignments
    ADD CONSTRAINT fk_assignments_trips FOREIGN KEY (trip_code) REFERENCES trips(trip_code),
    ADD CONSTRAINT fk_assignments_buses FOREIGN KEY (bus_id) REFERENCES buses(bus_id),
    ADD CONSTRAINT fk_assignments_drivers FOREIGN KEY (driver_code) REFERENCES drivers(driver_code),
    ADD CONSTRAINT fk_assignments_dispatchers FOREIGN KEY (dispatcher_id) REFERENCES users(id),
    ADD CONSTRAINT chk_assignments_status CHECK (status IN ('active', 'replaced', 'cancelled'));

-- Ràng buộc độc nhất: chỉ có 1 phân công active cho mỗi chuyến xe tại 1 thời điểm (đã định nghĩa trong indexes.sql)

ALTER TABLE trip_logs
    ADD CONSTRAINT fk_logs_trips FOREIGN KEY (trip_code) REFERENCES trips(trip_code),
    ADD CONSTRAINT fk_logs_assignments FOREIGN KEY (assignment_id) REFERENCES trip_assignments(id),
    ADD CONSTRAINT chk_logs_delay CHECK (delay_minutes >= 0),
    ADD CONSTRAINT chk_logs_status CHECK (status IN ('in_progress', 'completed', 'delayed', 'cancelled'));

ALTER TABLE leave_requests
    ADD CONSTRAINT fk_leave_drivers FOREIGN KEY (driver_code) REFERENCES drivers(driver_code),
    ADD CONSTRAINT fk_leave_reviewers FOREIGN KEY (reviewed_by) REFERENCES users(id),
    ADD CONSTRAINT chk_leave_shift CHECK (shift_type IN ('morning', 'afternoon', 'full_day')),
    ADD CONSTRAINT chk_leave_status CHECK (status IN ('pending', 'approved', 'rejected'));

ALTER TABLE incident_reports
    ADD CONSTRAINT fk_incident_drivers FOREIGN KEY (driver_code) REFERENCES drivers(driver_code),
    ADD CONSTRAINT fk_incident_buses FOREIGN KEY (bus_id) REFERENCES buses(bus_id),
    ADD CONSTRAINT fk_incident_trips FOREIGN KEY (trip_code) REFERENCES trips(trip_code),
    ADD CONSTRAINT chk_incident_type CHECK (incident_type IN ('bus_broken', 'traffic_delay', 'other')),
    ADD CONSTRAINT chk_incident_status CHECK (status IN ('pending', 'processing', 'resolved'));
