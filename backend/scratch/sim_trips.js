function simulate() {
    const endMin = 1260; // 21:00
    const startMin = 300; // 05:00
    const headway_minutes = 18;
    const travel_time = 30;
    const short_layover = 10;
    const long_layover = 10;
    const max_driving_minutes = 180;
    
    const requiredBuses = 5;
    const buses = [];
    for (let i = 0; i < requiredBuses; i++) {
        let startLoc = i % 2 === 0 ? 'A' : 'B';
        let aIndex = Math.floor(i / 2);
        let bIndex = Math.floor((i - 1) / 2);
        if(i % 2 === 1) bIndex = Math.floor(i / 2); 
        let startTime = startLoc === 'A' ? startMin + (aIndex * headway_minutes) : startMin + 30 + (bIndex * headway_minutes);
        buses.push({ id: i + 1, startLoc, startTime });
    }

    let totalTrips = 0;
    buses.forEach(bus => {
        let currentLoc = bus.startLoc;
        let currentTime = bus.startTime;
        let drivingSinceRest = 0;
        let trips = 0;
        
        while (currentTime <= endMin) {
            if (currentLoc === 'A' && currentTime > endMin - 60) {
                break; 
            }
            
            let arrTime = currentTime + travel_time;
            trips++;
            totalTrips++;
            
            drivingSinceRest += travel_time;
            let layover = short_layover;
            if (drivingSinceRest >= max_driving_minutes) {
                layover = long_layover;
                drivingSinceRest = 0;
            }
            currentLoc = currentLoc === 'A' ? 'B' : 'A';
            currentTime = arrTime + layover;
        }
        
        if (trips > 0) {
            if (currentLoc === 'B') {
                trips++;
                totalTrips++;
            }
        }
    });
    console.log("Total trips:", totalTrips);
}
simulate();
