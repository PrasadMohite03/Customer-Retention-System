import { Router } from 'express';
import {
  registerOwnerHandler,
  loginHandler,
  refreshHandler,
  logoutHandler,
} from '../controllers/auth.controller';
import {
  sendOtpHandler,
  verifyOtpHandler,
  refreshCustomerHandler,
  logoutCustomerHandler,
} from '../controllers/customerAuth.controller';

const router = Router();

// Owner / Staff authentication routes
router.post('/register', registerOwnerHandler);
router.post('/login', loginHandler);
router.post('/refresh', refreshHandler);
router.post('/logout', logoutHandler);

// Customer authentication routes
router.post('/customer/otp/send', sendOtpHandler);
router.post('/customer/otp/verify', verifyOtpHandler);
router.post('/customer/refresh', refreshCustomerHandler);
router.post('/customer/logout', logoutCustomerHandler);

export default router;
