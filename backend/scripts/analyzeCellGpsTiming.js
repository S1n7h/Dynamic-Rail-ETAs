const fs = require("fs");
const path = require("path");


// =========================================
// CONFIGURATION
// =========================================

const LOGS_FOLDER = path.join(__dirname, "../logs");


// =========================================
// DISTANCE
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
// READ LOGS
// =========================================

function readLogs() {

    const files = fs.readdirSync(LOGS_FOLDER)
        .filter(file => file.endsWith(".json"));

    const logs = [];

    for (const file of files) {

        const filePath =
            path.join(LOGS_FOLDER, file);

        try {

            const data =
                JSON.parse(
                    fs.readFileSync(
                        filePath,
                        "utf8"
                    )
                );

            logs.push({
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

    return logs;
}


// =========================================
// PERCENTILE
// =========================================

function percentile(values, p) {

    if (values.length === 0) {
        return null;
    }

    const sorted = [...values].sort(
        (a, b) => a - b
    );

    const index =
        (sorted.length - 1) * p;

    const lower =
        Math.floor(index);

    const upper =
        Math.ceil(index);

    if (lower === upper) {
        return sorted[lower];
    }

    return (
        sorted[lower] +
        (sorted[upper] - sorted[lower]) *
        (index - lower)
    );
}


// =========================================
// SUMMARY
// =========================================

function summarize(name, values) {

    if (values.length === 0) {

        console.log(
            `\n${name}: no data`
        );

        return;
    }

    console.log(`\n${name}`);
    console.log("-----------------------------------------");

    console.log(
        "Count:",
        values.length
    );

    console.log(
        "Minimum:",
        values[0].toFixed(2)
    );

    console.log(
        "Median:",
        percentile(values, 0.50).toFixed(2)
    );

    console.log(
        "P75:",
        percentile(values, 0.75).toFixed(2)
    );

    console.log(
        "P90:",
        percentile(values, 0.90).toFixed(2)
    );

    console.log(
        "P95:",
        percentile(values, 0.95).toFixed(2)
    );

    console.log(
        "P99:",
        percentile(values, 0.99).toFixed(2)
    );

    console.log(
        "Maximum:",
        values[values.length - 1].toFixed(2)
    );
}


// =========================================
// MAIN ANALYSIS
// =========================================

function main() {

    const logs = readLogs();

    console.log(
        "========================================="
    );

    console.log(
        "       GPS / CELL TIMING ANALYSIS"
    );

    console.log(
        "=========================================\n"
    );

    console.log(
        "Log files:",
        logs.length
    );


    const timestampDifferences = [];

    const gpsIntervals = [];

    const cellIntervals = [];

    const movementDistances = [];


    let totalGPS = 0;
    let totalCellObservations = 0;


    // =====================================
    // PROCESS EACH LOG
    // =====================================

    for (const log of logs) {

        const gpsPoints = [];
        const cellPoints = [];


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
            // CELL
            // -----------------------------

            if (
                observation.cellTowers &&
                Array.isArray(
                    observation.cellTowers
                )
            ) {

                cellPoints.push({

                    timestamp:
                        observation.cellTimestamp,

                    towers:
                        observation.cellTowers

                });

                totalCellObservations +=
                    observation.cellTowers.length;
            }
        }


        totalGPS += gpsPoints.length;


        // =================================
        // GPS INTERVALS
        // =================================

        for (let i = 1; i < gpsPoints.length; i++) {

            const previous =
                gpsPoints[i - 1];

            const current =
                gpsPoints[i];

            const timeDifference =
                current.timestamp -
                previous.timestamp;

            if (timeDifference >= 0) {

                gpsIntervals.push(
                    timeDifference
                );


                const distance =
                    distanceInMeters(

                        previous.latitude,
                        previous.longitude,

                        current.latitude,
                        current.longitude

                    );

                movementDistances.push({

                    time:
                        timeDifference,

                    distance
                });
            }
        }


        // =================================
        // CELL INTERVALS
        // =================================

        for (let i = 1; i < cellPoints.length; i++) {

            const timeDifference =
                cellPoints[i].timestamp -
                cellPoints[i - 1].timestamp;

            if (timeDifference >= 0) {

                cellIntervals.push(
                    timeDifference
                );
            }
        }


        // =================================
        // GPS ↔ CELL TIMING
        // =================================

        for (const gps of gpsPoints) {

            let nearestDifference =
                Infinity;

            for (const cell of cellPoints) {

                const difference =
                    Math.abs(
                        gps.timestamp -
                        cell.timestamp
                    );

                if (
                    difference <
                    nearestDifference
                ) {

                    nearestDifference =
                        difference;
                }
            }


            if (
                nearestDifference !==
                Infinity
            ) {

                timestampDifferences.push(
                    nearestDifference
                );
            }
        }
    }


    // =====================================
    // SORT
    // =====================================

    timestampDifferences.sort(
        (a, b) => a - b
    );

    gpsIntervals.sort(
        (a, b) => a - b
    );

    cellIntervals.sort(
        (a, b) => a - b
    );


    // =====================================
    // OUTPUT
    // =====================================

    console.log(
        "\n========================================="
    );

    console.log(
        "              TOTALS"
    );

    console.log(
        "=========================================\n"
    );

    console.log(
        "GPS points:",
        totalGPS
    );

    console.log(
        "Cell tower observations:",
        totalCellObservations
    );


    // =====================================
    // TIMING
    // =====================================

    summarize(
        "Nearest GPS ↔ Cell timestamp difference (ms)",
        timestampDifferences
    );

    summarize(
        "GPS observation interval (ms)",
        gpsIntervals
    );

    summarize(
        "Cell observation interval (ms)",
        cellIntervals
    );


    // =====================================
    // MATCHING WINDOWS
    // =====================================

    console.log(
        "\n========================================="
    );

    console.log(
        "       GPS ↔ CELL MATCHING WINDOWS"
    );

    console.log(
        "=========================================\n"
    );


    const windows = [
        1000,
        2000,
        3000,
        5000,
        10000,
        15000,
        30000
    ];


    for (const window of windows) {

        const matched =
            timestampDifferences.filter(
                difference =>
                    difference <= window
            ).length;

        const percentage =
            (
                matched /
                timestampDifferences.length
            ) * 100;

        console.log(

            `±${window / 1000}s:`,

            `${matched}/${timestampDifferences.length}`,

            `(${percentage.toFixed(2)}%)`

        );
    }


    // =====================================
    // MOVEMENT DURING GPS INTERVALS
    // =====================================

    console.log(
        "\n========================================="
    );

    console.log(
        "       MOVEMENT BETWEEN GPS POINTS"
    );

    console.log(
        "=========================================\n"
    );


    const movementByWindow = [
        1000,
        2000,
        3000,
        5000,
        10000
    ];


    for (const window of movementByWindow) {

        const distances =
            movementDistances

                .filter(
                    item =>
                        item.time <= window
                )

                .map(
                    item =>
                        item.distance
                );


        if (distances.length === 0) {
            continue;
        }


        distances.sort(
            (a, b) => a - b
        );


        console.log(
            `GPS intervals ≤ ${window / 1000}s:`
        );

        console.log(
            "  Count:",
            distances.length
        );

        console.log(
            "  Median distance:",
            percentile(
                distances,
                0.50
            ).toFixed(2),
            "m"
        );

        console.log(
            "  P90 distance:",
            percentile(
                distances,
                0.90
            ).toFixed(2),
            "m"
        );

        console.log(
            "  Maximum distance:",
            distances[
                distances.length - 1
            ].toFixed(2),
            "m"
        );
    }


    console.log(
        "\n=========================================\n"
    );
}


module.exports = {
    distanceInMeters
};

//Importing distanceInMeters into celltowercheck.js → exports the function without calling main().
if (require.main === module) {
    main();
}
