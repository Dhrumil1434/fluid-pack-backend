import { Request, Response, NextFunction } from 'express';
import chalk from 'chalk';
const errorHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
) => {
  const e = err as {
    errorCode?: string;
    code?: string;
    message?: string;
    statusCode?: number;
    status?: number;
    errors?: unknown[];
    data?: unknown;
    action?: string;
  };
  const errorCode = e?.errorCode || e?.code || 'INTERNAL_ERROR';
  const message = e?.message || 'Something went wrong';
  const statusCode = e?.statusCode || e?.status || 500;
  const errors = Array.isArray(e?.errors) ? (e.errors as unknown[]) : [];
  const data = e?.data ?? undefined;

  console.error(
    chalk.red(`[${new Date().toISOString()}] ${errorCode}: ${message}`),
  );
  if (errors.length > 0) {
    console.error(
      chalk.yellow('Details:'),
      chalk.cyan(JSON.stringify(errors, null, 2)),
    );
    console.error(
      chalk.yellow('Data:'),
      chalk.cyan(JSON.stringify(data, null, 2)),
    );
  }

  res.status(statusCode).json({
    success: false,
    action: e?.action,
    errorCode,
    message,
    errors,
    data,
  });
};

export { errorHandler };
