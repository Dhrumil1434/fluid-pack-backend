// services/permissionConfig.service.ts
import mongoose from 'mongoose';
import { StatusCodes } from 'http-status-codes';
import {
  PermissionConfig,
  IPermissionConfig,
  ActionType,
  PermissionLevel,
} from '../../../../models/permissionConfig.model';
import { IUser, User } from '../../../../models/user.model';

import { ApiError } from '../../../../utils/ApiError';
import { ERROR_MESSAGES } from '../permissionCongif.error.constants';

export interface CreatePermissionConfigData {
  name: string;
  description: string;
  action: ActionType;
  roleIds?: string[] | undefined;
  userIds?: string[] | undefined;
  departmentIds?: string[] | undefined;
  categoryIds?: string[] | undefined;
  permission: PermissionLevel;
  approverRoles?: string[] | undefined;
  maxValue?: number | undefined;
  priority?: number | undefined;
  createdBy: string;
}

export interface UpdatePermissionConfigData {
  name?: string;
  description?: string;
  action?: ActionType;
  roleIds?: string[];
  userIds?: string[];
  departmentIds?: string[];
  categoryIds?: string[];
  permission?: PermissionLevel;
  approverRoles?: string[];
  maxValue?: number;
  priority?: number;
  isActive?: boolean;
}

export interface PermissionCheckResult {
  allowed: boolean;
  requiresApproval: boolean;
  approverRoles?: mongoose.Types.ObjectId[];
  matchedRule?: IPermissionConfig;
  reason?: string;
  matchedBy?: string | undefined; // What condition matched (role, user, department, category)
}

export interface PaginatedPermissionConfigs {
  configs: IPermissionConfig[];
  total: number;
  pages: number;
}

export interface UserPermissions {
  [key: string]: PermissionCheckResult;
}

