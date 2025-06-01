import { Router } from 'express';
import {
  loginUserSchema,
  registerUserSchema,
} from '../modules/user/user.validator';
import { validateRequest } from '../middlewares/validateRequest';
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
export default router;
