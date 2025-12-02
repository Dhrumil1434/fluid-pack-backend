// services/machine.service.ts
import { StatusCodes } from 'http-status-codes';
// import { Machine, IMachine } from '../models/machine.model';
// import { Category } from '../../categories/models/category.model';
// import { ApiError } from '../../../../utils/ApiError';
// import { ERROR_MESSAGES } from '../../../../constants/errorMessages';
import mongoose from 'mongoose';
import { Category } from '../../../models/category.model';
import { User } from '../../../models/user.model';

import { IMachine, Machine } from '../../../models/machine.model';
import { ApiError } from '../../../utils/ApiError';
import { ERROR_MESSAGES } from '../machine.error.constant';
import {
  sanitizeMachine,
  sanitizeMachines,
} from '../../../utils/sanitizeMachineResponse';
export interface CreateMachineData {
  name: string;
  category_id: string;
  subcategory_id?: string;
  created_by: string;
  images?: string[];
  documents?: Array<{
    name: string;
    file_path: string;
    document_type?: string;
  }>;
  party_name: string;
  location: string;
  mobile_number: string;
  dispatch_date?: Date | string;
  machine_sequence?: string;
  metadata?: Record<string, unknown>;
  is_approved?: boolean;
}

export interface UpdateMachineData {
  name?: string;
  category_id?: mongoose.Types.ObjectId;
  subcategory_id?: mongoose.Types.ObjectId;
  images?: string[];
  documents?: Array<{
    name: string;
    file_path: string;
    document_type?: string;
  }>;
  party_name?: string;
  location?: string;
  mobile_number?: string;
  dispatch_date?: Date | string | null;
  machine_sequence?: string;
  metadata?: Record<string, unknown>;
  removedDocuments?: Array<{
    _id?: string;
    name?: string;
    file_path?: string;
    document_type?: string;
  }>;
  is_approved?: boolean;
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
  has_sequence?: boolean;
  metadata_key?: string;
  metadata_value?: string;
  dispatch_date_from?: string | Date;
  dispatch_date_to?: string | Date;
  // Specific field filters for suggestion-based search
  party_name?: string;
  machine_sequence?: string;
  location?: string;
  mobile_number?: string;
  sortBy?:
    | 'createdAt'
    | 'name'
    | 'category'
    | 'dispatch_date'
    | 'party_name'
    | 'machine_sequence'
    | 'location'
    | 'mobile_number'
    | 'created_by';
  sortOrder?: 'asc' | 'desc';
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

      // Validate subcategory if provided
      if (data.subcategory_id) {
        const subcategory = await Category.findOne({
          _id: data.subcategory_id,
          deletedAt: null,
        });

        if (!subcategory) {
          throw new ApiError(
            ERROR_MESSAGES.MACHINE.ACTION.CREATE,
            StatusCodes.BAD_REQUEST,
            'SUBCATEGORY_NOT_FOUND',
            'Subcategory not found',
          );
        }

        // Verify subcategory belongs to the selected category
        const subcategoryParentId = subcategory.parent_id
          ? subcategory.parent_id.toString()
          : null;
        const categoryIdStr = (
          category._id as mongoose.Types.ObjectId
        ).toString();

        if (subcategoryParentId !== categoryIdStr) {
          throw new ApiError(
            ERROR_MESSAGES.MACHINE.ACTION.CREATE,
            StatusCodes.BAD_REQUEST,
            'INVALID_SUBCATEGORY',
            'Subcategory does not belong to the selected category',
          );
        }
      }

