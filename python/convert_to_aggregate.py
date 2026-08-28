import json
import os


INPUT_FOLDER = "newraw"
OUTPUT_FOLDER = "compiledraw"


def parse_delay(delay_string):
    """
    Convert a delay string such as '00:20' into minutes.
    'On Time' is treated as 0.
    """

    if not delay_string:
        return None

    if delay_string.lower() == "on time":
        return 0

    try:
        hours, minutes = delay_string.split(":")
        return int(hours) * 60 + int(minutes)
    except (ValueError, AttributeError):
        return None


def clean_time(time_string):
    """
    Convert values such as '18:47 17-Aug' into '18:47'.
    """

    if not time_string:
        return None

    return time_string.split()[0]


def add_primary_station(train_data, station):
    """
    Add a primary stopping station and its delay information.
    """

    code = station.get("SC")

    if not code:
        return

    if code not in train_data:
        train_data[code] = {
            "distance": station.get("DIST"),
            "arrival_time": clean_time(station.get("STA")),
            "departure_time": clean_time(station.get("STD")),
            "avg_arrival_delay": None,
            "avg_departure_delay": None,
            "_arrival_delays": [],
            "_departure_delays": []
        }

    arrival_delay = parse_delay(station.get("DARR"))
    departure_delay = parse_delay(station.get("DDEP"))

    if arrival_delay is not None:
        train_data[code]["_arrival_delays"].append(arrival_delay)

    if departure_delay is not None:
        train_data[code]["_departure_delays"].append(departure_delay)


def add_intermediary_station(train_data, station):
    """
    Add an intermediary station.

    Intermediary stations do not have delay information,
    so their average delays remain null.
    """

    code = station.get("SC")

    if not code:
        return

    # Don't overwrite a primary station.
    if code in train_data:
        return

    train_data[code] = {
        "distance": station.get("DIST"),
        "arrival_time": clean_time(station.get("STA")),
        "departure_time": clean_time(station.get("STD")),
        "avg_arrival_delay": None,
        "avg_departure_delay": None,
        "_arrival_delays": [],
        "_departure_delays": []
    }


def process_file(file_path, train_data):
    """
    Process one historical NTES JSON file.
    """

    with open(file_path, "r", encoding="utf-8") as file:
        data = json.load(file)

    stations = data.get("STNS", [])

    for station in stations:

        # Actual stopping station
        add_primary_station(
            train_data,
            station
        )

        # Intermediate stations
        for wtt_station in station.get("WTTSTNS", []):
            add_intermediary_station(
                train_data,
                wtt_station
            )


def calculate_averages(train_data):
    """
    Calculate average delays for stopping stations.
    """

    for station in train_data.values():

        arrival_delays = station["_arrival_delays"]
        departure_delays = station["_departure_delays"]

        if arrival_delays:
            station["avg_arrival_delay"] = round(
                sum(arrival_delays) / len(arrival_delays),
                2
            )

        if departure_delays:
            station["avg_departure_delay"] = round(
                sum(departure_delays) / len(departure_delays),
                2
            )

        # Remove internal calculation data.
        del station["_arrival_delays"]
        del station["_departure_delays"]


def main():

    # Make sure compiledraw exists.
    os.makedirs(OUTPUT_FOLDER, exist_ok=True)

    # Process every train folder.
    for train_number in os.listdir(INPUT_FOLDER):

        train_folder = os.path.join(
            INPUT_FOLDER,
            train_number
        )

        if not os.path.isdir(train_folder):
            continue

        print(f"\nProcessing train {train_number}")

        train_data = {}

        # Process every historical file for this train.
        for filename in sorted(os.listdir(train_folder)):

            if not filename.endswith(".json"):
                continue

            file_path = os.path.join(
                train_folder,
                filename
            )

            print(f"  Processing {filename}")

            try:
                process_file(
                    file_path,
                    train_data
                )

            except Exception as e:
                print(
                    f"  ERROR processing {filename}: {e}"
                )

        # Calculate averages using all historical files.
        calculate_averages(train_data)

        # Create:
        # compiledraw/<train_number>/
        output_train_folder = os.path.join(
            OUTPUT_FOLDER,
            train_number
        )

        os.makedirs(
            output_train_folder,
            exist_ok=True
        )

        # Create:
        # compiledraw/<train_number>/<train_number>_aggregate_data.json
        output_file = os.path.join(
            output_train_folder,
            f"{train_number}_aggregate_data.json"
        )

        with open(
            output_file,
            "w",
            encoding="utf-8"
        ) as file:

            json.dump(
                {
                    "train": train_number,
                    "stations": train_data
                },
                file,
                indent=2,
                ensure_ascii=False
            )

        print(
            f"  Saved {output_file}"
        )


if __name__ == "__main__":
    main()