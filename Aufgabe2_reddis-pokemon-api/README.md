# Aufgabe: Caching mit Redis

## Ziel

Implementiere Caching mit Redis in einem bestehenden Node.js/Express-Projekt, um die Antwortzeiten beim Abrufen von Pokémon-Daten zu optimieren.

---

## Ausgangslage

Du erhältst ein funktionierendes Projekt mit:

- einem Express-Server (`server.js`)
- einer statischen HTML-Seite (`public/index.html`)
- einem JavaScript-Client (`public/main.js`), der 100 Pokémon über `/api/pokemon/:name` abruft
- einer API `/api/list`, die eine Liste mit 100 Pokémon-Namen liefert
- kein Caching ist implementiert

Aktuell werden alle Anfragen direkt an die öffentliche [PokeAPI](https://pokeapi.co) weitergeleitet. Dadurch entstehen bei vielen Requests unnötig lange Ladezeiten.

Mit `npm start` started der Server welcher auch gleich das Frontend auf localhost:3000 bereit stellt.

---

## Aufgabe

### 1 Redis Cache Implementieren
Deine Aufgabe ist es, ein Caching mit Redis im Backend (_server.js_) zu implementieren. 
Ziel ist, dass bereits abgerufene Pokémon-Daten nicht erneut von der PokeAPI geladen werden müssen. Welches Pattern solltest ihr verwenden (Write Through oder Cache Aside).

### 2 TTL 
Stelle sicher, dass die Daten nicht ewig nur aus dem Cache geladen werden. 

### 3 Zeige an ob eine Response aus dem Cache kommt
Setze auf die Response den X-Cache header mit dem korrekten Wert (https://http.dev/x-cache). Mache dies auch im HTML sichtbar.

### 4 Cache aus dem Frontend steuern lassen
Mache es möglich, dass das Frontend über den Cache-Control Header selbst definiert, ob eine Response aus dem cache kommen soll: 
https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cache-Control#no-cache



### Schritte

1. **Redis starten**

Im Projekt liegt ein docker-compose.yaml mit dem Befehl _docker-compose up_ lässt sich so ein Redis Server auf dem konfigurierten Port starten.

Um Redis in node.js zu verwenden nutzt: https://github.com/redis/node-redis


