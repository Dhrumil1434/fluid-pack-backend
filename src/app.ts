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
class App {
  public app: Application;

  constructor() {
    this.app = express();
    this.setMiddlewares();
    this.setRoutes();

    this.setErrorHandler();
  }

  private setMiddlewares(): void {
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
    this.app.use('/api/admin/category', categoryRouter);
    this.app.use('/api/permission', permissionRouter);
    this.app.use('/api/machine', machineRouter);
  }

  private setErrorHandler(): void {
    this.app.use(errorHandler);
  }

  public getServer(): Application {
    return this.app;
  }
}

export default new App().getServer();
