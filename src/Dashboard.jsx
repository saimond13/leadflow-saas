import { useState, useEffect, useMemo } from "react";

// ============================================================
// API CONFIGURATION
// ============================================================
const API_BASE = import.meta.env.VITE_API_BASE || "http://129.121.51.150/webhook";
const LOGIN_URL = `${API_BASE}/api-login`;
const UPDATE_LEAD_URL = `${API_BASE}/api-update-lead`;

function getLeadsURL() {
  const id = safeStr(localStorage.getItem("inmobiliaria_id"));
  return `${API_BASE}/api-leads?inmobiliaria_id=${id}`;
}

// ============================================================
// SAFE UTILITY FUNCTIONS (defensive — never crash)
// ============================================================

/** Safe string: always returns a string, strips n8n expression residue */
function safeStr(value) {
  if (value === null || value === undefined) return "";
  const s = String(value);
  // Strip unresolved n8n expressions like "{{ $json.nombre }}"
  if (s.includes("{{") && s.includes("}}")) return "";
  return s;
}

/** Safe first character (for avatars) */
function safeInitial(value) {
  const s = safeStr(value);
  return s.length > 0 ? s.charAt(0).toUpperCase() : "?";
}

/** Classify lead type from message text using keyword matching */
function classifyFromMessage(mensaje) {
  if (!mensaje || typeof mensaje !== "string") return "";
  const m = mensaje.toLowerCase();
  if (m.includes("comprar") || m.includes("compra")) return "comprar";
  if (m.includes("vender") || m.includes("venta") || m.includes("vendo")) return "vender";
  if (m.includes("alquilar") || m.includes("alquiler") || m.includes("alquilo")) return "alquilar";
  return "";
}

/** Unwrap a single item from n8n's { json: {...}, pairedItem: {...} } wrapper */
function unwrapN8n(item) {
  if (item && typeof item === "object" && item.json && typeof item.json === "object") {
    return item.json;
  }
  return item;
}

/** Normalize a raw lead from the API into a consistent shape */
function normalizeLead(raw, index) {
  const lead = unwrapN8n(raw);
  if (!lead || typeof lead !== "object") return null;

  const nombre = safeStr(lead.nombre);
  const telefono = safeStr(lead.telefono);
  const propiedad = safeStr(lead.propiedad);
  const mensaje = safeStr(lead.mensaje);

  // Handle "Tipo" (capital T from n8n Data Table) and "tipo" and "tipo_lead"
  let tipo = safeStr(lead.tipo_lead || lead.Tipo || lead.tipo).toLowerCase();

  // If tipo is empty or an unresolved expression, try to classify from message
  if (!tipo) {
    tipo = classifyFromMessage(mensaje);
  }

  // Validate tipo is one of the known values
  if (!["comprar", "alquilar", "vender"].includes(tipo)) {
    tipo = classifyFromMessage(mensaje) || "alquilar";
  }

  return {
    id: lead.id ?? index + 1,
    nombre: nombre || "Sin nombre",
    telefono: telefono || "—",
    propiedad: propiedad || "—",
    mensaje: mensaje,
    tipo_lead: tipo,
    inmobiliaria_id: safeStr(lead.inmobiliaria_id),
    status: safeStr(lead.status).toLowerCase() || "nuevo",
    created_at: safeStr(lead.created_at || lead.createdAt) || new Date().toISOString(),
  };
}

// ============================================================
// DATE FORMATTING
// ============================================================

const formatDate = (dateStr) => {
  const s = safeStr(dateStr);
  if (!s) return "—";
  const d = new Date(s);
  if (isNaN(d.getTime())) return "—";
  const now = new Date();
  const diff = now - d;
  if (diff < 3600000) return `hace ${Math.max(1, Math.floor(diff / 60000))}m`;
  if (diff < 86400000) return `hace ${Math.floor(diff / 3600000)}h`;
  return d.toLocaleDateString("es-AR", { day: "numeric", month: "short" });
};

const formatFullDate = (dateStr) => {
  const s = safeStr(dateStr);
  if (!s) return "—";
  const d = new Date(s);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-AR", { weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" });
};

// ============================================================
// CONFIG MAPS
// ============================================================

const typeConfig = {
  comprar: { label: "Comprar", color: "#22c55e", bg: "rgba(34,197,94,0.1)", border: "rgba(34,197,94,0.2)" },
  alquilar: { label: "Alquilar", color: "#3b82f6", bg: "rgba(59,130,246,0.1)", border: "rgba(59,130,246,0.2)" },
  vender: { label: "Vender", color: "#f59e0b", bg: "rgba(245,158,11,0.1)", border: "rgba(245,158,11,0.2)" },
};

const statusConfig = {
  nuevo: { label: "Nuevo", color: "#a78bfa", bg: "rgba(167,139,250,0.08)" },
  contactado: { label: "Contactado", color: "#38bdf8", bg: "rgba(56,189,248,0.08)" },
  calificado: { label: "Calificado", color: "#fb923c", bg: "rgba(251,146,60,0.08)" },
  convertido: { label: "Convertido", color: "#4ade80", bg: "rgba(74,222,128,0.08)" },
};

