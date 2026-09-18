const connectDatabase = require("./config/database");
const express = require("express");
const cors = require("cors");

const trainEndpoints = require("./Endpoints/trainEndpoints");

const app = express();

const PORT = 6769;

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
    res.send("Backend is working!");
});

//Whenever a request comes into the server, allow trainEndpoints to handle matching routes.
app.use("/", trainEndpoints);

async function startServer() {
    await connectDatabase();

    app.listen(PORT, "0.0.0.0", () => {
        console.log(`Server running at http://localhost:${PORT}`);
    });
}

startServer();