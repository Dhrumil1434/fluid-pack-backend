// services/machine.service.ts
import { StatusCodes } from 'http-status-codes';
// import { Machine, IMachine } from '../models/machine.model';
// import { Category } from '../../categories/models/category.model';
// import { ApiError } from '../../../../utils/ApiError';
// import { ERROR_MESSAGES } from '../../../../constants/errorMessages';
import mongoose from 'mongoose';
import { Category } from '../../../models/category.model';

import { IMachine, Machine } from '../../../models/machine.model';
import { ApiError } from '../../../utils/ApiError';
import { ERROR_MESSAGES } from '../machine.error.constant';
export interface CreateMachineData {
  name: string;
  category_id: string;
  created_by: string;
  images?: string[];
  metadata?: Record<string, unknown>;
  is_approved?: boolean;
}

export interface UpdateMachineData {
  name?: string;
  category_id?: mongoose.Types.ObjectId;
  images?: string[];
  metadata?: Record<string, unknown>;
  updatedBy?: string;
}

export interface MachineListResult {
  machines: IMachine[];
  total: number;
  pages: number;
}

export interface MachineFilters {
  category_id?: string;
  is_approved?: boolean;
  created_by?: string;
  search?: string;
}

class MachineService {
  /**
   * Create a new machine
   */
  static async create(data: CreateMachineData): Promise<IMachine> {
    try {
      // Verify category exists and is active
      const category = await Category.findOne({
        _id: data.category_id,
        deletedAt: null,
      });

      if (!category) {
        throw new ApiError(
          ERROR_MESSAGES.MACHINE.ACTION.CREATE,
          StatusCodes.BAD_REQUEST,
          ERROR_MESSAGES.CATEGORY.NOT_FOUND.code,
          ERROR_MESSAGES.CATEGORY.NOT_FOUND.message,
        );
      }

      // Check if machine with same name already exists in the same category
      const existingMachine = await Machine.findOne({
        name: { $regex: new RegExp(`^${data.name}$`, 'i') },
        category_id: data.category_id,
        deletedAt: null,
      });

      if (existingMachine) {
        throw new ApiError(
          ERROR_MESSAGES.MACHINE.ACTION.CREATE,
          StatusCodes.CONFLICT,
          ERROR_MESSAGES.MACHINE.ALREADY_EXISTS.code,
          ERROR_MESSAGES.MACHINE.ALREADY_EXISTS.message,
        );
      }

      const machine = new Machine({
        name: data.name.trim(),
        category_id: data.category_id,
        created_by: data.created_by,
        images: data.images || [],
        metadata: data.metadata || {},
        is_approved:
          typeof data.is_approved === 'boolean' ? data.is_approved : false,
      });

      await machine.save();

      // Populate category and creator information
      await machine.populate([
        { path: 'category_id', select: 'name description' },
        { path: 'created_by', select: 'username email' },
      ]);

      return machine;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(
        ERROR_MESSAGES.MACHINE.ACTION.CREATE,
        StatusCodes.INTERNAL_SERVER_ERROR,
        'CREATE_MACHINE_ERROR',
        'Failed to create machine',
      );
    }
  }

