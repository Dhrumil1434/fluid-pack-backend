import { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { ApiError } from '../../../../utils/ApiError';
import PermissionConfigService from '../services/permissionConfig.service';
import { ActionType } from '../../../../models/permissionConfig.model';

type RoleType = string | { name?: string; _id?: string };
interface RequestWithAuth extends Request {
  user?: { _id: string; role: RoleType };
  permissionInfo?: {
    actions?: ActionType[];
    adminOverride?: boolean;
    requiresApproval?: boolean;
    approverRoles?: string[];
    reason?: string | undefined;
  };
}

export const checkPermission = (actions: ActionType[]) => {
  return async (
    req: Request,
    _res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      // User must be authenticated and attached to req.user
      const user = (req as RequestWithAuth).user;
      if (!user) {
        throw new ApiError(
          'PERMISSION_CHECK',
          StatusCodes.UNAUTHORIZED,
          'USER_NOT_AUTHENTICATED',
          'User authentication required',
        );
      }

      // Admin bypass: allow all actions
      // Handle both string role and populated role object
      const userRole =
        user && typeof user.role === 'string'
          ? user.role
          : (user?.role as { name?: string })?.name;
      if (userRole === 'admin') {
        (req as RequestWithAuth).permissionInfo = {
          actions,
          adminOverride: true,
          reason: 'Admin role override - full access granted',
        };
        return next();
      }

      // Extract context (categoryId, machineValue) from body or query
      const body = (req as Request & { body: Record<string, unknown> }).body;
      const query = (req as Request & { query: Record<string, unknown> }).query;
      const categoryId =
        (body?.['categoryId'] as string | undefined) ||
        (body?.['category_id'] as string | undefined) ||
        (query?.['categoryId'] as string | undefined);
      const machineValueRaw =
        (body?.['machineValue'] as string | number | undefined) ||
        (query?.['machineValue'] as string | number | undefined);

      // Check all actions
      for (const action of actions) {
        const result = await PermissionConfigService.checkPermission(
          user._id,
          action,
          categoryId,
          machineValueRaw !== undefined
            ? parseFloat(String(machineValueRaw))
            : undefined,
        );
        if (!result.allowed) {
          if (result.requiresApproval) {
            // Allow request to proceed but mark that approval is required
            const existingInfo: RequestWithAuth['permissionInfo'] =
              (req as RequestWithAuth).permissionInfo || {};
            (req as RequestWithAuth).permissionInfo = {
              ...existingInfo,
              actions,
              adminOverride: false,
              requiresApproval: true,
              approverRoles: (result.approverRoles || []).map(String),
              reason: result.reason,
            };
            continue; // do not block
          }
          // Explicitly denied
          throw new ApiError(
            'PERMISSION_CHECK',
            StatusCodes.FORBIDDEN,
            'PERMISSION_DENIED',
            `Action '${action}' denied. ${result.reason}`,
          );
        }
      }

      // Attach/merge permission info for downstream use without overwriting earlier flags
      const existing = (req as RequestWithAuth).permissionInfo || {};
      (req as RequestWithAuth).permissionInfo = {
        ...existing,
        actions,
        adminOverride: existing.adminOverride ?? false,
      };
      next();
    } catch (error) {
      next(error);
    }
  };
};
