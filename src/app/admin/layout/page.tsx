"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import FloorLayoutEditor from "@/components/FloorLayoutEditor";
import type { LayoutFloor } from "@/lib/layout-types";

export default function AdminLayoutPage() {
  const router = useRouter();
  const [floors, setFloors] = useState<LayoutFloor[]>([]);

  useEffect(() => {
    void loadFloors();
  }, []);

  async function loadFloors() {
    const res = await fetch("/api/floors", { cache: "no-store" });
    if (res.ok) setFloors(await res.json());
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <main className="ross-shell">
      <header className="ross-top-bar">
        <div>
          <h1>CougPulse Layout Planner</h1>
          <p>Create floors, upload plans, and draw the rooms used by the student heatmap and device assignments.</p>
        </div>
        <div className="ross-top-actions">
          <span className="ross-status-pill">{floors.length} floor{floors.length === 1 ? "" : "s"}</span>
          <Link href="/admin" className="ross-link-btn">
            Security Console
          </Link>
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
