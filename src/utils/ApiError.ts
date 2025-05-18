import { StatusCodes, getReasonPhrase } from 'http-status-codes';

interface ErrorDetail {
  field: string;
  message: string;
}

// Define DataDetail type properly
interface DataDetail {
  expectedField: string;
  description: string;
}

class ApiError extends Error {
  action: string;
  statusCode: number;
  errorCode: string;
  success: boolean;
  errors: ErrorDetail[];
  data: DataDetail[]; // ✅ Properly typed data as an array of objects

  constructor(
    action: string = 'INTERNAL_ACTION',
    statusCode: number = StatusCodes.INTERNAL_SERVER_ERROR,
    errorCode: string = 'INTERNAL_ERROR',

    message: string = getReasonPhrase(statusCode),
    errors: ErrorDetail[] = [],
    data: DataDetail[] = [], // ✅ Ensures it's an array of { expectedField, description }
    stack: string = '',
  ) {
    super(message);
    this.action = action;
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.success = false;
    this.errors = errors;
    this.data = data;

    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

export { ApiError };
export type { ErrorDetail, DataDetail };
