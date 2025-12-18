import mongoose from 'mongoose';
import { StatusCodes } from 'http-status-codes';
import {
  SOApproval,
  ISOApproval,
  SOApprovalType,
  SOApprovalStatus,
} from '../../../models/soApproval.model';
import { ApiError } from '../../../utils/ApiError';
import { User } from '../../../models/user.model';
import { SO } from '../../../models/so.model';

export interface CreateSOApprovalRequestData {
  soId: string;
  requestedBy: string;
  approvalType: SOApprovalType;
  proposedChanges: Record<string, unknown>;
  originalData?: Record<string, unknown>;
  requestNotes?: string;
  approverRoles?: string[]; // optional scoping to approver role ids
}

export interface SOApprovalDecisionData {
  approvalId: string;
  approvedBy: string;
  approved: boolean;
  approverNotes?: string;
  rejectionReason?: string;
}

export interface SOApprovalFilters {
  status?: SOApprovalStatus;
  requestedBy?: string;
  approvalType?: SOApprovalType;
  soId?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface SOApprovalListResult {
  approvals: ISOApproval[];
  total: number;
  pages: number;
}

class SOApprovalService {
  /**
   * Create an approval request
   */
  static async createApprovalRequest(
    data: CreateSOApprovalRequestData,
  ): Promise<ISOApproval> {
    try {
      // Verify SO exists
      const so = await SO.findById(data.soId);
      if (!so) {
        throw new ApiError(
          'CREATE_SO_APPROVAL_REQUEST',
          StatusCodes.NOT_FOUND,
          'SO_NOT_FOUND',
          'SO not found',
        );
      }

      // Verify requester exists
      const requester = await User.findById(data.requestedBy);
      if (!requester) {
        throw new ApiError(
          'CREATE_SO_APPROVAL_REQUEST',
          StatusCodes.NOT_FOUND,
          'USER_NOT_FOUND',
          'Requester not found',
        );
      }

      // Check if there's already a pending approval for this SO and action
      const existingApproval = await SOApproval.findOne({
        soId: data.soId,
        approvalType: data.approvalType,
        status: SOApprovalStatus.PENDING,
      });

      if (existingApproval) {
        throw new ApiError(
          'CREATE_SO_APPROVAL_REQUEST',
          StatusCodes.CONFLICT,
          'PENDING_APPROVAL_EXISTS',
          'A pending approval request already exists for this SO and action',
        );
      }

      const approvalRequest = new SOApproval({
        soId: data.soId,
        requestedBy: data.requestedBy,
        approvalType: data.approvalType,
        originalData: data.originalData,
        proposedChanges: data.proposedChanges,
        requestNotes: data.requestNotes,
        status: SOApprovalStatus.PENDING,
        approverRoles: (data.approverRoles || []).map(
          (id) => new mongoose.Types.ObjectId(id),
        ),
      });

      await approvalRequest.save();

      // Populate related data
      await approvalRequest.populate([
        {
          path: 'soId',
          select:
            'name customer location po_number po_date so_number so_date items category_id subcategory_id party_name mobile_number description is_active',
          populate: [
            { path: 'category_id', select: 'name description' },
            { path: 'subcategory_id', select: 'name description' },
          ],
        },
        { path: 'requestedBy', select: 'username email' },
      ]);

      return approvalRequest;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(
        'CREATE_SO_APPROVAL_REQUEST',
        StatusCodes.INTERNAL_SERVER_ERROR,
        'CREATE_SO_APPROVAL_ERROR',
        'Failed to create SO approval request',
      );
    }
  }

