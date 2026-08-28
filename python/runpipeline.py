import subprocess
import sys


scripts = [
    "blegh.py",
    "convert_to_per_day.py",
    "convert_to_aggregate.py"
]


for script in scripts:

    print("\n" + "=" * 60)
    print(f"Running {script}")
    print("=" * 60)

    result = subprocess.run(
        [sys.executable, script]
    )

    if result.returncode != 0:

        print(
            f"\nERROR: {script} failed."
        )

        sys.exit(result.returncode)


print("\n" + "=" * 60)
print("PIPELINE COMPLETED SUCCESSFULLY")
print("=" * 60)