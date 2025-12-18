import { Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiResponse } from '../../utils/ApiResponse';
import { ApiError } from '../../utils/ApiError';
import SOApprovalService from './services/soApproval.service';
import {
  SOApprovalType,
  SOApprovalStatus,
} from '../../models/soApproval.model';
import { AuthenticatedRequest } from '../../middlewares/auth.middleware';

class SOApprovalController {
  /**
   * Create an SO approval request
   * POST /api/so-approvals
   */
  static createApprovalRequest = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      if (!req.user) {
        throw new ApiError(
          'CREATE_SO_APPROVAL',
          StatusCodes.UNAUTHORIZED,
          'USER_NOT_AUTHENTICATED',
          'User authentication required',
        );
      }

      const {
        soId,
        approvalType,
        proposedChanges,
        originalData,
        requestNotes,
        approverRoles,
      } = req.body;

      if (!soId || !approvalType || !proposedChanges) {
        throw new ApiError(
          'CREATE_SO_APPROVAL',
          StatusCodes.BAD_REQUEST,
          'MISSING_REQUIRED_FIELDS',
          'soId, approvalType, and proposedChanges are required',
        );
      }

      const approval = await SOApprovalService.createApprovalRequest({
        soId,
        requestedBy: req.user._id,
        approvalType,
        proposedChanges,
        originalData,
        requestNotes,
        approverRoles,
      });

      const response = new ApiResponse(
        true,
        approval,
        'SO approval request created successfully',
      );
      res.status(StatusCodes.CREATED).json(response);
    },
  );

  /**
   * Get all SO approval requests
   * GET /api/so-approvals
   */
  static getApprovalRequests = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const status = req.query.status as SOApprovalStatus | undefined;
      const approvalType = req.query.approvalType as SOApprovalType | undefined;
      const soId = req.query.soId as string | undefined;
      const requestedBy = req.query.requestedBy as string | undefined;
      const sortBy = (req.query.sortBy as string) || 'createdAt';
      const sortOrder = (req.query.sortOrder as 'asc' | 'desc') || 'desc';

      const result = await SOApprovalService.getApprovalRequests(page, limit, {
        status,
        approvalType,
        soId,
        requestedBy,
        sortBy,
        sortOrder,
      });

      const response = new ApiResponse(
        true,
        result,
        'SO approval requests retrieved successfully',
      );
      res.status(StatusCodes.OK).json(response);
    },
  );

  /**
   * Get pending SO approvals for current user's role
   * GET /api/so-approvals/pending
   */
  static getPendingApprovals = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      if (!req.user) {
        throw new ApiError(
          'GET_PENDING_SO_APPROVALS',
          StatusCodes.UNAUTHORIZED,
          'USER_NOT_AUTHENTICATED',
          'User authentication required',
        );
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;

      // Get user's role
      const user = await req.user.populate('role');
      const userRole =
        typeof user.role === 'object' && user.role !== null
          ? (user.role as { name?: string; _id?: string })
          : null;

      const approverRoleId = userRole?._id?.toString();

      const result = await SOApprovalService.getPendingApprovals(
        page,
        limit,
        approverRoleId,
      );

      const response = new ApiResponse(
        true,
        result,
        'Pending SO approvals retrieved successfully',
      );
      res.status(StatusCodes.OK).json(response);
    },
  );

  /**
   * Get SO approval request by ID
   * GET /api/so-approvals/:id
   */
  static getApprovalById = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { id } = req.params;

      const approval = await SOApprovalService.getApprovalById(id);

      const response = new ApiResponse(
        true,
        approval,
        'SO approval request retrieved successfully',
      );
      res.status(StatusCodes.OK).json(response);
    },
  );

  /**
   * Process SO approval decision (approve/reject)
   * PATCH /api/so-approvals/:id/process
   */
  static processApprovalDecision = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      if (!req.user) {
        throw new ApiError(
          'PROCESS_SO_APPROVAL',
          StatusCodes.UNAUTHORIZED,
          'USER_NOT_AUTHENTICATED',
          'User authentication required',
        );
      }

      const { id } = req.params;
      const { approved, approverNotes, rejectionReason } = req.body;

      if (typeof approved !== 'boolean') {
        throw new ApiError(
          'PROCESS_SO_APPROVAL',
          StatusCodes.BAD_REQUEST,
          'INVALID_REQUEST_BODY',
          'approved field must be a boolean',
        );
      }

      if (!approved && !rejectionReason) {
        throw new ApiError(
          'PROCESS_SO_APPROVAL',
          StatusCodes.BAD_REQUEST,
          'MISSING_REJECTION_REASON',
          'rejectionReason is required when rejecting an approval',
        );
      }

      // Verify user has admin role
      const user = await req.user.populate('role');
      const userRole =
        typeof user.role === 'object' && user.role !== null
          ? (user.role as { name?: string })
          : null;
      const roleName = userRole?.name?.toLowerCase();

      if (roleName !== 'admin') {
        throw new ApiError(
          'PROCESS_SO_APPROVAL',
          StatusCodes.FORBIDDEN,
          'INSUFFICIENT_PERMISSIONS',
          'Only admins can process SO approvals',
        );
      }

      const approval = await SOApprovalService.processApprovalDecision({
        approvalId: id,
        approvedBy: req.user._id,
        approved,
        approverNotes,
        rejectionReason,
      });

      const response = new ApiResponse(
        true,
        approval,
        `SO approval ${approved ? 'approved' : 'rejected'} successfully`,
      );
      res.status(StatusCodes.OK).json(response);
    },
  );

  /**
   * Get user's own SO approval requests
   * GET /api/so-approvals/my-requests
   */
  static getMyApprovalRequests = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      if (!req.user) {
        throw new ApiError(
          'GET_MY_SO_APPROVALS',
          StatusCodes.UNAUTHORIZED,
          'USER_NOT_AUTHENTICATED',
          'User authentication required',
        );
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;

      const result = await SOApprovalService.getUserApprovalRequests(
        req.user._id,
        page,
        limit,
      );

      const response = new ApiResponse(
        true,
        result,
        'User SO approval requests retrieved successfully',
      );
      res.status(StatusCodes.OK).json(response);
    },
  );

  /**
   * Cancel an SO approval request
   * PATCH /api/so-approvals/:id/cancel
   */
  static cancelApprovalRequest = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      if (!req.user) {
        throw new ApiError(
          'CANCEL_SO_APPROVAL',
          StatusCodes.UNAUTHORIZED,
          'USER_NOT_AUTHENTICATED',
          'User authentication required',
        );
      }

      const { id } = req.params;

      const approval = await SOApprovalService.cancelApprovalRequest(
        id,
        req.user._id,
      );

      const response = new ApiResponse(
        true,
        approval,
        'SO approval request cancelled successfully',
      );
      res.status(StatusCodes.OK).json(response);
    },
  );
}

export default SOApprovalController;
