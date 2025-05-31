// permissionConfig.validator.ts
import Joi from 'joi';
import {
  ActionType,
  PermissionLevel,
} from '../../../../models/permissionConfig.model';

/**
 * MongoDB ObjectId pattern
 */
const objectIdPattern = /^[0-9a-fA-F]{24}$/;

/**
 * Validation schema for creating permission configuration
 */
export const createPermissionConfigSchema = Joi.object({
  name: Joi.string().trim().min(3).max(100).required().messages({
    'string.empty': 'Permission name is required',
    'string.min': 'Permission name must be at least 3 characters long',
    'string.max': 'Permission name cannot exceed 100 characters',
    'any.required': 'Permission name is required',
  }),

  description: Joi.string().trim().min(10).max(500).required().messages({
    'string.empty': 'Description is required',
    'string.min': 'Description must be at least 10 characters long',
    'string.max': 'Description cannot exceed 500 characters',
    'any.required': 'Description is required',
  }),

  action: Joi.string()
    .valid(...Object.values(ActionType))
    .required()
    .messages({
      'any.only': `Action must be one of: ${Object.values(ActionType).join(', ')}`,
      'any.required': 'Action is required',
    }),

  roleIds: Joi.array()
    .items(
      Joi.string().pattern(objectIdPattern).message('Invalid role ID format'),
    )
    .optional()
    .messages({
      'array.base': 'Role IDs must be an array',
    }),

  userIds: Joi.array()
    .items(
      Joi.string().pattern(objectIdPattern).message('Invalid user ID format'),
    )
    .optional()
    .messages({
      'array.base': 'User IDs must be an array',
    }),

  departmentIds: Joi.array()
    .items(
      Joi.string()
        .pattern(objectIdPattern)
        .message('Invalid department ID format'),
    )
    .optional()
    .messages({
      'array.base': 'Department IDs must be an array',
    }),

  categoryIds: Joi.array()
    .items(
      Joi.string()
        .pattern(objectIdPattern)
        .message('Invalid category ID format'),
    )
    .optional()
    .messages({
      'array.base': 'Category IDs must be an array',
    }),

  permission: Joi.string()
    .valid(...Object.values(PermissionLevel))
    .required()
    .messages({
      'any.only': `Permission must be one of: ${Object.values(PermissionLevel).join(', ')}`,
      'any.required': 'Permission level is required',
    }),

  approverRoles: Joi.array()
    .items(
      Joi.string()
        .pattern(objectIdPattern)
        .message('Invalid approver role ID format'),
    )
    .when('permission', {
      is: PermissionLevel.REQUIRES_APPROVAL,
      then: Joi.required(),
      otherwise: Joi.optional(),
    })
    .messages({
      'array.base': 'Approver roles must be an array',
      'any.required':
        'Approver roles are required when permission is REQUIRES_APPROVAL',
    }),

  maxValue: Joi.number().positive().optional().messages({
    'number.base': 'Max value must be a number',
    'number.positive': 'Max value must be positive',
  }),

  priority: Joi.number().integer().min(0).max(1000).default(0).messages({
    'number.base': 'Priority must be a number',
    'number.integer': 'Priority must be an integer',
    'number.min': 'Priority cannot be less than 0',
    'number.max': 'Priority cannot exceed 1000',
  }),
})
  .custom((value, helpers) => {
    // At least one condition must be specified
    const conditions = ['roleIds', 'userIds', 'departmentIds', 'categoryIds'];
    const hasCondition = conditions.some(
      (condition) =>
        value[condition] &&
        Array.isArray(value[condition]) &&
        value[condition].length > 0,
    );

    if (!hasCondition) {
      return helpers.error('custom.noConditions');
    }

    return value;
  })
  .messages({
    'custom.noConditions':
      'At least one condition (roleIds, userIds, departmentIds, or categoryIds) must be specified',
  });

/**
 * Validation schema for updating permission configuration
 */
