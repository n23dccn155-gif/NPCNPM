-- CONSTRAINTS.SQL: Thêm khóa ngoại, ràng buộc CHECK và các ràng buộc UNIQUE cho thiết kế mới

-- 1. Bảng users
ALTER TABLE users
    ADD CONSTRAINT chk_users_role CHECK (role IN ('manager', 'dispatcher', 'driver')),
    ADD CONSTRAINT chk_users_status CHECK (status IN ('active', 'locked'));

-- 2. Bảng routes
ALTER TABLE routes
    ADD CONSTRAINT chk_routes_status CHECK (status IN ('active', 'inactive')),
    ADD CONSTRAINT chk_routes_expected_trips CHECK (expected_trips_per_day >= 2),
    ADD CONSTRAINT chk_routes_headway CHECK (headway_minutes > 0),
    ADD CONSTRAINT chk_routes_operating_buses CHECK (confirmed_operating_buses >= 1),
    ADD CONSTRAINT chk_routes_times CHECK (end_time > start_time);

-- 3. Bảng route_directions
ALTER TABLE route_directions
    ADD CONSTRAINT fk_directions_routes FOREIGN KEY (route_code) REFERENCES routes(route_code) ON DELETE CASCADE,
    ADD CONSTRAINT chk_directions_type CHECK (direction_type IN ('outbound', 'inbound')),
    ADD CONSTRAINT chk_directions_travel_time CHECK (travel_time_minutes > 0),
    ADD CONSTRAINT chk_directions_turnaround_time CHECK (turnaround_time_minutes >= 0),
    ADD CONSTRAINT uq_route_direction UNIQUE (route_code, direction_type);

-- 4. Bảng bus_stops
ALTER TABLE bus_stops
    ADD CONSTRAINT fk_stops_directions FOREIGN KEY (direction_id) REFERENCES route_directions(direction_id) ON DELETE CASCADE,
    ADD CONSTRAINT chk_stops_order CHECK (stop_order > 0),
    ADD CONSTRAINT chk_stops_minute CHECK (minute_from_start >= 0),
    ADD CONSTRAINT uq_direction_stop_order UNIQUE (direction_id, stop_order);

-- 5. Bảng buses
ALTER TABLE buses
    ADD CONSTRAINT chk_buses_seat CHECK (seat_count > 0),
    ADD CONSTRAINT chk_buses_status CHECK (status IN ('active', 'broken', 'inactive'));

-- 6. Bảng drivers
ALTER TABLE drivers
    ADD CONSTRAINT fk_drivers_users FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    ADD CONSTRAINT chk_drivers_status CHECK (status IN ('working', 'on_leave', 'inactive'));

-- 7. Bảng route_buses
ALTER TABLE route_buses
    ADD CONSTRAINT fk_route_buses_routes FOREIGN KEY (route_code) REFERENCES routes(route_code) ON DELETE CASCADE,
    ADD CONSTRAINT fk_route_buses_buses FOREIGN KEY (bus_id) REFERENCES buses(bus_id) ON DELETE CASCADE,
    ADD CONSTRAINT chk_route_buses_role CHECK (bus_role IN ('operating', 'standby')),
    ADD CONSTRAINT uq_route_bus UNIQUE (route_code, bus_id);

-- 7b. Bảng route_drivers
ALTER TABLE route_drivers
    ADD CONSTRAINT fk_route_drivers_routes FOREIGN KEY (route_code) REFERENCES routes(route_code) ON DELETE CASCADE,
    ADD CONSTRAINT fk_route_drivers_drivers FOREIGN KEY (driver_id) REFERENCES drivers(driver_id) ON DELETE CASCADE,
    ADD CONSTRAINT uq_route_driver UNIQUE (route_code, driver_id);