class PermissionConfigService {
  /**
   * Create a new permission configuration
   */
  static async create(
    data: CreatePermissionConfigData,
  ): Promise<IPermissionConfig> {
    try {
      // Check for duplicate priority if specified
      if (data.priority && data.priority > 0) {
        const existingConfig = await PermissionConfig.findOne({
          priority: data.priority,
          isActive: true,
          action: data.action, // Check priority within same action
        });

        if (existingConfig) {
          throw new ApiError(
            ERROR_MESSAGES.PERMISSION_CONFIG.ACTION.create,
            StatusCodes.CONFLICT,
            ERROR_MESSAGES.PERMISSION_CONFIG.INVALID_PRIORITY.code,
            ERROR_MESSAGES.PERMISSION_CONFIG.INVALID_PRIORITY.message,
          );
        }
      }

      // Convert string IDs to ObjectIds
      const permissionConfigData = {
        name: data.name,
        description: data.description,
        action: data.action,
        permission: data.permission,
        priority: data.priority || 0,
        isActive: true,
        roleIds: data.roleIds?.map((id) => new mongoose.Types.ObjectId(id)),
        userIds: data.userIds?.map((id) => new mongoose.Types.ObjectId(id)),
        departmentIds: data.departmentIds?.map(
          (id) => new mongoose.Types.ObjectId(id),
        ),
        categoryIds: data.categoryIds?.map(
          (id) => new mongoose.Types.ObjectId(id),
        ),
        approverRoles: data.approverRoles?.map(
          (id) => new mongoose.Types.ObjectId(id),
        ),
        maxValue: data.maxValue,
        createdBy: new mongoose.Types.ObjectId(data.createdBy),
      };

      const permissionConfig = new PermissionConfig(permissionConfigData);
      await permissionConfig.save();

      return permissionConfig;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        ERROR_MESSAGES.PERMISSION_CONFIG.ACTION.create,
        StatusCodes.INTERNAL_SERVER_ERROR,
        'PERMISSION_CONFIG_CREATION_FAILED',
        'Failed to create permission configuration',
      );
    }
  }

  /**
   * Get all permission configurations with pagination
   */
  static async getAll(
    page = 1,
    limit = 10,
  ): Promise<PaginatedPermissionConfigs> {
    const skip = (page - 1) * limit;

    const [configs, total] = await Promise.all([
      PermissionConfig.find()
        .populate('roleIds', 'name')
        .populate('userIds', 'username email')
        .populate('departmentIds', 'name')
        .populate('categoryIds', 'name')
        .populate('approverRoles', 'name')
        .populate('createdBy', 'username email')
        .sort({ priority: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      PermissionConfig.countDocuments(),
    ]);

    return {
      configs: configs as IPermissionConfig[],
      total,
      pages: Math.ceil(total / limit),
    };
  }

  /**
   * Get permission configurations by action
   */
  static async getByAction(
    action: ActionType,
    page = 1,
    limit = 10,
  ): Promise<PaginatedPermissionConfigs> {
    const skip = (page - 1) * limit;

    const [configs, total] = await Promise.all([
      PermissionConfig.find({ action, isActive: true })
        .populate('roleIds', 'name')
        .populate('userIds', 'username email')
        .populate('departmentIds', 'name')
        .populate('categoryIds', 'name')
        .populate('approverRoles', 'name')
        .populate('createdBy', 'username email')
        .sort({ priority: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      PermissionConfig.countDocuments({ action, isActive: true }),
    ]);

    return {
      configs: configs as IPermissionConfig[],
      total,
      pages: Math.ceil(total / limit),
    };
  }

  /**
   * Get permission configuration by ID
   */
  static async getById(id: string): Promise<IPermissionConfig> {
    const permissionConfig = await PermissionConfig.findById(id)
      .populate('roleIds', 'name')
      .populate('userIds', 'username email')
      .populate('departmentIds', 'name')
      .populate('categoryIds', 'name')
      .populate('approverRoles', 'name')
      .populate('createdBy', 'username email');

    if (!permissionConfig) {
      throw new ApiError(
        ERROR_MESSAGES.PERMISSION_CONFIG.ACTION.get,
        StatusCodes.NOT_FOUND,
        ERROR_MESSAGES.PERMISSION_CONFIG.NOT_FOUND.code,
        ERROR_MESSAGES.PERMISSION_CONFIG.NOT_FOUND.message,
      );
    }

    return permissionConfig;
  }

  /**
   * Update permission configuration
   */
  static async update(
    id: string,
    data: UpdatePermissionConfigData,
  ): Promise<IPermissionConfig> {
    try {
      // Check if priority is being updated and if it conflicts
      if (data.priority !== undefined && data.priority > 0) {
        const existingConfig = await PermissionConfig.findOne({
          priority: data.priority,
          isActive: true,
          _id: { $ne: id },
        });

        if (existingConfig) {
          throw new ApiError(
            ERROR_MESSAGES.PERMISSION_CONFIG.ACTION.update,
            StatusCodes.CONFLICT,
            ERROR_MESSAGES.PERMISSION_CONFIG.INVALID_PRIORITY.code,
            ERROR_MESSAGES.PERMISSION_CONFIG.INVALID_PRIORITY.message,
          );
        }
      }

      // Convert string IDs to ObjectIds
      const updateData: Record<string, unknown> = {};

      if (data.name !== undefined) updateData['name'] = data.name;
      if (data.description !== undefined)
        updateData['description'] = data.description;
      if (data.action !== undefined) updateData['action'] = data.action;
      if (data.permission !== undefined)
        updateData['permission'] = data.permission;
      if (data.priority !== undefined) updateData['priority'] = data.priority;
      if (data.isActive !== undefined) updateData['isActive'] = data.isActive;
      if (data.maxValue !== undefined) updateData['maxValue'] = data.maxValue;

      if (data.roleIds !== undefined) {
        updateData['roleIds'] = data.roleIds.map(
          (id) => new mongoose.Types.ObjectId(id),
        );
      }
      if (data.userIds !== undefined) {
        updateData['userIds'] = data.userIds.map(
          (id) => new mongoose.Types.ObjectId(id),
        );
      }
      if (data.departmentIds !== undefined) {
        updateData['departmentIds'] = data.departmentIds.map(
          (id) => new mongoose.Types.ObjectId(id),
        );
      }
      if (data.categoryIds !== undefined) {
        updateData['categoryIds'] = data.categoryIds.map(
          (id) => new mongoose.Types.ObjectId(id),
        );
      }
      if (data.approverRoles !== undefined) {
        updateData['approverRoles'] = data.approverRoles.map(
          (id) => new mongoose.Types.ObjectId(id),
        );
      }

      const permissionConfig = await PermissionConfig.findByIdAndUpdate(
        id,
        updateData,
        {
          new: true,
          runValidators: true,
        },
      )
        .populate('roleIds', 'name')
        .populate('userIds', 'username email')
        .populate('departmentIds', 'name')
        .populate('categoryIds', 'name')
        .populate('approverRoles', 'name')
        .populate('createdBy', 'username email');

      if (!permissionConfig) {
        throw new ApiError(
          ERROR_MESSAGES.PERMISSION_CONFIG.ACTION.update,
          StatusCodes.NOT_FOUND,
          ERROR_MESSAGES.PERMISSION_CONFIG.NOT_FOUND.code,
          ERROR_MESSAGES.PERMISSION_CONFIG.NOT_FOUND.message,
        );
      }

      return permissionConfig;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        ERROR_MESSAGES.PERMISSION_CONFIG.ACTION.update,
        StatusCodes.INTERNAL_SERVER_ERROR,
        'PERMISSION_CONFIG_UPDATE_FAILED',
        'Failed to update permission configuration',
      );
    }
  }

  /**
   * Delete permission configuration (soft delete)
   */
  static async delete(id: string): Promise<void> {
    const permissionConfig = await PermissionConfig.findByIdAndUpdate(
      id,
      { isActive: false },
      { new: true },
    );

    if (!permissionConfig) {
      throw new ApiError(
        ERROR_MESSAGES.PERMISSION_CONFIG.ACTION.delete,
        StatusCodes.NOT_FOUND,
        ERROR_MESSAGES.PERMISSION_CONFIG.NOT_FOUND.code,
        ERROR_MESSAGES.PERMISSION_CONFIG.NOT_FOUND.message,
      );
    }
  }

  /**
   * Toggle permission configuration active status
   */
  static async toggleActiveStatus(id: string): Promise<IPermissionConfig> {
    const currentConfig = await this.getById(id);
    return this.update(id, { isActive: !currentConfig.isActive });
  }

  /**
   * Check permissions for a user and action
   */
  static async checkPermission(
    userId: string,
    action: ActionType,
    categoryId?: string,
    machineValue?: number,
  ): Promise<PermissionCheckResult> {
    try {
      // Get user details with role and department - Fixed the populate issue
      const user = await User.findById(userId)
        .populate('role', 'name')
        .populate('department', 'name');

      if (!user) {
        return {
          allowed: false,
          requiresApproval: false,
          reason: 'User not found',
        };
      }

      // Get all active permission configs for this action, sorted by priority (highest first)
      const permissionConfigs = await PermissionConfig.find({
        action,
        isActive: true,
      }).sort({ priority: -1, createdAt: -1 });

      if (permissionConfigs.length === 0) {
        return {
          allowed: false,
          requiresApproval: false,
          reason: 'No permission rules found for this action',
        };
      }

      // Check each config in priority order
      for (const config of permissionConfigs) {
        const matchResult = this.checkConfigMatch(
          user,
          config,
          categoryId,
          machineValue,
        );

        if (matchResult.matches) {
          switch (config.permission) {
            case PermissionLevel.ALLOWED:
              return {
                allowed: true,
                requiresApproval: false,
                matchedRule: config,
                matchedBy: matchResult.matchedBy,
                reason: `Access granted by ${matchResult.matchedBy} permission rule`,
              };

            case PermissionLevel.REQUIRES_APPROVAL: {
              const result: PermissionCheckResult = {
                allowed: false,
                requiresApproval: true,
                matchedRule: config,
                matchedBy: matchResult.matchedBy,
                reason: `Approval required by ${matchResult.matchedBy} permission rule`,
              };

              if (config.approverRoles && config.approverRoles.length > 0) {
                result.approverRoles = config.approverRoles;
              }

              return result;
            }

            case PermissionLevel.DENIED:
              return {
                allowed: false,
                requiresApproval: false,
                matchedRule: config,
                matchedBy: matchResult.matchedBy,
                reason: `Access denied by ${matchResult.matchedBy} permission rule`,
              };
          }
        }
      }

      // No matching rule found - default to denied
      return {
        allowed: false,
        requiresApproval: false,
        reason: 'No matching permission rule found - access denied by default',
      };
    } catch (error) {
      console.error('Permission check error:', error);
      throw new ApiError(
        'CHECKING_PERMISSION',
        StatusCodes.INTERNAL_SERVER_ERROR,
        'PERMISSION_CHECK_FAILED',
        'Failed to check permissions',
      );
    }
  }

  /**
   * Get all permissions for a user
   */
  static async getUserPermissions(
    userId: string,
    categoryId?: string,
    machineValue?: number,
  ): Promise<UserPermissions> {
    const actions = Object.values(ActionType);
    const permissions: UserPermissions = {};

    for (const action of actions) {
      try {
        permissions[action] = await this.checkPermission(
          userId,
          action,
          categoryId,
          machineValue,
        );
      } catch {
        permissions[action] = {
          allowed: false,
          requiresApproval: false,
          reason: 'Error checking permission',
        };
      }
    }

    return permissions;
  }

  /**
   * Check if a permission config matches the user and context
   */
  private static checkConfigMatch(
    user: IUser,
    config: IPermissionConfig,
    categoryId?: string,
    machineValue?: number,
  ): { matches: boolean; matchedBy?: string } {
    const conditions = [];

    // Check user-specific rules
    if (config.userIds && config.userIds.length > 0) {
      const userIdStrings = config.userIds.map((id) => id.toString());
      if (userIdStrings.includes(user.id.toString())) {
        return { matches: true, matchedBy: 'user-specific rule' };
      }
      conditions.push('user');
    }

    // Check role-specific rules - Fixed property access
    if (config.roleIds && config.roleIds.length > 0 && user.role) {
      const roleIdStrings = config.roleIds.map((id) => id.toString());
      if (roleIdStrings.includes(user.role.toString())) {
        return { matches: true, matchedBy: 'role-based rule' };
      }
      conditions.push('role');
    }

    // Check department-specific rules - Fixed property access
    if (
      config.departmentIds &&
      config.departmentIds.length > 0 &&
      user.department
    ) {
      const deptIdStrings = config.departmentIds.map((id) => id.toString());
      if (deptIdStrings.includes(user.department.toString())) {
        return { matches: true, matchedBy: 'department-based rule' };
      }
      conditions.push('department');
    }

    // Check category-specific rules
    if (config.categoryIds && config.categoryIds.length > 0) {
      if (!categoryId) {
        // If config has category restriction but no categoryId provided, no match
        return { matches: false };
      }
      const categoryIdStrings = config.categoryIds.map((id) => id.toString());
      if (!categoryIdStrings.includes(categoryId)) {
        return { matches: false };
      }
      conditions.push('category');
    }

    // Check value-based rules
    if (config.maxValue !== undefined) {
      if (machineValue === undefined || machineValue > config.maxValue) {
        return { matches: false };
      }
      conditions.push('value');
    }

    // If we have at least one condition and all specified conditions passed, it's a match
    if (conditions.length > 0) {
      return { matches: true, matchedBy: conditions.join(' + ') + ' rule' };
    }

    // If no conditions are specified, it's a global rule (matches everyone)
    if (
      (!config.userIds || config.userIds.length === 0) &&
      (!config.roleIds || config.roleIds.length === 0) &&
      (!config.departmentIds || config.departmentIds.length === 0) &&
      (!config.categoryIds || config.categoryIds.length === 0)
    ) {
      return { matches: true, matchedBy: 'global rule' };
    }

    return { matches: false };
  }
}

export default PermissionConfigService;
