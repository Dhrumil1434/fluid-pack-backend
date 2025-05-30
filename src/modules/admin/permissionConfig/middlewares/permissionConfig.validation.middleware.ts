import { Request, Response, NextFunction } from 'express';
import ValidationService from '../validators/permissionConfig.reference.validator';
import { ApiError } from '../../../../utils/ApiError';
import { StatusCodes } from 'http-status-codes';

export interface ValidationConfig {
  validateUsers?: boolean;
  validateRoles?: boolean;
  validateDepartments?: boolean;
  validateCategories?: boolean;
  validateMachines?: boolean;
}

export const validateParamReferences = (config: {
  validateUserId?: boolean;
  validateCategoryId?: boolean;
  validateRoleId?: boolean;
  validateMachineId?: boolean;
}) => {
  return async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { params } = req;

      // Validate user ID parameter
      if (config.validateUserId && params['userId']) {
        const isValid = await ValidationService.validateSingleUserId(
          params['userId'],
        );
        if (!isValid) {
          throw new ApiError(
            'VALIDATION_ERROR',
            StatusCodes.BAD_REQUEST,
            'INVALID_USER_REFERENCE',
            `Invalid user ID: ${params['userId']}`,
          );
        }
      }

      // Validate category ID parameter
      if (config.validateCategoryId && params['categoryId']) {
        const isValid = await ValidationService.validateSingleCategoryId(
          params['categoryId'],
        );
        if (!isValid) {
          throw new ApiError(
            'VALIDATION_ERROR',
            StatusCodes.BAD_REQUEST,
            'INVALID_CATEGORY_REFERENCE',
            `Invalid category ID: ${params['categoryId']}`,
          );
        }
      }

      // Validate role ID parameter
      if (config.validateRoleId && params['roleId']) {
        const result = await ValidationService.validateRoleIds([
          params['roleId'],
        ]);
        if (!result.isValid) {
          throw new ApiError(
            'VALIDATION_ERROR',
            StatusCodes.BAD_REQUEST,
            'INVALID_ROLE_REFERENCE',
            `Invalid role ID: ${params['roleId']}`,
          );
        }
      }

      // Validate machine ID parameter
      if (config.validateMachineId && params['machineId']) {
        const result = await ValidationService.validateMachineIds([
          params['machineId'],
        ]);
        if (!result.isValid) {
          throw new ApiError(
            'VALIDATION_ERROR',
            StatusCodes.BAD_REQUEST,
            'INVALID_MACHINE_REFERENCE',
            `Invalid machine ID: ${params['machineId']}`,
          );
        }
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};
