import { createBrowserRouter } from 'react-router-dom';
import Home from '../pages/Home';
import NotFound from '../pages/NotFound';
import { Login } from '../pages/Login';
import { RegisterOwner } from '../pages/RegisterOwner';
import { CustomerLogin } from '../pages/CustomerLogin';
import { OwnerDashboard } from '../pages/owner/OwnerDashboard';
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

  // Role Protected Dashboards
  {
    path: '/owner/dashboard',
    element: (
      <ProtectedRoute allowedRoles={['OWNER']}>
        <OwnerDashboard />
      </ProtectedRoute>
    ),
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