export const updatePermissionConfigSchema = Joi.object({
  name: Joi.string().trim().min(3).max(100).optional().messages({
    'string.min': 'Permission name must be at least 3 characters long',
    'string.max': 'Permission name cannot exceed 100 characters',
  }),

  description: Joi.string().trim().min(10).max(500).optional().messages({
    'string.min': 'Description must be at least 10 characters long',
    'string.max': 'Description cannot exceed 500 characters',
  }),

  action: Joi.string()
    .valid(...Object.values(ActionType))
    .optional()
    .messages({
      'any.only': `Action must be one of: ${Object.values(ActionType).join(', ')}`,
    }),

  roleIds: Joi.array()
    .items(
      Joi.string().pattern(objectIdPattern).message('Invalid role ID format'),
    )
    .optional()
    .messages({
      'array.base': 'Role IDs must be an array',
    }),

  userIds: Joi.array()
    .items(
      Joi.string().pattern(objectIdPattern).message('Invalid user ID format'),
    )
    .optional()
    .messages({
      'array.base': 'User IDs must be an array',
    }),

  departmentIds: Joi.array()
    .items(
      Joi.string()
        .pattern(objectIdPattern)
        .message('Invalid department ID format'),
    )
    .optional()
    .messages({
      'array.base': 'Department IDs must be an array',
    }),

  categoryIds: Joi.array()
    .items(
      Joi.string()
        .pattern(objectIdPattern)
        .message('Invalid category ID format'),
    )
    .optional()
    .messages({
      'array.base': 'Category IDs must be an array',
    }),

  permission: Joi.string()
    .valid(...Object.values(PermissionLevel))
    .optional()
    .messages({
      'any.only': `Permission must be one of: ${Object.values(PermissionLevel).join(', ')}`,
    }),

  approverRoles: Joi.array()
    .items(
      Joi.string()
        .pattern(objectIdPattern)
        .message('Invalid approver role ID format'),
    )
    .optional()
    .messages({
      'array.base': 'Approver roles must be an array',
    }),

  maxValue: Joi.number().positive().optional().allow(null).messages({
    'number.base': 'Max value must be a number',
    'number.positive': 'Max value must be positive',
  }),

  priority: Joi.number().integer().min(0).max(1000).optional().messages({
    'number.base': 'Priority must be a number',
    'number.integer': 'Priority must be an integer',
    'number.min': 'Priority cannot be less than 0',
    'number.max': 'Priority cannot exceed 1000',
  }),

  isActive: Joi.boolean().optional().messages({
    'boolean.base': 'isActive must be a boolean value',
  }),
})
  .min(1)
  .messages({
    'object.min': 'At least one field must be provided for update',
  });

/**
 * Validation schema for checking permissions (POST body)
 */
export const checkPermissionSchema = Joi.object({
  action: Joi.string()
    .valid(...Object.values(ActionType))
    .required()
    .messages({
      'any.only': `Action must be one of: ${Object.values(ActionType).join(', ')}`,
      'any.required': 'Action is required',
    }),

  categoryId: Joi.string().pattern(objectIdPattern).optional().messages({
    'string.pattern.base': 'Invalid category ID format',
  }),

  machineValue: Joi.number().positive().optional().messages({
    'number.base': 'Machine value must be a number',
    'number.positive': 'Machine value must be positive',
  }),
});

/**
 * Validation schema for ID parameter
 */
export const idParamSchema = Joi.object({
  id: Joi.string().pattern(objectIdPattern).required().messages({
    'string.pattern.base': 'Invalid ID format',
    'any.required': 'ID is required',
  }),
});

/**
 * Validation schema for action parameter
 */
export const actionParamSchema = Joi.object({
  action: Joi.string()
    .valid(...Object.values(ActionType))
    .required()
    .messages({
      'any.only': `Action must be one of: ${Object.values(ActionType).join(', ')}`,
      'any.required': 'Action is required',
    }),
});

/**
 * Validation schema for pagination query parameters
 */
export const paginationQuerySchema = Joi.object({
  page: Joi.string()
    .pattern(/^\d+$/)
    .custom((value, helpers) => {
      const num = parseInt(value);
      if (num < 1) {
        return helpers.error('number.min');
      }
      return num;
    })
    .default('1')
    .messages({
      'string.pattern.base': 'Page must be a valid number',
      'number.min': 'Page must be at least 1',
    }),

  limit: Joi.string()
    .pattern(/^\d+$/)
    .custom((value, helpers) => {
      const num = parseInt(value);
      if (num < 1) {
        return helpers.error('number.min');
      }
      if (num > 100) {
        return helpers.error('number.max');
      }
      return num;
    })
    .default('10')
    .messages({
      'string.pattern.base': 'Limit must be a valid number',
      'number.min': 'Limit must be at least 1',
      'number.max': 'Limit cannot exceed 100',
    }),
});

/**
 * Validation schema for permission check query parameters
 */
export const permissionCheckQuerySchema = Joi.object({
  categoryId: Joi.string().pattern(objectIdPattern).optional().messages({
    'string.pattern.base': 'Invalid category ID format',
  }),

  machineValue: Joi.string()
    .pattern(/^\d*\.?\d+$/)
    .custom((value, helpers) => {
      const num = parseFloat(value);
      if (num <= 0) {
        return helpers.error('number.positive');
      }
      return num;
    })
    .optional()
    .messages({
      'string.pattern.base': 'Machine value must be a valid number',
      'number.positive': 'Machine value must be positive',
    }),
});

/**
 * Validation schema for category IDs validation endpoint
 */
export const categoryValidationSchema = Joi.object({
  categoryIds: Joi.array()
    .items(
      Joi.string()
        .pattern(objectIdPattern)
        .message('Invalid category ID format'),
    )
    .min(1)
    .required()
    .messages({
      'array.base': 'Category IDs must be an array',
      'array.min': 'At least one category ID is required',
      'any.required': 'Category IDs array is required',
    }),
});
