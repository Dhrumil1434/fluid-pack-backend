import dotenv from 'dotenv';
import connectDB from './db/index';
import app from './app';
dotenv.config();

const PORT = process.env['PORT'] || 3000;
console.log('hello');

connectDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`⚙️ Server is running at: http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('❌ MongoDB connection failed!', err);
  });
