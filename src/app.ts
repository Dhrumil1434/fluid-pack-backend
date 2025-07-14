import express, { Application } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import { errorHandler } from './middlewares/errorhandler';
import userRouter from './routes/user.route';
import departmentAndRoleRouter from './routes/department-role.route';
import permissionRouter from './routes/permission-config.route';
import categoryRouter from './routes/category.route';
import machineRouter from './routes/machine.route';
import machineApprovalRouter from './routes/machine-approval.route';
import qaMachineRouter from './routes/qa-machine.route';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
class App {
  public app: Application;

  constructor() {
    this.app = express();
    this.setMiddlewares();
    this.setRoutes();
    this.setErrorHandler();
  }

  private setMiddlewares(): void {
    this.app.use(compression());
    this.app.use(
      rateLimit({
        windowMs: 10 * 60 * 1000, // 15 mins
        max: 30, // Limit each IP to 100 requests per windowMs
        message:
          'Too many requests from this IP, please try again after 15 minutes.',
      }),
    );
    this.app.use(express.json({ limit: '5mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '5mb' }));
    this.app.use(
      cors({
        origin: 'http://localhost:4200', // your Angular app's origin
        credentials: true, // <-- allow credentials
      }),
    );
    this.app.use(express.static('public'));
    this.app.set('view engine', 'ejs');
    this.app.use(cookieParser());
    this.app.use(morgan(':method :url :status :response-time ms'));
  }

  private setRoutes(): void {
    this.app.use('/api/user', userRouter);
    this.app.use('/api/admin', departmentAndRoleRouter);
    this.app.use('/api/machines', machineRouter);
    this.app.use('/api/machine-approvals', machineApprovalRouter);
    this.app.use('/api/qa-machines', qaMachineRouter);
    this.app.use('/api/admin/category', categoryRouter);
    this.app.use('/api/permission', permissionRouter);
  }

  private setErrorHandler(): void {
    this.app.use(errorHandler);
  }

  public getServer(): Application {
    return this.app;
  }
}

export default new App().getServer();
