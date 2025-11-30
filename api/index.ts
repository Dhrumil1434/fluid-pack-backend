/**
 * Vercel Serverless Function Entry Point
 * This file wraps the Express app for Vercel's serverless environment
 */

import type { Request, Response, NextFunction } from 'express';
import app from '../src/app';
import connectDB from '../src/db/index';

// Vercel types (provided at runtime by Vercel)
interface VercelRequest {
  method?: string;
  url?: string;
  headers: Record<string, string | string[] | undefined>;
  query: Record<string, string | string[] | undefined>;
  body?: unknown;
  cookies?: Record<string, string>;
}

interface VercelResponse {
  status(code: number): VercelResponse;
  json(body: unknown): VercelResponse;
  send(body: unknown): VercelResponse;
  end(body?: unknown): VercelResponse;
  setHeader(name: string, value: string | string[]): VercelResponse;
  getHeader(name: string): string | string[] | undefined;
  removeHeader(name: string): VercelResponse;
}

// Initialize database connection (cached across invocations)
let dbConnected = false;

const connectDatabase = async (): Promise<void> => {
  if (!dbConnected) {
    try {
      await connectDB();
      dbConnected = true;
      console.log('✅ Database connection established');
    } catch (error) {
      console.error('❌ Database connection failed:', error);
      dbConnected = false;
      throw error;
    }
  }
};

// Vercel serverless function handler
export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  // Connect to database on first invocation
  await connectDatabase();

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Proxy the request to Express app
  return new Promise<void>((resolve, reject) => {
    const expressReq = req as unknown as Request;
    const expressRes = res as unknown as Response;
    const next: NextFunction = (err?: Error | string) => {
      if (err) {
        const error = err instanceof Error ? err : new Error(err);
        reject(error);
      } else {
        resolve();
      }
    };

    app(expressReq, expressRes, next);
  });
}
