export default async function globalSetup() {
  process.env.DATABASE_URL =
    process.env.DATABASE_URL ?? 'postgresql://sip:sip@localhost:5432/sip_test';
  process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long!!';
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-at-least-32-chars!';
  process.env.NODE_ENV = 'test';
}
