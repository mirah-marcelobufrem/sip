import type { Config } from 'drizzle-kit';

export default {
  schema: './dist/infrastructure/database/schema/*.js',
  out: './src/infrastructure/database/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
} satisfies Config;
