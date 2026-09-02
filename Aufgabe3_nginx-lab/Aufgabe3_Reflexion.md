# Aufgabe 3 — NGINX als Reverse Proxy und Load Balancer

Reflexion, Modul 321

---

## Abgegebene Dateien

**Teil 1 (Lab-Projekt):** `nginx/conf.d/reverse-proxy.conf`
Die mitgelieferte `default.conf` habe ich nicht angefasst. Sie fängt weiterhin alle
Anfragen ab, für die es keinen passenden `server_name` gibt.

**Teil 2 (Counter-Projekt):** `nginx/conf.d/counter.conf` und der neue `nginx`-Service in
der `docker-compose.yml`.

`docker compose exec nginx nginx -t` läuft bei beiden ohne Fehler durch.

---

## Für welche Load-Balancing-Methode habe ich mich entschieden und warum?

Ich habe **Round Robin** genommen. Das ist die Standardmethode von NGINX, man muss dafür
nichts extra in den `upstream`-Block schreiben. Die Anfragen gehen einfach reihum an
counter-1, counter-2 und counter-3.

Der Grund ist, dass meine drei Container komplett gleichwertig sind. Sie werden aus dem
gleichen Image gebaut, laufen auf der gleichen Maschine und jede kann jede Anfrage
beantworten. Es gibt also keinen Grund, eine davon zu bevorzugen.

Wichtig war für mich auch, dass mein Counter keine Sessions hat. Der Zustand liegt zwar
im RAM, aber die Instanzen gleichen sich über den G-Counter und `POST /merge` selber ab.
Wenn ein Client bei jeder Anfrage auf einer anderen Instanz landet, geht dabei nichts
verloren. Genau deshalb funktioniert Round Robin hier problemlos.

**Warum nicht `ip_hash`?**

`ip_hash` würde einen Client anhand seiner IP immer an die gleiche Instanz schicken
(Sticky Sessions). Das brauche ich hier gar nicht, weil ich keine Sitzungsdaten habe,
die nur eine Instanz kennt.

Beim Testen wäre es sogar hinderlich gewesen. Meine Anfragen kommen ja alle von der
gleichen IP. Also wären alle drei Requests auf der gleichen Instanz gelandet und ich
hätte im Log gar nicht sehen können, dass der Load Balancer überhaupt verteilt.

**Warum nicht `least_conn`?**

`least_conn` schickt jede Anfrage an den Server mit den wenigsten offenen Verbindungen.
Das lohnt sich, wenn die Requests unterschiedlich lange dauern.

Ein Argument dafür hätte es tatsächlich gegeben, weil meine App einen zufälligen Delay
von 0 bis 1000 ms hat. Die Antwortzeiten schwanken also stark. Ich habe mich trotzdem
dagegen entschieden, weil dieser Delay nur zum Testen eingebaut ist und nicht wirklich
zur Anwendung gehört. Ohne ihn sind alle Requests etwa gleich aufwändig und Round Robin
reicht völlig.

---

## Auf welche Probleme bin ich gestossen?

### 1. `localhost` funktioniert im Container nicht mehr

Das war mein grösstes Problem, und es lag gar nicht an NGINX, sondern an meinem eigenen
Counter-Code von Aufgabe 1. Der Broadcast an die Peers sah so aus:

