import { Router } from 'express';
import {
  loginUserSchema,
  registerUserSchema,
} from '../modules/user/user.validator';
import { validateRequest } from '../middlewares/validateRequest';
import UserController from '../modules/user/user.controller';
import { upload } from '../middlewares/multer.middleware';
import { verifyJWT } from '../middlewares/auth.middleware';
import { AuthRole } from '../middlewares/auth-role.middleware';
const router = Router();

router.post(
  '/register',
  upload.any(),
  validateRequest(registerUserSchema),
  UserController.registerUser,
);
router.post(
  '/login',
  upload.any(),
  validateRequest(loginUserSchema),
  UserController.loginUser,
);
router.patch(
  '/:id/approve',
  verifyJWT,
  AuthRole('admin'),
  upload.any(),
  UserController.approveUser,
);
export default router;
