import { Request, Response, NextFunction } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';

// Extend Express Request with `user`
interface AuthenticatedRequest extends Request {
  user?: any;
}

export const authorizeRoles = (...allowedRoles: string[]) =>
  asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userRole = req.user?.role?.name;

    if (!allowedRoles.includes(userRole)) {
      throw new ApiError(403, 'FORBIDDEN', `Access denied for role: ${userRole}`);
    }

    next();
  });
