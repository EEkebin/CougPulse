"use client";

import { ADMIN_TOKEN_HEADER, ADMIN_TOKEN_STORAGE } from "@/lib/auth-shared";

export function getAdminToken() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ADMIN_TOKEN_STORAGE);
}

export function setAdminToken(token: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ADMIN_TOKEN_STORAGE, token);
}

export function clearAdminToken() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(ADMIN_TOKEN_STORAGE);
}

export function adminFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const token = getAdminToken();
  const headers = new Headers(init.headers);
  if (token) headers.set(ADMIN_TOKEN_HEADER, token);
  return fetch(input, {
    ...init,
    headers,
  });
}
