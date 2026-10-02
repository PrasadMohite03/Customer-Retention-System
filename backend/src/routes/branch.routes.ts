import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { authenticateUser, requireRole } from '../middleware/auth.middleware';
import {
  createBranchHandler,
  getBranchesHandler,
  getBranchByIdHandler,
  updateBranchHandler,
  updateBranchStatusHandler,
} from '../controllers/branch.controller';
import {
  createLoyaltyProgramHandler,
  getLoyaltyProgramHandler,
  getLoyaltyProgramsHandler,
  updateLoyaltyProgramHandler,
} from '../controllers/loyalty.controller';

const router = Router();

// Strictly authenticated OWNER only
router.use(authenticateUser, requireRole([UserRole.OWNER]));

// Branch CRUD
router.post('/', createBranchHandler);
router.get('/', getBranchesHandler);
router.get('/:id', getBranchByIdHandler);
router.patch('/:id', updateBranchHandler);
router.patch('/:id/status', updateBranchStatusHandler);

// Loyalty program sub-routes (nested under a branch)
router.post('/:id/loyalty-program', createLoyaltyProgramHandler);
router.get('/:id/loyalty-program', getLoyaltyProgramHandler);   // active-only (for QR/customer flow)
router.get('/:id/loyalty-programs', getLoyaltyProgramsHandler); // all programs (for owner management)
router.patch('/:id/loyalty-program', updateLoyaltyProgramHandler);

export default router;
