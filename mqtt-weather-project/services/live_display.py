import threading
import time

from common import connect_with_retry, create_client, decode_measurement, iso_timestamp, utc_now


latest = {}
latest_lock = threading.Lock()


def on_connect(client, userdata, flags, reason_code, properties):
    if reason_code.is_failure:
        print(f"MQTT-Verbindung fehlgeschlagen: {reason_code}", flush=True)
        return
    client.subscribe("weather", qos=1)
    print("Live-Anzeige abonniert weather", flush=True)


def on_message(client, userdata, message):
    measurement, error = decode_measurement(message.payload)
    if error:
        print(f"Ungültige Wetterdaten: {error}", flush=True)
        return
    measurement["receivedAt"] = iso_timestamp(utc_now())
    with latest_lock:
        latest[measurement["stationId"]] = measurement


client = create_client("weather-live-display")
client.on_connect = on_connect
client.on_message = on_message
connect_with_retry(client)

try:
    while True:
        time.sleep(2)
        with latest_lock:
            snapshot = sorted(latest.values(), key=lambda item: item["stationId"])
        if snapshot:
            print("\nAktuelle Wetterwerte", flush=True)
            for item in snapshot:
                print(
                    f"{item['stationId']}: {item['temperature']} °C | "
                    f"{item['humidity']} % | empfangen {item['receivedAt']}",
                    flush=True,
                )
except KeyboardInterrupt:
    pass
finally:
    client.disconnect()
    client.loop_stop()