// services/so.service.ts
import { StatusCodes } from 'http-status-codes';
import mongoose from 'mongoose';
import { Category } from '../../../models/category.model';
import { User } from '../../../models/user.model';
import { ISO, SO } from '../../../models/so.model';
import { ApiError } from '../../../utils/ApiError';
import { ERROR_MESSAGES } from '../so.error.constant';

export interface CreateSOData {
  name: string;
  category_id: string;
  subcategory_id?: string;
  party_name: string;
  mobile_number: string;
  documents?: Array<{
    name: string;
    file_path: string;
    document_type?: string;
  }>;
  description?: string;
  created_by: string;
}

export interface UpdateSOData {
  name?: string;
  category_id?: string;
  subcategory_id?: string;
  party_name?: string;
  mobile_number?: string;
  documents?: Array<{
    name: string;
    file_path: string;
    document_type?: string;
  }>;
  description?: string;
  is_active?: boolean;
  updatedBy?: string;
  removedDocuments?: Array<{
    _id?: string;
    name?: string;
    file_path?: string;
    document_type?: string;
  }>;
}

export interface SOListResult {
  sos: ISO[];
  total: number;
  pages: number;
}

export interface SOFilters {
  name?: string;
  category_id?: string;
  subcategory_id?: string;
  party_name?: string;
  is_active?: boolean;
  created_by?: string;
  search?: string;
  sortBy?: 'createdAt' | 'name' | 'category' | 'party_name' | 'created_by';
  sortOrder?: 'asc' | 'desc';
}

