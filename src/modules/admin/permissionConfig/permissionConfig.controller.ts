// controllers/permissionConfig.controller.ts
import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { asyncHandler } from '../../../utils/asyncHandler';
import { ApiResponse } from '../../../utils/ApiResponse';
import { ApiError } from '../../../utils/ApiError';
import PermissionConfigService, {
  CreatePermissionConfigData,
  UpdatePermissionConfigData,
} from './services/permissionConfig.service';
import ValidationService from './validators/permissionConfig.reference.validator';
import { ActionType } from '../../../models/permissionConfig.model';

export interface AuthenticatedRequest extends Request {
  user?: {
    _id: string;
    email: string;
    username: string;
    role: string;
    department: string;
  };
}

interface PaginationQuery {
  page?: string | number;
  limit?: string | number;
}

interface PermissionCheckBody {
  action: ActionType;
  categoryId?: string;
  machineValue?: number;
}

interface PermissionCheckQuery {
  categoryId?: string;
  machineValue?: string;
}

interface CategoryValidationBody {
  categoryIds: string[];
}

class PermissionConfigController {
  /**
   * Create a new permission configuration
   * POST /api/permission-configs
   */
  static createPermissionConfig = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const {
        name,
        description,
        action,
        roleIds,
        userIds,
        departmentIds,
        categoryIds,
        permission,
        approverRoles,
        maxValue,
        priority,
      } = req.body as CreatePermissionConfigData;

      if (!req.user) {
        throw new ApiError(
          'CREATE_PERMISSION_CONFIG',
          StatusCodes.UNAUTHORIZED,
          'USER_NOT_AUTHENTICATED',
          'User authentication required',
        );
      }

