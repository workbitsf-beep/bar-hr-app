import { randomInt } from "crypto";

const MIN_TEMPORARY_PASSWORD_LENGTH = 6;
const MAX_BCRYPT_PASSWORD_LENGTH = 72;
const GENERATED_TEMPORARY_PASSWORD_LENGTH = 14;
const TEMPORARY_PASSWORD_ALPHABET =
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";

function readFormValue(formData: FormData, fieldName: string) {
  const value = formData.get(fieldName);

  if (typeof value === "string") {
    return value;
  }

  return null;
}

export function validateTemporaryPassword(password: string) {
  if (password.length === 0) {
    throw new Error("Missing temporary password");
  }

  if (password !== password.trim()) {
    throw new Error("Temporary password cannot start or end with spaces");
  }

  if (password.length < MIN_TEMPORARY_PASSWORD_LENGTH) {
    throw new Error(
      `Temporary password must be at least ${MIN_TEMPORARY_PASSWORD_LENGTH} characters`
    );
  }

  if (password.length > MAX_BCRYPT_PASSWORD_LENGTH) {
    throw new Error(
      `Temporary password must be at most ${MAX_BCRYPT_PASSWORD_LENGTH} characters`
    );
  }

  return password;
}

export function readTemporaryPasswordFromFormData(
  formData: FormData,
  fieldNames = ["temporaryPassword", "initialPassword", "password"]
) {
  for (const fieldName of fieldNames) {
    const value = readFormValue(formData, fieldName);

    if (value !== null) {
      return validateTemporaryPassword(value);
    }
  }

  throw new Error("Missing temporary password");
}

export function createTemporaryPassword() {
  const password = Array.from({ length: GENERATED_TEMPORARY_PASSWORD_LENGTH }, () => {
    const index = randomInt(TEMPORARY_PASSWORD_ALPHABET.length);
    return TEMPORARY_PASSWORD_ALPHABET[index];
  }).join("");

  return validateTemporaryPassword(password);
}

export { MIN_TEMPORARY_PASSWORD_LENGTH };
