import { Router } from 'express';
import { validateRequest } from '../middlewares/validateRequest';
import DepartmentAndRoleController from '../modules/admin/departmentAndRoles/department-role.controller';
import {
  createDepartmentSchema,
  updateDepartmentSchema,
  createRoleSchema,
  updateRoleSchema,
} from '../modules/admin/departmentAndRoles/department-roles.validator';

const router = Router();

// -------- Department Routes --------

router.post(
  '/department/create',

  validateRequest(createDepartmentSchema),
  DepartmentAndRoleController.createDepartment,
);

router.get('/departments', DepartmentAndRoleController.getAllDepartments);

router.get('/department/:id', DepartmentAndRoleController.getDepartmentById);

router.put(
  '/department/:id',

  validateRequest(updateDepartmentSchema),
  DepartmentAndRoleController.updateDepartment,
);

router.delete('/department/:id', DepartmentAndRoleController.deleteDepartment);

// -------- Role Routes --------

router.post(
  '/role/create',

  validateRequest(createRoleSchema),
  DepartmentAndRoleController.createRole,
);

router.get('/roles', DepartmentAndRoleController.getAllRoles);

router.get('/role/:id', DepartmentAndRoleController.getRoleById);

router.put(
  '/role/:id',

  validateRequest(updateRoleSchema),
  DepartmentAndRoleController.updateRole,
);

router.delete('/role/:id', DepartmentAndRoleController.deleteRole);

export default router;
