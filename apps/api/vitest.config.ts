import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'file:./test.db',
      JWT_SECRET: 'vitest-secret-com-no-minimo-32-caracteres-para-hs256',
      COOKIE_SECURE: 'false',
      WEB_ORIGIN: 'http://localhost:5173',
    },
    globalSetup: ['./tests/global-setup.ts'],
    fileParallelism: false,
    sequence: { concurrent: false },
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
})
