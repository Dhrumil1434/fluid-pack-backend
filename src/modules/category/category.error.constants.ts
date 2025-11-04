// category.error.constants.ts
export const ERROR_MESSAGES = {
  CATEGORY: {
    ACTION: {
      CREATE: 'CREATE_CATEGORY',
      GET: 'FETCHING_CATEGORY',
      UPDATE: 'UPDATE_CATEGORY',
      DELETE: 'DELETE_CATEGORY',
      LIST: 'FETCHING_CATEGORIES',
      TREE: 'FETCHING_CATEGORY_TREE',
      HIERARCHY: 'VALIDATE_CATEGORY_HIERARCHY',
      GENERATE: 'GENERATE_SEQUENCE',
      RESET: 'RESET_SEQUENCE',
    },
    NOT_FOUND: {
      code: 'CATEGORY_NOT_FOUND',
      message: 'Category not found or has been deleted',
    },
    DUPLICATE_NAME: {
      code: 'DUPLICATE_CATEGORY_NAME',
      message: 'A category with this name already exists',
    },
    DUPLICATE_SLUG: {
      code: 'DUPLICATE_CATEGORY_SLUG',
      message: 'A category with this slug already exists',
    },
    INVALID_ID: {
      code: 'INVALID_CATEGORY_ID',
      message: 'Invalid category ID format',
    },
    INVALID_PARENT: {
      code: 'INVALID_PARENT_CATEGORY',
      message: 'Parent category is invalid or does not exist',
    },
    CIRCULAR_REFERENCE: {
      code: 'CIRCULAR_REFERENCE',
      message:
        'Cannot set category as its own parent or create circular reference',
    },
    MAX_HIERARCHY_LEVEL: {
      code: 'MAX_HIERARCHY_LEVEL_EXCEEDED',
      message: 'Maximum hierarchy level (3) exceeded',
    },
    IN_USE: {
      code: 'CATEGORY_IN_USE',
      message:
        'Cannot delete category as it is being used by machines or has subcategories',
    },
    HAS_CHILDREN: {
      code: 'CATEGORY_HAS_CHILDREN',
      message:
        'Cannot delete category that has subcategories. Delete subcategories first',
    },
    CREATE_ERROR: {
      code: 'CREATE_CATEGORY_ERROR',
      message: 'Failed to create category',
    },
    GET_ERROR: {
      code: 'GET_CATEGORY_ERROR',
      message: 'Failed to retrieve category',
    },
    GET_ALL_ERROR: {
      code: 'GET_CATEGORIES_ERROR',
      message: 'Failed to retrieve categories',
    },
    UPDATE_ERROR: {
      code: 'UPDATE_CATEGORY_ERROR',
      message: 'Failed to update category',
    },
    DELETE_ERROR: {
      code: 'DELETE_CATEGORY_ERROR',
      message: 'Failed to delete category',
    },
    TREE_ERROR: {
      code: 'GET_CATEGORY_TREE_ERROR',
      message: 'Failed to retrieve category tree',
    },
    HIERARCHY_ERROR: {
      code: 'VALIDATE_HIERARCHY_ERROR',
      message: 'Failed to validate category hierarchy',
    },
  },
  SEQUENCE_MANAGEMENT: {
    ACTION: {
      CREATE: 'CREATE_SEQUENCE_MANAGEMENT',
      GET: 'FETCHING_SEQUENCE_MANAGEMENT',
      UPDATE: 'UPDATE_SEQUENCE_MANAGEMENT',
      DELETE: 'DELETE_SEQUENCE_MANAGEMENT',
      LIST: 'FETCHING_SEQUENCE_MANAGEMENTS',
      GENERATE: 'GENERATE_SEQUENCE',
      RESET: 'RESET_SEQUENCE',
    },
    NOT_FOUND: {
      code: 'SEQUENCE_MANAGEMENT_NOT_FOUND',
      message: 'Sequence management configuration not found',
    },
    DUPLICATE_CONFIG: {
      code: 'DUPLICATE_SEQUENCE_CONFIG',
      message:
        'Sequence configuration already exists for this category/subcategory combination',
    },
    INVALID_CATEGORY: {
      code: 'INVALID_CATEGORY_FOR_SEQUENCE',
      message: 'Invalid category for sequence management',
    },
    INVALID_SUBCATEGORY: {
      code: 'INVALID_SUBCATEGORY_FOR_SEQUENCE',
      message: 'Invalid subcategory for sequence management',
    },
    INVALID_FORMAT: {
      code: 'INVALID_SEQUENCE_FORMAT',
      message:
        'Sequence format must contain {category} and {sequence} placeholders',
    },
    INVALID_PREFIX: {
      code: 'INVALID_SEQUENCE_PREFIX',
      message:
        'Sequence prefix can only contain uppercase letters, numbers, and hyphens',
    },
    INVALID_STARTING_NUMBER: {
      code: 'INVALID_STARTING_NUMBER',
      message: 'Starting number must be at least 1',
    },
    SEQUENCE_GENERATION_ERROR: {
      code: 'SEQUENCE_GENERATION_ERROR',
      message: 'Failed to generate sequence number',
    },
    SEQUENCE_RESET_ERROR: {
      code: 'SEQUENCE_RESET_ERROR',
      message: 'Failed to reset sequence number',
    },
    CREATE_ERROR: {
      code: 'CREATE_SEQUENCE_MANAGEMENT_ERROR',
      message: 'Failed to create sequence management configuration',
    },
    GET_ERROR: {
      code: 'GET_SEQUENCE_MANAGEMENT_ERROR',
      message: 'Failed to retrieve sequence management configuration',
    },
    GET_ALL_ERROR: {
      code: 'GET_SEQUENCE_MANAGEMENTS_ERROR',
      message: 'Failed to retrieve sequence management configurations',
    },
    UPDATE_ERROR: {
      code: 'UPDATE_SEQUENCE_MANAGEMENT_ERROR',
      message: 'Failed to update sequence management configuration',
    },
    DELETE_ERROR: {
      code: 'DELETE_SEQUENCE_MANAGEMENT_ERROR',
      message: 'Failed to delete sequence management configuration',
    },
  },
} as const;
