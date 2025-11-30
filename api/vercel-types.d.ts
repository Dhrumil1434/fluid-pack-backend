/**
 * Type declarations for Vercel serverless functions
 * These types are provided by Vercel at runtime
 */

declare module '@vercel/node' {
  export interface VercelRequest {
    method?: string;
    url?: string;
    headers: Record<string, string | string[] | undefined>;
    query: Record<string, string | string[] | undefined>;
    body?: unknown;
    cookies?: Record<string, string>;
  }

  export interface VercelResponse {
    status(code: number): VercelResponse;
    json(body: unknown): VercelResponse;
    send(body: unknown): VercelResponse;
    end(body?: unknown): VercelResponse;
    setHeader(name: string, value: string | string[]): VercelResponse;
    getHeader(name: string): string | string[] | undefined;
    removeHeader(name: string): VercelResponse;
  }
}

