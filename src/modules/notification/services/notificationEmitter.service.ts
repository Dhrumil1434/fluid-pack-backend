import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import NotificationService, {
  CreateNotificationData,
} from './notification.service';

/**
 * Notification Emitter Service
 * Handles real-time notification emission via WebSocket
 */
class NotificationEmitterService {
  private io: SocketIOServer | null = null;
  private userSocketMap: Map<string, string> = new Map(); // userId -> socketId

  /**
   * Initialize Socket.IO server
   */
  initialize(server: HTTPServer): void {
    // Get allowed origins from environment or use defaults
    // If ALLOWED_ORIGINS is set, merge with default regex patterns
    const envOrigins = process.env['ALLOWED_ORIGINS']
      ? process.env['ALLOWED_ORIGINS'].split(',').map((origin) => origin.trim())
      : [];

    const defaultOrigins = [
      'http://localhost:4200',
      'http://127.0.0.1:4200',
      // Allow network IPs in development
      ...(process.env['NODE_ENV'] !== 'production'
        ? [
            /^http:\/\/192\.168\.\d+\.\d+:4200$/,
            /^http:\/\/10\.\d+\.\d+\.\d+:4200$/,
            /^http:\/\/172\.\d+\.\d+\.\d+:4200$/, // Docker networks
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

    this.io = new SocketIOServer(server, {
      cors: {
        origin: (origin, callback) => {
          // Allow requests with no origin
          if (!origin) return callback(null, true);

          // Debug logging
          console.log(`🔍 Socket.IO CORS Check - Origin: ${origin}`);

          // Check if origin matches allowed origins
          const isAllowed = allowedOrigins.some((allowed) => {
            if (typeof allowed === 'string') {
              return origin === allowed;
            }
            if (allowed instanceof RegExp) {
              return allowed.test(origin);
            }
            return false;
          });

          if (isAllowed) {
            console.log(`✅ Socket.IO CORS Allowed - Origin: ${origin}`);
            callback(null, true);
          } else {
            console.error(`❌ Socket.IO CORS Rejected - Origin: ${origin}`);
            callback(new Error('Not allowed by CORS'));
          }
        },
        credentials: true,
        methods: ['GET', 'POST'],
      },
      transports: ['websocket', 'polling'],
    });

    this.io.on('connection', (socket) => {
      console.log(`Client connected: ${socket.id}`);

      // User joins their personal room using userId
      socket.on('user:join', (userId: string) => {
        if (userId) {
          socket.join(`user:${userId}`);
          this.userSocketMap.set(userId, socket.id);
          console.log(`User ${userId} joined their notification room`);
        }
      });

      socket.on('disconnect', () => {
        // Remove user from map
        for (const [userId, socketId] of this.userSocketMap.entries()) {
          if (socketId === socket.id) {
            this.userSocketMap.delete(userId);
            break;
          }
        }
        console.log(`Client disconnected: ${socket.id}`);
      });

      // Handle manual disconnect
      socket.on('user:leave', (userId: string) => {
        if (userId) {
          socket.leave(`user:${userId}`);
          this.userSocketMap.delete(userId);
        }
      });
    });
  }

  /**
   * Create and emit notification to a user
   */
  async createAndEmitNotification(data: CreateNotificationData): Promise<void> {
    try {
      // Create notification in database
      const notification = await NotificationService.createNotification(data);

      // Emit to user's room if connected
      if (this.io) {
        this.io.to(`user:${data.recipientId}`).emit('notification:new', {
          notification: notification.toObject(),
        });
        console.log(
          `Notification emitted to user ${data.recipientId}: ${data.type}`,
        );
      }
    } catch (error) {
      console.error('Error creating and emitting notification:', error);
    }
  }

  /**
   * Emit notification to multiple users (for admin roles)
   */
  async createAndEmitToMultipleUsers(
    recipientIds: string[],
    data: Omit<CreateNotificationData, 'recipientId'>,
  ): Promise<void> {
    try {
      const notifications = await Promise.all(
        recipientIds.map((recipientId) =>
          NotificationService.createNotification({
            ...data,
            recipientId,
          }),
        ),
      );

      // Emit to all recipient rooms
      if (this.io) {
        recipientIds.forEach((recipientId) => {
          this.io?.to(`user:${recipientId}`).emit('notification:new', {
            notification: notifications
              .find((n) => n.recipientId.toString() === recipientId)
              ?.toObject(),
          });
        });
        console.log(
          `Notifications emitted to ${recipientIds.length} users: ${data.type}`,
        );
      }
    } catch (error) {
      console.error('Error creating and emitting notifications:', error);
    }
  }

  /**
   * Get Socket.IO instance
   */
  getIO(): SocketIOServer | null {
    return this.io;
  }
}

export default new NotificationEmitterService();
