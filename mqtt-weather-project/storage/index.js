const mqtt = require('mqtt');
const { DatabaseSync } = require('node:sqlite');
const express = require('express');

const BROKER_URL = process.env.BROKER_URL || 'mqtt://localhost:1883';
const TOPIC_VALID = 'weather/validated';
const DB_FILE = process.env.DB_FILE || 'weather.db';
const PORT = process.env.PORT || 3001;

// --- Datenbank ---
const db = new DatabaseSync(DB_FILE);
db.exec(`
  CREATE TABLE IF NOT EXISTS measurements (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    station_id  TEXT NOT NULL,
    temperature REAL NOT NULL,
    humidity    REAL NOT NULL,
    timestamp   TEXT NOT NULL,
    received_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_station_time ON measurements (station_id, timestamp);
`);

const insert = db.prepare(`
  INSERT INTO measurements (station_id, temperature, humidity, timestamp, received_at)
  VALUES (?, ?, ?, ?, ?)
`);

// --- MQTT ---
const client = mqtt.connect(BROKER_URL, {
  clientId: 'storage-' + Math.random().toString(16).slice(2, 8),
  reconnectPeriod: 2000,
});

client.on('connect', () => {
  console.log('Verbunden mit', BROKER_URL);
  client.subscribe(TOPIC_VALID);
});

client.on('reconnect', () => console.log('Neuer Verbindungsversuch...'));
client.on('offline', () => console.log('Verbindung verloren'));
client.on('error', (err) => console.error('Fehler:', err.message));

client.on('message', (topic, payload) => {
  try {
    const d = JSON.parse(payload.toString());
    const result = insert.run(d.stationId, d.temperature, d.humidity, d.timestamp, new Date().toISOString());
    console.log(`gespeichert #${result.lastInsertRowid} [${d.stationId}]`);
  } catch (err) {
    console.error('Konnte nicht speichern:', err.message);
  }
});

// --- Abfrage-API ---
const historyAll = db.prepare(`
  SELECT station_id, temperature, humidity, timestamp, received_at
  FROM measurements WHERE received_at >= ? ORDER BY received_at
`);
const historyStation = db.prepare(`
  SELECT station_id, temperature, humidity, timestamp, received_at
  FROM measurements WHERE station_id = ? AND received_at >= ? ORDER BY received_at
`);

const app = express();

// GET /history?minutes=10&station=WS-01   (station ist optional)
app.get('/history', (req, res) => {
  const minutes = Number(req.query.minutes ?? 10);
  if (!Number.isFinite(minutes) || minutes <= 0 || minutes > 1440) {
    return res.status(400).json({ error: 'minutes muss zwischen 1 und 1440 liegen' });
  }
  const since = new Date(Date.now() - minutes * 60 * 1000).toISOString();
  const rows = req.query.station
    ? historyStation.all(req.query.station, since)
    : historyAll.all(since);
  res.json(rows);
});

app.listen(PORT, () => console.log(`Abfrage-API auf http://localhost:${PORT}/history`));
