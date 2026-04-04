import { decryptJson, decryptString, encryptJson, encryptString } from "@/lib/crypto";

export function encryptOptionalString(value: string | null | undefined) {
  if (!value || !value.trim()) return { encrypted: null, iv: null };
  const encrypted = encryptString(value.trim());
  return { encrypted: Buffer.from(encrypted.data), iv: Buffer.from(encrypted.iv) };
}

export function decryptOptionalString(data: Buffer | Uint8Array | null | undefined, iv: Buffer | Uint8Array | null | undefined, fallback: string | null = null) {
  if (!data || !iv) return fallback;
  return decryptString(data, iv);
}

export function encryptAlertPayload(payload: {
  subjectName: string;
  deviceName: string | null;
  note: string | null;
  faceImage: string | null;
}) {
  const encrypted = encryptJson(payload);
  return {
    data: Buffer.from(encrypted.data),
    iv: Buffer.from(encrypted.iv),
  };
}

export function decryptAlertPayload(
  data: Buffer | Uint8Array | null | undefined,
  iv: Buffer | Uint8Array | null | undefined,
  fallback: {
    subjectName: string;
    deviceName: string | null;
    note: string | null;
    faceImage: string | null;
  }
) {
  if (!data || !iv) return fallback;
  return decryptJson<typeof fallback>(data, iv);
}
