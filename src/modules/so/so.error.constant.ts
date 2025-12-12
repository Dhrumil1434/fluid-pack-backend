// so.error.constant.ts
export const ERROR_MESSAGES = {
  SO: {
    ACTION: {
      CREATE: 'CREATE_SO',
      GET: 'FETCHING_SO',
      UPDATE: 'UPDATE_SO',
      DELETE: 'DELETE_SO',
      LIST: 'FETCHING_SOS',
      ACTIVATE: 'ACTIVATE_SO',
      DEACTIVATE: 'DEACTIVATE_SO',
    },
    NOT_FOUND: {
      code: 'SO_NOT_FOUND',
      message: 'SO not found or has been deleted',
    },
    ALREADY_EXISTS: {
      code: 'SO_ALREADY_EXISTS',
      message: 'SO with this name already exists',
    },
    INVALID_ID: {
      code: 'INVALID_SO_ID',
      message: 'Invalid SO ID format',
    },
    CREATE_ERROR: {
      code: 'CREATE_SO_ERROR',
      message: 'Failed to create SO',
    },
    GET_ERROR: {
      code: 'GET_SO_ERROR',
      message: 'Failed to retrieve SO',
    },
    GET_ALL_ERROR: {
      code: 'GET_SOS_ERROR',
      message: 'Failed to retrieve SOs',
    },
    UPDATE_ERROR: {
      code: 'UPDATE_SO_ERROR',
      message: 'Failed to update SO',
    },
    DELETE_ERROR: {
      code: 'DELETE_SO_ERROR',
      message: 'Failed to delete SO',
    },
    ACTIVATE_ERROR: {
      code: 'ACTIVATE_SO_ERROR',
      message: 'Failed to activate SO',
    },
    DEACTIVATE_ERROR: {
      code: 'DEACTIVATE_SO_ERROR',
      message: 'Failed to deactivate SO',
    },
    INVALID_CATEGORY: {
      code: 'INVALID_CATEGORY',
      message: 'Invalid category or category not found',
    },
    INVALID_SUBCATEGORY: {
      code: 'INVALID_SUBCATEGORY',
      message: 'Subcategory does not belong to the selected category',
    },
    INACTIVE_SO: {
      code: 'INACTIVE_SO',
      message: 'SO is not active',
    },
  },
  CATEGORY: {
    NOT_FOUND: {
      code: 'CATEGORY_NOT_FOUND',
      message: 'Category not found or has been deleted',
    },
    INVALID_ID: {
      code: 'INVALID_CATEGORY_ID',
      message: 'Invalid category ID format',
    },
  },
} as const;
