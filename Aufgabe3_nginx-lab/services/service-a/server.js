const http = require('http');
const os = require('os');

const PORT = process.env.PORT || 3000;
const SERVICE_NAME = process.env.SERVICE_NAME || 'unknown-service';
const COLOR = process.env.COLOR || '#4f46e5';

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', service: SERVICE_NAME }));
    return;
  }

  if (req.url === '/info') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      service: SERVICE_NAME,
      hostname: os.hostname(),
      time: new Date().toISOString()
    }));
    return;
  }

  const html = `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<title>${SERVICE_NAME}</title>
<style>
  body { font-family: system-ui, sans-serif; background: ${COLOR}; color: white;
         display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
  .card { background: rgba(0,0,0,0.25); padding: 2rem 3rem; border-radius: 12px; text-align: center; }
  h1 { margin: 0 0 0.5rem 0; font-size: 2rem; }
  code { background: rgba(255,255,255,0.2); padding: 2px 8px; border-radius: 4px; }
</style>
</head>
<body>
  <div class="card">
    <h1>${SERVICE_NAME}</h1>
    <p>Container-Hostname: <code>${os.hostname()}</code></p>
    <p>Zeit: <code>${new Date().toISOString()}</code></p>
  </div>
</body>
</html>`;

  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
});

server.listen(PORT, () => {
  console.log(`${SERVICE_NAME} laeuft auf Port ${PORT} (Host: ${os.hostname()})`);
});
