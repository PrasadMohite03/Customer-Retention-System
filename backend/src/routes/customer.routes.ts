import { Router } from 'express';
import { authenticateCustomer } from '../middleware/auth.middleware';
import {
  getLoyaltyStatusHandler,
  createVisitRequestHandler,
  createRewardClaimHandler,
  getCustomerHistoryHandler,
  getCustomerExploreHandler,
} from '../controllers/customerLoyalty.controller';

const router = Router();

// Strictly authenticate customer via phone/OTP JWT
router.use(authenticateCustomer);

// Read-only explore / participating businesses directory
router.get('/explore', getCustomerExploreHandler);

// Read-only loyalty status (idempotently ensures CustomerProfile, never creates empty cycle)
router.get('/loyalty/:qrToken', getLoyaltyStatusHandler);

// Create visit request (duplicate pending check) - for normal visits
router.post('/visit-requests', createVisitRequestHandler);

// Create reward claim token - for reward qualifying visits
router.post('/reward-claims', createRewardClaimHandler);

// Customer history
router.get('/history', getCustomerHistoryHandler);

export default router;
