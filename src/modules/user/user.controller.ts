import { NextFunction, Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';

class UserController {
  static registerUser = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      console.log(req.body, res, next);
    },
  );
}

export default UserController;