const getTypeConfig = (tipo) => typeConfig[tipo] || typeConfig.alquilar;
const getStatusConfig = (status) => statusConfig[status] || statusConfig.nuevo;

// ============================================================
// ICONS
// ============================================================

const Icons = {
  Dashboard: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
  Leads: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>,
  Settings: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>,
  Search: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>,
  Bell: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>,
  Close: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>,
  ArrowUp: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5"/><path d="M5 12l7-7 7 7"/></svg>,
  ArrowDown: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14"/><path d="M19 12l-7 7-7-7"/></svg>,
  Phone: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>,
  Calendar: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/></svg>,
  Home: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  Mail: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>,
  Menu: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M3 12h18"/><path d="M3 6h18"/><path d="M3 18h18"/></svg>,
  Lock: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>,
  Eye: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
  Logout: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
};

// ============================================================
// CSS
// ============================================================

const globalCSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700&family=JetBrains+Mono:wght@400;500&display=swap');

  * { margin: 0; padding: 0; box-sizing: border-box; }

  :root {
    --bg-root: #09090b;
    --bg-surface: #0f0f12;
    --bg-elevated: #18181b;
    --bg-hover: #1f1f23;
    --bg-active: #27272a;
    --border: rgba(255,255,255,0.06);
    --border-strong: rgba(255,255,255,0.1);
    --text-primary: #fafafa;
    --text-secondary: #a1a1aa;
    --text-tertiary: #71717a;
    --accent: #6366f1;
    --accent-hover: #818cf8;
    --accent-glow: rgba(99,102,241,0.15);
    --danger: #ef4444;
    --font-sans: 'DM Sans', -apple-system, sans-serif;
    --font-mono: 'JetBrains Mono', monospace;
    --radius-sm: 6px;
    --radius-md: 10px;
    --radius-lg: 14px;
    --radius-xl: 18px;
    --transition: 150ms cubic-bezier(0.4, 0, 0.2, 1);
  }

  body, #root { font-family: var(--font-sans); background: var(--bg-root); color: var(--text-primary); -webkit-font-smoothing: antialiased; }
  input, select { font-family: var(--font-sans); }
  ::-webkit-scrollbar { width: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: var(--border-strong); border-radius: 3px; }

  @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes slideInRight { from { opacity: 0; transform: translateX(24px); } to { opacity: 1; transform: translateX(0); } }
  @keyframes spin { to { transform: rotate(360deg); } }

  .fade-in { animation: fadeIn 0.4s ease both; }
  .slide-right { animation: slideInRight 0.35s ease both; }
