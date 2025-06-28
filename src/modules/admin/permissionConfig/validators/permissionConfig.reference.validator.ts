// services/validation.service.ts

import { StatusCodes } from 'http-status-codes';
import mongoose from 'mongoose';
import { User } from '../../../../models/user.model';
import { Role } from '../../../../models/role.model';
import { Department } from '../../../../models/department.model';
import { Category } from '../../../../models/category.model';
import { Machine } from '../../../../models/machine.model';
import { ApiError } from '../../../../utils/ApiError';

export interface ValidationResult {
  isValid: boolean;
  invalidIds: string[];
  missingType: string;
}

class ValidationService {
  /**
   * Validate if ObjectId format is correct
   */
  static isValidObjectId(id: string): boolean {
    return mongoose.Types.ObjectId.isValid(id);
  }

  /**
   * Validate multiple ObjectIds format
   */
  static validateObjectIdFormat(ids: string[], fieldName: string): void {
    const invalidIds = ids.filter((id) => !this.isValidObjectId(id));
    if (invalidIds.length > 0) {
      throw new ApiError(
        'VALIDATION_ERROR',
        StatusCodes.BAD_REQUEST,
        'INVALID_ID_FORMAT',
        `Invalid ${fieldName} format: ${invalidIds.join(', ')}`,
      );
    }
  }

  /**
   * Check if users exist
   */
  static async validateUserIds(userIds: string[]): Promise<ValidationResult> {
    if (!userIds || userIds.length === 0) {
      return { isValid: true, invalidIds: [], missingType: '' };
    }

    // First validate ObjectId format
    this.validateObjectIdFormat(userIds, 'user IDs');

    const existingUsers = await User.find({
      _id: { $in: userIds },
      isActive: { $ne: false }, // Exclude soft deleted users
    }).select('_id');

    const existingUserIds = existingUsers.map((user) => user.id.toString());
    const invalidIds = userIds.filter((id) => !existingUserIds.includes(id));

    return {
      isValid: invalidIds.length === 0,
      invalidIds,
      missingType: 'users',
    };
  }

  /**
   * Check if roles exist
   */
  static async validateRoleIds(roleIds: string[]): Promise<ValidationResult> {
    if (!roleIds || roleIds.length === 0) {
      return { isValid: true, invalidIds: [], missingType: '' };
    }

    this.validateObjectIdFormat(roleIds, 'role IDs');

    const existingRoles = await Role.find({
      _id: { $in: roleIds },
      isActive: { $ne: false },
    }).select('_id');

    const existingRoleIds = existingRoles.map((role) => role.id.toString());
    const invalidIds = roleIds.filter((id) => !existingRoleIds.includes(id));

    return {
      isValid: invalidIds.length === 0,
      invalidIds,
      missingType: 'roles',
    };
  }

  /**
   * Check if departments exist
   */
  static async validateDepartmentIds(
    departmentIds: string[],
  ): Promise<ValidationResult> {
    if (!departmentIds || departmentIds.length === 0) {
      return { isValid: true, invalidIds: [], missingType: '' };
    }

    this.validateObjectIdFormat(departmentIds, 'department IDs');

    const existingDepartments = await Department.find({
      _id: { $in: departmentIds },
      isActive: { $ne: false },
    }).select('_id');

    const existingDepartmentIds = existingDepartments.map((dept) =>
      dept.id.toString(),
    );
    const invalidIds = departmentIds.filter(
      (id) => !existingDepartmentIds.includes(id),
    );

    return {
      isValid: invalidIds.length === 0,
      invalidIds,
      missingType: 'departments',
    };
  }

  /**
   * Check if categories exist
   */
  static async validateCategoryIds(
    categoryIds: string[],
  ): Promise<ValidationResult> {
    if (!categoryIds || categoryIds.length === 0) {
      return { isValid: true, invalidIds: [], missingType: '' };
    }

    this.validateObjectIdFormat(categoryIds, 'category IDs');

    const existingCategories = await Category.find({
      _id: { $in: categoryIds },
      isActive: { $ne: false },
    }).select('_id');

    const existingCategoryIds = existingCategories.map((cat) =>
      cat.id.toString(),
    );
    const invalidIds = categoryIds.filter(
      (id) => !existingCategoryIds.includes(id),
    );

    return {
      isValid: invalidIds.length === 0,
      invalidIds,
      missingType: 'categories',
    };
  }

  /**
   * Check if machines exist
   */
  static async validateMachineIds(
    machineIds: string[],
  ): Promise<ValidationResult> {
    if (!machineIds || machineIds.length === 0) {
      return { isValid: true, invalidIds: [], missingType: '' };
    }

    this.validateObjectIdFormat(machineIds, 'machine IDs');

    const existingMachines = await Machine.find({
      _id: { $in: machineIds },
      deletedAt: null, // Only active machines
    }).select('_id');

    const existingMachineIds = existingMachines.map((machine) =>
      machine.id.toString(),
    );
    const invalidIds = machineIds.filter(
      (id) => !existingMachineIds.includes(id),
    );

    return {
      isValid: invalidIds.length === 0,
      invalidIds,
      missingType: 'machines',
    };
  }

