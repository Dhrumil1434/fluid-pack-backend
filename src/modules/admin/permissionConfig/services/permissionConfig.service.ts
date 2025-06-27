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

// Constants
const DEFAULT_PAGE_SIZE = 10;
const DEFAULT_PRIORITY = 0;
const CACHE_TIMEOUT = 5 * 60 * 1000; // 5 minutes

// Populate options for consistent data fetching
const POPULATE_OPTIONS = {
  roleIds: { path: 'roleIds', select: 'name' },
  userIds: { path: 'userIds', select: 'username email' },
  departmentIds: { path: 'departmentIds', select: 'name' },
  categoryIds: { path: 'categoryIds', select: 'name' },
  approverRoles: { path: 'approverRoles', select: 'name' },
  createdBy: { path: 'createdBy', select: 'username email' },
} as const;

// Types
export interface CreatePermissionConfigData {
  name: string;
  description: string;
  action: ActionType;
  roleIds?: string[];
  userIds?: string[];
  departmentIds?: string[];
  categoryIds?: string[];
  permission: PermissionLevel;
  approverRoles?: string[];
  maxValue?: number;
  priority?: number;
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
  matchedBy?: string;
}

export interface PaginatedPermissionConfigs {
  configs: IPermissionConfig[];
  total: number;
  pages: number;
}

export interface UserPermissions {
  [key: string]: PermissionCheckResult;
}

interface ConfigMatchResult {
  matches: boolean;
  matchedBy?: string;
}

class PermissionConfigService {
  // Cache for permission configs to reduce database calls
  private static permissionCache = new Map<string, IPermissionConfig[]>();
  private static cacheTimeout = 5 * 60 * 1000; // 5 minutes
  private static lastCacheUpdate = 0;

  /**
   * Clear permission cache
   */
  private static clearCache(): void {
    this.permissionCache.clear();
    this.lastCacheUpdate = 0;
  }

  /**
   * Check if cache is valid
   */
  private static isCacheValid(): boolean {
    return Date.now() - this.lastCacheUpdate < this.cacheTimeout;
  }

  /**
   * Get cached permission configs for an action
   */
  private static getCachedConfigs(action: ActionType): IPermissionConfig[] | null {
    if (!this.isCacheValid()) {
      this.clearCache();
      return null;
    }
    return this.permissionCache.get(action) || null;
  }

  /**
   * Cache permission configs for an action
   */
  private static cacheConfigs(action: ActionType, configs: IPermissionConfig[]): void {
    this.permissionCache.set(action, configs);
    this.lastCacheUpdate = Date.now();
  }

  /**
   * Convert string IDs to ObjectIds safely
   */
  private static convertToObjectIds(ids?: string[]): mongoose.Types.ObjectId[] | undefined {
    if (!ids || ids.length === 0) return undefined;
    return ids.map(id => new mongoose.Types.ObjectId(id));
  }

  /**
   * Create standardized populate query
   */
  private static createPopulateQuery() {
    return PermissionConfig.find()
      .populate(POPULATE_OPTIONS.roleIds)
      .populate(POPULATE_OPTIONS.userIds)
      .populate(POPULATE_OPTIONS.departmentIds)
      .populate(POPULATE_OPTIONS.categoryIds)
      .populate(POPULATE_OPTIONS.approverRoles)
      .populate(POPULATE_OPTIONS.createdBy);
  }

  /**
   * Create standardized error
   */
  private static createError(
    action: string,
    statusCode: number,
    errorCode: string,
    message: string
  ): ApiError {
    return new ApiError(action, statusCode, errorCode, message);
  }

  /**
   * Validate priority uniqueness
   */
  private static async validatePriority(
    priority: number,
    action?: ActionType,
    excludeId?: string
  ): Promise<void> {
    if (priority <= 0) return;

    const query: any = {
      priority,
      isActive: true,
    };

    if (action) {
      query.action = action;
    }

    if (excludeId) {
      query._id = { $ne: excludeId };
    }

    const existingConfig = await PermissionConfig.findOne(query);

    if (existingConfig) {
      throw this.createError(
        ERROR_MESSAGES.PERMISSION_CONFIG.ACTION.create,
        StatusCodes.CONFLICT,
        ERROR_MESSAGES.PERMISSION_CONFIG.INVALID_PRIORITY.code,
        ERROR_MESSAGES.PERMISSION_CONFIG.INVALID_PRIORITY.message,
      );
    }
  }

