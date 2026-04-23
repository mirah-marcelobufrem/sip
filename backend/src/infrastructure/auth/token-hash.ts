import { createHash } from 'crypto';

export async function hashToken(token: string): Promise<string> {
  return createHash('sha256').update(token).digest('hex');
}