      try {
        // Validate all reference IDs before creating
        await ValidationService.validatePermissionConfigReferences({
          roleIds,
          userIds,
          departmentIds,
          categoryIds,
          approverRoles,
          createdBy: req.user._id,
        });

        const permissionConfig = await PermissionConfigService.create({
          name,
          description,
          action,
          roleIds,
          userIds,
          departmentIds,
          categoryIds,
          permission,
          approverRoles,
          maxValue,
          priority,
          createdBy: req.user._id,
        });

        const response = new ApiResponse(
          StatusCodes.CREATED,
          permissionConfig,
          'Permission configuration created successfully',
        );

        res.status(StatusCodes.CREATED).json(response);
      } catch (error) {
        if (error instanceof ApiError) {
          throw error;
        }
        throw new ApiError(
          'CREATE_PERMISSION_CONFIG',
          StatusCodes.INTERNAL_SERVER_ERROR,
          'CREATION_FAILED',
          'Failed to create permission configuration',
        );
      }
    },
  );

  /**
   * Get all permission configurations with pagination
   * GET /api/permission-configs?page=1&limit=10
   */
  static getAllPermissionConfigs = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      // Handle both string and number types from Joi validation
      const { page = 1, limit = 10 } = req.query as PaginationQuery;
      const pageNumber = typeof page === 'string' ? parseInt(page) : page;
      const limitNumber = typeof limit === 'string' ? parseInt(limit) : limit;

      try {
        const result = await PermissionConfigService.getAll(
          pageNumber,
          limitNumber,
        );

        const response = new ApiResponse(
          StatusCodes.OK,
          {
            configs: result.configs,
            pagination: {
              currentPage: pageNumber,
              totalPages: result.pages,
              totalItems: result.total,
              itemsPerPage: limitNumber,
              hasNextPage: pageNumber < result.pages,
              hasPrevPage: pageNumber > 1,
            },
          },
          'Permission configurations retrieved successfully',
        );

        res.status(StatusCodes.OK).json(response);
      } catch {
        throw new ApiError(
          'GET_ALL_PERMISSION_CONFIGS',
          StatusCodes.INTERNAL_SERVER_ERROR,
          'FETCH_FAILED',
          'Failed to retrieve permission configurations',
        );
      }
    },
  );

  /**
   * Get permission configurations by action
   * GET /api/permission-configs/action/:action?page=1&limit=10
   */
  static getPermissionConfigsByAction = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { action } = req.params;
      const { page = 1, limit = 10 } = req.query as PaginationQuery;

      const pageNumber = typeof page === 'string' ? parseInt(page) : page;
      const limitNumber = typeof limit === 'string' ? parseInt(limit) : limit;

      try {
        const result = await PermissionConfigService.getByAction(
          action as ActionType,
          pageNumber,
          limitNumber,
        );

        const response = new ApiResponse(
          StatusCodes.OK,
          {
            configs: result.configs,
            pagination: {
              currentPage: pageNumber,
              totalPages: result.pages,
              totalItems: result.total,
              itemsPerPage: limitNumber,
              hasNextPage: pageNumber < result.pages,
              hasPrevPage: pageNumber > 1,
            },
          },
          `Permission configurations for ${action} retrieved successfully`,
        );

        res.status(StatusCodes.OK).json(response);
      } catch (error) {
        if (error instanceof ApiError) {
          throw error;
        }
        throw new ApiError(
          'GET_CONFIGS_BY_ACTION',
          StatusCodes.INTERNAL_SERVER_ERROR,
          'FETCH_FAILED',
          `Failed to retrieve permission configurations for action: ${action}`,
        );
      }
    },
  );

  /**
   * Get permission configuration by ID
   * GET /api/permission-configs/:id
   */
  static getPermissionConfigById = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { id } = req.params;

      try {
        if (!id) {
          throw new ApiError(
            'GET_PERMISSION_CONFIG_BY_ID',
            StatusCodes.BAD_REQUEST,
            'MISSING_PARAMETER',
            'Permission configuration ID is required',
          );
        }
        const permissionConfig = await PermissionConfigService.getById(id);

        const response = new ApiResponse(
          StatusCodes.OK,
          permissionConfig,
          'Permission configuration retrieved successfully',
        );

        res.status(StatusCodes.OK).json(response);
      } catch (error) {
        if (error instanceof ApiError) {
          throw error;
        }
        throw new ApiError(
          'GET_PERMISSION_CONFIG_BY_ID',
          StatusCodes.INTERNAL_SERVER_ERROR,
          'FETCH_FAILED',
          'Failed to retrieve permission configuration',
        );
      }
    },
  );

  /**
   * Update permission configuration
   * PUT /api/permission-configs/:id
   */
  static updatePermissionConfig = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { id } = req.params;
      const updateData = req.body as UpdatePermissionConfigData;

      try {
        // Validate reference IDs before updating if they exist
        await ValidationService.validatePermissionConfigReferences({
          roleIds: updateData.roleIds,
          userIds: updateData.userIds,
          departmentIds: updateData.departmentIds,
          categoryIds: updateData.categoryIds,
          approverRoles: updateData.approverRoles,
        });

        if (!id) {
          throw new ApiError(
            'UPDATE_PERMISSION_CONFIG',
            StatusCodes.BAD_REQUEST,
            'MISSING_PARAMETER',
            'Permission configuration ID is required',
          );
        }
        const permissionConfig = await PermissionConfigService.update(
          id,
          updateData,
        );

        const response = new ApiResponse(
          StatusCodes.OK,
          permissionConfig,
          'Permission configuration updated successfully',
        );

        res.status(StatusCodes.OK).json(response);
      } catch (error) {
        if (error instanceof ApiError) {
          throw error;
        }
        throw new ApiError(
          'UPDATE_PERMISSION_CONFIG',
          StatusCodes.INTERNAL_SERVER_ERROR,
          'UPDATE_FAILED',
          'Failed to update permission configuration',
        );
      }
    },
  );

  /**
   * Delete permission configuration (soft delete)
   * DELETE /api/permission-configs/:id
   */
  static deletePermissionConfig = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { id } = req.params;

      if (!id) {
        throw new ApiError(
          'DELETE_PERMISSION_CONFIG',
          StatusCodes.BAD_REQUEST,
          'MISSING_PARAMETER',
          'Permission configuration ID is required',
        );
      }

      try {
        await PermissionConfigService.delete(id);

        const response = new ApiResponse(
          StatusCodes.OK,
          null,
          'Permission configuration deleted successfully',
        );

        res.status(StatusCodes.OK).json(response);
      } catch (error) {
        if (error instanceof ApiError) {
          throw error;
        }
        throw new ApiError(
          'DELETE_PERMISSION_CONFIG',
          StatusCodes.INTERNAL_SERVER_ERROR,
          'DELETE_FAILED',
          'Failed to delete permission configuration',
        );
      }
    },
  );

  /**
   * Toggle permission configuration active status
   * PATCH /api/permission-configs/:id/toggle
   */
  static togglePermissionConfig = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { id } = req.params;

      try {
        if (!id) {
          throw new ApiError(
            'TOGGLE_PERMISSION_CONFIG',
            StatusCodes.BAD_REQUEST,
            'MISSING_PARAMETER',
            'Permission configuration ID is required',
          );
        }
        const updatedConfig =
          await PermissionConfigService.toggleActiveStatus(id);

        const response = new ApiResponse(
          StatusCodes.OK,
          updatedConfig,
          `Permission configuration ${updatedConfig.isActive ? 'activated' : 'deactivated'} successfully`,
        );

        res.status(StatusCodes.OK).json(response);
      } catch (error) {
        if (error instanceof ApiError) {
          throw error;
        }
        throw new ApiError(
          'TOGGLE_PERMISSION_CONFIG',
          StatusCodes.INTERNAL_SERVER_ERROR,
          'TOGGLE_FAILED',
          'Failed to toggle permission configuration status',
        );
      }
    },
  );

  /**
   * Check user permissions for a specific action (POST)
   * POST /api/permission-configs/check
   */
  static checkPermission = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { action, categoryId, machineValue } =
        req.body as PermissionCheckBody;

      if (!req.user) {
        throw new ApiError(
          'CHECK_PERMISSION',
          StatusCodes.UNAUTHORIZED,
          'USER_NOT_AUTHENTICATED',
          'User authentication required',
        );
      }

      try {
        // Validate categoryId if provided
        if (categoryId) {
          const categoryValid =
            await ValidationService.validateSingleCategoryId(categoryId);
          if (!categoryValid) {
            throw new ApiError(
              'CHECK_PERMISSION',
              StatusCodes.BAD_REQUEST,
              'INVALID_CATEGORY',
              'Invalid category ID provided',
            );
          }
        }

        const permissionResult = await PermissionConfigService.checkPermission(
          req.user._id,
          action,
          categoryId,
          machineValue,
        );

        const response = new ApiResponse(
          StatusCodes.OK,
          {
            userId: req.user._id,
            action,
            categoryId,
            machineValue,
            result: permissionResult,
          },
          'Permission check completed successfully',
        );

        res.status(StatusCodes.OK).json(response);
      } catch (error) {
        if (error instanceof ApiError) {
          throw error;
        }
        throw new ApiError(
          'CHECK_PERMISSION',
          StatusCodes.INTERNAL_SERVER_ERROR,
          'PERMISSION_CHECK_FAILED',
          'Failed to check permissions',
        );
      }
    },
  );

  /**
   * Get permissions for current user
   * GET /api/permission-configs/my-permissions?categoryId=xxx&machineValue=100
   */
  static getMyPermissions = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      if (!req.user) {
        throw new ApiError(
          'GET_MY_PERMISSIONS',
          StatusCodes.UNAUTHORIZED,
          'USER_NOT_AUTHENTICATED',
          'User authentication required',
        );
      }

      const { categoryId, machineValue } = req.query as PermissionCheckQuery;
      const userId = req.user._id;

      try {
        // Validate categoryId if provided
        if (categoryId) {
          const categoryValid =
            await ValidationService.validateSingleCategoryId(categoryId);
          if (!categoryValid) {
            throw new ApiError(
              'GET_MY_PERMISSIONS',
              StatusCodes.BAD_REQUEST,
              'INVALID_CATEGORY',
              'Invalid category ID provided',
            );
          }
        }

        const permissions = await PermissionConfigService.getUserPermissions(
          userId,
          categoryId,
          machineValue ? parseFloat(machineValue) : undefined,
        );

        const response = new ApiResponse(
          StatusCodes.OK,
          {
            userId: req.user._id,
            userInfo: {
              username: req.user.username,
              email: req.user.email,
            },
            categoryId,
            machineValue: machineValue ? parseFloat(machineValue) : undefined,
            permissions,
          },
          'User permissions retrieved successfully',
        );

        res.status(StatusCodes.OK).json(response);
      } catch (error) {
        if (error instanceof ApiError) {
          throw error;
        }
        throw new ApiError(
          'GET_MY_PERMISSIONS',
          StatusCodes.INTERNAL_SERVER_ERROR,
          'FETCH_PERMISSIONS_FAILED',
          'Failed to retrieve user permissions',
        );
      }
    },
  );

  /**
   * Check if user can perform action on specific resource (GET)
   * GET /api/permission-configs/check/:action?categoryId=xxx&machineValue=100
   */
  static checkResourcePermission = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { action } = req.params;
      const { categoryId, machineValue } = req.query as PermissionCheckQuery;

      if (!req.user) {
        throw new ApiError(
          'CHECK_RESOURCE_PERMISSION',
          StatusCodes.UNAUTHORIZED,
          'USER_NOT_AUTHENTICATED',
          'User authentication required',
        );
      }

      try {
        // Validate categoryId if provided
        if (categoryId) {
          const categoryValid =
            await ValidationService.validateSingleCategoryId(categoryId);
          if (!categoryValid) {
            throw new ApiError(
              'CHECK_RESOURCE_PERMISSION',
              StatusCodes.BAD_REQUEST,
              'INVALID_CATEGORY',
              'Invalid category ID provided',
            );
          }
        }

        const permissionResult = await PermissionConfigService.checkPermission(
          req.user._id,
          action as ActionType,
          categoryId,
          machineValue ? parseFloat(machineValue) : undefined,
        );

        const response = new ApiResponse(
          StatusCodes.OK,
          {
            userId: req.user._id,
            action,
            categoryId,
            machineValue: machineValue ? parseFloat(machineValue) : undefined,
            result: permissionResult,
          },
          'Resource permission check completed successfully',
        );

        res.status(StatusCodes.OK).json(response);
      } catch (error) {
        if (error instanceof ApiError) {
          throw error;
        }
        throw new ApiError(
          'CHECK_RESOURCE_PERMISSION',
          StatusCodes.INTERNAL_SERVER_ERROR,
          'RESOURCE_PERMISSION_CHECK_FAILED',
          'Failed to check resource permissions',
        );
      }
    },
  );

  /**
   * Validate multiple category IDs (utility endpoint)
   * POST /api/permission-configs/validate-categories
   */
  static validateCategoryIds = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { categoryIds } = req.body as CategoryValidationBody;

      try {
        const validationResult =
          await ValidationService.validateCategoryIds(categoryIds);

        const response = new ApiResponse(
          StatusCodes.OK,
          {
            isValid: validationResult.isValid,
            totalIds: categoryIds.length,
            validCount: categoryIds.length - validationResult.invalidIds.length,
            invalidCount: validationResult.invalidIds.length,
            validIds: categoryIds.filter(
              (id) => !validationResult.invalidIds.includes(id),
            ),
            invalidIds: validationResult.invalidIds,
          },
          validationResult.isValid
            ? 'All category IDs are valid'
            : `Found ${validationResult.invalidIds.length} invalid category IDs out of ${categoryIds.length}`,
        );

        res.status(StatusCodes.OK).json(response);
      } catch (error) {
        if (error instanceof ApiError) {
          throw error;
        }
        throw new ApiError(
          'VALIDATE_CATEGORY_IDS',
          StatusCodes.INTERNAL_SERVER_ERROR,
          'VALIDATION_FAILED',
          'Failed to validate category IDs',
        );
      }
    },
  );
}

export default PermissionConfigController;