  /**
   * Create a new permission configuration
   */
  static async create(data: CreatePermissionConfigData): Promise<IPermissionConfig> {
    try {
      // Validate priority if specified
      if (data.priority) {
        await this.validatePriority(data.priority, data.action);
      }

      // Prepare data with ObjectId conversion
      const permissionConfigData = {
        name: data.name,
        description: data.description,
        action: data.action,
        permission: data.permission,
        priority: data.priority || DEFAULT_PRIORITY,
        isActive: true,
        roleIds: this.convertToObjectIds(data.roleIds),
        userIds: this.convertToObjectIds(data.userIds),
        departmentIds: this.convertToObjectIds(data.departmentIds),
        categoryIds: this.convertToObjectIds(data.categoryIds),
        approverRoles: this.convertToObjectIds(data.approverRoles),
        maxValue: data.maxValue,
        createdBy: new mongoose.Types.ObjectId(data.createdBy),
      };

      const permissionConfig = new PermissionConfig(permissionConfigData);
      await permissionConfig.save();

      // Clear cache after creation
      this.clearCache();

      return permissionConfig;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      
      throw this.createError(
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
  static async getAll(page = 1, limit = DEFAULT_PAGE_SIZE): Promise<PaginatedPermissionConfigs> {
    const skip = (page - 1) * limit;

    const [configs, total] = await Promise.all([
      this.createPopulateQuery()
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
    limit = DEFAULT_PAGE_SIZE
  ): Promise<PaginatedPermissionConfigs> {
    const skip = (page - 1) * limit;

    const [configs, total] = await Promise.all([
      this.createPopulateQuery()
        .where({ action, isActive: true })
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
    const permissionConfig = await this.createPopulateQuery()
      .findById(id)
      .lean();

    if (!permissionConfig) {
      throw this.createError(
        ERROR_MESSAGES.PERMISSION_CONFIG.ACTION.get,
        StatusCodes.NOT_FOUND,
        ERROR_MESSAGES.PERMISSION_CONFIG.NOT_FOUND.code,
        ERROR_MESSAGES.PERMISSION_CONFIG.NOT_FOUND.message,
      );
    }

    return permissionConfig as IPermissionConfig;
  }

  /**
   * Update permission configuration
   */
  static async update(id: string, data: UpdatePermissionConfigData): Promise<IPermissionConfig> {
    try {
      // Validate priority if being updated
      if (data.priority !== undefined) {
        await this.validatePriority(data.priority, data.action ?? undefined, id);
      }

      // Build update data object
      const updateData: Record<string, unknown> = {};
      
      // Simple field updates
      const simpleFields = ['name', 'description', 'action', 'permission', 'priority', 'isActive', 'maxValue'];
      simpleFields.forEach(field => {
        if (data[field as keyof UpdatePermissionConfigData] !== undefined) {
          updateData[field] = data[field as keyof UpdatePermissionConfigData];
        }
      });

      // ID array field updates
      const idFields = ['roleIds', 'userIds', 'departmentIds', 'categoryIds', 'approverRoles'];
      idFields.forEach(field => {
        if (data[field as keyof UpdatePermissionConfigData] !== undefined) {
          updateData[field] = this.convertToObjectIds(data[field as keyof UpdatePermissionConfigData] as string[]);
        }
      });

      const permissionConfig = await PermissionConfig.findByIdAndUpdate(
        id,
        updateData,
        { new: true, runValidators: true }
      )
        .populate(POPULATE_OPTIONS.roleIds)
        .populate(POPULATE_OPTIONS.userIds)
        .populate(POPULATE_OPTIONS.departmentIds)
        .populate(POPULATE_OPTIONS.categoryIds)
        .populate(POPULATE_OPTIONS.approverRoles)
        .populate(POPULATE_OPTIONS.createdBy)
        .lean();

      if (!permissionConfig) {
        throw this.createError(
          ERROR_MESSAGES.PERMISSION_CONFIG.ACTION.update,
          StatusCodes.NOT_FOUND,
          ERROR_MESSAGES.PERMISSION_CONFIG.NOT_FOUND.code,
          ERROR_MESSAGES.PERMISSION_CONFIG.NOT_FOUND.message,
        );
      }

      // Clear cache after update
      this.clearCache();

      return permissionConfig as IPermissionConfig;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      
      throw this.createError(
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
      { new: true }
    );

    if (!permissionConfig) {
      throw this.createError(
        ERROR_MESSAGES.PERMISSION_CONFIG.ACTION.delete,
        StatusCodes.NOT_FOUND,
        ERROR_MESSAGES.PERMISSION_CONFIG.NOT_FOUND.code,
        ERROR_MESSAGES.PERMISSION_CONFIG.NOT_FOUND.message,
      );
    }

    // Clear cache after deletion
    this.clearCache();
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
      // Get user details with role and department
      const user = await User.findById(userId)
        .populate('role', 'name')
        .populate('department', 'name')
        .lean();

      if (!user) {
        return {
          allowed: false,
          requiresApproval: false,
          reason: 'User not found',
        };
      }

      // Try to get cached configs first
      let permissionConfigs = this.getCachedConfigs(action);

      if (!permissionConfigs) {
        // Fetch from database if not cached
        permissionConfigs = await PermissionConfig.find({
          action,
          isActive: true,
        })
          .sort({ priority: -1, createdAt: -1 })
          .lean();

        // Cache the results
        this.cacheConfigs(action, permissionConfigs);
      }

      if (permissionConfigs.length === 0) {
        return {
          allowed: false,
          requiresApproval: false,
          reason: 'No permission rules found for this action',
        };
      }

      // Check each config in priority order
      for (const config of permissionConfigs) {
        const matchResult = this.checkConfigMatch(user, config, categoryId, machineValue);

        if (matchResult.matches) {
          return this.createPermissionResult(config, matchResult.matchedBy!);
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
      throw this.createError(
        'CHECKING_PERMISSION',
        StatusCodes.INTERNAL_SERVER_ERROR,
        'PERMISSION_CHECK_FAILED',
        'Failed to check permissions',
      );
    }
  }

  /**
   * Create permission result based on config and match type
   */
  private static createPermissionResult(
    config: IPermissionConfig,
    matchedBy: string
  ): PermissionCheckResult {
    const baseResult: PermissionCheckResult = {
      allowed: false,
      requiresApproval: false,
      matchedRule: config,
      matchedBy,
    };

    switch (config.permission) {
      case PermissionLevel.ALLOWED:
        return {
          ...baseResult,
          allowed: true,
          reason: `Access granted by ${matchedBy} permission rule`,
        };

      case PermissionLevel.REQUIRES_APPROVAL:
        return {
          ...baseResult,
          requiresApproval: true,
          ...(config.approverRoles && { approverRoles: config.approverRoles }),
          reason: `Approval required by ${matchedBy} permission rule`,
        };

      case PermissionLevel.DENIED:
        return {
          ...baseResult,
          reason: `Access denied by ${matchedBy} permission rule`,
        };

      default:
        return {
          ...baseResult,
          reason: `Unknown permission level: ${config.permission}`,
        };
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

    // Use Promise.allSettled to handle individual permission check failures gracefully
    const permissionPromises = actions.map(async (action) => {
      try {
        const result = await this.checkPermission(userId, action, categoryId, machineValue);
        return { action, result };
      } catch (error) {
        return {
          action,
          result: {
            allowed: false,
            requiresApproval: false,
            reason: 'Error checking permission',
          } as PermissionCheckResult,
        };
      }
    });

    const results = await Promise.allSettled(permissionPromises);

    results.forEach((result) => {
      if (result.status === 'fulfilled') {
        permissions[result.value.action] = result.value.result;
      }
    });

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
  ): ConfigMatchResult {
    const conditions: string[] = [];

    // Check user-specific rules (highest priority)
    if (config.userIds?.length) {
      const userIdStrings = config.userIds.map(id => id.toString());
      if (userIdStrings.includes(user.id.toString())) {
        return { matches: true, matchedBy: 'user-specific rule' };
      }
      conditions.push('user');
    }

    // Check role-specific rules
    if (config.roleIds?.length && user.role) {
      const roleIdStrings = config.roleIds.map(id => id.toString());
      if (roleIdStrings.includes(user.role.toString())) {
        return { matches: true, matchedBy: 'role-based rule' };
      }
      conditions.push('role');
    }

    // Check department-specific rules
    if (config.departmentIds?.length && user.department) {
      const deptIdStrings = config.departmentIds.map(id => id.toString());
      if (deptIdStrings.includes(user.department.toString())) {
        return { matches: true, matchedBy: 'department-based rule' };
      }
      conditions.push('department');
    }

    // Check category-specific rules
    if (config.categoryIds?.length) {
      if (!categoryId) {
        return { matches: false };
      }
      const categoryIdStrings = config.categoryIds.map(id => id.toString());
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

    // If we have conditions and all passed, it's a match
    if (conditions.length > 0) {
      return { matches: true, matchedBy: `${conditions.join(' + ')} rule` };
    }

    // If no conditions are specified, it's a global rule (matches everyone)
    if (this.isGlobalRule(config)) {
      return { matches: true, matchedBy: 'global rule' };
    }

    return { matches: false };
  }

  /**
   * Check if config is a global rule (no specific conditions)
   */
  private static isGlobalRule(config: IPermissionConfig): boolean {
    return (
      !config.userIds?.length &&
      !config.roleIds?.length &&
      !config.departmentIds?.length &&
      !config.categoryIds?.length
    );
  }
}

export default PermissionConfigService;
