import mongoose from 'mongoose';
import { Category, ICategory } from '../../../models/category.model';
import { ApiError } from '../../../utils/ApiError';
import { StatusCodes } from 'http-status-codes';
import { ERROR_MESSAGES } from '../category.error.constants';

/**
 * Interface for creating a category
 */
export interface CreateCategoryData {
  name: string;
  slug?: string;
  description?: string;
  parentId?: string;
  sortOrder?: number;
  imageUrl?: string;
  seoTitle?: string;
  seoDescription?: string;
  createdBy: string;
}

/**
 * Interface for updating a category
 */
export interface UpdateCategoryData {
  name?: string;
  slug?: string;
  description?: string;
  parentId?: string;
  sortOrder?: number;
  imageUrl?: string;
  seoTitle?: string;
  seoDescription?: string;
  isActive?: boolean;
  updatedBy: string;
}

/**
 * Interface for category tree node
 */
export interface CategoryTreeNode {
  _id: string;
  name: string;
  slug: string;
  description?: string | undefined;
  level: number;
  sortOrder: number;
  isActive: boolean;
  imageUrl?: string | undefined;
  seoTitle?: string | undefined;
  seoDescription?: string | undefined;
  parentId?: string | undefined;
  children?: CategoryTreeNode[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * CategoryService handles all category-related operations
 */
class CategoryService {
  /**
   * Create a new category
   */
  static async createCategory(data: CreateCategoryData): Promise<ICategory> {
    try {
      const {
        name,
        slug,
        description,
        parentId,
        sortOrder = 0,
        imageUrl,
        seoTitle,
        seoDescription,
        createdBy,
      } = data;

      // Validate parent ID if provided
      if (parentId) {
        if (!mongoose.Types.ObjectId.isValid(parentId)) {
          throw new ApiError(
            ERROR_MESSAGES.CATEGORY.ACTION.CREATE,
            StatusCodes.BAD_REQUEST,
            ERROR_MESSAGES.CATEGORY.INVALID_PARENT.code,
            ERROR_MESSAGES.CATEGORY.INVALID_PARENT.message,
          );
        }

        const parentCategory = await Category.findById(parentId);
        if (!parentCategory || !parentCategory.is_active) {
          throw new ApiError(
            ERROR_MESSAGES.CATEGORY.ACTION.CREATE,
            StatusCodes.BAD_REQUEST,
            ERROR_MESSAGES.CATEGORY.INVALID_PARENT.code,
            ERROR_MESSAGES.CATEGORY.INVALID_PARENT.message,
          );
        }

        // Check hierarchy level
        if (parentCategory.level >= 3) {
          throw new ApiError(
            ERROR_MESSAGES.CATEGORY.ACTION.CREATE,
            StatusCodes.BAD_REQUEST,
            ERROR_MESSAGES.CATEGORY.MAX_HIERARCHY_LEVEL.code,
            ERROR_MESSAGES.CATEGORY.MAX_HIERARCHY_LEVEL.message,
          );
        }
      }

      // Generate slug if not provided
      let generatedSlug = slug;
      if (!generatedSlug) {
        generatedSlug = name
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-')
          .trim();
      }

      // Check for duplicate slug
      const existingCategory = await Category.findOne({ slug: generatedSlug });
      if (existingCategory) {
        throw new ApiError(
          ERROR_MESSAGES.CATEGORY.ACTION.CREATE,
          StatusCodes.CONFLICT,
          ERROR_MESSAGES.CATEGORY.DUPLICATE_SLUG.code,
          ERROR_MESSAGES.CATEGORY.DUPLICATE_SLUG.message,
        );
      }

      // Determine level based on parent
      const level = parentId
        ? (await Category.findById(parentId))!.level + 1
        : 0;

      // Create category
      const category = new Category({
        name,
        slug: generatedSlug,
        description,
        parent_id: parentId || null,
        level,
        sort_order: sortOrder,
        image_url: imageUrl,
        seo_title: seoTitle,
        seo_description: seoDescription,
        created_by: createdBy,
        is_active: true,
      });

      await category.save();
      return category;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        ERROR_MESSAGES.CATEGORY.ACTION.CREATE,
        StatusCodes.INTERNAL_SERVER_ERROR,
        ERROR_MESSAGES.CATEGORY.CREATE_ERROR.code,
        ERROR_MESSAGES.CATEGORY.CREATE_ERROR.message,
      );
    }
  }

  /**
   * Get category by ID
   */
  static async getCategoryById(categoryId: string): Promise<ICategory> {
    try {
      if (!mongoose.Types.ObjectId.isValid(categoryId)) {
        throw new ApiError(
          ERROR_MESSAGES.CATEGORY.ACTION.GET,
          StatusCodes.BAD_REQUEST,
          ERROR_MESSAGES.CATEGORY.INVALID_ID.code,
          ERROR_MESSAGES.CATEGORY.INVALID_ID.message,
        );
      }

      const category = await Category.findById(categoryId)
        .populate('parent_id', 'name slug level')
        .populate('created_by', 'username email')
        .populate('updated_by', 'username email');

      if (!category || category.deleted_at) {
        throw new ApiError(
          ERROR_MESSAGES.CATEGORY.ACTION.GET,
          StatusCodes.NOT_FOUND,
          ERROR_MESSAGES.CATEGORY.NOT_FOUND.code,
          ERROR_MESSAGES.CATEGORY.NOT_FOUND.message,
        );
      }

      return category;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        ERROR_MESSAGES.CATEGORY.ACTION.GET,
        StatusCodes.INTERNAL_SERVER_ERROR,
        ERROR_MESSAGES.CATEGORY.GET_ERROR.code,
        ERROR_MESSAGES.CATEGORY.GET_ERROR.message,
      );
    }
  }

