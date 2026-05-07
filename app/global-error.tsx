"use client"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html>
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#09090b", color: "#fafafa", display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
        <div style={{ maxWidth: 420, textAlign: "center", padding: "2rem", border: "1px solid #27272a", borderRadius: 12, background: "#18181b" }}>
          <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#7f1d1d", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1rem", fontSize: 20 }}>⚠</div>
          <h2 style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: "0.5rem" }}>Critical error</h2>
          <p style={{ fontSize: "0.875rem", color: "#a1a1aa", marginBottom: "1.5rem" }}>
            {error.message ?? "The application failed to load. Please refresh."}
          </p>
          <button
            onClick={reset}
            style={{ background: "#F38020", color: "white", border: "none", borderRadius: 6, padding: "0.5rem 1.25rem", cursor: "pointer", fontSize: "0.875rem", fontWeight: 500 }}
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  )
}
