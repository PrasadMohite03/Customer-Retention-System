import express, { Request, Response } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import authRoutes from './routes/auth.routes';
import businessRoutes from './routes/business.routes';
import branchRoutes from './routes/branch.routes';
import { loyaltyProgramRouter, milestoneRouter } from './routes/loyalty.routes';
import { authenticateUser, authenticateCustomer, requireRole } from './middleware/auth.middleware';
import { errorHandler } from './middleware/errorHandler';
import { UserRole } from '@prisma/client';

const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());

// Auth routes
app.use('/api/auth', authRoutes);

// Business & Branch routes (Authenticated OWNER-only)
app.use('/api/business', businessRoutes);
app.use('/api/branches', branchRoutes);

// Loyalty Program & Milestone routes (Authenticated OWNER-only)
app.use('/api/loyalty-programs', loyaltyProgramRouter);
app.use('/api/milestones', milestoneRouter);

// Protected route for Owner/Staff testing verification
app.get(
  '/api/test/protected',
  authenticateUser,
  requireRole([UserRole.OWNER, UserRole.STAFF]),
  (req: Request, res: Response) => {
    res.json({
      status: 'success',
      message: 'Access granted to protected route',
      user: req.user,
    });
  }
);

// Protected route for Customer testing verification
app.get(
  '/api/test/customer-protected',
  authenticateCustomer,
  (req: Request, res: Response) => {
    res.json({
      status: 'success',
      message: 'Access granted to customer protected route',
      customer: req.customer,
    });
  }
);

app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Not Found' });
});

app.use(errorHandler);

export default app;
