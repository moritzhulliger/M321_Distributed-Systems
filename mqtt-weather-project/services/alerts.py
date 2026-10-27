import json
import os
import time
from pathlib import Path

from common import connect_with_retry, create_client, decode_measurement, iso_timestamp, utc_now


log_path = Path(os.getenv("ALERT_LOG_PATH", "data/alerts.jsonl"))
log_path.parent.mkdir(parents=True, exist_ok=True)
active_conditions = {}


def restore_active_conditions():
    if not log_path.exists():
        return
    with log_path.open("r", encoding="utf-8") as log_file:
        for line in log_file:
            try:
                event = json.loads(line)
            except json.JSONDecodeError:
                continue
            key = (event.get("stationId"), event.get("condition"))
            if event.get("state") == "active":
                active_conditions[key] = event
            elif event.get("state") == "normal":
                active_conditions.pop(key, None)


def conditions_for(measurement):
    conditions = {}
    temperature = measurement["temperature"]
    humidity = measurement["humidity"]
    frost_threshold = float(os.getenv("FROST_THRESHOLD", "0"))
    heat_threshold = float(os.getenv("HEAT_THRESHOLD", "30"))
    humidity_threshold = float(os.getenv("HUMIDITY_THRESHOLD", "85"))

    if temperature < frost_threshold:
        conditions["Frost"] = (temperature, frost_threshold, "°C")
    if temperature > heat_threshold:
        conditions["Hitze"] = (temperature, heat_threshold, "°C")
    if humidity > humidity_threshold:
        conditions["Hohe Luftfeuchtigkeit"] = (humidity, humidity_threshold, "%")
    return conditions


def record_transition(station_id, condition, state, value, threshold, unit, measurement):
    event = {
        "stationId": station_id,
        "condition": condition,
        "state": state,
        "value": value,
        "threshold": threshold,
        "unit": unit,
        "timestamp": iso_timestamp(utc_now()),
        "measurementTimestamp": measurement["timestamp"],
    }
    with log_path.open("a", encoding="utf-8") as log_file:
        log_file.write(json.dumps(event, ensure_ascii=False) + "\n")
    active_conditions[(station_id, condition)] = event if state == "active" else None
    if state == "normal":
        active_conditions.pop((station_id, condition), None)
    label = "WARNUNG" if state == "active" else "NORMALISIERT"
    print(
        f"{label}: {station_id}, {condition}: {value}{unit} "
        f"(Grenzwert {threshold}{unit}), {event['timestamp']}",
        flush=True,
    )


def on_connect(client, userdata, flags, reason_code, properties):
    if reason_code.is_failure:
        print(f"MQTT-Verbindung fehlgeschlagen: {reason_code}", flush=True)
        return
    client.subscribe("validated", qos=1)
    print("Wetterwarnungsdienst abonniert validated", flush=True)


def on_message(client, userdata, message):
    measurement, error = decode_measurement(message.payload)
    if error:
        print(f"Ungültige validierte Nachricht ignoriert: {error}", flush=True)
        return

    station_id = measurement["stationId"]
    current = conditions_for(measurement)
    previous_keys = {
        key for key in active_conditions if key[0] == station_id
    }
    current_keys = {(station_id, condition) for condition in current}

    for key in previous_keys | current_keys:
        condition = key[1]
        if key in current_keys and key not in previous_keys:
            value, threshold, unit = current[condition]
            record_transition(station_id, condition, "active", value, threshold, unit, measurement)
        elif key in previous_keys and key not in current_keys:
            previous = active_conditions[key]
            record_transition(
                station_id,
                condition,
                "normal",
                current_value(measurement, condition),
                previous["threshold"],
                previous["unit"],
                measurement,
            )


def current_value(measurement, condition):
    return measurement["humidity"] if condition == "Hohe Luftfeuchtigkeit" else measurement["temperature"]


restore_active_conditions()
client = create_client("weather-alerts")
client.on_connect = on_connect
client.on_message = on_message
connect_with_retry(client)

try:
    while True:
        time.sleep(1)
except KeyboardInterrupt:
    client.disconnect()
    client.loop_stop()