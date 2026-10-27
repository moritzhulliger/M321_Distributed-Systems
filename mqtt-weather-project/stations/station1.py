import os
import time
import random
import json
import socket
import paho.mqtt.client as mqtt

broker = "mosquitto"
port = 1883
topic = "weather"

station_id = os.getenv("STATION_ID", "WS-XX")
interval = int(os.getenv("INTERVAL", "5"))
client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
client.reconnect_delay_set(min_delay=1, max_delay=30)

while True:
    try:
        client.connect(broker, port, 60)
        client.loop_start()
        break
    except (OSError, socket.error) as error:
        print(f"Broker nicht erreichbar ({error}); neuer Versuch in 5 Sekunden")
        time.sleep(5)

while True:
    if random.random() < 0.01:
        temperature = -999
    else:
        temperature = round(random.uniform(15, 30), 1)
        
    if random.random() < 0.005:
        print("Simulierter Totalausfall")
        break

    data = {
        "stationId": station_id,
        "temperature": temperature,
        "humidity": round(random.uniform(30, 60), 1),
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    }
    client.publish(topic, json.dumps(data))
    print(f"[{station_id}] Published: {data}")
    time.sleep(interval)
