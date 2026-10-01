import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { authenticateUser, requireRole } from '../middleware/auth.middleware';
import {
  getBusinessHandler,
  updateBusinessHandler,
} from '../controllers/business.controller';

const router = Router();

// Strictly authenticated OWNER only
router.use(authenticateUser, requireRole([UserRole.OWNER]));

router.get('/', getBusinessHandler);
router.patch('/', updateBusinessHandler);

export default router;
