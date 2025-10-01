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
} from '../validators/qcMachine.validator';
import QCMachineService, {
  CreateQAMachineEntryData,
  UpdateQAMachineEntryData,
  QAMachineFilters,
} from '../services/qaMachine.service';
import { createQCApprovalForEntry } from './qcApproval.controller';
import { ApiResponse } from '../../../utils/ApiResponse';
import { ApiError } from '../../../utils/ApiError';
import { asyncHandler } from '../../../utils/asyncHandler';
import {
  moveQAFilesToEntryDirectory,
  deleteQAFiles,
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

class QCMachineController {
  static createQAMachineEntry = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { error, value } = createQAMachineEntrySchema.validate(req.body);
      if (error) {
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

      const createData: CreateQAMachineEntryData = {
        ...value,
        added_by: req.user._id,
        files: [],
        is_active: false,
        approval_status: 'PENDING',
      };

      const qaEntry = await QCMachineService.create(createData);

      // Move uploaded files directly into the QC entry directory using the newly created ID
      if (req.files && Array.isArray(req.files) && req.files.length > 0) {
        const actualFilePaths = await moveQAFilesToEntryDirectory(
          req.files as Express.Multer.File[],
          String(
            (
              qaEntry as unknown as { _id: { toString(): string } }
            )._id.toString(),
          ),
        );

        if (actualFilePaths.length > 0) {
          await QCMachineService.update(
            String(
              (
                qaEntry as unknown as { _id: { toString(): string } }
              )._id.toString(),
            ),
            {
              files: actualFilePaths,
            },
          );
        }
      }

      const response = new ApiResponse(
        StatusCodes.CREATED,
        qaEntry,
        'QC machine entry created successfully',
      );
      res.status(response.statusCode).json(response);

      // Auto-create a QCApproval linked to this entry (non-blocking)
      void (async () => {
        try {
          await createQCApprovalForEntry(
            {
              machineId: String(
                (
                  qaEntry as unknown as {
                    machine_id: {
                      _id?: { toString(): string };
                      toString?: () => string;
                    };
                  }
                ).machine_id?._id?.toString?.() ||
                  (
                    qaEntry as unknown as {
                      machine_id: {
                        _id?: { toString(): string };
                        toString?: () => string;
                      };
                    }
                  ).machine_id?.toString?.() ||
                  '',
              ),
              qcEntryId: String(
                (
                  qaEntry as unknown as { _id?: { toString(): string } }
                )._id?.toString?.() || '',
              ),
              approvalType: 'MACHINE_QC_ENTRY',
              requestNotes: 'Auto-created from QC entry creation',
            },
            req.user!._id,
          );
        } catch {
          // ignore
        }
      })();
    },
  );

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
      if (typeof value.is_active === 'boolean')
        filters.is_active = value.is_active;
      if (value.created_from)
        filters.created_from = value.created_from as string;
      if (value.created_to) filters.created_to = value.created_to as string;

      const page = parseInt(value.page as string) || 1;
      const limit = parseInt(value.limit as string) || 10;

      const result = await QCMachineService.getAll(page, limit, filters);
      const response = new ApiResponse(
        StatusCodes.OK,
        result,
        'QA machine entries retrieved successfully',
      );
      res.status(response.statusCode).json(response);
    },
  );

  static getQAMachineEntryById = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { error, value } = qaMachineEntryIdParamSchema.validate(req.params);
      if (error) {
        throw new Error(
          `Validation error: ${error.details?.[0]?.message || 'Invalid ID'}`,
        );
      }

      const qaEntry = await QCMachineService.getById(value.id);

      const response = new ApiResponse(
        StatusCodes.OK,
        qaEntry,
        'QA machine entry retrieved successfully',
      );
      res.status(response.statusCode).json(response);
    },
  );

  static updateQAMachineEntry = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const paramsValidation = qaMachineEntryIdParamSchema.validate(req.params);
      if (paramsValidation.error) {
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

        const qaEntry = await QCMachineService.update(
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
        if (filePaths.length > 0) {
          deleteQAFiles(filePaths);
        }
        throw error;
      }
    },
  );

  static deleteQAMachineEntry = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { error, value } = qaMachineEntryIdParamSchema.validate(req.params);
      if (error) {
        throw new Error(
          `Validation error: ${error.details?.[0]?.message || 'Invalid ID'}`,
        );
      }

      await QCMachineService.delete(value.id);

      const response = new ApiResponse(
        StatusCodes.OK,
        null,
        'QA machine entry deleted successfully',
      );
      res.status(response.statusCode).json(response);
    },
  );

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

      const result = await QCMachineService.getByMachineId(
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

      const result = await QCMachineService.getByUserId(
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
          isValid: await QCMachineService.exists(id),
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

  static getQAStatistics = asyncHandler(
    async (_req: Request, res: Response): Promise<void> => {
      const statistics = await QCMachineService.getQAStatistics();

      const response = new ApiResponse(
        StatusCodes.OK,
        statistics,
        'QA statistics retrieved successfully',
      );
      res.status(response.statusCode).json(response);
    },
  );
}

export default QCMachineController;
