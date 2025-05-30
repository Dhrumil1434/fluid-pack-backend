// permissionConfig.validator.ts
import Joi from 'joi';
import {
  ActionType,
  PermissionLevel,
} from '../../../../models/permissionConfig.model';
/**
 * Validation schema for creating permission configuration
 */
export const createPermissionConfigSchema = Joi.object({
  name: Joi.string().trim().min(3).max(100).required().messages({
    'string.empty': 'Permission name is required',
    'string.min': 'Permission name must be at least 3 characters long',
    'string.max': 'Permission name cannot exceed 100 characters',
  }),

  description: Joi.string().trim().min(10).max(500).required().messages({
    'string.empty': 'Description is required',
    'string.min': 'Description must be at least 10 characters long',
    'string.max': 'Description cannot exceed 500 characters',
  }),

  action: Joi.string()
    .valid(...Object.values(ActionType))
    .required()
    .messages({
      'any.only':
        'Action must be one of: CREATE_MACHINE, EDIT_MACHINE, DELETE_MACHINE, APPROVE_MACHINE',
      'any.required': 'Action is required',
    }),

  roleIds: Joi.array()
    .items(
      Joi.string()
        .pattern(/^[0-9a-fA-F]{24}$/)
        .message('Invalid role ID format'),
    )
    .optional()
    .messages({
      'array.base': 'Role IDs must be an array',
    }),

  userIds: Joi.array()
    .items(
      Joi.string()
        .pattern(/^[0-9a-fA-F]{24}$/)
        .message('Invalid user ID format'),
    )
    .optional()
    .messages({
      'array.base': 'User IDs must be an array',
    }),

  departmentIds: Joi.array()
    .items(
      Joi.string()
        .pattern(/^[0-9a-fA-F]{24}$/)
        .message('Invalid department ID format'),
    )
    .optional()
    .messages({
      'array.base': 'Department IDs must be an array',
    }),

  categoryIds: Joi.array()
    .items(
      Joi.string()
        .pattern(/^[0-9a-fA-F]{24}$/)
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
      'any.only':
        'Permission must be one of: ALLOWED, REQUIRES_APPROVAL, DENIED',
      'any.required': 'Permission level is required',
    }),

  approverRoles: Joi.array()
    .items(
      Joi.string()
        .pattern(/^[0-9a-fA-F]{24}$/)
        .message('Invalid approver role ID format'),
    )
    .optional()
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
  name: Joi.string().trim().min(3).max(100).optional(),
  description: Joi.string().trim().min(10).max(500).optional(),
  action: Joi.string()
    .valid(...Object.values(ActionType))
    .optional(),
  roleIds: Joi.array()
    .items(Joi.string().pattern(/^[0-9a-fA-F]{24}$/))
    .optional(),
  userIds: Joi.array()
    .items(Joi.string().pattern(/^[0-9a-fA-F]{24}$/))
    .optional(),
  departmentIds: Joi.array()
    .items(Joi.string().pattern(/^[0-9a-fA-F]{24}$/))
    .optional(),
  categoryIds: Joi.array()
    .items(Joi.string().pattern(/^[0-9a-fA-F]{24}$/))
    .optional(),
  permission: Joi.string()
    .valid(...Object.values(PermissionLevel))
    .optional(),
  approverRoles: Joi.array()
    .items(Joi.string().pattern(/^[0-9a-fA-F]{24}$/))
    .optional(),
  maxValue: Joi.number().positive().optional().allow(null),
  priority: Joi.number().integer().min(0).max(1000).optional(),
  isActive: Joi.boolean().optional(),
})
  .min(1)
  .messages({
    'object.min': 'At least one field must be provided for update',
  });

/**
 * Validation schema for checking permissions
 */
export const checkPermissionSchema = Joi.object({
  action: Joi.string()
    .valid(...Object.values(ActionType))
    .required(),
  userId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required(),
  categoryId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .optional(),
  machineValue: Joi.number().positive().optional(),
});
export const idParamSchema = Joi.object({
  id: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
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
      'any.only': 'Invalid action type',
      'any.required': 'Action is required',
    }),
});

/**
 * Validation schema for pagination query parameters
 */
export const paginationQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1).messages({
    'number.base': 'Page must be a number',
    'number.integer': 'Page must be an integer',
    'number.min': 'Page must be at least 1',
  }),
  limit: Joi.number().integer().min(1).max(100).default(10).messages({
    'number.base': 'Limit must be a number',
    'number.integer': 'Limit must be an integer',
    'number.min': 'Limit must be at least 1',
    'number.max': 'Limit cannot exceed 100',
  }),
});

/**
 * Validation schema for permission check query parameters
 */
export const permissionCheckQuerySchema = Joi.object({
  categoryId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .optional()
    .messages({
      'string.pattern.base': 'Invalid category ID format',
    }),
  machineValue: Joi.number().positive().optional().messages({
    'number.base': 'Machine value must be a number',
    'number.positive': 'Machine value must be positive',
  }),
});
