import { createHash, timingSafeEqual } from "node:crypto";

export function getConfiguredSecret(name: string): string | null {
  const secret = process.env[name];
  if (!secret || secret !== secret.trim() || Buffer.byteLength(secret, "utf8") < 32 ||
      /default[_-]?secret|change[_-]?me|please[_-]?change/i.test(secret)) {
    return null;
  }
  return secret;
}

export function secretsEqual(value: string, expected: string): boolean {
  if (value.length > 4096) return false;
  return timingSafeEqual(
    createHash("sha256").update(value).digest(),
    createHash("sha256").update(expected).digest()
  );
}