-- 8. Bảng operation_plans
ALTER TABLE operation_plans
    ADD CONSTRAINT fk_plans_routes FOREIGN KEY (route_code) REFERENCES routes(route_code) ON DELETE CASCADE,
    ADD CONSTRAINT fk_plans_created FOREIGN KEY (created_by) REFERENCES users(user_id),
    ADD CONSTRAINT fk_plans_submitted FOREIGN KEY (submitted_by) REFERENCES users(user_id),
    ADD CONSTRAINT fk_plans_reviewed FOREIGN KEY (reviewed_by) REFERENCES users(user_id),
    ADD CONSTRAINT chk_plans_status CHECK (status IN ('draft', 'pending_approval', 'approved', 'rejected')),
    ADD CONSTRAINT uq_route_date UNIQUE (route_code, operation_date);

-- 9. Bảng trip_groups
ALTER TABLE trip_groups
    ADD CONSTRAINT fk_groups_plans FOREIGN KEY (plan_id) REFERENCES operation_plans(plan_id) ON DELETE CASCADE,
    ADD CONSTRAINT chk_groups_status CHECK (status IN ('unassigned', 'assigned')),
    ADD CONSTRAINT chk_groups_times CHECK (end_time > start_time);

-- 10. Bảng trips
ALTER TABLE trips
    ADD CONSTRAINT fk_trips_plans FOREIGN KEY (plan_id) REFERENCES operation_plans(plan_id) ON DELETE CASCADE,
    ADD CONSTRAINT fk_trips_directions FOREIGN KEY (direction_id) REFERENCES route_directions(direction_id),
    ADD CONSTRAINT fk_trips_groups FOREIGN KEY (group_id) REFERENCES trip_groups(group_id) ON DELETE SET NULL,
    ADD CONSTRAINT chk_trips_status CHECK (status IN ('scheduled', 'assigned', 'running', 'completed', 'cancelled')),
    ADD CONSTRAINT chk_trips_times CHECK (scheduled_arrival > scheduled_departure),
    ADD CONSTRAINT chk_trips_delay CHECK (delay_minutes >= 0);

-- 11. Bảng assignments
ALTER TABLE assignments
    ADD CONSTRAINT fk_assignments_groups FOREIGN KEY (group_id) REFERENCES trip_groups(group_id) ON DELETE CASCADE,
    ADD CONSTRAINT fk_assignments_buses FOREIGN KEY (bus_id) REFERENCES buses(bus_id),
    ADD CONSTRAINT fk_assignments_drivers FOREIGN KEY (driver_id) REFERENCES drivers(driver_id),
    ADD CONSTRAINT fk_assignments_assigned_by FOREIGN KEY (assigned_by) REFERENCES users(user_id),
    ADD CONSTRAINT chk_assignments_status CHECK (status IN ('active', 'replaced', 'cancelled'));

-- 12. Bảng leave_requests
ALTER TABLE leave_requests
    ADD CONSTRAINT fk_leave_drivers FOREIGN KEY (driver_id) REFERENCES drivers(driver_id) ON DELETE CASCADE,
    ADD CONSTRAINT fk_leave_reviewed FOREIGN KEY (reviewed_by) REFERENCES users(user_id),
    ADD CONSTRAINT chk_leave_status CHECK (status IN ('pending', 'approved', 'rejected'));

-- 13. Bảng incident_reports
ALTER TABLE incident_reports
    ADD CONSTRAINT fk_incidents_reported FOREIGN KEY (reported_by) REFERENCES users(user_id),
    ADD CONSTRAINT fk_incidents_buses FOREIGN KEY (bus_id) REFERENCES buses(bus_id) ON DELETE SET NULL,
    ADD CONSTRAINT fk_incidents_trips FOREIGN KEY (trip_id) REFERENCES trips(trip_id) ON DELETE SET NULL,
    ADD CONSTRAINT chk_incidents_type CHECK (incident_type IN ('bus_broken', 'delay', 'cancelled', 'other')),
    ADD CONSTRAINT chk_incidents_status CHECK (status IN ('pending', 'processing', 'resolved'));

-- 14. Bảng notifications
ALTER TABLE notifications
    ADD CONSTRAINT fk_notifications_users FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE;
