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
  };
}

interface PaginationQuery {
  page?: string;
  limit?: string;
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
    },
  );

  /**
   * Get all permission configurations with pagination
   */
  static getAllPermissionConfigs = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { page = '1', limit = '10' } = req.query as PaginationQuery;
      const pageNumber = parseInt(page);
      const limitNumber = parseInt(limit);

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
          },
        },
        'Permission configurations retrieved successfully',
      );

      res.status(StatusCodes.OK).json(response);
    },
  );

  /**
   * Get permission configurations by action
   */
  static getPermissionConfigsByAction = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { action } = req.params;
      const { page = '1', limit = '10' } = req.query as PaginationQuery;

      const pageNumber = parseInt(page);
      const limitNumber = parseInt(limit);

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
          },
        },
        `Permission configurations for ${action} retrieved successfully`,
      );

      res.status(StatusCodes.OK).json(response);
    },
  );

  /**
   * Get permission configuration by ID
   */
  static getPermissionConfigById = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { id } = req.params;

      if (!id) {
        throw new ApiError(
          'FETCHING_PERMISSION_CONFIG',
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
    },
  );

  /**
   * Update permission configuration
   */
  static updatePermissionConfig = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { id } = req.params;
      const updateData = req.body as UpdatePermissionConfigData;

      if (!id) {
        throw new ApiError(
          'UPDATING_PERMISSION_CONFIG',
          StatusCodes.BAD_REQUEST,
          'MISSING_PARAMETER',
          'Permission configuration ID is required',
        );
      }

      // Validate reference IDs before updating if they exist
      await ValidationService.validatePermissionConfigReferences({
        roleIds: updateData.roleIds,
        userIds: updateData.userIds,
        departmentIds: updateData.departmentIds,
        categoryIds: updateData.categoryIds,
        approverRoles: updateData.approverRoles,
      });

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
    },
  );

  /**
   * Delete permission configuration (soft delete)
   */
  static deletePermissionConfig = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { id } = req.params;

      if (!id) {
        throw new ApiError(
          'DELETING_PERMISSION_CONFIG',
          StatusCodes.BAD_REQUEST,
          'MISSING_PARAMETER',
          'Permission configuration ID is required',
        );
      }

      await PermissionConfigService.delete(id);

      const response = new ApiResponse(
        StatusCodes.OK,
        null,
        'Permission configuration deleted successfully',
      );

      res.status(StatusCodes.OK).json(response);
    },
  );

  /**
   * Toggle permission configuration active status
   */
  static togglePermissionConfig = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { id } = req.params;

      if (!id) {
        throw new ApiError(
          'TOGGLING_PERMISSION_CONFIG',
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
    },
  );

  /**
   * Check user permissions for a specific action (POST)
   */
  static checkPermission = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { action, categoryId, machineValue } =
        req.body as PermissionCheckBody;

      if (!req.user) {
        throw new ApiError(
          'CHECKING_PERMISSION',
          StatusCodes.UNAUTHORIZED,
          'USER_NOT_AUTHENTICATED',
          'User authentication required',
        );
      }

      // Validate categoryId if provided
      if (categoryId) {
        const categoryValid =
          await ValidationService.validateSingleCategoryId(categoryId);
        if (!categoryValid) {
          throw new ApiError(
            'CHECKING_PERMISSION',
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
        permissionResult,
        'Permission check completed successfully',
      );

      res.status(StatusCodes.OK).json(response);
    },
  );

  /**
   * Get permissions for current user
   */
  static getMyPermissions = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      if (!req.user) {
        throw new ApiError(
          'GETTING_USER_PERMISSIONS',
          StatusCodes.UNAUTHORIZED,
          'USER_NOT_AUTHENTICATED',
          'User authentication required',
        );
      }

      const { categoryId, machineValue } = req.query as PermissionCheckQuery;
      const userId = req.user._id;

      // Validate categoryId if provided
      if (categoryId) {
        const categoryValid =
          await ValidationService.validateSingleCategoryId(categoryId);
        if (!categoryValid) {
          throw new ApiError(
            'GETTING_USER_PERMISSIONS',
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
        permissions,
        'User permissions retrieved successfully',
      );

      res.status(StatusCodes.OK).json(response);
    },
  );

  /**
   * Check if user can perform action on specific resource (GET)
   */
  static checkResourcePermission = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { action } = req.params;
      const { categoryId, machineValue } = req.query as PermissionCheckQuery;

      if (!req.user) {
        throw new ApiError(
          'CHECKING_RESOURCE_PERMISSION',
          StatusCodes.UNAUTHORIZED,
          'USER_NOT_AUTHENTICATED',
          'User authentication required',
        );
      }

      // Validate categoryId if provided
      if (categoryId) {
        const categoryValid =
          await ValidationService.validateSingleCategoryId(categoryId);
        if (!categoryValid) {
          throw new ApiError(
            'CHECKING_RESOURCE_PERMISSION',
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
        permissionResult,
        'Resource permission check completed successfully',
      );

      res.status(StatusCodes.OK).json(response);
    },
  );

  /**
   * Validate multiple category IDs (utility endpoint)
   */
  static validateCategoryIds = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { categoryIds } = req.body as CategoryValidationBody;

      if (!categoryIds || !Array.isArray(categoryIds)) {
        throw new ApiError(
          'VALIDATING_CATEGORIES',
          StatusCodes.BAD_REQUEST,
          'INVALID_INPUT',
          'Category IDs array is required',
        );
      }

      const validationResult =
        await ValidationService.validateCategoryIds(categoryIds);

      const response = new ApiResponse(
        StatusCodes.OK,
        {
          isValid: validationResult.isValid,
          validIds: categoryIds.filter(
            (id) => !validationResult.invalidIds.includes(id),
          ),
          invalidIds: validationResult.invalidIds,
        },
        validationResult.isValid
          ? 'All category IDs are valid'
          : `Found ${validationResult.invalidIds.length} invalid category IDs`,
      );

      res.status(StatusCodes.OK).json(response);
    },
  );
}

export default PermissionConfigController;
