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

  subcategory_id: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .optional()
    .allow('')
    .messages({
      'string.pattern.base': 'Invalid subcategory ID format',
    }),

  machine_sequence: Joi.string().trim().max(50).optional().allow('').messages({
    'string.max': 'Machine sequence cannot exceed 50 characters',
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

  location: Joi.string().trim().min(2).max(100).required().messages({
    'string.empty': 'Location is required',
    'string.min': 'Location must be at least 2 characters long',
    'string.max': 'Location cannot exceed 100 characters',
    'any.required': 'Location is required',
  }),

  mobile_number: Joi.string()
    .trim()
    .min(10)
    .max(20)
    .required()
    .pattern(/^[+]?[0-9\s\-()]+$/)
    .messages({
      'string.empty': 'Mobile number is required',
      'string.min': 'Mobile number must be at least 10 characters long',
      'string.max': 'Mobile number cannot exceed 20 characters',
      'string.pattern.base':
        'Mobile number can only contain numbers, spaces, hyphens, parentheses, and optional + prefix',
      'any.required': 'Mobile number is required',
    }),

  dispatch_date: Joi.date().iso().optional().allow(null, '').messages({
    'date.base': 'Dispatch date must be a valid date',
    'date.format': 'Dispatch date must be in ISO format (YYYY-MM-DD)',
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

  subcategory_id: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .optional()
    .allow('')
    .messages({
      'string.pattern.base': 'Invalid subcategory ID format',
    }),

  machine_sequence: Joi.string().trim().max(50).optional().allow('').messages({
    'string.max': 'Machine sequence cannot exceed 50 characters',
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

  removedDocuments: Joi.array()
    .items(
      Joi.object({
        _id: Joi.string().optional(),
        name: Joi.string().optional(),
        file_path: Joi.string().optional(),
        document_type: Joi.string().optional(),
      }),
    )
    .optional()
    .messages({
      'array.base': 'Removed documents must be an array',
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

  location: Joi.string().trim().min(2).max(100).optional().messages({
    'string.min': 'Location must be at least 2 characters long',
    'string.max': 'Location cannot exceed 100 characters',
  }),

  mobile_number: Joi.string()
    .trim()
    .min(10)
    .max(20)
    .pattern(/^[+]?[0-9\s\-()]+$/)
    .optional()
    .messages({
      'string.min': 'Mobile number must be at least 10 characters long',
      'string.max': 'Mobile number cannot exceed 20 characters',
      'string.pattern.base':
        'Mobile number can only contain numbers, spaces, hyphens, parentheses, and optional + prefix',
    }),

  dispatch_date: Joi.date().iso().optional().allow(null, '').messages({
    'date.base': 'Dispatch date must be a valid date',
    'date.format': 'Dispatch date must be in ISO format (YYYY-MM-DD)',
  }),
})
  .custom((value, helpers) => {
    // Check if at least one field is provided (including empty string for machine_sequence)
    const fields = Object.keys(value).filter((key) => {
      // Count machine_sequence even if it's empty string (to allow clearing)
      if (key === 'machine_sequence') {
        return value[key] !== undefined;
      }
      // For other fields, only count if they have a value
      return (
        value[key] !== undefined && value[key] !== null && value[key] !== ''
      );
    });

    if (fields.length === 0) {
      return helpers.error('object.min');
    }
    return value;
  })
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
 * Validation schema for updating machine sequence
 */
export const updateMachineSequenceSchema = Joi.object({
  machine_sequence: Joi.string().trim().max(50).optional().allow('').messages({
    'string.max': 'Machine sequence cannot exceed 50 characters',
  }),
})
  .custom((value, helpers) => {
    // Ensure machine_sequence is provided
    if (value.machine_sequence === undefined) {
      return helpers.error('any.required');
    }
    return value;
  })
  .messages({
    'any.required': 'Machine sequence field is required',
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

  has_sequence: Joi.boolean().optional().messages({
    'boolean.base': 'Sequence filter must be a boolean',
  }),

  created_by: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .optional()
    .messages({
      'string.pattern.base': 'Invalid creator ID format',
    }),

  metadata_key: Joi.string().trim().max(100).optional().messages({
    'string.max': 'Metadata key cannot exceed 100 characters',
  }),

  metadata_value: Joi.string().trim().max(500).optional().messages({
    'string.max': 'Metadata value cannot exceed 500 characters',
  }),

  dispatch_date_from: Joi.date().iso().optional().messages({
    'date.base': 'Dispatch date from must be a valid date',
    'date.format': 'Dispatch date from must be in ISO format (YYYY-MM-DD)',
  }),

  dispatch_date_to: Joi.date().iso().optional().messages({
    'date.base': 'Dispatch date to must be a valid date',
    'date.format': 'Dispatch date to must be in ISO format (YYYY-MM-DD)',
  }),

  sortBy: Joi.string()
    .valid('createdAt', 'name', 'category', 'dispatch_date')
    .optional()
    .messages({
      'any.only':
        'Sort by must be one of: createdAt, name, category, dispatch_date',
    }),

  sortOrder: Joi.string().valid('asc', 'desc').optional().messages({
    'any.only': 'Sort order must be either asc or desc',
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
