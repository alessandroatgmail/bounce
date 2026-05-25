import { Outlet } from 'react-router';
import { Header } from './Header';
import { Footer } from './Footer';
import { Toaster } from './ui/sonner';
import { ScrollToTop } from './ScrollToTop';

export function Layout() {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <div className="bg-yellow-400 text-yellow-900 text-center text-sm font-semibold py-2 px-4">
        ⚠️ This website is a work in progress — for testing purposes only.
      </div>
      <Header />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
      <Toaster />
      <ScrollToTop />
    </div>
  );
}