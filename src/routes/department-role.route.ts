import { Router } from 'express';
import { validateRequest } from '../middlewares/validateRequest';
import { upload } from '../middlewares/multer.middleware';
import DepartmentAndRoleController from '../modules/admin/departmentAndRoles/department-role.controller';
import {
  createDepartmentSchema,
  updateDepartmentSchema,
  createRoleSchema,
  updateRoleSchema,
} from '../modules/admin/departmentAndRoles/department-roles.validator';
import { verifyJWT } from '../middlewares/auth.middleware';
import { authorizeRoles } from '../middlewares/authorizeRole.middleware';

const router = Router();

const adminOnly = [verifyJWT, authorizeRoles('admin')];
// const adminOrSupervisor = [verifyJWT, authorizeRoles('admin', 'supervisor')];
// const allAuthorized = [verifyJWT, authorizeRoles('admin', 'manager', 'supervisor')];


// -------- Department Routes --------

router.post(
  '/department/create',
  adminOnly,
  upload.none(),
  validateRequest(createDepartmentSchema),
  DepartmentAndRoleController.createDepartment,
);

router.get('/departments',adminOnly, DepartmentAndRoleController.getAllDepartments);

router.get('/department/:id',adminOnly, DepartmentAndRoleController.getDepartmentById);

router.put(
  '/department/:id',
  adminOnly, 
  upload.none(),
  validateRequest(updateDepartmentSchema),
  DepartmentAndRoleController.updateDepartment,
);

router.delete('/department/:id',adminOnly, DepartmentAndRoleController.deleteDepartment);

// -------- Role Routes --------

router.post(
  '/role/create',
  adminOnly,
  upload.none(),
  validateRequest(createRoleSchema),
  DepartmentAndRoleController.createRole,
);

router.get('/roles', DepartmentAndRoleController.getAllRoles);

router.get('/role/:id', DepartmentAndRoleController.getRoleById);

router.put(
  '/role/:id',
  adminOnly,
  upload.none(),
  validateRequest(updateRoleSchema),
  DepartmentAndRoleController.updateRole,
);

router.delete('/role/:id',adminOnly, DepartmentAndRoleController.deleteRole);

export default router;
