export interface ErrorConstant {
  code: string;
  message: string;
}
export const ERROR_MESSAGES = {
  USER: {
    ROLE_NOT_FOUND: {
      code: 'ROLE_NOT_FOUND',
      message: 'Role not found.',
    },
    ALREADY_EXISTS: {
      code: 'ROLE_ALREADY_EXISTS',
      message: 'Role with this name already exists.',
    },
    ACTION: {
      register: 'REGISTERING_USER',
    },
  },
  // Add more domains here...
};
