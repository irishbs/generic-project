// Pure validation functions. No I/O, so S3 unit tests can call them directly.
// Each returns an error message string, or null when the input is valid.

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(email: unknown): string | null {
  if (typeof email !== "string") return "email must be a string";
  if (email.length > 254) return "email must be at most 254 characters";
  if (!EMAIL_PATTERN.test(email.trim())) return "email is not valid";
  return null;
}

export function validatePassword(password: unknown): string | null {
  if (typeof password !== "string") return "password must be a string";
  if (password.length < 8) return "password must be at least 8 characters";
  // bcrypt only uses the first 72 bytes, so longer passwords would be silently truncated.
  if (Buffer.byteLength(password, "utf8") > 72) return "password must be at most 72 bytes";
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    return "password must contain a letter and a number";
  }
  return null;
}
