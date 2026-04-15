// src/setupTests.ts
import '@testing-library/jest-dom'
import { server } from './test/server'

beforeAll(() => server.listen())       // start before all tests
afterEach(() => {
  server.resetHandlers()               // remove per-test overrides
  localStorage.clear()
})
afterAll(() => server.close())         // clean up after all tests