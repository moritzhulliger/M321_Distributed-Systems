import express from 'express';
import axios from 'axios';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from 'redis';

const CACHE_TTL = 60; // Sekunden
const __filename = fileURLToPath(import.meta.url);
const redis = createClient({ url: 'redis://localhost:6379' });
redis.on('error', (err) => console.error('Redis-Fehler:', err.message));
await redis.connect();
console.log('Mit Redis verbunden');
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.static(path.join(__dirname, 'public')));

function cachePolicy(req) {
  const header = (req.headers['cache-control'] || '').toLowerCase();
  return {
    read: !header.includes('no-cache') && !header.includes('no-store'),
    write: !header.includes('no-store'),
  };
}

app.get('/api/pokemon/:name', async (req, res) => {
  const name = req.params.name.toLowerCase();
  const key = `pokemon:${name}`;

  const policy = cachePolicy(req);

    if (policy.read) {
       try {
         const cached = await redis.get(key);
         if (cached) {
           res.set('X-Cache', 'HIT');
           return res.json(JSON.parse(cached));
         }
       } catch (err) {
         console.error('Cache-Read fehlgeschlagen:', err.message);
       }
    }

  try {
    const { data } = await axios.get(`https://pokeapi.co/api/v2/pokemon/${name}`);
    const lean = {
      id: data.id,
      name: data.name,
      sprite: data.sprites.front_default,
      height: data.height,
      weight: data.weight,
      types: data.types.map(t => t.type.name),
      stats: Object.fromEntries(data.stats.map(s => [s.stat.name, s.base_stat])),
    };

    if (policy.write) {
        try {
          await redis.setEx(key, CACHE_TTL, JSON.stringify(lean));
        } catch (err) {
          console.error('Cache-Write fehlgeschlagen:', err.message);
        }
    }
    res.set('X-Cache', 'MISS');
    res.json(lean);
  } catch (err) {
    res.status(500).json({ error: 'Could not fetch Pokémon.' });
  }
});

app.get('/api/list', async (_, res) => {
  try {
    const { data } = await axios.get('https://pokeapi.co/api/v2/pokemon?limit=100');
    res.json(data.results.map((p) => p.name));
  } catch {
    res.status(500).json({ error: 'Could not fetch Pokémon list.' });
  }
});

app.listen(3000, () => {
  console.log('✅ Server running on http://localhost:3000');
});
