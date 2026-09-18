import json
import os


INPUT_FOLDER = "compiledraw"


def main():

    train_results = {}

    # Go through every train folder
    for train_number in sorted(os.listdir(INPUT_FOLDER)):

        train_folder = os.path.join(
            INPUT_FOLDER,
            train_number
        )

        # Ignore anything that isn't a folder
        if not os.path.isdir(train_folder):
            continue

        # Use a set so each station is counted only once
        observed_stations = set()

        # Go through every daily JSON file
        for filename in os.listdir(train_folder):

            if not filename.endswith(".json"):
                continue

            file_path = os.path.join(
                train_folder,
                filename
            )

            try:

                with open(
                    file_path,
                    "r",
                    encoding="utf-8"
                ) as file:

                    data = json.load(file)

                stations = data.get(
                    "stations",
                    {}
                )

                for station_code, station_data in stations.items():

                    arrival_delay = station_data.get(
                        "arrival_delay"
                    )

                    departure_delay = station_data.get(
                        "departure_delay"
                    )

                    # Count the station only when BOTH
                    # arrival and departure were observed.
                    if (
                        arrival_delay is not None
                        and
                        departure_delay is not None
                    ):

                        observed_stations.add(
                            station_code
                        )

            except Exception as e:

                print(
                    f"ERROR processing {file_path}: {e}"
                )

        train_results[train_number] = len(
            observed_stations
        )

    # Sort trains from highest number of observed
    # stations to lowest.
    ranked_trains = sorted(
        train_results.items(),
        key=lambda x: x[1],
        reverse=True
    )

    print("\n" + "=" * 50)
    print("TRAIN LINES BY OBSERVED STATIONS")
    print("=" * 50)

    for train_number, station_count in ranked_trains:

        print(
            f"Train {train_number}: "
            f"{station_count} stations"
        )

    print("=" * 50)


if __name__ == "__main__":
    main()