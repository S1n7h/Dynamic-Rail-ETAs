const { getTrainData } = require("./trainService");

const simulations = new Map();

// Simulation speed:
// 1 real second = 1 simulated minute
const SIMULATION_MINUTES_PER_SECOND = 1;


// --------------------------------------------------
// Convert "16:50" -> minutes since midnight
// --------------------------------------------------
function timeToMinutes(time) {

    if (!time || time === "Source") {
        return null;
    }

    const [hours, minutes] = time.split(":").map(Number);

    return hours * 60 + minutes;
}

function addMinutesToTime(timeString, minutes) {
    if (!timeString || timeString === "Source") {
        return timeString;
    }

    const [hours, mins] = timeString.split(":").map(Number);

    const totalMinutes =
        hours * 60 +
        mins +
        minutes;

    const adjustedMinutes =
        ((totalMinutes % 1440) + 1440) % 1440;

    const newHours =
        Math.floor(adjustedMinutes / 60);

    const newMinutes =
        adjustedMinutes % 60;

    return `${String(newHours).padStart(2, "0")}:${String(newMinutes).padStart(2, "0")}`;
}

// --------------------------------------------------
// Get simulated time
// --------------------------------------------------
function getSimulationTime(simulation) {

    const realElapsedSeconds =
        (Date.now() - simulation.startedAt) / 1000;

    return simulation.startTime +
        (realElapsedSeconds * SIMULATION_MINUTES_PER_SECOND);
}

// --------------------------------------------------
// Add a delay at a station
// --------------------------------------------------
async function addDelay(trainNumber, stationCode, delayMinutes) {
    //simulation looks like this
    //{
    //     trainNumber: "12301",
    //     startedAt: Date.now(),
    //     startTime: 1010,
    //     currentDistance: 0,
    //     currentStation: "HWH",
    //     currentDelay: 0,
    //     lastUpdated: Date.now()
    // }
    const simulation = await startSimulation(trainNumber);

    const trainData = await getTrainData(trainNumber);
    //trainData looks like this
    // {
    // "date": "27-Aug-2026",
    // "train": "12001",
    // "stations": {
    //     "RKMP": {
    //     "distance": 0,
    //     "arrival_time": "Source",
    //     "departure_time": "15:10",
    //     "arrival_delay": null,
    //     "departure_delay": 0
    //     },
    //     "BPL": {
    //     "distance": 6,
    //     "arrival_time": "15:22",
    //     "departure_time": "15:25",
    //     "arrival_delay": 0,
    //     "departure_delay": 0
    //     },

    const station = trainData.stations[stationCode];

    if (!station) {
        throw new Error(
            `Station ${stationCode} not found`
        );
    }

    //Check whether the current station has been passed or not. If it has been passed,
    //don't add it to the global delay and return a response
    if (station.distance < simulation.currentDistance) {
        return {
            trainNumber,
            station: stationCode,
            message: "Station has already been passed. Delay ignored.",
            globalDelay: simulation.currentDelay,
            stationDelays: simulation.delays || {}
        };
    }

    // Store the delay against this station
    if (!simulation.delays) {
        simulation.delays = {};
    }

    let delayToAddToStations = 0;
    //if updating an already stored delay at a specific station, first check whether its valid then change value of that and update 
    //global delay by the difference
    if (Object.hasOwn(simulation.delays, stationCode)){
        simulation.currentDelay += (delayMinutes - simulation.delays[stationCode]); 
        delayToAddToStations = delayMinutes - simulation.delays[stationCode]       
    }
    //otherwise, create new index and add new delay to global index
    else{
        // Current delay becomes the injected delay
        simulation.currentDelay += delayMinutes;
        delayToAddToStations = delayMinutes;
    }
    simulation.delays[stationCode] = delayMinutes;

    //now we iterate through the rest of the stations present and add the delay changes to them
    //we also need to change their expected arrival and departure time
    //expected arrival will be their actual arrival time + delay
    //departure time will be the same ie departure time + delay

    const stationList = getStationList(trainData.stations);
    const stationIndex = stationList.findIndex(station => station.code === stationCode);

    //start from target station all the way to the end station.
    for (let i = stationIndex; i < stationList.length; i++) {
        const station = stationList[i];
        
        //add delay to expected arrival time and expected departure time
        let expectedArrivalTime = simulation.stationData[station.code].expectedArrivalTime;

        let expectedDepartureTime = simulation.stationData[station.code].expectedDepartureTime;

        simulation.stationData[station.code].expectedArrivalTime = addMinutesToTime(expectedArrivalTime, delayToAddToStations);

        simulation.stationData[station.code].expectedDepartureTime = addMinutesToTime(expectedDepartureTime, delayToAddToStations);

        simulation.stationData[station.code].delay += delayToAddToStations;       
    }

    return {
        trainNumber,
        station: stationCode,
        globalDelay: simulation.currentDelay,
        stationDelays: simulation.delays
    };
}


// --------------------------------------------------
// Get all stations as an array
// --------------------------------------------------
function getStationList(stations) {

    return Object.entries(stations)
        .map(([code, station]) => ({
            code,
            ...station
        }))
        .filter(station =>
            station.distance !== undefined
        )
        //sort function might not be needed since data is already sorted out
        .sort((a, b) =>
            a.distance - b.distance
        );
}

