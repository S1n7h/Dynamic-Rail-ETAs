import csv
import json
import os


# --------------------------------------------------
# PATHS
# --------------------------------------------------

BASE_DIR = r"D:\D\railpull-main\python"

STATION_CSV = os.path.join(
    BASE_DIR,
    "cordinates",
    "station_coordinates.csv"
)

COMPILEDRAW_DIR = os.path.join(
    BASE_DIR,
    "compiledraw"
)

OUTPUT_DIR = os.path.join(
    BASE_DIR,
    "train_observations"
)

TRAIN_NUMBERS = ["12423", "12424"]


# --------------------------------------------------
# OUTPUT COLUMNS
# --------------------------------------------------

OUTPUT_FIELDS = [
    "date",
    "station_code",
    "station_name",
    "latitude",
    "longitude",
    "arrival_time",
    "departure_time",
    "arrival_delay",
    "departure_delay"
]


# --------------------------------------------------
# LOAD STATION COORDINATES
# --------------------------------------------------

def load_station_coordinates():
    stations = {}

    print(f"Loading station coordinates from:")
    print(STATION_CSV)
    print()

    with open(
        STATION_CSV,
        "r",
        encoding="utf-8-sig",
        newline=""
    ) as file:

        reader = csv.DictReader(file)

        for row in reader:
            code = row["station_code"].strip().upper()

            stations[code] = {
                "station_name": row["station_name"].strip(),
                "latitude": row["latitude"].strip(),
                "longitude": row["longitude"].strip()
            }

    print(f"Loaded {len(stations)} stations.")
    print()

    return stations


# --------------------------------------------------
# PROCESS ONE TRAIN
# --------------------------------------------------

def process_train(train_number, station_coordinates):

    train_folder = os.path.join(
        COMPILEDRAW_DIR,
        train_number
    )

    if not os.path.isdir(train_folder):
        print(
            f"ERROR: Folder not found for train {train_number}:"
        )
        print(train_folder)
        return

    observations = []

    json_files = sorted(
        filename
        for filename in os.listdir(train_folder)
        if filename.lower().endswith(".json")
    )

    print(f"Processing train {train_number}")
    print(f"Found {len(json_files)} JSON files.")

    missing_stations = set()
    missing_coordinates = set()

    for filename in json_files:

        filepath = os.path.join(
            train_folder,
            filename
        )

        with open(
            filepath,
            "r",
            encoding="utf-8"
        ) as file:

            data = json.load(file)

        date = data.get("date", "")

        stations = data.get("stations", {})

        for raw_station_code, station_data in stations.items():

            station_code = raw_station_code.strip().upper()

            arrival_delay = station_data.get(
                "arrival_delay"
            )

            departure_delay = station_data.get(
                "departure_delay"
            )

            # ------------------------------------------
            # ONLY KEEP VALID OBSERVATIONS
            #
            # None = no observation
            # 0    = valid observation
            # ------------------------------------------

            if arrival_delay is None:
                continue

            if departure_delay is None:
                continue

            # ------------------------------------------
            # FIND STATION IN COORDINATE CSV
            # ------------------------------------------

            station_info = station_coordinates.get(
                station_code
            )

            if station_info is None:

                missing_stations.add(
                    station_code
                )

                station_name = ""
                latitude = ""
                longitude = ""

            else:

                station_name = station_info["station_name"]
                latitude = station_info["latitude"]
                longitude = station_info["longitude"]

                if not latitude or not longitude:
                    missing_coordinates.add(
                        station_code
                    )

            # ------------------------------------------
            # SAVE OBSERVATION
            # ------------------------------------------

            observations.append({
                "date": date,
                "station_code": station_code,
                "station_name": station_name,
                "latitude": latitude,
                "longitude": longitude,
                "arrival_time": station_data.get(
                    "arrival_time",
                    ""
                ),
                "departure_time": station_data.get(
                    "departure_time",
                    ""
                ),
                "arrival_delay": arrival_delay,
                "departure_delay": departure_delay
            })

    # --------------------------------------------------
    # WRITE OUTPUT
    # --------------------------------------------------

    os.makedirs(
        OUTPUT_DIR,
        exist_ok=True
    )

    output_file = os.path.join(
        OUTPUT_DIR,
        f"train_{train_number}_observations.csv"
    )

    with open(
        output_file,
        "w",
        encoding="utf-8",
        newline=""
    ) as file:

        writer = csv.DictWriter(
            file,
            fieldnames=OUTPUT_FIELDS
        )

        writer.writeheader()
        writer.writerows(observations)

    # --------------------------------------------------
    # REPORT
    # --------------------------------------------------

    print(
        f"Saved {len(observations)} observations."
    )

    print(f"Output:")
    print(output_file)

    if missing_stations:
        print()
        print(
            "WARNING: These station codes were not "
            "found in station_coordinates.csv:"
        )

        for code in sorted(missing_stations):
            print(f"  {code}")

    if missing_coordinates:
        print()
        print(
            "WARNING: These stations have missing "
            "coordinates:"
        )

        for code in sorted(missing_coordinates):
            print(f"  {code}")

    print()
    print("-" * 50)
    print()


# --------------------------------------------------
# MAIN
# --------------------------------------------------

def main():

    print("=" * 50)
    print("TRAIN OBSERVATION EXPORT")
    print("=" * 50)
    print()

    station_coordinates = load_station_coordinates()

    for train_number in TRAIN_NUMBERS:

        process_train(
            train_number,
            station_coordinates
        )

    print("Finished.")


if __name__ == "__main__":
    main()