import { useEffect, useState } from "react";
import "./App.css";

function App() {
    const [train, setTrain] = useState(null);
    const [error, setError] = useState(null);

    const [showDelayForm, setShowDelayForm] = useState(false);
    const [selectedStation, setSelectedStation] = useState("");
    const [delayMinutes, setDelayMinutes] = useState("");
    const [delayError, setDelayError] = useState(null);

    async function addDelay() {

      if (!selectedStation) {
          setDelayError("Please select a station.");
          return;
      }

      const delay = Number(delayMinutes);

      if (!delayMinutes || Number.isNaN(delay) || delay <= 0) {
          setDelayError("Please enter a valid delay in minutes.");
          return;
      }

      try {

          const response = await fetch(
              `http://localhost:6769/12301/${selectedStation}`,
              {
                  method: "POST",
                  headers: {
                      "Content-Type": "application/json"
                  },
                  body: JSON.stringify({
                      delay: delay
                  })
              }
          );

          const data = await response.json();

          if (!response.ok) {
              throw new Error(
                  data.error || "Failed to add delay"
              );
          }

          // Refresh train data immediately
          const trainResponse = await fetch(
              "http://localhost:6769/12301"
          );

          if (!trainResponse.ok) {
              throw new Error("Failed to fetch train");
          }

          const trainData = await trainResponse.json();

          setTrain(trainData);

          // Close form
          setShowDelayForm(false);

          // Clear form
          setSelectedStation("");
          setDelayMinutes("");
          setDelayError(null);

      } catch (error) {

          console.error(error);
          setDelayError(error.message);
      }
    }
    
    async function resetSimulation() {
      try {
          const response = await fetch(
              "http://localhost:6769/12301/reset",
              {
                  method: "POST"
              }
          );

          if (!response.ok) {
              throw new Error("Failed to reset simulation");
          }

          // Immediately fetch the freshly reset simulation
          const trainResponse = await fetch(
              "http://localhost:6769/12301"
          );

          if (!trainResponse.ok) {
              throw new Error("Failed to fetch train");
          }

          const data = await trainResponse.json();

          setTrain(data);
          setError(null);

      } catch (error) {
          console.error(error);
          setError(error.message);
      }
   }

    useEffect(() => {
        async function fetchTrain() {
            try {
                const response = await fetch(
                    "http://localhost:6769/12301"
                );

                if (!response.ok) {
                    throw new Error("Failed to fetch train");
                }

                const data = await response.json();

                setTrain(data);
                setError(null);
            } catch (error) {
                console.error(error);
                setError(error.message);
            }
        }

        fetchTrain();

        const interval = setInterval(fetchTrain, 1000);

        return () => {
            clearInterval(interval);
        };
    }, []);

    if (error) {
        return <h1>Error: {error}</h1>;
    }

    if (!train) {
        return <h1>Loading...</h1>;
    }

    const stations = Object.entries(train.stations)
        .map(([code, station]) => ({
            code,
            ...station
        }))
        .sort((a, b) => a.distance - b.distance);

    const currentDistance = train.current.currentDistance;

    return (
        <div className="app">
            <header className="train-header">
                <div>
                    <h1>
                        {train.trainNumber} RAJDHANI EXPRESS
                    </h1>

                    <p>
                        Howrah → New Delhi
                    </p>
                </div>

                <div className="running">
                    <span className="running-dot"></span>
                    RUNNING
                    <button className="delay-button" onClick={() => {setShowDelayForm(true); setDelayError(null);}}>
                      ADD DELAY
                    </button>
                    <button className="reset-button" onClick={resetSimulation}>
                        RESET
                    </button>
                </div>
            </header>

            {showDelayForm && (
                  <div className="delay-panel">

                      <h2>ADD TRAIN DELAY</h2>

                      <div className="delay-field">

                          <label>STATION</label>

                          <select
                              value={selectedStation}
                              onChange={(e) =>
                                  setSelectedStation(e.target.value)
                              }
                          >
                              <option value="">
                                  Select station
                              </option>

                              {stations.map((station) => (
                                  <option
                                      key={station.code}
                                      value={station.code}
                                  >
                                      {station.code}
                                  </option>
                              ))}
                          </select>

                      </div>


                      <div className="delay-field">

                          <label>DELAY (MINUTES)</label>

                          <input
                              type="number"
                              min="1"
                              value={delayMinutes}
                              onChange={(e) =>
                                  setDelayMinutes(e.target.value)
                              }
                              placeholder="Enter delay"
                          />

                      </div>


                      {delayError && (
                          <div className="delay-error">
                              {delayError}
                          </div>
                      )}


                      <div className="delay-actions">

                          <button
                              className="cancel-button"
                              onClick={() => {
                                  setShowDelayForm(false);
                                  setDelayError(null);
                              }}
                          >
                              CANCEL
                          </button>

                          <button
                              className="confirm-delay-button"
                              onClick={addDelay}
                          >
                              ADD DELAY
                          </button>

                      </div>

                  </div>
              )}

            <div className="timeline-header">
                <div className="station-header">STATION</div>

                <div className="time-group">
                    <div className="group-title">
                        SCHEDULED
                    </div>

                    <div className="time-labels">
                        <span>ARRIVAL</span>
                        <span>DEPARTURE</span>
                    </div>
                </div>

                <div className="time-group">
                    <div className="group-title">
                        EXPECTED
                    </div>

                    <div className="time-labels">
                        <span>ARRIVAL</span>
                        <span>DEPARTURE</span>
                    </div>
                </div>
            </div>

            <main className="timeline">

                <div className="route-line"></div>

                {stations.map((station) => {

                    const passed =
                        station.distance < currentDistance;

                    return (
                        <div
                            className={`station-row ${
                                passed ? "passed" : ""
                            }`}
                            key={station.code}
                        >

                            <div className="station-marker">
                                <div className="station-circle"></div>
                            </div>

                            <div className="station-info">
                                <div className="station-name">
                                    {station.code}
                                </div>

                                <div className="station-details">
                                    {station.code} · {station.distance} km
                                </div>
                            </div>

                            <div className="station-times">
                                <span>
                                    {station.scheduledArrival}
                                </span>

                                <span>
                                    {station.scheduledDeparture}
                                </span>
                            </div>

                            <div className="station-times expected">
                                <span>
                                    {station.predictedArrival}
                                </span>

                                <span>
                                    {station.predictedDeparture}
                                </span>
                            </div>

                        </div>
                    );
                })}

                <div
                    className="train-marker"
                    style={{
                        top: calculateTrainPosition(
                            stations,
                            currentDistance
                        )
                    }}
                >
                    <div className="train-circle"></div>
                    <span>TRAIN HERE</span>
                </div>

            </main>

        </div>
    );
}

function calculateTrainPosition(stations, currentDistance) {
    if (stations.length === 0) {
        return "0px";
    }

    const first = stations[0];

    // Train is before the first station
    if (currentDistance <= first.distance) {
        return "0px";
    }

    const last = stations[stations.length - 1];

    // Train is after the last station
    if (currentDistance >= last.distance) {
        return `${(stations.length - 1) * 100}px`;
    }

    // Find the two stations the train is currently between
    for (let i = 0; i < stations.length - 1; i++) {
        const current = stations[i];
        const next = stations[i + 1];

        if (
            currentDistance >= current.distance &&
            currentDistance <= next.distance
        ) {
            const progress =
                (currentDistance - current.distance) /
                (next.distance - current.distance);

            const position =
                50 + (i * 100) + (progress * 100);

            return `${position}px`;
        }
    }

    return "0px";
}



export default App;