```js
axios.post(`http://localhost:${peer}/merge`, counts)
```

Solange die drei Instanzen als Node-Prozesse auf meinem Rechner liefen, war das richtig.
Sie haben sich das gleiche Loopback-Interface geteilt und nur der Port hat sie
unterschieden.

Im Container ist das anders. Jeder Container hat sein eigenes Netzwerk-Namespace, und
`localhost` zeigt dort auf den Container selber. Instanz 1 hätte also sich selbst
angefunkt statt Instanz 2.

Was ich daran am unangenehmsten finde: Es hätte **keine Fehlermeldung** gegeben. Der
Request wäre erfolgreich gewesen, die Instanz hätte mit sich selbst gemergt und der
Counter hätte ganz normal ausgesehen. Nur repliziert hätte er nicht mehr. So einen
Fehler findet man nur, wenn man vorher weiss, wonach man suchen muss.

Gelöst habe ich es mit dem internen DNS von Docker. Container im gleichen Netzwerk
erreichen sich über ihren Service-Namen. Ich übergebe jetzt die ganze Adresse als
Argument (`counter-2:3002`) und der Hostname steht nicht mehr im Code.

### 2. Der Port ist gleichzeitig die Knoten-ID

Zuerst wollte ich alle drei Container intern auf Port 3000 laufen lassen. Im
Docker-Netzwerk gibt das ja keinen Konflikt, weil jeder Container seine eigene IP hat.

Das hätte meinen G-Counter kaputt gemacht, ohne dass ich es gemerkt hätte. Der State
wird mit `const counts = { [PORT]: 0 }` angelegt, der Port ist also die ID des Knotens.
Bei drei Instanzen mit Port 3000 hätten alle das gleiche Feld `"3000"` benutzt. Und weil
`merge` pro Feld das Maximum nimmt, hätten sie sich gegenseitig überschrieben. Das wäre
genau das Lost Update gewesen, gegen das der G-Counter eigentlich schützen soll.

Ich habe deshalb unterschiedliche Ports vergeben (3001, 3002, 3003). Dann sind die IDs
automatisch verschieden und ich musste nichts am Code ändern.

Sauberer wäre gewesen, die Knoten-ID über eine eigene Umgebungsvariable zu setzen und
sie so vom Port zu trennen. Spätestens wenn man die App mit `docker compose up --scale`
skalieren will, geht es nicht mehr anders, weil man dann keine einzelnen Ports mehr
vergeben kann. Für drei feste Instanzen war mir das aber zu viel Aufwand.

### 3. Port 80 war doppelt belegt

Das Lab-Setup aus Teil 1 und mein Counter-Projekt wollen beide Port 80. Solange das Lab
noch lief, konnte ich das Counter-Projekt nicht starten. Ich musste dort zuerst
`docker compose down` machen.

Man hätte auch einem der beiden einen anderen Host-Port geben können, dann müsste man
den aber bei jedem Aufruf mitschreiben.

### 4. `node_modules` von Windows im Linux-Image

Beim Containerisieren hat `COPY . .` mein lokales `node_modules` mit ins Image kopiert
und damit das überschrieben, was `npm install` im Container gerade installiert hatte.
Das ist ein Problem, weil ich auf Windows entwickle und das Image Alpine Linux ist.

Gelöst mit einer `.dockerignore`, in der `node_modules` und `.git` drinstehen. Der Build
ist dadurch auch schneller geworden.

### 5. Etwas, das ich erwartet und dann nicht gesehen habe

Ich dachte, ich würde nach dem Load Balancer folgenden Effekt sehen: Ein `/increment`
landet auf Instanz A, das `/count` direkt danach durch Round Robin auf Instanz B, und B
hat den Merge noch nicht verarbeitet und zeigt darum einen kleineren Wert an. Das wäre
Eventual Consistency zum Anfassen gewesen.

Reproduzieren konnte ich es nicht. Der Broadcast ist im Docker-Netzwerk in ein paar
Millisekunden durch, während allein das Starten von `curl` schon länger dauert. Die
Replikation ist also fertig, bevor die nächste Anfrage überhaupt ankommt.

Ich finde das trotzdem eine interessante Beobachtung. Der Effekt ist theoretisch da und
würde bei richtiger paralleler Last oder langsamerem Netzwerk auftreten. Der Load
Balancer ist nicht die Ursache, er macht nur möglich, dass man ihn überhaupt sehen
könnte. Vorher hat ja jedes Terminal immer die gleiche Instanz angesprochen.

---

## Anhang: Konfigurationsdateien

### Teil 1 — `nginx/conf.d/reverse-proxy.conf`

```nginx
server {
    listen 80;
    server_name service-a.local;

    location / {
        proxy_pass http://service-a:3000;

        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 80;
    server_name service-b.local;

    location / {
        proxy_pass http://service-b:3000;

        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 80;
    server_name service-c.local;

    location / {
        proxy_pass http://service-c:3000;

        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Die vier Header braucht es, weil NGINX beim Weiterleiten eine neue Verbindung zum
Backend aufmacht. Ohne sie würde der Service nur NGINX sehen und nichts mehr über den
echten Client wissen. `Host` sagt ihm, unter welchem Namen er angefragt wurde.
`X-Real-IP` und `X-Forwarded-For` liefern die IP des Clients, das zweite als Kette,
falls mehrere Proxys hintereinander stehen. `X-Forwarded-Proto` sagt, ob der Client über
http oder https gekommen ist.

### Teil 2 — `nginx/conf.d/counter.conf`

```nginx
upstream counter_backend {
    server counter-1:3001;
    server counter-2:3002;
    server counter-3:3003;
}

server {
    listen 80;
    server_name service-counter.local;

    location / {
        proxy_pass http://counter_backend;

        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Der einzige richtige Unterschied zu Teil 1 ist der `upstream`-Block. `counter_backend`
ist ein Name, den ich selber vergeben habe, kein Hostname. In `proxy_pass` steht er
statt einem Container, und NGINX merkt am gleichen Namen, dass es eine Gruppe ist.

### Teil 2 — Ergänzung in der `docker-compose.yml`

```yaml
  nginx:
    image: nginx:1.27-alpine
    container_name: counter-nginx
    ports:
      - "80:80"
    volumes:
      - ./nginx/conf.d:/etc/nginx/conf.d:ro
    networks:
      - counter-net
    depends_on:
      - counter-1
      - counter-2
      - counter-3
```
