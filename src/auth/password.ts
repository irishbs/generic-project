import bcrypt from "bcryptjs";

// Cost factor: how many rounds of hashing. Higher is slower to brute-force, slower to log in.
const COST = 12;

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, COST);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// A real hash of a random string. Login checks against this when the email is unknown,
// so an attacker can't tell "no such user" apart from "wrong password" by timing.
export const DUMMY_HASH = bcrypt.hashSync("not-a-real-password-" + Math.random(), COST);
