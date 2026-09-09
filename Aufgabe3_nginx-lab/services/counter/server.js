const express = require('express');
const currentPort =  3000;
const app = express();

app.use(express.json());

let counter = 0;

function simulateLatency() {
    return new Promise(resolve => setTimeout(resolve, Math.random() * 200));
}

app.get('/increment', async (req, res) => {
    await simulateLatency();
    counter++;
    res.json({ counter });
});

app.get('/counter', (req, res) => {
    res.json({ counter });
});

app.listen(currentPort, async () => {
    console.log(`Server running on port ${currentPort}`)
});