class SOService {
  /**
   * Create a new SO
   */
  static async create(data: CreateSOData): Promise<ISO> {
    try {
      // Verify category exists and is active
      const category = await Category.findOne({
        _id: data.category_id,
        deletedAt: null,
      });

      if (!category) {
        throw new ApiError(
          ERROR_MESSAGES.SO.ACTION.CREATE,
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
            ERROR_MESSAGES.SO.ACTION.CREATE,
            StatusCodes.BAD_REQUEST,
            ERROR_MESSAGES.SO.INVALID_SUBCATEGORY.code,
            ERROR_MESSAGES.SO.INVALID_SUBCATEGORY.message,
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
            ERROR_MESSAGES.SO.ACTION.CREATE,
            StatusCodes.BAD_REQUEST,
            ERROR_MESSAGES.SO.INVALID_SUBCATEGORY.code,
            ERROR_MESSAGES.SO.INVALID_SUBCATEGORY.message,
          );
        }
      }

      // Validate documents array length
      if (data.documents && data.documents.length > 10) {
        throw new ApiError(
          ERROR_MESSAGES.SO.ACTION.CREATE,
          StatusCodes.BAD_REQUEST,
          'INVALID_DOCUMENTS',
          'Maximum 10 documents allowed',
        );
      }

      // Create SO document
      const so = new SO({
        name: data.name.trim(),
        category_id: data.category_id,
        subcategory_id: data.subcategory_id || null,
        party_name: data.party_name.trim(),
        mobile_number: data.mobile_number.trim(),
        documents: data.documents || [],
        description: data.description?.trim() || '',
        created_by: data.created_by,
        is_active: true,
      });

      await so.save();

      // Populate category, subcategory, and creator information
      await so.populate([
        { path: 'category_id', select: 'name description' },
        { path: 'subcategory_id', select: 'name description' },
        { path: 'created_by', select: 'username email' },
      ]);

      return so;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(
        ERROR_MESSAGES.SO.ACTION.CREATE,
        StatusCodes.INTERNAL_SERVER_ERROR,
        ERROR_MESSAGES.SO.CREATE_ERROR.code,
        ERROR_MESSAGES.SO.CREATE_ERROR.message,
      );
    }
  }

  /**
   * Get all SOs with pagination and filters
   */
  static async getAll(
    page: number,
    limit: number,
    filters: SOFilters = {},
  ): Promise<SOListResult> {
    try {
      const skip = (page - 1) * limit;
      const query: Record<string, unknown> = { deletedAt: null };

      // Apply filters
      if (filters.category_id) {
        query['category_id'] = filters.category_id;
      }

      if (filters.subcategory_id) {
        query['subcategory_id'] = filters.subcategory_id;
      }

      if (typeof filters.is_active === 'boolean') {
        query['is_active'] = filters.is_active;
      }

      if (filters.created_by) {
        query['created_by'] = filters.created_by;
      }

      // Build $and array for complex queries
      const andConditions: Array<Record<string, unknown>> = [];

      // Handle search filter
      if (filters.search) {
        const searchRegex = { $regex: filters.search, $options: 'i' };
        // Find users matching the search term for created_by
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
          { mobile_number: searchRegex },
          { description: searchRegex },
        ];

        // If search term looks like an ObjectId, also search by _id
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

      // Handle specific field filters
      if (filters.name) {
        query['name'] = { $regex: filters.name, $options: 'i' };
      }

      if (filters.party_name) {
        query['party_name'] = { $regex: filters.party_name, $options: 'i' };
      }

      // Combine $and conditions if any exist
      if (andConditions.length > 0) {
        if (andConditions.length === 1) {
          Object.assign(query, andConditions[0]);
        } else {
          query['$and'] = andConditions;
        }
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
            sortField = { category_id: sortOrder };
            break;
          case 'party_name':
            sortField = { party_name: sortOrder };
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

      const [sos, total] = await Promise.all([
        SO.find(query)
          .populate([
            { path: 'category_id', select: 'name description' },
            { path: 'subcategory_id', select: 'name description' },
            { path: 'created_by', select: 'username email' },
            { path: 'updatedBy', select: 'username email' },
          ])
          .sort(sortField)
          .skip(skip)
          .limit(limit)
          .lean(),
        SO.countDocuments(query),
      ]);

      const pages = Math.ceil(total / limit);

      return {
        sos: sos as ISO[],
        total,
        pages,
      };
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(
        ERROR_MESSAGES.SO.ACTION.LIST,
        StatusCodes.INTERNAL_SERVER_ERROR,
        ERROR_MESSAGES.SO.GET_ALL_ERROR.code,
        ERROR_MESSAGES.SO.GET_ALL_ERROR.message,
      );
    }
  }

  /**
   * Get SO by ID
   */
  static async getById(id: string): Promise<ISO> {
    try {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new ApiError(
          ERROR_MESSAGES.SO.ACTION.GET,
          StatusCodes.BAD_REQUEST,
          ERROR_MESSAGES.SO.INVALID_ID.code,
          ERROR_MESSAGES.SO.INVALID_ID.message,
        );
      }

      const so = await SO.findOne({
        _id: id,
        deletedAt: null,
      }).populate([
        { path: 'category_id', select: 'name description' },
        { path: 'subcategory_id', select: 'name description' },
        { path: 'created_by', select: 'username email' },
        { path: 'updatedBy', select: 'username email' },
      ]);

      if (!so) {
        throw new ApiError(
          ERROR_MESSAGES.SO.ACTION.GET,
          StatusCodes.NOT_FOUND,
          ERROR_MESSAGES.SO.NOT_FOUND.code,
          ERROR_MESSAGES.SO.NOT_FOUND.message,
        );
      }

      return so;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(
        ERROR_MESSAGES.SO.ACTION.GET,
        StatusCodes.INTERNAL_SERVER_ERROR,
        ERROR_MESSAGES.SO.GET_ERROR.code,
        ERROR_MESSAGES.SO.GET_ERROR.message,
      );
    }
  }

  /**
   * Update SO
   */
  static async update(id: string, data: UpdateSOData): Promise<ISO> {
    try {
      const so = await SO.findOne({
        _id: id,
        deletedAt: null,
      });

      if (!so) {
        throw new ApiError(
          ERROR_MESSAGES.SO.ACTION.UPDATE,
          StatusCodes.NOT_FOUND,
          ERROR_MESSAGES.SO.NOT_FOUND.code,
          ERROR_MESSAGES.SO.NOT_FOUND.message,
        );
      }

      // Validate category if being updated
      if (data.category_id) {
        const category = await Category.findOne({
          _id: data.category_id,
          deletedAt: null,
        });

        if (!category) {
          throw new ApiError(
            ERROR_MESSAGES.SO.ACTION.UPDATE,
            StatusCodes.BAD_REQUEST,
            ERROR_MESSAGES.CATEGORY.NOT_FOUND.code,
            ERROR_MESSAGES.CATEGORY.NOT_FOUND.message,
          );
        }

        so.category_id = data.category_id;

        // If subcategory is provided, validate it
        if (data.subcategory_id) {
          const subcategory = await Category.findOne({
            _id: data.subcategory_id,
            deletedAt: null,
          });

          if (!subcategory) {
            throw new ApiError(
              ERROR_MESSAGES.SO.ACTION.UPDATE,
              StatusCodes.BAD_REQUEST,
              ERROR_MESSAGES.SO.INVALID_SUBCATEGORY.code,
              ERROR_MESSAGES.SO.INVALID_SUBCATEGORY.message,
            );
          }

          const subcategoryParentId = subcategory.parent_id
            ? subcategory.parent_id.toString()
            : null;
          const categoryIdStr = (
            category._id as mongoose.Types.ObjectId
          ).toString();

          if (subcategoryParentId !== categoryIdStr) {
            throw new ApiError(
              ERROR_MESSAGES.SO.ACTION.UPDATE,
              StatusCodes.BAD_REQUEST,
              ERROR_MESSAGES.SO.INVALID_SUBCATEGORY.code,
              ERROR_MESSAGES.SO.INVALID_SUBCATEGORY.message,
            );
          }

          so.subcategory_id = data.subcategory_id;
        } else if (data.subcategory_id === null) {
          so.subcategory_id = null;
        }
      } else if (data.subcategory_id !== undefined) {
        // If only subcategory is being updated
        if (data.subcategory_id) {
          const subcategory = await Category.findOne({
            _id: data.subcategory_id,
            deletedAt: null,
          });

          if (!subcategory) {
            throw new ApiError(
              ERROR_MESSAGES.SO.ACTION.UPDATE,
              StatusCodes.BAD_REQUEST,
              ERROR_MESSAGES.SO.INVALID_SUBCATEGORY.code,
              ERROR_MESSAGES.SO.INVALID_SUBCATEGORY.message,
            );
          }

          const categoryIdStr = (
            so.category_id as mongoose.Types.ObjectId
          ).toString();
          const subcategoryParentId = subcategory.parent_id
            ? subcategory.parent_id.toString()
            : null;

          if (subcategoryParentId !== categoryIdStr) {
            throw new ApiError(
              ERROR_MESSAGES.SO.ACTION.UPDATE,
              StatusCodes.BAD_REQUEST,
              ERROR_MESSAGES.SO.INVALID_SUBCATEGORY.code,
              ERROR_MESSAGES.SO.INVALID_SUBCATEGORY.message,
            );
          }

          so.subcategory_id = data.subcategory_id;
        } else {
          so.subcategory_id = null;
        }
      }

      // Update other fields
      if (data.name !== undefined) {
        so.name = data.name.trim();
      }

      if (data.party_name !== undefined) {
        so.party_name = data.party_name.trim();
      }

      if (data.mobile_number !== undefined) {
        so.mobile_number = data.mobile_number.trim();
      }

      if (data.description !== undefined) {
        so.description = data.description.trim();
      }

      if (typeof data.is_active === 'boolean') {
        so.is_active = data.is_active;
      }

      // Handle documents update
      if (data.documents !== undefined) {
        if (data.documents.length > 10) {
          throw new ApiError(
            ERROR_MESSAGES.SO.ACTION.UPDATE,
            StatusCodes.BAD_REQUEST,
            'INVALID_DOCUMENTS',
            'Maximum 10 documents allowed',
          );
        }
        so.documents = data.documents;
      }

      // Handle removed documents
      if (data.removedDocuments && data.removedDocuments.length > 0) {
        const removedPaths = data.removedDocuments.map((doc) => doc.file_path);
        so.documents = so.documents.filter(
          (doc) => !removedPaths.includes(doc.file_path),
        );
      }

      // Set updatedBy if provided
      if (data.updatedBy) {
        so.updatedBy = data.updatedBy;
      }

      await so.save();

      // Populate references
      await so.populate([
        { path: 'category_id', select: 'name description' },
        { path: 'subcategory_id', select: 'name description' },
        { path: 'created_by', select: 'username email' },
        { path: 'updatedBy', select: 'username email' },
      ]);

      return so;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(
        ERROR_MESSAGES.SO.ACTION.UPDATE,
        StatusCodes.INTERNAL_SERVER_ERROR,
        ERROR_MESSAGES.SO.UPDATE_ERROR.code,
        ERROR_MESSAGES.SO.UPDATE_ERROR.message,
      );
    }
  }

  /**
   * Soft delete SO
   */
  static async softDelete(id: string, deletedBy: string): Promise<void> {
    try {
      const so = await SO.findOne({
        _id: id,
        deletedAt: null,
      });

      if (!so) {
        throw new ApiError(
          ERROR_MESSAGES.SO.ACTION.DELETE,
          StatusCodes.NOT_FOUND,
          ERROR_MESSAGES.SO.NOT_FOUND.code,
          ERROR_MESSAGES.SO.NOT_FOUND.message,
        );
      }

      await so['softDelete'](deletedBy);
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(
        ERROR_MESSAGES.SO.ACTION.DELETE,
        StatusCodes.INTERNAL_SERVER_ERROR,
        ERROR_MESSAGES.SO.DELETE_ERROR.code,
        ERROR_MESSAGES.SO.DELETE_ERROR.message,
      );
    }
  }

  /**
   * Restore soft deleted SO
   */
  static async restore(id: string, restoredBy: string): Promise<ISO> {
    try {
      const so = await SO.findOne({
        _id: id,
        deletedAt: { $ne: null },
      });

      if (!so) {
        throw new ApiError(
          ERROR_MESSAGES.SO.ACTION.UPDATE,
          StatusCodes.NOT_FOUND,
          ERROR_MESSAGES.SO.NOT_FOUND.code,
          ERROR_MESSAGES.SO.NOT_FOUND.message,
        );
      }

      await so['restore'](restoredBy);

      // Populate references
      await so.populate([
        { path: 'category_id', select: 'name description' },
        { path: 'subcategory_id', select: 'name description' },
        { path: 'created_by', select: 'username email' },
        { path: 'updatedBy', select: 'username email' },
      ]);

      return so;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(
        ERROR_MESSAGES.SO.ACTION.UPDATE,
        StatusCodes.INTERNAL_SERVER_ERROR,
        ERROR_MESSAGES.SO.UPDATE_ERROR.code,
        ERROR_MESSAGES.SO.UPDATE_ERROR.message,
      );
    }
  }

  /**
   * Activate SO
   */
  static async activate(id: string, updatedBy: string): Promise<ISO> {
    try {
      const so = await SO.findOne({
        _id: id,
        deletedAt: null,
      });

      if (!so) {
        throw new ApiError(
          ERROR_MESSAGES.SO.ACTION.ACTIVATE,
          StatusCodes.NOT_FOUND,
          ERROR_MESSAGES.SO.NOT_FOUND.code,
          ERROR_MESSAGES.SO.NOT_FOUND.message,
        );
      }

      so.is_active = true;
      so.updatedBy = updatedBy;
      await so.save();

      // Populate references
      await so.populate([
        { path: 'category_id', select: 'name description' },
        { path: 'subcategory_id', select: 'name description' },
        { path: 'created_by', select: 'username email' },
        { path: 'updatedBy', select: 'username email' },
      ]);

      return so;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(
        ERROR_MESSAGES.SO.ACTION.ACTIVATE,
        StatusCodes.INTERNAL_SERVER_ERROR,
        ERROR_MESSAGES.SO.ACTIVATE_ERROR.code,
        ERROR_MESSAGES.SO.ACTIVATE_ERROR.message,
      );
    }
  }

  /**
   * Deactivate SO
   */
  static async deactivate(id: string, updatedBy: string): Promise<ISO> {
    try {
      const so = await SO.findOne({
        _id: id,
        deletedAt: null,
      });

      if (!so) {
        throw new ApiError(
          ERROR_MESSAGES.SO.ACTION.DEACTIVATE,
          StatusCodes.NOT_FOUND,
          ERROR_MESSAGES.SO.NOT_FOUND.code,
          ERROR_MESSAGES.SO.NOT_FOUND.message,
        );
      }

      so.is_active = false;
      so.updatedBy = updatedBy;
      await so.save();

      // Populate references
      await so.populate([
        { path: 'category_id', select: 'name description' },
        { path: 'subcategory_id', select: 'name description' },
        { path: 'created_by', select: 'username email' },
        { path: 'updatedBy', select: 'username email' },
      ]);

      return so;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(
        ERROR_MESSAGES.SO.ACTION.DEACTIVATE,
        StatusCodes.INTERNAL_SERVER_ERROR,
        ERROR_MESSAGES.SO.DEACTIVATE_ERROR.code,
        ERROR_MESSAGES.SO.DEACTIVATE_ERROR.message,
      );
    }
  }

  /**
   * Get active SOs only (for dropdown)
   */
  static async getActiveSOs(): Promise<ISO[]> {
    try {
      const sos = await SO.find({
        is_active: true,
        deletedAt: null,
      })
        .populate([
          { path: 'category_id', select: 'name description' },
          { path: 'subcategory_id', select: 'name description' },
        ])
        .sort({ name: 1 })
        .limit(1000) // Limit to prevent performance issues
        .lean();

      return sos as ISO[];
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(
        ERROR_MESSAGES.SO.ACTION.LIST,
        StatusCodes.INTERNAL_SERVER_ERROR,
        ERROR_MESSAGES.SO.GET_ALL_ERROR.code,
        ERROR_MESSAGES.SO.GET_ALL_ERROR.message,
      );
    }
  }
}

export default SOService;
