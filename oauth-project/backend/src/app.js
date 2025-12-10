import express from "express";
import cors from "cors";
import apiRoutes from "./routes/api.js";
import dotenv from "dotenv";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api", apiRoutes);

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Backend läuft auf Port ${PORT}`);
});

app.use((err, req, res, next) => {
  if (err) {
    console.error('Global error handler:', {
      message: err.message,
      name: err.name,
      path: req.path,
      authHeader: req.headers.authorization ? (req.headers.authorization.length > 120 ? req.headers.authorization.slice(0,120)+'...' : req.headers.authorization) : '<none>',
      stack: err.stack ? err.stack.split('\n').slice(0,3).join(' | ') : undefined,
    })
  }

  if (err && err.name === 'UnauthorizedError') {
    return res.status(401).json({ error: err.message });
  }
  next(err);
});