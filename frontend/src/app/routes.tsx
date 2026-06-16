import { createBrowserRouter, Navigate } from 'react-router';
import { useAuth } from './contexts/AuthContext';
import { Home } from './pages/Home';
import { Events } from './pages/Events';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { AdminDashboard } from './pages/AdminDashboard';
import { StudentDashboard } from './pages/StudentDashboard';
import { ForgotPassword } from './pages/ForgotPassword';
import { ResetPassword } from './pages/ResetPassword';
import { Layout } from './components/Layout';

export const router = createBrowserRouter([
  {
    path: '/',
    Component: Layout,
    children: [
      {
        index: true,
        Component: HomeRoute,
      },
      {
        path: 'events',
        Component: Events,
      },
      {
        path: 'login',
        Component: Login,
      },
      {
        path: 'register',
        Component: Register,
      },
      {
        path: 'forgot-password',
        Component: ForgotPassword,
      },
      {
        path: 'reset-password/:uid/:token',
        Component: ResetPassword,
      },
      {
        path: 'admin',
        Component: AdminDashboard,
      },
      {
        path: 'student',
        element: <Navigate to="/" replace />,
      },
      {
        path: '*',
        Component: NotFound,
      },
    ],
  },
]);

// Logged-in students (and admins in student view) get the dashboard at /;
// the public landing page is only shown when logged out
function HomeRoute() {
  const { user, adminViewMode } = useAuth();
  const showDashboard =
    user?.role === 'student' || (user?.role === 'admin' && adminViewMode === 'student');
  return showDashboard ? <StudentDashboard /> : <Home />;
}

function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">404 - Page Not Found</h1>
        <p className="text-gray-600 mb-4">The page you're looking for doesn't exist.</p>
        <a href="/" className="text-red-600 hover:underline">
          Go back home
        </a>
      </div>
    </div>
  );
}