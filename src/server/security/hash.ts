import bcrypt from "bcryptjs";

/**
 * Password hashing, mirrors `security/hash.py`. bcrypt hashes are cross-runtime
 * compatible, so hashes written by the FastAPI app verify here and vice versa.
 */

const ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, ROUNDS);
}

export async function checkPassword(password: string, hash: string): Promise<boolean> {
  if (!hash) return false;
  try {
    return await bcrypt.compare(password, hash);
  } catch {
    return false;
  }
}
