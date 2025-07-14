import Joi from 'joi';
import mongoose from 'mongoose';

/**
 * Validation schemas for QA Machine operations
 */

// Base QA Machine entry schema
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
  report_link: Joi.string().uri().required().messages({
    'string.uri': 'Report link must be a valid URL',
    'any.required': 'Report link is required',
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
});

// Create QA Machine entry schema
export const createQAMachineEntrySchema = qaMachineEntryBaseSchema;

// Update QA Machine entry schema
export const updateQAMachineEntrySchema = Joi.object({
  report_link: Joi.string().uri().optional().messages({
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
})
  .min(1)
  .messages({
    'object.min': 'At least one field must be provided for update',
  });

// QA Machine entry ID parameter schema
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
      'any.invalid': 'Invalid QA entry ID format',
      'any.required': 'QA entry ID is required',
    }),
});

// Machine ID parameter schema for getting QA entries by machine
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

// User ID parameter schema for getting QA entries by user
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

// Pagination query schema for QA Machine entries
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
});

// Validate multiple QA entry IDs schema
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
      'array.min': 'At least one QA entry ID is required',
      'array.max': 'Maximum 100 QA entry IDs allowed',
      'any.required': 'QA entry IDs array is required',
    }),
});
