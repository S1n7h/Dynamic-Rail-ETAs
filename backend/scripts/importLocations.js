const fs = require("fs");
const path = require("path");
const readline = require("readline");

require("dotenv").config({
    path: path.join(__dirname, "../.env")
});

const connectDatabase = require("../config/database");
const Location = require("../Dtos/Location.js");


// =========================================
// CONFIGURATION
// =========================================

const LOGS_FOLDER = path.join(__dirname, "../logs");

const DATA_FOLDER = path.join(__dirname, "../Data");

const DATA_FILE = path.join(
    DATA_FOLDER,
    "compiled_locations.json"
);

const LOG_FILE = path.join(
    DATA_FOLDER,
    "importLocations.log"
);

const CACHE_RADIUS = 50; // metres

// A cell observation can be associated with GPS
// observations within this time window.
const TIMESTAMP_WINDOW = 3000; // milliseconds

const API_DELAY = 100;


// =========================================
// DISTANCE FUNCTION
// =========================================

function distanceInMeters(lat1, lon1, lat2, lon2) {

    const R = 6371000;

    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;

    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * Math.PI / 180) *
        Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) ** 2;

    const c =
        2 * Math.atan2(
            Math.sqrt(a),
            Math.sqrt(1 - a)
        );

    return R * c;
}


// =========================================
// READ ALL LOG FILES
// =========================================

function readAllLogs() {

    const files = fs.readdirSync(LOGS_FOLDER)
        .filter(file => file.endsWith(".json"));

    const allData = [];

    for (const file of files) {

        const filePath = path.join(
            LOGS_FOLDER,
            file
        );

        try {

            const data = JSON.parse(
                fs.readFileSync(
                    filePath,
                    "utf8"
                )
            );

            allData.push({

                file,

                observations:
                    data.observations || []

            });

        } catch (error) {

            console.error(
                `Could not read ${file}:`,
                error.message
            );

        }
    }

    return allData;
}


// =========================================
// CELL TOWER ID
// =========================================

function towerKey(tower) {

    return [
        tower.mcc,
        tower.mnc,
        tower.cellId,
        tower.tac
    ].join("-");
}


// =========================================
// CORRELATE GPS AND CELL OBSERVATIONS
// =========================================

function compileObservations(logs) {

    const compiled = [];

    let totalGPSPoints = 0;
    let totalCellObservations = 0;
    let assignedCellObservations = 0;

    for (const log of logs) {

        const gpsPoints = [];
        const cellObservations = [];

        for (const observation of log.observations) {

            // -----------------------------
            // GPS
            // -----------------------------

            if (observation.gps) {

                gpsPoints.push({

                    timestamp:
                        observation.gps.timestamp,

                    latitude:
                        observation.gps.latitude,

                    longitude:
                        observation.gps.longitude

                });

            }


            // -----------------------------
            // CELL TOWERS
            // -----------------------------

            if (
                observation.cellTowers &&
                Array.isArray(observation.cellTowers)
            ) {

                cellObservations.push({

                    timestamp:
                        observation.cellTimestamp,

                    cellTowers:
                        observation.cellTowers

                });

                totalCellObservations +=
                    observation.cellTowers.length;

            }
        }

        totalGPSPoints += gpsPoints.length;


        // =====================================
        // MATCH GPS WITH CELL OBSERVATIONS
        // =====================================

        for (const gps of gpsPoints) {

            const towersForGPS = [];

            for (const cellObservation of cellObservations) {

                if (!cellObservation.timestamp) {
                    continue;
                }

                const timeDifference =
                    Math.abs(
                        gps.timestamp -
                        cellObservation.timestamp
                    );

                if (
                    timeDifference >
                    TIMESTAMP_WINDOW
                ) {
                    continue;
                }


                for (
                    const tower
                    of cellObservation.cellTowers
                ) {

                    const key = towerKey(tower);

                    const alreadyIncluded =
                        towersForGPS.some(
                            existing =>
                                existing.key === key &&
                                existing.timestamp ===
                                    cellObservation.timestamp
                        );

                    if (alreadyIncluded) {
                        continue;
                    }


                    towersForGPS.push({

                        key,

                        registered:
                            tower.registered ?? null,

                        mcc:
                            tower.mcc ?? null,

                        mnc:
                            tower.mnc ?? null,

                        cellId:
                            tower.cellId ?? null,

                        tac:
                            tower.tac ?? null,

                        pci:
                            tower.pci ?? null,

                        rsrp:
                            tower.rsrp ?? null,

                        rsrq:
                            tower.rsrq ?? null,

                        rssnr:
                            tower.rssnr ?? null,

                        // Time when this cell-tower
                        // information was fetched

                        timestamp:
                            cellObservation.timestamp

                    });

                    assignedCellObservations++;
                }
            }


            compiled.push({

                sourceFile:
                    log.file,

                gpsTimestamp:
                    gps.timestamp,

                location: {

                    type: "Point",

                    coordinates: [

                        gps.longitude,
                        gps.latitude

                    ]

                },

                latitude:
                    gps.latitude,

                longitude:
                    gps.longitude,

                cellTowers:
                    towersForGPS.map(tower => {

                        const {
                            key,
                            ...cleanTower
                        } = tower;

                        return cleanTower;

                    })

            });
        }
    }


    return {

        compiled,

        totalGPSPoints,

        totalCellObservations,

        assignedCellObservations

    };
}


