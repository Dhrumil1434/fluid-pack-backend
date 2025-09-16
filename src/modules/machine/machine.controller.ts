// controllers/machine.controller.ts
import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
// import { asyncHandler } from '../../../utils/asyncHandler';
// import { ApiResponse } from '../../../utils/ApiResponse';
// import { ApiError } from '../../../utils/ApiError';
import MachineService, {
  CreateMachineData,
  UpdateMachineData,
  MachineFilters,
} from './services/machine.service';
import {
  createMachineSchema,
  updateMachineSchema,
  machineIdParamSchema,
  machinePaginationQuerySchema,
  machineApprovalSchema,
  validateMachineIdsSchema,
} from './validators/machine.joi.validator';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiResponse } from '../../utils/ApiResponse';
import { ApiError } from '../../utils/ApiError';
import {
  moveFilesToMachineDirectory,
  deleteMachineImages,
  cleanupMachineDirectory,
} from '../../middlewares/multer.middleware';

export interface AuthenticatedRequest extends Request {
  user?: {
    _id: string;
    email: string;
    username: string;
    role: string;
    department: string;
  };
}

class MachineController {
  /**
   * Get current user's recent machines (default last 5)
   * GET /api/machines/my/recent?limit=5
   */
  static getMyRecentMachines = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      if (!req.user) {
        throw new ApiError(
          'GET_MY_RECENT_MACHINES',
          StatusCodes.UNAUTHORIZED,
          'USER_NOT_AUTHENTICATED',
          'User authentication required',
        );
      }

      const limitParam = (req.query['limit'] as string) || '5';
      const limit = Number.parseInt(limitParam, 10) || 5;

      const result = await MachineService.getAll(1, limit, {
        created_by: req.user._id,
      });