  /**
   * Get all categories with optional filtering
   */
  static async getAllCategories(
    options: {
      includeInactive?: boolean;
      level?: number | undefined;
      parentId?: string | undefined;
    } = {},
  ): Promise<ICategory[]> {
    try {
      const { includeInactive = false, level, parentId } = options;

      const query: Record<string, unknown> = { deleted_at: null };

      if (!includeInactive) {
        query['is_active'] = true;
      }

      if (level !== undefined) {
        query['level'] = level;
      }

      if (parentId !== undefined) {
        query['parent_id'] = parentId || null;
      }

      const categories = await Category.find(query)
        .populate('parent_id', 'name slug level')
        .sort({ level: 1, sort_order: 1, name: 1 });

      return categories;
    } catch (error) {
      console.error('Error in getAllCategories:', error);
      throw new ApiError(
        ERROR_MESSAGES.CATEGORY.ACTION.LIST,
        StatusCodes.INTERNAL_SERVER_ERROR,
        ERROR_MESSAGES.CATEGORY.GET_ALL_ERROR.code,
        ERROR_MESSAGES.CATEGORY.GET_ALL_ERROR.message,
      );
    }
  }

  /**
   * Get category tree structure
   */
  static async getCategoryTree(): Promise<CategoryTreeNode[]> {
    try {
      const categories = await Category.find({
        is_active: true,
        deleted_at: null,
      })
        .populate('parent_id', 'name slug')
        .populate('created_by', 'username email')
        .sort({ level: 1, sort_order: 1, name: 1 });

      return this.buildCategoryTree(categories);
    } catch {
      throw new ApiError(
        ERROR_MESSAGES.CATEGORY.ACTION.TREE,
        StatusCodes.INTERNAL_SERVER_ERROR,
        ERROR_MESSAGES.CATEGORY.TREE_ERROR.code,
        ERROR_MESSAGES.CATEGORY.TREE_ERROR.message,
      );
    }
  }

