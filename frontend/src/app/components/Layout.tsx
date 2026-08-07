import { Outlet } from 'react-router';
import { Header } from './Header';
import { Footer } from './Footer';
import { Toaster } from './ui/sonner';
import { ScrollToTop } from './ScrollToTop';
import { CookieBanner } from './CookieBanner';

export function Layout() {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Header />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
      <Toaster />
      <ScrollToTop />
      <CookieBanner />
    </div>
  );
}