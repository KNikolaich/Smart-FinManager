import dotenv from "dotenv";

dotenv.config();

export const PORT = 5000;

export const JWT_SECRET = process.env.JWT_SECRET;
// AES-256-CBC requires 32 bytes key
export const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
export const IV_LENGTH = 16; // For AES, this is always 16

if (!JWT_SECRET) {
  console.error("FATAL: JWT_SECRET environment variable is not set. Refusing to start.");
  process.exit(1);
}

if (!ENCRYPTION_KEY) {
  console.error("FATAL: ENCRYPTION_KEY environment variable is not set. Refusing to start.");
  process.exit(1);
}

if (Buffer.from(ENCRYPTION_KEY).length !== 32) {
  console.error("FATAL: ENCRYPTION_KEY must be exactly 32 bytes long for AES-256. Refusing to start.");
  process.exit(1);
}

// Re-export as non-optional strings now that we've validated presence above.
export const JWT_SECRET_VALUE: string = JWT_SECRET;
export const ENCRYPTION_KEY_VALUE: string = ENCRYPTION_KEY;
