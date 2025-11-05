import { Router } from 'express';
import { verifyJWT } from '../middlewares/auth.middleware';
import NotificationController from '../modules/notification/controllers/notification.controller';

const router = Router();

// All notification routes require authentication
router.use(verifyJWT);

// Get user's notifications
router.get('/', NotificationController.getNotifications);

// Get unread count
router.get('/unread-count', NotificationController.getUnreadCount);

// Mark notification as read
router.patch('/:id/read', NotificationController.markAsRead);

// Mark all notifications as read
router.patch('/mark-all-read', NotificationController.markAllAsRead);

// Delete notification
router.delete('/:id', NotificationController.deleteNotification);

export default router;