  /**
   * Get approval requests with pagination and filters
   */
  static async getApprovalRequests(
    page: number = 1,
    limit: number = 10,
    filters: SOApprovalFilters = {},
  ): Promise<SOApprovalListResult> {
    try {
      const skip = (page - 1) * limit;
      const sortBy = filters.sortBy || 'createdAt';
      const sortOrder = filters.sortOrder === 'asc' ? 1 : -1;

      const query: Record<string, unknown> = {};

      if (filters.status) {
        query.status = filters.status;
      }
      if (filters.approvalType) {
        query.approvalType = filters.approvalType;
      }
      if (filters.soId) {
        query.soId = new mongoose.Types.ObjectId(filters.soId);
      }
      if (filters.requestedBy) {
        query.requestedBy = new mongoose.Types.ObjectId(filters.requestedBy);
      }

      const [approvals, total] = await Promise.all([
        SOApproval.find(query)
          .populate([
            {
              path: 'soId',
              select:
                'name customer location po_number po_date so_number so_date items category_id subcategory_id party_name mobile_number description is_active',
              populate: [
                { path: 'category_id', select: 'name description' },
                { path: 'subcategory_id', select: 'name description' },
              ],
            },
            { path: 'requestedBy', select: 'username email' },
            { path: 'approvedBy', select: 'username email' },
            { path: 'rejectedBy', select: 'username email' },
            { path: 'approverRoles', select: 'name' },
          ])
          .sort({ [sortBy]: sortOrder })
          .skip(skip)
          .limit(limit)
          .lean(),
        SOApproval.countDocuments(query),
      ]);

      return {
        approvals: approvals as ISOApproval[],
        total,
        pages: Math.ceil(total / limit),
      };
    } catch (error) {
      console.error('Error getting SO approval requests:', error);
      throw new ApiError(
        'GET_SO_APPROVAL_REQUESTS',
        StatusCodes.INTERNAL_SERVER_ERROR,
        'GET_SO_APPROVALS_ERROR',
        'Failed to retrieve SO approval requests',
      );
    }
  }

  /**
   * Get approval request by ID
   */
  static async getApprovalById(id: string): Promise<ISOApproval> {
    try {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new ApiError(
          'GET_SO_APPROVAL_BY_ID',
          StatusCodes.BAD_REQUEST,
          'INVALID_APPROVAL_ID',
          'Invalid approval ID format',
        );
      }

      const approval = await SOApproval.findById(id).populate([
        {
          path: 'soId',
          select:
            'name customer location po_number po_date so_number so_date items category_id subcategory_id party_name mobile_number description is_active',
          populate: [
            { path: 'category_id', select: 'name description' },
            { path: 'subcategory_id', select: 'name description' },
          ],
        },
        { path: 'requestedBy', select: 'username email' },
        { path: 'approvedBy', select: 'username email' },
        { path: 'rejectedBy', select: 'username email' },
        { path: 'approverRoles', select: 'name' },
      ]);

      if (!approval) {
        throw new ApiError(
          'GET_SO_APPROVAL_BY_ID',
          StatusCodes.NOT_FOUND,
          'APPROVAL_NOT_FOUND',
          'SO approval request not found',
        );
      }

      return approval;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(
        'GET_SO_APPROVAL_BY_ID',
        StatusCodes.INTERNAL_SERVER_ERROR,
        'GET_SO_APPROVAL_ERROR',
        'Failed to retrieve SO approval request',
      );
    }
  }