  /**
   * Get all machines with pagination and filters
   */
  static async getAll(
    page: number,
    limit: number,
    filters: MachineFilters = {},
  ): Promise<MachineListResult> {
    try {
      const skip = (page - 1) * limit;
      const query: Record<string, unknown> = { deletedAt: null };

      // Apply filters
      if (filters.category_id) {
        query['category_id'] = filters.category_id;
      }

      if (typeof filters.is_approved === 'boolean') {
        query['is_approved'] = filters.is_approved;
      }

      if (filters.created_by) {
        query['created_by'] = filters.created_by;
      }

      if (filters.search) {
        query['$or'] = [{ name: { $regex: filters.search, $options: 'i' } }];
      }

      const [machines, total] = await Promise.all([
        Machine.find(query)
          .populate([
            { path: 'category_id', select: 'name description' },
            { path: 'created_by', select: 'username email' },
            { path: 'updatedBy', select: 'username email' },
          ])
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit),
        Machine.countDocuments(query),
      ]);

      return {
        machines,
        total,
        pages: Math.ceil(total / limit),
      };
    } catch {
      throw new ApiError(
        ERROR_MESSAGES.MACHINE.ACTION.GET,
        StatusCodes.INTERNAL_SERVER_ERROR,
        'GET_MACHINES_ERROR',
        'Failed to retrieve machines',
      );
    }
  }

  /**
   * Get machine by ID
   */
  static async getById(id: string): Promise<IMachine> {
    try {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new ApiError(
          ERROR_MESSAGES.MACHINE.ACTION.GET,
          StatusCodes.BAD_REQUEST,
          'INVALID_MACHINE_ID',
          'Invalid machine ID format',
        );
      }

      const machine = await Machine.findOne({
        _id: id,
        deletedAt: null,
      }).populate([
        { path: 'category_id', select: 'name description' },
        { path: 'created_by', select: 'username email' },
        { path: 'updatedBy', select: 'username email' },
      ]);

      if (!machine) {
        throw new ApiError(
          ERROR_MESSAGES.MACHINE.ACTION.GET,
          StatusCodes.NOT_FOUND,
          ERROR_MESSAGES.MACHINE.NOT_FOUND.code,
          ERROR_MESSAGES.MACHINE.NOT_FOUND.message,
        );
      }

      return machine;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(
        ERROR_MESSAGES.MACHINE.ACTION.GET,
        StatusCodes.INTERNAL_SERVER_ERROR,
        'GET_MACHINE_ERROR',
        'Failed to retrieve machine',
      );
    }
  }

  /**
   * Update machine
   */
  static async update(id: string, data: UpdateMachineData): Promise<IMachine> {
    try {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new ApiError(
          ERROR_MESSAGES.MACHINE.ACTION.UPDATE,
          StatusCodes.BAD_REQUEST,
          'INVALID_MACHINE_ID',
          'Invalid machine ID format',
        );
      }

      // Check if machine exists
      const existingMachine = await Machine.findOne({
        _id: id,
        deletedAt: null,
      });

      if (!existingMachine) {
        throw new ApiError(
          ERROR_MESSAGES.MACHINE.ACTION.UPDATE,
          StatusCodes.NOT_FOUND,
          ERROR_MESSAGES.MACHINE.NOT_FOUND.code,
          ERROR_MESSAGES.MACHINE.NOT_FOUND.message,
        );
      }

      // If category is being updated, verify it exists
      if (data.category_id) {
        const category = await Category.findOne({
          _id: data.category_id,
          deletedAt: null,
        });

        if (!category) {
          throw new ApiError(
            ERROR_MESSAGES.MACHINE.ACTION.UPDATE,
            StatusCodes.BAD_REQUEST,
            ERROR_MESSAGES.CATEGORY.NOT_FOUND.code,
            ERROR_MESSAGES.CATEGORY.NOT_FOUND.message,
          );
        }
      }

      // Check for duplicate name in the same category
      if (data.name) {
        const categoryId = data.category_id || existingMachine.category_id;
        const duplicateMachine = await Machine.findOne({
          name: { $regex: new RegExp(`^${data.name}$`, 'i') },
          category_id: categoryId,
          _id: { $ne: id },
          deletedAt: null,
        });

        if (duplicateMachine) {
          throw new ApiError(
            ERROR_MESSAGES.MACHINE.ACTION.UPDATE,
            StatusCodes.CONFLICT,
            ERROR_MESSAGES.MACHINE.ALREADY_EXISTS.code,
            ERROR_MESSAGES.MACHINE.ALREADY_EXISTS.message,
          );
        }
      }

      const updateData: UpdateMachineData = { ...data };
      if (data.name) {
        updateData.name = data.name.trim();
      }

      const machine = await Machine.findByIdAndUpdate(id, updateData, {
        new: true,
        runValidators: true,
      }).populate([
        { path: 'category_id', select: 'name description' },
        { path: 'created_by', select: 'username email' },
        { path: 'updatedBy', select: 'username email' },
      ]);

      return machine!;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(
        ERROR_MESSAGES.MACHINE.ACTION.UPDATE,
        StatusCodes.INTERNAL_SERVER_ERROR,
        'UPDATE_MACHINE_ERROR',
        'Failed to update machine',
      );
    }
  }

  /**
   * Delete machine (soft delete)
   */
  static async delete(id: string): Promise<void> {
    try {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new ApiError(
          ERROR_MESSAGES.MACHINE.ACTION.DELETE,
          StatusCodes.BAD_REQUEST,
          'INVALID_MACHINE_ID',
          'Invalid machine ID format',
        );
      }

      const machine = await Machine.findOne({
        _id: id,
        deletedAt: null,
      });

      if (!machine) {
        throw new ApiError(
          ERROR_MESSAGES.MACHINE.ACTION.DELETE,
          StatusCodes.NOT_FOUND,
          ERROR_MESSAGES.MACHINE.NOT_FOUND.code,
          ERROR_MESSAGES.MACHINE.NOT_FOUND.message,
        );
      }

      await Machine.findByIdAndUpdate(id, {
        deletedAt: new Date(),
      });
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(
        ERROR_MESSAGES.MACHINE.ACTION.DELETE,
        StatusCodes.INTERNAL_SERVER_ERROR,
        'DELETE_MACHINE_ERROR',
        'Failed to delete machine',
      );
    }
  }

  /**
   * Get approved machines
   */
  static async getApprovedMachines(): Promise<IMachine[]> {
    try {
      return await Machine.find({
        deletedAt: null,
        is_approved: true,
      })
        .populate([
          { path: 'category_id', select: 'name description' },
          { path: 'created_by', select: 'username email' },
        ])
        .sort({ name: 1 });
    } catch {
      throw new ApiError(
        ERROR_MESSAGES.MACHINE.ACTION.GET,
        StatusCodes.INTERNAL_SERVER_ERROR,
        'GET_APPROVED_MACHINES_ERROR',
        'Failed to retrieve approved machines',
      );
    }
  }

  /**
   * Update machine approval status
   */
  static async updateApprovalStatus(
    id: string,
    is_approved: boolean,
    updatedBy: string,
  ): Promise<IMachine> {
    try {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new ApiError(
          ERROR_MESSAGES.MACHINE.ACTION.UPDATE,
          StatusCodes.BAD_REQUEST,
          'INVALID_MACHINE_ID',
          'Invalid machine ID format',
        );
      }

      const machine = await Machine.findOne({
        _id: id,
        deletedAt: null,
      });

      if (!machine) {
        throw new ApiError(
          ERROR_MESSAGES.MACHINE.ACTION.UPDATE,
          StatusCodes.NOT_FOUND,
          ERROR_MESSAGES.MACHINE.NOT_FOUND.code,
          ERROR_MESSAGES.MACHINE.NOT_FOUND.message,
        );
      }

      const updatedMachine = await Machine.findByIdAndUpdate(
        id,
        {
          is_approved,
          updatedBy,
        },
        { new: true, runValidators: true },
      ).populate([
        { path: 'category_id', select: 'name description' },
        { path: 'created_by', select: 'username email' },
        { path: 'updatedBy', select: 'username email' },
      ]);

      return updatedMachine!;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(
        ERROR_MESSAGES.MACHINE.ACTION.UPDATE,
        StatusCodes.INTERNAL_SERVER_ERROR,
        'UPDATE_APPROVAL_ERROR',
        'Failed to update machine approval status',
      );
    }
  }

  /**
   * Check if machine exists
   */
  static async exists(id: string): Promise<boolean> {
    try {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return false;
      }

      const machine = await Machine.findOne({
        _id: id,
        deletedAt: null,
      });

      return !!machine;
    } catch {
      return false;
    }
  }

  /**
   * Get machines by category
   */
  static async getMachinesByCategory(categoryId: string): Promise<IMachine[]> {
    try {
      if (!mongoose.Types.ObjectId.isValid(categoryId)) {
        throw new ApiError(
          ERROR_MESSAGES.MACHINE.ACTION.GET,
          StatusCodes.BAD_REQUEST,
          'INVALID_CATEGORY_ID',
          'Invalid category ID format',
        );
      }

      return await Machine.find({
        category_id: categoryId,
        deletedAt: null,
        is_approved: true,
      })
        .populate([
          { path: 'category_id', select: 'name description' },
          { path: 'created_by', select: 'username email' },
        ])
        .sort({ name: 1 });
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(
        ERROR_MESSAGES.MACHINE.ACTION.GET,
        StatusCodes.INTERNAL_SERVER_ERROR,
        'GET_MACHINES_BY_CATEGORY_ERROR',
        'Failed to retrieve machines by category',
      );
    }
  }

  /**
   * Get machine statistics
   */
  static async getMachineStatistics(): Promise<{
    totalMachines: number;
    activeMachines: number;
    inactiveMachines: number;
    pendingMachines: number;
    approvedMachines: number;
    machinesByCategory: Array<{ _id: string; count: number }>;
    recentMachines: number;
  }> {
    try {
      const totalMachines = await Machine.countDocuments();
      const activeMachines = await Machine.countDocuments({ is_active: true });
      const inactiveMachines = await Machine.countDocuments({
        is_active: false,
      });
      const pendingMachines = await Machine.countDocuments({
        is_approved: false,
      });
      const approvedMachines = await Machine.countDocuments({
        is_approved: true,
      });

      // Get machines by category
      const machinesByCategory = await Machine.aggregate([
        {
          $lookup: {
            from: 'categories',
            localField: 'category_id',
            foreignField: '_id',
            as: 'category',
          },
        },
        {
          $unwind: '$category',
        },
        {
          $group: {
            _id: '$category.name',
            count: { $sum: 1 },
          },
        },
      ]);

      // Get recent machines (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const recentMachines = await Machine.countDocuments({
        created_at: { $gte: thirtyDaysAgo },
      });

      return {
        totalMachines,
        activeMachines,
        inactiveMachines,
        pendingMachines,
        approvedMachines,
        machinesByCategory,
        recentMachines,
      };
    } catch {
      throw new ApiError(
        ERROR_MESSAGES.MACHINE.ACTION.GET,
        StatusCodes.INTERNAL_SERVER_ERROR,
        'GET_MACHINE_STATISTICS_ERROR',
        'Failed to retrieve machine statistics',
      );
    }
  }
}

export default MachineService;