// =========================================
// UNIQUE CELL TOWER STATISTICS
// =========================================

function calculateTowerStatistics(compiled) {

    const towerCoordinates = new Map();

    for (const record of compiled) {

        for (const tower of record.cellTowers) {

            const key = towerKey(tower);

            if (!towerCoordinates.has(key)) {

                towerCoordinates.set(
                    key,
                    []
                );

            }

            const coordinates =
                towerCoordinates.get(key);


            const alreadyExists =
                coordinates.some(
                    coordinate =>
                        distanceInMeters(

                            coordinate.latitude,
                            coordinate.longitude,

                            record.latitude,
                            record.longitude

                        ) < 1
                );


            if (!alreadyExists) {

                coordinates.push({

                    latitude:
                        record.latitude,

                    longitude:
                        record.longitude

                });

            }
        }
    }


    let totalAssignments = 0;

    for (
        const coordinates
        of towerCoordinates.values()
    ) {

        totalAssignments +=
            coordinates.length;

    }


    return {

        uniqueCellTowers:
            towerCoordinates.size,

        totalTowerCoordinateAssignments:
            totalAssignments,

        towerCoordinates

    };
}


// =========================================
// SELECT GPS POINTS REQUIRING GEOCODING
// =========================================

function selectGeocodingPoints(compiled) {

    const selectedPoints = [];

    for (const record of compiled) {

        const nearbyPoint =
            selectedPoints.find(

                selected =>
                    distanceInMeters(

                        selected.latitude,
                        selected.longitude,

                        record.latitude,
                        record.longitude

                    ) <= CACHE_RADIUS

            );


        if (!nearbyPoint) {

            selectedPoints.push({

                latitude:
                    record.latitude,

                longitude:
                    record.longitude

            });

        }
    }


    return selectedPoints;
}

function log(message) {

    const timestamp =
        new Date().toISOString();

    const line =
        `[${timestamp}] ${message}`;

    console.log(line);

    fs.mkdirSync(
        DATA_FOLDER,
        {
            recursive: true
        }
    );

    fs.appendFileSync(
        LOG_FILE,
        line + "\n",
        "utf8"
    );
}

// =========================================
// REVERSE GEOCODING
// =========================================

async function reverseGeocode(
    latitude,
    longitude
) {

    const url =
        `https://api.geoapify.com/v1/geocode/reverse` +
        `?lat=${latitude}` +
        `&lon=${longitude}` +
        `&apiKey=${process.env.GEOAPIFY_API_KEY}`;


    const response =
        await fetch(url);


    if (!response.ok) {

        throw new Error(
            `Geoapify returned ${response.status}`
        );

    }


    const data =
        await response.json();


    const properties =
        data.features?.[0]?.properties;


    if (!properties) {

        return null;

    }


    return {

        address:
            properties.address_line1 || null,

        address2:
            properties.address_line2 || null,

        city:
            properties.city || null,

        state:
            properties.state || null,

        country:
            properties.country || null

    };
}


