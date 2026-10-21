const WINDOW_MS = 10 * 60 * 1000; // Graphen zeigen die letzten 10 Minuten
const COLORS = ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd'];
const stations = {}; // stationId -> { temperature, humidity, receivedAt, status }

// ---------- Graphen ----------
function createChart(canvasId, title, unit) {
  return new Chart(document.getElementById(canvasId), {
    type: 'line',
    data: { datasets: [] },
    options: {
      animation: false,
      plugins: { title: { display: true, text: title } },
      scales: {
        x: { type: 'linear', ticks: { callback: (v) => new Date(v).toLocaleTimeString('de-CH') } },
        y: { title: { display: true, text: unit } },
      },
    },
  });
}
const tempChart = createChart('tempChart', 'Temperatur', '°C');
const humChart = createChart('humChart', 'Luftfeuchtigkeit', '%');

// Datensatz (eine Linie) pro Station holen oder neu anlegen
function getDataset(chart, stationId) {
  let ds = chart.data.datasets.find((d) => d.label === stationId);
  if (!ds) {
    const color = COLORS[chart.data.datasets.length % COLORS.length];
    ds = {
      label: stationId,
      data: [],
      borderColor: color,
      backgroundColor: color,
      borderWidth: 1,
      pointRadius: 2,
      spanGaps: 30000, // Lücken > 30 s (Ausfall) nicht verbinden
    };
    chart.data.datasets.push(ds);
    chart.data.datasets.sort((a, b) => a.label.localeCompare(b.label));
  }
  return ds;
}

function addPoint(stationId, time, temperature, humidity) {
  const minTime = Date.now() - WINDOW_MS;
  for (const [chart, value] of [[tempChart, temperature], [humChart, humidity]]) {
    const ds = getDataset(chart, stationId);
    ds.data.push({ x: time, y: value });
    ds.data = ds.data.filter((p) => p.x >= minTime); // alte Punkte entfernen
  }
}

function updateCharts() {
  tempChart.update();
  humChart.update();
}

// ---------- Tabelle ----------
function secondsAgo(iso) {
  return Math.round((Date.now() - new Date(iso)) / 1000);
}

function renderTable() {
  const rows = Object.keys(stations).sort().map((id) => {
    const s = stations[id];
    const received = s.receivedAt
      ? `${new Date(s.receivedAt).toLocaleTimeString('de-CH')} (vor ${secondsAgo(s.receivedAt)} s)`
      : '–';
    return `<tr>
      <td>${id}</td>
      <td class="${s.status}">${s.status === 'offline' ? 'ausgefallen' : 'online'}</td>
      <td>${s.temperature ?? '–'} °C</td>
      <td>${s.humidity ?? '–'} %</td>
      <td>${received}</td>
    </tr>`;
  });
  document.getElementById('stations').innerHTML = rows.join('');
}
setInterval(renderTable, 1000); // «vor X s» jede Sekunde aktualisieren

// ---------- Verlauf beim Laden ----------
async function loadHistory() {
  try {
    const res = await fetch('/api/history?minutes=10');
    const rows = await res.json();
    rows.forEach((r) => addPoint(r.station_id, Date.parse(r.received_at), r.temperature, r.humidity));
    updateCharts();
  } catch {
    console.warn('Kein Verlauf verfügbar');
  }
}

// ---------- Live-Daten (Server-Sent Events) ----------
function connectLive() {
  const conn = document.getElementById('connection');
  const events = new EventSource('/events');

  events.onopen = () => {
    conn.textContent = 'Live verbunden';
    conn.className = 'ok';
  };
  events.onerror = () => {
    conn.textContent = 'Verbindung zum Dashboard-Server unterbrochen – versuche neu...';
    conn.className = 'error';
  };

  events.addEventListener('snapshot', (e) => {
    JSON.parse(e.data).forEach((s) => (stations[s.stationId] = s));
    renderTable();
  });

  events.addEventListener('measurement', (e) => {
    const m = JSON.parse(e.data);
    stations[m.stationId] = { ...stations[m.stationId], ...m };
    addPoint(m.stationId, Date.parse(m.receivedAt), m.temperature, m.humidity);
    updateCharts();
    renderTable();
  });

  events.addEventListener('status', (e) => {
    const s = JSON.parse(e.data);
    stations[s.stationId] = { ...stations[s.stationId], status: s.status };
    renderTable();
  });
}

loadHistory().then(connectLive);
