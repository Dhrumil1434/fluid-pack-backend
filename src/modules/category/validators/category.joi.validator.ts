import Joi from 'joi';

/**
 * Category validation schemas
 */
export const categoryValidationSchemas = {
  createCategory: Joi.object({
    name: Joi.string().trim().required().min(2).max(100).messages({
      'string.empty': 'Category name is required',
      'string.min': 'Category name must be at least 2 characters long',
      'string.max': 'Category name cannot exceed 100 characters',
      'any.required': 'Category name is required',
    }),
    slug: Joi.string()
      .trim()
      .lowercase()
      .pattern(/^[a-z0-9-]+$/)
      .max(100)
      .optional()
      .messages({
        'string.pattern.base':
          'Slug can only contain lowercase letters, numbers, and hyphens',
        'string.max': 'Slug cannot exceed 100 characters',
      }),
    description: Joi.string().trim().max(500).optional().allow('').messages({
      'string.max': 'Description cannot exceed 500 characters',
    }),
    parentId: Joi.string()
      .pattern(/^[0-9a-fA-F]{24}$/)
      .optional()
      .allow(null)
      .messages({
        'string.pattern.base': 'Invalid parent category ID format',
      }),
    sortOrder: Joi.number().integer().min(0).default(0).optional().messages({
      'number.base': 'Sort order must be a number',
      'number.integer': 'Sort order must be an integer',
      'number.min': 'Sort order cannot be negative',
    }),
    imageUrl: Joi.string()
      .uri()
      .pattern(/\.(jpg|jpeg|png|gif|webp)$/i)
      .optional()
      .allow('')
      .messages({
        'string.uri': 'Image URL must be a valid URL',
        'string.pattern.base': 'Image URL must point to a valid image file',
      }),
    seoTitle: Joi.string().trim().max(60).optional().allow('').messages({
      'string.max': 'SEO title cannot exceed 60 characters',
    }),
    seoDescription: Joi.string().trim().max(160).optional().allow('').messages({
      'string.max': 'SEO description cannot exceed 160 characters',
    }),
  }),

  updateCategory: Joi.object({
    name: Joi.string().trim().min(2).max(100).optional().messages({
      'string.min': 'Category name must be at least 2 characters long',
      'string.max': 'Category name cannot exceed 100 characters',
    }),
    slug: Joi.string()
      .trim()
      .lowercase()
      .pattern(/^[a-z0-9-]+$/)
      .max(100)
      .optional()
      .messages({
        'string.pattern.base':
          'Slug can only contain lowercase letters, numbers, and hyphens',
        'string.max': 'Slug cannot exceed 100 characters',
      }),
    description: Joi.string().trim().max(500).optional().allow('').messages({
      'string.max': 'Description cannot exceed 500 characters',
    }),
    parentId: Joi.string()
      .pattern(/^[0-9a-fA-F]{24}$/)
      .optional()
      .allow(null)
      .messages({
        'string.pattern.base': 'Invalid parent category ID format',
      }),
    sortOrder: Joi.number().integer().min(0).optional().messages({
      'number.base': 'Sort order must be a number',
      'number.integer': 'Sort order must be an integer',
      'number.min': 'Sort order cannot be negative',
    }),
    imageUrl: Joi.string()
      .uri()
      .pattern(/\.(jpg|jpeg|png|gif|webp)$/i)
      .optional()
      .allow('')
      .messages({
        'string.uri': 'Image URL must be a valid URL',
        'string.pattern.base': 'Image URL must point to a valid image file',
      }),
    seoTitle: Joi.string().trim().max(60).optional().allow('').messages({
      'string.max': 'SEO title cannot exceed 60 characters',
    }),
    seoDescription: Joi.string().trim().max(160).optional().allow('').messages({
      'string.max': 'SEO description cannot exceed 160 characters',
    }),
    isActive: Joi.boolean().optional().messages({
      'boolean.base': 'isActive must be a boolean value',
    }),
  }),

  categoryId: Joi.object({
    id: Joi.string()
      .pattern(/^[0-9a-fA-F]{24}$/)
      .required()
      .messages({
        'string.pattern.base': 'Invalid category ID format',
        'any.required': 'Category ID is required',
      }),
  }),

  categoryQuery: Joi.object({
    includeInactive: Joi.boolean().optional().default(false).messages({
      'boolean.base': 'includeInactive must be a boolean value',
    }),
    level: Joi.number().integer().min(0).max(3).optional().messages({
      'number.base': 'Level must be a number',
      'number.integer': 'Level must be an integer',
      'number.min': 'Level cannot be negative',
      'number.max': 'Level cannot exceed 3',
    }),
    parentId: Joi.string()
      .pattern(/^[0-9a-fA-F]{24}$/)
      .optional()
      .allow(null)
      .messages({
        'string.pattern.base': 'Invalid parent category ID format',
      }),
  }),
};

