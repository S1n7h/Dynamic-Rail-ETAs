import csv
import json
import math
import os
from datetime import datetime, timedelta


BASE_DIR = os.path.dirname(os.path.abspath(__file__))

OBSERVATION_DIR = os.path.join(
    BASE_DIR,
    "train_observations"
)

WEATHER_DIR = os.path.join(
    BASE_DIR,
    "weather_raw"
)


TRAIN_FILES = [
    "train_12423_observations.csv",
    "train_12424_observations.csv"
]


OUTPUT_FILES = {
    "train_12423_observations.csv":
        "train_12423_weather.csv",

    "train_12424_observations.csv":
        "train_12424_weather.csv"
}


# Weather variables downloaded from Open-Meteo.
WEATHER_VARIABLES = [
    "temperature_2m",
    "relative_humidity_2m",
    "precipitation",
    "rain",
    "showers",
    "weather_code",
    "wind_speed_10m",
    "wind_gusts_10m",
    "wind_direction_10m",
    "cloud_cover"
]


# Variables that can be linearly interpolated.
LINEAR_VARIABLES = [
    "temperature_2m",
    "relative_humidity_2m",
    "wind_speed_10m",
    "wind_gusts_10m",
    "cloud_cover"
]


# Hourly accumulation values.
#
# These are NOT linearly interpolated because Open-Meteo
# reports them as hourly accumulated quantities.
ACCUMULATION_VARIABLES = [
    "precipitation",
    "rain",
    "showers"
]


def load_weather_files():
    """
    Load all weather JSON files into memory.

    Returns:

        {
            "MXN": {
                "time": [...],
                "temperature_2m": [...],
                ...
            }
        }
    """

    weather_data = {}

    if not os.path.exists(WEATHER_DIR):
        print(
            f"ERROR: Weather directory not found:\n"
            f"{WEATHER_DIR}"
        )
        return weather_data

    files = sorted(
        filename
        for filename in os.listdir(WEATHER_DIR)
        if filename.lower().endswith(".json")
    )

    print()
    print("=" * 60)
    print("LOADING WEATHER DATA")
    print("=" * 60)

    print(f"Weather files found: {len(files)}")

    for filename in files:

        filepath = os.path.join(
            WEATHER_DIR,
            filename
        )

        try:
            with open(
                filepath,
                "r",
                encoding="utf-8"
            ) as file:
                data = json.load(file)

        except Exception as error:
            print(
                f"ERROR reading {filename}: {error}"
            )
            continue

        # Extract station code from filename.
        station_code = (
            filename
            .split("_")[0]
            .strip()
            .upper()
        )

        if "hourly" not in data:
            print(
                f"WARNING: No hourly data in {filename}"
            )
            continue

        hourly = data["hourly"]

        if "time" not in hourly:
            print(
                f"WARNING: No time array in {filename}"
            )
            continue

        weather_data[station_code] = hourly

        print(
            f"Loaded {station_code}: "
            f"{len(hourly['time'])} hourly records"
        )

    return weather_data


def build_weather_records(hourly):
    """
    Convert Open-Meteo's parallel arrays into a list
    of timestamped weather records.
    """

    records = []

    times = hourly["time"]

    for index, time_text in enumerate(times):

        timestamp = datetime.strptime(
            time_text,
            "%Y-%m-%dT%H:%M"
        )

        record = {
            "time": timestamp
        }

        for variable in WEATHER_VARIABLES:

            values = hourly.get(variable)

            if values is None:
                record[variable] = None
                continue

            if index >= len(values):
                record[variable] = None
                continue

            record[variable] = values[index]

        records.append(record)

    return records


