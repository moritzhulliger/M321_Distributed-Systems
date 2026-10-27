Aufgabe
Entwickelt zwei unabhängig laufende Microservices, die beide das MQTT-Topic weather abonnieren:

Live-Anzeige: Zeigt die aktuellen Messwerte aller Wetterstationen an.

Überwachungsdienst: Erkennt ungültige Messwerte und meldet, wenn eine Station länger als 30 Sekunden keine Daten sendet. Dieser Dienst soll die anderen über ausgefallene Stationen informieren (neues Topic) sowie auch alle gültigen Wetterdaten unter einem neuen Topic ebenfalls bereitstellen. Es ist euch überlassen welche Services dann diese validierten Daten verwenden (z.B. könnte dies der Live-Anzeige Service nutzen)


Jeder Service baut eine eigene Verbindung zum Broker auf und verarbeitet die Nachrichten selbstständig. Die Services müssen separat startbar und stoppbar sein. Sie dürfen sich nicht gegenseitig aufrufen oder auf den internen Zustand des anderen zugreifen.

Anforderungen:
Der Client soll robust gegenüber Verbindungsabbrüchen sein
Die Anzeige soll mindestens Station-ID, Temperatur, Luftfeuchtigkeit und den letzten Empfangszeitpunkt zeigen
Erweiterungsmöglichkeiten
Wählt mindestens zwei der folgenden Erweiterungen:

A) Statistik-Service
Berechnet Durchschnittswerte der letzten 5 Minuten pro Station
Zeigt Minimal- und Maximalwerte des aktuellen Tages an
Erstellt stündliche Zusammenfassungen
B) Wetterwarnungs-Service
Abonniert das Topic validated und prüft die Messwerte jeder Station auf konfigurierbare Grenzwerte, beispielsweise:

Frost: Temperatur unter 0 °C

Hitze: Temperatur über 30 °C

Hohe Luftfeuchtigkeit: über 85 %

Gibt beim Überschreiten eines Grenzwerts eine Warnung mit Station-ID, Messwert und Zeitpunkt aus.

Meldet, wenn sich die Werte wieder normalisieren.

Gibt eine erneute Warnung erst aus, wenn sich der Zustand ändert. Protokolliert diese Zustandsänderungen in einer Datei.

C) Daten-Persistierung
Speichert alle empfangenen Daten in einer Datenbank (SQLite, InfluxDB, MongoDB, etc.)
Implementiert eine Abfrage-Funktion für historische Daten
D) Visualisierung
Erstellt Echtzeit-Graphen für Temperatur und Luftfeuchtigkeit
Zeigt die Daten auf einem Web-Dashboard an