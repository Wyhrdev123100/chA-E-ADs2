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
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m ${sec}s`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec} seconds`;
}

export function AccessibilityFirst() {
  const [data, setData] = useState<BotData>(MOCK);

  useEffect(() => {
    const id = setInterval(() => setData((d) => ({ ...d, uptime: d.uptime + 1 })), 1000);
    return () => clearInterval(id);
  }, []);

  const online = data.status === "connected";

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{
        /* Solid near-black background — WCAG contrast baseline */
        background: "#0d1117",
        fontFamily: "'Inter', -apple-system, sans-serif",
        padding: "24px",
      }}
    >
      <main
        role="main"
        aria-label="AFK Bot Dashboard"
        style={{ width: 360 }}
      >
        {/* Page title — clear, sentence-case, no emoji clutter */}
        <header style={{ marginBottom: 28 }}>
          <h1
            style={{
              fontSize: 26,
              fontWeight: 700,
              color: "#f0f6fc",
              margin: 0,
              lineHeight: 1.2,
            }}
          >
            AFK Bot Dashboard
          </h1>
          <p style={{ fontSize: 14, color: "#8b949e", margin: "6px 0 0", lineHeight: 1.5 }}>
            Minecraft server bot · Live status
          </p>
        </header>

        {/* STATUS — high contrast, role=status for screen readers */}
        <section
          role="status"
          aria-live="polite"
          aria-label="Bot connection status"
          style={{
            background: online ? "#0d2218" : "#200d0d",
            border: `2px solid ${online ? "#238636" : "#da3633"}`,
            borderRadius: 12,
            padding: "20px 24px",
            marginBottom: 16,
            display: "flex",
            alignItems: "center",
            gap: 16,
          }}
        >
          <div
            aria-hidden="true"
            style={{
              width: 44,
              height: 44,
              borderRadius: "50%",
              background: online ? "#238636" : "#da3633",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 20,
              flexShrink: 0,
            }}
          >
            {online ? "✓" : "✗"}
          </div>
          <div>
            <div
              style={{
                fontSize: 18,
                fontWeight: 700,
                /* WCAG AA: contrast ratio > 4.5:1 on dark bg */
                color: online ? "#3fb950" : "#f85149",
                lineHeight: 1.2,
              }}
            >
              {online ? "Connected" : "Disconnected"}
            </div>
            <div style={{ fontSize: 13, color: "#8b949e", marginTop: 3 }}>
              {online ? "Bot is active on the server" : "Attempting to reconnect"}
            </div>
          </div>
        </section>

        {/* DATA FIELDS — clear label above value, high-contrast values */}
        <section aria-label="Bot statistics">
          <dl style={{ margin: 0 }}>
            {[
              {
                term: "Uptime",
                definition: fmt(data.uptime),
                detail: "Time since last connection",
              },
              {
                term: "Coordinates",
                definition: data.coords
                  ? `X ${Math.floor(data.coords.x)}, Y ${Math.floor(data.coords.y)}, Z ${Math.floor(data.coords.z)}`
                  : "Searching…",
                detail: "Bot's current in-game position",
              },
              {
                term: "Server address",
                definition: data.server,
                detail: "Minecraft server hostname",
              },
            ].map(({ term, definition, detail }) => (
              <div
                key={term}
                style={{
                  background: "#161b22",
                  border: "1px solid #21262d",
                  borderRadius: 10,
                  padding: "16px 20px",
                  marginBottom: 10,
                }}
              >
                <dt
                  style={{
                    fontSize: 12,
                    color: "#8b949e",
                    fontWeight: 600,
                    marginBottom: 4,
                    /* NOT all-caps — preserves readability for screen readers & dyslexia */
                  }}
                >
                  {term}
                </dt>
                <dd
                  style={{
                    margin: 0,
                    fontSize: 17,
                    fontWeight: 600,
                    /* High contrast: #e6edf3 on #161b22 = ~11:1 ratio */
                    color: "#e6edf3",
                    lineHeight: 1.3,
                  }}
                >
                  {definition}
                </dd>
                <p style={{ margin: "4px 0 0", fontSize: 11, color: "#6e7681" }}>{detail}</p>
              </div>
            ))}
          </dl>
        </section>

        {/* CONTROLS — large tap targets, semantic buttons */}
        <section aria-label="Bot controls" style={{ marginTop: 8 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
            <button
              aria-label="Start bot"
              style={{
                /* Minimum 44px height per WCAG 2.5.5 */
                minHeight: 52,
                borderRadius: 10,
                border: "2px solid #238636",
                background: "#0d2218",
                color: "#3fb950",
                fontSize: 15,
                fontWeight: 700,
                cursor: "pointer",
                letterSpacing: 0.3,
              }}
            >
              Start bot
            </button>
            <button
              aria-label="Stop bot"
              style={{
                minHeight: 52,
                borderRadius: 10,
                border: "2px solid #da3633",
                background: "#200d0d",
                color: "#f85149",
                fontSize: 15,
                fontWeight: 700,
                cursor: "pointer",
                letterSpacing: 0.3,
              }}
            >
              Stop bot
            </button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <a
              href="/tutorial"
              aria-label="View setup guide"
              style={{
                minHeight: 44,
                borderRadius: 10,
                border: "1px solid #21262d",
                background: "#161b22",
                color: "#8b949e",
                fontSize: 13,
                fontWeight: 500,
                textDecoration: "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              Setup guide
            </a>
            <a
              href="/logs"
              aria-label="View bot logs"
              style={{
                minHeight: 44,
                borderRadius: 10,
                border: "1px solid #21262d",
                background: "#161b22",
                color: "#8b949e",
                fontSize: 13,
                fontWeight: 500,
                textDecoration: "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              View logs
            </a>
          </div>
        </section>

        <footer style={{ marginTop: 20, textAlign: "center" }}>
          <p style={{ fontSize: 12, color: "#484f58", margin: 0 }}>
            Status updates every 5 seconds
          </p>
        </footer>
      </main>
    </div>
  );
}