def find_surrounding_records(records, target_time):
    """
    Find the weather records immediately before and after
    the requested train observation time.
    """

    if not records:
        return None, None

    if target_time < records[0]["time"]:
        return None, records[0]

    if target_time > records[-1]["time"]:
        return records[-1], None

    for index in range(len(records) - 1):

        previous_record = records[index]
        next_record = records[index + 1]

        if (
            previous_record["time"]
            <= target_time
            <= next_record["time"]
        ):
            return previous_record, next_record

    return None, None


def linear_interpolate(
    previous_value,
    next_value,
    previous_time,
    next_time,
    target_time
):
    """
    Linear interpolation between two values.
    """

    if previous_value is None:
        return next_value

    if next_value is None:
        return previous_value

    total_seconds = (
        next_time - previous_time
    ).total_seconds()

    if total_seconds == 0:
        return previous_value

    elapsed_seconds = (
        target_time - previous_time
    ).total_seconds()

    ratio = elapsed_seconds / total_seconds

    return (
        previous_value
        + ratio * (
            next_value - previous_value
        )
    )


def circular_interpolate(
    previous_value,
    next_value,
    previous_time,
    next_time,
    target_time
):
    """
    Interpolate wind direction using circular geometry.

    This avoids incorrect interpolation such as:

        350° -> 10°
        becoming 180°.

    Instead it follows the shortest angular path.
    """

    if previous_value is None:
        return next_value

    if next_value is None:
        return previous_value

    total_seconds = (
        next_time - previous_time
    ).total_seconds()

    if total_seconds == 0:
        return previous_value

    elapsed_seconds = (
        target_time - previous_time
    ).total_seconds()

    ratio = elapsed_seconds / total_seconds

    angle1 = math.radians(previous_value)
    angle2 = math.radians(next_value)

    x1 = math.cos(angle1)
    y1 = math.sin(angle1)

    x2 = math.cos(angle2)
    y2 = math.sin(angle2)

    # Interpolate the unit vectors.
    x = x1 + ratio * (x2 - x1)
    y = y1 + ratio * (y2 - y1)

    angle = math.degrees(
        math.atan2(y, x)
    )

    if angle < 0:
        angle += 360

    return angle


def get_weather_at_time(records, target_time):
    """
    Calculate weather at a specific minute.
    """

    previous_record, next_record = (
        find_surrounding_records(
            records,
            target_time
        )
    )

    if (
        previous_record is None
        and next_record is None
    ):
        return None

    # If only one side exists, use the available record.
    if previous_record is None:
        previous_record = next_record

    if next_record is None:
        next_record = previous_record

    result = {}

    previous_time = previous_record["time"]
    next_time = next_record["time"]

    # --------------------------------------------------
    # Linear variables
    # --------------------------------------------------

    for variable in LINEAR_VARIABLES:

        result[variable] = linear_interpolate(
            previous_record[variable],
            next_record[variable],
            previous_time,
            next_time,
            target_time
        )

    # --------------------------------------------------
    # Wind direction
    # --------------------------------------------------

    result["wind_direction_10m"] = (
        circular_interpolate(
            previous_record[
                "wind_direction_10m"
            ],
            next_record[
                "wind_direction_10m"
            ],
            previous_time,
            next_time,
            target_time
        )
    )

    # --------------------------------------------------
    # Accumulation variables
    # --------------------------------------------------

    # Open-Meteo precipitation/rain/showers are
    # hourly accumulation values.
    #
    # Therefore:
    #
    # 23:00 -> 1.2 mm
    # 23:40 -> use the 23:00 hourly value
    #
    # We do not invent a minute-level accumulation
    # through linear interpolation.

    for variable in ACCUMULATION_VARIABLES:

        if target_time == next_time:
            result[variable] = next_record[variable]

        else:
            result[variable] = previous_record[variable]

    # --------------------------------------------------
    # Weather code
    # --------------------------------------------------

    # Weather code is categorical.
    # Use the closest hourly value.

    previous_difference = abs(
        (
            target_time
            - previous_time
        ).total_seconds()
    )

    next_difference = abs(
        (
            next_time
            - target_time
        ).total_seconds()
    )

    if next_difference < previous_difference:
        result["weather_code"] = (
            next_record["weather_code"]
        )
    else:
        result["weather_code"] = (
            previous_record["weather_code"]
        )

    return result