  /**
   * Update category
   */
  static async updateCategory(
    categoryId: string,
    data: UpdateCategoryData,
  ): Promise<ICategory> {
    try {
      if (!mongoose.Types.ObjectId.isValid(categoryId)) {
        throw new ApiError(
          ERROR_MESSAGES.CATEGORY.ACTION.UPDATE,
          StatusCodes.BAD_REQUEST,
          ERROR_MESSAGES.CATEGORY.INVALID_ID.code,
          ERROR_MESSAGES.CATEGORY.INVALID_ID.message,
        );
      }

      const category = await Category.findById(categoryId);
      if (!category || category.deleted_at) {
        throw new ApiError(
          ERROR_MESSAGES.CATEGORY.ACTION.UPDATE,
          StatusCodes.NOT_FOUND,
          ERROR_MESSAGES.CATEGORY.NOT_FOUND.code,
          ERROR_MESSAGES.CATEGORY.NOT_FOUND.message,
        );
      }

      // Validate parent ID if provided
      if (data.parentId !== undefined) {
        if (data.parentId) {
          if (!mongoose.Types.ObjectId.isValid(data.parentId)) {
            throw new ApiError(
              ERROR_MESSAGES.CATEGORY.ACTION.UPDATE,
              StatusCodes.BAD_REQUEST,
              ERROR_MESSAGES.CATEGORY.INVALID_PARENT.code,
              ERROR_MESSAGES.CATEGORY.INVALID_PARENT.message,
            );
          }

          // Check for circular reference
          const isValidHierarchy = await Category.validateHierarchy(
            categoryId,
            data.parentId,
          );
          if (!isValidHierarchy) {
            throw new ApiError(
              ERROR_MESSAGES.CATEGORY.ACTION.UPDATE,
              StatusCodes.BAD_REQUEST,
              ERROR_MESSAGES.CATEGORY.CIRCULAR_REFERENCE.code,
              ERROR_MESSAGES.CATEGORY.CIRCULAR_REFERENCE.message,
            );
          }

          const parentCategory = await Category.findById(data.parentId);
          if (!parentCategory || !parentCategory.is_active) {
            throw new ApiError(
              ERROR_MESSAGES.CATEGORY.ACTION.UPDATE,
              StatusCodes.BAD_REQUEST,
              ERROR_MESSAGES.CATEGORY.INVALID_PARENT.code,
              ERROR_MESSAGES.CATEGORY.INVALID_PARENT.message,
            );
          }

          // Check hierarchy level
          if (parentCategory.level >= 3) {
            throw new ApiError(
              ERROR_MESSAGES.CATEGORY.ACTION.UPDATE,
              StatusCodes.BAD_REQUEST,
              ERROR_MESSAGES.CATEGORY.MAX_HIERARCHY_LEVEL.code,
              ERROR_MESSAGES.CATEGORY.MAX_HIERARCHY_LEVEL.message,
            );
          }
        }
      }

      // Check for duplicate slug if slug is being updated
      if (data.slug && data.slug !== category.slug) {
        const existingCategory = await Category.findOne({ slug: data.slug });
        if (
          existingCategory &&
          (existingCategory._id as string).toString() !== categoryId
        ) {
          throw new ApiError(
            ERROR_MESSAGES.CATEGORY.ACTION.UPDATE,
            StatusCodes.CONFLICT,
            ERROR_MESSAGES.CATEGORY.DUPLICATE_SLUG.code,
            ERROR_MESSAGES.CATEGORY.DUPLICATE_SLUG.message,
          );
        }
      }

      // Update category
      const updateData: Record<string, unknown> = {
        updated_by: data.updatedBy,
        updated_at: new Date(),
      };

      if (data.name !== undefined) updateData['name'] = data.name;
      if (data.slug !== undefined) updateData['slug'] = data.slug;
      if (data.description !== undefined)
        updateData['description'] = data.description;
      if (data.parentId !== undefined) {
        updateData['parent_id'] = data.parentId || null;
        // Update level based on new parent
        if (data.parentId) {
          const parentCategory = await Category.findById(data.parentId);
          updateData['level'] = parentCategory!['level'] + 1;
        } else {
          updateData['level'] = 0;
        }
      }
      if (data.sortOrder !== undefined)
        updateData['sort_order'] = data.sortOrder;
      if (data.imageUrl !== undefined) updateData['image_url'] = data.imageUrl;
      if (data.seoTitle !== undefined) updateData['seo_title'] = data.seoTitle;
      if (data.seoDescription !== undefined)
        updateData['seo_description'] = data.seoDescription;
      if (data.isActive !== undefined) updateData['is_active'] = data.isActive;

      const updatedCategory = await Category.findByIdAndUpdate(
        categoryId,
        updateData,
        {
          new: true,
        },
      )
        .populate('parent_id', 'name slug level')
        .populate('created_by', 'username email')
        .populate('updated_by', 'username email');

      return updatedCategory!;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        ERROR_MESSAGES.CATEGORY.ACTION.UPDATE,
        StatusCodes.INTERNAL_SERVER_ERROR,
        ERROR_MESSAGES.CATEGORY.UPDATE_ERROR.code,
        ERROR_MESSAGES.CATEGORY.UPDATE_ERROR.message,
      );
    }
  }

  /**
   * Soft delete category
   */
  static async deleteCategory(categoryId: string): Promise<void> {
    try {
      if (!mongoose.Types.ObjectId.isValid(categoryId)) {
        throw new ApiError(
          ERROR_MESSAGES.CATEGORY.ACTION.DELETE,
          StatusCodes.BAD_REQUEST,
          ERROR_MESSAGES.CATEGORY.INVALID_ID.code,
          ERROR_MESSAGES.CATEGORY.INVALID_ID.message,
        );
      }

      const category = await Category.findById(categoryId);
      if (!category || category.deleted_at) {
        throw new ApiError(
          ERROR_MESSAGES.CATEGORY.ACTION.DELETE,
          StatusCodes.NOT_FOUND,
          ERROR_MESSAGES.CATEGORY.NOT_FOUND.code,
          ERROR_MESSAGES.CATEGORY.NOT_FOUND.message,
        );
      }

      // Check if category has children
      const childrenCount = await Category.countDocuments({
        parent_id: categoryId,
        deleted_at: null,
      });

      if (childrenCount > 0) {
        throw new ApiError(
          ERROR_MESSAGES.CATEGORY.ACTION.DELETE,
          StatusCodes.BAD_REQUEST,
          ERROR_MESSAGES.CATEGORY.HAS_CHILDREN.code,
          ERROR_MESSAGES.CATEGORY.HAS_CHILDREN.message,
        );
      }

      // Check if category is in use by machines (you'll need to implement this check based on your machine model)
      // const machinesUsingCategory = await Machine.countDocuments({ category_id: categoryId });
      // if (machinesUsingCategory > 0) {
      //   throw new ApiError(
      //     ERROR_MESSAGES.CATEGORY.ACTION.DELETE,
      //     StatusCodes.BAD_REQUEST,
      //     ERROR_MESSAGES.CATEGORY.IN_USE.code,
      //     ERROR_MESSAGES.CATEGORY.IN_USE.message,
      //   );
      // }

      // Soft delete
      await Category.findByIdAndUpdate(categoryId, {
        deleted_at: new Date(),
        is_active: false,
      });
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        ERROR_MESSAGES.CATEGORY.ACTION.DELETE,
        StatusCodes.INTERNAL_SERVER_ERROR,
        ERROR_MESSAGES.CATEGORY.DELETE_ERROR.code,
        ERROR_MESSAGES.CATEGORY.DELETE_ERROR.message,
      );
    }
  }

  /**
   * Get category hierarchy path
   */
  static async getCategoryPath(categoryId: string): Promise<string[]> {
    try {
      if (!mongoose.Types.ObjectId.isValid(categoryId)) {
        throw new ApiError(
          ERROR_MESSAGES.CATEGORY.ACTION.GET,
          StatusCodes.BAD_REQUEST,
          ERROR_MESSAGES.CATEGORY.INVALID_ID.code,
          ERROR_MESSAGES.CATEGORY.INVALID_ID.message,
        );
      }

      return await Category.getCategoryPath(categoryId);
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        ERROR_MESSAGES.CATEGORY.ACTION.GET,
        StatusCodes.INTERNAL_SERVER_ERROR,
        ERROR_MESSAGES.CATEGORY.GET_ERROR.code,
        ERROR_MESSAGES.CATEGORY.GET_ERROR.message,
      );
    }
  }

  /**
   * Build category tree structure
   */
  private static buildCategoryTree(
    categories: ICategory[],
    parentId: string | null = null,
  ): CategoryTreeNode[] {
    const tree: CategoryTreeNode[] = [];

    for (const category of categories) {
      const categoryParentId = category.parent_id
        ? category.parent_id.toString()
        : null;

      if (categoryParentId === parentId) {
        const children = this.buildCategoryTree(
          categories,
          (category._id as string).toString(),
        );

        const treeNode: CategoryTreeNode = {
          _id: (category._id as string).toString(),
          name: category.name,
          slug: category.slug,
          description: category.description || undefined,
          level: category.level,
          sortOrder: category.sort_order,
          isActive: category.is_active,
          imageUrl: category.image_url,
          seoTitle: category.seo_title,
          seoDescription: category.seo_description,
          parentId: category.parent_id?.toString(),
          createdAt: category.created_at,
          updatedAt: category.updated_at,
        };

        if (children.length > 0) {
          treeNode.children = children;
        }

        tree.push(treeNode);
      }
    }

    return tree;
  }
}

export { CategoryService };
