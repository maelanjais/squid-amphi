const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const QRCode = require('qrcode');
const GameManager = require('./GameManager');

const app = express();
app.set('trust proxy', 1); // proxy (Render)
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
  pingInterval: 10000,
  pingTimeout: 5000
});

const PORT = process.env.PORT || 3000;

// fichiers statiques
app.use(express.static(path.join(__dirname, '..', 'public')));

// routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'display', 'index.html'));
});

app.get('/play', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'controller', 'index.html'));
});

// génération QR code
app.get('/api/qr', async (req, res) => {
  const url = req.query.url || `${req.protocol}://${req.get('host')}/play`;
  try {
    const dataUrl = await QRCode.toDataURL(url, {
      width: 300,
      margin: 1,
      color: { dark: '#1a1a2e', light: '#ffffff' }
    });
    res.json({ qr: dataUrl, url });
  } catch (err) {
    res.status(500).json({ error: 'QR generation failed' });
  }
});

// config jeu
const gameManager = new GameManager(io);

// websockets
io.on('connection', (socket) => {
  console.log(`🔗 New connection: ${socket.id}`);
  gameManager.handleConnection(socket);
});

// démarrage serveur
server.listen(PORT, () => {
  console.log('');
  console.log('╔══════════════════════════════════════════╗');
  console.log('║          🦑 SQUID AMPHI 🦑                ║');
  console.log('║                                          ║');
  console.log(`║Display:    http://localhost:${PORT}/     ║`);
  console.log(`║Controller: http://localhost:${PORT}/play ║`);
  console.log('║                                          ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log('');
});