      const response = new ApiResponse(
        StatusCodes.OK,
        result,
        'My recent machines retrieved successfully',
      );
      res.status(response.statusCode).json(response);
    },
  );

  /**
   * Create a new machine
   * POST /api/machines
   */
  static createMachine = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { error, value } = createMachineSchema.validate(req.body);
      if (error) {
        // Clean up uploaded files if validation fails
        if (req.files && Array.isArray(req.files)) {
          const filePaths = (req.files as Express.Multer.File[]).map(
            (file) => file.path,
          );
          deleteMachineImages(filePaths);
        }
        throw new ApiError(
          'CREATE_MACHINE_VALIDATION',
          StatusCodes.BAD_REQUEST,
          'VALIDATION_ERROR',
          error.details?.[0]?.message || 'Validation error',
        );
      }

      if (!req.user) {
        // Clean up uploaded files if authentication fails
        if (req.files && Array.isArray(req.files)) {
          const filePaths = (req.files as Express.Multer.File[]).map(
            (file) => file.path,
          );
          deleteMachineImages(filePaths);
        }
        throw new ApiError(
          'CREATE_MACHINE',
          StatusCodes.UNAUTHORIZED,
          'USER_NOT_AUTHENTICATED',
          'User authentication required',
        );
      }

      let imagePaths: string[] = [];

      try {
        // Move uploaded files to machine directory if files were uploaded
        if (req.files && Array.isArray(req.files) && req.files.length > 0) {
          // Create a temporary ID for the machine to organize files
          const tempId = new Date().getTime().toString();
          imagePaths = await moveFilesToMachineDirectory(
            req.files as Express.Multer.File[],
            tempId,
          );
        }

        const createData: CreateMachineData = {
          ...value,
          created_by: req.user._id,
          images: imagePaths,
        };

        const machine = await MachineService.create(createData);

        // Move files to the actual machine directory after successful creation
        if (imagePaths.length > 0) {
          const tempId = new Date().getTime().toString();
          const actualImagePaths = await moveFilesToMachineDirectory(
            req.files as Express.Multer.File[],
            (machine as { _id: { toString(): string } })._id.toString(),
          );

          // Update the machine with correct image paths
          await MachineService.update(
            (machine as { _id: { toString(): string } })._id.toString(),
            {
              images: actualImagePaths,
            },
          );

          // Clean up temp directory
          cleanupMachineDirectory(tempId);
        }

        const response = new ApiResponse(
          StatusCodes.CREATED,
          machine,
          'Machine created successfully. Awaiting approval.',
        );
        res.status(response.statusCode).json(response);
      } catch (error) {
        // Clean up uploaded files if creation fails
        if (imagePaths.length > 0) {
          deleteMachineImages(imagePaths);
        }
        throw error;
      }
    },
  );

  /**
   * Get all machines with pagination
   * GET /api/machines
   */
  static getAllMachines = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { error, value } = machinePaginationQuerySchema.validate(req.query);
      if (error) {
        throw new ApiError(
          'GET_MACHINES_VALIDATION',
          StatusCodes.BAD_REQUEST,
          'VALIDATION_ERROR',
          error.details?.[0]?.message || 'Validation error',
        );
      }

      const filters: MachineFilters = {};
      if (value.category_id) filters.category_id = value.category_id;
      if (value.is_approved !== undefined)
        filters.is_approved = value.is_approved === 'true';
      if (value.created_by) filters.created_by = value.created_by;
      if (value.search) filters.search = value.search;

      const page = parseInt(value.page as string) || 1;
      const limit = parseInt(value.limit as string) || 10;

      const result = await MachineService.getAll(page, limit, filters);
      const response = new ApiResponse(
        StatusCodes.OK,
        result,
        'Machines retrieved successfully',
      );
      res.status(response.statusCode).json(response);
    },
  );

  /**
   * Get machine by ID
   * GET /api/machines/:id
   */
  static getMachineById = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { error, value } = machineIdParamSchema.validate(req.params);
      if (error) {
        throw new ApiError(
          'GET_MACHINE_VALIDATION',
          StatusCodes.BAD_REQUEST,
          'VALIDATION_ERROR',
          error.details[0]?.message,
        );
      }

      const machine = await MachineService.getById(value.id);

      const response = new ApiResponse(
        StatusCodes.OK,
        machine,
        'Machine retrieved successfully',
      );
      res.status(response.statusCode).json(response);
    },
  );

  /**
   * Update machine
   * PUT /api/machines/:id
   */
  static updateMachine = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const paramsValidation = machineIdParamSchema.validate(req.params);
      if (paramsValidation.error) {
        // Clean up uploaded files if validation fails
        if (req.files && Array.isArray(req.files)) {
          const filePaths = (req.files as Express.Multer.File[]).map(
            (file) => file.path,
          );
          deleteMachineImages(filePaths);
        }
        throw new ApiError(
          'UPDATE_MACHINE_VALIDATION',
          StatusCodes.BAD_REQUEST,
          'VALIDATION_ERROR',
          paramsValidation.error.details?.[0]?.message || 'Validation error',
        );
      }

      const bodyValidation = updateMachineSchema.validate(req.body);
      if (bodyValidation.error) {
        // Clean up uploaded files if validation fails
        if (req.files && Array.isArray(req.files)) {
          const filePaths = (req.files as Express.Multer.File[]).map(
            (file) => file.path,
          );
          deleteMachineImages(filePaths);
        }
        throw new ApiError(
          'UPDATE_MACHINE_VALIDATION',
          StatusCodes.BAD_REQUEST,
          'VALIDATION_ERROR',
          bodyValidation.error?.details?.[0]?.message || 'Validation error',
        );
      }

      if (!req.user) {
        // Clean up uploaded files if authentication fails
        if (req.files && Array.isArray(req.files)) {
          const filePaths = (req.files as Express.Multer.File[]).map(
            (file) => file.path,
          );
          deleteMachineImages(filePaths);
        }
        throw new ApiError(
          'UPDATE_MACHINE',
          StatusCodes.UNAUTHORIZED,
          'USER_NOT_AUTHENTICATED',
          'User authentication required',
        );
      }

      let imagePaths: string[] = [];

      try {
        // Move uploaded files to machine directory if files were uploaded
        if (req.files && Array.isArray(req.files) && req.files.length > 0) {
          imagePaths = await moveFilesToMachineDirectory(
            req.files as Express.Multer.File[],
            paramsValidation.value.id,
          );
        }

        const updateData: UpdateMachineData = {
          ...bodyValidation.value,
          updatedBy: req.user._id,
          images: imagePaths.length > 0 ? imagePaths : undefined,
        };

        const machine = await MachineService.update(
          paramsValidation.value.id,
          updateData,
        );

        const response = new ApiResponse(
          StatusCodes.OK,
          machine,
          'Machine updated successfully',
        );
        res.status(response.statusCode).json(response);
      } catch (error) {
        // Clean up uploaded files if update fails
        if (imagePaths.length > 0) {
          deleteMachineImages(imagePaths);
        }
        throw error;
      }
    },
  );

  /**
   * Delete machine (soft delete)
   * DELETE /api/machines/:id
   */
  static deleteMachine = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { error, value } = machineIdParamSchema.validate(req.params);
      if (error) {
        throw new ApiError(
          'DELETE_MACHINE_VALIDATION',
          StatusCodes.BAD_REQUEST,
          'VALIDATION_ERROR',
          error.details[0]?.message,
        );
      }

      await MachineService.delete(value.id);

      const response = new ApiResponse(
        StatusCodes.OK,
        null,
        'Machine deleted successfully',
      );
      res.status(response.statusCode).json(response);
    },
  );

  /**
   * Get approved machines
   * GET /api/machines/approved
   */
  static getApprovedMachines = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const machines = await MachineService.getApprovedMachines();

      const response = new ApiResponse(
        StatusCodes.OK,
        machines,
        'Approved machines retrieved successfully',
      );
      res.status(response.statusCode).json(response);
    },
  );

  /**
   * Update machine approval status
   * PATCH /api/machines/:id/approval
   */
  static updateMachineApproval = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const paramsValidation = machineIdParamSchema.validate(req.params);
      if (paramsValidation.error) {
        throw new ApiError(
          'UPDATE_APPROVAL_VALIDATION',
          StatusCodes.BAD_REQUEST,
          'VALIDATION_ERROR',
          paramsValidation.error?.details[0]?.message,
        );
      }

      const bodyValidation = machineApprovalSchema.validate(req.body);
      if (bodyValidation.error) {
        throw new ApiError(
          'UPDATE_APPROVAL_VALIDATION',
          StatusCodes.BAD_REQUEST,
          'VALIDATION_ERROR',
          bodyValidation.error?.details[0]?.message,
        );
      }

      if (!req.user) {
        throw new ApiError(
          'UPDATE_APPROVAL',
          StatusCodes.UNAUTHORIZED,
          'USER_NOT_AUTHENTICATED',
          'User authentication required',
        );
      }

      const machine = await MachineService.updateApprovalStatus(
        paramsValidation.value.id,
        bodyValidation.value.is_approved,
        req.user._id,
      );

      const response = new ApiResponse(
        StatusCodes.OK,
        machine,
        `Machine ${bodyValidation.value.is_approved ? 'approved' : 'rejected'} successfully`,
      );
      res.status(response.statusCode).json(response);
    },
  );

  /**
   * Get machines by category
   * GET /api/machines/category/:categoryId
   */
  static getMachinesByCategory = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { error, value } = machineIdParamSchema.validate(req.params);
      if (error) {
        throw new ApiError(
          'GET_MACHINES_BY_CATEGORY_VALIDATION',
          StatusCodes.BAD_REQUEST,
          'VALIDATION_ERROR',
          error?.details[0]?.message,
        );
      }

      const machines = await MachineService.getMachinesByCategory(value.id);

      const response = new ApiResponse(
        StatusCodes.OK,
        machines,
        'Machines by category retrieved successfully',
      );
      res.status(response.statusCode).json(response);
    },
  );

  /**
   * Validate multiple machine IDs
   * POST /api/machines/validate-ids
   */
  static validateMachineIds = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { error, value } = validateMachineIdsSchema.validate(req.body);
      if (error) {
        throw new ApiError(
          'VALIDATE_MACHINE_IDS_VALIDATION',
          StatusCodes.BAD_REQUEST,
          'VALIDATION_ERROR',
          error.details[0]?.message,
        );
      }

      const validationResults = await Promise.all(
        value.machineIds.map(async (id: string) => ({
          id,
          isValid: await MachineService.exists(id),
        })),
      );

      const response = new ApiResponse(
        StatusCodes.OK,
        validationResults,
        'Machine IDs validated successfully',
      );
      res.status(response.statusCode).json(response);
    },
  );

  /**
   * Get machine statistics
   * GET /api/machines/statistics
   */
  static getMachineStatistics = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const statistics = await MachineService.getMachineStatistics();

      const response = new ApiResponse(
        StatusCodes.OK,
        statistics,
        'Machine statistics retrieved successfully',
      );
      res.status(response.statusCode).json(response);
    },
  );
}

export default MachineController;
