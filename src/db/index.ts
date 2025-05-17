/**
 * @module DatabaseConnection
 * @description Handles MongoDB connection using Mongoose.
 */

import mongoose, { Connection } from 'mongoose';

import dotenv from 'dotenv';
dotenv.config();

/**
 * Connects to the MongoDB database.
 *
 * @async
 * @function connectDB
 * @returns {Promise<Connection | void>} Resolves with the Mongoose connection instance or exits on failure.
 * @throws Will log an error and terminate the process if the connection fails.
 */
const connectDB = async (): Promise<Connection | void> => {
  try {
    if (!process.env['MONGO_URI']) {
      throw new Error('MONGO_URI is not defined in environment variables');
    }

    const connectionInstance = await mongoose.connect(
      `${process.env['MONGO_URI']}`,
    );

    console.log(
      `✅ MongoDB connected! Host: ${connectionInstance.connection.host}`,
    );

    return connectionInstance.connection;
  } catch (error) {
    console.error('❌ Error connecting to MongoDB:', error);
    process.exit(1); // Exit the process with failure code
  }
};

export default connectDB;
