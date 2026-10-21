const mqtt = require('mqtt');
const express = require('express');
const path = require('path');

const BROKER_URL = process.env.BROKER_URL || 'mqtt://localhost:1883';
const STORAGE_URL = process.env.STORAGE_URL || 'http://localhost:3001';
const PORT = process.env.PORT || 3000;

// Letzter Stand pro Station: stationId -> { temperature, humidity, timestamp, receivedAt, status }
const stations = new Map();
// Offene Browser-Verbindungen (Server-Sent Events)
const sseClients = new Set();

function broadcast(event, data) {
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of sseClients) res.write(msg);
}

// --- MQTT ---
const client = mqtt.connect(BROKER_URL, {
  clientId: 'dashboard-' + Math.random().toString(16).slice(2, 8),
  reconnectPeriod: 2000,
});

client.on('connect', () => {
  console.log('Verbunden mit', BROKER_URL);
  client.subscribe(['weather/validated', 'weather/alerts/#']);
});

client.on('reconnect', () => console.log('Neuer Verbindungsversuch...'));
client.on('offline', () => console.log('Verbindung verloren'));
client.on('error', (err) => console.error('Fehler:', err.message));

client.on('message', (topic, payload) => {
  let d;
  try {
    d = JSON.parse(payload.toString());
  } catch {
    return;
  }
  const station = stations.get(d.stationId) || { status: 'online' };

  if (topic === 'weather/validated') {
    Object.assign(station, {
      temperature: d.temperature,
      humidity: d.humidity,
      timestamp: d.timestamp,
      receivedAt: new Date().toISOString(),
    });
    stations.set(d.stationId, station);
    broadcast('measurement', { stationId: d.stationId, ...station });
  } else {
    station.status = d.status;
    stations.set(d.stationId, station);
    broadcast('status', { stationId: d.stationId, status: d.status, lastSeen: d.lastSeen });
  }
});

// --- Webserver ---
const app = express();
app.use(express.static(path.join(__dirname, 'public')));

// Live-Datenstrom zum Browser
app.get('/events', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  // Zuerst den aktuellen Stand aller Stationen schicken
  const snapshot = [...stations].map(([stationId, s]) => ({ stationId, ...s }));
  res.write(`event: snapshot\ndata: ${JSON.stringify(snapshot)}\n\n`);

  sseClients.add(res);
  req.on('close', () => sseClients.delete(res));
});

// Verlauf vom storage-Service holen (über dessen öffentliche API)
app.get('/api/history', async (req, res) => {
  const minutes = encodeURIComponent(req.query.minutes ?? 10);
  try {
    const r = await fetch(`${STORAGE_URL}/history?minutes=${minutes}`, {
      signal: AbortSignal.timeout(2000),
    });
    res.json(await r.json());
  } catch (err) {
    console.warn('storage nicht erreichbar:', err.message);
    res.status(503).json([]); // Dashboard läuft trotzdem weiter, nur ohne Verlauf
  }
});

app.listen(PORT, () => console.log(`Dashboard auf http://localhost:${PORT}`));
