import { Router } from 'express';
import { registerUserSchema } from '../modules/user/user.validator';
import { validateRequest } from '../middlewares/validateRequest';
import UserController from '../modules/user/user.controller';
import { upload } from '../middlewares/multer.middleware';
const router = Router();

router.post(
  '/register',
  upload.any(),
  validateRequest(registerUserSchema),
  UserController.registerUser,
);

export default router;
