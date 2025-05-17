// src/types/env.d.ts
import { Secret } from 'jsonwebtoken';

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      ACCESS_TOKEN_SECRET: Secret;
      ACCESS_TOKEN_EXPIRY: Secret; // Explicitly define as string
      REFRESH_TOKEN_SECRET: Secret;
      REFRESH_TOKEN_EXPIRY: string;
    }
  }
}

export {};