// =========================================
// DELAY
// =========================================

function sleep(milliseconds) {

    return new Promise(
        resolve =>
            setTimeout(
                resolve,
                milliseconds
            )
    );

}


// =========================================
// USER CONFIRMATION
// =========================================

function askConfirmation(question) {

    const rl =
        readline.createInterface({

            input:
                process.stdin,

            output:
                process.stdout

        });


    return new Promise(resolve => {

        rl.question(
            question,
            answer => {

                rl.close();

                resolve(
                    answer
                        .trim()
                        .toLowerCase() === "yes"
                );

            }
        );

    });
}


// =========================================
// SAVE LOCAL JSON FILE
// =========================================

function saveLocalData(compiled) {

    // Create Data folder if it does not exist

    fs.mkdirSync(
        DATA_FOLDER,
        {
            recursive: true
        }
    );


    fs.writeFileSync(

        DATA_FILE,

        JSON.stringify(
            {
                generatedAt:
                    new Date().toISOString(),

                totalRecords:
                    compiled.length,

                records:
                    compiled
            },

            null,
            2
        ),

        "utf8"

    );


    console.log(
        `\nLocal data saved to:`
    );

    console.log(
        DATA_FILE
    );
}


// =========================================
// GEOCODE AND SAVE
// =========================================

async function geocodeAndSave(
    compiled,
    geocodingPoints
) {

    const addressCache = [];

    let geocodedCount = 0;
    let cachedCount = 0;
    let failedCount = 0;


    // =====================================
    // GEOCODING
    // =====================================

    for (
        let i = 0;
        i < geocodingPoints.length;
        i++
    ) {

        const point =
            geocodingPoints[i];


        log(
            `[GEOCODE ${i + 1}/${geocodingPoints.length}] ` +
            `Coordinates: ` +
            `${point.latitude}, ${point.longitude}`
        );


        let address = null;


        const nearbyAddress =
            addressCache.find(

                cached =>
                    distanceInMeters(

                        cached.latitude,
                        cached.longitude,

                        point.latitude,
                        point.longitude

                    ) <= CACHE_RADIUS

            );


        if (nearbyAddress) {

            address =
                nearbyAddress.address;

            cachedCount++;

        }

        else {

            try {

                address = await reverseGeocode(
                        point.latitude,
                        point.longitude
                    );

                    if (address) {
                        log(
                            `[GEOCODE ${i + 1}/${geocodingPoints.length}] ` +
                            `SUCCESS - ` +
                            `${address.address || "No address"}`
                        );

                    } else {

                        log(
                            `[GEOCODE ${i + 1}/${geocodingPoints.length}] ` +
                            `SUCCESS - No address returned`
                        );
                    }


                addressCache.push({

                    latitude:
                        point.latitude,

                    longitude:
                        point.longitude,

                    address

                });


                geocodedCount++;

                await sleep(
                    API_DELAY
                );

            }

            catch (error) {

                log(
                    `[GEOCODE ${i + 1}/${geocodingPoints.length}] ` +
                    `FAILED - ${error.message}`
                );

                failedCount++;

            }
        }


        point.address =
            address;

    }


    // =====================================
    // ASSIGN ADDRESSES
    // =====================================

    for (
        const record
        of compiled
    ) {

        const nearestAddress =
            addressCache.find(

                cached =>
                    distanceInMeters(

                        cached.latitude,
                        cached.longitude,

                        record.latitude,
                        record.longitude

                    ) <= CACHE_RADIUS

            );


        if (nearestAddress) {

            record.address =
                nearestAddress.address;

        }

        else {

            record.address =
                null;

        }
    }


    // =====================================
    // SAVE LOCAL COPY
    // =====================================

    console.log(
        "\nSaving local JSON copy..."
    );

    saveLocalData(
        compiled
    );


    // =====================================
    // SAVE TO MONGODB
    // =====================================

    log(
        "\nSaving records to MongoDB..."
    );


    let savedCount = 0;


    for (let i = 0; i < compiled.length; i++) {

    const record = compiled[i];

        try {

            await Location.create({

                location:
                    record.location,

                address:
                    record.address?.address ||
                    null,

                address2:
                    record.address?.address2 ||
                    null,

                city:
                    record.address?.city ||
                    null,

                state:
                    record.address?.state ||
                    null,

                country:
                    record.address?.country ||
                    null,

                gpsTimestamp:
                    record.gpsTimestamp,

                cellTowers:
                    record.cellTowers,

                sourceFile:
                    record.sourceFile

            });


            savedCount++;

            
            log(
                `[MONGODB ${i + 1}/${compiled.length}] ` +
                `SAVED - GPS ${record.gpsTimestamp}`
            );

        }

        catch (error) {

            log(
                `[MONGODB ${i + 1}/${compiled.length}] ` +
                `FAILED - GPS ${record.gpsTimestamp} - ` +
                `${error.message}`
            );

        }
    }


    return {

        geocodedCount,

        cachedCount,

        failedCount,

        savedCount

    };
}


