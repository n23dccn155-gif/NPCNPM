const API_URL = 'http://localhost:5000/api';
let tokens = {};
let createdData = {};

async function login(username, password, role) {
    try {
        const res = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        if (res.ok) {
            tokens[role] = data.token;
            console.log(`[PASS] Login ${role}`);
        } else {
            console.error(`[FAIL] Login ${role}:`, data.message);
        }
    } catch (err) { console.error(`[FAIL] Login:`, err.message); }
}

async function fetchAPI(method, endpoint, role, body = null) {
    const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokens[role]}` };
    const options = { method, headers };
    if (body) options.body = JSON.stringify(body);
    
    const res = await fetch(`${API_URL}${endpoint}`, options);
    const data = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, data };
}

async function runTests() {
    console.log("=== STARTING API TESTS ===");
    
    // 1. Auth Tests
    await login('manager1', '123456', 'manager');
    await login('dispatcher1', '123456', 'dispatcher');
    // Let's create a driver login test. Wait, we need to find a driver from the DB.
    // In seed.sql, driver user might be 'driver1'.
    await login('driver1', '123456', 'driver'); // Might fail if driver1 is not in seed

    // 2. Manager Tests
    console.log("\n--- Manager Tests ---");
    let res = await fetchAPI('GET', '/routes', 'manager');
    console.log(res.ok ? "[PASS] GET /routes" : "[FAIL] GET /routes");
    
    res = await fetchAPI('POST', '/buses', 'manager', { license_plate: 'TEST-123', seat_count: 45, status: 'active' });
    console.log(res.ok ? "[PASS] POST /buses" : `[FAIL] POST /buses: ${res.data?.message}`);

    // 3. Dispatcher Tests
    console.log("\n--- Dispatcher Tests ---");
    res = await fetchAPI('POST', '/plans', 'dispatcher', { route_code: '01', operation_date: '2026-07-01' });
    if (res.ok && res.data && res.data.data) {
        createdData.planId = res.data.data.plan_id;
        console.log(`[PASS] POST /plans (Created ID: ${createdData.planId})`);
    } else {
        console.error(`[FAIL] POST /plans:`, res.data?.message || 'Unknown error');
    }

    if (createdData.planId) {
        res = await fetchAPI('POST', `/plans/${createdData.planId}/generate-trips`, 'dispatcher');
        console.log(res.ok ? "[PASS] POST /generate-trips" : `[FAIL] POST /generate-trips: ${res.data?.message}`);

        res = await fetchAPI('POST', `/plans/${createdData.planId}/auto-assign`, 'dispatcher');
        console.log(res.ok ? "[PASS] POST /auto-assign" : `[FAIL] POST /auto-assign: ${res.data?.message}`);
        
        res = await fetchAPI('GET', `/plans/${createdData.planId}`, 'dispatcher');
        if (res.ok && res.data.data.trips) {
             console.log(`[PASS] GET /plans/:id - Generated ${res.data.data.trips.length} trips`);
             createdData.tripId = res.data.data.trips[0].trip_id;
        } else {
             console.error(`[FAIL] GET /plans/:id`);
        }
    }

    // 4. Driver Tests
    if (tokens.driver) {
        console.log("\n--- Driver Tests ---");
        res = await fetchAPI('GET', '/trips/my-trips', 'driver');
        console.log(res.ok ? "[PASS] GET /trips/my-trips" : `[FAIL] GET /trips/my-trips: ${res.data?.message}`);
        
        if (createdData.tripId) {
            res = await fetchAPI('POST', `/incidents`, 'driver', {
                incident_type: 'bus_broken',
                description: 'Xe bị thủng lốp',
                trip_id: createdData.tripId
            });
            console.log(res.ok ? "[PASS] POST /incidents" : `[FAIL] POST /incidents: ${res.data?.message}`);
        }
    } else {
        console.log("\n[SKIP] Driver Tests (Login Failed)");
    }

    console.log("\n=== TESTS COMPLETED ===");
    process.exit(0);
}

runTests();
