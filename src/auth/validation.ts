// Pure validation functions. No I/O, so S3 unit tests can call them directly.
// Each returns an error message string, or null when the input is valid.

const EMAIL_ERROR = "email is not valid";

// Local part: "atoms" of letters, digits, and the RFC 5322 symbols, separated by single dots.
// Angle brackets, quotes, spaces, and non-ASCII characters are not allowed.
const LOCAL_PART = /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*$/;
// Each domain label: letters and digits, hyphens allowed inside but not at the start or end.
const DOMAIN_LABEL = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/;
// Top-level domain: letters only, at least two characters.
const TOP_LEVEL_DOMAIN = /^[A-Za-z]{2,63}$/;

export function validateEmail(email: unknown): string | null {
  if (typeof email !== "string") return "email must be a string";
  const address = email.trim();
  if (address.length > 254) return "email must be at most 254 characters";

  const at = address.indexOf("@");
  // Exactly one @, with text on both sides.
  if (at < 1 || at !== address.lastIndexOf("@") || at === address.length - 1) return EMAIL_ERROR;

  const localPart = address.slice(0, at);
  const domain = address.slice(at + 1);
  if (localPart.length > 64 || !LOCAL_PART.test(localPart)) return EMAIL_ERROR;

  const labels = domain.split(".");
  if (labels.length < 2) return EMAIL_ERROR;
  if (!labels.every((label) => DOMAIN_LABEL.test(label))) return EMAIL_ERROR;
  if (!TOP_LEVEL_DOMAIN.test(labels[labels.length - 1] ?? "")) return EMAIL_ERROR;

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
