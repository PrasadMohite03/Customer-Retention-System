import { createBrowserRouter } from 'react-router-dom';
import Home from '../pages/Home';
import NotFound from '../pages/NotFound';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Home />,
  },
  // Future roles placeholders
  // { path: '/owner/*', element: <OwnerRoutes /> },
  // { path: '/staff/*', element: <StaffRoutes /> },
  // { path: '/loyalty/:qrToken', element: <CustomerRoutes /> },
  {
    path: '*',
    element: <NotFound />,
  },
]);