`;

// ============================================================
// LOGIN PAGE
// ============================================================

function LoginPage({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setLoginError("");

    try {
      const res = await fetch(LOGIN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const raw = await res.json();
      const data = unwrapN8n(raw);

      if (data.success) {
        localStorage.setItem("token", safeStr(data.token) || "session");
        localStorage.setItem("inmobiliaria_id", safeStr(data.inmobiliaria_id));
        localStorage.setItem("inmobiliaria_nombre", safeStr(data.inmobiliaria_nombre || data.nombre));
        localStorage.setItem("user_email", safeStr(data.user_email) || email);
        onLogin();
      } else {
        setLoginError(data.message || "Credenciales incorrectas");
      }
    } catch (err) {
      console.error("Login failed:", err);
      setLoginError("Error de conexión. Intente nuevamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-root)", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: "-30%", left: "50%", transform: "translateX(-50%)", width: "600px", height: "600px", background: "radial-gradient(circle, rgba(99,102,241,0.08) 0%, transparent 70%)", pointerEvents: "none" }} />
      <div className="fade-in" style={{ width: "100%", maxWidth: "400px", padding: "0 24px" }}>
        <div style={{ textAlign: "center", marginBottom: "40px" }}>
          <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "48px", height: "48px", borderRadius: "var(--radius-md)", background: "linear-gradient(135deg, var(--accent), #a78bfa)", marginBottom: "20px" }}><Icons.Home /></div>
          <h1 style={{ fontSize: "22px", fontWeight: 600, letterSpacing: "-0.02em", color: "var(--text-primary)" }}>LeadFlow</h1>
          <p style={{ fontSize: "14px", color: "var(--text-tertiary)", marginTop: "6px" }}>Gestión de Leads Inmobiliarios</p>
        </div>
        <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-xl)", padding: "32px" }}>
          <form onSubmit={handleSubmit}>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 500, color: "var(--text-secondary)", marginBottom: "6px" }}>Email</label>
            <div style={{ position: "relative", marginBottom: "20px" }}>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@empresa.com" required
                style={{ width: "100%", padding: "10px 12px 10px 36px", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", color: "var(--text-primary)", fontSize: "14px", outline: "none", transition: "border-color var(--transition)" }}
                onFocus={(e) => e.target.style.borderColor = "var(--accent)"} onBlur={(e) => e.target.style.borderColor = "var(--border)"} />
              <div style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--text-tertiary)" }}><Icons.Mail /></div>
            </div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 500, color: "var(--text-secondary)", marginBottom: "6px" }}>Contraseña</label>
            <div style={{ position: "relative", marginBottom: "8px" }}>
              <input type={showPass ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required
                style={{ width: "100%", padding: "10px 40px 10px 36px", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", color: "var(--text-primary)", fontSize: "14px", outline: "none", transition: "border-color var(--transition)" }}
                onFocus={(e) => e.target.style.borderColor = "var(--accent)"} onBlur={(e) => e.target.style.borderColor = "var(--border)"} />
              <div style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--text-tertiary)" }}><Icons.Lock /></div>
              <button type="button" onClick={() => setShowPass(!showPass)} style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "var(--text-tertiary)", cursor: "pointer", padding: "4px" }}><Icons.Eye /></button>
            </div>
            {loginError && (
              <p style={{ fontSize: "12px", color: "var(--danger)", marginBottom: "12px", padding: "8px 10px", background: "rgba(239,68,68,0.08)", borderRadius: "var(--radius-sm)", border: "1px solid rgba(239,68,68,0.15)" }}>{loginError}</p>
            )}
            <div style={{ marginTop: loginError ? "0" : "20px" }}>
              <button type="submit" disabled={loading} style={{ width: "100%", padding: "11px", background: loading ? "var(--bg-active)" : "var(--accent)", color: "#fff", border: "none", borderRadius: "var(--radius-md)", fontSize: "14px", fontWeight: 600, cursor: loading ? "wait" : "pointer", transition: "all var(--transition)", fontFamily: "var(--font-sans)", letterSpacing: "-0.01em", boxShadow: loading ? "none" : "0 0 20px var(--accent-glow)" }}>
                {loading ? "Iniciando sesión..." : "Iniciar sesión"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// SMALL COMPONENTS
// ============================================================

function KPICard({ label, value, change, delay = 0 }) {
  const isPositive = change >= 0;
  return (
    <div className="fade-in" style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "22px 24px", animationDelay: `${delay}ms`, flex: "1 1 200px", minWidth: "180px" }}>
      <p style={{ fontSize: "12px", fontWeight: 500, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "10px" }}>{label}</p>
      <div style={{ display: "flex", alignItems: "baseline", gap: "10px" }}>
        <span style={{ fontSize: "30px", fontWeight: 700, letterSpacing: "-0.03em", color: "var(--text-primary)", fontFamily: "var(--font-sans)" }}>{value}</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: "2px", fontSize: "12px", fontWeight: 600, color: isPositive ? "#4ade80" : "#f87171", padding: "2px 6px", borderRadius: "var(--radius-sm)", background: isPositive ? "rgba(74,222,128,0.08)" : "rgba(248,113,113,0.08)" }}>
          {isPositive ? <Icons.ArrowUp /> : <Icons.ArrowDown />}{Math.abs(change)}%
        </span>
      </div>
    </div>
  );
}

function TypeBadge({ type }) {
  const cfg = getTypeConfig(type);
  return <span style={{ display: "inline-block", padding: "3px 10px", fontSize: "11px", fontWeight: 600, borderRadius: "20px", color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}`, letterSpacing: "0.02em", textTransform: "uppercase" }}>{cfg.label}</span>;
}

function StatusBadge({ status }) {
  const cfg = getStatusConfig(status);
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", fontSize: "12px", fontWeight: 500, color: cfg.color }}>
      <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: cfg.color, boxShadow: `0 0 6px ${cfg.color}40` }} />
      {cfg.label}
    </span>
  );
}

// ============================================================
// LEAD DETAIL PANEL
// ============================================================

