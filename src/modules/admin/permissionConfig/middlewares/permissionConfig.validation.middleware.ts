import { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { ApiError } from '../../../../utils/ApiError';
import PermissionConfigService from '../services/permissionConfig.service';
import { ActionType } from '../../../../models/permissionConfig.model';

export const checkPermission = (actions: ActionType[]) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // User must be authenticated and attached to req.user
      const user = (req as any).user;
      if (!user) {
        throw new ApiError(
          'PERMISSION_CHECK',
          StatusCodes.UNAUTHORIZED,
          'USER_NOT_AUTHENTICATED',
          'User authentication required',
        );
      }

      // Admin bypass: allow all actions
      if (user.role === 'admin') {
        (req as any).permissionInfo = {
          actions,
          adminOverride: true,
          reason: 'Admin role override - full access granted',
        };
        return next();
      }

      // Extract context (categoryId, machineValue) from body or query
      const categoryId = req.body?.['categoryId'] || req.body?.['category_id'] || req.query?.['categoryId'];
      const machineValue = req.body?.['machineValue'] || req.query?.['machineValue'];

      // Check all actions
      for (const action of actions) {
        const result = await PermissionConfigService.checkPermission(
          user._id,
          action,
          categoryId,
          machineValue !== undefined ? parseFloat(machineValue) : undefined,
        );
        if (!result.allowed) {
          if (result.requiresApproval) {
            throw new ApiError(
              'PERMISSION_CHECK',
              StatusCodes.FORBIDDEN,
              'APPROVAL_REQUIRED',
              `Action '${action}' requires approval. ${result.reason}`,
            );
          } else {
            throw new ApiError(
              'PERMISSION_CHECK',
              StatusCodes.FORBIDDEN,
              'PERMISSION_DENIED',
              `Action '${action}' denied. ${result.reason}`,
            );
          }
        }
      }

      // Attach permission info for downstream use
      (req as any).permissionInfo = {
        actions,
        adminOverride: false,
      };
      next();
    } catch (error) {
      next(error);
    }
  };
};
