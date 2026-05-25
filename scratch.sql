SELECT * FROM routes WHERE status = 'active';
SELECT route_code, COUNT(*) FROM drivers WHERE status = 'active' GROUP BY route_code;
SELECT * FROM configuration_schedules ORDER BY effective_date DESC LIMIT 1;
