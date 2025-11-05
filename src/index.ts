import dotenv from 'dotenv';
import { createServer } from 'http';
import { networkInterfaces } from 'os';
import connectDB from './db/index';
import app from './app';
import notificationEmitter from './modules/notification/services/notificationEmitter.service';
dotenv.config();

const PORT = parseInt(process.env['PORT'] || '5000', 10);

/**
 * Get local network IP address
 */
function getLocalIP(): string | null {
  const interfaces = networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    const nets = interfaces[name];
    if (!nets) continue;
    for (const net of nets) {
      // Skip internal (loopback) and non-IPv4 addresses
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return null;
}

connectDB()
  .then(() => {
    // Create HTTP server
    const httpServer = createServer(app);

    // Initialize Socket.IO for real-time notifications
    notificationEmitter.initialize(httpServer);

    const localIP = getLocalIP();

    httpServer.listen(PORT, '0.0.0.0', () => {
      console.log(`\n⚙️  Server is running!`);
      console.log(`📍 Local:   http://localhost:${PORT}`);
      if (localIP) {
        console.log(`🌐 Network: http://${localIP}:${PORT}`);
      }
      console.log(
        `📡 Socket.IO server initialized for real-time notifications\n`,
      );
    });
  })
  .catch((err) => {
    console.error('❌ MongoDB connection failed!', err);
  });
