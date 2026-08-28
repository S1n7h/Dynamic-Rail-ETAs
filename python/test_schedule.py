from ntes import NTESClient
import json

client = NTESClient()

train_number = "68079"

schedule = client.schedule(train_number)

print(json.dumps(schedule, indent=2, ensure_ascii=False))