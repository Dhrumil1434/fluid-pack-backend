import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import {
  createQAMachineEntrySchema,
  updateQAMachineEntrySchema,
  qaMachineEntryIdParamSchema,
  machineIdParamSchema,
  userIdParamSchema,
  qaMachinePaginationQuerySchema,
  validateQAMachineEntryIdsSchema,
} from '../validators/qaMachine.validator';
import { validateRequest } from '../../../middlewares/validateRequest';
import QAMachineService, {
  CreateQAMachineEntryData,
  UpdateQAMachineEntryData,
  QAMachineFilters,
} from '../services/qaMachine.service';
import { ApiResponse } from '../../../utils/ApiResponse';
import { asyncHandler } from '../../../utils/asyncHandler';
import { verifyJWT } from '../../../middlewares/auth.middleware';
import { AuthRole } from '../../../middlewares/auth-role.middleware';

export interface AuthenticatedRequest extends Request {
  user?: {
    _id: string;
    email: string;
    username: string;
    role: string;
    department: string;
  };
}

class QAMachineController {
  /**
   * Create a new QA machine entry
   * POST /api/qa-machines
   */
  static createQAMachineEntry = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { error, value } = createQAMachineEntrySchema.validate(req.body);
      if (error) {
        throw new Error(
          `Validation error: ${error.details?.[0]?.message || 'Invalid data'}`,
        );
      }

      if (!req.user) {
        throw new Error('User authentication required');
      }

      const createData: CreateQAMachineEntryData = {
        ...value,
        added_by: req.user._id,
      };

      const qaEntry = await QAMachineService.create(createData);

      const response = new ApiResponse(
        StatusCodes.CREATED,
        qaEntry,
        'QA machine entry created successfully',
      );
      res.status(response.statusCode).json(response);
    },
  );

  /**
   * Get all QA machine entries with pagination
   * GET /api/qa-machines
   */
  static getAllQAMachineEntries = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { error, value } = qaMachinePaginationQuerySchema.validate(req.query);
      if (error) {
        throw new Error(
          `Validation error: ${error.details?.[0]?.message || 'Invalid query parameters'}`,
        );
      }

      const filters: QAMachineFilters = {};
      if (value.machine_id) filters.machine_id = value.machine_id;
      if (value.added_by) filters.added_by = value.added_by;
      if (value.search) filters.search = value.search;

      const page = parseInt(value.page as string) || 1;
      const limit = parseInt(value.limit as string) || 10;

      const result = await QAMachineService.getAll(page, limit, filters);
      const response = new ApiResponse(
        StatusCodes.OK,
        result,
        'QA machine entries retrieved successfully',
      );
      res.status(response.statusCode).json(response);
    },
  );

  /**
   * Get QA machine entry by ID
   * GET /api/qa-machines/:id
   */
  static getQAMachineEntryById = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { error, value } = qaMachineEntryIdParamSchema.validate(req.params);
      if (error) {
        throw new Error(
          `Validation error: ${error.details?.[0]?.message || 'Invalid ID'}`,
        );
      }

      const qaEntry = await QAMachineService.getById(value.id);

      const response = new ApiResponse(
        StatusCodes.OK,
        qaEntry,
        'QA machine entry retrieved successfully',
      );
      res.status(response.statusCode).json(response);
    },
  );

  /**
   * Update QA machine entry
   * PUT /api/qa-machines/:id
   */
  static updateQAMachineEntry = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const paramsValidation = qaMachineEntryIdParamSchema.validate(req.params);
      if (paramsValidation.error) {
        throw new Error(
          `Validation error: ${paramsValidation.error.details?.[0]?.message || 'Invalid ID'}`,
        );
      }

      const bodyValidation = updateQAMachineEntrySchema.validate(req.body);
      if (bodyValidation.error) {
        throw new Error(
          `Validation error: ${bodyValidation.error.details?.[0]?.message || 'Invalid data'}`,
        );
      }

      const updateData: UpdateQAMachineEntryData = bodyValidation.value;

      const qaEntry = await QAMachineService.update(
        paramsValidation.value.id,
        updateData,
      );

      const response = new ApiResponse(
        StatusCodes.OK,
        qaEntry,
        'QA machine entry updated successfully',
      );
      res.status(response.statusCode).json(response);
    },
  );

  /**
   * Delete QA machine entry
   * DELETE /api/qa-machines/:id
   */
  static deleteQAMachineEntry = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { error, value } = qaMachineEntryIdParamSchema.validate(req.params);
      if (error) {
        throw new Error(
          `Validation error: ${error.details?.[0]?.message || 'Invalid ID'}`,
        );
      }

      await QAMachineService.delete(value.id);

      const response = new ApiResponse(
        StatusCodes.OK,
        null,
        'QA machine entry deleted successfully',
      );
      res.status(response.statusCode).json(response);
    },
  );

  /**
   * Get QA entries by machine ID
   * GET /api/qa-machines/machine/:machineId
   */
  static getQAMachineEntriesByMachine = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { error, value } = machineIdParamSchema.validate(req.params);
      if (error) {
        throw new Error(
          `Validation error: ${error.details?.[0]?.message || 'Invalid machine ID'}`,
        );
      }

      const page = parseInt(req.query['page'] as string) || 1;
      const limit = parseInt(req.query['limit'] as string) || 10;

      const result = await QAMachineService.getByMachineId(
        value.machineId,
        page,
        limit,
      );

      const response = new ApiResponse(
        StatusCodes.OK,
        result,
        'QA machine entries for machine retrieved successfully',
      );
      res.status(response.statusCode).json(response);
    },
  );

  /**
   * Get QA entries by user ID
   * GET /api/qa-machines/user/:userId
   */
  static getQAMachineEntriesByUser = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { error, value } = userIdParamSchema.validate(req.params);
      if (error) {
        throw new Error(
          `Validation error: ${error.details?.[0]?.message || 'Invalid user ID'}`,
        );
      }

      const page = parseInt(req.query['page'] as string) || 1;
      const limit = parseInt(req.query['limit'] as string) || 10;

      const result = await QAMachineService.getByUserId(
        value.userId,
        page,
        limit,
      );

      const response = new ApiResponse(
        StatusCodes.OK,
        result,
        'QA machine entries for user retrieved successfully',
      );
      res.status(response.statusCode).json(response);
    },
  );

  /**
   * Validate multiple QA entry IDs
   * POST /api/qa-machines/validate-ids
   */
  static validateQAMachineEntryIds = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { error, value } = validateQAMachineEntryIdsSchema.validate(req.body);
      if (error) {
        throw new Error(
          `Validation error: ${error.details?.[0]?.message || 'Invalid data'}`,
        );
      }

      const validationResults = await Promise.all(
        value.qaEntryIds.map(async (id: string) => ({
          id,
          isValid: await QAMachineService.exists(id),
        })),
      );

      const response = new ApiResponse(
        StatusCodes.OK,
        validationResults,
        'QA machine entry IDs validated successfully',
      );
      res.status(response.statusCode).json(response);
    },
  );
}

export default QAMachineController; 