// =========================================
// MAIN
// =========================================

async function main() {
    fs.mkdirSync(
        DATA_FOLDER,
        {
            recursive: true
        }
    );

    fs.writeFileSync(
        LOG_FILE,
        "",
        "utf8"
    );
    
    console.log(
        "Reading all log files...\n"
    );


    const logs =
        readAllLogs();


    console.log(
        "Log files found:",
        logs.length
    );


    const {

        compiled,

        totalGPSPoints,

        totalCellObservations,

        assignedCellObservations

    } =
        compileObservations(
            logs
        );


    const towerStats =
        calculateTowerStatistics(
            compiled
        );


    const geocodingPoints =
        selectGeocodingPoints(
            compiled
        );


    // =====================================
    // PRINT ANALYSIS
    // =====================================

    console.log(
        "\n========================================="
    );

    console.log(
        "          DATA ANALYSIS"
    );

    console.log(
        "=========================================\n"
    );


    console.log(
        "Log files:",
        logs.length
    );


    console.log(
        "Total GPS points:",
        totalGPSPoints
    );


    console.log(

        "Total cell-tower observations:",

        totalCellObservations

    );


    console.log(

        "Cell observations assigned to GPS points:",

        assignedCellObservations

    );


    console.log(

        "Unique cell towers:",

        towerStats.uniqueCellTowers

    );


    console.log(

        "Total tower-coordinate assignments:",

        towerStats.totalTowerCoordinateAssignments

    );


    console.log(

        "GPS coordinates requiring geocoding:",

        geocodingPoints.length

    );


    console.log(

        "Estimated Geoapify requests:",

        geocodingPoints.length

    );


    console.log(
        "\n=========================================\n"
    );


    // =====================================
    // CONFIRMATION
    // =====================================

    const confirmed =
        await askConfirmation(

            "Start Geoapify geocoding and database import? Type 'yes': "

        );


    if (!confirmed) {

        console.log(

            "\nCancelled." +
            " No API requests or database changes were made."

        );

        process.exit(0);

    }


    // =====================================
    // CHECK API KEY
    // =====================================

    if (!process.env.GEOAPIFY_API_KEY) {

        console.error(

            "GEOAPIFY_API_KEY is missing from .env"

        );

        process.exit(1);

    }


    // =====================================
    // CONNECT DATABASE
    // =====================================

    await connectDatabase();


    // =====================================
    // GEOCODE + SAVE
    // =====================================

    const result =
        await geocodeAndSave(

            compiled,
            geocodingPoints

        );


    // =====================================
    // FINAL RESULTS
    // =====================================

    console.log(
        "\n========================================="
    );

    console.log(
        "          IMPORT COMPLETE"
    );

    console.log(
        "=========================================\n"
    );


    console.log(
        "Geocoded points:",
        result.geocodedCount
    );


    console.log(
        "Cached points:",
        result.cachedCount
    );


    console.log(
        "Failed geocoding:",
        result.failedCount
    );


    console.log(
        "Saved database records:",
        result.savedCount
    );


    console.log(
        "\nLocal file:"
    );

    console.log(
        DATA_FILE
    );


    console.log(
        "\n=========================================\n"
    );


    process.exit(0);
}


main();