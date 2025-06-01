// machine.error.constants.ts
export const ERROR_MESSAGES = {
  MACHINE: {
    ACTION: {
      CREATE: 'CREATE_MACHINE',
      GET: 'FETCHING_MACHINE',
      UPDATE: 'UPDATE_MACHINE',
      DELETE: 'DELETE_MACHINE',
      LIST: 'FETCHING_MACHINES',
    },
    NOT_FOUND: {
      code: 'MACHINE_NOT_FOUND',
      message: 'Machine not found or has been deleted',
    },
    ALREADY_EXISTS: {
      code: 'DUPLICATE_MACHINE_NAME',
      message: 'A machine with this name already exists in this category',
    },
    INVALID_ID: {
      code: 'INVALID_MACHINE_ID',
      message: 'Invalid machine ID format',
    },
    CREATE_ERROR: {
      code: 'CREATE_MACHINE_ERROR',
      message: 'Failed to create machine',
    },
    GET_ERROR: {
      code: 'GET_MACHINE_ERROR',
      message: 'Failed to retrieve machine',
    },
    GET_ALL_ERROR: {
      code: 'GET_MACHINES_ERROR',
      message: 'Failed to retrieve machines',
    },
    UPDATE_ERROR: {
      code: 'UPDATE_MACHINE_ERROR',
      message: 'Failed to update machine',
    },
    DELETE_ERROR: {
      code: 'DELETE_MACHINE_ERROR',
      message: 'Failed to delete machine',
    },
    APPROVAL_ERROR: {
      code: 'UPDATE_APPROVAL_ERROR',
      message: 'Failed to update machine approval status',
    },
    GET_APPROVED_ERROR: {
      code: 'GET_APPROVED_MACHINES_ERROR',
      message: 'Failed to retrieve approved machines',
    },
    GET_BY_CATEGORY_ERROR: {
      code: 'GET_MACHINES_BY_CATEGORY_ERROR',
      message: 'Failed to retrieve machines by category',
    },
    INVALID_CATEGORY_ID: {
      code: 'INVALID_CATEGORY_ID',
      message: 'Invalid category ID format',
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
