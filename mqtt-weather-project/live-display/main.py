
import json
from datetime import datetime, timezone

import paho.mqtt.client as mqtt

BROKER = "mosquitto"
PORT = 1883
TOPIC = "weather"

stations = {}


def show_stations():
    print("\n--- Aktuelle Wetterdaten ---")
    print(f"{'Station':<12} {'Temperatur':<15} {'Feuchtigkeit':<18} {'Empfangen (UTC)'}")

    for station_id, data in sorted(stations.items()):
        print(
            f"{station_id:<12} "
            f"{data['temperature']:<15} "
            f"{data['humidity']:<18} "
            f"{data['received_at']}"
        )


def on_connect(client, userdata, flags, reason_code, properties):
    if reason_code.is_failure:
        print(f"Verbindung fehlgeschlagen: {reason_code}")
        return

    print("Mit MQTT-Broker verbunden")
    client.subscribe(TOPIC, qos=1)


def on_message(client, userdata, msg):
    try:
        data = json.loads(msg.payload.decode("utf-8"))

        station_id = data["stationId"]
        temperature = data["temperature"]
        humidity = data["humidity"]

        if not isinstance(station_id, str) or not station_id:
            raise ValueError("Ungültige Station-ID")

        if type(temperature) not in (int, float):
            raise ValueError("Ungültiger Temperaturtyp")

        if type(humidity) not in (int, float):
            raise ValueError("Ungültiger Feuchtigkeitstyp")

        stations[station_id] = {
            "temperature": temperature,
            "humidity": humidity,
            "received_at": datetime.now(timezone.utc).strftime("%H:%M:%S")
        }

        show_stations()

    except (ValueError, KeyError, TypeError, UnicodeDecodeError) as error:
        print(f"Ungültige Nachricht: {error}")


client = mqtt.Client(
    callback_api_version=mqtt.CallbackAPIVersion.VERSION2,
    client_id="live-display"
)

client.on_connect = on_connect
client.on_message = on_message
client.reconnect_delay_set(min_delay=1, max_delay=30)

client.connect_async(BROKER, PORT, keepalive=60)
client.loop_forever(retry_first_connection=True)
