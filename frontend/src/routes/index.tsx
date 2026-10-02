import { createBrowserRouter, Navigate } from 'react-router-dom';
import Home from '../pages/Home';
import NotFound from '../pages/NotFound';
import { Login } from '../pages/Login';
import { RegisterOwner } from '../pages/RegisterOwner';
import { CustomerLogin } from '../pages/CustomerLogin';
import { OwnerLayout } from '../layouts/OwnerLayout';
import { OwnerDashboard } from '../pages/owner/OwnerDashboard';
import { BusinessProfile } from '../pages/owner/BusinessProfile';
import { BranchList } from '../pages/owner/BranchList';
import { BranchDetail } from '../pages/owner/BranchDetail';
import { LoyaltyProgram } from '../pages/owner/LoyaltyProgram';
import { StaffDashboard } from '../pages/staff/StaffDashboard';
import { CustomerDashboard } from '../pages/customer/CustomerDashboard';
import { ProtectedRoute, PublicOnlyRoute } from './guards';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Home />,
  },
  {
    path: '/login',
    element: (
      <PublicOnlyRoute>
        <Login />
      </PublicOnlyRoute>
    ),
  },
  {
    path: '/register',
    element: (
      <PublicOnlyRoute>
        <RegisterOwner />
      </PublicOnlyRoute>
    ),
  },
  {
    path: '/customer/login',
    element: (
      <PublicOnlyRoute>
        <CustomerLogin />
      </PublicOnlyRoute>
    ),
  },

  // Role Protected Owner Routes
  {
    path: '/owner',
    element: (
      <ProtectedRoute allowedRoles={['OWNER']}>
        <OwnerLayout />
      </ProtectedRoute>
    ),
    children: [
      {
        index: true,
        element: <Navigate to="/owner/dashboard" replace />,
      },
      {
        path: 'dashboard',
        element: <OwnerDashboard />,
      },
      {
        path: 'business',
        element: <BusinessProfile />,
      },
      {
        path: 'branches',
        element: <BranchList />,
      },
      {
        path: 'branches/:id',
        element: <BranchDetail />,
      },
      {
        path: 'branches/:id/loyalty-program',
        element: <LoyaltyProgram />,
      },
    ],
  },
  {
    path: '/staff/dashboard',
    element: (
      <ProtectedRoute allowedRoles={['STAFF']}>
        <StaffDashboard />
      </ProtectedRoute>
    ),
  },
  {
    path: '/customer/dashboard',
    element: (
      <ProtectedRoute allowedRoles={['CUSTOMER']}>
        <CustomerDashboard />
      </ProtectedRoute>
    ),
  },

  {
    path: '*',
    element: <NotFound />,
  },
]);
