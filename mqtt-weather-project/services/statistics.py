import threading
import time
from collections import defaultdict, deque
from datetime import timedelta

from common import connect_with_retry, create_client, decode_measurement, utc_now


WINDOW = timedelta(minutes=5)
lock = threading.Lock()
recent = defaultdict(deque)
daily = {}
hourly = defaultdict(list)
current_hour = None


def print_hourly_summary(hour):
    for station_id, values in sorted(hourly.items()):
        if not values:
            continue
        temperatures = [item[0] for item in values]
        humidity = [item[1] for item in values]
        print(
            f"Stundenbericht {station_id} ({hour:%Y-%m-%d %H}:00): "
            f"Temperatur Ø {sum(temperatures) / len(temperatures):.1f} °C, "
            f"Luftfeuchtigkeit Ø {sum(humidity) / len(humidity):.1f} % "
            f"({len(values)} Messungen)",
            flush=True,
        )


def on_connect(client, userdata, flags, reason_code, properties):
    if reason_code.is_failure:
        print(f"MQTT-Verbindung fehlgeschlagen: {reason_code}", flush=True)
        return
    client.subscribe("validated", qos=1)
    print("Statistikdienst abonniert validated", flush=True)


def on_message(client, userdata, message):
    global current_hour
    measurement, error = decode_measurement(message.payload)
    if error:
        print(f"Ungültige validierte Nachricht ignoriert: {error}", flush=True)
        return

    now = utc_now()
    hour = now.replace(minute=0, second=0, microsecond=0)
    station_id = measurement["stationId"]
    temperature = measurement["temperature"]
    humidity = measurement["humidity"]

    with lock:
        if current_hour is None:
            current_hour = hour
        elif hour > current_hour:
            print_hourly_summary(current_hour)
            hourly.clear()
            current_hour = hour

        samples = recent[station_id]
        samples.append((now, temperature, humidity))
        cutoff = now - WINDOW
        while samples and samples[0][0] < cutoff:
            samples.popleft()

        day_key = (station_id, now.date())
        extremes = daily.setdefault(
            day_key,
            {"min_temperature": temperature, "max_temperature": temperature,
             "min_humidity": humidity, "max_humidity": humidity},
        )
        extremes["min_temperature"] = min(extremes["min_temperature"], temperature)
        extremes["max_temperature"] = max(extremes["max_temperature"], temperature)
        extremes["min_humidity"] = min(extremes["min_humidity"], humidity)
        extremes["max_humidity"] = max(extremes["max_humidity"], humidity)
        hourly[station_id].append((temperature, humidity))

        avg_temperature = sum(item[1] for item in samples) / len(samples)
        avg_humidity = sum(item[2] for item in samples) / len(samples)
        print(
            f"Statistik {station_id}: 5-Minuten-Ø {avg_temperature:.1f} °C / "
            f"{avg_humidity:.1f} % | Tagesminimum/-maximum "
            f"{extremes['min_temperature']:.1f}/{extremes['max_temperature']:.1f} °C, "
            f"{extremes['min_humidity']:.1f}/{extremes['max_humidity']:.1f} %",
            flush=True,
        )


client = create_client("weather-statistics")
client.on_connect = on_connect
client.on_message = on_message
connect_with_retry(client)

try:
    while True:
        time.sleep(1)
        now_hour = utc_now().replace(minute=0, second=0, microsecond=0)
        with lock:
            if current_hour is not None and now_hour > current_hour:
                print_hourly_summary(current_hour)
                hourly.clear()
                current_hour = now_hour
except KeyboardInterrupt:
    pass
finally:
    client.disconnect()
    client.loop_stop()