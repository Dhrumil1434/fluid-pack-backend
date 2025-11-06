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
  machineIdParamSchema,
  machinePaginationQuerySchema,
  machineApprovalSchema,
  validateMachineIdsSchema,
  updateMachineSequenceSchema,
} from './validators/machine.joi.validator';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiResponse } from '../../utils/ApiResponse';
import { ApiError } from '../../utils/ApiError';
import {
  moveFilesToMachineDirectory,
  moveDocumentFilesToMachineDirectory,
  deleteMachineImages,
} from '../../middlewares/multer.middleware';
import MachineApprovalService from './services/machineApproval.service';
import { ApprovalType } from '../../models/machineApproval.model';
import { notifyMachineCreated } from '../notification/helpers/notification.helper';

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
      // Parse metadata if it arrived as a JSON string from multipart/form-data
      const rawBody = req.body as Record<string, unknown>;
      const bodyForValidation: Record<string, unknown> = { ...rawBody };
      if (typeof rawBody['metadata'] === 'string') {
        try {
          bodyForValidation['metadata'] = JSON.parse(
            rawBody['metadata'] as string,
          );
        } catch {
          throw new ApiError(
            'CREATE_MACHINE_VALIDATION',
            StatusCodes.BAD_REQUEST,
            'VALIDATION_ERROR',
            'Metadata must be valid JSON',
          );
        }
      }
      // Handle dispatch_date: convert empty string to null for proper validation
      if (
        rawBody['dispatch_date'] === '' ||
        rawBody['dispatch_date'] === null
      ) {
        bodyForValidation['dispatch_date'] = null;
      }

      const { error, value } = createMachineSchema.validate(bodyForValidation);
      if (error) {
        // Clean up uploaded files if validation fails
        if (req.files) {
          const files = req.files as {
            [fieldname: string]: Express.Multer.File[];
          };
          const allFiles: Express.Multer.File[] = [];

          if (files['images']) allFiles.push(...files['images']);
          if (files['documents']) allFiles.push(...files['documents']);

          const filePaths = allFiles.map((file) => file.path);
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
        if (req.files) {
          const files = req.files as {
            [fieldname: string]: Express.Multer.File[];
          };
          const allFiles: Express.Multer.File[] = [];

          if (files['images']) allFiles.push(...files['images']);
          if (files['documents']) allFiles.push(...files['documents']);

          const filePaths = allFiles.map((file) => file.path);
          deleteMachineImages(filePaths);
        }
        throw new ApiError(
          'CREATE_MACHINE',
          StatusCodes.UNAUTHORIZED,
          'USER_NOT_AUTHENTICATED',
          'User authentication required',
        );
      }

      // imagePaths kept for previous logic; not used in new flow

      // Determine if approval is required from permission context
      const perm = (
        req as unknown as {
          permissionInfo?: {
            requiresApproval?: boolean;
            approverRoles?: Array<string | { toString?: () => string }>;
          };
        }
      ).permissionInfo;

      const isAdmin =
        (req.user.role || '').toString().toLowerCase() === 'admin';
      const shouldAutoApprove = isAdmin || perm?.requiresApproval === false;

      // First create the machine record (images will be set after we move files)
      const createData: CreateMachineData = {
        ...value,
        created_by: req.user._id,
        images: [],
        // Auto-approve if admin or approval not required per permission policy
        is_approved: shouldAutoApprove ? true : undefined,
      };

      const machine = await MachineService.create(createData);

      // Process uploaded files (images and documents)
      const imageFiles: Express.Multer.File[] = [];
      const documentFiles: Express.Multer.File[] = [];

      if (req.files) {
        const files = req.files as {
          [fieldname: string]: Express.Multer.File[];
        };

        // Get image files
        if (files['images'] && Array.isArray(files['images'])) {
          imageFiles.push(...files['images']);
        }

        // Get document files
        if (files['documents'] && Array.isArray(files['documents'])) {
          documentFiles.push(...files['documents']);
        }
      }

      // Move image files to machine directory
      if (imageFiles.length > 0) {
        const actualImagePaths = await moveFilesToMachineDirectory(
          imageFiles,
          (machine as { _id: { toString(): string } })._id.toString(),
        );

        if (actualImagePaths.length > 0) {
          await MachineService.update(
            (machine as { _id: { toString(): string } })._id.toString(),
            {
              images: actualImagePaths,
            },
          );
        }
      }

      // Process document files
      if (documentFiles.length > 0) {
        // Move document files to machine directory
        const actualDocumentPaths = await moveDocumentFilesToMachineDirectory(
          documentFiles,
          (machine as { _id: { toString(): string } })._id.toString(),
        );

        if (actualDocumentPaths.length > 0) {
          const documents = documentFiles.map((file, index) => ({
            name: file.originalname,
            file_path: actualDocumentPaths[index] || file.path,
            document_type: file.mimetype,
          }));

          await MachineService.update(
            (machine as { _id: { toString(): string } })._id.toString(),
            {
              documents: documents,
            },
          );
        }
      }

      // If approval is required, create an approval request entry
      if (perm?.requiresApproval) {
        const approverRolesResolved = Array.isArray(perm?.approverRoles)
          ? perm.approverRoles
              .map((r) => (typeof r === 'string' ? r : r?.toString?.()))
              .filter((v): v is string => Boolean(v))
          : undefined;
        const approvalPayload: {
          machineId: string;
          requestedBy: string;
          approvalType: ApprovalType;
          proposedChanges: { action: string };
          requestNotes: string;
          approverRoles?: string[];
        } = {
          machineId: (
            machine as { _id: { toString(): string } }
          )._id.toString(),
          requestedBy: req.user._id,
          approvalType: ApprovalType.MACHINE_CREATION,
          proposedChanges: { action: 'CREATE_MACHINE' },
          requestNotes: 'Technician machine creation request',
        };
        if (approverRolesResolved) {
          approvalPayload.approverRoles = approverRolesResolved;
        }
        await MachineApprovalService.createApprovalRequest(approvalPayload);

        // Emit notification to approvers
        const machineId = (
          machine as { _id: { toString(): string } }
        )._id.toString();
        const machineName =
          (machine as { name?: string }).name || 'Unnamed Machine';
        const requesterName =
          req.user?.username || req.user?.email || 'Unknown User';

        await notifyMachineCreated(
          machineId,
          machineName,
          req.user._id,
          requesterName,
          approverRolesResolved || [],
        );
      }

      // Include permission context if available (e.g., requiresApproval)
      const message = perm?.requiresApproval
        ? 'Machine created successfully. Awaiting approval.'
        : 'Machine created successfully.';
      const response = new ApiResponse(StatusCodes.CREATED, machine, message);
      res.status(response.statusCode).json(response);
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
      if (typeof value.is_approved === 'boolean')
        filters.is_approved = value.is_approved;
      if (value.created_by) filters.created_by = value.created_by;
      if (value.search) filters.search = value.search;
      if (typeof value.has_sequence === 'boolean')
        filters.has_sequence = value.has_sequence;
      if (value.metadata_key) filters.metadata_key = value.metadata_key;
      if (value.metadata_value) filters.metadata_value = value.metadata_value;
      if (value.dispatch_date_from)
        filters.dispatch_date_from = value.dispatch_date_from;
      if (value.dispatch_date_to)
        filters.dispatch_date_to = value.dispatch_date_to;
      if (value.sortBy) filters.sortBy = value.sortBy;
      if (value.sortOrder) filters.sortOrder = value.sortOrder;

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

      // Validation is already handled by validateRequest middleware

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

        // Handle dispatch_date: convert empty string to null for proper processing
        const rawBody = req.body as Record<string, unknown>;
        const bodyData: Partial<UpdateMachineData> = { ...rawBody };
        if (
          rawBody['dispatch_date'] === '' ||
          rawBody['dispatch_date'] === null
        ) {
          bodyData['dispatch_date'] = null;
        }

        const updateData: Partial<UpdateMachineData> = {
          ...bodyData,
          updatedBy: req.user._id,
        };
        if (imagePaths.length > 0) {
          updateData.images = imagePaths;
        }

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
   * Update machine sequence only
   * PATCH /api/machines/:id/sequence
   */
  static updateMachineSequence = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const paramsValidation = machineIdParamSchema.validate(req.params);
      if (paramsValidation.error) {
        throw new ApiError(
          'UPDATE_MACHINE_SEQUENCE_VALIDATION',
          StatusCodes.BAD_REQUEST,
          'VALIDATION_ERROR',
          paramsValidation.error.details[0]?.message,
        );
      }

      const bodyValidation = updateMachineSequenceSchema.validate(req.body);
      if (bodyValidation.error) {
        throw new ApiError(
          'UPDATE_MACHINE_SEQUENCE_VALIDATION',
          StatusCodes.BAD_REQUEST,
          'VALIDATION_ERROR',
          bodyValidation.error.details[0]?.message,
        );
      }

      if (!req.user?._id) {
        throw new ApiError(
          'UPDATE_MACHINE_SEQUENCE_AUTH',
          StatusCodes.UNAUTHORIZED,
          'AUTH_ERROR',
          'User not authenticated',
        );
      }

      const updateData: UpdateMachineData = {
        machine_sequence: bodyValidation.value.machine_sequence,
        updatedBy: req.user._id,
      };

      const machine = await MachineService.update(
        paramsValidation.value.id,
        updateData,
      );

      const response = new ApiResponse(
        StatusCodes.OK,
        machine,
        'Machine sequence updated successfully',
      );
      res.status(response.statusCode).json(response);
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
    async (_req: Request, res: Response): Promise<void> => {
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
    async (_req: Request, res: Response): Promise<void> => {
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
