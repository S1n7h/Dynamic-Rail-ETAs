from datetime import date, timedelta
import json
import time
import os
from ntes import NTESClient

client = NTESClient()

trains = [
    "12301", "12302", "12951", "12952", "12423", "12424",
    "12313", "12314", "12425", "12426", "12001", "12002",
    "12003", "12004", "12005", "12006", "12009", "12010",
    "12033", "12034", "12245", "12246", "12259", "12260",
    "22415", "22416", "22439", "22440", "20833", "20834",
]

start_date = date(2026, 8, 27)
end_date = date.today()

# Create the main folder
os.makedirs("newraw", exist_ok=True)


for train_number in trains:

    # Create a folder specifically for this train
    train_folder = os.path.join("newraw", train_number)
    os.makedirs(train_folder, exist_ok=True)

    current_date = start_date

    while current_date <= end_date:

        date_string = current_date.strftime("%d-%b-%Y")

        filename = os.path.join(
            train_folder,
            f"{train_number}_{date_string}.json"
        )

        # --------------------------------------------------
        # Don't fetch or overwrite an existing file
        # --------------------------------------------------

        if os.path.exists(filename):
            print(f"Already exists, skipping: {filename}")

            current_date += timedelta(days=1)
            continue

        print(f"Fetching {train_number} for {date_string}...")

        try:
            status = client.live_status(
                train_number,
                date_string
            )

            with open(
                filename,
                "w",
                encoding="utf-8"
            ) as file:

                json.dump(
                    status,
                    file,
                    indent=2,
                    ensure_ascii=False
                )

            print(f"Saved {filename}")

        except Exception as e:

            print(
                f"ERROR: Failed to fetch "
                f"{train_number} for {date_string}: {e}"
            )

        # Wait at least 1 second between NTES requests
        time.sleep(1)

        current_date += timedelta(days=1)