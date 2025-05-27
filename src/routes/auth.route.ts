import { Router } from 'express';
import AuthController from '../modules/auth/auth.controller';
import { RegisterSchema, LoginSchema } from '../modules/auth/auth.validate';
import { validateRequest } from '../middlewares/validateRequest';
import { upload } from '../middlewares/multer.middleware';


const router = Router();

router.post('/register',upload.any(), validateRequest(RegisterSchema), AuthController.registerUser);
router.post('/login', validateRequest(LoginSchema), AuthController.loginUser);
router.post('/refresh-token', AuthController.refreshAccessToken);
router.post('/logout', AuthController.logoutUser);


export default router;
