import mongoose from 'mongoose';
import { StatusCodes } from 'http-status-codes';
import {
  MachineApproval,
  IMachineApproval,
  ApprovalType,
  ApprovalStatus,
} from '../../../models/machineApproval.model';
import { Machine, IMachine } from '../../../models/machine.model';
import { User, IUser } from '../../../models/user.model';
import { ApiError } from '../../../utils/ApiError';
import { ERROR_MESSAGES } from '../machine.error.constant';

export interface CreateApprovalRequestData {
  machineId: string;
  requestedBy: string;
  approvalType: ApprovalType;
  proposedChanges: Record<string, unknown>;
  originalData?: Record<string, unknown>;
  requestNotes?: string;
}

export interface ApprovalDecisionData {
  approvalId: string;
  approvedBy: string;
  approved: boolean;
  approverNotes?: string;
  rejectionReason?: string;
}

export interface ApprovalFilters {
  status?: ApprovalStatus;
  requestedBy?: string;
  approvalType?: ApprovalType;
  machineId?: string;
}

export interface ApprovalListResult {
  approvals: IMachineApproval[];
  total: number;
  pages: number;
}

class MachineApprovalService {
  /**
   * Create an approval request
   */
  static async createApprovalRequest(
    data: CreateApprovalRequestData,
  ): Promise<IMachineApproval> {
    try {
      // Verify machine exists
      const machine = await Machine.findById(data.machineId);
      if (!machine) {
        throw new ApiError(
          'CREATE_APPROVAL_REQUEST',
          StatusCodes.NOT_FOUND,
          'MACHINE_NOT_FOUND',
          'Machine not found',
        );
      }

      // Verify requester exists
      const requester = await User.findById(data.requestedBy);
      if (!requester) {
        throw new ApiError(
          'CREATE_APPROVAL_REQUEST',
          StatusCodes.NOT_FOUND,
          'USER_NOT_FOUND',
          'Requester not found',
        );
      }

      // Check if there's already a pending approval for this machine and action
      const existingApproval = await MachineApproval.findOne({
        machineId: data.machineId,
        approvalType: data.approvalType,
        status: ApprovalStatus.PENDING,
      });

      if (existingApproval) {
        throw new ApiError(
          'CREATE_APPROVAL_REQUEST',
          StatusCodes.CONFLICT,
          'PENDING_APPROVAL_EXISTS',
          'A pending approval request already exists for this machine and action',
        );
      }

      const approvalRequest = new MachineApproval({
        machineId: data.machineId,
        requestedBy: data.requestedBy,
        approvalType: data.approvalType,
        originalData: data.originalData,
        proposedChanges: data.proposedChanges,
        requestNotes: data.requestNotes,
        status: ApprovalStatus.PENDING,
      });

      await approvalRequest.save();

      // Populate related data
      await approvalRequest.populate([
        { path: 'machineId', select: 'name category_id' },
        { path: 'requestedBy', select: 'username email' },
      ]);

      return approvalRequest;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(
        'CREATE_APPROVAL_REQUEST',
        StatusCodes.INTERNAL_SERVER_ERROR,
        'CREATE_APPROVAL_ERROR',
        'Failed to create approval request',
      );
    }
  }

