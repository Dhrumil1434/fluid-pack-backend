// services/category.service.ts
import mongoose from 'mongoose';
import { StatusCodes } from 'http-status-codes';
import { Category, ICategory } from '../../../../models/category.model';
import { ApiError } from '../../../../utils/ApiError';
import { ERROR_MESSAGES } from '../category.error.constants';

export interface CreateCategoryData {
  name: string;
  description: string;
  createdBy: string;
}

export interface UpdateCategoryData {
  name?: string;
  description?: string;
}

export interface PaginatedCategories {
  categories: ICategory[];
  total: number;
  pages: number;
}

class CategoryService {
  /**
   * Create a new category
   */
  static async create(data: CreateCategoryData): Promise<ICategory> {
    try {
      // Check for duplicate category name
      const existingCategory = await Category.findOne({
        name: { $regex: new RegExp(`^${data.name}$`, 'i') },
        deletedAt: { $exists: false },
      });

      if (existingCategory) {
        throw new ApiError(
          ERROR_MESSAGES.CATEGORY.ACTION.create,
          StatusCodes.CONFLICT,
          ERROR_MESSAGES.CATEGORY.DUPLICATE_NAME.code,
          ERROR_MESSAGES.CATEGORY.DUPLICATE_NAME.message,
        );
      }

      const categoryData = {
        name: data.name.trim(),
        description: data.description.trim(),
        createdBy: new mongoose.Types.ObjectId(data.createdBy),
      };

      const category = new Category(categoryData);
      await category.save();

      // Populate the createdBy field before returning
      await category.populate('createdBy', 'username email');

      return category;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        ERROR_MESSAGES.CATEGORY.ACTION.create,
        StatusCodes.INTERNAL_SERVER_ERROR,
        'CATEGORY_CREATION_FAILED',
        'Failed to create category',
      );
    }
  }

  /**
   * Get all categories with pagination and optional search
   */
  static async getAll(
    page = 1,
    limit = 10,
    search?: string,
  ): Promise<PaginatedCategories> {
    const skip = (page - 1) * limit;

    // Build search query
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const searchQuery: any = {
      deletedAt: { $exists: false },
    };

    if (search) {
      searchQuery.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    const [categories, total] = await Promise.all([
      Category.find(searchQuery)
        .populate('createdBy', 'username email')
        .sort({ name: 1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Category.countDocuments(searchQuery),
    ]);

    return {
      categories: categories as ICategory[],
      total,
      pages: Math.ceil(total / limit),
    };
  }

  /**
   * Get category by ID
   */
  static async getById(id: string): Promise<ICategory> {
    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ApiError(
        ERROR_MESSAGES.CATEGORY.ACTION.get,
        StatusCodes.BAD_REQUEST,
        'INVALID_ID_FORMAT',
        'Invalid category ID format',
      );
    }

    const category = await Category.findOne({
      _id: id,
      deletedAt: { $exists: false },
    }).populate('createdBy', 'username email');

    if (!category) {
      throw new ApiError(
        ERROR_MESSAGES.CATEGORY.ACTION.get,
        StatusCodes.NOT_FOUND,
        ERROR_MESSAGES.CATEGORY.NOT_FOUND.code,
        ERROR_MESSAGES.CATEGORY.NOT_FOUND.message,
      );
    }

    return category;
  }

  /**
   * Update category
   */
  static async update(
    id: string,
    data: UpdateCategoryData,
  ): Promise<ICategory> {
    try {
      // Validate ObjectId format
      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new ApiError(
          ERROR_MESSAGES.CATEGORY.ACTION.update,
          StatusCodes.BAD_REQUEST,
          'INVALID_ID_FORMAT',
          'Invalid category ID format',
        );
      }

      // Check if category exists
      const existingCategory = await Category.findOne({
        _id: id,
        deletedAt: { $exists: false },
      });

      if (!existingCategory) {
        throw new ApiError(
          ERROR_MESSAGES.CATEGORY.ACTION.update,
          StatusCodes.NOT_FOUND,
          ERROR_MESSAGES.CATEGORY.NOT_FOUND.code,
          ERROR_MESSAGES.CATEGORY.NOT_FOUND.message,
        );
      }

      // Check for duplicate name if name is being updated
      if (data.name && data.name.trim() !== existingCategory.name) {
        const duplicateCategory = await Category.findOne({
          name: { $regex: new RegExp(`^${data.name.trim()}$`, 'i') },
          _id: { $ne: id },
          deletedAt: { $exists: false },
        });

        if (duplicateCategory) {
          throw new ApiError(
            ERROR_MESSAGES.CATEGORY.ACTION.update,
            StatusCodes.CONFLICT,
            ERROR_MESSAGES.CATEGORY.DUPLICATE_NAME.code,
            ERROR_MESSAGES.CATEGORY.DUPLICATE_NAME.message,
          );
        }
      }

      // Build update data
      const updateData: Record<string, unknown> = {};
      if (data.name !== undefined) updateData['name'] = data.name.trim();
      if (data.description !== undefined)
        updateData['description'] = data.description.trim();

      const category = await Category.findByIdAndUpdate(id, updateData, {
        new: true,
        runValidators: true,
      }).populate('createdBy', 'username email');

      return category!; // We already checked it exists
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        ERROR_MESSAGES.CATEGORY.ACTION.update,
        StatusCodes.INTERNAL_SERVER_ERROR,
        'CATEGORY_UPDATE_FAILED',
        'Failed to update category',
      );
    }
  }

  /**
   * Delete category (soft delete)
   */
  static async delete(id: string): Promise<void> {
    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ApiError(
        ERROR_MESSAGES.CATEGORY.ACTION.delete,
        StatusCodes.BAD_REQUEST,
        'INVALID_ID_FORMAT',
        'Invalid category ID format',
      );
    }

    // Check if category exists and is not already deleted
    const existingCategory = await Category.findOne({
      _id: id,
      deletedAt: { $exists: false },
    });

    if (!existingCategory) {
      throw new ApiError(
        ERROR_MESSAGES.CATEGORY.ACTION.delete,
        StatusCodes.NOT_FOUND,
        ERROR_MESSAGES.CATEGORY.NOT_FOUND.code,
        ERROR_MESSAGES.CATEGORY.NOT_FOUND.message,
      );
    }

    // Check if category is being used in machines or permission configs
    const isUsedInMachines = await this.checkCategoryUsageInMachines(id);
    const isUsedInPermissions = await this.checkCategoryUsageInPermissions(id);

    if (isUsedInMachines || isUsedInPermissions) {
      throw new ApiError(
        ERROR_MESSAGES.CATEGORY.ACTION.delete,
        StatusCodes.CONFLICT,
        ERROR_MESSAGES.CATEGORY.IN_USE.code,
        ERROR_MESSAGES.CATEGORY.IN_USE.message,
      );
    }

    // Perform soft delete
    await Category.findByIdAndUpdate(id, {
      deletedAt: new Date(),
    });
  }

  /**
   * Get active categories (for dropdown/selection purposes)
   */
  static async getActiveCategories(): Promise<ICategory[]> {
    return Category.find({
      deletedAt: { $exists: false },
    })
      .select('_id name description')
      .sort({ name: 1 })
      .lean();
  }

  /**
   * Check if category exists
   */
  static async exists(id: string): Promise<boolean> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return false;
    }

    const category = await Category.findOne({
      _id: id,
      deletedAt: { $exists: false },
    }).select('_id');

    return !!category;
  }

  /**
   * Validate multiple category IDs exist
   */
  static async validateCategoryIds(categoryIds: string[]): Promise<boolean> {
    if (!categoryIds || categoryIds.length === 0) {
      return true; // Empty array is valid
    }

    // Check if all IDs are valid ObjectId format
    const invalidIds = categoryIds.filter(
      (id) => !mongoose.Types.ObjectId.isValid(id),
    );
    if (invalidIds.length > 0) {
      throw new ApiError(
        'VALIDATING_CATEGORIES',
        StatusCodes.BAD_REQUEST,
        'INVALID_CATEGORY_IDS',
        `Invalid category ID format: ${invalidIds.join(', ')}`,
      );
    }

    const existingCategories = await Category.find({
      _id: { $in: categoryIds },
      deletedAt: { $exists: false },
    }).select('_id');

    const existingIds = existingCategories.map((cat) => cat.id?.toString());
    const nonExistentIds = categoryIds.filter(
      (id) => !existingIds.includes(id),
    );

    if (nonExistentIds.length > 0) {
      throw new ApiError(
        'VALIDATING_CATEGORIES',
        StatusCodes.NOT_FOUND,
        'CATEGORIES_NOT_FOUND',
        `Categories not found: ${nonExistentIds.join(', ')}`,
      );
    }

    return true;
  }

  /**
   * Check if category is used in machines
   */
  private static async checkCategoryUsageInMachines(
    categoryId: string,
  ): Promise<boolean> {
    try {
      const { Machine } = await import('../../../../models/machine.model');
      const machineCount = await Machine.countDocuments({
        category_id: categoryId,
        deletedAt: { $exists: false },
      });
      return machineCount > 0;
    } catch {
      // If machine model doesn't exist or import fails, assume not used
      return false;
    }
  }

  /**
   * Check if category is used in permission configs
   */
  private static async checkCategoryUsageInPermissions(
    categoryId: string,
  ): Promise<boolean> {
    try {
      const { PermissionConfig } = await import(
        '../../../../models/permissionConfig.model'
      );
      const permissionCount = await PermissionConfig.countDocuments({
        categoryIds: categoryId,
        isActive: true,
      });
      return permissionCount > 0;
    } catch {
      // If permission config model doesn't exist or import fails, assume not used
      return false;
    }
  }
}

export default CategoryService;
