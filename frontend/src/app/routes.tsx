import { createBrowserRouter } from 'react-router';
import { Home } from './pages/Home';
import { Events } from './pages/Events';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { AdminDashboard } from './pages/AdminDashboard';
import { StudentDashboard } from './pages/StudentDashboard';
import { Layout } from './components/Layout';

export const router = createBrowserRouter([
  {
    path: '/',
    Component: Layout,
    children: [
      {
        index: true,
        Component: Home,
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
        path: 'admin',
        Component: AdminDashboard,
      },
      {
        path: 'student',
        Component: StudentDashboard,
      },
      {
        path: '*',
        Component: NotFound,
      },
    ],
  },
]);

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