import { useEffect, useState } from "react";

type BotData = {
  status: "connected" | "disconnected";
  uptime: number;
  coords: { x: number; y: number; z: number } | null;
  server: string;
};

const MOCK: BotData = {
  status: "connected",
  uptime: 4823,
  coords: { x: 3, y: 109, z: 18 },
  server: "slobtest1.aternos.me",
};

function fmt(s: number) {
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m ${s % 60}s`;
}

export function AffordanceFirst() {
  const [data, setData] = useState<BotData>(MOCK);
  const [botRunning, setBotRunning] = useState(true);

  useEffect(() => {
    const id = setInterval(() => setData((d) => ({ ...d, uptime: d.uptime + 1 })), 1000);
    return () => clearInterval(id);
  }, []);

  const online = data.status === "connected";

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{ background: "#0b1120", fontFamily: "'Inter', sans-serif" }}
    >
      <div style={{ width: 360 }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#f1f5f9" }}>🤖 AFK Bot</div>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              marginTop: 8,
              background: online ? "#052e16" : "#1c0505",
              borderRadius: 999,
              padding: "4px 14px",
              border: online ? "1px solid #166534" : "1px solid #7f1d1d",
            }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: online ? "#22c55e" : "#ef4444",
                display: "inline-block",
              }}
            />
            <span style={{ fontSize: 12, color: online ? "#86efac" : "#fca5a5", fontWeight: 600 }}>
              {online ? "Online & Running" : "Disconnected"}
            </span>
          </div>
        </div>

        {/* Info panel */}
        <div
          style={{
            background: "#111827",
            borderRadius: 16,
            padding: "20px",
            marginBottom: 16,
            border: "1px solid #1f2937",
          }}
        >
          {[
            { label: "Uptime", value: fmt(data.uptime), icon: "⏱" },
            {
              label: "Coordinates",
              value: data.coords
                ? `${Math.floor(data.coords.x)}, ${Math.floor(data.coords.y)}, ${Math.floor(data.coords.z)}`
                : "Searching...",
              icon: "📍",
            },
            { label: "Server", value: data.server, icon: "🌐" },
          ].map(({ label, value, icon }, i, arr) => (
            <div
              key={label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "12px 0",
                borderBottom: i < arr.length - 1 ? "1px solid #1f2937" : "none",
              }}
            >
              <span style={{ fontSize: 18, width: 24, textAlign: "center" }}>{icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 2, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  {label}
                </div>
                <div style={{ fontSize: 14, color: "#e2e8f0", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {value}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* PRIMARY CONTROLS — clearly differentiated */}
        <div
          style={{
            background: "#111827",
            borderRadius: 16,
            padding: "20px",
            marginBottom: 16,
            border: "1px solid #1f2937",
          }}
        >
          <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 14 }}>
            Bot Controls
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            {/* START — high affordance green, disabled when already running */}
            <button
              onClick={() => setBotRunning(true)}
              disabled={botRunning}
              style={{
                flex: 1,
                padding: "14px 0",
                borderRadius: 12,
                border: "none",
                background: botRunning ? "#1f2937" : "linear-gradient(135deg,#16a34a,#15803d)",
                color: botRunning ? "#374151" : "#fff",
                fontSize: 15,
                fontWeight: 700,
                cursor: botRunning ? "not-allowed" : "pointer",
                display: "flex",
                flexDirection: "column" as const,
                alignItems: "center",
                gap: 6,
                transition: "all 0.2s",
                boxShadow: botRunning ? "none" : "0 4px 14px rgba(22,163,74,0.4)",
              }}
            >
              <span style={{ fontSize: 22 }}>▶️</span>
              <span style={{ fontSize: 13 }}>Start</span>
              <span style={{ fontSize: 10, fontWeight: 400, color: botRunning ? "#374151" : "rgba(255,255,255,0.7)" }}>
                {botRunning ? "Already running" : "Launch bot"}
              </span>
            </button>

            {/* STOP — high affordance red, disabled when already stopped */}
            <button
              onClick={() => setBotRunning(false)}
              disabled={!botRunning}
              style={{
                flex: 1,
                padding: "14px 0",
                borderRadius: 12,
                border: "none",
                background: !botRunning ? "#1f2937" : "linear-gradient(135deg,#dc2626,#b91c1c)",
                color: !botRunning ? "#374151" : "#fff",
                fontSize: 15,
                fontWeight: 700,
                cursor: !botRunning ? "not-allowed" : "pointer",
                display: "flex",
                flexDirection: "column" as const,
                alignItems: "center",
                gap: 6,
                transition: "all 0.2s",
                boxShadow: !botRunning ? "none" : "0 4px 14px rgba(220,38,38,0.4)",
              }}
            >
              <span style={{ fontSize: 22 }}>⛔</span>
              <span style={{ fontSize: 13 }}>Stop</span>
              <span style={{ fontSize: 10, fontWeight: 400, color: !botRunning ? "#374151" : "rgba(255,255,255,0.7)" }}>
                {!botRunning ? "Already stopped" : "Halt bot"}
              </span>
            </button>
          </div>
        </div>

        {/* Secondary links */}
        <div style={{ display: "flex", gap: 10 }}>
          <a
            href="/tutorial"
            style={{
              flex: 1,
              background: "#111827",
              borderRadius: 12,
              padding: "12px 0",
              textAlign: "center",
              fontSize: 13,
              color: "#94a3b8",
              textDecoration: "none",
              fontWeight: 500,
              border: "1px solid #1f2937",
            }}
          >
            📘 Setup Guide
          </a>
          <a
            href="/logs"
            style={{
              flex: 1,
              background: "#111827",
              borderRadius: 12,
              padding: "12px 0",
              textAlign: "center",
              fontSize: 13,
              color: "#94a3b8",
              textDecoration: "none",
              fontWeight: 500,
              border: "1px solid #1f2937",
            }}
          >
            📜 View Logs
          </a>
        </div>

        <div style={{ textAlign: "center", fontSize: 11, color: "#374151", marginTop: 14 }}>
          Auto-refreshing every 5s
        </div>
      </div>
    </div>
  );
}
