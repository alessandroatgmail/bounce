import { RouterProvider } from 'react-router';
import { AuthProvider } from './contexts/AuthContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { router } from './routes';
// Chatbot temporarily hidden — implementation still in progress.
// import { Chatbot } from './components/Chatbot';

export default function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <RouterProvider router={router} />
        {/* <Chatbot /> */}
      </AuthProvider>
    </LanguageProvider>
  );
}