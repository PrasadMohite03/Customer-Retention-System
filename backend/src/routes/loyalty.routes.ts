import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { authenticateUser, requireRole } from '../middleware/auth.middleware';
import {
  createMilestoneHandler,
  updateMilestoneHandler,
  updateMilestoneStatusHandler,
  deleteMilestoneHandler,
  setProgramStatusHandler,
} from '../controllers/loyalty.controller';

// ── /api/loyalty-programs/:programId/milestones ──────────────────────────

export const loyaltyProgramRouter = Router();

loyaltyProgramRouter.use(authenticateUser, requireRole([UserRole.OWNER]));

loyaltyProgramRouter.post('/:programId/milestones', createMilestoneHandler);
loyaltyProgramRouter.patch('/:programId/status', setProgramStatusHandler);

// ── /api/milestones/:milestoneId ─────────────────────────────────────────

export const milestoneRouter = Router();

milestoneRouter.use(authenticateUser, requireRole([UserRole.OWNER]));

milestoneRouter.patch('/:milestoneId', updateMilestoneHandler);
milestoneRouter.patch('/:milestoneId/status', updateMilestoneStatusHandler);
milestoneRouter.delete('/:milestoneId', deleteMilestoneHandler);