function printStationEtas(simulation, trainData) {
    const result = {};

    for (const [stationCode, station] of Object.entries(trainData.stations)) {

        result[stationCode] = {
            distance: station.distance,
            scheduledArrival: station.arrival_time,
            scheduledDeparture: station.departure_time,
            predictedArrival: simulation.stationData[stationCode].expectedArrivalTime,
            predictedDeparture: simulation.stationData[stationCode].expectedDepartureTime,
            delay: simulation.stationData[stationCode].delay
        };
    }

    return result;
}

// --------------------------------------------------
// Find the train's position between two stations
// --------------------------------------------------
//no problem, this only changes the last visited station and the distance travelled by the train.
function calculatePosition(stations, simulatedTime) {

    const stationList = getStationList(stations);

    if (stationList.length === 0) {
        throw new Error("No station data available");
    }


    // ----------------------------------------------
    // Before the journey starts
    // ----------------------------------------------

    const firstStation = stationList[0];

    const firstDeparture = timeToMinutes(firstStation.departure_time);

    if (
        firstDeparture !== null && simulatedTime < firstDeparture
    ) {

        return {
            currentStation: firstStation.code,
            currentDistance: firstStation.distance
        };
    }


    // ----------------------------------------------
    // Find the current section of the journey
    // ----------------------------------------------

    for (let i = 0; i < stationList.length - 1; i++) {

        const current = stationList[i];
        const next = stationList[i + 1];

        const currentDeparture = timeToMinutes(current.departure_time);

        const nextArrival = timeToMinutes(next.arrival_time);


        if (
            currentDeparture === null ||
            nextArrival === null
        ) {
            continue;
        }

        // ------------------------------------------
        // Train has reached the next station
        // ------------------------------------------

        if (simulatedTime >= nextArrival) {
            continue;
        }


        // ------------------------------------------
        // Train is travelling between stations
        // ------------------------------------------

        const elapsed = simulatedTime - currentDeparture;

        const duration = nextArrival - currentDeparture;


        let progress = elapsed / duration;

        // Keep progress between 0 and 1
        progress = Math.max(
            0,
            Math.min(1, progress)
        );


        const distanceDifference = next.distance - current.distance;


        const currentDistance = current.distance + (distanceDifference * progress);


        return {
            currentStation: current.code,
            currentDistance
        };
    }

    // ----------------------------------------------
    // Journey has reached the final station
    // ----------------------------------------------

    const lastStation = stationList[stationList.length - 1];

    return {
        currentStation: lastStation.code,
        currentDistance: lastStation.distance
    };
}


// --------------------------------------------------
// Start a new simulation
// --------------------------------------------------
// This creates an object stored in:
// const simulations = new Map();
// {
//     trainNumber: "12301",
//     startedAt: Date.now(),
//     startTime: 1010,
//     currentDistance: 0,
//     currentStation: "HWH",
//     currentDelay: 0,
//     lastUpdated: Date.now()
// }
// This object is the current state of the simulated train.

async function startSimulation(trainNumber) {

    if (simulations.has(trainNumber)) {
        return simulations.get(trainNumber);
    }

    const trainData = await getTrainData(trainNumber);
    const stationList = getStationList(trainData.stations);

    if (stationList.length === 0) {
        throw new Error(
            "No station data available"
        );
    }
    const firstStation = stationList[0];
    const startTime = timeToMinutes(
            firstStation.departure_time
        );
    if (startTime === null) {
        throw new Error(
            "First station has no departure time"
        );
    }
    const stationData = {};

    for (const [code, station] of Object.entries(trainData.stations)) {
        stationData[code] = {
            expectedArrivalTime: station.arrival_time,
            expectedDepartureTime: station.departure_time,
            delay: 0
        };
    }

    const simulation = {
        trainNumber,
        // Real-world timestamp when
        // this simulation began
        startedAt: Date.now(),
        // Simulated clock starts at
        // the train's first departure
        startTime,
        currentDistance: firstStation.distance,
        currentStation: firstStation.code,
        currentDelay: 0,
        lastUpdated: Date.now(),
        stationData
    };


    simulations.set(
        trainNumber,
        simulation
    );


    return simulation;
}

async function getLiveTrain(trainNumber) {

    const trainData = await getTrainData(trainNumber);
    const simulation = await startSimulation(trainNumber);

    // ----------------------------------------------
    // Calculate current simulated time
    // ----------------------------------------------

    let simulatedTime = getSimulationTime(simulation);

    // ----------------------------------------------
    // Calculate train position
    // ----------------------------------------------

    const position = calculatePosition(
        trainData.stations,
        simulatedTime
    );

    // ----------------------------------------------
    // Update simulation state
    // ----------------------------------------------

    simulation.currentDistance =
        Math.round(position.currentDistance * 100) / 100;

    simulation.currentStation = position.currentStation;

    const predictedStations = printStationEtas(simulation, trainData);

    simulation.lastUpdated = Date.now();

    // ----------------------------------------------
    // Return response
    // ----------------------------------------------

    return {
        trainNumber,
        date: trainData.date,
        current: {
            trainNumber,
            currentDistance: simulation.currentDistance,
            currentStation: simulation.currentStation,
            currentDelay: simulation.currentDelay,
            lastUpdated: simulation.lastUpdated
        },
        stations: predictedStations
    };
}

function resetSimulation(trainNumber) {
    simulations.delete(trainNumber);
}

module.exports = {
    startSimulation,
    getLiveTrain,
    addDelay,
    resetSimulation
};