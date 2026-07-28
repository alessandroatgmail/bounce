// src/test/renderWithProviders.tsx
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router'
import { AuthProvider } from '../app/contexts/AuthContext'
import { LanguageProvider, Language } from '../app/contexts/LanguageContext'

interface RenderOptions {
  language?: Language
}

export function renderWithProviders(
  ui: React.ReactElement,
  { language = 'it' }: RenderOptions = {}
) {
  localStorage.setItem('app-language', language)

  return render(
    <MemoryRouter initialEntries={['/login']}>
      <LanguageProvider>
        <AuthProvider>
          {ui}
          {/* fake pages to verify redirect destination */}
          <Routes>
            <Route path="/admin" element={<div>Admin Page</div>} />
            {/* students land on the home route, which hosts the dashboard */}
            <Route path="/" element={<div>Home Page</div>} />
          </Routes>
        </AuthProvider>
      </LanguageProvider>
    </MemoryRouter>
  )
}