  /**
   * Validate single user ID
   */
  static async validateSingleUserId(userId: string): Promise<boolean> {
    if (!userId) return true; // Optional field

    if (!this.isValidObjectId(userId)) {
      throw new ApiError(
        'VALIDATION_ERROR',
        StatusCodes.BAD_REQUEST,
        'INVALID_ID_FORMAT',
        'Invalid user ID format',
      );
    }

    const user = await User.findOne({
      _id: userId,
      isActive: { $ne: false },
    });

    return !!user;
  }

  /**
   * Validate single category ID
   */
  static async validateSingleCategoryId(categoryId: string): Promise<boolean> {
    if (!categoryId) return true; // Optional field

    if (!this.isValidObjectId(categoryId)) {
      throw new ApiError(
        'VALIDATION_ERROR',
        StatusCodes.BAD_REQUEST,
        'INVALID_ID_FORMAT',
        'Invalid category ID format',
      );
    }

    const category = await Category.findOne({
      _id: categoryId,
      isActive: { $ne: false },
    });

    return !!category;
  }

  /**
   * Comprehensive validation for PermissionConfig
   */
  static async validatePermissionConfigReferences(data: {
    roleIds?: string[] | undefined;
    userIds?: string[] | undefined;
    departmentIds?: string[] | undefined;
    categoryIds?: string[] | undefined;
    approverRoles?: string[] | undefined;
    createdBy?: string | undefined;
  }): Promise<void> {
    const validationPromises = [];
    const errors: string[] = [];

    // Validate roleIds
    if (data.roleIds && data.roleIds.length > 0) {
      validationPromises.push(
        this.validateRoleIds(data.roleIds).then((result) => {
          if (!result.isValid) {
            errors.push(`Invalid role IDs: ${result.invalidIds.join(', ')}`);
          }
        }),
      );
    }

    // Validate userIds
    if (data.userIds && data.userIds.length > 0) {
      validationPromises.push(
        this.validateUserIds(data.userIds).then((result) => {
          if (!result.isValid) {
            errors.push(`Invalid user IDs: ${result.invalidIds.join(', ')}`);
          }
        }),
      );
    }

    // Validate departmentIds
    if (data.departmentIds && data.departmentIds.length > 0) {
      validationPromises.push(
        this.validateDepartmentIds(data.departmentIds).then((result) => {
          if (!result.isValid) {
            errors.push(
              `Invalid department IDs: ${result.invalidIds.join(', ')}`,
            );
          }
        }),
      );
    }

    // Validate categoryIds
    if (data.categoryIds && data.categoryIds.length > 0) {
      validationPromises.push(
        this.validateCategoryIds(data.categoryIds).then((result) => {
          if (!result.isValid) {
            errors.push(
              `Invalid category IDs: ${result.invalidIds.join(', ')}`,
            );
          }
        }),
      );
    }

    // Validate approverRoles
    if (data.approverRoles && data.approverRoles.length > 0) {
      validationPromises.push(
        this.validateRoleIds(data.approverRoles).then((result) => {
          if (!result.isValid) {
            errors.push(
              `Invalid approver role IDs: ${result.invalidIds.join(', ')}`,
            );
          }
        }),
      );
    }

    // Validate createdBy
    if (data.createdBy) {
      validationPromises.push(
        this.validateSingleUserId(data.createdBy).then((isValid) => {
          if (!isValid) {
            errors.push(`Invalid createdBy user ID: ${data.createdBy}`);
          }
        }),
      );
    }

    // Wait for all validations to complete
    await Promise.all(validationPromises);

    // Throw error if any validation failed
    if (errors.length > 0) {
      throw new ApiError(
        'VALIDATION_ERROR',
        StatusCodes.BAD_REQUEST,
        'INVALID_REFERENCES',
        `Reference validation failed: ${errors.join('; ')}`,
      );
    }
  }

  /**
   * Validate Machine references
   */
  static async validateMachineReferences(data: {
    category_id?: string;
    created_by?: string;
    updatedBy?: string;
  }): Promise<void> {
    const errors: string[] = [];

    // Validate category_id
    if (data.category_id) {
      const categoryValid = await this.validateSingleCategoryId(
        data.category_id,
      );
      if (!categoryValid) {
        errors.push(`Invalid category ID: ${data.category_id}`);
      }
    }

    // Validate created_by
    if (data.created_by) {
      const createdByValid = await this.validateSingleUserId(data.created_by);
      if (!createdByValid) {
        errors.push(`Invalid created_by user ID: ${data.created_by}`);
      }
    }

    // Validate updatedBy
    if (data.updatedBy) {
      const updatedByValid = await this.validateSingleUserId(data.updatedBy);
      if (!updatedByValid) {
        errors.push(`Invalid updatedBy user ID: ${data.updatedBy}`);
      }
    }

    if (errors.length > 0) {
      throw new ApiError(
        'VALIDATION_ERROR',
        StatusCodes.BAD_REQUEST,
        'INVALID_REFERENCES',
        `Machine reference validation failed: ${errors.join('; ')}`,
      );
    }
  }
}

export default ValidationService;
