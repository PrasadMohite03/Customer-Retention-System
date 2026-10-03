import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { authenticateUser, requireRole } from '../middleware/auth.middleware';
import {
  getPendingRequestsHandler,
  approveVisitRequestHandler,
  rejectVisitRequestHandler,
  redeemRewardHandler,
  getUnlockedRewardsHandler,
  getDashboardHandler,
  validateRewardTokenHandler,
  redeemRewardByTokenHandler,
} from '../controllers/staffVisit.controller';
import {
  createStaffHandler,
  getStaffListHandler,
  getStaffByIdHandler,
  updateStaffHandler,
  updateStaffStatusHandler,
} from '../controllers/staffManagement.controller';

const router = Router();

// Base authentication for all staff routes
router.use(authenticateUser);

// ─── Operational Visit, Reward & Dashboard Routes (STAFF or OWNER) ─────────
router.get('/dashboard', requireRole([UserRole.STAFF, UserRole.OWNER]), getDashboardHandler);
router.get('/visit-requests', requireRole([UserRole.STAFF, UserRole.OWNER]), getPendingRequestsHandler);
router.post('/visit-requests/:id/approve', requireRole([UserRole.STAFF, UserRole.OWNER]), approveVisitRequestHandler);
router.post('/visit-requests/:id/reject', requireRole([UserRole.STAFF, UserRole.OWNER]), rejectVisitRequestHandler);
router.get('/rewards/unlocked', requireRole([UserRole.STAFF, UserRole.OWNER]), getUnlockedRewardsHandler);
router.post('/rewards/validate', requireRole([UserRole.STAFF, UserRole.OWNER]), validateRewardTokenHandler);
router.post('/rewards/redeem-by-token', requireRole([UserRole.STAFF, UserRole.OWNER]), redeemRewardByTokenHandler);
router.post('/rewards/:rewardId/redeem', requireRole([UserRole.STAFF, UserRole.OWNER]), redeemRewardHandler);

// ─── Staff Management CRUD Routes (OWNER only) ─────────────────────────────
router.post('/', requireRole([UserRole.OWNER]), createStaffHandler);
router.get('/', requireRole([UserRole.OWNER]), getStaffListHandler);
router.get('/:id', requireRole([UserRole.OWNER]), getStaffByIdHandler);
router.patch('/:id', requireRole([UserRole.OWNER]), updateStaffHandler);
router.patch('/:id/status', requireRole([UserRole.OWNER]), updateStaffStatusHandler);

export default router;
