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

      // Get user role - handle both Mongoose document and plain object
      let userRoleName: string | null = null;
      let userRoleId: string | null = null;

      // Check if user.role is populated or just an ObjectId
      if (user && user.role) {
        if (typeof user.role === 'string') {
          // Role is ObjectId string, need to populate
          userRoleId = user.role;
          const { User } = await import('../../../../models/user.model');
          const populatedUser = await User.findById(user._id)
            .populate('role', 'name')
            .lean();
          if (populatedUser?.role) {
            const role = populatedUser.role as { name?: string; _id?: unknown };
            userRoleName = role?.name?.toLowerCase() || null;
            userRoleId = role?._id?.toString() || userRoleId;
          }
        } else if (typeof user.role === 'object' && user.role !== null) {
          // Role is already populated
          const role = user.role as { name?: string; _id?: unknown };
          userRoleName = role?.name?.toLowerCase() || null;
          userRoleId = role?._id?.toString() || null;
        }
      }

      // Check by role name first
      let isAdminRole = userRoleName === 'admin';
      let isSubAdminRole = userRoleName === 'sub-admin';

      // If not found by name, check by role ID
      if (!isAdminRole && !isSubAdminRole && userRoleId) {
        const { Role } = await import('../../../../models/role.model');
        const adminRole = await Role.findOne({ name: 'admin' })
          .select('_id')
          .lean();
        const subAdminRole = await Role.findOne({ name: 'sub-admin' })
          .select('_id')
          .lean();

        if (adminRole?._id && userRoleId === adminRole._id.toString()) {
          isAdminRole = true;
        } else if (
          subAdminRole?._id &&
          userRoleId === subAdminRole._id.toString()
        ) {
          isSubAdminRole = true;
        }
      }

      if (isAdminRole) {
        (req as RequestWithAuth).permissionInfo = {
          actions,
          adminOverride: true,
          reason: 'Admin role override - full access granted',
        };
        return next();
      }

      // Sub-admin bypass: allow VIEW actions only (read-only access)
      if (isSubAdminRole) {
        const viewActions = [
          ActionType.VIEW_SO,
          ActionType.VIEW_MACHINE,
          ActionType.VIEW_QC_ENTRY,
          ActionType.VIEW_QC_APPROVAL,
        ];
        const isViewAction = actions.every((action) =>
          viewActions.includes(action),
        );

        if (isViewAction) {
          (req as RequestWithAuth).permissionInfo = {
            actions,
            adminOverride: false,
            reason: 'Sub-admin role - read-only access granted',
          };
          return next();
        }
        // For non-view actions, continue with permission check (may require approval)
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
      // Get user ID - handle both Mongoose document and plain object
      const userId =
        typeof user._id === 'string'
          ? user._id
          : (user._id as { toString?: () => string })?.toString?.() ||
            String(user._id);

      for (const action of actions) {
        const result = await PermissionConfigService.checkPermission(
          userId,
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