  /**
   * Process approval decision (approve/reject)
   */
  static async processApprovalDecision(
    data: SOApprovalDecisionData,
  ): Promise<ISOApproval> {
    try {
      const approval = await SOApproval.findById(data.approvalId);
      if (!approval) {
        throw new ApiError(
          'PROCESS_SO_APPROVAL',
          StatusCodes.NOT_FOUND,
          'APPROVAL_NOT_FOUND',
          'SO approval request not found',
        );
      }

      if (approval.status !== SOApprovalStatus.PENDING) {
        throw new ApiError(
          'PROCESS_SO_APPROVAL',
          StatusCodes.BAD_REQUEST,
          'APPROVAL_ALREADY_PROCESSED',
          'SO approval request has already been processed',
        );
      }

      // Verify approver exists
      const approver = await User.findById(data.approvedBy);
      if (!approver) {
        throw new ApiError(
          'PROCESS_SO_APPROVAL',
          StatusCodes.NOT_FOUND,
          'APPROVER_NOT_FOUND',
          'Approver not found',
        );
      }

      // Update approval status
      const updateData: {
        status: SOApprovalStatus;
        approverNotes?: string | undefined;
        approvedBy?: string | undefined;
        approvalDate?: Date | undefined;
        rejectedBy?: string | undefined;
        rejectionReason?: string | undefined;
      } = {
        status: data.approved
          ? SOApprovalStatus.APPROVED
          : SOApprovalStatus.REJECTED,
        approverNotes: data.approverNotes,
      };

      if (data.approved) {
        updateData.approvedBy = data.approvedBy;
        updateData.approvalDate = new Date();
      } else {
        updateData.rejectedBy = data.approvedBy;
        updateData.rejectionReason = data.rejectionReason;
      }

      const updatedApproval = await SOApproval.findByIdAndUpdate(
        data.approvalId,
        updateData,
        { new: true, runValidators: true },
      ).populate([
        {
          path: 'soId',
          select:
            'name customer location po_number po_date so_number so_date items category_id subcategory_id party_name mobile_number description is_active',
          populate: [
            { path: 'category_id', select: 'name description' },
            { path: 'subcategory_id', select: 'name description' },
          ],
        },
        { path: 'requestedBy', select: 'username email' },
        { path: 'approvedBy', select: 'username email' },
        { path: 'rejectedBy', select: 'username email' },
      ]);

      // When an approval is accepted, ensure SO is active
      if (data.approved) {
        try {
          await SO.findByIdAndUpdate(
            approval.soId,
            { is_active: true, updatedAt: new Date() },
            { new: true },
          );
        } catch {
          // Do not fail the approval process if SO update fails
          throw new ApiError(
            'PROCESS_SO_APPROVAL',
            StatusCodes.INTERNAL_SERVER_ERROR,
            'PROCESS_SO_APPROVAL_ERROR',
            'Failed to update SO is_active flag',
          );
        }
      }

      return updatedApproval!;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(
        'PROCESS_SO_APPROVAL',
        StatusCodes.INTERNAL_SERVER_ERROR,
        'PROCESS_SO_APPROVAL_ERROR',
        'Failed to process SO approval decision',
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
  ): Promise<SOApprovalListResult> {
    return this.getApprovalRequests(page, limit, { requestedBy: userId });
  }

  /**
   * Get pending approvals for approvers
   */
  static async getPendingApprovals(
    page: number = 1,
    limit: number = 10,
    approverRoleId?: string,
  ): Promise<SOApprovalListResult> {
    const filters: SOApprovalFilters = {
      status: SOApprovalStatus.PENDING,
    };

    // If approverRoleId is provided, filter by approverRoles
    if (approverRoleId) {
      const approvals = await SOApproval.find({
        status: SOApprovalStatus.PENDING,
        approverRoles: new mongoose.Types.ObjectId(approverRoleId),
      })
        .populate([
          {
            path: 'soId',
            select:
              'name customer location po_number po_date so_number so_date items category_id subcategory_id party_name mobile_number description is_active',
            populate: [
              { path: 'category_id', select: 'name description' },
              { path: 'subcategory_id', select: 'name description' },
            ],
          },
          { path: 'requestedBy', select: 'username email' },
          { path: 'approverRoles', select: 'name' },
        ])
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean();

      const total = await SOApproval.countDocuments({
        status: SOApprovalStatus.PENDING,
        approverRoles: new mongoose.Types.ObjectId(approverRoleId),
      });

      return {
        approvals: approvals as ISOApproval[],
        total,
        pages: Math.ceil(total / limit),
      };
    }

    return this.getApprovalRequests(page, limit, filters);
  }

  /**
   * Cancel an approval request (only by requester)
   */
  static async cancelApprovalRequest(
    approvalId: string,
    userId: string,
  ): Promise<ISOApproval> {
    try {
      const approval = await SOApproval.findById(approvalId);
      if (!approval) {
        throw new ApiError(
          'CANCEL_SO_APPROVAL',
          StatusCodes.NOT_FOUND,
          'APPROVAL_NOT_FOUND',
          'SO approval request not found',
        );
      }

      if (approval.requestedBy.toString() !== userId) {
        throw new ApiError(
          'CANCEL_SO_APPROVAL',
          StatusCodes.FORBIDDEN,
          'NOT_AUTHORIZED',
          'Only the requester can cancel the approval request',
        );
      }

      if (approval.status !== SOApprovalStatus.PENDING) {
        throw new ApiError(
          'CANCEL_SO_APPROVAL',
          StatusCodes.BAD_REQUEST,
          'APPROVAL_ALREADY_PROCESSED',
          'Cannot cancel already processed approval request',
        );
      }

      const updatedApproval = await SOApproval.findByIdAndUpdate(
        approvalId,
        { status: SOApprovalStatus.CANCELLED },
        { new: true, runValidators: true },
      ).populate([
        {
          path: 'soId',
          select:
            'name customer location po_number po_date so_number so_date items category_id subcategory_id party_name mobile_number description is_active',
          populate: [
            { path: 'category_id', select: 'name description' },
            { path: 'subcategory_id', select: 'name description' },
          ],
        },
        { path: 'requestedBy', select: 'username email' },
      ]);

      return updatedApproval!;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(
        'CANCEL_SO_APPROVAL',
        StatusCodes.INTERNAL_SERVER_ERROR,
        'CANCEL_SO_APPROVAL_ERROR',
        'Failed to cancel SO approval request',
      );
    }
  }
}

export default SOApprovalService;
