import json
import os
import threading
import time

from common import connect_with_retry, create_client, decode_measurement, iso_timestamp, utc_now
from database import open_database, save_measurement


database = open_database()
database_lock = threading.Lock()
state_lock = threading.Lock()
last_seen = {station.strip(): time.monotonic() for station in os.getenv("STATION_IDS", "").split(",") if station.strip()}
last_received_at = {station_id: None for station_id in last_seen}
offline_stations = set()


def publish_status(client, station_id, status, last_received=None):
    event = {
        "stationId": station_id,
        "status": status,
        "timestamp": iso_timestamp(utc_now()),
        "lastReceivedAt": last_received,
    }
    client.publish("stations/status", json.dumps(event), qos=1, retain=True)
    print(f"Station {station_id}: {status}", flush=True)


def on_connect(client, userdata, flags, reason_code, properties):
    if reason_code.is_failure:
        print(f"MQTT-Verbindung fehlgeschlagen: {reason_code}", flush=True)
        return
    client.subscribe("weather", qos=1)
    print("Überwachungsdienst abonniert weather", flush=True)


def on_message(client, userdata, message):
    received_at = iso_timestamp(utc_now())
    measurement, error = decode_measurement(message.payload)
    with database_lock:
        save_measurement(database, message.payload, received_at, measurement, error)

    if error:
        print(f"Ungültiger Messwert gespeichert und verworfen: {error}", flush=True)
        return

    station_id = measurement["stationId"]
    with state_lock:
        last_seen[station_id] = time.monotonic()
        last_received_at[station_id] = received_at
        recovered = station_id in offline_stations
        offline_stations.discard(station_id)

    if recovered:
        publish_status(client, station_id, "online", received_at)

    validated = dict(measurement)
    validated["receivedAt"] = received_at
    client.publish("validated", json.dumps(validated), qos=1)


client = create_client("weather-monitor")
client.on_connect = on_connect
client.on_message = on_message
connect_with_retry(client)

try:
    while True:
        now = time.monotonic()
        with state_lock:
            overdue = [
                station_id
                for station_id, seen_at in last_seen.items()
                if now - seen_at > 30 and station_id not in offline_stations
            ]
            overdue_last_received = {
                station_id: last_received_at.get(station_id) for station_id in overdue
            }
            for station_id in overdue:
                offline_stations.add(station_id)
        for station_id in overdue:
            publish_status(client, station_id, "offline", overdue_last_received[station_id])
        time.sleep(1)
except KeyboardInterrupt:
    pass
finally:
    database.close()
    client.disconnect()
    client.loop_stop()