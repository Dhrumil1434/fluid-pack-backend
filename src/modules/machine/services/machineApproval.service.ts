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
  sequence?: string; // Machine sequence number
  categoryId?: string; // Category filter
  dateFrom?: string; // Date range start (ISO string)
  dateTo?: string; // Date range end (ISO string)
  metadataKey?: string; // Metadata key to search
  metadataValue?: string; // Metadata value to search
  sortBy?: string; // Sort field (default: createdAt)
  sortOrder?: 'asc' | 'desc'; // Sort order (default: desc)
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
   * Uses aggregation pipeline for advanced filtering on populated fields
   */
  static async getApprovalRequests(
    page: number = 1,
    limit: number = 10,
    filters: ApprovalFilters = {},
  ): Promise<ApprovalListResult> {
    try {
      const skip = (page - 1) * limit;
      const sortBy = filters.sortBy || 'createdAt';
      const sortOrder = filters.sortOrder === 'asc' ? 1 : -1;

      // Build aggregation pipeline
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pipeline: any[] = [
        // Lookup machine (include all fields including machine_sequence)
        {
          $lookup: {
            from: 'machines',
            localField: 'machineId',
            foreignField: '_id',
            as: 'machineId',
          },
        },
        {
          $unwind: '$machineId',
        },
        // Project to include machine_sequence explicitly
        {
          $addFields: {
            'machineId.machine_sequence': '$machineId.machine_sequence',
          },
        },
        // Lookup category
        {
          $lookup: {
            from: 'categories',
            localField: 'machineId.category_id',
            foreignField: '_id',
            as: 'machineId.category_id',
          },
        },
        {
          $unwind: {
            path: '$machineId.category_id',
            preserveNullAndEmptyArrays: true,
          },
        },
        // Lookup requestedBy user
        {
          $lookup: {
            from: 'users',
            localField: 'requestedBy',
            foreignField: '_id',
            as: 'requestedBy',
          },
        },
        {
          $unwind: '$requestedBy',
        },
        // Lookup approvedBy user
        {
          $lookup: {
            from: 'users',
            localField: 'approvedBy',
            foreignField: '_id',
            as: 'approvedBy',
          },
        },
        {
          $unwind: {
            path: '$approvedBy',
            preserveNullAndEmptyArrays: true,
          },
        },
        // Lookup rejectedBy user
        {
          $lookup: {
            from: 'users',
            localField: 'rejectedBy',
            foreignField: '_id',
            as: 'rejectedBy',
          },
        },
        {
          $unwind: {
            path: '$rejectedBy',
            preserveNullAndEmptyArrays: true,
          },
        },
      ];

      // Build match stage for filters
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const matchStage: any = {};

      // Basic filters
      if (filters.status) {
        matchStage.status = filters.status;
      }
      if (filters.approvalType) {
        matchStage.approvalType = filters.approvalType;
      }
      if (filters.machineId) {
        matchStage['machineId._id'] = new mongoose.Types.ObjectId(
          filters.machineId,
        );
      }

      // Category filter (only if valid ObjectId string)
      if (
        filters.categoryId &&
        typeof filters.categoryId === 'string' &&
        filters.categoryId.trim()
      ) {
        const categoryId = filters.categoryId.trim();
        if (mongoose.Types.ObjectId.isValid(categoryId)) {
          matchStage['machineId.category_id._id'] = new mongoose.Types.ObjectId(
            categoryId,
          );
        }
      }

      // Sequence filter (only if non-empty string)
      if (
        filters.sequence &&
        typeof filters.sequence === 'string' &&
        filters.sequence.trim()
      ) {
        matchStage['machineId.machine_sequence'] = {
          $regex: filters.sequence.trim(),
          $options: 'i',
        };
      }

      // RequestedBy filter (search by username or email)
      if (
        filters.requestedBy &&
        typeof filters.requestedBy === 'string' &&
        filters.requestedBy.trim()
      ) {
        const requestedByValue = filters.requestedBy.trim();
        // If $or already exists (from metadata), combine them
        if (matchStage.$or) {
          matchStage.$or.push(
            {
              'requestedBy.username': {
                $regex: requestedByValue,
                $options: 'i',
              },
            },
            {
              'requestedBy.email': {
                $regex: requestedByValue,
                $options: 'i',
              },
            },
          );
        } else {
          matchStage.$or = [
            {
              'requestedBy.username': {
                $regex: requestedByValue,
                $options: 'i',
              },
            },
            {
              'requestedBy.email': {
                $regex: requestedByValue,
                $options: 'i',
              },
            },
          ];
        }
      }

      // Date range filter (only if valid date strings)
      if (filters.dateFrom || filters.dateTo) {
        matchStage.createdAt = {};
        if (
          filters.dateFrom &&
          typeof filters.dateFrom === 'string' &&
          filters.dateFrom.trim()
        ) {
          const dateFrom = new Date(filters.dateFrom.trim());
          if (!isNaN(dateFrom.getTime())) {
            matchStage.createdAt.$gte = dateFrom;
          }
        }
        if (
          filters.dateTo &&
          typeof filters.dateTo === 'string' &&
          filters.dateTo.trim()
        ) {
          const endDate = new Date(filters.dateTo.trim());
          if (!isNaN(endDate.getTime())) {
            // Add one day to include the entire end date
            endDate.setHours(23, 59, 59, 999);
            matchStage.createdAt.$lte = endDate;
          }
        }
        // Remove createdAt if no valid dates were set
        if (Object.keys(matchStage.createdAt).length === 0) {
          delete matchStage.createdAt;
        }
      }

      // Metadata filter (key-value search)
      if (
        filters.metadataKey &&
        typeof filters.metadataKey === 'string' &&
        filters.metadataKey.trim()
      ) {
        const metadataPath = `machineId.metadata.${filters.metadataKey.trim()}`;
        if (
          filters.metadataValue &&
          typeof filters.metadataValue === 'string' &&
          filters.metadataValue.trim()
        ) {
          // Search for specific key-value pair
          matchStage[metadataPath] = {
            $regex: filters.metadataValue.trim(),
            $options: 'i',
          };
        } else {
          // Just check if key exists
          matchStage[metadataPath] = { $exists: true };
        }
      }

      // Add match stage if there are filters
      if (Object.keys(matchStage).length > 0) {
        pipeline.push({ $match: matchStage });
      }

      // Add sort
      pipeline.push({ $sort: { [sortBy]: sortOrder } });

      // Get total count before pagination
      const countPipeline = [...pipeline, { $count: 'total' }];
      const countResult = await MachineApproval.aggregate(countPipeline);
      const total = countResult[0]?.total || 0;

      // Add pagination
      pipeline.push({ $skip: skip }, { $limit: limit });

      // Execute aggregation
      const approvals = await MachineApproval.aggregate(pipeline);

      // Manually populate approverRoles if needed (aggregation doesn't populate arrays the same way)
      // For now, we'll leave it as is since approverRoles is not critical for listing

      return {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        approvals: approvals as any[],
        total,
        pages: Math.ceil(total / limit),
      };
    } catch (error) {
      console.error('Error getting approval requests:', error);
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
   * Now uses getApprovalRequests with enhanced filters
   */
  static async getPendingApprovals(
    page: number = 1,
    limit: number = 10,
    _approverRoleId?: string, // Handled in controller, not used here
    additionalFilters?: Partial<ApprovalFilters>,
  ): Promise<ApprovalListResult> {
    const filters: ApprovalFilters = {
      status: ApprovalStatus.PENDING,
      ...additionalFilters,
    };
    // Note: approverRoleId filtering is handled in the controller
    // as it requires post-processing or additional aggregation stages
    return this.getApprovalRequests(page, limit, filters);
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
