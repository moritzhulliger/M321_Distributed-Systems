# Reflexion

## Teil 2: Load-Balancing-Methode

Für die Counter-App (`Aufgabe1`, drei Replikate `backend1`–`backend3`) wurde
**Round Robin** verwendet (NGINX-Default, kein zusätzliches Keyword im
`upstream`-Block nötig). Round Robin passt hier gut, weil alle drei
Replikate identisch sind (gleicher Code, keine Server-Affinität nötig) und
die Anfragen (`/increment`, `/counter`) leichtgewichtig sind, sodass keine
lastabhängige Verteilung (`least_conn`) nötig ist.

## Aufgetretene Probleme

- **Portkonflikt auf 80:** Teil 1 (nginx-lab) und Teil 2 (Counter-App) binden
  beide Port 80 auf dem Host. Beim gleichzeitigen Testen musste jeweils der
  andere NGINX-Container gestoppt werden.
- **DNS-Namensauflösung:** Backends sind nur über den Compose-Service-Namen
  (`backend1`, nicht `localhost`) erreichbar, da NGINX im selben
  Docker-Netzwerk laufen muss.
- **Round Robin ist pro Worker-Prozess, nicht global:** Mit `worker_processes
  auto` startet NGINX auf diesem Host sehr viele Worker. Jeder Worker führt
  seine eigene Round-Robin-Reihenfolge. Bei nur wenigen Testanfragen direkt
  nacheinander landeten dadurch überraschend viele Requests zuerst auf
  `backend1`, weil jeder (frisch beanspruchte) Worker seinen eigenen Zyklus
  bei Server 1 beginnt. Erst mit deutlich mehr Anfragen (~60) verteilte sich
  die Last sichtbar gleichmässig auf alle drei Backends. Das zeigt gut, dass
  Round Robin *keine* Garantie für perfekte Gleichverteilung bei kleinen
  Requestzahlen ist.
- **Zustand nicht geteilt:** Da jedes Backend-Replikat seinen eigenen
  `counter` im Speicher hält, liefert `/counter` je nach Backend, das die
  Anfrage bekommen hat, unterschiedliche Werte – ein gutes Beispiel dafür,
  dass zustandsbehaftete Anwendungen hinter einem Load Balancer entweder
  zustandslos gemacht oder der Zustand in einen gemeinsamen Speicher
  (z.B. Redis) ausgelagert werden muss.
