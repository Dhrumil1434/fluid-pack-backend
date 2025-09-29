import Joi from 'joi';
import {
  QCApprovalType,
  QCApprovalStatus,
} from '../../../models/qcApproval.model';

/**
 * QC Approval ID parameter validation
 */
export const qcApprovalIdParamSchema = Joi.object({
  params: Joi.object({
    id: Joi.string().hex().length(24).required().messages({
      'string.hex': 'Invalid QC Approval ID format',
      'string.length': 'QC Approval ID must be 24 characters long',
      'any.required': 'QC Approval ID is required',
    }),
  }),
});

/**
 * Create QC approval validation
 */
export const createQCApprovalSchema = Joi.object({
  body: Joi.object({
    machineId: Joi.string().hex().length(24).required().messages({
      'string.hex': 'Invalid machineId format',
      'string.length': 'Machine ID must be 24 characters long',
      'any.required': 'Machine ID is required',
    }),
    qcEntryId: Joi.string().hex().length(24).optional().messages({
      'string.hex': 'Invalid qcEntryId format',
      'string.length': 'QC Entry ID must be 24 characters long',
    }),
    approvalType: Joi.string()
      .valid(...Object.values(QCApprovalType))
      .optional()
      .messages({
        'any.only': 'Invalid approval type',
      }),
    qcNotes: Joi.string().trim().optional(),
    qcFindings: Joi.object().optional(),
    qualityScore: Joi.number().min(0).max(100).optional().messages({
      'number.min': 'Quality score must be at least 0',
      'number.max': 'Quality score cannot exceed 100',
    }),
    inspectionDate: Joi.date().iso().optional().messages({
      'date.format': 'Inspection date must be a valid ISO date',
    }),
    nextInspectionDate: Joi.date().iso().optional().messages({
      'date.format': 'Next inspection date must be a valid ISO date',
    }),
    requestNotes: Joi.string().trim().optional(),
  }),
});

/**
 * Update QC approval validation
 */
export const updateQCApprovalSchema = Joi.object({
  body: Joi.object({
    qcNotes: Joi.string().optional(),
    qcFindings: Joi.object().optional(),
    qualityScore: Joi.number().min(0).max(100).optional().messages({
      'number.min': 'Quality score must be at least 0',
      'number.max': 'Quality score cannot exceed 100',
    }),
    inspectionDate: Joi.date().iso().optional().messages({
      'date.format': 'Inspection date must be a valid ISO date',
    }),
    nextInspectionDate: Joi.date().iso().optional().messages({
      'date.format': 'Next inspection date must be a valid ISO date',
    }),
    requestNotes: Joi.string().optional(),
  }),
});

/**
 * QC approval action validation
 */
export const qcApprovalActionSchema = Joi.object({
  body: Joi.object({
    approvalId: Joi.string().hex().length(24).required().messages({
      'string.hex': 'Invalid QC Approval ID format',
      'string.length': 'QC Approval ID must be 24 characters long',
      'any.required': 'QC Approval ID is required',
    }),
    action: Joi.string().valid('approve', 'reject').required().messages({
      'any.only': 'Action must be either "approve" or "reject"',
      'any.required': 'Action is required',
    }),
    notes: Joi.string().trim().optional(),
  }),
});

/**
 * Machine ID parameter validation
 */
export const machineIdParamSchema = Joi.object({
  params: Joi.object({
    machineId: Joi.string().min(1).required().messages({
      'string.min': 'Machine ID is required',
      'any.required': 'Machine ID is required',
    }),
  }),
});

/**
 * User ID parameter validation
 */
export const userIdParamSchema = Joi.object({
  params: Joi.object({
    userId: Joi.string().min(1).required().messages({
      'string.min': 'User ID is required',
      'any.required': 'User ID is required',
    }),
  }),
});

/**
 * QC approval query parameters validation
 */
export const qcApprovalQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).optional().default(1),
  limit: Joi.number().integer().min(1).max(100).optional().default(20),
  search: Joi.string().optional(),
  status: Joi.string()
    .valid(...Object.values(QCApprovalStatus))
    .optional(),
  approvalType: Joi.string()
    .valid(...Object.values(QCApprovalType))
    .optional(),
  dateFrom: Joi.date().iso().optional(),
  dateTo: Joi.date().iso().optional(),
  qualityScoreMin: Joi.number().min(0).max(100).optional(),
  qualityScoreMax: Joi.number().min(0).max(100).optional(),
  sortBy: Joi.string().optional().default('createdAt'),
  sortOrder: Joi.string().valid('asc', 'desc').optional().default('desc'),
});