  /**
   * Get approval requests with pagination and filters
   */
  static async getApprovalRequests(
    page: number = 1,
    limit: number = 10,
    filters: ApprovalFilters = {},
  ): Promise<ApprovalListResult> {
    try {
      const skip = (page - 1) * limit;
      const query: Record<string, unknown> = {};

      // Apply filters
      if (filters.status) query['status'] = filters.status;
      if (filters.requestedBy) query['requestedBy'] = filters.requestedBy;
      if (filters.approvalType) query['approvalType'] = filters.approvalType;
      if (filters.machineId) query['machineId'] = filters.machineId;

      const [approvals, total] = await Promise.all([
        MachineApproval.find(query)
          .populate([
            { path: 'machineId', select: 'name category_id' },
            { path: 'requestedBy', select: 'username email' },
            { path: 'approvedBy', select: 'username email' },
            { path: 'rejectedBy', select: 'username email' },
          ])
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit),
        MachineApproval.countDocuments(query),
      ]);

      return {
        approvals,
        total,
        pages: Math.ceil(total / limit),
      };
    } catch (error) {
      throw new ApiError(
        'GET_APPROVAL_REQUESTS',
        StatusCodes.INTERNAL_SERVER_ERROR,
        'GET_APPROVALS_ERROR',
        'Failed to retrieve approval requests',
      );
    }
  }

  /**
   * Get approval request by ID
   */
  static async getApprovalById(id: string): Promise<IMachineApproval> {
    try {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new ApiError(
          'GET_APPROVAL_BY_ID',
          StatusCodes.BAD_REQUEST,
          'INVALID_APPROVAL_ID',
          'Invalid approval ID format',
        );
      }

      const approval = await MachineApproval.findById(id).populate([
        { path: 'machineId', select: 'name category_id' },
        { path: 'requestedBy', select: 'username email' },
        { path: 'approvedBy', select: 'username email' },
        { path: 'rejectedBy', select: 'username email' },
      ]);

      if (!approval) {
        throw new ApiError(
          'GET_APPROVAL_BY_ID',
          StatusCodes.NOT_FOUND,
          'APPROVAL_NOT_FOUND',
          'Approval request not found',
        );
      }

      return approval;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(
        'GET_APPROVAL_BY_ID',
        StatusCodes.INTERNAL_SERVER_ERROR,
        'GET_APPROVAL_ERROR',
        'Failed to retrieve approval request',
      );
    }
  }

  /**
   * Process approval decision (approve/reject)
   */
  static async processApprovalDecision(
    data: ApprovalDecisionData,
  ): Promise<IMachineApproval> {
    try {
      const approval = await MachineApproval.findById(data.approvalId);
      if (!approval) {
        throw new ApiError(
          'PROCESS_APPROVAL',
          StatusCodes.NOT_FOUND,
          'APPROVAL_NOT_FOUND',
          'Approval request not found',
        );
      }

      if (approval.status !== ApprovalStatus.PENDING) {
        throw new ApiError(
          'PROCESS_APPROVAL',
          StatusCodes.BAD_REQUEST,
          'APPROVAL_ALREADY_PROCESSED',
          'Approval request has already been processed',
        );
      }

      // Verify approver exists
      const approver = await User.findById(data.approvedBy);
      if (!approver) {
        throw new ApiError(
          'PROCESS_APPROVAL',
          StatusCodes.NOT_FOUND,
          'APPROVER_NOT_FOUND',
          'Approver not found',
        );
      }

      // Update approval status
      const updateData: any = {
        status: data.approved
          ? ApprovalStatus.APPROVED
          : ApprovalStatus.REJECTED,
        approverNotes: data.approverNotes,
      };

      if (data.approved) {
        updateData.approvedBy = data.approvedBy;
        updateData.approvalDate = new Date();
      } else {
        updateData.rejectedBy = data.approvedBy;
        updateData.rejectionReason = data.rejectionReason;
      }

      const updatedApproval = await MachineApproval.findByIdAndUpdate(
        data.approvalId,
        updateData,
        { new: true, runValidators: true },
      ).populate([
        { path: 'machineId', select: 'name category_id' },
        { path: 'requestedBy', select: 'username email' },
        { path: 'approvedBy', select: 'username email' },
        { path: 'rejectedBy', select: 'username email' },
      ]);

      return updatedApproval!;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(
        'PROCESS_APPROVAL',
        StatusCodes.INTERNAL_SERVER_ERROR,
        'PROCESS_APPROVAL_ERROR',
        'Failed to process approval decision',
      );
    }
  }

  /**
   * Get user's approval requests
   */
  static async getUserApprovalRequests(
    userId: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<ApprovalListResult> {
    return this.getApprovalRequests(page, limit, { requestedBy: userId });
  }

  /**
   * Get pending approvals for approvers
   */
  static async getPendingApprovals(
    page: number = 1,
    limit: number = 10,
  ): Promise<ApprovalListResult> {
    return this.getApprovalRequests(page, limit, {
      status: ApprovalStatus.PENDING,
    });
  }

  /**
   * Cancel an approval request (only by requester)
   */
  static async cancelApprovalRequest(
    approvalId: string,
    userId: string,
  ): Promise<IMachineApproval> {
    try {
      const approval = await MachineApproval.findById(approvalId);
      if (!approval) {
        throw new ApiError(
          'CANCEL_APPROVAL',
          StatusCodes.NOT_FOUND,
          'APPROVAL_NOT_FOUND',
          'Approval request not found',
        );
      }

      if (approval.requestedBy.toString() !== userId) {
        throw new ApiError(
          'CANCEL_APPROVAL',
          StatusCodes.FORBIDDEN,
          'NOT_AUTHORIZED',
          'Only the requester can cancel the approval request',
        );
      }

      if (approval.status !== ApprovalStatus.PENDING) {
        throw new ApiError(
          'CANCEL_APPROVAL',
          StatusCodes.BAD_REQUEST,
          'APPROVAL_ALREADY_PROCESSED',
          'Cannot cancel already processed approval request',
        );
      }

      const updatedApproval = await MachineApproval.findByIdAndUpdate(
        approvalId,
        { status: ApprovalStatus.CANCELLED },
        { new: true, runValidators: true },
      ).populate([
        { path: 'machineId', select: 'name category_id' },
        { path: 'requestedBy', select: 'username email' },
      ]);

      return updatedApproval!;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(
        'CANCEL_APPROVAL',
        StatusCodes.INTERNAL_SERVER_ERROR,
        'CANCEL_APPROVAL_ERROR',
        'Failed to cancel approval request',
      );
    }
  }
}

export default MachineApprovalService;
