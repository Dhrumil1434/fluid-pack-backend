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
    .optional()
    .pattern(/^[a-zA-Z0-9\s\-_&().,/]+$/)
    .messages({
      'string.min': 'SO name must be at least 2 characters long',
      'string.max': 'SO name cannot exceed 100 characters',
      'string.pattern.base':
        'SO name can only contain letters, numbers, spaces, and common punctuation',
    }),

  customer: Joi.string().trim().min(2).max(200).required().messages({
    'string.empty': 'Customer is required',
    'string.min': 'Customer must be at least 2 characters long',
    'string.max': 'Customer cannot exceed 200 characters',
    'any.required': 'Customer is required',
  }),

  location: Joi.string().trim().min(2).max(100).required().messages({
    'string.empty': 'Location is required',
    'string.min': 'Location must be at least 2 characters long',
    'string.max': 'Location cannot exceed 100 characters',
    'any.required': 'Location is required',
  }),

  po_number: Joi.string().trim().min(1).max(200).required().messages({
    'string.empty': 'P.O. Number is required',
    'string.min': 'P.O. Number must be at least 1 character long',
    'string.max': 'P.O. Number cannot exceed 200 characters',
    'any.required': 'P.O. Number is required',
  }),

  po_date: Joi.date().required().messages({
    'date.base': 'P.O. Date must be a valid date',
    'any.required': 'P.O. Date is required',
  }),

  so_number: Joi.string().trim().min(1).max(200).required().messages({
    'string.empty': 'S.O. Number is required',
    'string.min': 'S.O. Number must be at least 1 character long',
    'string.max': 'S.O. Number cannot exceed 200 characters',
    'any.required': 'S.O. Number is required',
  }),

  so_date: Joi.date().required().messages({
    'date.base': 'S.O. Date must be a valid date',
    'any.required': 'S.O. Date is required',
  }),

  items: Joi.array()
    .items(
      Joi.object({
        no: Joi.number().integer().min(1).optional().messages({
          'number.base': 'No. must be a number',
          'number.integer': 'No. must be an integer',
          'number.min': 'No. must be at least 1',
        }),
        item_code: Joi.string().trim().min(1).max(100).optional().messages({
          'string.min': 'Item Code must be at least 1 character long',
          'string.max': 'Item Code cannot exceed 100 characters',
        }),
        item_details: Joi.string().trim().min(1).max(500).optional().messages({
          'string.min': 'Item Details must be at least 1 character long',
          'string.max': 'Item Details cannot exceed 500 characters',
        }),
        uom: Joi.string().trim().min(1).max(50).optional().messages({
          'string.min': 'UOM must be at least 1 character long',
          'string.max': 'UOM cannot exceed 50 characters',
        }),
        quantity: Joi.number().min(0).optional().messages({
          'number.base': 'Quantity must be a number',
          'number.min': 'Quantity must be at least 0',
        }),
        delivery_schedule: Joi.date()
          .optional()
          .allow(null)
          .allow('')
          .messages({
            'date.base': 'Delivery Schedule must be a valid date',
          }),
        total: Joi.number().min(0).optional().allow(null).allow('').messages({
          'number.base': 'Total must be a number',
          'number.min': 'Total must be at least 0',
        }),
      }),
    )
    .optional()
    .allow(null)
    .messages({
      'array.base': 'Items must be an array',
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
    .allow(null)
    .allow('')
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

  description: Joi.string().trim().optional().allow('').allow(null),

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

  customer: Joi.string().trim().min(2).max(200).optional().messages({
    'string.min': 'Customer must be at least 2 characters long',
    'string.max': 'Customer cannot exceed 200 characters',
  }),

  location: Joi.string().trim().min(2).max(100).optional().messages({
    'string.min': 'Location must be at least 2 characters long',
    'string.max': 'Location cannot exceed 100 characters',
  }),

  po_number: Joi.string().trim().min(1).max(200).optional().messages({
    'string.min': 'P.O. Number must be at least 1 character long',
    'string.max': 'P.O. Number cannot exceed 200 characters',
  }),

  po_date: Joi.date().optional().messages({
    'date.base': 'P.O. Date must be a valid date',
  }),

  so_number: Joi.string().trim().min(1).max(200).optional().messages({
    'string.min': 'S.O. Number must be at least 1 character long',
    'string.max': 'S.O. Number cannot exceed 200 characters',
  }),

  so_date: Joi.date().optional().messages({
    'date.base': 'S.O. Date must be a valid date',
  }),

  items: Joi.array()
    .items(
      Joi.object({
        no: Joi.number().integer().min(1).optional().messages({
          'number.base': 'No. must be a number',
          'number.integer': 'No. must be an integer',
          'number.min': 'No. must be at least 1',
        }),
        item_code: Joi.string().trim().min(1).max(100).optional().messages({
          'string.min': 'Item Code must be at least 1 character long',
          'string.max': 'Item Code cannot exceed 100 characters',
        }),
        item_details: Joi.string().trim().min(1).max(500).optional().messages({
          'string.min': 'Item Details must be at least 1 character long',
          'string.max': 'Item Details cannot exceed 500 characters',
        }),
        uom: Joi.string().trim().min(1).max(50).optional().messages({
          'string.min': 'UOM must be at least 1 character long',
          'string.max': 'UOM cannot exceed 50 characters',
        }),
        quantity: Joi.number().min(0).optional().messages({
          'number.base': 'Quantity must be a number',
          'number.min': 'Quantity must be at least 0',
        }),
        delivery_schedule: Joi.date().optional().allow(null).messages({
          'date.base': 'Delivery Schedule must be a valid date',
        }),
        total: Joi.number().min(0).optional().allow(null).messages({
          'number.base': 'Total must be a number',
          'number.min': 'Total must be at least 0',
        }),
      }),
    )
    .optional()
    .messages({
      'array.base': 'Items must be an array',
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
    .allow(null)
    .allow('')
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

  description: Joi.string().trim().optional().allow('').allow(null),

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
