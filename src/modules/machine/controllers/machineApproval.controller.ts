// controllers/machineApproval.controller.ts
import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import mongoose from 'mongoose';
import MachineApprovalService, {
  CreateApprovalRequestData,
  ApprovalDecisionData,
  ApprovalFilters,
} from '../services/machineApproval.service';
import { asyncHandler } from '../../../utils/asyncHandler';
import { ApiResponse } from '../../../utils/ApiResponse';
import { ApiError } from '../../../utils/ApiError';
import {
  ApprovalType,
  ApprovalStatus,
} from '../../../models/machineApproval.model';
import {
  notifyMachineApproved,
  notifyMachineRejected,
} from '../../notification/helpers/notification.helper';

export interface AuthenticatedRequest extends Request {
  user?: {
    _id: string;
    email: string;
    username: string;
    role: string;
    department: string;
  };
}

class MachineApprovalController {
  /**
   * Create an approval request
   * POST /api/machine-approvals
   */
  static createApprovalRequest = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      if (!req.user) {
        throw new ApiError(
          'CREATE_APPROVAL_REQUEST',
          StatusCodes.UNAUTHORIZED,
          'USER_NOT_AUTHENTICATED',
          'User authentication required',
        );
      }

      const {
        machineId,
        approvalType,
        proposedChanges,
        originalData,
        requestNotes,
      } = req.body;

      // Validate required fields
      if (!machineId || !approvalType || !proposedChanges) {
        throw new ApiError(
          'CREATE_APPROVAL_REQUEST',
          StatusCodes.BAD_REQUEST,
          'MISSING_REQUIRED_FIELDS',
          'machineId, approvalType, and proposedChanges are required',
        );
      }

      // Validate approval type
      if (!Object.values(ApprovalType).includes(approvalType)) {
        throw new ApiError(
          'CREATE_APPROVAL_REQUEST',
          StatusCodes.BAD_REQUEST,
          'INVALID_APPROVAL_TYPE',
          'Invalid approval type',
        );
      }

      const createData: CreateApprovalRequestData = {
        machineId,
        requestedBy: req.user._id,
        approvalType,
        proposedChanges,
        originalData,
        requestNotes,
      };

      const approvalRequest =
        await MachineApprovalService.createApprovalRequest(createData);

