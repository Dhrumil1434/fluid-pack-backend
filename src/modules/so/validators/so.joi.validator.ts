// validators/so.joi.validator.ts
import Joi from 'joi';

/**
 * Validation schema for creating SO
 */
export const createSOSchema = Joi.object({
  name: Joi.string()
    .trim()
    .min(2)
    .max(100)
    .required()
    .pattern(/^[a-zA-Z0-9\s\-_&().,/]+$/)
    .messages({
      'string.empty': 'SO name is required',
      'string.min': 'SO name must be at least 2 characters long',
      'string.max': 'SO name cannot exceed 100 characters',
      'string.pattern.base':
        'SO name can only contain letters, numbers, spaces, and common punctuation',
      'any.required': 'SO name is required',
    }),

  category_id: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      'string.pattern.base': 'Invalid category ID format',
      'any.required': 'Category ID is required',
    }),

  subcategory_id: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .optional()
    .allow(null, '')
    .messages({
      'string.pattern.base': 'Invalid subcategory ID format',
    }),

  party_name: Joi.string()
    .trim()
    .min(2)
    .max(100)
    .required()
    .pattern(/^[a-zA-Z0-9\s\-_&().,/]+$/)
    .messages({
      'string.empty': 'Party name is required',
      'string.min': 'Party name must be at least 2 characters long',
      'string.max': 'Party name cannot exceed 100 characters',
      'string.pattern.base':
        'Party name can only contain letters, numbers, spaces, and common punctuation',
      'any.required': 'Party name is required',
    }),

  mobile_number: Joi.string()
    .trim()
    .min(10)
    .max(20)
    .required()
    .pattern(
      /^[+]?[(]?[0-9]{1,4}[)]?[-\\s.]?[(]?[0-9]{1,4}[)]?[-\\s.]?[0-9]{1,9}$/,
    )
    .messages({
      'string.empty': 'Mobile number is required',
      'string.min': 'Mobile number must be at least 10 characters long',
      'string.max': 'Mobile number cannot exceed 20 characters',
      'string.pattern.base': 'Mobile number format is invalid',
      'any.required': 'Mobile number is required',
    }),

  description: Joi.string()
    .trim()
    .max(1000)
    .optional()
    .allow('', null)
    .messages({
      'string.max': 'Description cannot exceed 1000 characters',
    }),

  documents: Joi.array()
    .items(
      Joi.object({
        name: Joi.string().required(),
        file_path: Joi.string().required(),
        document_type: Joi.string().optional(),
      }),
    )
    .max(10)
    .optional()
    .messages({
      'array.max': 'Cannot upload more than 10 documents',
    }),
});

/**
 * Validation schema for updating SO
 */
export const updateSOSchema = Joi.object({
  name: Joi.string()
    .trim()
    .min(2)
    .max(100)
    .pattern(/^[a-zA-Z0-9\s\-_&().,/]+$/)
    .optional()
    .messages({
      'string.min': 'SO name must be at least 2 characters long',
      'string.max': 'SO name cannot exceed 100 characters',
      'string.pattern.base':
        'SO name can only contain letters, numbers, spaces, and common punctuation',
    }),

  category_id: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .optional()
    .messages({
      'string.pattern.base': 'Invalid category ID format',
    }),

  subcategory_id: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .optional()
    .allow(null, '')
    .messages({
      'string.pattern.base': 'Invalid subcategory ID format',
    }),

  party_name: Joi.string()
    .trim()
    .min(2)
    .max(100)
    .pattern(/^[a-zA-Z0-9\s\-_&().,/]+$/)
    .optional()
    .messages({
      'string.min': 'Party name must be at least 2 characters long',
      'string.max': 'Party name cannot exceed 100 characters',
      'string.pattern.base':
        'Party name can only contain letters, numbers, spaces, and common punctuation',
    }),

  mobile_number: Joi.string()
    .trim()
    .min(10)
    .max(20)
    .pattern(
      /^[+]?[(]?[0-9]{1,4}[)]?[-\\s.]?[(]?[0-9]{1,4}[)]?[-\\s.]?[0-9]{1,9}$/,
    )
    .optional()
    .messages({
      'string.min': 'Mobile number must be at least 10 characters long',
      'string.max': 'Mobile number cannot exceed 20 characters',
      'string.pattern.base': 'Mobile number format is invalid',
    }),

  description: Joi.string()
    .trim()
    .max(1000)
    .optional()
    .allow('', null)
    .messages({
      'string.max': 'Description cannot exceed 1000 characters',
    }),

  is_active: Joi.boolean().optional().messages({
    'boolean.base': 'is_active must be a boolean value',
  }),

  documents: Joi.array()
    .items(
      Joi.object({
        name: Joi.string().required(),
        file_path: Joi.string().required(),
        document_type: Joi.string().optional(),
      }),
    )
    .max(10)
    .optional()
    .messages({
      'array.max': 'Cannot upload more than 10 documents',
    }),

  removedDocuments: Joi.array()
    .items(
      Joi.object({
        _id: Joi.string().optional(),
        name: Joi.string().optional(),
        file_path: Joi.string().optional(),
        document_type: Joi.string().optional(),
      }),
    )
    .optional(),
});
