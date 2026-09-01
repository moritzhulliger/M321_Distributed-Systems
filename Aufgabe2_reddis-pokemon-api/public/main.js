const container = document.getElementById('grid');
const bypass = document.getElementById('bypass');
const runBtn = document.getElementById('run');
const summary = document.getElementById('summary');

runBtn.addEventListener('click', run);
run();   // einmal automatisch beim Seitenaufruf

async function run() {
  runBtn.disabled = true;
  container.innerHTML = '';
  summary.textContent = '';

  const options = bypass.checked
    ? { headers: { 'Cache-Control': 'no-cache' } }
    : {};

  const names = await fetch('/api/list', options).then(r => r.json());

  const table = document.createElement('table');
  table.innerHTML = `
    <thead>
      <tr>
        <th>#</th>
        <th>Name</th>
        <th>Duration (ms)</th>
        <th>X-Cache</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;
  container.appendChild(table);
  const tbody = table.querySelector('tbody');

  let total = 0;
  let hits = 0;

  for (const name of names) {
    const start = performance.now();
    try {
      const res = await fetch(`/api/pokemon/${name}`, options);
      const data = await res.json();
      const cache = res.headers.get('X-Cache') ?? '–';
      const duration = Math.round(performance.now() - start);
      total += duration;
      if (cache === 'HIT') hits++;

      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${data.id}</td>
        <td>${data.name}</td>
        <td>${duration}</td>
        <td class="${cache.toLowerCase()}">${cache}</td>
      `;
      tbody.appendChild(row);
    } catch (err) {
      const duration = Math.round(performance.now() - start);
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>–</td>
        <td>${name}</td>
        <td>${duration} (error)</td>
        <td>–</td>
      `;
      row.style.color = 'red';
      tbody.appendChild(row);
    }
  }

  const totalRow = document.createElement('tr');
  totalRow.innerHTML = `
    <td>Total</td>
    <td></td>
    <td>${total}</td>
    <td></td>
  `;
  tbody.appendChild(totalRow);

  summary.textContent = `${hits}/${names.length} aus dem Cache · ${total} ms gesamt`;
  runBtn.disabled = false;
}