function LeadDetailPanel({ lead, onClose, onStatusUpdate }) {
  const [updating, setUpdating] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [statusMsgType, setStatusMsgType] = useState("");

  if (!lead) return null;
  const cfg = getTypeConfig(lead.tipo_lead);

  const statusOptions = [
    { value: "nuevo", label: "Nuevo" },
    { value: "contactado", label: "Contactado" },
    { value: "calificado", label: "Calificado" },
    { value: "convertido", label: "Convertido" },
  ];

  const handleStatusChange = async (newStatus) => {
    if (newStatus === lead.status || updating) return;
    setUpdating(true);
    setStatusMsg("");

    try {
      const res = await fetch(UPDATE_LEAD_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lead_id: lead.id, status: newStatus }),
      });
      const data = await res.json();

      if (res.ok && (data.success !== false)) {
        onStatusUpdate(lead.id, newStatus);
        setStatusMsg("Estado actualizado correctamente");
        setStatusMsgType("success");
      } else {
        setStatusMsg("Error actualizando estado");
        setStatusMsgType("error");
      }
    } catch (err) {
      console.error("Status update failed:", err);
      setStatusMsg("Error actualizando estado");
      setStatusMsgType("error");
    } finally {
      setUpdating(false);
      setTimeout(() => setStatusMsg(""), 3000);
    }
  };

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 90, backdropFilter: "blur(4px)" }} />
      <div className="slide-right" style={{ position: "fixed", right: 0, top: 0, bottom: 0, width: "min(460px, 90vw)", background: "var(--bg-surface)", borderLeft: "1px solid var(--border)", zIndex: 100, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 24px", borderBottom: "1px solid var(--border)" }}>
          <h2 style={{ fontSize: "16px", fontWeight: 600, letterSpacing: "-0.01em" }}>Detalle del lead</h2>
          <button onClick={onClose} style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "6px", cursor: "pointer", color: "var(--text-secondary)", display: "flex", transition: "all var(--transition)" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-hover)"; e.currentTarget.style.color = "var(--text-primary)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "var(--bg-elevated)"; e.currentTarget.style.color = "var(--text-secondary)"; }}
          ><Icons.Close /></button>
        </div>

        <div style={{ flex: 1, overflow: "auto", padding: "24px" }}>
          <div style={{ marginBottom: "24px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
              <div style={{ width: "40px", height: "40px", borderRadius: "50%", background: `linear-gradient(135deg, ${cfg.color}30, ${cfg.color}10)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px", fontWeight: 700, color: cfg.color }}>
                {safeInitial(lead.nombre)}
              </div>
              <div><h3 style={{ fontSize: "18px", fontWeight: 600, letterSpacing: "-0.02em" }}>{lead.nombre}</h3></div>
            </div>
            <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
              <TypeBadge type={lead.tipo_lead} />
              <StatusBadge status={lead.status} />
            </div>
          </div>

          <div style={{ display: "grid", gap: "1px", background: "var(--border)", borderRadius: "var(--radius-md)", overflow: "hidden", marginBottom: "24px" }}>
            {[
              { icon: <Icons.Phone />, label: "Teléfono", value: lead.telefono },
              { icon: <Icons.Home />, label: "Propiedad", value: lead.propiedad },
              { icon: <Icons.Calendar />, label: "Fecha", value: formatFullDate(lead.created_at) },
            ].map((item, i) => (
              <div key={i} style={{ background: "var(--bg-elevated)", padding: "14px 16px", display: "flex", alignItems: "center", gap: "12px" }}>
                <span style={{ color: "var(--text-tertiary)" }}>{item.icon}</span>
                <div>
                  <p style={{ fontSize: "11px", color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "2px" }}>{item.label}</p>
                  <p style={{ fontSize: "14px", color: "var(--text-primary)", fontWeight: 500 }}>{item.value}</p>
                </div>
              </div>
            ))}
          </div>

          <div>
            <p style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "10px" }}>Mensaje</p>
            <div style={{ background: "var(--bg-elevated)", borderRadius: "var(--radius-md)", padding: "16px", border: "1px solid var(--border)", lineHeight: 1.6 }}>
              <p style={{ fontSize: "14px", color: "var(--text-secondary)" }}>{lead.mensaje || "—"}</p>
            </div>
          </div>

          <div style={{ marginTop: "24px" }}>
            <p style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "10px" }}>Clasificación IA</p>
            <div style={{ background: cfg.bg, borderRadius: "var(--radius-md)", padding: "14px 16px", border: `1px solid ${cfg.border}`, display: "flex", alignItems: "center", gap: "10px" }}>
              <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: cfg.color }} />
              <span style={{ fontSize: "14px", fontWeight: 600, color: cfg.color }}>{cfg.label}</span>
              <span style={{ fontSize: "12px", color: "var(--text-tertiary)", marginLeft: "auto" }}>Auto-clasificado</span>
            </div>
          </div>

          <div style={{ marginTop: "24px" }}>
            <p style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "10px" }}>Estado del lead</p>
            <div style={{ position: "relative" }}>
              <select value={lead.status} onChange={(e) => handleStatusChange(e.target.value)} disabled={updating}
                style={{ width: "100%", padding: "11px 14px", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", color: "var(--text-primary)", fontSize: "14px", fontWeight: 500, fontFamily: "var(--font-sans)", outline: "none", cursor: updating ? "wait" : "pointer", appearance: "none", WebkitAppearance: "none", transition: "border-color var(--transition)" }}
                onFocus={(e) => e.target.style.borderColor = "var(--accent)"} onBlur={(e) => e.target.style.borderColor = "var(--border)"}>
                {statusOptions.map(opt => <option key={opt.value} value={opt.value} style={{ background: "var(--bg-elevated)", color: "var(--text-primary)" }}>{opt.label}</option>)}
              </select>
              <div style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "var(--text-tertiary)" }}>
                {updating ? <div style={{ width: "14px", height: "14px", border: "2px solid var(--border)", borderTopColor: "var(--accent)", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} /> : <Icons.ArrowDown />}
              </div>
            </div>
            {statusMsg && (
              <p style={{ fontSize: "12px", fontWeight: 500, marginTop: "8px", padding: "6px 10px", borderRadius: "var(--radius-sm)", color: statusMsgType === "success" ? "#4ade80" : "var(--danger)", background: statusMsgType === "success" ? "rgba(74,222,128,0.08)" : "rgba(239,68,68,0.08)", border: `1px solid ${statusMsgType === "success" ? "rgba(74,222,128,0.15)" : "rgba(239,68,68,0.15)"}`, animation: "fadeIn 0.3s ease" }}>{statusMsg}</p>
            )}
          </div>
        </div>

        <div style={{ padding: "16px 24px", borderTop: "1px solid var(--border)", display: "flex", gap: "10px" }}>
          <button style={{ flex: 1, padding: "10px", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", color: "var(--text-secondary)", fontSize: "13px", fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-sans)", transition: "all var(--transition)" }}
            onMouseEnter={(e) => e.currentTarget.style.borderColor = "var(--border-strong)"} onMouseLeave={(e) => e.currentTarget.style.borderColor = "var(--border)"}
          >Archivar</button>
          <button style={{ flex: 1, padding: "10px", background: "var(--accent)", border: "none", borderRadius: "var(--radius-md)", color: "#fff", fontSize: "13px", fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-sans)", boxShadow: "0 0 16px var(--accent-glow)", transition: "all var(--transition)" }}
            onMouseEnter={(e) => e.currentTarget.style.background = "var(--accent-hover)"} onMouseLeave={(e) => e.currentTarget.style.background = "var(--accent)"}
          >Contactar lead</button>
        </div>
      </div>
    </>
  );
}

// ============================================================
// MAIN APP
// ============================================================

export default function Dashboard() {
  const [loggedIn, setLoggedIn] = useState(() => !!localStorage.getItem("token"));
  const [page, setPage] = useState("dashboard");
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [sortDir, setSortDir] = useState("desc");
  const [selectedLead, setSelectedLead] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!loggedIn) { setLoading(false); return; }

    async function loadLeads() {
      try {
        setLoading(true);
        setError("");
        const res = await fetch(getLeadsURL());
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const rawArray = Array.isArray(data) ? data : [];
        const normalized = rawArray.map(normalizeLead).filter(Boolean);
        setLeads(normalized);
      } catch (err) {
        console.error("Failed to fetch leads:", err);
        setError("Error al cargar los leads. Verifique su conexión e intente nuevamente.");
        setLeads([]);
      } finally {
        setLoading(false);
      }
    }
    loadLeads();
  }, [loggedIn]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("inmobiliaria_id");
    localStorage.removeItem("inmobiliaria_nombre");
    localStorage.removeItem("user_email");
    setLoggedIn(false);
    setLeads([]);
  };

  const filtered = useMemo(() => {
    let result = [...leads];
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(l => l.nombre.toLowerCase().includes(q) || l.propiedad.toLowerCase().includes(q) || l.telefono.includes(search));
    }
    if (typeFilter !== "all") result = result.filter(l => l.tipo_lead === typeFilter);
    result.sort((a, b) => {
      const da = new Date(a.created_at || 0);
      const db = new Date(b.created_at || 0);
      return sortDir === "desc" ? db - da : da - db;
    });
    return result;
  }, [leads, search, typeFilter, sortDir]);

  const today = leads.filter(l => { try { return new Date(l.created_at).toDateString() === new Date().toDateString(); } catch { return false; } }).length;
  const thisWeek = leads.filter(l => { try { const d = new Date(l.created_at); return d >= new Date(Date.now() - 7 * 86400000); } catch { return false; } }).length;
  const converted = leads.filter(l => l.status === "convertido").length;

  const pageTitles = { dashboard: "Panel", leads: "Leads", settings: "Configuración" };

  if (!loggedIn) return <><style>{globalCSS}</style><LoginPage onLogin={() => setLoggedIn(true)} /></>;

  const userEmail = safeStr(localStorage.getItem("user_email")) || "admin@leadflow.io";
  const inmobiliariaNombre = safeStr(localStorage.getItem("inmobiliaria_nombre")) || "LeadFlow";
  const inmobiliariaId = safeStr(localStorage.getItem("inmobiliaria_id"));

  const navItems = [
    { id: "dashboard", label: "Panel", icon: <Icons.Dashboard /> },
    { id: "leads", label: "Leads", icon: <Icons.Leads /> },
    { id: "settings", label: "Configuración", icon: <Icons.Settings /> },
  ];

  const SidebarContent = () => (
    <>
      <div style={{ padding: "22px 20px", display: "flex", alignItems: "center", gap: "10px", borderBottom: "1px solid var(--border)" }}>
        <div style={{ width: "30px", height: "30px", borderRadius: "var(--radius-sm)", background: "linear-gradient(135deg, var(--accent), #a78bfa)", display: "flex", alignItems: "center", justifyContent: "center" }}><Icons.Home /></div>
        <span style={{ fontSize: "15px", fontWeight: 700, letterSpacing: "-0.02em" }}>LeadFlow</span>
      </div>
      <nav style={{ padding: "12px 10px", flex: 1 }}>
        {navItems.map(item => {
          const active = page === item.id;
          return (
            <button key={item.id} onClick={() => { setPage(item.id); setSidebarOpen(false); }}
              style={{ width: "100%", display: "flex", alignItems: "center", gap: "10px", padding: "9px 12px", marginBottom: "2px", background: active ? "var(--accent-glow)" : "transparent", border: "none", borderRadius: "var(--radius-sm)", color: active ? "var(--accent-hover)" : "var(--text-secondary)", fontSize: "13.5px", fontWeight: active ? 600 : 500, cursor: "pointer", fontFamily: "var(--font-sans)", transition: "all var(--transition)", textAlign: "left" }}
              onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = "var(--bg-hover)"; }}
              onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = "transparent"; }}>
              {item.icon}{item.label}
              {item.id === "leads" && <span style={{ marginLeft: "auto", fontSize: "11px", fontWeight: 600, color: "var(--accent)", background: "var(--accent-glow)", padding: "1px 7px", borderRadius: "10px", fontFamily: "var(--font-mono)" }}>{leads.length}</span>}
            </button>
          );
        })}
      </nav>
      <div style={{ padding: "14px 16px", borderTop: "1px solid var(--border)", display: "flex", alignItems: "center", gap: "10px" }}>
        <div style={{ width: "30px", height: "30px", borderRadius: "50%", background: "linear-gradient(135deg, #6366f1, #a78bfa)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: 700, color: "#fff" }}>{safeInitial(userEmail)}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>{inmobiliariaNombre}</p>
          <p style={{ fontSize: "11px", color: "var(--text-tertiary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{userEmail}</p>
        </div>
        <button onClick={handleLogout} title="Cerrar sesión" style={{ background: "none", border: "none", color: "var(--text-tertiary)", cursor: "pointer", padding: "4px", borderRadius: "var(--radius-sm)", transition: "all var(--transition)" }}
          onMouseEnter={(e) => e.currentTarget.style.color = "var(--danger)"} onMouseLeave={(e) => e.currentTarget.style.color = "var(--text-tertiary)"}
        ><Icons.Logout /></button>
      </div>
    </>
  );

  return (
    <>
      <style>{globalCSS}</style>
      <div style={{ display: "flex", height: "100vh", overflow: "hidden", background: "var(--bg-root)" }}>
        {sidebarOpen && <div onClick={() => setSidebarOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 80, backdropFilter: "blur(2px)" }} />}
        <aside style={{ width: "230px", background: "var(--bg-surface)", borderRight: "1px solid var(--border)", display: "flex", flexDirection: "column", flexShrink: 0 }} className="desktop-sidebar"><SidebarContent /></aside>
        <aside className="slide-right" style={{ position: "fixed", left: 0, top: 0, bottom: 0, width: "260px", background: "var(--bg-surface)", borderRight: "1px solid var(--border)", display: sidebarOpen ? "flex" : "none", flexDirection: "column", zIndex: 85 }}><SidebarContent /></aside>

        <main style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>
          <header style={{ height: "56px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px", flexShrink: 0, background: "var(--bg-surface)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <button onClick={() => setSidebarOpen(true)} className="mobile-menu-btn" style={{ background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer", padding: "4px", display: "none" }}><Icons.Menu /></button>
              <h1 style={{ fontSize: "15px", fontWeight: 600, letterSpacing: "-0.01em" }}>{pageTitles[page] || page}</h1>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <button style={{ position: "relative", background: "none", border: "none", color: "var(--text-tertiary)", cursor: "pointer", padding: "8px", borderRadius: "var(--radius-sm)", transition: "all var(--transition)" }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-hover)"; e.currentTarget.style.color = "var(--text-secondary)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = "var(--text-tertiary)"; }}>
                <Icons.Bell />
                <span style={{ position: "absolute", top: "6px", right: "6px", width: "7px", height: "7px", borderRadius: "50%", background: "var(--accent)", boxShadow: "0 0 6px var(--accent)" }} />
              </button>
            </div>
          </header>

          <div style={{ flex: 1, overflow: "auto", padding: "28px 28px 40px" }}>
            {loading && (
              <div className="fade-in" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 24px", gap: "16px" }}>
                <div style={{ width: "36px", height: "36px", border: "3px solid var(--border)", borderTopColor: "var(--accent)", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                <p style={{ fontSize: "14px", color: "var(--text-secondary)", fontWeight: 500 }}>Cargando leads...</p>
              </div>
            )}

            {!loading && error && (
              <div className="fade-in" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 24px", gap: "16px" }}>
                <div style={{ width: "48px", height: "48px", borderRadius: "50%", background: "rgba(239,68,68,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px" }}>⚠</div>
                <p style={{ fontSize: "14px", color: "var(--danger)", fontWeight: 500 }}>{error}</p>
                <button onClick={() => window.location.reload()} style={{ padding: "8px 20px", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", color: "var(--text-secondary)", fontSize: "13px", fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-sans)", transition: "all var(--transition)" }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--border-strong)"; e.currentTarget.style.color = "var(--text-primary)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text-secondary)"; }}
                >Reintentar</button>
              </div>
            )}

            {!loading && !error && page === "dashboard" && (
              <div>
                <p style={{ fontSize: "13px", color: "var(--text-tertiary)", marginBottom: "24px" }}>Resumen del rendimiento de tu pipeline de leads</p>
                <div style={{ display: "flex", gap: "14px", flexWrap: "wrap", marginBottom: "32px" }}>
                  <KPICard label="Leads hoy" value={today} change={12} delay={0} />
                  <KPICard label="Esta semana" value={thisWeek} change={8} delay={60} />
                  <KPICard label="Este mes" value={leads.length} change={23} delay={120} />
                  <KPICard label="Conversión" value={`${leads.length > 0 ? Math.round((converted / leads.length) * 100) : 0}%`} change={-2} delay={180} />
                </div>

                <div className="fade-in" style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "24px", animationDelay: "240ms" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                    <h3 style={{ fontSize: "14px", fontWeight: 600 }}>Actividad de leads</h3>
                    <span style={{ fontSize: "12px", color: "var(--text-tertiary)" }}>Últimos 7 días</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "flex-end", gap: "6px", height: "120px", padding: "0 4px" }}>
                    {[35, 58, 42, 70, 85, 62, 90].map((h, i) => (
                      <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
                        <div className="fade-in" style={{ width: "100%", maxWidth: "48px", height: `${h}%`, background: i === 6 ? "var(--accent)" : "var(--bg-active)", borderRadius: "4px 4px 2px 2px", transition: "all 0.3s ease", animationDelay: `${300 + i * 60}ms`, boxShadow: i === 6 ? "0 0 12px var(--accent-glow)" : "none" }} />
                        <span style={{ fontSize: "10px", color: "var(--text-tertiary)", fontFamily: "var(--font-mono)" }}>{["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"][i]}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="fade-in" style={{ marginTop: "20px", background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", overflow: "hidden", animationDelay: "360ms" }}>
                  <div style={{ padding: "18px 22px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <h3 style={{ fontSize: "14px", fontWeight: 600 }}>Leads recientes</h3>
                    <button onClick={() => setPage("leads")} style={{ fontSize: "12px", color: "var(--accent)", background: "none", border: "none", cursor: "pointer", fontWeight: 600, fontFamily: "var(--font-sans)" }}>Ver todos →</button>
                  </div>
                  {leads.slice(0, 5).map((lead, i) => (
                    <div key={lead.id} onClick={() => setSelectedLead(lead)} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "14px 22px", borderBottom: i < 4 ? "1px solid var(--border)" : "none", cursor: "pointer", transition: "background var(--transition)" }}
                      onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-hover)"} onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                      <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: `linear-gradient(135deg, ${getTypeConfig(lead.tipo_lead).color}30, ${getTypeConfig(lead.tipo_lead).color}10)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", fontWeight: 700, color: getTypeConfig(lead.tipo_lead).color, flexShrink: 0 }}>
                        {safeInitial(lead.nombre)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>{lead.nombre}</p>
                        <p style={{ fontSize: "12px", color: "var(--text-tertiary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{lead.propiedad}</p>
                      </div>
                      <TypeBadge type={lead.tipo_lead} />
                      <span style={{ fontSize: "11px", color: "var(--text-tertiary)", fontFamily: "var(--font-mono)", flexShrink: 0 }}>{formatDate(lead.created_at)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!loading && !error && page === "leads" && (
              <div>
                <p style={{ fontSize: "13px", color: "var(--text-tertiary)", marginBottom: "20px" }}>Gestiona y hace seguimiento de todos los leads entrantes</p>
                <div style={{ display: "flex", gap: "10px", marginBottom: "18px", flexWrap: "wrap" }}>
                  <div style={{ position: "relative", flex: "1 1 240px", maxWidth: "360px" }}>
                    <input placeholder="Buscar leads..." value={search} onChange={(e) => setSearch(e.target.value)}
                      style={{ width: "100%", padding: "9px 12px 9px 36px", background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", color: "var(--text-primary)", fontSize: "13px", outline: "none", transition: "border-color var(--transition)" }}
                      onFocus={(e) => e.target.style.borderColor = "var(--accent)"} onBlur={(e) => e.target.style.borderColor = "var(--border)"} />
                    <div style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--text-tertiary)" }}><Icons.Search /></div>
                  </div>
                  <div style={{ display: "flex", gap: "6px" }}>
                    {["all", "comprar", "alquilar", "vender"].map(type => (
                      <button key={type} onClick={() => setTypeFilter(type)} style={{ padding: "8px 14px", fontSize: "12px", fontWeight: 600, borderRadius: "var(--radius-md)", cursor: "pointer", fontFamily: "var(--font-sans)", transition: "all var(--transition)", border: "1px solid", ...(typeFilter === type ? { background: "var(--accent-glow)", color: "var(--accent-hover)", borderColor: "rgba(99,102,241,0.3)" } : { background: "var(--bg-surface)", color: "var(--text-tertiary)", borderColor: "var(--border)" }) }}
                        onMouseEnter={(e) => { if (typeFilter !== type) e.currentTarget.style.borderColor = "var(--border-strong)"; }}
                        onMouseLeave={(e) => { if (typeFilter !== type) e.currentTarget.style.borderColor = "var(--border)"; }}>
                        {type === "all" ? "Todos" : typeConfig[type]?.label}
                      </button>
                    ))}
                  </div>
                  <button onClick={() => setSortDir(d => d === "desc" ? "asc" : "desc")} style={{ display: "flex", alignItems: "center", gap: "5px", padding: "8px 12px", fontSize: "12px", fontWeight: 500, background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", color: "var(--text-tertiary)", cursor: "pointer", fontFamily: "var(--font-sans)", transition: "all var(--transition)" }}>
                    {sortDir === "desc" ? <Icons.ArrowDown /> : <Icons.ArrowUp />}Fecha
                  </button>
                </div>

                <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", overflow: "hidden" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1.8fr 1fr 1.5fr 0.8fr 0.8fr 0.7fr", gap: "8px", padding: "12px 22px", borderBottom: "1px solid var(--border)", fontSize: "11px", fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em" }} className="table-header">
                    <span>Nombre</span><span>Teléfono</span><span>Propiedad</span><span>Tipo</span><span>Estado</span><span style={{ textAlign: "right" }}>Fecha</span>
                  </div>
                  {filtered.length === 0 ? (
                    <div style={{ padding: "48px 22px", textAlign: "center", color: "var(--text-tertiary)", fontSize: "13px" }}>No se encontraron leads</div>
                  ) : filtered.map((lead, i) => (
                    <div key={lead.id} className="fade-in table-row" onClick={() => setSelectedLead(lead)} style={{ display: "grid", gridTemplateColumns: "1.8fr 1fr 1.5fr 0.8fr 0.8fr 0.7fr", gap: "8px", padding: "14px 22px", alignItems: "center", borderBottom: i < filtered.length - 1 ? "1px solid var(--border)" : "none", cursor: "pointer", transition: "background var(--transition)", animationDelay: `${i * 30}ms` }}
                      onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-hover)"} onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
                        <div style={{ width: "30px", height: "30px", borderRadius: "50%", background: `linear-gradient(135deg, ${getTypeConfig(lead.tipo_lead).color}30, ${getTypeConfig(lead.tipo_lead).color}10)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: 700, color: getTypeConfig(lead.tipo_lead).color, flexShrink: 0 }}>
                          {safeInitial(lead.nombre)}
                        </div>
                        <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{lead.nombre}</span>
                      </div>
                      <span style={{ fontSize: "12.5px", color: "var(--text-secondary)", fontFamily: "var(--font-mono)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{lead.telefono}</span>
                      <span style={{ fontSize: "13px", color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{lead.propiedad}</span>
                      <TypeBadge type={lead.tipo_lead} />
                      <StatusBadge status={lead.status} />
                      <span style={{ fontSize: "11.5px", color: "var(--text-tertiary)", fontFamily: "var(--font-mono)", textAlign: "right" }}>{formatDate(lead.created_at)}</span>
                    </div>
                  ))}
                </div>
                <p style={{ fontSize: "12px", color: "var(--text-tertiary)", marginTop: "14px", textAlign: "center" }}>Mostrando {filtered.length} de {leads.length} leads</p>
              </div>
            )}

            {!loading && !error && page === "settings" && (
              <div className="fade-in" style={{ maxWidth: "560px" }}>
                <p style={{ fontSize: "13px", color: "var(--text-tertiary)", marginBottom: "28px" }}>Configuración de tu espacio de trabajo LeadFlow</p>
                <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", overflow: "hidden" }}>
                  {[
                    { label: "Endpoint API", value: `GET /webhook/api-leads?inmobiliaria_id=${inmobiliariaId}`, mono: true },
                    { label: "Inmobiliaria ID", value: inmobiliariaId || "—", mono: true },
                    { label: "Inmobiliaria", value: inmobiliariaNombre },
                    { label: "Notificaciones", value: "Telegram — Activo" },
                    { label: "Clasificación IA", value: "Activa — Comprar / Vender / Alquilar" },
                    { label: "Zona horaria", value: "America/Argentina/Buenos_Aires" },
                  ].map((item, i, arr) => (
                    <div key={i} style={{ padding: "16px 22px", borderBottom: i < arr.length - 1 ? "1px solid var(--border)" : "none", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
                      <span style={{ fontSize: "13px", fontWeight: 500, color: "var(--text-secondary)" }}>{item.label}</span>
                      <span style={{ fontSize: "13px", color: "var(--text-primary)", fontFamily: item.mono ? "var(--font-mono)" : "var(--font-sans)", fontWeight: item.mono ? 400 : 500, background: item.mono ? "var(--bg-elevated)" : "transparent", padding: item.mono ? "3px 8px" : 0, borderRadius: "var(--radius-sm)" }}>{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </main>

        <LeadDetailPanel lead={selectedLead} onClose={() => setSelectedLead(null)} onStatusUpdate={(leadId, newStatus) => {
          setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status: newStatus } : l));
          setSelectedLead(prev => prev && prev.id === leadId ? { ...prev, status: newStatus } : prev);
        }} />
      </div>

      <style>{`
        .desktop-sidebar { display: flex !important; }
        .mobile-menu-btn { display: none !important; }
        .table-header, .table-row { grid-template-columns: 1.8fr 1fr 1.5fr 0.8fr 0.8fr 0.7fr !important; }
        @media (max-width: 1024px) {
          .table-header, .table-row { grid-template-columns: 1.5fr 1fr 0.7fr 0.6fr !important; }
          .table-header > :nth-child(2), .table-row > :nth-child(2),
          .table-header > :nth-child(5), .table-row > :nth-child(5) { display: none !important; }
        }
        @media (max-width: 768px) {
          .desktop-sidebar { display: none !important; }
          .mobile-menu-btn { display: flex !important; }
          .table-header, .table-row { grid-template-columns: 1.5fr 1fr 0.6fr !important; }
          .table-header > :nth-child(2), .table-row > :nth-child(2),
          .table-header > :nth-child(3), .table-row > :nth-child(3),
          .table-header > :nth-child(5), .table-row > :nth-child(5) { display: none !important; }
        }
      `}</style>
    </>
  );
}