      // Check if machine with same name already exists in the same category
      const nameHash = data.name.trim().toLowerCase();
      const existingMachine = await Machine.findOne({
        nameHash: nameHash,
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

      // Check for duplicate sequence number if provided
      if (
        data.machine_sequence !== undefined &&
        data.machine_sequence !== null &&
        data.machine_sequence.trim() !== ''
      ) {
        const duplicateSequenceMachine = await Machine.findOne({
          machine_sequence: data.machine_sequence.trim(),
          deletedAt: null,
        });

        if (duplicateSequenceMachine) {
          throw new ApiError(
            ERROR_MESSAGES.MACHINE.ACTION.CREATE,
            StatusCodes.CONFLICT,
            'DUPLICATE_SEQUENCE',
            `Machine sequence "${data.machine_sequence}" is already assigned to another machine`,
          );
        }
      }

      // Parse dispatch_date if provided as string
      let dispatchDate: Date | null = null;
      if (data.dispatch_date) {
        if (
          typeof data.dispatch_date === 'string' &&
          data.dispatch_date.trim() !== ''
        ) {
          const parsedDate = new Date(data.dispatch_date);
          // Check if date is valid
          if (!isNaN(parsedDate.getTime())) {
            dispatchDate = parsedDate;
          }
        } else if (data.dispatch_date instanceof Date) {
          dispatchDate = data.dispatch_date;
        }
      }

      const machine = new Machine({
        name: data.name.trim(),
        nameHash: nameHash,
        category_id: data.category_id,
        subcategory_id: data.subcategory_id || null,
        created_by: data.created_by,
        images: data.images || [],
        documents: data.documents || [],
        party_name: data.party_name.trim(),
        location: data.location.trim(),
        mobile_number: data.mobile_number.trim(),
        dispatch_date: dispatchDate,
        machine_sequence: data.machine_sequence || null,
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

      // Build $and array for complex queries
      const andConditions: Array<Record<string, unknown>> = [];

      // Handle search filter - search across multiple fields including created_by
      if (filters.search) {
        const searchRegex = { $regex: filters.search, $options: 'i' };
        // First, find users matching the search term for created_by
        const matchingUsers = await User.find({
          $or: [{ username: searchRegex }, { email: searchRegex }],
        })
          .select('_id')
          .lean();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const matchingUserIds = matchingUsers.map((u: any) => u._id);

        const searchOrConditions: Array<Record<string, unknown>> = [
          { name: searchRegex },
          { party_name: searchRegex },
          { location: searchRegex },
          { mobile_number: searchRegex },
          { machine_sequence: searchRegex },
        ];

        // If search term looks like an ObjectId (24 hex characters), also search by _id
        if (/^[0-9a-fA-F]{24}$/.test(filters.search.trim())) {
          try {
            searchOrConditions.push({
              _id: new mongoose.Types.ObjectId(filters.search.trim()),
            });
          } catch {
            // Invalid ObjectId format, skip
          }
        }

        // Add created_by search if matching users found
        if (matchingUserIds.length > 0) {
          searchOrConditions.push({ created_by: { $in: matchingUserIds } });
        }

        andConditions.push({
          $or: searchOrConditions,
        });
      }

      // Handle has_sequence filter
      if (typeof filters.has_sequence === 'boolean') {
        if (filters.has_sequence) {
          query['machine_sequence'] = {
            $exists: true,
            $ne: null,
            $nin: [''],
          };
        } else {
          andConditions.push({
            $or: [
              { machine_sequence: { $exists: false } },
              { machine_sequence: null },
              { machine_sequence: '' },
            ],
          });
        }
      }

      // Combine $and conditions if any exist
      if (andConditions.length > 0) {
        if (andConditions.length === 1) {
          Object.assign(query, andConditions[0]);
        } else {
          query['$and'] = andConditions;
        }
      }

      // Handle metadata key-value search
      if (filters.metadata_key) {
        const metadataKey = filters.metadata_key.trim();
        if (filters.metadata_value) {
          // Search for specific key-value pair
          const metadataValue = filters.metadata_value.trim();
          query[`metadata.${metadataKey}`] = {
            $regex: metadataValue,
            $options: 'i',
          };
        } else {
          // Just check if key exists
          query[`metadata.${metadataKey}`] = { $exists: true };
        }
      }

      // Handle dispatch_date range filter
      if (filters.dispatch_date_from || filters.dispatch_date_to) {
        const dateQuery: { $gte?: Date; $lte?: Date } = {};
        if (filters.dispatch_date_from) {
          dateQuery.$gte = new Date(filters.dispatch_date_from);
        }
        if (filters.dispatch_date_to) {
          const toDate = new Date(filters.dispatch_date_to);
          toDate.setHours(23, 59, 59, 999); // Include entire end date
          dateQuery.$lte = toDate;
        }
        query['dispatch_date'] = dateQuery;
      }

      // Handle specific field filters for suggestion-based search
      if (filters.party_name) {
        query['party_name'] = { $regex: filters.party_name, $options: 'i' };
      }

      if (filters.machine_sequence) {
        query['machine_sequence'] = {
          $regex: filters.machine_sequence,
          $options: 'i',
        };
      }

      if (filters.location) {
        query['location'] = { $regex: filters.location, $options: 'i' };
      }

      if (filters.mobile_number) {
        query['mobile_number'] = {
          $regex: filters.mobile_number,
          $options: 'i',
        };
      }

      // Determine sort order
      const sortOrder = filters.sortOrder === 'asc' ? 1 : -1;
      let sortField: Record<string, 1 | -1> = { createdAt: -1 }; // Default: latest first

      if (filters.sortBy) {
        switch (filters.sortBy) {
          case 'name':
            sortField = { name: sortOrder };
            break;
          case 'category':
            // We'll need to sort by populated category name, but MongoDB can't sort by populated fields directly
            // So we'll sort by category_id and handle category name sorting in a different way
            sortField = { category_id: sortOrder };
            break;
          case 'dispatch_date':
            sortField = { dispatch_date: sortOrder };
            break;
          case 'party_name':
            sortField = { party_name: sortOrder };
            break;
          case 'machine_sequence':
            sortField = { machine_sequence: sortOrder };
            break;
          case 'location':
            sortField = { location: sortOrder };
            break;
          case 'mobile_number':
            sortField = { mobile_number: sortOrder };
            break;
          case 'created_by':
            sortField = { created_by: sortOrder };
            break;
          case 'createdAt':
          default:
            sortField = { createdAt: sortOrder };
            break;
        }
      }

      const [machines, total] = await Promise.all([
        Machine.find(query)
          .populate([
            { path: 'category_id', select: 'name description slug' },
            { path: 'subcategory_id', select: 'name description slug' },
            { path: 'created_by', select: 'username email' },
            { path: 'updatedBy', select: 'username email' },
          ])
          .sort(sortField)
          .skip(skip)
          .limit(limit)
          .lean(), // Use lean() to get plain objects
        Machine.countDocuments(query),
      ]);

      // Sanitize machines to handle null populated fields
      const sanitizedMachines = sanitizeMachines(machines);

      return {
        machines: sanitizedMachines as IMachine[],
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
      })
        .populate([
          { path: 'category_id', select: 'name description slug' },
          { path: 'subcategory_id', select: 'name description slug' },
          { path: 'created_by', select: 'username email' },
          { path: 'updatedBy', select: 'username email' },
        ])
        .lean(); // Use lean() to get plain object

      if (!machine) {
        throw new ApiError(
          ERROR_MESSAGES.MACHINE.ACTION.GET,
          StatusCodes.NOT_FOUND,
          ERROR_MESSAGES.MACHINE.NOT_FOUND.code,
          ERROR_MESSAGES.MACHINE.NOT_FOUND.message,
        );
      }

      // Sanitize the response to handle null populated fields
      return sanitizeMachine(machine) as IMachine;
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

      // Check for duplicate sequence number
      if (
        data.machine_sequence !== undefined &&
        data.machine_sequence !== null &&
        data.machine_sequence.trim() !== ''
      ) {
        const duplicateSequenceMachine = await Machine.findOne({
          machine_sequence: data.machine_sequence.trim(),
          _id: { $ne: id },
          deletedAt: null,
        });

        if (duplicateSequenceMachine) {
          throw new ApiError(
            ERROR_MESSAGES.MACHINE.ACTION.UPDATE,
            StatusCodes.CONFLICT,
            'DUPLICATE_SEQUENCE',
            `Machine sequence "${data.machine_sequence}" is already assigned to another machine`,
          );
        }
      }

      const updateData: Partial<UpdateMachineData> = { ...data };
      if (data.name) {
        updateData.name = data.name.trim();
      }
      if (data.party_name) {
        updateData.party_name = data.party_name.trim();
      }
      if (data.location) {
        updateData.location = data.location.trim();
      }
      if (data.mobile_number) {
        updateData.mobile_number = data.mobile_number.trim();
      }
      // Handle dispatch_date
      if (data.dispatch_date !== undefined) {
        if (data.dispatch_date === null || data.dispatch_date === '') {
          updateData.dispatch_date = null;
        } else if (typeof data.dispatch_date === 'string') {
          updateData.dispatch_date = new Date(data.dispatch_date);
        } else if (data.dispatch_date instanceof Date) {
          updateData.dispatch_date = data.dispatch_date;
        }
      }
      // Handle machine_sequence: empty string means remove sequence
      if (data.machine_sequence !== undefined) {
        updateData.machine_sequence =
          data.machine_sequence.trim() === ''
            ? ''
            : data.machine_sequence.trim();
      }

      // Handle document removal
      if (data.removedDocuments && data.removedDocuments.length > 0) {
        const currentDocuments = existingMachine.documents || [];
        const removedFilePaths = data.removedDocuments
          .map((doc) => doc.file_path)
          .filter(Boolean);

        // Filter out removed documents from current documents
        const updatedDocuments = currentDocuments.filter(
          (doc) => !removedFilePaths.includes(doc.file_path),
        );

        updateData.documents = updatedDocuments;

        // Remove the removedDocuments field from updateData as it's not a database field
        delete updateData.removedDocuments;
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
