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

export function HierarchyFirst() {
  const [data, setData] = useState<BotData>(MOCK);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setData((d) => ({ ...d, uptime: d.uptime + 1 }));
      setTick((t) => t + 1);
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const online = data.status === "connected";

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{ background: "#0b1120", fontFamily: "'Inter', sans-serif" }}
    >
      <div
        style={{
          width: 360,
          background: "#111827",
          borderRadius: 20,
          overflow: "hidden",
          boxShadow: "0 24px 60px rgba(0,0,0,0.5)",
        }}
      >
        {/* HERO STATUS — the dominant read */}
        <div
          style={{
            background: online
              ? "linear-gradient(135deg, #064e3b 0%, #065f46 100%)"
              : "linear-gradient(135deg, #450a0a 0%, #7f1d1d 100%)",
            padding: "36px 28px 32px",
            textAlign: "center",
            borderBottom: online
              ? "1px solid rgba(52,211,153,0.2)"
              : "1px solid rgba(248,113,113,0.2)",
            transition: "background 0.5s ease",
          }}
        >
          <div style={{ fontSize: 13, color: online ? "#6ee7b7" : "#fca5a5", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12, fontWeight: 600 }}>
            Bot Status
          </div>
          <div
            style={{
              fontSize: 36,
              fontWeight: 800,
              color: online ? "#d1fae5" : "#fee2e2",
              lineHeight: 1.1,
              marginBottom: 10,
            }}
          >
            {online ? "Online" : "Offline"}
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: online ? "#34d399" : "#f87171",
                display: "inline-block",
                boxShadow: online ? "0 0 10px #34d399" : "0 0 10px #f87171",
                animation: "pulse 2s infinite",
              }}
            />
            <span style={{ fontSize: 14, color: online ? "#a7f3d0" : "#fca5a5" }}>
              {online ? "Connected & Running" : "Reconnecting..."}
            </span>
          </div>
        </div>

        {/* SECONDARY STATS — supporting grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, background: "#1f2937" }}>
          {[
            { label: "Uptime", value: fmt(data.uptime) },
            { label: "Server", value: data.server },
            {
              label: "Coordinates",
              value: data.coords
                ? `${Math.floor(data.coords.x)}, ${Math.floor(data.coords.y)}, ${Math.floor(data.coords.z)}`
                : "Unknown",
            },
            { label: "Reconnects", value: "0" },
          ].map(({ label, value }) => (
            <div
              key={label}
              style={{
                background: "#111827",
                padding: "18px 20px",
              }}
            >
              <div style={{ fontSize: 11, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600, marginBottom: 6 }}>
                {label}
              </div>
              <div style={{ fontSize: 15, color: "#e5e7eb", fontWeight: 600, wordBreak: "break-all" }}>
                {value}
              </div>
            </div>
          ))}
        </div>

        {/* TERTIARY ACTIONS */}
        <div style={{ padding: "20px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", gap: 10 }}>
            <a
              href="/tutorial"
              style={{
                flex: 1,
                background: "#1f2937",
                border: "1px solid #374151",
                borderRadius: 10,
                padding: "11px 0",
                textAlign: "center",
                fontSize: 13,
                color: "#9ca3af",
                textDecoration: "none",
                fontWeight: 500,
              }}
            >
              Setup Guide
            </a>
            <a
              href="/logs"
              style={{
                flex: 1,
                background: "#1f2937",
                border: "1px solid #374151",
                borderRadius: 10,
                padding: "11px 0",
                textAlign: "center",
                fontSize: 13,
                color: "#9ca3af",
                textDecoration: "none",
                fontWeight: 500,
              }}
            >
              View Logs
            </a>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              style={{
                flex: 1,
                background: "#14532d",
                border: "1px solid #166534",
                borderRadius: 10,
                padding: "11px 0",
                fontSize: 13,
                color: "#86efac",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              ▶ Start
            </button>
            <button
              style={{
                flex: 1,
                background: "#450a0a",
                border: "1px solid #7f1d1d",
                borderRadius: 10,
                padding: "11px 0",
                fontSize: 13,
                color: "#fca5a5",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              ■ Stop
            </button>
          </div>
        </div>

        <div style={{ textAlign: "center", fontSize: 11, color: "#374151", paddingBottom: 16 }}>
          Refreshing every 5s
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
