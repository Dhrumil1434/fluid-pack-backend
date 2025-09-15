export type Action =
  | 'CREATE_MACHINE'
  | 'EDIT_MACHINE'
  | 'DELETE_MACHINE'
  | 'APPROVE_MACHINE'
  | 'VIEW_MACHINE';

export type Permission = 'ALLOWED' | 'REQUIRES_APPROVAL' | 'DENIED';

export interface Policy {
  roles: string[];
  departments: string[];
  approvers: {
    defaultRoles: string[];
    perDepartment?: Record<string, string[]>;
  };
  rules: Array<{
    name: string;
    description?: string;
    action: Action;
    permission: Permission;
    roles?: string[];
    users?: string[]; // usernames or emails; best-effort resolution
    departments?: string[];
    categories?: string[];
    maxValue?: number;
    useDepartmentApprovers?: boolean;
    approverRoles?: string[];
    priority: number;
    isActive?: boolean;
  }>;
  overrides?: Array<{
    type: 'user-allow' | 'user-deny';
    action: Action;
    user: string; // username or email
    department?: string;
    priority?: number; // default 100
  }>;
}

export const defaultPolicy: Policy = {
  roles: ['admin', 'manager1', 'technician'],
  departments: ['dispatch', 'qa'],
  approvers: {
    defaultRoles: ['admin'],
    perDepartment: { dispatch: ['admin', 'manager1'] },
  },
  rules: [
    {
      name: 'Global view allowed',
      action: 'VIEW_MACHINE',
      permission: 'ALLOWED',
      priority: 10,
    },

    // Technician baseline
    {
      name: 'Technician create',
      action: 'CREATE_MACHINE',
      roles: ['technician'],
      permission: 'ALLOWED',
      priority: 60,
    },
    {
      name: 'Technician view',
      action: 'VIEW_MACHINE',
      roles: ['technician'],
      permission: 'ALLOWED',
      priority: 60,
    },

    // Manager approval in department (value-capped)
    {
      name: 'Dispatch manager approve <= 50k',
      action: 'APPROVE_MACHINE',
      roles: ['manager1'],
      departments: ['dispatch'],
      permission: 'ALLOWED',
      maxValue: 50000,
      priority: 70,
    },
    {
      name: 'Manager create requires approval',
      action: 'CREATE_MACHINE',
      roles: ['manager1'],
      permission: 'REQUIRES_APPROVAL',
      useDepartmentApprovers: true,
      priority: 65,
    },

    // Risk control
    {
      name: 'Dispatch deny delete',
      action: 'DELETE_MACHINE',
      departments: ['dispatch'],
      permission: 'DENIED',
      priority: 80,
    },

    // Global deny write safety nets
    {
      name: 'Global deny create',
      action: 'CREATE_MACHINE',
      permission: 'DENIED',
      priority: 1,
    },
    {
      name: 'Global deny edit',
      action: 'EDIT_MACHINE',
      permission: 'DENIED',
      priority: 1,
    },
    {
      name: 'Global deny delete',
      action: 'DELETE_MACHINE',
      permission: 'DENIED',
      priority: 1,
    },
  ],
  overrides: [
    // Examples; will be skipped if user not found
    {
      type: 'user-deny',
      action: 'CREATE_MACHINE',
      user: 'tech1@company.com',
      department: 'dispatch',
      priority: 100,
    },
    {
      type: 'user-allow',
      action: 'EDIT_MACHINE',
      user: 'tech2@company.com',
      priority: 100,
    },
  ],
};
