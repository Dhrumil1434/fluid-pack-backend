// validators/machine.validator.ts
import Joi from 'joi';

/**
 * Validation schema for creating machine
 */
export const createMachineSchema = Joi.object({
  name: Joi.string()
    .trim()
    .min(2)
    .max(100)
    .required()
    .pattern(/^[a-zA-Z0-9\s\-_&().,/]+$/)
    .messages({
      'string.empty': 'Machine name is required',
      'string.min': 'Machine name must be at least 2 characters long',
      'string.max': 'Machine name cannot exceed 100 characters',
      'string.pattern.base':
        'Machine name can only contain letters, numbers, spaces, and common punctuation',
      'any.required': 'Machine name is required',
    }),

  category_id: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      'string.pattern.base': 'Invalid category ID format',
      'any.required': 'Category ID is required',
    }),

  images: Joi.array()
    .items(
      Joi.string().messages({
        'string.base': 'Each image path must be a string',
      }),
    )
    .max(10)
    .optional()
    .messages({
      'array.max': 'Cannot upload more than 10 images',
    }),

  metadata: Joi.object().optional().messages({
    'object.base': 'Metadata must be a valid object',
  }),
});

/**
 * Validation schema for updating machine
 */
export const updateMachineSchema = Joi.object({
  name: Joi.string()
    .trim()
    .min(2)
    .max(100)
    .pattern(/^[a-zA-Z0-9\s\-_&().,/]+$/)
    .optional()
    .messages({
      'string.min': 'Machine name must be at least 2 characters long',
      'string.max': 'Machine name cannot exceed 100 characters',
      'string.pattern.base':
        'Machine name can only contain letters, numbers, spaces, and common punctuation',
    }),

  category_id: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .optional()
    .messages({
      'string.pattern.base': 'Invalid category ID format',
    }),

  images: Joi.array()
    .items(
      Joi.string().messages({
        'string.base': 'Each image path must be a string',
      }),
    )
    .max(10)
    .optional()
    .messages({
      'array.max': 'Cannot upload more than 10 images',
    }),

  metadata: Joi.object().optional().messages({
    'object.base': 'Metadata must be a valid object',
  }),
})
  .min(1)
  .messages({
    'object.min': 'At least one field must be provided for update',
  });

/**
 * Validation schema for machine ID parameter
 */
export const machineIdParamSchema = Joi.object({
  id: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      'string.pattern.base': 'Invalid machine ID format',
      'any.required': 'Machine ID is required',
    }),
});

/**
 * Validation schema for pagination query parameters
 */
export const machinePaginationQuerySchema = Joi.object({
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

  search: Joi.string().trim().min(1).max(50).optional().messages({
    'string.min': 'Search term must be at least 1 character long',
    'string.max': 'Search term cannot exceed 50 characters',
  }),

  category_id: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .optional()
    .messages({
      'string.pattern.base': 'Invalid category ID format',
    }),

  is_approved: Joi.boolean().optional().messages({
    'boolean.base': 'Approval status must be a boolean',
  }),

  created_by: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .optional()
    .messages({
      'string.pattern.base': 'Invalid creator ID format',
    }),
});

/**
 * Validation schema for machine approval
 */
export const machineApprovalSchema = Joi.object({
  is_approved: Joi.boolean().required().messages({
    'boolean.base': 'Approval status must be a boolean',
    'any.required': 'Approval status is required',
  }),
});

/**
 * Validation schema for multiple machine IDs
 */
export const validateMachineIdsSchema = Joi.object({
  machineIds: Joi.array()
    .items(
      Joi.string()
        .pattern(/^[0-9a-fA-F]{24}$/)
        .message('Invalid machine ID format'),
    )
    .min(1)
    .max(50)
    .required()
    .messages({
      'array.base': 'Machine IDs must be an array',
      'array.min': 'At least one machine ID is required',
      'array.max': 'Cannot validate more than 50 machine IDs at once',
      'any.required': 'Machine IDs are required',
    }),
});
