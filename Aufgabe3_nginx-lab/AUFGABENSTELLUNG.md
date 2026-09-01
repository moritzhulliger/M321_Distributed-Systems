# Aufgabenstellung: NGINX als Reverse Proxy & Load Balancer

## Ausgangslage

Euch steht ein fertiges Docker-Compose-Setup zur Verfügung:

- Drei unabhängige Backend-Services (`service-a`, `service-b`, `service-c`),
  jeder läuft in einem eigenen Container und ist **nicht** direkt vom Host
  aus erreichbar (kein Port-Publishing).
- Ein NGINX-Container, der auf Port 80 nach aussen lauscht. Seine
  Konfiguration liegt in `nginx/conf.d/` und ist aktuell **nicht** als
  Reverse Proxy oder Load Balancer konfiguriert – das ist eure Aufgabe.

Ziel des Labs: Ihr lernt, wie man mit NGINX (a) Anfragen anhand des
Hostnamens an unterschiedliche Backends weiterleitet (Reverse Proxy) und
(b) Anfragen auf mehrere gleichartige Container verteilt (Load Balancer).

---

## Teil 1: Reverse Proxy 

**Ziel:** NGINX soll Anfragen anhand des Host-Headers an den passenden
Backend-Service weiterleiten.

| Aufruf (Host-Header)     | Soll weitergeleitet werden an |
|---------------------------|-------------------------------|
| `service-a.local`         | Container `service-a`, Port 3000 |
| `service-b.local`         | Container `service-b`, Port 3000 |
| `service-c.local`         | Container `service-c`, Port 3000 |

### Anforderungen

1. Legt in `nginx/conf.d/` einen oder mehrere `server`-Blöcke an, die anhand
   von `server_name` zwischen den drei Domains unterscheiden.
2. Leitet die Anfrage jeweils mit `proxy_pass` an den richtigen Container
   weiter. Denkt daran: Container sind im Docker-Netzwerk über ihren
   Service-/Container-Namen erreichbar (nicht über `localhost`).
3. Setzt mindestens folgende Proxy-Header korrekt (recherchiert, wofür jeder
   davon gebraucht wird):
   - `Host`
   - `X-Real-IP`
   - `X-Forwarded-For`
   - `X-Forwarded-Proto`
4. `docker compose exec nginx nginx -t` muss ohne Fehler durchlaufen.
5. Ein Aufruf jeder der drei Domains muss die Antwort des **jeweils
   richtigen** Services liefern (nicht immer denselben).

### Vorgehen 

1. `hosts-entries.txt` in eure lokale `hosts`-Datei übernehmen.
2. `docker compose up --build` starten.
3. `nginx/conf.d/default.conf` erweitern oder eine neue Datei
   `nginx/conf.d/reverse-proxy.conf` anlegen.
4. Nach jeder Änderung: `docker compose exec nginx nginx -s reload`.
5. Mit `curl -H "Host: service-a.local" http://localhost/` einzeln testen. (Oder auch im Browser aufrufen)


Nutzt folgende Dokumentation: https://docs.nginx.com/nginx/admin-guide/web-server/reverse-proxy/

---

## Teil 2: Load Balancer für euer Counter Projekt

**Ziel:** Übertragt das Prinzip aus Teil 1 auf euer **eigenes, bereits
bestehendes Projekt**, das ebenfalls in drei Containern läuft. Diesmal aber
nicht, um drei *unterschiedliche* Services zu erreichen, sondern um Anfragen
auf drei *gleichartige* Container (Replikate derselben Anwendung) zu
verteilen.

Macht eure Counter App unter service-counter.local verfügbar.

Nutzt dazu die Doku: https://docs.nginx.com/nginx/admin-guide/load-balancer/http-load-balancer/

Entscheidet euch für eine Load Balancing Methode und implementiert diese in NGINX

## Abgabe

- Eure vollständigen NGINX-Konfigurationsdateien (`nginx/conf.d/*.conf` für
  Teil 1, sowie eure angepasste Config für Teil 2 – aus eurem eigenen
  Projekt-Repository).
- Kurze schriftliche Reflexion:
  - Für welche Load-Balancing-Methode habt ihr euch in Teil 2
    entschieden und warum?
  - Auf welche Probleme seid ihr gestossen?

## Hilfreiche Ressourcen

- Offizielle NGINX-Dokumentation zu Reverse Proxy: https://nginx.org/en/docs/beginners_guide.html
- Offizielle NGINX-Dokumentation zum `upstream`-Modul: https://nginx.org/en/docs/http/ngx_http_upstream_module.html

## Tipps zur Fehlersuche

- `docker compose logs nginx` – Logs des NGINX-Containers ansehen
- `docker compose exec nginx nginx -t` – Konfiguration auf Syntaxfehler prüfen
- `curl -v -H "Host: service-a.local" http://localhost/` – Header und
  Statuscode der Antwort im Detail ansehen
- `docker compose ps` – prüfen, ob wirklich alle Container laufen
