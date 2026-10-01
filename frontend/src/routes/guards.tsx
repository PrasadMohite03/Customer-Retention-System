import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { UserRole } from '../types/auth';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-200">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-500 mb-4" />
        <p className="text-sm font-medium text-slate-400">Restoring authentication session...</p>
      </div>
    );
  }

  if (!user) {
    const isCustomerPath = location.pathname.startsWith('/customer');
    return <Navigate to={isCustomerPath ? '/customer/login' : '/login'} state={{ from: location }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // Redirect user to their own role's home/dashboard if attempting unauthorized role access
    switch (user.role) {
      case 'OWNER':
        return <Navigate to="/owner/dashboard" replace />;
      case 'STAFF':
        return <Navigate to="/staff/dashboard" replace />;
      case 'CUSTOMER':
        return <Navigate to="/customer/dashboard" replace />;
      default:
        return <Navigate to="/" replace />;
    }
  }

  return <>{children}</>;
};

export const PublicOnlyRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-200">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-500 mb-4" />
        <p className="text-sm font-medium text-slate-400">Loading...</p>
      </div>
    );
  }

  if (user) {
    switch (user.role) {
      case 'OWNER':
        return <Navigate to="/owner/dashboard" replace />;
      case 'STAFF':
        return <Navigate to="/staff/dashboard" replace />;
      case 'CUSTOMER':
        return <Navigate to="/customer/dashboard" replace />;
      default:
        return <Navigate to="/" replace />;
    }
  }

  return <>{children}</>;
};
