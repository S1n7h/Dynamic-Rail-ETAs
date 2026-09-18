import csv
import json
import os
import time
from datetime import datetime, timedelta
from urllib.parse import urlencode
from urllib.request import urlopen

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

OBSERVATION_DIR = os.path.join(BASE_DIR, "train_observations")
OUTPUT_DIR = os.path.join(BASE_DIR, "weather_raw")

TRAIN_FILES = [
    "train_12423_observations.csv",
    "train_12424_observations.csv"
]

HOURLY_VARIABLES = [
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


def read_observations():
    observations = []

    for filename in TRAIN_FILES:
        filepath = os.path.join(OBSERVATION_DIR, filename)

        if not os.path.exists(filepath):
            print(f"WARNING: File not found: {filepath}")
            continue

        print(f"Reading {filename}...")

        with open(filepath, "r", encoding="utf-8", newline="") as file:
            reader = csv.DictReader(file)

            for row in reader:
                station_code = row["station_code"].strip().upper()

                date = datetime.strptime(
                    row["date"].strip(),
                    "%d-%b-%Y"
                ).date()

                latitude = float(row["latitude"])
                longitude = float(row["longitude"])

                observations.append({
                    "station_code": station_code,
                    "date": date,
                    "latitude": latitude,
                    "longitude": longitude
                })

    return observations


def group_stations(observations):
    stations = {}

    for observation in observations:
        code = observation["station_code"]

        if code not in stations:
            stations[code] = {
                "latitude": observation["latitude"],
                "longitude": observation["longitude"],
                "dates": set()
            }

        stations[code]["dates"].add(observation["date"])

    return stations


def build_url(latitude, longitude, start_date, end_date):
    params = {
        "latitude": latitude,
        "longitude": longitude,
        "start_date": start_date.strftime("%Y-%m-%d"),
        "end_date": end_date.strftime("%Y-%m-%d"),
        "hourly": ",".join(HOURLY_VARIABLES),
        "timezone": "Asia/Kolkata"
    }

    return (
        "https://archive-api.open-meteo.com/v1/archive?"
        + urlencode(params)
    )


def download_weather(
    station_code,
    latitude,
    longitude,
    start_date,
    end_date
):
    url = build_url(
        latitude,
        longitude,
        start_date,
        end_date
    )

    print()
    print(f"Station: {station_code}")
    print(f"Coordinates: {latitude}, {longitude}")
    print(f"Date range: {start_date} -> {end_date}")
    print("Downloading...")

    try:
        with urlopen(url, timeout=60) as response:
            data = json.load(response)

        return data

    except Exception as error:
        print(
            f"ERROR downloading {station_code}: {error}"
        )
        return None


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    observations = read_observations()

    if not observations:
        print("No observations found.")
        return

    stations = group_stations(observations)

    all_dates = [
        observation["date"]
        for observation in observations
    ]

    earliest_date = min(all_dates)
    latest_date = max(all_dates)

    # One extra day on either side allows interpolation
    # around the beginning and end of the observation range.
    start_date = earliest_date - timedelta(days=1)
    end_date = latest_date + timedelta(days=1)

    print()
    print("=" * 60)
    print("WEATHER DOWNLOAD")
    print("=" * 60)

    print(f"Stations: {len(stations)}")
    print(f"Earliest observation: {earliest_date}")
    print(f"Latest observation:   {latest_date}")
    print(f"Weather start date:   {start_date}")
    print(f"Weather end date:     {end_date}")

    print()
    print("Weather variables:")

    for variable in HOURLY_VARIABLES:
        print(f"  - {variable}")

    print()
    print("Stations:")

    for station_code in sorted(stations):
        station = stations[station_code]

        print(
            f"  {station_code}: "
            f"{station['latitude']}, "
            f"{station['longitude']}"
        )

    print()
    print("=" * 60)

    for index, station_code in enumerate(
        sorted(stations),
        start=1
    ):
        station = stations[station_code]

        output_filename = (
            f"{station_code}_"
            f"{start_date.strftime('%Y-%m-%d')}_"
            f"{end_date.strftime('%Y-%m-%d')}.json"
        )

        output_path = os.path.join(
            OUTPUT_DIR,
            output_filename
        )

        print()
        print(
            f"[{index}/{len(stations)}] "
            f"{station_code}"
        )

        

        data = download_weather(
            station_code,
            station["latitude"],
            station["longitude"],
            start_date,
            end_date
        )

        if data is None:
            continue

        with open(
            output_path,
            "w",
            encoding="utf-8"
        ) as file:
            json.dump(
                data,
                file,
                indent=2
            )

        print(f"Saved: {output_filename}")

        time.sleep(1)

    print()
    print("=" * 60)
    print("DOWNLOAD COMPLETE")
    print("=" * 60)

    print()
    print("Raw weather data:")
    print(OUTPUT_DIR)


if __name__ == "__main__":
    main()