def round_weather_value(variable, value):
    """
    Keep the CSV readable without losing useful precision.
    """

    if value is None:
        return ""

    if variable == "weather_code":
        return str(int(round(value)))

    if variable == "wind_direction_10m":
        return f"{value:.2f}"

    if variable in [
        "temperature_2m",
        "relative_humidity_2m",
        "wind_speed_10m",
        "wind_gusts_10m",
        "cloud_cover"
    ]:
        return f"{value:.2f}"

    if variable in [
        "precipitation",
        "rain",
        "showers"
    ]:
        return f"{value:.2f}"

    return value


def add_actual_dates(rows):
    """
    Determine the actual calendar date of each observation
    based on the chronological order of the train journey.

    The original CSV date is preserved.

    This only creates an internal "_actual_date" field
    used for weather lookup.

    Example:

        01-Sep 23:40
        01-Sep 00:45

    becomes internally:

        01-Sep 23:40
        02-Sep 00:45

    The original CSV date remains unchanged.
    """

    if not rows:
        return rows

    service_date = datetime.strptime(
        rows[0]["date"].strip(),
        "%d-%b-%Y"
    ).date()

    current_date = service_date
    previous_time = None

    for row in rows:

        current_time = datetime.strptime(
            row["arrival_time"].strip(),
            "%H:%M"
        ).time()

        # If the current arrival time is earlier than
        # the previous arrival time, the train crossed
        # midnight.
        if (
            previous_time is not None
            and current_time < previous_time
        ):
            current_date += timedelta(days=1)

        row["_actual_date"] = current_date

        previous_time = current_time

    return rows


