import mongoose from 'mongoose';
import { StatusCodes } from 'http-status-codes';
import {
  MachineApproval,
  IMachineApproval,
  ApprovalType,
  ApprovalStatus,
} from '../../../models/machineApproval.model';
import { ApiError } from '../../../utils/ApiError';
import { User } from '../../../models/user.model';
import { Machine } from '../../../models/machine.model';

export interface CreateApprovalRequestData {
  machineId: string;
  requestedBy: string;
  approvalType: ApprovalType;
  proposedChanges: Record<string, unknown>;
  originalData?: Record<string, unknown>;
  requestNotes?: string;
  approverRoles?: string[]; // optional scoping to approver role ids
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
        approverRoles: (data.approverRoles || []).map(
          (id) => new mongoose.Types.ObjectId(id),
        ),
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
    } catch {
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
        { path: 'approverRoles', select: 'name' },
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
   * Update approval request fields while pending
   */
  static async updateApprovalRequest(
    id: string,
    updates: {
      approverRoles?: string[];
      approvalType?: ApprovalType;
      requestNotes?: string;
      proposedChanges?: Record<string, unknown>;
    },
  ): Promise<IMachineApproval> {
    try {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new ApiError(
          'UPDATE_APPROVAL',
          StatusCodes.BAD_REQUEST,
          'INVALID_APPROVAL_ID',
          'Invalid approval ID format',
        );
      }

      const approval = await MachineApproval.findById(id);
      if (!approval) {
        throw new ApiError(
          'UPDATE_APPROVAL',
          StatusCodes.NOT_FOUND,
          'APPROVAL_NOT_FOUND',
          'Approval request not found',
        );
      }
      // Allow editing for PENDING and REJECTED (e.g., adjust approver roles for a resubmission loop)
      if (
        approval.status === ApprovalStatus.APPROVED ||
        approval.status === ApprovalStatus.CANCELLED
      ) {
        throw new ApiError(
          'UPDATE_APPROVAL',
          StatusCodes.BAD_REQUEST,
          'APPROVAL_ALREADY_PROCESSED',
          'Only pending or rejected approvals can be updated',
        );
      }

      const updateData: Partial<IMachineApproval> =
        {} as Partial<IMachineApproval>;
      if (updates.approverRoles !== undefined) {
        updateData.approverRoles = (updates.approverRoles || []).map(
          (r) => new mongoose.Types.ObjectId(r),
        );
      }
      if (updates.approvalType !== undefined)
        updateData.approvalType = updates.approvalType;
      if (updates.requestNotes !== undefined)
        updateData.requestNotes = updates.requestNotes;
      if (updates.proposedChanges !== undefined)
        updateData.proposedChanges = updates.proposedChanges;

      // Use $set explicitly to avoid merge semantics with arrays
      await MachineApproval.updateOne({ _id: id }, { $set: updateData });
      const updated = await MachineApproval.findById(id).populate([
        { path: 'machineId', select: 'name category_id' },
        { path: 'requestedBy', select: 'username email' },
        { path: 'approverRoles', select: 'name' },
      ]);
      return updated!;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(
        'UPDATE_APPROVAL',
        StatusCodes.INTERNAL_SERVER_ERROR,
        'UPDATE_APPROVAL_ERROR',
        'Failed to update approval request',
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
      const updateData: {
        status: ApprovalStatus;
        approverNotes?: string | undefined;
        approvedBy?: string | undefined;
        approvalDate?: Date | undefined;
        rejectedBy?: string | undefined;
        rejectionReason?: string | undefined;
      } = {
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

      // When an approval is accepted, reflect it on the machine document
      if (data.approved) {
        try {
          await Machine.findByIdAndUpdate(
            approval.machineId,
            { is_approved: true, updatedAt: new Date() },
            { new: true },
          );
        } catch {
          // Do not fail the approval process if machine update fails; log and continue
          // You may replace with a proper logger

          throw new ApiError(
            'PROCESS_APPROVAL',
            StatusCodes.INTERNAL_SERVER_ERROR,
            'PROCESS_APPROVAL_ERROR',
            'Failed to update machine is_approved flag',
          );
        }
      }

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
    approverRoleId?: string,
  ): Promise<ApprovalListResult> {
    const base: ApprovalFilters & { approverRoles?: string } = {
      status: ApprovalStatus.PENDING,
    };
    // Filter to approvals scoped to the approver's role if provided
    const filters: ApprovalFilters & { approverRoles?: string } = { ...base };
    if (approverRoleId) filters.approverRoles = approverRoleId;
    return this.getApprovalRequests(
      page,
      limit,
      filters as unknown as ApprovalFilters,
    );
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

  /**
   * Get approval statistics
   */
  static async getApprovalStatistics(): Promise<{
    totalPending: number;
    highPriority: number;
    mediumPriority: number;
    lowPriority: number;
    approvalsByType: Array<{ _id: string; count: number }>;
    averageProcessingTime: number;
    overdueApprovals: number;
  }> {
    try {
      const totalPending = await MachineApproval.countDocuments({
        status: 'pending',
      });
      const highPriority = await MachineApproval.countDocuments({
        status: 'pending',
        priority: 'high',
      });
      const mediumPriority = await MachineApproval.countDocuments({
        status: 'pending',
        priority: 'medium',
      });
      const lowPriority = await MachineApproval.countDocuments({
        status: 'pending',
        priority: 'low',
      });

      // Get approvals by type
      const approvalsByType = await MachineApproval.aggregate([
        {
          $group: {
            _id: '$type',
            count: { $sum: 1 },
          },
        },
      ]);

      // Get average processing time
      const processedApprovals = await MachineApproval.find({
        status: { $in: ['approved', 'rejected'] },
        approvalDate: { $exists: true },
      });

      let averageProcessingTime = 0;
      if (processedApprovals.length > 0) {
        const totalTime = processedApprovals.reduce((sum, approval) => {
          if (approval.approvalDate && approval.createdAt) {
            const processingTime =
              approval.approvalDate.getTime() - approval.createdAt.getTime();
            return sum + processingTime;
          }
          return sum;
        }, 0);
        averageProcessingTime =
          totalTime / processedApprovals.length / (1000 * 60 * 60); // Convert to hours
      }

      // Get overdue approvals (pending for more than 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const overdueApprovals = await MachineApproval.countDocuments({
        status: 'pending',
        createdAt: { $lt: sevenDaysAgo },
      });

      return {
        totalPending,
        highPriority,
        mediumPriority,
        lowPriority,
        approvalsByType,
        averageProcessingTime,
        overdueApprovals,
      };
    } catch {
      throw new ApiError(
        'GET_APPROVAL_STATISTICS',
        StatusCodes.INTERNAL_SERVER_ERROR,
        'GET_APPROVAL_STATISTICS_ERROR',
        'Failed to retrieve approval statistics',
      );
    }
  }
}

export default MachineApprovalService;
