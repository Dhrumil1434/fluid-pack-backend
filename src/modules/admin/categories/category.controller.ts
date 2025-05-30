// controllers/category.controller.ts
import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { asyncHandler } from '../../../utils/asyncHandler';
import { ApiResponse } from '../../../utils/ApiResponse';
import { ApiError } from '../../../utils/ApiError';
import CategoryService, {
  CreateCategoryData,
  UpdateCategoryData,
} from './services/category.service';

export interface AuthenticatedRequest extends Request {
  user?: {
    _id: string;
    email: string;
    username: string;
    role: string;
  };
}

interface PaginationQuery {
  page?: string;
  limit?: string;
}

interface SearchQuery extends PaginationQuery {
  search?: string;
}

class CategoryController {
  /**
   * Create a new category
   */
  static createCategory = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { name, description } = req.body as CreateCategoryData;

      if (!req.user) {
        throw new ApiError(
          'CREATE_CATEGORY',
          StatusCodes.UNAUTHORIZED,
          'USER_NOT_AUTHENTICATED',
          'User authentication required',
        );
      }

      const category = await CategoryService.create({
        name,
        description,
        createdBy: req.user._id,
      });

      const response = new ApiResponse(
        StatusCodes.CREATED,
        category,
        'Category created successfully',
      );

      res.status(StatusCodes.CREATED).json(response);
    },
  );

  /**
   * Get all categories with pagination and optional search
   */
  static getAllCategories = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { page, limit, search } = req.query as SearchQuery;
      const pageNumber = parseInt(page || '1');
      const limitNumber = parseInt(limit || '10');

      const result = await CategoryService.getAll(
        pageNumber,
        limitNumber,
        search,
      );

      const response = new ApiResponse(
        StatusCodes.OK,
        {
          categories: result.categories,
          pagination: {
            currentPage: pageNumber,
            totalPages: result.pages,
            totalItems: result.total,
            itemsPerPage: limitNumber,
          },
        },
        'Categories retrieved successfully',
      );

      res.status(StatusCodes.OK).json(response);
    },
  );

  /**
   * Get category by ID
   */
  static getCategoryById = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { id } = req.params;

      if (!id) {
        throw new ApiError(
          'FETCHING_CATEGORY',
          StatusCodes.BAD_REQUEST,
          'MISSING_PARAMETER',
          'Category ID is required',
        );
      }

      const category = await CategoryService.getById(id);

      const response = new ApiResponse(
        StatusCodes.OK,
        category,
        'Category retrieved successfully',
      );

      res.status(StatusCodes.OK).json(response);
    },
  );

  /**
   * Update category
   */
  static updateCategory = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { id } = req.params;
      const updateData = req.body as UpdateCategoryData;

      if (!id) {
        throw new ApiError(
          'UPDATING_CATEGORY',
          StatusCodes.BAD_REQUEST,
          'MISSING_PARAMETER',
          'Category ID is required',
        );
      }

      const category = await CategoryService.update(id, updateData);

      const response = new ApiResponse(
        StatusCodes.OK,
        category,
        'Category updated successfully',
      );

      res.status(StatusCodes.OK).json(response);
    },
  );

  /**
   * Delete category (soft delete)
   */
  static deleteCategory = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const id = req.params['id'] ?? '';

      if (!id.trim()) {
        throw new ApiError(
          'DELETING_CATEGORY',
          StatusCodes.BAD_REQUEST,
          'MISSING_PARAMETER',
          'Category ID is required',
        );
      }

      await CategoryService.delete(id);

      const response = new ApiResponse(
        StatusCodes.OK,
        null,
        'Category deleted successfully',
      );

      res.status(StatusCodes.OK).json(response);
    },
  );

  /**
   * Get active categories (for dropdown/selection purposes)
   */
  static getActiveCategories = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const categories = await CategoryService.getActiveCategories();

      const response = new ApiResponse(
        StatusCodes.OK,
        categories,
        'Active categories retrieved successfully',
      );

      res.status(StatusCodes.OK).json(response);
    },
  );

  /**
   * Check if category exists (utility endpoint)
   */
  static checkCategoryExists = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { id } = req.params;

      if (!id) {
        throw new ApiError(
          'CHECKING_CATEGORY',
          StatusCodes.BAD_REQUEST,
          'MISSING_PARAMETER',
          'Category ID is required',
        );
      }

      const exists = await CategoryService.exists(id);

      const response = new ApiResponse(
        StatusCodes.OK,
        { exists },
        `Category ${exists ? 'exists' : 'does not exist'}`,
      );

      res.status(StatusCodes.OK).json(response);
    },
  );
}

export default CategoryController;