def enrich_train_file(
    input_filename,
    output_filename,
    weather_data
):
    """
    Read one observation CSV and create its enriched CSV.
    """

    input_path = os.path.join(
        OBSERVATION_DIR,
        input_filename
    )

    output_path = os.path.join(
        OBSERVATION_DIR,
        output_filename
    )

    print()
    print("=" * 60)
    print(f"PROCESSING {input_filename}")
    print("=" * 60)

    if not os.path.exists(input_path):
        print(
            f"ERROR: File not found:\n"
            f"{input_path}"
        )
        return

    # --------------------------------------------------
    # Read observations
    # --------------------------------------------------

    with open(
        input_path,
        "r",
        encoding="utf-8",
        newline=""
    ) as file:

        reader = csv.DictReader(file)

        rows = list(reader)
        original_fields = reader.fieldnames

    if not original_fields:
        print("ERROR: CSV has no header.")
        return

    # --------------------------------------------------
    # Determine actual calendar dates.
    #
    # This does NOT modify the original "date" column.
    # --------------------------------------------------

    rows = add_actual_dates(rows)

    # --------------------------------------------------
    # Create weather columns
    # --------------------------------------------------

    weather_fields = []

    for prefix in [
        "arrival",
        "departure"
    ]:

        for variable in WEATHER_VARIABLES:

            weather_fields.append(
                f"{prefix}_{variable}"
            )

    output_fields = (
        original_fields
        + weather_fields
    )

    processed_rows = 0
    missing_weather = 0

    # --------------------------------------------------
    # Write enriched CSV
    # --------------------------------------------------

    with open(
        output_path,
        "w",
        encoding="utf-8",
        newline=""
    ) as file:

        writer = csv.DictWriter(
            file,
            fieldnames=output_fields
        )

        writer.writeheader()

        for row in rows:

            station_code = (
                row["station_code"]
                .strip()
                .upper()
            )

            # --------------------------------------------------
            # Check weather availability
            # --------------------------------------------------

            if station_code not in weather_data:

                print(
                    f"WARNING: No weather data "
                    f"for station {station_code}"
                )

                missing_weather += 1

                for field in weather_fields:
                    row[field] = ""

                # _actual_date is internal only.
                row.pop("_actual_date", None)

                writer.writerow(row)

                processed_rows += 1
                continue

            records = weather_data[
                station_code
            ]

            # --------------------------------------------------
            # Arrival
            # --------------------------------------------------

            arrival_time = datetime.combine(
                row["_actual_date"],
                datetime.strptime(
                    row["arrival_time"].strip(),
                    "%H:%M"
                ).time()
            )

            arrival_weather = get_weather_at_time(
                records,
                arrival_time
            )

            if arrival_weather is None:

                print(
                    f"WARNING: Could not interpolate "
                    f"arrival weather for "
                    f"{station_code} "
                    f"{arrival_time}"
                )

                arrival_weather = {}

            for variable in WEATHER_VARIABLES:

                value = arrival_weather.get(
                    variable
                )

                row[
                    f"arrival_{variable}"
                ] = round_weather_value(
                    variable,
                    value
                )

            # --------------------------------------------------
            # Departure
            # --------------------------------------------------

            departure_time = datetime.combine(
                row["_actual_date"],
                datetime.strptime(
                    row["departure_time"].strip(),
                    "%H:%M"
                ).time()
            )

            departure_weather = get_weather_at_time(
                records,
                departure_time
            )

            if departure_weather is None:

                print(
                    f"WARNING: Could not interpolate "
                    f"departure weather for "
                    f"{station_code} "
                    f"{departure_time}"
                )

                departure_weather = {}

            for variable in WEATHER_VARIABLES:

                value = departure_weather.get(
                    variable
                )

                row[
                    f"departure_{variable}"
                ] = round_weather_value(
                    variable,
                    value
                )

            # --------------------------------------------------
            # Remove internal field before writing.
            #
            # This is critical because "_actual_date"
            # is NOT part of output_fields.
            # --------------------------------------------------

            row.pop("_actual_date", None)

            writer.writerow(row)

            processed_rows += 1

    # --------------------------------------------------
    # Processing summary
    # --------------------------------------------------

    print()
    print(f"Input rows:      {len(rows)}")
    print(f"Processed rows:  {processed_rows}")
    print(f"Missing weather: {missing_weather}")
    print("Output:")
    print(output_path)


def main():

    # --------------------------------------------------
    # Load raw weather JSON files
    # --------------------------------------------------

    weather_data_raw = load_weather_files()

    if not weather_data_raw:

        print()
        print("ERROR: No weather data loaded.")
        return

    # --------------------------------------------------
    # Convert Open-Meteo parallel arrays into
    # timestamped weather records.
    # --------------------------------------------------

    weather_data = {}

    print()
    print("=" * 60)
    print("PREPARING WEATHER RECORDS")
    print("=" * 60)

    for station_code, hourly in weather_data_raw.items():

        weather_data[station_code] = (
            build_weather_records(hourly)
        )

        print(
            f"{station_code}: "
            f"{len(weather_data[station_code])} "
            f"records"
        )

    # --------------------------------------------------
    # Process both trains
    # --------------------------------------------------

    for input_filename in TRAIN_FILES:

        output_filename = OUTPUT_FILES[
            input_filename
        ]

        enrich_train_file(
            input_filename,
            output_filename,
            weather_data
        )

    # --------------------------------------------------
    # Complete
    # --------------------------------------------------

    print()
    print("=" * 60)
    print("INTERPOLATION COMPLETE")
    print("=" * 60)

    print()
    print("New files:")

    print(
        os.path.join(
            OBSERVATION_DIR,
            "train_12423_weather.csv"
        )
    )

    print(
        os.path.join(
            OBSERVATION_DIR,
            "train_12424_weather.csv"
        )
    )


if __name__ == "__main__":
    main()

