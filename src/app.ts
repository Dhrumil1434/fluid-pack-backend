import express, { Application } from 'express';
import cors, { CorsOptions } from 'cors';
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
import qcApprovalRouter from './routes/qc-approval.route';
import notificationRouter from './routes/notification.route';
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
    this.app.set('trust proxy', 1); // Trust first proxy
    this.app.use(
      rateLimit({
        windowMs: 10 * 60 * 1000, // 15 mins
        max: 350, // Limit each IP to 100 requests per windowMs
        message:
          'Too many requests from this IP, please try again after 15 minutes.',
      }),
    );
    this.app.use(express.json({ limit: '5mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '50mb' }));
    // CORS configuration - allows network access
    // If ALLOWED_ORIGINS is set, merge with default regex patterns
    const envOrigins = process.env['ALLOWED_ORIGINS']
      ? process.env['ALLOWED_ORIGINS'].split(',').map((origin) => origin.trim())
      : [];

    const defaultOrigins = [
      'http://localhost:4200',
      'http://localhost:3000',
      'http://127.0.0.1:4200',
      'http://127.0.0.1:3000',
      // Allow network IPs in development (regex patterns)
      ...(process.env['NODE_ENV'] !== 'production'
        ? [
            /^http:\/\/192\.168\.\d+\.\d+:4200$/,
            /^http:\/\/192\.168\.\d+\.\d+:3000$/,
            /^http:\/\/10\.\d+\.\d+\.\d+:4200$/,
            /^http:\/\/10\.\d+\.\d+\.\d+:3000$/,
            /^http:\/\/172\.\d+\.\d+\.\d+:4200$/, // Docker networks
            /^http:\/\/172\.\d+\.\d+\.\d+:3000$/, // Docker networks
          ]
        : []),
    ];

    // Merge environment origins with default origins (avoid duplicates)
    const allowedOrigins = [
      ...envOrigins,
      ...defaultOrigins.filter(
        (defaultOrigin) =>
          !envOrigins.some((envOrigin) =>
            typeof defaultOrigin === 'string'
              ? envOrigin === defaultOrigin
              : false,
          ),
      ),
    ];

    const corsOptions: CorsOptions = {
      origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, Postman, etc.)
        if (!origin) return callback(null, true);

        // Debug logging
        console.log(`🔍 CORS Check - Origin: ${origin}`);
        console.log(`🔍 CORS Check - Allowed Origins:`, allowedOrigins);

        // Check if origin matches allowed origins
        const isAllowed = allowedOrigins.some((allowed) => {
          if (typeof allowed === 'string') {
            const matches = origin === allowed;
            if (matches) console.log(`✅ CORS Match - String: ${allowed}`);
            return matches;
          }
          if (allowed instanceof RegExp) {
            const matches = allowed.test(origin);
            if (matches) console.log(`✅ CORS Match - Regex: ${allowed}`);
            return matches;
          }
          return false;
        });

        if (isAllowed) {
          callback(null, true);
        } else {
          console.error(
            `❌ CORS Rejected - Origin: ${origin} not in allowed list`,
          );
          callback(new Error('Not allowed by CORS'));
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Requested-With',
        'Accept',
      ],
      optionsSuccessStatus: 200,
    };
    this.app.use(cors(corsOptions));
    // Explicitly handle preflight for all routes
    this.app.options('*', cors(corsOptions));
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
    this.app.use('/api/qc-machines', qaMachineRouter);
    this.app.use('/api/qc-approvals', qcApprovalRouter);
    this.app.use('/api/categories', categoryRouter);
    this.app.use('/api/permission', permissionRouter);
    this.app.use('/api/notifications', notificationRouter);
  }

  private setErrorHandler(): void {
    this.app.use(errorHandler);
  }

  public getServer(): Application {
    return this.app;
  }
}

export default new App().getServer();
