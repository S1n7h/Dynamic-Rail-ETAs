const mongoose = require("mongoose");

const locationSchema = new mongoose.Schema({

    // =========================================
    // GPS LOCATION
    // =========================================

    location: {
        type: {
            type: String,
            enum: ["Point"],
            required: true
        },

        coordinates: {
            type: [Number],
            required: true
        }
    },


    // =========================================
    // ADDRESS INFORMATION
    // =========================================

    address: {
        type: String,
        default: null
    },

    address2: {
        type: String,
        default: null
    },

    city: {
        type: String,
        default: null
    },

    state: {
        type: String,
        default: null
    },

    country: {
        type: String,
        default: null
    },


    // =========================================
    // GPS TIMESTAMP
    // =========================================

    gpsTimestamp: {
        type: Number,
        required: true
    },


    // =========================================
    // CELL TOWER INFORMATION
    // =========================================

    cellTowers: [
        {
            registered: {
                type: Boolean,
                default: null
            },

            mcc: {
                type: String,
                default: null
            },

            mnc: {
                type: String,
                default: null
            },

            cellId: {
                type: Number,
                default: null
            },

            tac: {
                type: Number,
                default: null
            },

            pci: {
                type: Number,
                default: null
            },

            rsrp: {
                type: Number,
                default: null
            },

            rsrq: {
                type: Number,
                default: null
            },

            rssnr: {
                type: Number,
                default: null
            },

            // Time when this cell tower
            // information was fetched

            timestamp: {
                type: Number,
                required: true
            }
        }
    ],


    // =========================================
    // SOURCE LOG
    // =========================================

    sourceFile: {
        type: String,
        default: null
    },


    // =========================================
    // DATABASE TIMESTAMP
    // =========================================

    createdAt: {
        type: Date,
        default: Date.now
    }

});


// =========================================
// GEOSPATIAL INDEX
// =========================================

locationSchema.index({
    location: "2dsphere"
});


module.exports = mongoose.model(
    "Location",
    locationSchema
);