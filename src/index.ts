import dotenv from 'dotenv';
import connectDB from './db/index';
import app from './app';
dotenv.config();

const PORT = Number(process.env['PORT']) || 3000;
console.log('hello');

connectDB()
  .then(() => {
    app.listen(PORT, '0.0.0.0', () => {
      const lanIp = process.env['LAN_IP'] || 'localhost';
      console.log(`⚙️ Server is running at: http://${lanIp}:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('❌ MongoDB connection failed!', err);
  });
