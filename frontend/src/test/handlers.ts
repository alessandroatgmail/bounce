// src/test/handlers.ts
import { http, HttpResponse } from 'msw'

export const handlers = [
  // default handlers — can be overridden in individual tests
  http.post('/api/auth/token/', () => {
    return HttpResponse.json({
      access: 'fake-access-token',
      refresh: 'fake-refresh-token',
    })
  }),
]