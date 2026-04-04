"use client";

import { DEVICE_AUTH_TOKEN_STORAGE, DEVICE_TOKEN_HEADER } from "@/lib/auth-shared";

export function getDeviceAuthToken() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(DEVICE_AUTH_TOKEN_STORAGE);
}

export function setDeviceAuthToken(token: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(DEVICE_AUTH_TOKEN_STORAGE, token);
}

export function clearDeviceAuthToken() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(DEVICE_AUTH_TOKEN_STORAGE);
}

export function deviceFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const token = getDeviceAuthToken();
  const headers = new Headers(init.headers);
  if (token) headers.set(DEVICE_TOKEN_HEADER, token);
  return fetch(input, {
    ...init,
    headers,
  });
}
