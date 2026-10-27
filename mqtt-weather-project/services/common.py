import json
import math
import os
import time
from datetime import datetime, timezone

import paho.mqtt.client as mqtt


def create_client(client_id):
    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id=client_id)
    client.reconnect_delay_set(min_delay=1, max_delay=30)
    return client


def connect_with_retry(client):
    broker = os.getenv("BROKER_HOST", "localhost")
    port = int(os.getenv("BROKER_PORT", "1883"))
    delay = 1
    while True:
        try:
            client.connect(broker, port, keepalive=60)
            client.loop_start()
            return
        except OSError as error:
            print(f"MQTT-Broker {broker}:{port} nicht erreichbar ({error}); neuer Versuch in {delay}s", flush=True)
            time.sleep(delay)
            delay = min(delay * 2, 30)


def utc_now():
    return datetime.now(timezone.utc)


def iso_timestamp(value):
    return value.isoformat(timespec="seconds").replace("+00:00", "Z")


def decode_measurement(payload):
    try:
        measurement = json.loads(payload.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        return None, f"Ungültiges JSON: {error}"

    if not isinstance(measurement, dict):
        return None, "Die Nachricht muss ein JSON-Objekt sein"

    station_id = measurement.get("stationId")
    temperature = measurement.get("temperature")
    humidity = measurement.get("humidity")
    timestamp = measurement.get("timestamp")
    if not isinstance(station_id, str) or not station_id.strip():
        return None, "stationId fehlt oder ist ungültig"
    if isinstance(temperature, bool) or not isinstance(temperature, (int, float)):
        return None, "temperature muss eine Zahl sein"
    if not math.isfinite(temperature) or not -80 <= temperature <= 60:
        return None, "temperature liegt außerhalb des gültigen Bereichs (-80 bis 60 °C)"
    if isinstance(humidity, bool) or not isinstance(humidity, (int, float)):
        return None, "humidity muss eine Zahl sein"
    if not math.isfinite(humidity) or not 0 <= humidity <= 100:
        return None, "humidity liegt außerhalb des gültigen Bereichs (0 bis 100 %)"
    if not isinstance(timestamp, str):
        return None, "timestamp fehlt oder ist ungültig"
    try:
        datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
    except ValueError:
        return None, "timestamp ist kein gültiger ISO-8601-Zeitpunkt"

    return measurement, None