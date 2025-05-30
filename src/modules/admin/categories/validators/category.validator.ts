// category.validator.ts
import Joi from 'joi';

/**
 * Validation schema for creating category
 */
export const createCategorySchema = Joi.object({
  name: Joi.string()
    .trim()
    .min(2)
    .max(50)
    .required()
    .pattern(/^[a-zA-Z0-9\s\-_&()]+$/)
    .messages({
      'string.empty': 'Category name is required',
      'string.min': 'Category name must be at least 2 characters long',
      'string.max': 'Category name cannot exceed 50 characters',
      'string.pattern.base':
        'Category name can only contain letters, numbers, spaces, hyphens, underscores, ampersands, and parentheses',
      'any.required': 'Category name is required',
    }),

  description: Joi.string().trim().min(5).max(200).required().messages({
    'string.empty': 'Description is required',
    'string.min': 'Description must be at least 5 characters long',
    'string.max': 'Description cannot exceed 200 characters',
    'any.required': 'Description is required',
  }),
});

/**
 * Validation schema for updating category
 */
export const updateCategorySchema = Joi.object({
  name: Joi.string()
    .trim()
    .min(2)
    .max(50)
    .pattern(/^[a-zA-Z0-9\s\-_&()]+$/)
    .optional()
    .messages({
      'string.min': 'Category name must be at least 2 characters long',
      'string.max': 'Category name cannot exceed 50 characters',
      'string.pattern.base':
        'Category name can only contain letters, numbers, spaces, hyphens, underscores, ampersands, and parentheses',
    }),

  description: Joi.string().trim().min(5).max(200).optional().messages({
    'string.min': 'Description must be at least 5 characters long',
    'string.max': 'Description cannot exceed 200 characters',
  }),
})
  .min(1)
  .messages({
    'object.min': 'At least one field must be provided for update',
  });

/**
 * Validation schema for category ID parameter
 */
export const categoryIdParamSchema = Joi.object({
  id: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      'string.pattern.base': 'Invalid category ID format',
      'any.required': 'Category ID is required',
    }),
});

/**
 * Validation schema for pagination query parameters
 */
export const categoryPaginationQuerySchema = Joi.object({
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
});

/**
 * Validation schema for multiple category IDs (for validation endpoint)
 */
export const validateCategoryIdsSchema = Joi.object({
  categoryIds: Joi.array()
    .items(
      Joi.string()
        .pattern(/^[0-9a-fA-F]{24}$/)
        .message('Invalid category ID format'),
    )
    .min(1)
    .max(50)
    .required()
    .messages({
      'array.base': 'Category IDs must be an array',
      'array.min': 'At least one category ID is required',
      'array.max': 'Cannot validate more than 50 category IDs at once',
      'any.required': 'Category IDs are required',
    }),
});
