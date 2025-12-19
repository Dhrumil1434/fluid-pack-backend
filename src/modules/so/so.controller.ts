// controllers/so.controller.ts
import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import SOService, {
  CreateSOData,
  UpdateSOData,
  SOFilters,
} from './services/so.service';
import { createSOSchema, updateSOSchema } from './validators/so.joi.validator';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiResponse } from '../../utils/ApiResponse';
import { ApiError } from '../../utils/ApiError';
import { deleteMachineDocuments } from '../../middlewares/multer.middleware';
import { Role } from '../../models/role.model';
import SOApprovalService from './services/soApproval.service';
import { SOApprovalType } from '../../models/soApproval.model';

export interface AuthenticatedRequest extends Request {
  user?: {
    _id: string;
    email: string;
    username: string;
    role: string;
    department: string;
  };
}

// Helper function to extract Cloudinary URLs from files
const extractCloudinaryUrls = (files: Express.Multer.File[]): string[] => {
  return files
    .map((file) => {
      const cloudinaryFile = file as Express.Multer.File & {
        cloudinary?: { secure_url: string; url: string };
      };
      return (
        cloudinaryFile.cloudinary?.secure_url ||
        cloudinaryFile.cloudinary?.url ||
        ''
      );
    })
    .filter((url) => url !== '');
};

// Helper function to process documents from multer files
const processDocuments = (
  files: Express.Multer.File[] | undefined,
): Array<{
  name: string;
  file_path: string;
  document_type?: string;
}> => {
  if (!files || files.length === 0) {
    return [];
  }

  return files.map((file) => {
    const cloudinaryFile = file as Express.Multer.File & {
      cloudinary?: { secure_url: string; url: string };
    };
    const filePath =
      cloudinaryFile.cloudinary?.secure_url ||
      cloudinaryFile.cloudinary?.url ||
      file.path;

    return {
      name: file.originalname,
      file_path: filePath,
      document_type: file.mimetype,
    };
  });
};

class SOController {
  /**
   * Create a new SO
   * POST /api/so
   */
  static createSO = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      // Parse body for validation
      const rawBody = req.body as Record<string, unknown>;
      const bodyForValidation: Record<string, unknown> = { ...rawBody };

      // Debug: Log what we receive
      console.log('🔍 Raw items from request:', {
        type: typeof rawBody['items'],
        value: rawBody['items'],
        isArray: Array.isArray(rawBody['items']),
      });

      // Parse items from JSON string if present, or set to empty array if not provided
      // FormData sends items as a JSON string, so we need to parse it
      // Always ensure items is an array - handle all possible cases
      const rawItems = rawBody['items'];

      if (rawItems === undefined || rawItems === null || rawItems === '') {
        // Not provided, null, or empty string - set to empty array
        bodyForValidation['items'] = [];
      } else if (typeof rawItems === 'string') {
        // It's a string - try to parse as JSON
        const itemsStr = rawItems.trim();
        if (itemsStr === '' || itemsStr === '[]') {
          bodyForValidation['items'] = [];
        } else {
          try {
            const parsed = JSON.parse(itemsStr);
            bodyForValidation['items'] = Array.isArray(parsed) ? parsed : [];
          } catch (e) {
            // If parsing fails, set to empty array
            console.warn(
              '⚠️ Failed to parse items JSON:',
              e,
              'String was:',
              itemsStr,
            );
            bodyForValidation['items'] = [];
          }
        }
      } else if (Array.isArray(rawItems)) {
        // Already an array - use it directly
        bodyForValidation['items'] = rawItems;
      } else {
        // Unknown type - set to empty array
        console.warn(
          '⚠️ Items is not string or array, type:',
          typeof rawItems,
          'value:',
          rawItems,
        );
        bodyForValidation['items'] = [];
      }

      // Ensure items is always an array before validation
      if (!Array.isArray(bodyForValidation['items'])) {
        console.error(
          '❌ Items is still not an array after parsing! Type:',
          typeof bodyForValidation['items'],
          'Value:',
          bodyForValidation['items'],
        );
        bodyForValidation['items'] = [];
      }

