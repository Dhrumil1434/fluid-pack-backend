import dotenv from 'dotenv';
import { createServer } from 'http';
import connectDB from './db/index';
import app from './app';
import notificationEmitter from './modules/notification/services/notificationEmitter.service';
dotenv.config();

const PORT = process.env['PORT'] || 3000;
console.log('hello');

connectDB()
  .then(() => {
    // Create HTTP server
    const httpServer = createServer(app);

    // Initialize Socket.IO for real-time notifications
    notificationEmitter.initialize(httpServer);

    httpServer.listen(PORT, () => {
      console.log(`⚙️ Server is running at: http://localhost:${PORT}`);
      console.log(
        `📡 Socket.IO server initialized for real-time notifications`,
      );
    });
  })
  .catch((err) => {
    console.error('❌ MongoDB connection failed!', err);
  });
