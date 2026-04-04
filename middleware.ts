import { NextRequest, NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, getAdminSessionSecret } from "@/lib/auth-shared";

function base64UrlToBase64(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4;
  return padding ? normalized.padEnd(normalized.length + (4 - padding), "=") : normalized;
}

async function signValue(value: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(getAdminSessionSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  const bytes = new Uint8Array(signature);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function isAuthenticated(req: NextRequest) {
  const token = req.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  if (!token) return false;

  const [adminUserId, signature] = token.split(".");
  if (!adminUserId || !signature) return false;

  const expected = await signValue(adminUserId);
  return base64UrlToBase64(signature) === base64UrlToBase64(expected);
}

function isProtectedPage(pathname: string) {
  return pathname === "/admin" || pathname.startsWith("/admin/") || pathname === "/device";
}

function isProtectedApi(pathname: string) {
  if (pathname.startsWith("/api/admin/")) return true;
  if (pathname.startsWith("/api/faces")) return true;
  if (pathname.startsWith("/api/alerts")) return true;
  if (pathname.startsWith("/api/layout/rooms")) return true;
  if (pathname.startsWith("/api/identify")) return true;
  if (pathname.startsWith("/api/devices")) return true;
  if (pathname === "/api/floors" || pathname.startsWith("/api/floors/")) return true;
  return false;
}

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const authenticated = await isAuthenticated(req);

  if (isProtectedPage(pathname) && !authenticated) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname.startsWith("/api/") && isProtectedApi(pathname) && !authenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/device", "/login", "/api/:path*"],
};
