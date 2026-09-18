const path = require("path");
const express = require("express");

const {
    getLiveTrain,
    addDelay,
    resetSimulation
} = require("../services/simulationService");

const router = express.Router();

// --------------------------------------------------
// POST /hello
// Test Run
// --------------------------------------------------

router.get("/:something", (req, res) => {
    try {
        res.json({
            message: req.params.something
        });
    } catch (e) {
        console.error(e);

        res.status(500).json({
            error: e.message
        });
    }
});


// --------------------------------------------------
// POST /location/23.2313213/34.23133213 ie /location/latitude/longitude
// Test Run
// --------------------------------------------------

router.get("/location/:latitude/:longitude", async (req, res) => {
    const lat1 = Number(req.params.latitude);
    const long1 = Number(req.params.longitude);

    //This imports your Mongoose model.
    const Location = require("../Dtos/Location.js");
    require("dotenv").config({    
        //_dirname is D:\D\railpull-main\backend\scripts    
        //it changes to D:\D\railpull-main\backend\.env after the following piece of code
        path: path.join(__dirname, "../.env")
    });

    //This imports your database connection function.
    //the database.js is responsible for actually establishing the connection between Node.js and MongoDB.
    const connectDatabase = require("../config/database");
    await connectDatabase();
    let lat2;
    let long2;
    let useGeoApify = false;
        try{
            const Data = await Location.findOne({
                location: {
                    $near: {
                        $geometry: {
                            type: "Point",
                            coordinates: [long1, lat1]
                        }
                    }
                }
            });
            if (Data != null){                
                //mongoose stores longitude,latitude
                lat2 = Data.location.coordinates[1];
                long2 = Data.location.coordinates[0];
                const {distanceInMeters} = require(`../scripts/analyzeCellGpsTiming.js`);
                const distanceBetweenCoordinates = distanceInMeters(lat1, long1, lat2, long2);
                if (distanceBetweenCoordinates > 50){
                    useGeoApify = true;
                }
            }else{
                useGeoApify = false;
            }
            if (useGeoApify){
                try{                    
                    const response = await fetch(
                        `https://api.geoapify.com/v1/geocode/reverse?lat=${lat1}&lon=${long1}&apiKey=${process.env.GEOAPIFY_API_KEY}`
                    );
                    const data = await response.json();
                    const state = data["features"]["0"]["properties"]["state"];
                    const city = data["features"]["0"]["properties"]["city"];
                    const address1 = data["features"]["0"]["properties"]["address_line1"];
                    const address2 = data["features"]["0"]["properties"]["address_line2"];
                    
                    console.log("Used GEOAPIFY.");
                    res.json({
                        state: state,
                        city: city,
                        address1: address1,
                        address2: address2
                    }); 
                }catch(e){
                    console.log(e);
                    res.status(500).json({
                        error: "Geoapify request failed"
                    });
                }
            }else{
                console.log("USED MONGO DB.");
                    res.json({
                    state: Data.state,
                    city: Data.city,
                    address1: Data.address,
                    address2: Data.address2
                }); 
            }
        }catch(e){
            console.log(e);
            res.status(500).json({
                error: "Something went wrong"
            });
        }          
});

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