export interface ErrorConstant {
  code: string;
  message: string;
}

export const ERROR_MESSAGES = {
  DEPARTMENT: {
    NOT_FOUND: {
      code: 'DEPARTMENT_NOT_FOUND',
      message: 'Department not found.',
    },
    ALREADY_EXISTS: {
      code: 'DEPARTMENT_ALREADY_EXISTS',
      message: 'Department with this name already exists.',
    },
    ACTION: {
      CREATE: 'CREATE_DEPARTMENT',
      UPDATE: 'UPDATE_DEPARTMENT',
      DELETE: 'DELETE_DEPARTMENT',
      GET: 'GET_DEPARTMENT',
    },
  },
  ROLE: {
    NOT_FOUND: {
      code: 'ROLE_NOT_FOUND',
      message: 'Role not found.',
    },
    ALREADY_EXISTS: {
      code: 'ROLE_ALREADY_EXISTS',
      message: 'Role with this name already exists.',
    },
    ACTION: {
      CREATE: 'CREATE_ROLE',
      UPDATE: 'UPDATE_ROLE',
      DELETE: 'DELETE_ROLE',
      GET: 'GET_ROLE',
    },
  },
};
