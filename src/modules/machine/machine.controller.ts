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
  deleteMachineDocuments,
} from '../../middlewares/multer.middleware';
import MachineApprovalService from './services/machineApproval.service';
import { ApprovalType } from '../../models/machineApproval.model';
import { getUsersByRoleIds } from '../notification/helpers/notification.helper';
import { Machine, IMachine } from '../../models/machine.model';
import { SO } from '../../models/so.model';
import { SequenceManagement } from '../../models/category.model';
import { Category } from '../../models/category.model';
import {
  QCApproval,
  QCApprovalType,
  QCApprovalStatus,
} from '../../models/qcApproval.model';
import { User, IUser } from '../../models/user.model';
import { Role, IRole } from '../../models/role.model';
import {
  PermissionConfig,
  IPermissionConfig,
} from '../../models/permissionConfig.model';
import { ActionType } from '../../models/permissionConfig.model';
import { ICategory } from '../../models/category.model';
import mongoose from 'mongoose';
import notificationEmitter from '../notification/services/notificationEmitter.service';
import { NotificationType } from '../../models/notification.model';
import { QAMachineEntry } from '../../models/qcMachine.model';

/**
 * Get approvers for QC approval based on permission configuration
 */
async function getQCApprovers(): Promise<string[]> {
  try {
    // Lookup approver roles from active permission configs
    const configs = await PermissionConfig.find({
      action: ActionType.APPROVE_QC_APPROVAL,
      isActive: true,
    })
      .select('approverRoles')
      .lean();

    const approverRoleIds = Array.from(
      new Set(
        (configs || [])
          .flatMap(
            (c: Pick<IPermissionConfig, 'approverRoles'>) =>
              c.approverRoles || [],
          )
          .map((id: mongoose.Types.ObjectId | string) =>
            typeof id === 'string' ? id : id.toString(),
          )
          .filter(Boolean),
      ),
    );

    let approvers;
    if (approverRoleIds.length) {
      approvers = await User.find({ role: { $in: approverRoleIds } }).select(
        '_id username name email role',
      );
    } else {
      // fallback: users whose role name is 'admin' or 'qc'
      const roles = await Role.find({ name: { $in: ['admin', 'qc'] } })
        .select('_id')
        .lean();
      const roleIds = roles.map((r: Pick<IRole, '_id'>) => r._id);
      approvers = await User.find({ role: { $in: roleIds } }).select(
        '_id username name email role',
      );
    }
    if (!approvers.length) {
      // last resort: any admin by role name
      const adminRole = await Role.findOne({ name: 'admin' }).select('_id');
      const fallback = adminRole
        ? await User.find({ role: adminRole._id }).select('_id')
        : [];
      return fallback.map((u: Pick<IUser, '_id'>) =>
        (u._id as mongoose.Types.ObjectId).toString(),
      );
    }
    return approvers.map((approver: Pick<IUser, '_id'>) =>
      (approver._id as mongoose.Types.ObjectId).toString(),
    );
  } catch (error) {
    console.error('Error getting QC approvers:', error);
    // Fallback to admin users only
    const adminRole = await Role.findOne({ name: 'admin' }).select('_id');
    if (!adminRole) return [];
    const adminUsers = await User.find({ role: adminRole._id }).select('_id');
    return adminUsers.map((admin: Pick<IUser, '_id'>) =>
      (admin._id as mongoose.Types.ObjectId).toString(),
    );
  }
}

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

        // Extract customer name and SO number from SO (machines now reference SOs)
        let customerName = 'Machine';
        let soNumber = '';
        const soIdValue = (
          machine as {
            so_id?: { customer?: string; name?: string; so_number?: string };
          }
        )?.so_id;
        if (soIdValue && typeof soIdValue === 'object' && soIdValue !== null) {
          customerName = soIdValue.customer || soIdValue.name || 'Machine';
          soNumber = soIdValue.so_number || '';
        }

        const requesterName =
          req.user?.username || req.user?.email || 'Unknown User';

        // Format message: "For SO number, customer name machine is being created"
        const notificationMessage = soNumber
          ? `For SO ${soNumber}, ${customerName} machine is being created`
          : `${customerName} machine is being created`;

        await notificationEmitter.createAndEmitToMultipleUsers(
          await getUsersByRoleIds(approverRolesResolved || []),
          {
            senderId: req.user._id,
            type: NotificationType.MACHINE_CREATED,
            title: 'New Machine Created',
            message: `${requesterName} ${notificationMessage} that requires approval`,
            relatedEntityType: 'machine',
            relatedEntityId: machineId,
            actionUrl: '/dispatch/approvals',
            actionLabel: 'View Approval',
            metadata: {
              machineId,
              machineName: customerName,
              soNumber,
              requesterId: req.user._id,
              requesterName,
            },
          },
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
      // Validate with lenient options: allow unknown fields and don't abort early
      const { error, value } = machinePaginationQuerySchema.validate(
        req.query,
        {
          abortEarly: false, // Collect all errors, not just the first one
          stripUnknown: true, // Remove unknown fields instead of erroring
          allowUnknown: true, // Allow unknown query parameters
        },
      );
      if (error) {
        // Log the full error for debugging
        console.error('[Machine Controller] Validation error:', {
          query: req.query,
          errors: error.details,
        });
        throw new ApiError(
          'GET_MACHINES_VALIDATION',
          StatusCodes.BAD_REQUEST,
          'VALIDATION_ERROR',
          error.details?.map((d) => d.message).join('; ') || 'Validation error',
        );
      }

      const filters: MachineFilters = {};
      if (value.category_id) filters.category_id = value.category_id;
      if (typeof value.is_approved === 'boolean')
        filters.is_approved = value.is_approved;
      if (value.created_by) filters.created_by = value.created_by;
      // Only add search if it's a non-empty string (after validation, empty strings become undefined)
      if (
        value.search &&
        typeof value.search === 'string' &&
        value.search.trim().length > 0
      ) {
        filters.search = value.search.trim();
      }
      if (typeof value.has_sequence === 'boolean')
        filters.has_sequence = value.has_sequence;
      // Only add metadata filters if they're non-empty strings
      if (
        value.metadata_key &&
        typeof value.metadata_key === 'string' &&
        value.metadata_key.trim().length > 0
      ) {
        filters.metadata_key = value.metadata_key.trim();
      }
      if (
        value.metadata_value &&
        typeof value.metadata_value === 'string' &&
        value.metadata_value.trim().length > 0
      ) {
        filters.metadata_value = value.metadata_value.trim();
      }
      if (value.dispatch_date_from)
        filters.dispatch_date_from = value.dispatch_date_from;
      if (value.dispatch_date_to)
        filters.dispatch_date_to = value.dispatch_date_to;
      if (value.so_date_from) filters.so_date_from = value.so_date_from;
      if (value.so_date_to) filters.so_date_to = value.so_date_to;
      if (value.po_date_from) filters.po_date_from = value.po_date_from;
      if (value.po_date_to) filters.po_date_to = value.po_date_to;
      // Specific field filters - only add if non-empty strings
      if (
        value.party_name &&
        typeof value.party_name === 'string' &&
        value.party_name.trim().length > 0
      ) {
        filters.party_name = value.party_name.trim();
      }
      if (
        value.machine_sequence &&
        typeof value.machine_sequence === 'string' &&
        value.machine_sequence.trim().length > 0
      ) {
        filters.machine_sequence = value.machine_sequence.trim();
      }
      if (
        value.location &&
        typeof value.location === 'string' &&
        value.location.trim().length > 0
      ) {
        filters.location = value.location.trim();
      }
      if (value.so_id) filters.so_id = value.so_id;
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
      let documentPaths: string[] = [];

      try {
        // Handle uploaded files (both images and documents)
        if (req.files) {
          const files = req.files as {
            [fieldname: string]: Express.Multer.File[];
          };

          // Handle image files
          if (
            files['images'] &&
            Array.isArray(files['images']) &&
            files['images'].length > 0
          ) {
            imagePaths = await moveFilesToMachineDirectory(
              files['images'],
              paramsValidation.value.id,
            );
          }

          // Handle document files
          if (
            files['documents'] &&
            Array.isArray(files['documents']) &&
            files['documents'].length > 0
          ) {
            documentPaths = await moveDocumentFilesToMachineDirectory(
              files['documents'],
              paramsValidation.value.id,
            );
          }
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

        // Extract removed images and documents before passing to service
        const removedImages = (bodyData.removedImages as string[]) || [];
        const removedDocuments = bodyData.removedDocuments || [];
        const removedDocumentPaths = Array.isArray(removedDocuments)
          ? removedDocuments
              .map((doc: unknown) => {
                const docObj = doc as Record<string, unknown>;
                return docObj.file_path || doc;
              })
              .filter(Boolean)
          : [];

        const updateData: Partial<UpdateMachineData> = {
          ...bodyData,
          updatedBy: req.user._id,
        };

        // Handle images: merge new images with existing (after removal handled by service)
        // The service will have already filtered out removed images from existingMachine.images
        // So we just need to add new images if any
        if (imagePaths.length > 0) {
          // If service already set images (after filtering removed), merge with new ones
          if (updateData.images && Array.isArray(updateData.images)) {
            updateData.images = [...updateData.images, ...imagePaths];
          } else {
            // No existing images after removal, just use new ones
            updateData.images = imagePaths;
          }
        }

        // Handle documents: pass new documents to service for merging
        // Service will handle: removal (if any), preservation of existing, and merging of new documents
        if (documentPaths.length > 0) {
          // Convert document paths to document objects
          const newDocuments = documentPaths.map((path) => ({
            name: path.split('/').pop() || 'document',
            file_path: path,
          }));

          // Service will merge new documents with existing ones (after removal if any)
          updateData.documents = newDocuments;
        }
        // If no new documents, don't set updateData.documents - service will preserve existing

        const machine = await MachineService.update(
          paramsValidation.value.id,
          updateData,
        );

        // Delete removed images from Cloudinary (after successful update)
        if (removedImages.length > 0) {
          deleteMachineImages(removedImages).catch((error) => {
            console.error(
              'Error deleting removed images from Cloudinary:',
              error,
            );
            // Don't fail the request - deletion is a cleanup operation
          });
        }

        // Delete removed documents from Cloudinary (after successful update)
        if (removedDocumentPaths.length > 0) {
          deleteMachineDocuments(removedDocumentPaths).catch((error) => {
            console.error(
              'Error deleting removed documents from Cloudinary:',
              error,
            );
            // Don't fail the request - deletion is a cleanup operation
          });
        }

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
        if (documentPaths.length > 0) {
          deleteMachineDocuments(documentPaths);
        }
        throw error;
      }
    },
  );

  /**
   * Update machine sequence only
   * PATCH /api/machines/:id/sequence
   * Only allows the creator to edit sequence, validates format, unapproves machine, and creates QC approval
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

      const machineId = paramsValidation.value.id;
      const newSequence = bodyValidation.value.machine_sequence?.trim() || '';
      // Ensure userId is a string for comparison
      const userId = String(req.user._id);

      // Fetch machine with populated SO
      type PopulatedMachine = Omit<IMachine, 'so_id' | 'created_by'> & {
        so_id:
          | {
              _id: mongoose.Types.ObjectId;
              name: string;
              category_id: ICategory | mongoose.Types.ObjectId;
              subcategory_id?: ICategory | mongoose.Types.ObjectId | null;
            }
          | mongoose.Types.ObjectId;
        created_by: IUser | mongoose.Types.ObjectId;
      };
      // Fetch machine - use exec() instead of lean() to ensure proper population
      const machine = (await Machine.findById(machineId)
        .populate([
          {
            path: 'so_id',
            select: 'name customer so_number category_id subcategory_id',
            populate: [
              { path: 'category_id', select: 'name slug' },
              { path: 'subcategory_id', select: 'name slug' },
            ],
          },
          { path: 'created_by', select: '_id username email' },
        ])
        .exec()) as PopulatedMachine | null;

      if (!machine) {
        throw new ApiError(
          'MACHINE_NOT_FOUND',
          StatusCodes.NOT_FOUND,
          'MACHINE_NOT_FOUND',
          'Machine not found',
        );
      }

      // Check if user is the creator - handle all possible formats
      let creatorId: string | null = null;
      const createdBy = machine.created_by;

      // Case 1: created_by is populated as an object with _id (most common case)
      if (
        createdBy &&
        typeof createdBy === 'object' &&
        '_id' in createdBy &&
        createdBy._id
      ) {
        // Handle both ObjectId and string _id
        if (createdBy._id instanceof mongoose.Types.ObjectId) {
          creatorId = createdBy._id.toString();
        } else {
          creatorId = String(createdBy._id);
        }
      }
      // Case 2: created_by is an ObjectId directly (not populated - fallback)
      else if (createdBy instanceof mongoose.Types.ObjectId) {
        creatorId = createdBy.toString();
      }
      // Case 3: created_by is a string (shouldn't happen with populate, but handle it)
      else if (typeof createdBy === 'string') {
        creatorId = createdBy;
      }

      if (!creatorId) {
        // If we still don't have a creatorId, try to get it from the machine document directly
        const machineDoc = await Machine.findById(machineId)
          .select('created_by')
          .lean();
        if (machineDoc?.created_by) {
          if (machineDoc.created_by instanceof mongoose.Types.ObjectId) {
            creatorId = machineDoc.created_by.toString();
          } else {
            creatorId = String(machineDoc.created_by);
          }
        }
      }

      if (!creatorId) {
        throw new ApiError(
          'INVALID_MACHINE_CREATOR',
          StatusCodes.BAD_REQUEST,
          'INVALID_MACHINE_CREATOR',
          'Machine creator information is missing or invalid',
        );
      }

      // Normalize both IDs to strings for comparison
      const normalizedCreatorId = String(creatorId);
      const normalizedUserId = String(userId);

      // Debug logging (can be removed in production)
      console.log('Sequence update validation:', {
        machineId,
        creatorId: normalizedCreatorId,
        userId: normalizedUserId,
        match: normalizedCreatorId === normalizedUserId,
        createdByType: typeof createdBy,
        createdByIsObject: typeof createdBy === 'object',
        createdByHasId:
          createdBy && typeof createdBy === 'object' && '_id' in createdBy,
      });

      if (normalizedCreatorId !== normalizedUserId) {
        throw new ApiError(
          'NOT_MACHINE_CREATOR',
          StatusCodes.FORBIDDEN,
          'NOT_MACHINE_CREATOR',
          `Only the machine creator can edit the sequence. Creator ID: ${normalizedCreatorId}, User ID: ${normalizedUserId}`,
        );
      }

      // Validate sequence format against category/subcategory format from SO
      let categoryId: string;
      const so = machine.so_id;
      if (!so || (typeof so === 'object' && !so.category_id)) {
        throw new ApiError(
          'INVALID_SO',
          StatusCodes.BAD_REQUEST,
          'INVALID_SO',
          'Machine must have a valid SO with category',
        );
      }

      const categoryIdField =
        typeof so === 'object' && 'category_id' in so
          ? (so as { category_id: unknown }).category_id
          : null;

      if (
        categoryIdField &&
        typeof categoryIdField === 'object' &&
        '_id' in categoryIdField &&
        categoryIdField._id &&
        !(categoryIdField._id instanceof mongoose.Types.ObjectId)
      ) {
        categoryId = String((categoryIdField as ICategory)._id);
      } else if (
        categoryIdField &&
        categoryIdField instanceof mongoose.Types.ObjectId
      ) {
        categoryId = categoryIdField.toString();
      } else if (
        categoryIdField &&
        typeof categoryIdField === 'object' &&
        '_id' in categoryIdField
      ) {
        categoryId = String((categoryIdField as ICategory)._id);
      } else {
        throw new ApiError(
          'INVALID_CATEGORY',
          StatusCodes.BAD_REQUEST,
          'INVALID_CATEGORY',
          'SO must have a valid category',
        );
      }

      let subcategoryId: string | null = null;
      const subcategoryIdField =
        typeof so === 'object' && 'subcategory_id' in so
          ? (so as { subcategory_id: unknown }).subcategory_id
          : null;

      if (subcategoryIdField) {
        if (
          typeof subcategoryIdField === 'object' &&
          '_id' in subcategoryIdField &&
          subcategoryIdField._id &&
          !(subcategoryIdField._id instanceof mongoose.Types.ObjectId)
        ) {
          subcategoryId = String((subcategoryIdField as ICategory)._id);
        } else if (subcategoryIdField instanceof mongoose.Types.ObjectId) {
          subcategoryId = subcategoryIdField.toString();
        } else if (
          typeof subcategoryIdField === 'object' &&
          '_id' in subcategoryIdField &&
          subcategoryIdField._id
        ) {
          subcategoryId = String((subcategoryIdField as ICategory)._id);
        }
      }

      // Find sequence configuration
      const sequenceQuery: {
        category_id: string;
        is_active: boolean;
        subcategory_id: string | null;
      } = {
        category_id: categoryId,
        is_active: true,
        subcategory_id: subcategoryId || null,
      };

      let sequenceConfig = await SequenceManagement.findOne(sequenceQuery);

      // Fallback to category-only config if subcategory config not found
      if (!sequenceConfig && subcategoryId) {
        sequenceConfig = await SequenceManagement.findOne({
          category_id: categoryId,
          is_active: true,
          subcategory_id: null,
        });
      }

      if (!sequenceConfig) {
        throw new ApiError(
          'SEQUENCE_CONFIG_NOT_FOUND',
          StatusCodes.NOT_FOUND,
          'SEQUENCE_CONFIG_NOT_FOUND',
          'No sequence configuration found for this category/subcategory',
        );
      }

      // Validate sequence format - get category from SO
      const soCategory =
        typeof so === 'object' &&
        'category_id' in so &&
        typeof so.category_id === 'object' &&
        so.category_id !== null &&
        'slug' in so.category_id
          ? (so.category_id as ICategory)
          : null;

      const category: ICategory | null =
        soCategory ||
        (await Category.findById(categoryId).select('name slug').lean());

      const soSubcategory =
        subcategoryId &&
        typeof so === 'object' &&
        'subcategory_id' in so &&
        typeof so.subcategory_id === 'object' &&
        so.subcategory_id !== null &&
        'slug' in so.subcategory_id
          ? (so.subcategory_id as ICategory)
          : null;

      const subcategory: ICategory | null =
        soSubcategory ||
        (subcategoryId
          ? await Category.findById(subcategoryId).select('name slug').lean()
          : null);

      // Helper function to format category name for sequence (preserves special characters)
      const formatCategoryNameForSequence = (categoryName: string): string => {
        return categoryName
          .toUpperCase()
          .trim()
          .replace(/\s+/g, '-') // Replace spaces with hyphens
          .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
          .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
      };

      // Helper function to escape regex special characters
      const escapeRegex = (str: string): string => {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      };

      // Build regex pattern from format
      // Accept both old format (using slug) and new format (using name with special characters)
      const format = sequenceConfig.format;

      // New format: using category name (preserves special characters)
      const categoryFormatted = category?.name
        ? formatCategoryNameForSequence(category.name)
        : '[A-Z0-9-().]+';
      const subcategoryFormatted = subcategory?.name
        ? formatCategoryNameForSequence(subcategory.name)
        : '[A-Z0-9-().]*';

      // Old format: using slug (no special characters) - for backward compatibility
      const categorySlugFormatted = category?.slug
        ? category.slug.toUpperCase()
        : '[A-Z0-9-]+';
      const subcategorySlugFormatted = subcategory?.slug
        ? subcategory.slug.toUpperCase()
        : '[A-Z0-9-]*';

      // Build pattern for new format (with special characters)
      let patternNew = format
        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        .replace(/\\\{category\\\}/g, escapeRegex(categoryFormatted))
        .replace(
          /\\\{subcategory\\\}/g,
          subcategoryFormatted || '[A-Z0-9-().]*',
        )
        .replace(/\\\{sequence\\\}/g, '\\d+');
      patternNew = patternNew.replace(/-+/g, '-').replace(/^-|-$/g, '');

      // Build pattern for old format (slug-based, no special characters) - for backward compatibility
      let patternOld = format
        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        .replace(/\\\{category\\\}/g, escapeRegex(categorySlugFormatted))
        .replace(
          /\\\{subcategory\\\}/g,
          subcategorySlugFormatted || '[A-Z0-9-]*',
        )
        .replace(/\\\{sequence\\\}/g, '\\d+');
      patternOld = patternOld.replace(/-+/g, '-').replace(/^-|-$/g, '');

      // Test against both patterns (new format and old format for backward compatibility)
      const regexNew = new RegExp(`^${patternNew}$`, 'i');
      const regexOld = new RegExp(`^${patternOld}$`, 'i');
      const isValid = regexNew.test(newSequence) || regexOld.test(newSequence);

      if (!isValid) {
        // Generate example sequence for error message using category name (new format)
        const exampleSequence = format
          .replace(
            '{category}',
            category?.name
              ? formatCategoryNameForSequence(category.name)
              : 'CATEGORY',
          )
          .replace(
            '{subcategory}',
            subcategory?.name
              ? formatCategoryNameForSequence(subcategory.name)
              : '',
          )
          .replace('{sequence}', '001')
          .replace(/-+/g, '-')
          .replace(/^-|-$/g, '');

        throw new ApiError(
          'INVALID_SEQUENCE_FORMAT',
          StatusCodes.BAD_REQUEST,
          'INVALID_SEQUENCE_FORMAT',
          `Sequence format is invalid. Expected format: ${format}. Example: ${exampleSequence}`,
        );
      }

      // Check if sequence already exists (excluding current machine)
      const existingMachine = await Machine.findOne({
        machine_sequence: newSequence,
        _id: { $ne: machineId },
        deletedAt: null,
      });

      if (existingMachine) {
        throw new ApiError(
          'SEQUENCE_ALREADY_EXISTS',
          StatusCodes.BAD_REQUEST,
          'SEQUENCE_ALREADY_EXISTS',
          'This sequence is already assigned to another machine',
        );
      }

      const oldSequence = machine.machine_sequence;
      const wasApproved = machine.is_approved;

      // Check if there are any rejected QC approvals - reset them to PENDING
      const hadRejectedQCApprovals = await QCApproval.findOne({
        machineId: machineId,
        status: QCApprovalStatus.REJECTED,
      });

      // Check if there's already a pending QC approval for this machine
      const existingPendingApproval = await QCApproval.findOne({
        machineId: machineId,
        status: QCApprovalStatus.PENDING,
      });

      // Only reset rejected QC approvals (don't cancel machine approvals - let them be)
      // The machine will be unapproved and a new QC approval will be created
      try {
        // Update any rejected QC approvals to PENDING (reset rejection)
        if (hadRejectedQCApprovals) {
          await QCApproval.updateMany(
            {
              machineId: machineId,
              status: QCApprovalStatus.REJECTED,
            },
            {
              $set: {
                status: QCApprovalStatus.PENDING,
                rejectedBy: null,
                rejectionReason: null,
                approvalDate: null,
              },
            },
          );
        }
      } catch (error) {
        console.error('Error clearing rejected QC approvals:', error);
        // Don't fail the sequence update if this fails
      }

      // Update machine sequence and unapprove (just like a normal new machine)
      const updateData: UpdateMachineData = {
        machine_sequence: newSequence,
        is_approved: false, // Unapprove machine after sequence change (same as new machine)
        updatedBy: userId,
      };

      const updatedMachine = await MachineService.update(machineId, updateData);

      // Always create QC approval for sequence change (if one doesn't already exist)
      // This ensures approvers are notified whenever sequence is updated
      if (!existingPendingApproval) {
        try {
          const approvers = await getQCApprovers();

          if (approvers.length === 0) {
            console.warn(
              'No approvers found for QC approval - notifications will not be sent',
            );
          }

          // Find the QC person who created the most recent QC entry for this machine
          // This ensures requestedBy is set to a QC person, not the technician
          let requestedByUserId: mongoose.Types.ObjectId | string = userId; // Fallback to technician if no QC entry found

          const mostRecentQCEntry = await QAMachineEntry.findOne({
            machine_id: machineId,
          })
            .sort({ createdAt: -1 })
            .select('added_by')
            .lean();

          if (mostRecentQCEntry && mostRecentQCEntry.added_by) {
            requestedByUserId =
              mostRecentQCEntry.added_by as mongoose.Types.ObjectId;
            console.log(
              `[Machine Controller] Using QC person from most recent QC entry as requestedBy: ${requestedByUserId}`,
            );
          } else {
            // If no QC entry exists, use the first QC approver as requestedBy
            if (approvers.length > 0) {
              requestedByUserId = approvers[0];
              console.log(
                `[Machine Controller] No QC entry found, using first QC approver as requestedBy: ${requestedByUserId}`,
              );
            } else {
              console.warn(
                '[Machine Controller] No QC entry and no approvers found, using technician as requestedBy (fallback)',
              );
            }
          }

          const qcApproval = new QCApproval({
            machineId: machineId,
            requestedBy: requestedByUserId,
            approvalType: QCApprovalType.MACHINE_QC_EDIT,
            status: QCApprovalStatus.PENDING,
            approvers: approvers,
            requestNotes: `Machine sequence changed from "${oldSequence || 'N/A'}" to "${newSequence}". Please review and approve.`,
            proposedChanges: {
              machine_sequence: newSequence,
              old_sequence: oldSequence,
            },
          });

          await qcApproval.save();

          // Always send notifications to approvers when sequence is updated
          let requesterName = 'Technician';
          const createdByUser = machine.created_by as IUser | null | undefined;
          if (
            createdByUser &&
            typeof createdByUser === 'object' &&
            'username' in createdByUser
          ) {
            requesterName = createdByUser.username || 'Technician';
          }

          // Extract customer name and SO number from SO (machines now reference SOs)
          let customerName = 'Machine';
          let soNumber = '';
          const soIdValue = machine.so_id;
          if (
            soIdValue &&
            typeof soIdValue === 'object' &&
            soIdValue !== null
          ) {
            customerName = soIdValue.customer || soIdValue.name || 'Machine';
            soNumber = soIdValue.so_number || '';
          }

          const machineName = soNumber
            ? `${customerName} (SO: ${soNumber})`
            : customerName;

          if (approvers.length > 0) {
            try {
              await notificationEmitter.createAndEmitToMultipleUsers(
                approvers,
                {
                  senderId: userId,
                  type: NotificationType.MACHINE_CREATED, // Reuse this type or create new one
                  title: 'Machine Sequence Updated',
                  message: `${requesterName} updated the sequence for machine "${machineName}" from "${oldSequence || 'N/A'}" to "${newSequence}". Please review and approve.`,
                  relatedEntityType: 'machine',
                  relatedEntityId: machineId,
                  actionUrl: `/admin/machines?machineId=${machineId}`,
                  actionLabel: 'View Machine',
                  metadata: {
                    machineId,
                    machineName: customerName,
                    soNumber,
                    requesterId: userId,
                    requesterName,
                    oldSequence,
                    newSequence,
                    approvalId: (
                      qcApproval._id as mongoose.Types.ObjectId
                    ).toString(),
                  },
                },
              );
              console.log(
                `✅ Notifications sent to ${approvers.length} approver(s) for machine sequence update`,
              );
            } catch (notifError) {
              console.error('Error sending notifications:', notifError);
              // Don't fail the sequence update if notification fails
            }
          } else {
            console.warn('No approvers to notify for machine sequence update');
          }
        } catch (error) {
          console.error(
            'Error creating QC approval for sequence change:',
            error,
          );
          // Don't fail the sequence update if notification fails
        }
      } else {
        console.log(
          'Pending QC approval already exists for this machine - skipping creation',
        );
      }

      const response = new ApiResponse(
        StatusCodes.OK,
        updatedMachine,
        wasApproved
          ? 'Machine sequence updated successfully. Machine has been unapproved and sent for review.'
          : 'Machine sequence updated successfully',
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

  /**
   * Get search suggestions for machines
   * GET /api/machines/suggestions/:field?query=...
   */
  static getSearchSuggestions = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { field } = req.params;
      const query = (req.query['query'] as string) || '';
      const limit = parseInt((req.query['limit'] as string) || '10', 10);

      if (!field) {
        throw new ApiError(
          'INVALID_FIELD',
          StatusCodes.BAD_REQUEST,
          'INVALID_FIELD',
          'Field parameter is required',
        );
      }

      const searchQuery = query.trim().toLowerCase();
      let suggestions: string[] = [];

      try {
        switch (field) {
          case 'partyName': {
            // Get party_name suggestions from SO
            const sos = await SO.find({
              deletedAt: null,
              is_active: true,
              party_name: { $exists: true, $ne: null, $ne: '' },
            })
              .select('party_name')
              .distinct('party_name')
              .lean();

            suggestions = sos
              .filter(
                (name: string) =>
                  name && name.toLowerCase().includes(searchQuery),
              )
              .slice(0, limit);
            break;
          }

          case 'machineSequence': {
            const machines = await Machine.find({
              deletedAt: null,
              machine_sequence: { $exists: true, $ne: null, $ne: '' },
            })
              .select('machine_sequence')
              .distinct('machine_sequence')
              .lean();

            suggestions = machines
              .filter(
                (seq: string) => seq && seq.toLowerCase().includes(searchQuery),
              )
              .slice(0, limit);
            break;
          }

          case 'location': {
            const machines = await Machine.find({
              deletedAt: null,
              location: { $exists: true, $ne: null, $ne: '' },
            })
              .select('location')
              .distinct('location')
              .lean();

            suggestions = machines
              .filter(
                (loc: string) => loc && loc.toLowerCase().includes(searchQuery),
              )
              .slice(0, limit);
            break;
          }

          case 'mobileNumber': {
            // Get mobile_number suggestions from SO
            const sos = await SO.find({
              deletedAt: null,
              is_active: true,
              mobile_number: { $exists: true, $ne: null, $ne: '' },
            })
              .select('mobile_number')
              .distinct('mobile_number')
              .lean();

            suggestions = sos
              .filter((num: string) => num && num.includes(searchQuery))
              .slice(0, limit);
            break;
          }

          case 'approver': {
            // Get unique users who created machines
            const machines = await Machine.find({
              deletedAt: null,
              created_by: { $exists: true, $ne: null },
            })
              .select('created_by')
              .populate('created_by', 'username name email')
              .lean();

            const userMap = new Map<string, string>();
            machines.forEach(
              (m: {
                created_by?: {
                  _id: mongoose.Types.ObjectId | string;
                  name?: string;
                  username?: string;
                  email?: string;
                };
              }) => {
                if (m.created_by && m.created_by._id) {
                  const userId = m.created_by._id.toString();
                  const displayName =
                    m.created_by.name ||
                    m.created_by.username ||
                    m.created_by.email ||
                    '';
                  if (displayName && !userMap.has(userId)) {
                    userMap.set(userId, displayName);
                  }
                }
              },
            );

            suggestions = Array.from(userMap.values())
              .filter(
                (name: string) =>
                  name && name.toLowerCase().includes(searchQuery),
              )
              .slice(0, limit);
            break;
          }

          default:
            throw new ApiError(
              'INVALID_FIELD',
              StatusCodes.BAD_REQUEST,
              'INVALID_FIELD',
              `Invalid field: ${field}. Supported fields: partyName, machineSequence, location, mobileNumber, approver`,
            );
        }

        res
          .status(200)
          .json(
            new ApiResponse(
              200,
              { suggestions },
              'Suggestions retrieved successfully',
            ),
          );
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : 'Failed to retrieve suggestions';
        throw new ApiError(
          'SUGGESTION_ERROR',
          StatusCodes.INTERNAL_SERVER_ERROR,
          'SUGGESTION_ERROR',
          errorMessage,
        );
      }
    },
  );
}

export default MachineController;
