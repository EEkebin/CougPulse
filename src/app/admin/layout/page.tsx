"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { adminFetch, clearAdminToken } from "@/lib/admin-client";
import FloorLayoutEditor from "@/components/FloorLayoutEditor";
import LoadingSpinner from "@/components/LoadingSpinner";
import type { LayoutFloor } from "@/lib/layout-types";

export default function AdminLayoutPage() {
  const router = useRouter();
  const [floors, setFloors] = useState<LayoutFloor[]>([]);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    let active = true;

    async function boot() {
      const me = await adminFetch("/api/auth/me", { cache: "no-store" });
      if (!active) return;

      if (!me.ok) {
        clearAdminToken();
        router.replace("/login?next=/admin/layout");
        return;
      }

      setAuthReady(true);
      await loadFloors();
    }

    void boot();
    return () => {
      active = false;
    };
  }, [router]);

  async function loadFloors() {
    const res = await fetch("/api/floors", { cache: "no-store" });
    if (res.ok) setFloors(await res.json());
  }

  async function logout() {
    await adminFetch("/api/auth/logout", { method: "POST" });
    clearAdminToken();
    router.replace("/login");
    router.refresh();
  }

  if (!authReady) {
    return (
      <main className="ross-shell ross-login-shell">
        <section className="ross-login-card ross-card">
          <div className="ross-loading-state">
            <LoadingSpinner />
            <h1>Checking Admin Access</h1>
            <p className="ross-hint">Validating your security officer token.</p>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="ross-shell">
      <header className="ross-top-bar">
        <div className="ross-top-bar-left">
          <div className="ross-top-back-row">
            <Link href="/admin" className="ross-link-btn ross-top-back-btn">
              {"<- Back To Security Console"}
            </Link>
          </div>
          <h1>CougPulse Layout Planner</h1>
          <p>Create floors, upload plans, and draw the rooms used by the student heatmap and device assignments.</p>
        </div>
        <div className="ross-top-actions">
          <span className="ross-status-pill">{floors.length} floor{floors.length === 1 ? "" : "s"}</span>
          <Link href="/" className="ross-link-btn">
            Student Heatmap
          </Link>
          <button className="ross-btn" type="button" onClick={logout}>
            Log Out
          </button>
        </div>
      </header>

      <section className="ross-layout-shell">
        <section className="ross-card">
          <div className="ross-card-head">
            <div>
              <h2>Layout Editor</h2>
              <p className="ross-hint">This page is dedicated to map authoring so the editor has room to breathe.</p>
            </div>
            <span className="ross-tool-pill">{floors.reduce((count, floor) => count + floor.rooms.length, 0)} rooms</span>
          </div>
        </section>

        <FloorLayoutEditor floors={floors} onLayoutChange={loadFloors} />
      </section>
    </main>
  );
}
