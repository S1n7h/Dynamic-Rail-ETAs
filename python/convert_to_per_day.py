import json
import os


INPUT_FOLDER = "newraw"
OUTPUT_FOLDER = "compiledraw"


def parse_delay(delay_string):
    """
    Convert a delay such as '00:20' into minutes.

    'On Time' is converted to 0.
    Empty or invalid values return None.
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
    Convert a time such as '18:47 17-Aug' into '18:47'.
    """

    if not time_string:
        return None

    return time_string.split()[0]


def convert_station(station):
    """
    Convert a primary/stopping station from the NTES response.
    """

    return {
        "distance": station.get("DIST"),
        "arrival_time": clean_time(station.get("STA")),
        "departure_time": clean_time(station.get("STD")),
        "arrival_delay": parse_delay(station.get("DARR")),
        "departure_delay": parse_delay(station.get("DDEP"))
    }


def convert_intermediary_station(station):
    """
    Convert an intermediary WTT station.

    NTES does not provide actual delay information for these
    stations, so their delay values are always null.
    """

    return {
        "distance": station.get("DIST"),
        "arrival_time": clean_time(station.get("STA")),
        "departure_time": clean_time(station.get("STD")),
        "arrival_delay": None,
        "departure_delay": None
    }


def convert_raw_response(file_path, train_number, date):
    """
    Convert one raw NTES response into the desired format.
    """

    with open(file_path, "r", encoding="utf-8") as file:
        data = json.load(file)

    stations = {}

    for primary_station in data.get("STNS", []):

        primary_code = primary_station.get("SC")

        if not primary_code:
            continue

        # Add the actual stopping station.
        stations[primary_code] = convert_station(
            primary_station
        )

        # Add intermediary stations.
        for intermediary in primary_station.get("WTTSTNS", []):

            intermediary_code = intermediary.get("SC")

            if not intermediary_code:
                continue

            # Don't overwrite a primary station.
            if intermediary_code in stations:
                continue

            stations[intermediary_code] = (
                convert_intermediary_station(intermediary)
            )

    return {
        "date": date,
        "train": train_number,
        "stations": stations
    }


def main():

    # Create compiledraw/
    os.makedirs(OUTPUT_FOLDER, exist_ok=True)

    # Go through every train folder.
    for train_number in sorted(os.listdir(INPUT_FOLDER)):

        train_folder = os.path.join(
            INPUT_FOLDER,
            train_number
        )

        if not os.path.isdir(train_folder):
            continue

        print(f"\nProcessing train {train_number}")

        # Create compiledraw/<train_number>/
        output_train_folder = os.path.join(
            OUTPUT_FOLDER,
            train_number
        )

        os.makedirs(output_train_folder, exist_ok=True)

        # Go through every day's raw file.
        for filename in sorted(os.listdir(train_folder)):

            if not filename.endswith(".json"):
                continue

            input_file = os.path.join(
                train_folder,
                filename
            )

            # Output has the same filename.
            output_file = os.path.join(
                output_train_folder,
                filename
            )

            # # --------------------------------------------------
            # # Don't overwrite an existing compiled file
            # # --------------------------------------------------

            # if os.path.exists(output_file):
            #     print(
            #         f"  Already exists, skipping: {output_file}"
            #     )
            #     continue

            print(f"  Processing {filename}")

            try:

                # Expected filename:
                # 12301_18-Aug-2026.json

                name_without_extension = os.path.splitext(
                    filename
                )[0]

                parts = name_without_extension.split("_")

                if len(parts) != 2:
                    print(
                        f"  Skipping invalid filename: {filename}"
                    )
                    continue

                file_train_number = parts[0]
                date = parts[1]

                converted = convert_raw_response(
                    input_file,
                    file_train_number,
                    date
                )

                with open(
                    output_file,
                    "w",
                    encoding="utf-8"
                ) as file:

                    json.dump(
                        converted,
                        file,
                        indent=2,
                        ensure_ascii=False
                    )

                print(f"  Saved {output_file}")

            except Exception as e:

                print(
                    f"  ERROR processing {filename}: {e}"
                )

if __name__ == "__main__":
    main()