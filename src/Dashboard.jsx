import { useState, useEffect, useMemo } from "react";

// ============================================================
// API CONFIGURATION
// ============================================================
const API_BASE = import.meta.env.VITE_API_BASE || "http://129.121.51.150/webhook";
const LOGIN_URL = `${API_BASE}/api-login`;
const UPDATE_LEAD_URL = `${API_BASE}/api-update-lead`;
const CREATE_PROPERTY_URL = `${API_BASE}/api-create-propiedad`;
const UPDATE_PROPERTY_URL = `${API_BASE}/api-update-propiedad`;
const NOTES_URL = (leadId) => `${API_BASE}/api-notas-lead?lead_id=${leadId}`;
const CREATE_NOTE_URL = `${API_BASE}/api-crear-nota`;

function getLeadsURL() {
  const id = safeStr(localStorage.getItem("inmobiliaria_id"));
  return `${API_BASE}/api-leads?inmobiliaria_id=${id}`;
}

function getPropertiesURL() {
  const id = safeStr(localStorage.getItem("inmobiliaria_id"));
  return `${API_BASE}/api-propiedades?inmobiliaria_id=${id}`;
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

const operacionConfig = {
  venta: { label: "Venta", color: "#22c55e", bg: "rgba(34,197,94,0.1)", border: "rgba(34,197,94,0.2)" },
  alquiler: { label: "Alquiler", color: "#3b82f6", bg: "rgba(59,130,246,0.1)", border: "rgba(59,130,246,0.2)" },
};

const propiedadEstadoConfig = {
  activa: { label: "Activa", color: "#4ade80" },
  pausada: { label: "Pausada", color: "#fbbf24" },
  vendida: { label: "Vendida", color: "#a78bfa" },
  alquilada: { label: "Alquilada", color: "#38bdf8" },
};

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
  Building: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M12 6h.01"/><path d="M12 10h.01"/><path d="M12 14h.01"/><path d="M16 10h.01"/><path d="M16 14h.01"/><path d="M8 10h.01"/><path d="M8 14h.01"/></svg>,
  Plus: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  Edit: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  Copy: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>,
  WhatsApp: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>,
  Note: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
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
  const [notes, setNotes] = useState([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [newNote, setNewNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [copied, setCopied] = useState(false);

  // Load notes when lead changes
  useEffect(() => {
    if (!lead) return;
    async function loadNotes() {
      try {
        setNotesLoading(true);
        const res = await fetch(NOTES_URL(lead.id));
        if (!res.ok) return;
        const data = await res.json();
        const rawArray = Array.isArray(data) ? data : [];
        const parsed = rawArray.map(item => {
          const n = item.json ? item.json : item;
          return { ...n, texto: safeStr(n.texto), autor: safeStr(n.autor), createdAt: safeStr(n.createdAt) };
        });
        setNotes(parsed);
      } catch (err) {
        console.error("Notes load failed:", err);
      } finally {
        setNotesLoading(false);
      }
    }
    loadNotes();
  }, [lead?.id]);

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
      const res = await fetch(UPDATE_LEAD_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lead_id: lead.id, status: newStatus }) });
      const data = await res.json();
      if (res.ok && (data.success !== false)) {
        onStatusUpdate(lead.id, newStatus);
        setStatusMsg("Estado actualizado");
        setStatusMsgType("success");
      } else { setStatusMsg("Error actualizando"); setStatusMsgType("error"); }
    } catch (err) { setStatusMsg("Error de conexión"); setStatusMsgType("error"); }
    finally { setUpdating(false); setTimeout(() => setStatusMsg(""), 3000); }
  };

  const handleCopyPhone = () => {
    navigator.clipboard.writeText(lead.telefono).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }).catch(() => {});
  };

  const whatsappUrl = lead.telefono && lead.telefono !== "—" ? `https://wa.me/${lead.telefono.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(`Hola ${lead.nombre}, me comunico desde la inmobiliaria por tu consulta.`)}` : null;

  const handleAddNote = async () => {
    if (!newNote.trim() || savingNote) return;
    setSavingNote(true);
    const inmobiliariaId = safeStr(localStorage.getItem("inmobiliaria_id"));
    const autor = safeStr(localStorage.getItem("user_email"));
    try {
      const res = await fetch(CREATE_NOTE_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lead_id: lead.id, inmobiliaria_id: inmobiliariaId, texto: newNote.trim(), autor }) });
      if (res.ok) {
        setNotes(prev => [...prev, { lead_id: lead.id, texto: newNote.trim(), autor, createdAt: new Date().toISOString() }]);
        setNewNote("");
      }
    } catch (err) { console.error("Add note failed:", err); }
    finally { setSavingNote(false); }
  };

  const actionBtnStyle = { display: "flex", alignItems: "center", gap: "6px", padding: "8px 12px", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", color: "var(--text-secondary)", fontSize: "12px", fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-sans)", transition: "all var(--transition)", flex: 1, justifyContent: "center" };

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 90, backdropFilter: "blur(4px)" }} />
      <div className="slide-right" style={{ position: "fixed", right: 0, top: 0, bottom: 0, width: "min(480px, 95vw)", background: "var(--bg-surface)", borderLeft: "1px solid var(--border)", zIndex: 100, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 24px", borderBottom: "1px solid var(--border)" }}>
          <h2 style={{ fontSize: "16px", fontWeight: 600, letterSpacing: "-0.01em" }}>Detalle del lead</h2>
          <button onClick={onClose} style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "6px", cursor: "pointer", color: "var(--text-secondary)", display: "flex", transition: "all var(--transition)" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-hover)"; e.currentTarget.style.color = "var(--text-primary)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "var(--bg-elevated)"; e.currentTarget.style.color = "var(--text-secondary)"; }}
          ><Icons.Close /></button>
        </div>

        <div style={{ flex: 1, overflow: "auto", padding: "24px" }}>
          {/* Name & badges */}
          <div style={{ marginBottom: "20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
              <div style={{ width: "40px", height: "40px", borderRadius: "50%", background: `linear-gradient(135deg, ${cfg.color}30, ${cfg.color}10)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px", fontWeight: 700, color: cfg.color }}>
                {safeInitial(lead.nombre)}
              </div>
              <div><h3 style={{ fontSize: "18px", fontWeight: 600, letterSpacing: "-0.02em" }}>{lead.nombre}</h3></div>
            </div>
            <div style={{ display: "flex", gap: "8px", marginTop: "10px" }}>
              <TypeBadge type={lead.tipo_lead} />
              <StatusBadge status={lead.status} />
            </div>
          </div>

          {/* Quick actions */}
          <div style={{ display: "flex", gap: "8px", marginBottom: "20px" }}>
            {whatsappUrl && (
              <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" style={{ ...actionBtnStyle, background: "rgba(37,211,102,0.1)", borderColor: "rgba(37,211,102,0.2)", color: "#25D366", textDecoration: "none" }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(37,211,102,0.2)"; }} onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(37,211,102,0.1)"; }}>
                <Icons.WhatsApp /> WhatsApp
              </a>
            )}
            <button onClick={handleCopyPhone} style={{ ...actionBtnStyle, ...(copied ? { background: "rgba(74,222,128,0.1)", borderColor: "rgba(74,222,128,0.2)", color: "#4ade80" } : {}) }}
              onMouseEnter={(e) => { if (!copied) e.currentTarget.style.borderColor = "var(--border-strong)"; }} onMouseLeave={(e) => { if (!copied) e.currentTarget.style.borderColor = "var(--border)"; }}>
              <Icons.Copy /> {copied ? "Copiado!" : "Copiar tel."}
            </button>
            <a href={`tel:${lead.telefono}`} style={{ ...actionBtnStyle, textDecoration: "none" }}
              onMouseEnter={(e) => e.currentTarget.style.borderColor = "var(--border-strong)"} onMouseLeave={(e) => e.currentTarget.style.borderColor = "var(--border)"}>
              <Icons.Phone /> Llamar
            </a>
          </div>

          {/* Info grid */}
          <div style={{ display: "grid", gap: "1px", background: "var(--border)", borderRadius: "var(--radius-md)", overflow: "hidden", marginBottom: "20px" }}>
            {[
              { icon: <Icons.Phone />, label: "Teléfono", value: lead.telefono },
              { icon: <Icons.Home />, label: "Propiedad", value: lead.propiedad },
              { icon: <Icons.Calendar />, label: "Fecha", value: formatFullDate(lead.created_at) },
            ].map((item, i) => (
              <div key={i} style={{ background: "var(--bg-elevated)", padding: "12px 16px", display: "flex", alignItems: "center", gap: "12px" }}>
                <span style={{ color: "var(--text-tertiary)" }}>{item.icon}</span>
                <div>
                  <p style={{ fontSize: "10px", color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "2px" }}>{item.label}</p>
                  <p style={{ fontSize: "13px", color: "var(--text-primary)", fontWeight: 500 }}>{item.value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Message */}
          <div>
            <p style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "8px" }}>Mensaje</p>
            <div style={{ background: "var(--bg-elevated)", borderRadius: "var(--radius-md)", padding: "14px", border: "1px solid var(--border)", lineHeight: 1.6 }}>
              <p style={{ fontSize: "13px", color: "var(--text-secondary)" }}>{lead.mensaje || "—"}</p>
            </div>
          </div>

          {/* AI Classification */}
          <div style={{ marginTop: "20px" }}>
            <p style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "8px" }}>Clasificación IA</p>
            <div style={{ background: cfg.bg, borderRadius: "var(--radius-md)", padding: "12px 16px", border: `1px solid ${cfg.border}`, display: "flex", alignItems: "center", gap: "10px" }}>
              <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: cfg.color }} />
              <span style={{ fontSize: "13px", fontWeight: 600, color: cfg.color }}>{cfg.label}</span>
              <span style={{ fontSize: "11px", color: "var(--text-tertiary)", marginLeft: "auto" }}>Auto-clasificado</span>
            </div>
          </div>

          {/* Status dropdown */}
          <div style={{ marginTop: "20px" }}>
            <p style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "8px" }}>Estado del lead</p>
            <div style={{ position: "relative" }}>
              <select value={lead.status} onChange={(e) => handleStatusChange(e.target.value)} disabled={updating}
                style={{ width: "100%", padding: "10px 14px", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", color: "var(--text-primary)", fontSize: "13px", fontWeight: 500, fontFamily: "var(--font-sans)", outline: "none", cursor: updating ? "wait" : "pointer", appearance: "none", WebkitAppearance: "none" }}
                onFocus={(e) => e.target.style.borderColor = "var(--accent)"} onBlur={(e) => e.target.style.borderColor = "var(--border)"}>
                {statusOptions.map(opt => <option key={opt.value} value={opt.value} style={{ background: "var(--bg-elevated)", color: "var(--text-primary)" }}>{opt.label}</option>)}
              </select>
              <div style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "var(--text-tertiary)" }}>
                {updating ? <div style={{ width: "14px", height: "14px", border: "2px solid var(--border)", borderTopColor: "var(--accent)", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} /> : <Icons.ArrowDown />}
              </div>
            </div>
            {statusMsg && (
              <p style={{ fontSize: "12px", fontWeight: 500, marginTop: "6px", padding: "5px 10px", borderRadius: "var(--radius-sm)", color: statusMsgType === "success" ? "#4ade80" : "var(--danger)", background: statusMsgType === "success" ? "rgba(74,222,128,0.08)" : "rgba(239,68,68,0.08)" }}>{statusMsg}</p>
            )}
          </div>

          {/* Notes section */}
          <div style={{ marginTop: "24px" }}>
            <p style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "12px", display: "flex", alignItems: "center", gap: "6px" }}>
              <Icons.Note /> Notas internas ({notes.length})
            </p>

            {/* Add note */}
            <div style={{ display: "flex", gap: "8px", marginBottom: "14px" }}>
              <input value={newNote} onChange={(e) => setNewNote(e.target.value)} placeholder="Agregar una nota..." onKeyDown={(e) => { if (e.key === "Enter") handleAddNote(); }}
                style={{ flex: 1, padding: "9px 12px", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", color: "var(--text-primary)", fontSize: "13px", outline: "none", fontFamily: "var(--font-sans)" }}
                onFocus={(e) => e.target.style.borderColor = "var(--accent)"} onBlur={(e) => e.target.style.borderColor = "var(--border)"} />
              <button onClick={handleAddNote} disabled={savingNote || !newNote.trim()} style={{ padding: "9px 14px", background: newNote.trim() ? "var(--accent)" : "var(--bg-active)", border: "none", borderRadius: "var(--radius-md)", color: "#fff", fontSize: "12px", fontWeight: 600, cursor: newNote.trim() ? "pointer" : "default", fontFamily: "var(--font-sans)", transition: "all var(--transition)" }}>
                {savingNote ? "..." : "Agregar"}
              </button>
            </div>

            {/* Notes timeline */}
            {notesLoading ? (
              <p style={{ fontSize: "12px", color: "var(--text-tertiary)", padding: "12px 0" }}>Cargando notas...</p>
            ) : notes.length === 0 ? (
              <p style={{ fontSize: "12px", color: "var(--text-tertiary)", padding: "12px 0", textAlign: "center", background: "var(--bg-elevated)", borderRadius: "var(--radius-md)" }}>Sin notas todavía</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {[...notes].reverse().map((note, i) => (
                  <div key={i} style={{ background: "var(--bg-elevated)", borderRadius: "var(--radius-md)", padding: "12px 14px", border: "1px solid var(--border)" }}>
                    <p style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.5, marginBottom: "6px" }}>{note.texto}</p>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: "10px", color: "var(--text-tertiary)" }}>{note.autor}</span>
                      <span style={{ fontSize: "10px", color: "var(--text-tertiary)", fontFamily: "var(--font-mono)" }}>{formatDate(note.createdAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: "16px 24px", borderTop: "1px solid var(--border)", display: "flex", gap: "10px" }}>
          <button style={{ flex: 1, padding: "10px", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", color: "var(--text-secondary)", fontSize: "13px", fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-sans)", transition: "all var(--transition)" }}
            onMouseEnter={(e) => e.currentTarget.style.borderColor = "var(--border-strong)"} onMouseLeave={(e) => e.currentTarget.style.borderColor = "var(--border)"}
          >Archivar</button>
          {whatsappUrl ? (
            <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" style={{ flex: 1, padding: "10px", background: "#25D366", border: "none", borderRadius: "var(--radius-md)", color: "#fff", fontSize: "13px", fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-sans)", textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", transition: "all var(--transition)" }}>
              <Icons.WhatsApp /> WhatsApp
            </a>
          ) : (
            <button style={{ flex: 1, padding: "10px", background: "var(--accent)", border: "none", borderRadius: "var(--radius-md)", color: "#fff", fontSize: "13px", fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-sans)", boxShadow: "0 0 16px var(--accent-glow)" }}>Contactar</button>
          )}
        </div>
      </div>
    </>
  );
}

// ============================================================
// PROPERTY FORM
// ============================================================

function PropertyForm({ initial, inmobiliariaId, onSaved, onClose }) {
  const [form, setForm] = useState({
    titulo: initial?.titulo || "",
    tipo_operacion: initial?.tipo_operacion || "venta",
    tipo_propiedad: initial?.tipo_propiedad || "casa",
    precio: initial?.precio || "",
    moneda: initial?.moneda || "USD",
    ubicacion: initial?.ubicacion || "",
    barrio: initial?.barrio || "",
    ciudad: initial?.ciudad || "",
    descripcion: initial?.descripcion || "",
    imagen_url: initial?.imagen_url || "",
    ambientes: initial?.ambientes || "",
    dormitorios: initial?.dormitorios || "",
    banos: initial?.banos || "",
    cochera: initial?.cochera || "0",
    superficie_total: initial?.superficie_total || "",
    superficie_cubierta: initial?.superficie_cubierta || "",
    destacada: initial?.destacada || "no",
    estado: initial?.estado || "activa",
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const update = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const inputStyle = { width: "100%", padding: "9px 12px", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", color: "var(--text-primary)", fontSize: "13px", outline: "none", fontFamily: "var(--font-sans)" };
  const labelStyle = { display: "block", fontSize: "12px", fontWeight: 500, color: "var(--text-tertiary)", marginBottom: "4px" };
  const selectStyle = { ...inputStyle, appearance: "none", cursor: "pointer" };

  const handleSubmit = async () => {
    if (!form.titulo.trim()) { setMsg("El título es obligatorio"); return; }
    setSaving(true);
    setMsg("");

    const slug = form.titulo.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
    const payload = { ...form, inmobiliaria_id: inmobiliariaId, slug, precio: Number(form.precio) || 0, ambientes: Number(form.ambientes) || 0, dormitorios: Number(form.dormitorios) || 0, banos: Number(form.banos) || 0, cochera: Number(form.cochera) || 0, superficie_total: Number(form.superficie_total) || 0, superficie_cubierta: Number(form.superficie_cubierta) || 0 };

    if (initial?.id) payload.id = initial.id;

    try {
      const url = initial ? UPDATE_PROPERTY_URL : CREATE_PROPERTY_URL;
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (res.ok) {
        onSaved({ ...payload, id: initial?.id || Date.now() });
      } else {
        setMsg("Error al guardar");
      }
    } catch (err) {
      console.error("Save property failed:", err);
      setMsg("Error de conexión");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ flex: 1, overflow: "auto", padding: "24px", display: "flex", flexDirection: "column", gap: "16px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
        <div style={{ gridColumn: "1 / -1" }}><label style={labelStyle}>Título *</label><input value={form.titulo} onChange={(e) => update("titulo", e.target.value)} style={inputStyle} placeholder="Ej: Casa 3 ambientes en Centro" /></div>
        <div><label style={labelStyle}>Operación</label><select value={form.tipo_operacion} onChange={(e) => update("tipo_operacion", e.target.value)} style={selectStyle}><option value="venta">Venta</option><option value="alquiler">Alquiler</option></select></div>
        <div><label style={labelStyle}>Tipo</label><select value={form.tipo_propiedad} onChange={(e) => update("tipo_propiedad", e.target.value)} style={selectStyle}><option value="casa">Casa</option><option value="departamento">Departamento</option><option value="local">Local</option><option value="terreno">Terreno</option><option value="oficina">Oficina</option></select></div>
        <div><label style={labelStyle}>Precio</label><input type="number" value={form.precio} onChange={(e) => update("precio", e.target.value)} style={inputStyle} placeholder="85000" /></div>
        <div><label style={labelStyle}>Moneda</label><select value={form.moneda} onChange={(e) => update("moneda", e.target.value)} style={selectStyle}><option value="USD">USD</option><option value="ARS">ARS</option></select></div>
        <div style={{ gridColumn: "1 / -1" }}><label style={labelStyle}>Ubicación</label><input value={form.ubicacion} onChange={(e) => update("ubicacion", e.target.value)} style={inputStyle} placeholder="Barrio Norte, Rosario" /></div>
        <div><label style={labelStyle}>Barrio</label><input value={form.barrio} onChange={(e) => update("barrio", e.target.value)} style={inputStyle} /></div>
        <div><label style={labelStyle}>Ciudad</label><input value={form.ciudad} onChange={(e) => update("ciudad", e.target.value)} style={inputStyle} /></div>
        <div style={{ gridColumn: "1 / -1" }}><label style={labelStyle}>Descripción</label><textarea value={form.descripcion} onChange={(e) => update("descripcion", e.target.value)} style={{ ...inputStyle, minHeight: "80px", resize: "vertical" }} placeholder="Descripción de la propiedad..." /></div>
        <div style={{ gridColumn: "1 / -1" }}><label style={labelStyle}>URL de imagen</label><input value={form.imagen_url} onChange={(e) => update("imagen_url", e.target.value)} style={inputStyle} placeholder="https://i.ibb.co/..." /></div>
        <div><label style={labelStyle}>Ambientes</label><input type="number" value={form.ambientes} onChange={(e) => update("ambientes", e.target.value)} style={inputStyle} /></div>
        <div><label style={labelStyle}>Dormitorios</label><input type="number" value={form.dormitorios} onChange={(e) => update("dormitorios", e.target.value)} style={inputStyle} /></div>
        <div><label style={labelStyle}>Baños</label><input type="number" value={form.banos} onChange={(e) => update("banos", e.target.value)} style={inputStyle} /></div>
        <div><label style={labelStyle}>Cochera</label><input type="number" value={form.cochera} onChange={(e) => update("cochera", e.target.value)} style={inputStyle} /></div>
        <div><label style={labelStyle}>Superficie total (m²)</label><input type="number" value={form.superficie_total} onChange={(e) => update("superficie_total", e.target.value)} style={inputStyle} /></div>
        <div><label style={labelStyle}>Superficie cubierta (m²)</label><input type="number" value={form.superficie_cubierta} onChange={(e) => update("superficie_cubierta", e.target.value)} style={inputStyle} /></div>
        <div><label style={labelStyle}>Estado</label><select value={form.estado} onChange={(e) => update("estado", e.target.value)} style={selectStyle}><option value="activa">Activa</option><option value="pausada">Pausada</option><option value="vendida">Vendida</option><option value="alquilada">Alquilada</option></select></div>
        <div><label style={labelStyle}>Destacada</label><select value={form.destacada} onChange={(e) => update("destacada", e.target.value)} style={selectStyle}><option value="no">No</option><option value="si">Sí</option></select></div>
      </div>
      {msg && <p style={{ fontSize: "12px", color: "var(--danger)", padding: "6px 10px", background: "rgba(239,68,68,0.08)", borderRadius: "var(--radius-sm)" }}>{msg}</p>}
      <div style={{ display: "flex", gap: "10px", marginTop: "8px" }}>
        <button onClick={onClose} style={{ flex: 1, padding: "10px", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", color: "var(--text-secondary)", fontSize: "13px", fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-sans)" }}>Cancelar</button>
        <button onClick={handleSubmit} disabled={saving} style={{ flex: 1, padding: "10px", background: "var(--accent)", border: "none", borderRadius: "var(--radius-md)", color: "#fff", fontSize: "13px", fontWeight: 600, cursor: saving ? "wait" : "pointer", fontFamily: "var(--font-sans)", boxShadow: "0 0 16px var(--accent-glow)" }}>
          {saving ? "Guardando..." : (initial ? "Guardar cambios" : "Crear propiedad")}
        </button>
      </div>
    </div>
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
  const [properties, setProperties] = useState([]);
  const [propLoading, setPropLoading] = useState(false);
  const [showPropForm, setShowPropForm] = useState(false);
  const [editingProp, setEditingProp] = useState(null);
  const [propSearch, setPropSearch] = useState("");
  const [propFilter, setPropFilter] = useState("all");

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
    setProperties([]);
  };

  // Fetch properties
  useEffect(() => {
    if (!loggedIn) return;
    async function loadProps() {
      try {
        setPropLoading(true);
        const res = await fetch(getPropertiesURL());
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const rawArray = Array.isArray(data) ? data : [];
        const normalized = rawArray.map((item, i) => {
          const p = item.json ? item.json : item;
          return { ...p, id: p.id ?? i + 1, titulo: safeStr(p.titulo) || "Sin título", tipo_operacion: safeStr(p.tipo_operacion) || "venta", tipo_propiedad: safeStr(p.tipo_propiedad) || "casa", precio: Number(p.precio) || 0, moneda: safeStr(p.moneda) || "USD", ubicacion: safeStr(p.ubicacion), descripcion: safeStr(p.descripcion), imagen_url: safeStr(p.imagen_url), ambientes: Number(p.ambientes) || 0, dormitorios: Number(p.dormitorios) || 0, banos: Number(p.banos) || 0, cochera: Number(p.cochera) || 0, superficie_total: Number(p.superficie_total) || 0, destacada: safeStr(p.destacada) || "no", estado: safeStr(p.estado) || "activa" };
        });
        setProperties(normalized);
      } catch (err) {
        console.error("Failed to fetch properties:", err);
      } finally {
        setPropLoading(false);
      }
    }
    loadProps();
  }, [loggedIn]);

  const filteredProps = useMemo(() => {
    let result = [...properties];
    if (propSearch) {
      const q = propSearch.toLowerCase();
      result = result.filter(p => p.titulo.toLowerCase().includes(q) || p.ubicacion.toLowerCase().includes(q) || p.tipo_propiedad.toLowerCase().includes(q));
    }
    if (propFilter !== "all") result = result.filter(p => p.tipo_operacion === propFilter);
    return result;
  }, [properties, propSearch, propFilter]);

  const formatPrice = (precio, moneda) => {
    if (!precio) return "Consultar";
    return `${moneda === "USD" ? "U$D" : "$"} ${Number(precio).toLocaleString("es-AR")}`;
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

  const pageTitles = { dashboard: "Panel", leads: "Leads", propiedades: "Propiedades", settings: "Configuración" };

  if (!loggedIn) return <><style>{globalCSS}</style><LoginPage onLogin={() => setLoggedIn(true)} /></>;

  const userEmail = safeStr(localStorage.getItem("user_email")) || "admin@leadflow.io";
  const inmobiliariaNombre = safeStr(localStorage.getItem("inmobiliaria_nombre")) || "LeadFlow";
  const inmobiliariaId = safeStr(localStorage.getItem("inmobiliaria_id"));

  const navItems = [
    { id: "dashboard", label: "Panel", icon: <Icons.Dashboard /> },
    { id: "leads", label: "Leads", icon: <Icons.Leads /> },
    { id: "propiedades", label: "Propiedades", icon: <Icons.Building /> },
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
              {item.id === "propiedades" && <span style={{ marginLeft: "auto", fontSize: "11px", fontWeight: 600, color: "var(--accent)", background: "var(--accent-glow)", padding: "1px 7px", borderRadius: "10px", fontFamily: "var(--font-mono)" }}>{properties.length}</span>}
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

                {/* KPI Cards */}
                <div style={{ display: "flex", gap: "14px", flexWrap: "wrap", marginBottom: "24px" }}>
                  <KPICard label="Leads hoy" value={today} change={today > 0 ? 12 : 0} delay={0} />
                  <KPICard label="Esta semana" value={thisWeek} change={thisWeek > 0 ? 8 : 0} delay={60} />
                  <KPICard label="Total leads" value={leads.length} change={leads.length > 0 ? 23 : 0} delay={120} />
                  <KPICard label="Conversión" value={`${leads.length > 0 ? Math.round((converted / leads.length) * 100) : 0}%`} change={converted > 0 ? 5 : 0} delay={180} />
                </div>

                {/* Charts row */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px", marginBottom: "20px" }}>

                  {/* Leads por tipo - bar chart */}
                  <div className="fade-in" style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "22px", animationDelay: "200ms" }}>
                    <h3 style={{ fontSize: "13px", fontWeight: 600, marginBottom: "18px" }}>Leads por tipo</h3>
                    {(() => {
                      const byType = { comprar: leads.filter(l => l.tipo_lead === "comprar").length, alquilar: leads.filter(l => l.tipo_lead === "alquilar").length, vender: leads.filter(l => l.tipo_lead === "vender").length };
                      const maxVal = Math.max(...Object.values(byType), 1);
                      return (
                        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                          {Object.entries(byType).map(([tipo, count]) => {
                            const cfg = typeConfig[tipo];
                            const pct = Math.round((count / maxVal) * 100);
                            return (
                              <div key={tipo}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "5px" }}>
                                  <span style={{ fontSize: "12px", color: "var(--text-secondary)", fontWeight: 500 }}>{cfg?.label || tipo}</span>
                                  <span style={{ fontSize: "12px", fontWeight: 700, color: cfg?.color, fontFamily: "var(--font-mono)" }}>{count}</span>
                                </div>
                                <div style={{ height: "8px", background: "var(--bg-active)", borderRadius: "4px", overflow: "hidden" }}>
                                  <div className="fade-in" style={{ height: "100%", width: `${pct}%`, background: cfg?.color, borderRadius: "4px", transition: "width 0.6s ease", animationDelay: "400ms" }} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Leads por estado - donut visual */}
                  <div className="fade-in" style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "22px", animationDelay: "300ms" }}>
                    <h3 style={{ fontSize: "13px", fontWeight: 600, marginBottom: "18px" }}>Leads por estado</h3>
                    {(() => {
                      const byStatus = { nuevo: leads.filter(l => l.status === "nuevo").length, contactado: leads.filter(l => l.status === "contactado").length, calificado: leads.filter(l => l.status === "calificado").length, convertido: leads.filter(l => l.status === "convertido").length };
                      const total = leads.length || 1;
                      return (
                        <div style={{ display: "flex", gap: "20px", alignItems: "center" }}>
                          {/* Mini donut */}
                          <div style={{ position: "relative", width: "90px", height: "90px", flexShrink: 0 }}>
                            <svg viewBox="0 0 36 36" style={{ width: "90px", height: "90px", transform: "rotate(-90deg)" }}>
                              {(() => {
                                let offset = 0;
                                return Object.entries(byStatus).map(([status, count]) => {
                                  const pct = (count / total) * 100;
                                  const dash = `${pct} ${100 - pct}`;
                                  const cfg = statusConfig[status];
                                  const el = <circle key={status} cx="18" cy="18" r="14" fill="none" stroke={cfg?.color || "#555"} strokeWidth="4" strokeDasharray={dash} strokeDashoffset={-offset} strokeLinecap="round" />;
                                  offset += pct;
                                  return el;
                                });
                              })()}
                            </svg>
                            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column" }}>
                              <span style={{ fontSize: "18px", fontWeight: 700, lineHeight: 1 }}>{leads.length}</span>
                              <span style={{ fontSize: "9px", color: "var(--text-tertiary)" }}>total</span>
                            </div>
                          </div>
                          {/* Legend */}
                          <div style={{ display: "flex", flexDirection: "column", gap: "8px", flex: 1 }}>
                            {Object.entries(byStatus).map(([status, count]) => {
                              const cfg = statusConfig[status];
                              return (
                                <div key={status} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                    <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: cfg?.color }} />
                                    <span style={{ fontSize: "11px", color: "var(--text-secondary)" }}>{cfg?.label}</span>
                                  </div>
                                  <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-primary)", fontFamily: "var(--font-mono)" }}>{count}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Propiedades resumen */}
                  <div className="fade-in" style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "22px", animationDelay: "400ms" }}>
                    <h3 style={{ fontSize: "13px", fontWeight: 600, marginBottom: "18px" }}>Propiedades</h3>
                    {(() => {
                      const activas = properties.filter(p => p.estado === "activa").length;
                      const enVenta = properties.filter(p => p.tipo_operacion === "venta" && p.estado === "activa").length;
                      const enAlquiler = properties.filter(p => p.tipo_operacion === "alquiler" && p.estado === "activa").length;
                      const destacadas = properties.filter(p => p.destacada === "si").length;
                      const items = [
                        { label: "Activas", value: activas, color: "#4ade80" },
                        { label: "En venta", value: enVenta, color: "#22c55e" },
                        { label: "En alquiler", value: enAlquiler, color: "#3b82f6" },
                        { label: "Destacadas", value: destacadas, color: "#fbbf24" },
                      ];
                      return (
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                          {items.map(item => (
                            <div key={item.label} style={{ background: "var(--bg-elevated)", borderRadius: "var(--radius-md)", padding: "14px", textAlign: "center" }}>
                              <p style={{ fontSize: "24px", fontWeight: 700, color: item.color, fontFamily: "var(--font-sans)" }}>{item.value}</p>
                              <p style={{ fontSize: "10px", color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em", marginTop: "4px" }}>{item.label}</p>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* Recent leads */}
                <div className="fade-in" style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", overflow: "hidden", animationDelay: "500ms" }}>
                  <div style={{ padding: "18px 22px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <h3 style={{ fontSize: "14px", fontWeight: 600 }}>Leads recientes</h3>
                    <button onClick={() => setPage("leads")} style={{ fontSize: "12px", color: "var(--accent)", background: "none", border: "none", cursor: "pointer", fontWeight: 600, fontFamily: "var(--font-sans)" }}>Ver todos →</button>
                  </div>
                  {leads.length === 0 ? (
                    <div style={{ padding: "32px", textAlign: "center", color: "var(--text-tertiary)", fontSize: "13px" }}>No hay leads todavía</div>
                  ) : leads.slice(0, 5).map((lead, i) => (
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

            {!loading && !error && page === "propiedades" && (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "12px" }}>
                  <p style={{ fontSize: "13px", color: "var(--text-tertiary)" }}>Gestiona las propiedades de tu inmobiliaria</p>
                  <button onClick={() => { setEditingProp(null); setShowPropForm(true); }} style={{ display: "flex", alignItems: "center", gap: "6px", padding: "9px 18px", background: "var(--accent)", color: "#fff", border: "none", borderRadius: "var(--radius-md)", fontSize: "13px", fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-sans)", boxShadow: "0 0 16px var(--accent-glow)", transition: "all var(--transition)" }}
                    onMouseEnter={(e) => e.currentTarget.style.background = "var(--accent-hover)"} onMouseLeave={(e) => e.currentTarget.style.background = "var(--accent)"}
                  ><Icons.Plus /> Nueva propiedad</button>
                </div>

                {/* Filters */}
                <div style={{ display: "flex", gap: "10px", marginBottom: "18px", flexWrap: "wrap" }}>
                  <div style={{ position: "relative", flex: "1 1 240px", maxWidth: "360px" }}>
                    <input placeholder="Buscar propiedades..." value={propSearch} onChange={(e) => setPropSearch(e.target.value)}
                      style={{ width: "100%", padding: "9px 12px 9px 36px", background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", color: "var(--text-primary)", fontSize: "13px", outline: "none", transition: "border-color var(--transition)" }}
                      onFocus={(e) => e.target.style.borderColor = "var(--accent)"} onBlur={(e) => e.target.style.borderColor = "var(--border)"} />
                    <div style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--text-tertiary)" }}><Icons.Search /></div>
                  </div>
                  <div style={{ display: "flex", gap: "6px" }}>
                    {["all", "venta", "alquiler"].map(type => (
                      <button key={type} onClick={() => setPropFilter(type)} style={{ padding: "8px 14px", fontSize: "12px", fontWeight: 600, borderRadius: "var(--radius-md)", cursor: "pointer", fontFamily: "var(--font-sans)", transition: "all var(--transition)", border: "1px solid", ...(propFilter === type ? { background: "var(--accent-glow)", color: "var(--accent-hover)", borderColor: "rgba(99,102,241,0.3)" } : { background: "var(--bg-surface)", color: "var(--text-tertiary)", borderColor: "var(--border)" }) }}>
                        {type === "all" ? "Todas" : operacionConfig[type]?.label || type}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Properties grid */}
                {propLoading ? (
                  <div style={{ padding: "48px", textAlign: "center", color: "var(--text-tertiary)" }}>Cargando propiedades...</div>
                ) : filteredProps.length === 0 ? (
                  <div style={{ padding: "48px", textAlign: "center", color: "var(--text-tertiary)", background: "var(--bg-surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--border)" }}>
                    <p style={{ fontSize: "14px", marginBottom: "8px" }}>No hay propiedades</p>
                    <p style={{ fontSize: "12px" }}>Hacé clic en "Nueva propiedad" para agregar una</p>
                  </div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "16px" }}>
                    {filteredProps.map((prop, i) => {
                      const opCfg = operacionConfig[prop.tipo_operacion] || operacionConfig.venta;
                      const estCfg = propiedadEstadoConfig[prop.estado] || propiedadEstadoConfig.activa;
                      return (
                        <div key={prop.id} className="fade-in" style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", overflow: "hidden", transition: "border-color var(--transition)", animationDelay: `${i * 40}ms`, cursor: "pointer" }}
                          onMouseEnter={(e) => e.currentTarget.style.borderColor = "var(--border-strong)"} onMouseLeave={(e) => e.currentTarget.style.borderColor = "var(--border)"}
                          onClick={() => { setEditingProp(prop); setShowPropForm(true); }}>
                          {/* Image */}
                          <div style={{ height: "160px", background: prop.imagen_url ? `url(${prop.imagen_url}) center/cover` : "linear-gradient(135deg, var(--bg-elevated), var(--bg-active))", display: "flex", alignItems: "flex-end", padding: "12px", position: "relative" }}>
                            {!prop.imagen_url && <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-tertiary)" }}><Icons.Building /></div>}
                            <div style={{ display: "flex", gap: "6px", position: "relative", zIndex: 1 }}>
                              <span style={{ padding: "3px 10px", fontSize: "11px", fontWeight: 600, borderRadius: "6px", color: opCfg.color, background: opCfg.bg, border: `1px solid ${opCfg.border}`, textTransform: "uppercase", backdropFilter: "blur(8px)" }}>{opCfg.label}</span>
                              <span style={{ padding: "3px 10px", fontSize: "11px", fontWeight: 600, borderRadius: "6px", color: "#fff", background: "rgba(0,0,0,0.6)", textTransform: "uppercase", backdropFilter: "blur(8px)" }}>{prop.tipo_propiedad}</span>
                            </div>
                          </div>
                          {/* Info */}
                          <div style={{ padding: "16px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                              <h3 style={{ fontSize: "14px", fontWeight: 600, letterSpacing: "-0.01em", flex: 1, marginRight: "8px" }}>{prop.titulo}</h3>
                              <span style={{ fontSize: "14px", fontWeight: 700, color: opCfg.color, whiteSpace: "nowrap" }}>{formatPrice(prop.precio, prop.moneda)}</span>
                            </div>
                            <p style={{ fontSize: "12px", color: "var(--text-tertiary)", marginBottom: "12px" }}>{prop.ubicacion}</p>
                            <div style={{ display: "flex", gap: "12px", fontSize: "11px", color: "var(--text-muted)" }}>
                              {prop.ambientes > 0 && <span>{prop.ambientes} amb</span>}
                              {prop.dormitorios > 0 && <span>{prop.dormitorios} dorm</span>}
                              {prop.banos > 0 && <span>{prop.banos} baño{prop.banos > 1 ? "s" : ""}</span>}
                              {prop.superficie_total > 0 && <span>{prop.superficie_total}m²</span>}
                              {prop.cochera > 0 && <span>Cochera</span>}
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "12px", paddingTop: "12px", borderTop: "1px solid var(--border)" }}>
                              <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", fontSize: "11px", color: estCfg.color }}>
                                <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: estCfg.color }} />{estCfg.label}
                              </span>
                              {prop.destacada === "si" && <span style={{ fontSize: "10px", padding: "2px 8px", borderRadius: "4px", background: "rgba(251,191,36,0.1)", color: "#fbbf24", fontWeight: 600, textTransform: "uppercase" }}>Destacada</span>}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                <p style={{ fontSize: "12px", color: "var(--text-tertiary)", marginTop: "14px", textAlign: "center" }}>Mostrando {filteredProps.length} de {properties.length} propiedades</p>

                {/* Property Form Modal */}
                {showPropForm && (
                  <>
                    <div onClick={() => setShowPropForm(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 90, backdropFilter: "blur(4px)" }} />
                    <div className="slide-right" style={{ position: "fixed", right: 0, top: 0, bottom: 0, width: "min(520px, 95vw)", background: "var(--bg-surface)", borderLeft: "1px solid var(--border)", zIndex: 100, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 24px", borderBottom: "1px solid var(--border)" }}>
                        <h2 style={{ fontSize: "16px", fontWeight: 600 }}>{editingProp ? "Editar propiedad" : "Nueva propiedad"}</h2>
                        <button onClick={() => setShowPropForm(false)} style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "6px", cursor: "pointer", color: "var(--text-secondary)", display: "flex" }}><Icons.Close /></button>
                      </div>
                      <PropertyForm
                        initial={editingProp}
                        inmobiliariaId={inmobiliariaId}
                        onSaved={(prop) => {
                          if (editingProp) {
                            setProperties(prev => prev.map(p => p.id === prop.id ? { ...p, ...prop } : p));
                          } else {
                            setProperties(prev => [prop, ...prev]);
                          }
                          setShowPropForm(false);
                        }}
                        onClose={() => setShowPropForm(false)}
                      />
                    </div>
                  </>
                )}
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
