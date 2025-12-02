import Joi from 'joi';
import mongoose from 'mongoose';

/**
 * Validation schemas for QC Machine operations
 */

// Base QC Machine entry schema
const qaMachineEntryBaseSchema = Joi.object({
  machine_id: Joi.string()
    .custom((value, helpers) => {
      if (!mongoose.Types.ObjectId.isValid(value)) {
        return helpers.error('any.invalid');
      }
      return value;
    })
    .required()
    .messages({
      'any.invalid': 'Invalid machine ID format',
      'any.required': 'Machine ID is required',
    }),

  // Machine fields
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
  machine_sequence: Joi.string().trim().max(500).optional().allow('').messages({
    'string.max': 'Machine sequence cannot exceed 500 characters',
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
  documents: Joi.array()
    .items(
      Joi.object({
        name: Joi.string().required().trim(),
        file_path: Joi.string().required().trim(),
        document_type: Joi.string().optional().trim(),
      }),
    )
    .optional()
    .messages({
      'array.base': 'Documents must be an array',
    }),

  // QC-specific fields
  qcNotes: Joi.string().trim().max(5000).optional().allow('').messages({
    'string.max': 'QC notes cannot exceed 5000 characters',
  }),
  qualityScore: Joi.number().min(0).max(100).optional().allow(null).messages({
    'number.min': 'Quality score must be between 0 and 100',
    'number.max': 'Quality score must be between 0 and 100',
  }),
  inspectionDate: Joi.date().iso().optional().allow(null, '').messages({
    'date.base': 'Inspection date must be a valid date',
    'date.format': 'Inspection date must be in ISO format (YYYY-MM-DD)',
  }),
  qc_date: Joi.date().iso().optional().allow(null, '').messages({
    'date.base': 'QC date must be a valid date',
    'date.format': 'QC date must be in ISO format (YYYY-MM-DD)',
  }),
  nextInspectionDate: Joi.date().iso().optional().allow(null, '').messages({
    'date.base': 'Next inspection date must be a valid date',
    'date.format': 'Next inspection date must be in ISO format (YYYY-MM-DD)',
  }),
  report_link: Joi.string().uri().optional().allow('').messages({
    'string.uri': 'Report link must be a valid URL',
  }),
  files: Joi.array()
    .items(
      Joi.string().messages({
        'string.base': 'Each file path must be a string',
      }),
    )
    .max(10)
    .optional()
    .messages({
      'array.max': 'Cannot upload more than 10 files',
    }),
  metadata: Joi.object().unknown(true).optional(),
  is_active: Joi.boolean().optional(),
});

// Create QC Machine entry schema
export const createQAMachineEntrySchema = qaMachineEntryBaseSchema;

// Update QC Machine entry schema
export const updateQAMachineEntrySchema = Joi.object({
  // Machine fields
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
  machine_sequence: Joi.string().trim().max(500).optional().allow('').messages({
    'string.max': 'Machine sequence cannot exceed 500 characters',
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
  documents: Joi.array()
    .items(
      Joi.object({
        name: Joi.string().required().trim(),
        file_path: Joi.string().required().trim(),
        document_type: Joi.string().optional().trim(),
      }),
    )
    .optional()
    .messages({
      'array.base': 'Documents must be an array',
    }),

  // QC-specific fields
  qcNotes: Joi.string().trim().max(5000).optional().allow('').messages({
    'string.max': 'QC notes cannot exceed 5000 characters',
  }),
  qualityScore: Joi.number().min(0).max(100).optional().allow(null).messages({
    'number.min': 'Quality score must be between 0 and 100',
    'number.max': 'Quality score must be between 0 and 100',
  }),
  inspectionDate: Joi.date().iso().optional().allow(null, '').messages({
    'date.base': 'Inspection date must be a valid date',
    'date.format': 'Inspection date must be in ISO format (YYYY-MM-DD)',
  }),
  qc_date: Joi.date().iso().optional().allow(null, '').messages({
    'date.base': 'QC date must be a valid date',
    'date.format': 'QC date must be in ISO format (YYYY-MM-DD)',
  }),
  nextInspectionDate: Joi.date().iso().optional().allow(null, '').messages({
    'date.base': 'Next inspection date must be a valid date',
    'date.format': 'Next inspection date must be in ISO format (YYYY-MM-DD)',
  }),
  report_link: Joi.string().uri().optional().allow('').messages({
    'string.uri': 'Report link must be a valid URL',
  }),
  files: Joi.array()
    .items(
      Joi.string().messages({
        'string.base': 'Each file path must be a string',
      }),
    )
    .max(10)
    .optional()
    .messages({
      'array.max': 'Cannot upload more than 10 files',
    }),
  metadata: Joi.object().unknown(true).optional(),
  is_active: Joi.boolean().optional(),
  approval_status: Joi.string()
    .valid('PENDING', 'APPROVED', 'REJECTED')
    .optional()
    .messages({
      'any.only': 'Approval status must be PENDING, APPROVED, or REJECTED',
    }),
  rejection_reason: Joi.string()
    .trim()
    .max(1000)
    .optional()
    .allow('')
    .messages({
      'string.max': 'Rejection reason cannot exceed 1000 characters',
    }),
})
  .min(1)
  .messages({
    'object.min': 'At least one field must be provided for update',
  });

// QC Machine entry ID parameter schema
export const qaMachineEntryIdParamSchema = Joi.object({
  id: Joi.string()
    .custom((value, helpers) => {
      if (!mongoose.Types.ObjectId.isValid(value)) {
        return helpers.error('any.invalid');
      }
      return value;
    })
    .required()
    .messages({
      'any.invalid': 'Invalid QC entry ID format',
      'any.required': 'QC entry ID is required',
    }),
});

// Machine ID parameter schema for getting QC entries by machine
export const machineIdParamSchema = Joi.object({
  machineId: Joi.string()
    .custom((value, helpers) => {
      if (!mongoose.Types.ObjectId.isValid(value)) {
        return helpers.error('any.invalid');
      }
      return value;
    })
    .required()
    .messages({
      'any.invalid': 'Invalid machine ID format',
      'any.required': 'Machine ID is required',
    }),
});

// User ID parameter schema for getting QC entries by user
export const userIdParamSchema = Joi.object({
  userId: Joi.string()
    .custom((value, helpers) => {
      if (!mongoose.Types.ObjectId.isValid(value)) {
        return helpers.error('any.invalid');
      }
      return value;
    })
    .required()
    .messages({
      'any.invalid': 'Invalid user ID format',
      'any.required': 'User ID is required',
    }),
});

// Pagination query schema for QC Machine entries
export const qaMachinePaginationQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).optional().default(1),
  limit: Joi.number().integer().min(1).max(100).optional().default(10),
  machine_id: Joi.string()
    .custom((value, helpers) => {
      if (!mongoose.Types.ObjectId.isValid(value)) {
        return helpers.error('any.invalid');
      }
      return value;
    })
    .optional()
    .messages({
      'any.invalid': 'Invalid machine ID format',
    }),
  added_by: Joi.string()
    .custom((value, helpers) => {
      if (!mongoose.Types.ObjectId.isValid(value)) {
        return helpers.error('any.invalid');
      }
      return value;
    })
    .optional()
    .messages({
      'any.invalid': 'Invalid user ID format',
    }),
  search: Joi.string().trim().optional(),
  is_active: Joi.boolean().optional(),
  created_from: Joi.date().iso().optional(),
  created_to: Joi.date().iso().optional(),
});

// Validate multiple QC entry IDs schema
export const validateQAMachineEntryIdsSchema = Joi.object({
  qaEntryIds: Joi.array()
    .items(
      Joi.string().custom((value, helpers) => {
        if (!mongoose.Types.ObjectId.isValid(value)) {
          return helpers.error('any.invalid');
        }
        return value;
      }),
    )
    .min(1)
    .max(100)
    .required()
    .messages({
      'array.min': 'At least one QC entry ID is required',
      'array.max': 'Maximum 100 QC entry IDs allowed',
      'any.required': 'QC entry IDs array is required',
    }),
});
