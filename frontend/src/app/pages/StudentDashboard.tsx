import { Navigate } from 'react-router';
import { useAuth } from '../contexts/AuthContext';
import { AppShell } from '../components/AppShell';
import { Toaster } from '../components/ui/sonner';

export function StudentDashboard() {
  const { user } = useAuth();

  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'student' && user.role !== 'admin' && user.role !== 'staff') return <Navigate to="/login" replace />;

  return (
    <>
      <Toaster />
      <AppShell />
    </>
  );
}
