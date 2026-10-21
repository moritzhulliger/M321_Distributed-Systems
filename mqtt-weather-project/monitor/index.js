const mqtt = require('mqtt');

const BROKER_URL = process.env.BROKER_URL || 'mqtt://localhost:1883';
const TOPIC_IN = 'weather';
const TOPIC_VALID = 'weather/validated';
const TOPIC_ALERTS = 'weather/alerts'; // pro Station: weather/alerts/<stationId>
const TIMEOUT_MS = 30000;

// Stationen, die wir erwarten (auch wenn sie seit dem Start nie gesendet haben)
const EXPECTED = (process.env.STATIONS || 'WS-01,WS-02,WS-03').split(',');

// stationId -> { lastSeen: Zeit in ms, offline: true/false }
const stations = new Map();
const startTime = Date.now();
EXPECTED.forEach((id) => stations.set(id, { lastSeen: startTime, offline: false }));

const client = mqtt.connect(BROKER_URL, {
  clientId: 'monitor-' + Math.random().toString(16).slice(2, 8),
  reconnectPeriod: 2000,
});

client.on('connect', () => {
  console.log('Verbunden mit', BROKER_URL);
  client.subscribe(TOPIC_IN);
});

client.on('reconnect', () => console.log('Neuer Verbindungsversuch...'));
client.on('offline', () => console.log('Verbindung verloren'));
client.on('error', (err) => console.error('Fehler:', err.message));

// Gibt null zurück, wenn alles stimmt, sonst den Grund als Text
function validate(data) {
  if (typeof data.stationId !== 'string' || data.stationId === '') return 'stationId fehlt';
  if (typeof data.temperature !== 'number' || data.temperature < -50 || data.temperature > 60)
    return `Temperatur ungültig (${data.temperature})`;
  if (typeof data.humidity !== 'number' || data.humidity < 0 || data.humidity > 100)
    return `Luftfeuchtigkeit ungültig (${data.humidity})`;
  if (isNaN(Date.parse(data.timestamp))) return `Zeitstempel ungültig (${data.timestamp})`;
  return null;
}

function sendAlert(stationId, status, lastSeen) {
  const alert = {
    stationId,
    status, // 'offline' oder 'online'
    lastSeen: new Date(lastSeen).toISOString(),
    timestamp: new Date().toISOString(),
  };
  // retain: neue Abonnenten bekommen sofort den letzten Status jeder Station
  client.publish(`${TOPIC_ALERTS}/${stationId}`, JSON.stringify(alert), { qos: 1, retain: true });
  console.log(`ALARM [${stationId}]: ${status}`);
}

// Station hat sich gemeldet (auch mit falschen Werten = sie lebt noch)
function markSeen(stationId) {
  const station = stations.get(stationId);
  if (station && station.offline) {
    station.lastSeen = Date.now();
    station.offline = false;
    sendAlert(stationId, 'online', station.lastSeen);
  } else {
    stations.set(stationId, { lastSeen: Date.now(), offline: false });
    if (!station) sendAlert(stationId, 'online', Date.now());
  }
}

// Alle 5 s prüfen, ob eine Station zu lange still ist
setInterval(() => {
  const now = Date.now();
  for (const [stationId, station] of stations) {
    if (!station.offline && now - station.lastSeen > TIMEOUT_MS) {
      station.offline = true;
      sendAlert(stationId, 'offline', station.lastSeen);
    }
  }
}, 5000);

client.on('message', (topic, payload) => {
  let data;
  try {
    data = JSON.parse(payload.toString());
  } catch {
    console.warn('UNGÜLTIG: kein JSON ->', payload.toString());
    return;
  }

  if (typeof data.stationId === 'string' && data.stationId !== '') markSeen(data.stationId);

  const error = validate(data);
  if (error) {
    console.warn(`UNGÜLTIG [${data.stationId}]: ${error}`);
    return;
  }

  client.publish(TOPIC_VALID, JSON.stringify(data));
  console.log(`ok [${data.stationId}] ${data.temperature} °C, ${data.humidity} %`);
});
