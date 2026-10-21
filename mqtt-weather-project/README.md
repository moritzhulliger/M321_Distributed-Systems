# MQTT Wetterstationen

Dieses Projekt simuliert verteilte Wetterstationen, die Messdaten über MQTT an einen Broker senden.

## Setup

1. Starte alles mit:
   ```bash
   docker-compose up --build
   ```

2. Öffne ein neues Terminal und starte den Subscriber:
   ```bash
   cd subscriber
   pip install -r requirements.txt
   python main.py
   ```

## Aufgabe

- Abonniere Wetterdaten vom Topic `weather`
- Speichere die Daten sinnvoll (z. B. JSON-Datei, SQLite)
- Erstelle einfache Auswertungen (Durchschnitt, Verlauf, usw.)


## Meine Lösung

Ich habe drei Services in Node.js gebaut. Jeder hat eine eigene Verbindung zum Broker und kann alleine gestartet und gestoppt werden. Die Services reden nicht direkt miteinander, nur über MQTT-Topics. Als Erweiterungen habe ich C (Datenbank) und D (Dashboard) gemacht.

| Service | Abonniert | Macht |
|---|---|---|
| `monitor` | `weather` | Prüft die Werte. Gültige Daten schickt er auf `weather/validated`. Wenn eine Station länger als 30 s nichts sendet, schickt er `offline` auf `weather/alerts/<stationId>` (und `online`, wenn sie wieder da ist). |
| `storage` | `weather/validated` | Speichert alles in SQLite (`weather.db`). Abfrage: `GET http://localhost:3001/history?minutes=10&station=WS-01` (`station` ist optional). |
| `dashboard` | `weather/validated`, `weather/alerts/#` | Webseite auf `http://localhost:3000` mit Tabelle (Station, Status, Temperatur, Luftfeuchtigkeit, letzter Empfang) und Live-Graphen. Den Verlauf beim Laden holt es über die API von `storage`. |

### Starten

Voraussetzung: Docker Desktop und Node.js 22 oder neuer (für das eingebaute SQLite).

```bash
docker-compose up --build -d
```

Danach jeden Service in einem eigenen Terminal:

```bash
cd monitor   && npm install && node index.js
cd storage   && npm install && node index.js
cd dashboard && npm install && node index.js
```

Dann `http://localhost:3000` im Browser öffnen.

Hinweis: Bei den Stationen habe ich in der `docker-compose.yml` `restart: on-failure` ergänzt, weil sie sonst abstürzen, wenn der Broker beim Start noch nicht bereit ist.
