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
        // Clean up uploaded files on validation error
        if (req.files) {
          const files = req.files as {
            [fieldname: string]: Express.Multer.File[];
          };
          const allFiles: Express.Multer.File[] = [];
          if (files['images']) allFiles.push(...files['images']);
          if (files['documents']) allFiles.push(...files['documents']);
          if (files['files']) allFiles.push(...files['files']);
          if (allFiles.length > 0) {
            const filePaths = allFiles.map((file) => file.path);
            deleteQAFiles(filePaths);
          }
        }
        throw new ApiError(
          'CREATE_QA_MACHINE_ENTRY_VALIDATION',
          StatusCodes.BAD_REQUEST,
          'VALIDATION_ERROR',
          error.details?.[0]?.message || 'Invalid data',
        );
      }

      if (!req.user) {
        // Clean up uploaded files on auth error
        if (req.files) {
          const files = req.files as {
            [fieldname: string]: Express.Multer.File[];
          };
          const allFiles: Express.Multer.File[] = [];
          if (files['images']) allFiles.push(...files['images']);
          if (files['documents']) allFiles.push(...files['documents']);
          if (files['files']) allFiles.push(...files['files']);
          if (allFiles.length > 0) {
            const filePaths = allFiles.map((file) => file.path);
            deleteQAFiles(filePaths);
          }
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
        images: [],
        documents: [],
        files: [],
        is_active: false,
        approval_status: 'PENDING',
      };

      const qaEntry = await QCMachineService.create(createData);
      const qaEntryId = String(
        (qaEntry as unknown as { _id: { toString(): string } })._id.toString(),
      );

      // Process uploaded files (images, documents, and QC files)
      const imageFiles: Express.Multer.File[] = [];
      const documentFiles: Express.Multer.File[] = [];
      const qcFiles: Express.Multer.File[] = [];

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

        // Get QC files
        if (files['files'] && Array.isArray(files['files'])) {
          qcFiles.push(...files['files']);
        }
      }

      // Move image files to QC entry directory
      if (imageFiles.length > 0) {
        const actualImagePaths = await moveQAFilesToEntryDirectory(
          imageFiles,
          qaEntryId,
        );

        if (actualImagePaths.length > 0) {
          await QCMachineService.update(qaEntryId, {
            images: actualImagePaths,
          });
        }
      }

      // Process document files
      if (documentFiles.length > 0) {
        const actualDocumentPaths = await moveQAFilesToEntryDirectory(
          documentFiles,
          qaEntryId,
        );

        if (actualDocumentPaths.length > 0) {
          const documents = documentFiles.map((file, index) => ({
            name: file.originalname,
            file_path: actualDocumentPaths[index] || file.path,
            document_type: file.mimetype,
          }));

          await QCMachineService.update(qaEntryId, {
            documents: documents,
          });
        }
      }

      // Move QC files to QC entry directory
      if (qcFiles.length > 0) {
        const actualFilePaths = await moveQAFilesToEntryDirectory(
          qcFiles,
          qaEntryId,
        );

        if (actualFilePaths.length > 0) {
          await QCMachineService.update(qaEntryId, {
            files: actualFilePaths,
          });
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
          const machineId = String(
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
          );
          const qcEntryId = String(
            (
              qaEntry as unknown as { _id?: { toString(): string } }
            )._id?.toString?.() || '',
          );

          console.log(
            '[QC Machine Controller] Creating QC approval asynchronously...',
          );
          console.log('[QC Machine Controller] Machine ID:', machineId);
          console.log('[QC Machine Controller] QC Entry ID:', qcEntryId);
          const requestedByUserId = String(req.user!._id);
          console.log(
            '[QC Machine Controller] Requested By User ID:',
            requestedByUserId,
          );
          console.log(
            '[QC Machine Controller] Requested By User (full object):',
            {
              _id: req.user!._id,
              username: req.user?.username,
              name: (req.user as { name?: string })?.name,
              email: req.user?.email,
            },
          );

          const approval = await createQCApprovalForEntry(
            {
              machineId,
              qcEntryId,
              approvalType: 'MACHINE_QC_ENTRY',
              requestNotes: 'Auto-created from QC entry creation',
            },
            requestedByUserId,
          );

          console.log(
            '[QC Machine Controller] QC approval created successfully!',
          );
          console.log('[QC Machine Controller] Approval ID:', approval._id);
          console.log(
            '[QC Machine Controller] Approval status:',
            approval.status,
          );
        } catch (error) {
          console.error(
            '[QC Machine Controller] Error creating QC approval:',
            error,
          );
          console.error('[QC Machine Controller] Error details:', {
            message: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
          });
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
        // Clean up uploaded files on validation error
        if (req.files) {
          const files = req.files as {
            [fieldname: string]: Express.Multer.File[];
          };
          const allFiles: Express.Multer.File[] = [];
          if (files['images']) allFiles.push(...files['images']);
          if (files['documents']) allFiles.push(...files['documents']);
          if (files['files']) allFiles.push(...files['files']);
          if (allFiles.length > 0) {
            const filePaths = allFiles.map((file) => file.path);
            deleteQAFiles(filePaths);
          }
        }
        throw new ApiError(
          'UPDATE_QA_MACHINE_ENTRY_VALIDATION',
          StatusCodes.BAD_REQUEST,
          'VALIDATION_ERROR',
          paramsValidation.error.details?.[0]?.message || 'Invalid ID',
        );
      }

      // Parse JSON strings from FormData for array fields
      const parsedBody: Record<string, unknown> = { ...req.body };
      if (typeof parsedBody['files'] === 'string') {
        try {
          parsedBody['files'] = JSON.parse(parsedBody['files'] as string);
        } catch {
          // If parsing fails, treat as empty array
          parsedBody['files'] = [];
        }
      }
      if (typeof parsedBody['images'] === 'string') {
        try {
          parsedBody['images'] = JSON.parse(parsedBody['images'] as string);
        } catch {
          parsedBody['images'] = [];
        }
      }
      if (typeof parsedBody['documents'] === 'string') {
        try {
          parsedBody['documents'] = JSON.parse(
            parsedBody['documents'] as string,
          );
        } catch {
          parsedBody['documents'] = [];
        }
      }

      const bodyValidation = updateQAMachineEntrySchema.validate(parsedBody);
      if (bodyValidation.error) {
        // Clean up uploaded files on validation error
        if (req.files) {
          const files = req.files as {
            [fieldname: string]: Express.Multer.File[];
          };
          const allFiles: Express.Multer.File[] = [];
          if (files['images']) allFiles.push(...files['images']);
          if (files['documents']) allFiles.push(...files['documents']);
          if (files['files']) allFiles.push(...files['files']);
          if (allFiles.length > 0) {
            const filePaths = allFiles.map((file) => file.path);
            deleteQAFiles(filePaths);
          }
        }
        throw new ApiError(
          'UPDATE_QA_MACHINE_ENTRY_VALIDATION',
          StatusCodes.BAD_REQUEST,
          'VALIDATION_ERROR',
          bodyValidation.error.details?.[0]?.message || 'Invalid data',
        );
      }

      const qaEntryId = paramsValidation.value.id;

      // Get existing entry to preserve existing files
      const existingEntry = await QCMachineService.getById(qaEntryId);
      if (!existingEntry) {
        throw new ApiError(
          'UPDATE_QA_MACHINE_ENTRY',
          StatusCodes.NOT_FOUND,
          'QA_ENTRY_NOT_FOUND',
          'QA machine entry not found',
        );
      }

      const updateData: UpdateQAMachineEntryData = {
        ...bodyValidation.value,
      };

      // Ensure files array is properly set from parsed body
      if (
        parsedBody['files'] !== undefined &&
        Array.isArray(parsedBody['files'])
      ) {
        updateData.files = parsedBody['files'] as string[];
      }

      // Process uploaded files (images, documents, and QC files)
      const imageFiles: Express.Multer.File[] = [];
      const documentFiles: Express.Multer.File[] = [];
      const qcFiles: Express.Multer.File[] = [];

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

        // Get QC files
        if (files['files'] && Array.isArray(files['files'])) {
          qcFiles.push(...files['files']);
        }
      }

      try {
        // Handle images: if new images are provided, merge with remaining or replace
        if (imageFiles.length > 0) {
          const actualImagePaths = await moveQAFilesToEntryDirectory(
            imageFiles,
            qaEntryId,
          );
          if (actualImagePaths.length > 0) {
            // If images field is explicitly set in body, merge with new files; otherwise append to existing
            if (updateData.images !== undefined) {
              // User sent remaining images as JSON, merge with new files
              const remainingImages = Array.isArray(updateData.images)
                ? (updateData.images as string[])
                : [];
              updateData.images = [...remainingImages, ...actualImagePaths];
            } else {
              // Append new images to existing
              const existingImages = (existingEntry.images || []) as string[];
              updateData.images = [...existingImages, ...actualImagePaths];
            }
          }
        } else if (updateData.images !== undefined) {
          // No new files, but user sent remaining images as JSON (to replace/update)
          updateData.images = Array.isArray(updateData.images)
            ? (updateData.images as string[])
            : [];
        }

        // Handle documents: if new documents are provided, merge with remaining or replace
        if (documentFiles.length > 0) {
          const actualDocumentPaths = await moveQAFilesToEntryDirectory(
            documentFiles,
            qaEntryId,
          );
          if (actualDocumentPaths.length > 0) {
            const newDocuments = documentFiles.map((file, index) => ({
              name: file.originalname,
              file_path: actualDocumentPaths[index] || file.path,
              document_type: file.mimetype,
            }));

            // If documents field is explicitly set in body, merge with new files; otherwise append to existing
            if (updateData.documents !== undefined) {
              // User sent remaining documents as JSON, merge with new files
              const remainingDocuments = Array.isArray(updateData.documents)
                ? (updateData.documents as Array<{
                    name: string;
                    file_path: string;
                    document_type?: string;
                  }>)
                : [];
              updateData.documents = [...remainingDocuments, ...newDocuments];
            } else {
              // Append new documents to existing
              const existingDocuments = (existingEntry.documents ||
                []) as Array<{
                name: string;
                file_path: string;
                document_type?: string;
              }>;
              updateData.documents = [...existingDocuments, ...newDocuments];
            }
          }
        } else if (updateData.documents !== undefined) {
          // No new files, but user sent remaining documents as JSON (to replace/update)
          updateData.documents = Array.isArray(updateData.documents)
            ? (updateData.documents as Array<{
                name: string;
                file_path: string;
                document_type?: string;
              }>)
            : [];
        }

        // Handle QC files: if new files are provided, merge with remaining or replace
        if (qcFiles.length > 0) {
          const actualFilePaths = await moveQAFilesToEntryDirectory(
            qcFiles,
            qaEntryId,
          );
          if (actualFilePaths.length > 0) {
            // If files field is explicitly set in body, merge with new files; otherwise append to existing
            if (updateData.files !== undefined) {
              // User sent remaining files as JSON, merge with new files
              const remainingFiles = Array.isArray(updateData.files)
                ? (updateData.files as string[])
                : [];
              updateData.files = [...remainingFiles, ...actualFilePaths];
            } else {
              // Append new files to existing
              const existingFiles = (existingEntry.files || []) as string[];
              updateData.files = [...existingFiles, ...actualFilePaths];
            }
          }
        } else if (updateData.files !== undefined) {
          // No new files, but user sent remaining files as JSON (to replace/update)
          updateData.files = Array.isArray(updateData.files)
            ? (updateData.files as string[])
            : [];
        }

        const qaEntry = await QCMachineService.update(qaEntryId, updateData);

        const response = new ApiResponse(
          StatusCodes.OK,
          qaEntry,
          'QA machine entry updated successfully',
        );
        res.status(response.statusCode).json(response);
      } catch (error) {
        // Clean up uploaded files on error
        const allFiles: Express.Multer.File[] = [
          ...imageFiles,
          ...documentFiles,
          ...qcFiles,
        ];
        if (allFiles.length > 0) {
          const filePaths = allFiles.map((file) => file.path);
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