      const response = new ApiResponse(
        StatusCodes.CREATED,
        approvalRequest,
        'Approval request created successfully',
      );
      res.status(response.statusCode).json(response);
    },
  );

  /**
   * Get all approval requests with pagination and filters
   * GET /api/machine-approvals
   */
  static getApprovalRequests = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const page = parseInt(req.query['page'] as string) || 1;
      const limit = parseInt(req.query['limit'] as string) || 10;

      const filters: ApprovalFilters = {};
      if (req.query['status'])
        filters.status = req.query['status'] as ApprovalStatus;
      if (req.query['requestedBy'])
        filters.requestedBy = req.query['requestedBy'] as string;
      if (req.query['createdBy'])
        filters.createdBy = req.query['createdBy'] as string;
      if (req.query['approvalType'])
        filters.approvalType = req.query['approvalType'] as ApprovalType;
      if (req.query['machineId'])
        filters.machineId = req.query['machineId'] as string;
      if (req.query['sequence'])
        filters.sequence = req.query['sequence'] as string;
      if (req.query['categoryId'])
        filters.categoryId = req.query['categoryId'] as string;
      if (req.query['machineName'])
        filters.machineName = req.query['machineName'] as string;
      if (req.query['dateFrom'])
        filters.dateFrom = req.query['dateFrom'] as string;
      if (req.query['dateTo']) filters.dateTo = req.query['dateTo'] as string;
      if (req.query['soDateFrom'])
        filters.soDateFrom = req.query['soDateFrom'] as string;
      if (req.query['soDateTo'])
        filters.soDateTo = req.query['soDateTo'] as string;
      if (req.query['poDateFrom'])
        filters.poDateFrom = req.query['poDateFrom'] as string;
      if (req.query['poDateTo'])
        filters.poDateTo = req.query['poDateTo'] as string;
      if (req.query['soNumber'])
        filters.soNumber = req.query['soNumber'] as string;
      if (req.query['poNumber'])
        filters.poNumber = req.query['poNumber'] as string;
      if (req.query['metadataKey'])
        filters.metadataKey = req.query['metadataKey'] as string;
      if (req.query['metadataValue'])
        filters.metadataValue = req.query['metadataValue'] as string;
      if (req.query['search']) filters.search = req.query['search'] as string;
      if (req.query['sortBy']) filters.sortBy = req.query['sortBy'] as string;
      if (req.query['sortOrder'])
        filters.sortOrder = req.query['sortOrder'] as 'asc' | 'desc';

      const result = await MachineApprovalService.getApprovalRequests(
        page,
        limit,
        filters,
      );

      const response = new ApiResponse(
        StatusCodes.OK,
        result,
        'Approval requests retrieved successfully',
      );
      res.status(response.statusCode).json(response);
    },
  );

  /**
   * Get approval request by ID
   * GET /api/machine-approvals/:id
   */
  static getApprovalById = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { id } = req.params;
      if (!id) {
        throw new ApiError(
          'GET_APPROVAL_BY_ID',
          StatusCodes.BAD_REQUEST,
          'MISSING_APPROVAL_ID',
          'Approval ID is required',
        );
      }

      const approval = await MachineApprovalService.getApprovalById(id);

      const response = new ApiResponse(
        StatusCodes.OK,
        approval,
        'Approval request retrieved successfully',
      );
      res.status(response.statusCode).json(response);
    },
  );

  /**
   * Process approval decision (approve/reject)
   * PATCH /api/machine-approvals/:id/process
   */
  static processApprovalDecision = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      if (!req.user) {
        throw new ApiError(
          'PROCESS_APPROVAL',
          StatusCodes.UNAUTHORIZED,
          'USER_NOT_AUTHENTICATED',
          'User authentication required',
        );
      }

      const { id } = req.params;
      if (!id) {
        throw new ApiError(
          'PROCESS_APPROVAL',
          StatusCodes.BAD_REQUEST,
          'MISSING_APPROVAL_ID',
          'Approval ID is required',
        );
      }

      const { approved, approverNotes, rejectionReason } = req.body;

      if (typeof approved !== 'boolean') {
        throw new ApiError(
          'PROCESS_APPROVAL',
          StatusCodes.BAD_REQUEST,
          'INVALID_APPROVAL_DECISION',
          'approved field must be a boolean',
        );
      }

      if (!approved && !rejectionReason) {
        throw new ApiError(
          'PROCESS_APPROVAL',
          StatusCodes.BAD_REQUEST,
          'REJECTION_REASON_REQUIRED',
          'Rejection reason is required when rejecting an approval request',
        );
      }

      const decisionData: ApprovalDecisionData = {
        approvalId: id,
        approvedBy: req.user._id,
        approved,
        approverNotes,
        rejectionReason,
      };

      const updatedApproval =
        await MachineApprovalService.processApprovalDecision(decisionData);

      // Emit notification to requester
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const approval = updatedApproval as any;
      const machineId =
        typeof approval?.machineId === 'string'
          ? approval.machineId
          : approval?.machineId?._id?.toString();

      // Extract machine name from SO (machines now reference SOs)
      let machineName = 'Machine';
      const machineIdValue = approval?.machineId;
      if (
        machineIdValue &&
        typeof machineIdValue === 'object' &&
        machineIdValue !== null
      ) {
        const soIdValue = machineIdValue.so_id;
        if (soIdValue && typeof soIdValue === 'object' && soIdValue !== null) {
          machineName =
            soIdValue.customer ||
            soIdValue.name ||
            soIdValue.so_number ||
            'Machine';
        } else if (machineIdValue.name) {
          machineName = machineIdValue.name;
        }
      }

      const requesterId =
        typeof approval?.requestedBy === 'string'
          ? approval.requestedBy
          : approval?.requestedBy?._id?.toString();
      const approverName = req.user?.username || req.user?.email || 'Admin';

      if (requesterId && machineId) {
        if (approved) {
          await notifyMachineApproved(
            machineId,
            machineName,
            requesterId,
            req.user._id,
            approverName,
          );
        } else {
          await notifyMachineRejected(
            machineId,
            machineName,
            requesterId,
            req.user._id,
            approverName,
            rejectionReason || 'No reason provided',
          );
        }
      }

      const response = new ApiResponse(
        StatusCodes.OK,
        updatedApproval,
        `Approval request ${approved ? 'approved' : 'rejected'} successfully`,
      );
      res.status(response.statusCode).json(response);
    },
  );

  /**
   * Update approval request (only while pending)
   * PATCH /api/machine-approvals/:id
   */
  static updateApprovalRequest = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      if (!req.user) {
        throw new ApiError(
          'UPDATE_APPROVAL',
          StatusCodes.UNAUTHORIZED,
          'USER_NOT_AUTHENTICATED',
          'User authentication required',
        );
      }

      const { id } = req.params;
      if (!id) {
        throw new ApiError(
          'UPDATE_APPROVAL',
          StatusCodes.BAD_REQUEST,
          'MISSING_APPROVAL_ID',
          'Approval ID is required',
        );
      }

      const { approverRoles, approvalType, requestNotes, proposedChanges } =
        req.body || {};

      const updated = await MachineApprovalService.updateApprovalRequest(id, {
        approverRoles,
        approvalType,
        requestNotes,
        proposedChanges,
      });

      const response = new ApiResponse(
        StatusCodes.OK,
        updated,
        'Approval request updated successfully',
      );
      res.status(response.statusCode).json(response);
    },
  );

  /**
   * Get user's approval requests
   * GET /api/machine-approvals/my-requests
   */
  static getMyApprovalRequests = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      if (!req.user) {
        throw new ApiError(
          'GET_MY_APPROVALS',
          StatusCodes.UNAUTHORIZED,
          'USER_NOT_AUTHENTICATED',
          'User authentication required',
        );
      }

      const page = parseInt(req.query['page'] as string) || 1;
      const limit = parseInt(req.query['limit'] as string) || 10;

      // Allow filtering by machine and status for requester's own approvals
      const filters: ApprovalFilters = {
        requestedBy: req.user._id as unknown as string,
      };
      if (req.query['status'])
        filters.status = req.query['status'] as ApprovalStatus;
      if (req.query['approvalType'])
        filters.approvalType = req.query['approvalType'] as ApprovalType;
      if (req.query['machineId'])
        filters.machineId = req.query['machineId'] as string;

      const result = await MachineApprovalService.getApprovalRequests(
        page,
        limit,
        filters,
      );

      const response = new ApiResponse(
        StatusCodes.OK,
        result,
        'User approval requests retrieved successfully',
      );
      res.status(response.statusCode).json(response);
    },
  );

  /**
   * Get pending approvals (for approvers)
   * GET /api/machine-approvals/pending
   */
  static getPendingApprovals = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const page = parseInt(req.query['page'] as string) || 1;
      const limit = parseInt(req.query['limit'] as string) || 10;
      const search = req.query['search'] as string | undefined;
      const sort = req.query['sort'] as string | undefined;

      // Scope pending approvals to the current user's role if available
      let approverRoleId: string | undefined;
      const user = req.user as unknown as { role?: string | { _id?: string } };
      if (user?.role && typeof user.role === 'string') {
        approverRoleId = user.role;
      } else if ((user?.role as { _id?: string })?._id) {
        approverRoleId = (user.role as { _id?: string })?._id?.toString();
      }

      // Build filters for pending approvals with enhanced search support
      const additionalFilters: Partial<ApprovalFilters> = {};

      // Extract search parameters - pass search as-is for comprehensive search
      // The service will handle searching across all fields (requestNotes, SO fields, etc.)
      if (search) {
        additionalFilters.search = search;
      }

      // Parse sort string (e.g., "-createdAt" or "createdAt")
      if (sort) {
        if (sort.startsWith('-')) {
          additionalFilters.sortBy = sort.substring(1);
          additionalFilters.sortOrder = 'desc';
        } else {
          additionalFilters.sortBy = sort;
          additionalFilters.sortOrder = 'asc';
        }
      }

      // Extract additional filters from query
      if (req.query['categoryId'])
        additionalFilters.categoryId = req.query['categoryId'] as string;
      if (req.query['dateFrom'])
        additionalFilters.dateFrom = req.query['dateFrom'] as string;
      if (req.query['dateTo'])
        additionalFilters.dateTo = req.query['dateTo'] as string;
      if (req.query['soDateFrom'])
        additionalFilters.soDateFrom = req.query['soDateFrom'] as string;
      if (req.query['soDateTo'])
        additionalFilters.soDateTo = req.query['soDateTo'] as string;
      if (req.query['poDateFrom'])
        additionalFilters.poDateFrom = req.query['poDateFrom'] as string;
      if (req.query['poDateTo'])
        additionalFilters.poDateTo = req.query['poDateTo'] as string;
      if (req.query['soNumber'])
        additionalFilters.soNumber = req.query['soNumber'] as string;
      if (req.query['poNumber'])
        additionalFilters.poNumber = req.query['poNumber'] as string;
      if (req.query['metadataKey'])
        additionalFilters.metadataKey = req.query['metadataKey'] as string;
      if (req.query['metadataValue'])
        additionalFilters.metadataValue = req.query['metadataValue'] as string;
      if (req.query['requestedBy'])
        additionalFilters.requestedBy = req.query['requestedBy'] as string;
      if (req.query['createdBy'])
        additionalFilters.createdBy = req.query['createdBy'] as string;
      if (req.query['machineName'])
        additionalFilters.machineName = req.query['machineName'] as string;
      // Pass search as-is for comprehensive search in service
      if (search) additionalFilters.search = search;

      const result = await MachineApprovalService.getPendingApprovals(
        page,
        limit,
        approverRoleId,
        additionalFilters,
      );

      // Filter by approver role if needed (this is a simplified approach)
      // In a production system, you might want to add this to the aggregation pipeline
      let filteredApprovals = result.approvals;
      if (approverRoleId) {
        // Filter approvals that match the approver's role
        // Note: This is done post-query. For better performance, add to aggregation pipeline
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        filteredApprovals = result.approvals.filter((approval: any) => {
          const approverRoles = approval.approverRoles || [];
          return approverRoles.some(
            (role: string | { _id?: string | mongoose.Types.ObjectId }) => {
              const roleId =
                typeof role === 'string' ? role : role?._id?.toString();
              return roleId === approverRoleId;
            },
          );
        });
      }

      const response = new ApiResponse(
        StatusCodes.OK,
        {
          approvals: filteredApprovals,
          total: filteredApprovals.length,
          pages: Math.ceil(filteredApprovals.length / limit),
        },
        'Pending approvals retrieved successfully',
      );
      res.status(response.statusCode).json(response);
    },
  );

  /**
   * Cancel approval request
   * PATCH /api/machine-approvals/:id/cancel
   */
  static cancelApprovalRequest = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      if (!req.user) {
        throw new ApiError(
          'CANCEL_APPROVAL',
          StatusCodes.UNAUTHORIZED,
          'USER_NOT_AUTHENTICATED',
          'User authentication required',
        );
      }

      const { id } = req.params;
      if (!id) {
        throw new ApiError(
          'CANCEL_APPROVAL',
          StatusCodes.BAD_REQUEST,
          'MISSING_APPROVAL_ID',
          'Approval ID is required',
        );
      }

      const updatedApproval =
        await MachineApprovalService.cancelApprovalRequest(id, req.user._id);

      const response = new ApiResponse(
        StatusCodes.OK,
        updatedApproval,
        'Approval request cancelled successfully',
      );
      res.status(response.statusCode).json(response);
    },
  );

  /**
   * Get approval statistics
   * GET /api/machine-approvals/statistics
   */
  static getApprovalStatistics = asyncHandler(
    async (_req: Request, res: Response): Promise<void> => {
      const statistics = await MachineApprovalService.getApprovalStatistics();

      const response = new ApiResponse(
        StatusCodes.OK,
        statistics,
        'Approval statistics retrieved successfully',
      );
      res.status(response.statusCode).json(response);
    },
  );
}

export default MachineApprovalController;
