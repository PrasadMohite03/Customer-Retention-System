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

const router = Router();

// Strictly authenticated OWNER only
router.use(authenticateUser, requireRole([UserRole.OWNER]));

router.post('/', createBranchHandler);
router.get('/', getBranchesHandler);
router.get('/:id', getBranchByIdHandler);
router.patch('/:id', updateBranchHandler);
router.patch('/:id/status', updateBranchStatusHandler);

export default router;
