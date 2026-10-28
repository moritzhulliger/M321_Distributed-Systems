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


## Testing

```bash
docker compose up --build -d
```



```bash
docker compose logs -f monitor
docker compose logs -f alerts
docker compose exec mosquitto mosquitto_sub -t "weather/#" -v
```


Web:
"http://localhost:8080"