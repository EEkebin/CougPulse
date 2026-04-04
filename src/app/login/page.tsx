"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { adminFetch, clearAdminToken, setAdminToken } from "@/lib/admin-client";
import LoadingSpinner from "@/components/LoadingSpinner";

export default function LoginPage() {
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [nextPath, setNextPath] = useState("/admin");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setNextPath(params.get("next") || "/admin");
  }, []);

  useEffect(() => {
    let active = true;

    async function checkExistingToken() {
      const res = await adminFetch("/api/auth/me", { cache: "no-store" });
      if (!active) return;

      if (res.ok) {
        router.replace(nextPath);
        router.refresh();
        return;
      }

      clearAdminToken();
    }

    void checkExistingToken();
    return () => {
      active = false;
    };
  }, [nextPath, router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    if (!res.ok) {
      const payload = await res.json().catch(() => ({ error: "Login failed" }));
      setError(payload.error || "Login failed");
      setSubmitting(false);
      return;
    }

    const payload = await res.json();
    if (payload?.token) {
      setAdminToken(payload.token);
    }

    router.replace(nextPath);
    router.refresh();
  }

  return (
    <main className="ross-shell ross-login-shell">
      <section className="ross-login-card ross-card">
        <div className="ross-top-back-row">
          <Link href="/" className="ross-link-btn ross-top-back-btn">
            {"<- Back To Home Page"}
          </Link>
        </div>

        <div>
          <h1>Admin Login</h1>
          <p className="ross-hint">Sign in to access the security console, layout planner, and protected device tools.</p>
        </div>

        <form className="ross-stack" onSubmit={handleSubmit}>
          <div className="ross-field-group">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="ross-text-input"
              autoComplete="username"
            />
          </div>

          <div className="ross-field-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="ross-text-input"
              autoComplete="current-password"
            />
          </div>

          {error ? <div className="ross-login-error">{error}</div> : null}

          <button className="ross-btn ross-btn-primary" type="submit" disabled={submitting}>
            <span className="ross-btn-content">
              {submitting ? (
                <>
                  <LoadingSpinner className="ross-spinner-sm" />
                  Signing In...
                </>
              ) : (
                "Sign In"
              )}
            </span>
          </button>
        </form>
      </section>
    </main>
  );
}
