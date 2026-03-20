/**
 * Squid Amphi — Server Entry Point
 * Express + Socket.IO
 */
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const QRCode = require('qrcode');
const GameManager = require('./GameManager');

const app = express();
app.set('trust proxy', 1); // Indispensable pour avoir le bon protocole (https) derrière le proxy de Render/Railway
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
  pingInterval: 10000,
  pingTimeout: 5000
});

const PORT = process.env.PORT || 3000;

// Serve static files
app.use(express.static(path.join(__dirname, '..', 'public')));

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'display', 'index.html'));
});

app.get('/play', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'controller', 'index.html'));
});

// QR Code API — generates QR code as data URL
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

// Initialize game manager
const gameManager = new GameManager(io);

// Socket.IO connections
io.on('connection', (socket) => {
  console.log(`🔗 New connection: ${socket.id}`);
  gameManager.handleConnection(socket);
});

// Start server
server.listen(PORT, () => {
  console.log('');
  console.log('╔══════════════════════════════════════════╗');
  console.log('║          🦑 SQUID AMPHI 🦑                ║');
  console.log('║                                          ║');
  console.log(`║  📺 Display:    http://localhost:${PORT}/     ║`);
  console.log(`║  🎮 Controller: http://localhost:${PORT}/play ║`);
  console.log('║                                          ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log('');
});
