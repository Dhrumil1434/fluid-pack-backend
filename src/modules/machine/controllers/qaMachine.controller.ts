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
import { ApiError } from '../../../utils/ApiError';
import { asyncHandler } from '../../../utils/asyncHandler';
import { verifyJWT } from '../../../middlewares/auth.middleware';
import { AuthRole } from '../../../middlewares/auth-role.middleware';
import {
  moveQAFilesToEntryDirectory,
  deleteQAFiles,
  cleanupQAEntryDirectory,
} from '../../../middlewares/multer.middleware';

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
        // Clean up uploaded files if validation fails
        if (req.files && Array.isArray(req.files)) {
          const filePaths = (req.files as Express.Multer.File[]).map(
            (file) => file.path,
          );
          deleteQAFiles(filePaths);
        }
        throw new ApiError(
          'CREATE_QA_MACHINE_ENTRY_VALIDATION',
          StatusCodes.BAD_REQUEST,
          'VALIDATION_ERROR',
          error.details?.[0]?.message || 'Invalid data',
        );
      }

      if (!req.user) {
        // Clean up uploaded files if authentication fails
        if (req.files && Array.isArray(req.files)) {
          const filePaths = (req.files as Express.Multer.File[]).map(
            (file) => file.path,
          );
          deleteQAFiles(filePaths);
        }
        throw new ApiError(
          'CREATE_QA_MACHINE_ENTRY',
          StatusCodes.UNAUTHORIZED,
          'USER_NOT_AUTHENTICATED',
          'User authentication required',
        );
      }

      let filePaths: string[] = [];

      try {
        // Move uploaded files to QA entry directory if files were uploaded
        if (req.files && Array.isArray(req.files) && req.files.length > 0) {
          // Create a temporary ID for the QA entry to organize files
          const tempId = new Date().getTime().toString();
          filePaths = await moveQAFilesToEntryDirectory(
            req.files as Express.Multer.File[],
            tempId,
          );
        }

        const createData: CreateQAMachineEntryData = {
          ...value,
          added_by: req.user._id,
          files: filePaths,
        };

        const qaEntry = await QAMachineService.create(createData);

        // Move files to the actual QA entry directory after successful creation
        if (filePaths.length > 0) {
          const tempId = new Date().getTime().toString();
          const actualFilePaths = await moveQAFilesToEntryDirectory(
            req.files as Express.Multer.File[],
            (qaEntry as any)._id.toString(),
          );

          // Update the QA entry with correct file paths
          await QAMachineService.update((qaEntry as any)._id.toString(), {
            files: actualFilePaths,
          });

          // Clean up temp directory
          cleanupQAEntryDirectory(tempId);
        }

        const response = new ApiResponse(
          StatusCodes.CREATED,
          qaEntry,
          'QA machine entry created successfully',
        );
        res.status(response.statusCode).json(response);
      } catch (error) {
        // Clean up uploaded files if creation fails
        if (filePaths.length > 0) {
          deleteQAFiles(filePaths);
        }
        throw error;
      }
    },
  );

  /**
   * Get all QA machine entries with pagination
   * GET /api/qa-machines
   */
  static getAllQAMachineEntries = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { error, value } = qaMachinePaginationQuerySchema.validate(
        req.query,
      );
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
        // Clean up uploaded files if validation fails
        if (req.files && Array.isArray(req.files)) {
          const filePaths = (req.files as Express.Multer.File[]).map(
            (file) => file.path,
          );
          deleteQAFiles(filePaths);
        }
        throw new ApiError(
          'UPDATE_QA_MACHINE_ENTRY_VALIDATION',
          StatusCodes.BAD_REQUEST,
          'VALIDATION_ERROR',
          paramsValidation.error.details?.[0]?.message || 'Invalid ID',
        );
      }

      const bodyValidation = updateQAMachineEntrySchema.validate(req.body);
      if (bodyValidation.error) {
        // Clean up uploaded files if validation fails
        if (req.files && Array.isArray(req.files)) {
          const filePaths = (req.files as Express.Multer.File[]).map(
            (file) => file.path,
          );
          deleteQAFiles(filePaths);
        }
        throw new ApiError(
          'UPDATE_QA_MACHINE_ENTRY_VALIDATION',
          StatusCodes.BAD_REQUEST,
          'VALIDATION_ERROR',
          bodyValidation.error.details?.[0]?.message || 'Invalid data',
        );
      }

      let filePaths: string[] = [];

      try {
        // Move uploaded files to QA entry directory if files were uploaded
        if (req.files && Array.isArray(req.files) && req.files.length > 0) {
          filePaths = await moveQAFilesToEntryDirectory(
            req.files as Express.Multer.File[],
            paramsValidation.value.id,
          );
        }

        const updateData: UpdateQAMachineEntryData = {
          ...bodyValidation.value,
          files: filePaths.length > 0 ? filePaths : undefined,
        };

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
      } catch (error) {
        // Clean up uploaded files if update fails
        if (filePaths.length > 0) {
          deleteQAFiles(filePaths);
        }
        throw error;
      }
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
      const { error, value } = validateQAMachineEntryIdsSchema.validate(
        req.body,
      );
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

  /**
   * Get QA statistics
   * GET /api/qa-machines/statistics
   */
  static getQAStatistics = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const statistics = await QAMachineService.getQAStatistics();

      const response = new ApiResponse(
        StatusCodes.OK,
        statistics,
        'QA statistics retrieved successfully',
      );
      res.status(response.statusCode).json(response);
    },
  );
}

export default QAMachineController;
