// src/test/server.ts
import { setupServer } from 'msw/node'
import { handlers } from './handlers'

// create the mock server with the default handlers
export const server = setupServer(...handlers)