/**
 * Sequence Management validation schemas
 */
export const sequenceManagementValidationSchemas = {
  createSequenceConfig: Joi.object({
    categoryId: Joi.string()
      .pattern(/^[0-9a-fA-F]{24}$/)
      .required()
      .messages({
        'string.pattern.base': 'Invalid category ID format',
        'any.required': 'Category ID is required',
      }),
    subcategoryId: Joi.string()
      .pattern(/^[0-9a-fA-F]{24}$/)
      .optional()
      .allow(null)
      .messages({
        'string.pattern.base': 'Invalid subcategory ID format',
      }),
    sequencePrefix: Joi.string()
      .trim()
      .uppercase()
      .pattern(/^[A-Z0-9-]+$/)
      .min(1)
      .max(10)
      .required()
      .messages({
        'string.empty': 'Sequence prefix is required',
        'string.pattern.base':
          'Sequence prefix can only contain uppercase letters, numbers, and hyphens',
        'string.min': 'Sequence prefix must be at least 1 character long',
        'string.max': 'Sequence prefix cannot exceed 10 characters',
        'any.required': 'Sequence prefix is required',
      }),
    startingNumber: Joi.number().integer().min(1).required().messages({
      'number.base': 'Starting number must be a number',
      'number.integer': 'Starting number must be an integer',
      'number.min': 'Starting number must be at least 1',
      'any.required': 'Starting number is required',
    }),
    format: Joi.string()
      .trim()
      .required()
      .custom((value, helpers) => {
        if (!value.includes('{category}') || !value.includes('{sequence}')) {
          return helpers.error('custom.format');
        }
        return value;
      })
      .messages({
        'string.empty': 'Format is required',
        'any.required': 'Format is required',
        'custom.format':
          'Format must contain {category} and {sequence} placeholders',
      }),
  }),

  updateSequenceConfig: Joi.object({
    sequencePrefix: Joi.string()
      .trim()
      .uppercase()
      .pattern(/^[A-Z0-9-]+$/)
      .min(1)
      .max(10)
      .optional()
      .messages({
        'string.pattern.base':
          'Sequence prefix can only contain uppercase letters, numbers, and hyphens',
        'string.min': 'Sequence prefix must be at least 1 character long',
        'string.max': 'Sequence prefix cannot exceed 10 characters',
      }),
    startingNumber: Joi.number().integer().min(1).optional().messages({
      'number.base': 'Starting number must be a number',
      'number.integer': 'Starting number must be an integer',
      'number.min': 'Starting number must be at least 1',
    }),
    format: Joi.string()
      .trim()
      .optional()
      .custom((value, helpers) => {
        if (
          value &&
          (!value.includes('{category}') || !value.includes('{sequence}'))
        ) {
          return helpers.error('custom.format');
        }
        return value;
      })
      .messages({
        'custom.format':
          'Format must contain {category} and {sequence} placeholders',
      }),
    isActive: Joi.boolean().optional().messages({
      'boolean.base': 'isActive must be a boolean value',
    }),
  }),

  sequenceConfigId: Joi.object({
    id: Joi.string()
      .pattern(/^[0-9a-fA-F]{24}$/)
      .required()
      .messages({
        'string.pattern.base': 'Invalid sequence configuration ID format',
        'any.required': 'Sequence configuration ID is required',
      }),
  }),

  sequenceGeneration: Joi.object({
    categoryId: Joi.string()
      .pattern(/^[0-9a-fA-F]{24}$/)
      .required()
      .messages({
        'string.pattern.base': 'Invalid category ID format',
        'any.required': 'Category ID is required',
      }),
    subcategoryId: Joi.string()
      .pattern(/^[0-9a-fA-F]{24}$/)
      .optional()
      .allow(null)
      .messages({
        'string.pattern.base': 'Invalid subcategory ID format',
      }),
  }),

  sequenceReset: Joi.object({
    newStartingNumber: Joi.number().integer().min(1).required().messages({
      'number.base': 'New starting number must be a number',
      'number.integer': 'New starting number must be an integer',
      'number.min': 'New starting number must be at least 1',
      'any.required': 'New starting number is required',
    }),
  }),

  sequenceQuery: Joi.object({
    categoryId: Joi.string()
      .pattern(/^[0-9a-fA-F]{24}$/)
      .optional()
      .messages({
        'string.pattern.base': 'Invalid category ID format',
      }),
    subcategoryId: Joi.string()
      .pattern(/^[0-9a-fA-F]{24}$/)
      .optional()
      .allow(null)
      .messages({
        'string.pattern.base': 'Invalid subcategory ID format',
      }),
    isActive: Joi.boolean().optional().messages({
      'boolean.base': 'isActive must be a boolean value',
    }),
  }),
};

/**
 * Export all validation schemas
 */
export const validationSchemas = {
  ...categoryValidationSchemas,
  ...sequenceManagementValidationSchemas,
};
