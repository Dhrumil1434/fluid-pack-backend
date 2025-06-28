// controllers/machineApproval.controller.ts
import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import MachineApprovalService, {
  CreateApprovalRequestData,
  ApprovalDecisionData,
  ApprovalFilters,
} from '../services/machineApproval.service';
import { asyncHandler } from '../../../utils/asyncHandler';
import { ApiResponse } from '../../../utils/ApiResponse';
import { ApiError } from '../../../utils/ApiError';
import { ApprovalType, ApprovalStatus } from '../../../models/machineApproval.model';

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

      const { machineId, approvalType, proposedChanges, originalData, requestNotes } = req.body;

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

      const approvalRequest = await MachineApprovalService.createApprovalRequest(createData);

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
      if (req.query['status']) filters.status = req.query['status'] as ApprovalStatus;
      if (req.query['requestedBy']) filters.requestedBy = req.query['requestedBy'] as string;
      if (req.query['approvalType']) filters.approvalType = req.query['approvalType'] as ApprovalType;
      if (req.query['machineId']) filters.machineId = req.query['machineId'] as string;

      const result = await MachineApprovalService.getApprovalRequests(page, limit, filters);

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

      const updatedApproval = await MachineApprovalService.processApprovalDecision(decisionData);

      const response = new ApiResponse(
        StatusCodes.OK,
        updatedApproval,
        `Approval request ${approved ? 'approved' : 'rejected'} successfully`,
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

      const result = await MachineApprovalService.getUserApprovalRequests(
        req.user._id,
        page,
        limit,
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

      const result = await MachineApprovalService.getPendingApprovals(page, limit);

      const response = new ApiResponse(
        StatusCodes.OK,
        result,
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

      const updatedApproval = await MachineApprovalService.cancelApprovalRequest(
        id,
        req.user._id,
      );

      const response = new ApiResponse(
        StatusCodes.OK,
        updatedApproval,
        'Approval request cancelled successfully',
      );
      res.status(response.statusCode).json(response);
    },
  );
}

export default MachineApprovalController; 