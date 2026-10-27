# MQTT-Wetterstationen

Das Projekt simuliert drei Wetterstationen und verarbeitet ihre MQTT-Nachrichten mit voneinander unabhängigen Microservices.

## Start

Voraussetzung ist Docker Compose. Starte Broker, Stationen und Services mit:

```bash
docker compose up --build
```

Die Services können unabhängig gestoppt und gestartet werden, zum Beispiel:

```bash
docker compose stop live-display
docker compose start live-display
```

Zum Beenden aller Container:

```bash
docker compose down
```

## Services und Topics

| Service | Abonniert | Aufgabe |
| --- | --- | --- |
| `live-display` | `weather` | Zeigt pro Station Temperatur, Luftfeuchtigkeit und Empfangszeitpunkt an. |
| `monitor` | `weather` | Validiert und persistiert jede Nachricht, publiziert gültige Messungen auf `validated` und meldet Stationenausfälle bzw. Wiederkehr auf `stations/status`. |
| `weather-alerts` | `validated` | Meldet Frost, Hitze und hohe Luftfeuchtigkeit nur bei Zustandswechseln; protokolliert Warnungen und Normalisierungen. |
| `statistics` | `validated` | Berechnet 5-Minuten-Durchschnittswerte, Tages-Minima/-Maxima und stündliche Zusammenfassungen. |

Jeder Service verbindet sich selbstständig mit dem Broker und versucht nach Verbindungsabbrüchen automatisch erneut zu verbinden. Beim Monitor gilt eine Station nach mehr als 30 Sekunden ohne gültige Messung als ausgefallen. Ungültige Messungen werden verworfen und nicht auf `validated` veröffentlicht.

## Speicherung und Verlauf

Der Monitor speichert gültige und ungültige empfangene Nachrichten in SQLite. Die Datenbank liegt im persistenten Docker-Volume `weather-data` unter `/data/weather.db`; Warnungswechsel stehen in `/data/alerts.jsonl`.

Neueste Daten aus der laufenden Datenbank abfragen:

```bash
docker compose exec monitor python history.py --limit 20
docker compose exec monitor python history.py --station WS-01 --limit 50
```

Für lokale Ausführung der Abfrage:

```bash
python -m pip install -r services/requirements.txt
python services/history.py --database data/weather.db --station WS-01
```

Grenzwerte des Warnungsdienstes lassen sich in `docker-compose.yml` über `FROST_THRESHOLD`, `HEAT_THRESHOLD` und `HUMIDITY_THRESHOLD` ändern. Der Standard ist Frost unter 0 °C, Hitze über 30 °C und Luftfeuchtigkeit über 85 %.

## Topics und Datenformat

Die Stationen senden JSON-Nachrichten auf `weather` mit `stationId`, `temperature`, `humidity` und `timestamp`. Der Monitor veröffentlicht gültige Nachrichten unverändert ergänzt um `receivedAt` auf `validated`. Statusmeldungen auf `stations/status` enthalten `stationId`, `status`, `timestamp` und `lastReceivedAt`.
