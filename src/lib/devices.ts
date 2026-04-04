export const DEVICE_ONLINE_MS = 20_000;

export function isDeviceOnline(lastSeenAt: string | Date | null | undefined) {
  if (!lastSeenAt) return false;
  const timestamp = new Date(lastSeenAt).getTime();
  return Date.now() - timestamp <= DEVICE_ONLINE_MS;
}

export function defaultDeviceName() {
  const suffix = Math.random().toString(16).slice(2, 6).toUpperCase();
  const source = typeof navigator === "undefined" ? "Device" : navigator.userAgent;

  if (/iphone/i.test(source)) return `iPhone-${suffix}`;
  if (/ipad/i.test(source)) return `iPad-${suffix}`;
  if (/android/i.test(source)) return `Android-${suffix}`;
  if (/mac/i.test(source)) return `MacBook-${suffix}`;
  if (/windows/i.test(source)) return `Windows-${suffix}`;
  return `Device-${suffix}`;
}
