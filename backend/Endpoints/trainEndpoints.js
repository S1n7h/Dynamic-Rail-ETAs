const express = require("express");

const {
    getLiveTrain,
    addDelay,
    resetSimulation
} = require("../services/simulationService");

const router = express.Router();

// --------------------------------------------------
// POST /:trainNumber/reset
// Reset the current simulation
// --------------------------------------------------

router.post("/:trainNumber/reset", (req, res) => {

    const trainNumber = req.params.trainNumber;

    try {
        resetSimulation(trainNumber);

        res.json({
            trainNumber,
            message: "Simulation reset successfully"
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            error: error.message
        });
    }
});

// --------------------------------------------------
// GET /:trainNumber
// Get the current simulated train state
// --------------------------------------------------

router.get("/:trainNumber", async (req, res) => {
    const trainNumber = req.params.trainNumber;
    try {
        //wait for "../services/simulationService to give an output"
        const train = await getLiveTrain(trainNumber);
        res.json(train);
    } catch (error) {
        console.error(error);
        res.status(404).json({
            error: error.message,
            train: trainNumber
        });
    }
});


// --------------------------------------------------
// POST /:trainNumber/:station
// Inject a delay at a station
// --------------------------------------------------

router.post(
    "/:trainNumber/:station",
    async (req, res) => {
        //request looks like this
        // POST http://localhost:6769/12301/ASN
        // Content-Type: application/json
        // {
        //     "delay": 20,
        //      stationDelays: [station1: delay, station2: delay...]
        // }

        const trainNumber = req.params.trainNumber;
        const station = req.params.station.toUpperCase();
        const delay = Number(req.body.delay);
        
        // Validate delay
        if (Number.isNaN(delay)) {
            return res.status(400).json({
                error: "Delay must be a number"
            });
        }
        try {
            const result = await addDelay(trainNumber, station, delay);
            //result looks like this
            // return {
            //     trainNumber,
            //     station: stationCode,
            //     delay: delayMinutes
            // };
            res.json(result);
        } catch (error) {
            console.error(error);
            res.status(404).json({
                error: error.message
            });
        }
    }
);

module.exports = router;