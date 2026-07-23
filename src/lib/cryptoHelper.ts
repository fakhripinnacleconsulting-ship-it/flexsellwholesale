import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const KEY_ENV = "SHIPROCKET_CONFIG_ENCRYPTION_KEY";

function getEncryptionKey(): Buffer {
  let keyHex = process.env[KEY_ENV];
  if (!keyHex || keyHex.length !== 64) {
    // Fallback derivation from JWT_SECRET / NEXTAUTH_SECRET to avoid crashing when env var is missing during dev
    const secret = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET || "flexsell-shiprocket-default-secret-key-32b";
    keyHex = crypto.createHash("sha256").update(secret).digest("hex");
  }
  return Buffer.from(keyHex, "hex");
}

export function encryptPassword(plaintext: string): string {
  if (!plaintext) return "";
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(plaintext, "utf8", "base64");
  encrypted += cipher.final("base64");
  const authTag = cipher.getAuthTag().toString("base64");
  
  return `${iv.toString("base64")}:${authTag}:${encrypted}`;
}

export function decryptPassword(encryptedStr: string): string {
  if (!encryptedStr) return "";
  // If it's masked or plaintext fallback
  if (encryptedStr === "••••••••" || !encryptedStr.includes(":")) {
    return encryptedStr;
  }
  
  try {
    const parts = encryptedStr.split(":");
    if (parts.length !== 3) return encryptedStr;

    const [ivB64, tagB64, ciphertextB64] = parts;
    const key = getEncryptionKey();
    const iv = Buffer.from(ivB64, "base64");
    const authTag = Buffer.from(tagB64, "base64");

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(ciphertextB64, "base64", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  } catch (err: any) {
    console.error("[cryptoHelper] Decryption failed:", err.message);
    return "";
  }
}
