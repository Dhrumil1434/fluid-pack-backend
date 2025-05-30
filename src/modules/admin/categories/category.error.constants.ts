// category.error.constants.ts
export const ERROR_MESSAGES = {
  CATEGORY: {
    ACTION: {
      create: 'CREATE_CATEGORY',
      get: 'FETCHING_CATEGORY',
      update: 'UPDATE_CATEGORY',
      delete: 'DELETE_CATEGORY',
      list: 'FETCHING_CATEGORIES',
    },
    NOT_FOUND: {
      code: 'CATEGORY_NOT_FOUND',
      message: 'Category not found or has been deleted',
    },
    DUPLICATE_NAME: {
      code: 'DUPLICATE_CATEGORY_NAME',
      message: 'A category with this name already exists',
    },
    IN_USE: {
      code: 'CATEGORY_IN_USE',
      message:
        'Cannot delete category as it is being used by machines or permission configurations',
    },
    INVALID_ID: {
      code: 'INVALID_CATEGORY_ID',
      message: 'Invalid category ID format',
    },
  },
} as const;
