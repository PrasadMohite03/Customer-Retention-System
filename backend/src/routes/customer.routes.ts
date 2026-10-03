import { Router } from 'express';
import { authenticateCustomer } from '../middleware/auth.middleware';
import {
  getLoyaltyStatusHandler,
  createVisitRequestHandler,
  getCustomerHistoryHandler,
} from '../controllers/customerLoyalty.controller';

const router = Router();

// Strictly authenticate customer via phone/OTP JWT
router.use(authenticateCustomer);

// Read-only loyalty status (idempotently ensures CustomerProfile, never creates empty cycle)
router.get('/loyalty/:qrToken', getLoyaltyStatusHandler);

// Create visit request (duplicate pending check)
router.post('/visit-requests', createVisitRequestHandler);

// Customer history
router.get('/history', getCustomerHistoryHandler);

export default router;
