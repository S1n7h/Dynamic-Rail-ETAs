const trainStates = {};

function startTrainSimulation(trainNumber, stations) {
    if (trainStates[trainNumber]) {
        return;
    }

    trainStates[trainNumber] = {
        trainNumber: trainNumber,
        currentDistance: 0,
        currentDelay: 0,
        currentStation: stations[0]?.station ?? null,
        lastUpdated: Date.now()
    };

    setInterval(() => {
        updateTrain(trainNumber, stations);
    }, 1000);
}


function updateTrain(trainNumber, stations) {
    const train = trainStates[trainNumber];

    if (!train) {
        return;
    }

    // Simulate the train moving 1 km every second.
    train.currentDistance += 1;

    // Find the last station the train has passed.
    let currentStation = stations[0];

    for (const station of stations) {
        if (station.dist <= train.currentDistance) {
            currentStation = station;
        } else {
            break;
        }
    }

    train.currentStation = currentStation?.station ?? null;
    train.lastUpdated = Date.now();
}


function getTrainState(trainNumber) {
    return trainStates[trainNumber] ?? null;
}


module.exports = {
    startTrainSimulation,
    getTrainState
};