      console.log('✅ Final items for validation:', {
        type: typeof bodyForValidation['items'],
        isArray: Array.isArray(bodyForValidation['items']),
        length: Array.isArray(bodyForValidation['items'])
          ? bodyForValidation['items'].length
          : 'N/A',
      });

      // Parse date strings to Date objects
      if (rawBody['po_date'] && typeof rawBody['po_date'] === 'string') {
        const poDate = new Date(rawBody['po_date'] as string);
        if (!isNaN(poDate.getTime())) {
          bodyForValidation['po_date'] = poDate;
        }
      }
      if (rawBody['so_date'] && typeof rawBody['so_date'] === 'string') {
        const soDate = new Date(rawBody['so_date'] as string);
        if (!isNaN(soDate.getTime())) {
          bodyForValidation['so_date'] = soDate;
        }
      }

      // Handle description: convert empty string to null
      if (rawBody['description'] === '' || rawBody['description'] === null) {
        bodyForValidation['description'] = null;
      }

      const { error, value } = createSOSchema.validate(bodyForValidation, {
        abortEarly: false,
        allowUnknown: false,
        stripUnknown: true,
      });
      if (error) {
        // Clean up uploaded files if validation fails
        if (req.files) {
          const files = req.files as {
            [fieldname: string]: Express.Multer.File[];
          };
          if (files['documents']) {
            const documentPaths = extractCloudinaryUrls(files['documents']);
            await deleteMachineDocuments(documentPaths);
          }
        }
        // Format errors for field-level display
        const errors = error.details.map((err) => ({
          field: err.path.join('.'),
          message: err.message.replace(/"/g, ''),
        }));
        throw new ApiError(
          'CREATE_SO_VALIDATION',
          StatusCodes.BAD_REQUEST,
          'INVALID_REQUEST_BODY',
          'Request body validation failed',
          errors,
        );
      }

      if (!req.user) {
        // Clean up uploaded files if authentication fails
        if (req.files) {
          const files = req.files as {
            [fieldname: string]: Express.Multer.File[];
          };
          if (files['documents']) {
            const documentPaths = extractCloudinaryUrls(files['documents']);
            await deleteMachineDocuments(documentPaths);
          }
        }
        throw new ApiError(
          'CREATE_SO',
          StatusCodes.UNAUTHORIZED,
          'USER_NOT_AUTHENTICATED',
          'User authentication required',
        );
      }

      // Process uploaded documents
      const documentFiles: Express.Multer.File[] = [];
      if (req.files) {
        const files = req.files as {
          [fieldname: string]: Express.Multer.File[];
        };
        if (files['documents'] && Array.isArray(files['documents'])) {
          documentFiles.push(...files['documents']);
        }
      }

      // Process documents
      const documents = processDocuments(documentFiles);

      // Create SO
      const createData: CreateSOData = {
        ...value,
        documents,
        created_by: req.user._id,
      };

      const so = await SOService.create(createData);

      // Check if user is sub-admin and create approval request if needed
      const user = await req.user.populate('role');
      const userRole =
        typeof user.role === 'object' && user.role !== null
          ? (user.role as { name?: string })
          : null;
      const roleName = userRole?.name?.toLowerCase();

      // If user is sub-admin, create approval request
      if (roleName === 'sub-admin') {
        const adminRole = await Role.findOne({ name: 'admin' })
          .select('_id')
          .lean();

        if (adminRole?._id) {
          // Create approval request
          await SOApprovalService.createApprovalRequest({
            soId: so._id.toString(),
            requestedBy: req.user._id,
            approvalType: SOApprovalType.SO_CREATION,
            proposedChanges: {
              name: so.name,
              customer: so.customer,
              location: so.location,
              po_number: so.po_number,
              so_number: so.so_number,
              party_name: so.party_name,
              mobile_number: so.mobile_number,
            },
            requestNotes: 'SO created by sub-admin, awaiting admin approval',
            approverRoles: [adminRole._id.toString()],
          });

          // Set SO to inactive until approved
          so.is_active = false;
          await so.save();
        }
      }

      const response = new ApiResponse(true, so, 'SO created successfully');
      res.status(StatusCodes.CREATED).json(response);
    },
  );

  /**
   * Get all SOs with pagination and filters
   * GET /api/so
   */
  static getAllSOs = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const page = Number.parseInt((req.query['page'] as string) || '1', 10);
      const limit = Number.parseInt((req.query['limit'] as string) || '10', 10);

      const filters: SOFilters = {
        name: req.query['name'] as string | undefined,
        category_id: req.query['category_id'] as string | undefined,
        subcategory_id: req.query['subcategory_id'] as string | undefined,
        party_name: req.query['party_name'] as string | undefined,
        is_active:
          req.query['is_active'] === 'true'
            ? true
            : req.query['is_active'] === 'false'
              ? false
              : undefined,
        created_by: req.query['created_by'] as string | undefined,
        search: req.query['search'] as string | undefined,
        sortBy: req.query['sortBy'] as
          | 'createdAt'
          | 'name'
          | 'category'
          | 'party_name'
          | 'created_by'
          | undefined,
        sortOrder: (req.query['sortOrder'] as 'asc' | 'desc') || 'desc',
      };

      const result = await SOService.getAll(page, limit, filters);

      const response = new ApiResponse(
        true,
        {
          sos: result.sos,
          total: result.total,
          page,
          pages: result.pages,
          limit,
        },
        'SOs retrieved successfully',
      );
      res.status(StatusCodes.OK).json(response);
    },
  );

  /**
   * Get active SOs only (for dropdown)
   * GET /api/so/active
   */
  static getActiveSOs = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const sos = await SOService.getActiveSOs();

      const response = new ApiResponse(
        true,
        sos,
        'Active SOs retrieved successfully',
      );
      res.status(StatusCodes.OK).json(response);
    },
  );

  /**
   * Get SO by ID
   * GET /api/so/:id
   */
  static getSOById = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { id } = req.params;

      const so = await SOService.getById(id);

      const response = new ApiResponse(true, so, 'SO retrieved successfully');
      res.status(StatusCodes.OK).json(response);
    },
  );

  /**
   * Update SO
   * PUT /api/so/:id
   */
  static updateSO = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { id } = req.params;

      if (!req.user) {
        throw new ApiError(
          'UPDATE_SO',
          StatusCodes.UNAUTHORIZED,
          'USER_NOT_AUTHENTICATED',
          'User authentication required',
        );
      }

      // Parse body for validation
      const rawBody = req.body as Record<string, unknown>;
      const bodyForValidation: Record<string, unknown> = { ...rawBody };

      // Parse items from JSON string if present, or set to empty array if not provided
      // FormData sends items as a JSON string, so we need to parse it
      if (rawBody['items'] !== undefined && rawBody['items'] !== null) {
        if (typeof rawBody['items'] === 'string') {
          const itemsStr = (rawBody['items'] as string).trim();
          if (itemsStr === '' || itemsStr === '[]') {
            bodyForValidation['items'] = [];
          } else {
            try {
              const parsed = JSON.parse(itemsStr);
              bodyForValidation['items'] = Array.isArray(parsed) ? parsed : [];
            } catch (e) {
              // If parsing fails, set to empty array
              console.warn('Failed to parse items JSON:', e);
              bodyForValidation['items'] = [];
            }
          }
        } else if (Array.isArray(rawBody['items'])) {
          bodyForValidation['items'] = rawBody['items'];
        } else {
          bodyForValidation['items'] = [];
        }
      } else {
        // If items is not provided, set to empty array
        bodyForValidation['items'] = [];
      }

      // Ensure items is always an array
      if (!Array.isArray(bodyForValidation['items'])) {
        bodyForValidation['items'] = [];
      }

      // Parse date strings to Date objects
      if (rawBody['po_date'] && typeof rawBody['po_date'] === 'string') {
        const poDate = new Date(rawBody['po_date'] as string);
        if (!isNaN(poDate.getTime())) {
          bodyForValidation['po_date'] = poDate;
        }
      }
      if (rawBody['so_date'] && typeof rawBody['so_date'] === 'string') {
        const soDate = new Date(rawBody['so_date'] as string);
        if (!isNaN(soDate.getTime())) {
          bodyForValidation['so_date'] = soDate;
        }
      }

      // Handle description: convert empty string to null
      if (rawBody['description'] === '' || rawBody['description'] === null) {
        bodyForValidation['description'] = null;
      }

      const { error, value } = updateSOSchema.validate(bodyForValidation, {
        abortEarly: false,
        allowUnknown: false,
        stripUnknown: true,
      });
      if (error) {
        // Clean up uploaded files if validation fails
        if (req.files) {
          const files = req.files as {
            [fieldname: string]: Express.Multer.File[];
          };
          if (files['documents']) {
            const documentPaths = extractCloudinaryUrls(files['documents']);
            await deleteMachineDocuments(documentPaths);
          }
        }
        // Format errors for field-level display
        const errors = error.details.map((err) => ({
          field: err.path.join('.'),
          message: err.message.replace(/"/g, ''),
        }));
        throw new ApiError(
          'UPDATE_SO_VALIDATION',
          StatusCodes.BAD_REQUEST,
          'INVALID_REQUEST_BODY',
          'Request body validation failed',
          errors,
        );
      }

      // Get existing SO to merge documents
      const existingSO = await SOService.getById(id);

      // Process uploaded documents
      const documentFiles: Express.Multer.File[] = [];
      if (req.files) {
        const files = req.files as {
          [fieldname: string]: Express.Multer.File[];
        };
        if (files['documents'] && Array.isArray(files['documents'])) {
          documentFiles.push(...files['documents']);
        }
      }

      // Process new documents
      const newDocuments = processDocuments(documentFiles);

      // Merge with existing documents if documents are being updated
      let finalDocuments = existingSO.documents || [];
      if (value.documents !== undefined || newDocuments.length > 0) {
        // If new documents are uploaded, add them to existing ones
        if (newDocuments.length > 0) {
          finalDocuments = [...finalDocuments, ...newDocuments];
        }
        // If documents array is explicitly provided in body, use it
        if (value.documents !== undefined) {
          finalDocuments = value.documents;
        }
      }

      // Update SO
      const updateData: UpdateSOData = {
        ...value,
        documents: finalDocuments,
        updatedBy: req.user._id,
      };

      const so = await SOService.update(id, updateData);

      const response = new ApiResponse(true, so, 'SO updated successfully');
      res.status(StatusCodes.OK).json(response);
    },
  );

  /**
   * Soft delete SO
   * DELETE /api/so/:id
   */
  static deleteSO = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { id } = req.params;

      if (!req.user) {
        throw new ApiError(
          'DELETE_SO',
          StatusCodes.UNAUTHORIZED,
          'USER_NOT_AUTHENTICATED',
          'User authentication required',
        );
      }

      await SOService.softDelete(id, req.user._id);

      const response = new ApiResponse(true, null, 'SO deleted successfully');
      res.status(StatusCodes.OK).json(response);
    },
  );

  /**
   * Activate SO
   * PATCH /api/so/:id/activate
   */
  static activateSO = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { id } = req.params;

      if (!req.user) {
        throw new ApiError(
          'ACTIVATE_SO',
          StatusCodes.UNAUTHORIZED,
          'USER_NOT_AUTHENTICATED',
          'User authentication required',
        );
      }

      const so = await SOService.activate(id, req.user._id);

      const response = new ApiResponse(true, so, 'SO activated successfully');
      res.status(StatusCodes.OK).json(response);
    },
  );

  /**
   * Deactivate SO
   * PATCH /api/so/:id/deactivate
   */
  static deactivateSO = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { id } = req.params;

      if (!req.user) {
        throw new ApiError(
          'DEACTIVATE_SO',
          StatusCodes.UNAUTHORIZED,
          'USER_NOT_AUTHENTICATED',
          'User authentication required',
        );
      }

      const so = await SOService.deactivate(id, req.user._id);

      const response = new ApiResponse(true, so, 'SO deactivated successfully');
      res.status(StatusCodes.OK).json(response);
    },
  );
}

export default SOController;
