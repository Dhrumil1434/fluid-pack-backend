import { Router } from 'express';
import {
  loginUserSchema,
  registerUserSchema,
  userIdParamSchema,
  updateUserSchema,
} from '../modules/user/user.validator';
import { validateParams, validateRequest } from '../middlewares/validateRequest';
import UserController from '../modules/user/user.controller';
import { verifyJWT } from '../middlewares/auth.middleware';
import { AuthRole } from '../middlewares/auth-role.middleware';
const router = Router();

router.post(
  '/register',

  validateRequest(registerUserSchema),
  UserController.registerUser,
);
router.post(
  '/login',

  validateRequest(loginUserSchema),
  UserController.loginUser,
);
router.post('/logout', UserController.logoutUser);
router.patch(
  '/:id/approve',
  verifyJWT,
  AuthRole('admin'),

  UserController.approveUser,
);

// Get user statistics - Admin/Manager only
router.get(
  '/statistics',
  verifyJWT,
  AuthRole(['admin', 'manager']),
  UserController.getUserStatistics,
);

// Get single user - Admin/Manager only
router.get(
  '/:id',
  verifyJWT,
  AuthRole(['admin', 'manager']),
  validateParams(userIdParamSchema),
  UserController.getUserById,
);

// Get all users with pagination - Admin/Manager only
router.get(
  '/',
  verifyJWT,
  AuthRole(['admin', 'manager']),
  UserController.getAllUsers,
);

// Update user - Admin/Manager only
router.put(
  '/:id',
  verifyJWT,
  AuthRole(['admin', 'manager']),
  validateParams(userIdParamSchema),
  validateRequest(updateUserSchema),
  UserController.updateUser,
);

// Delete user - Admin only
router.delete(
  '/:id',
  verifyJWT,
  AuthRole('admin'),
  validateParams(userIdParamSchema),
  UserController.deleteUser,
);

export default router;
