const fs = require("fs/promises");
const path = require("path");

// Stores the current simulation state of each train.
// Key = train number
const simulations = new Map();

function getTodayDateString() {
    const today = new Date();

    const day = String(today.getDate()).padStart(2, "0");

    const months = [
        "Jan", "Feb", "Mar", "Apr", "May", "Jun",
        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
    ];

    const month = months[today.getMonth()];
    const year = today.getFullYear();

    return `${day}-${month}-${year}`;
}

//just get the train data in a specific format
async function getTrainData(trainNumber) {

    const dateString = getTodayDateString();

    const filePath = path.join(
        __dirname,
        "..",
        "..",
        "python",
        "compiledraw",
        trainNumber,
        `${trainNumber}_${dateString}.json`
    );

    const fileData = await fs.readFile(filePath, "utf-8");

    return JSON.parse(fileData);
}


function createSimulation(trainNumber, trainData) {

    const stationEntries = Object.entries(trainData.stations);

    if (stationEntries.length === 0) {
        throw new Error("Train has no station data");
    }

    const firstStation = stationEntries[0];

    const simulation = {
        trainNumber: trainNumber,

        currentDistance: firstStation[1].distance,

        currentStation: firstStation[0],

        currentDelay: 0,

        lastUpdated: Date.now()
    };

    simulations.set(trainNumber, simulation);

    return simulation;
}


async function getSimulation(trainNumber) {

    let simulation = simulations.get(trainNumber);

    if (simulation) {
        return simulation;
    }

    const trainData = await getTrainData(trainNumber);

    simulation = createSimulation(trainNumber, trainData);

    return simulation;
}


module.exports = {
    getTrainData,
    getSimulation
};