import { useState, useEffect } from "react";
import { navigate } from "./App";

// ============================================================
// API
// ============================================================
const API_BASE = import.meta.env.VITE_API_BASE || "http://129.121.51.150/webhook";
const BRANDING_URL = (slug) => `${API_BASE}/api-branding?inmobiliaria_id=${slug}`;
const LEAD_URL = `${API_BASE}/lead`;
const PROPERTIES_URL = (slug) => `${API_BASE}/api-propiedades?inmobiliaria_id=${slug}`;

function unwrapN8n(item) {
  if (item && typeof item === "object" && item.json && typeof item.json === "object") return item.json;
  return item;
}

function safeStr(val) {
  if (val === null || val === undefined) return "";
  const s = String(val);
  return s.includes("{{") && s.includes("}}") ? "" : s;
}

// ============================================================
// LANDING CSS (scoped — does NOT affect the panel)
// ============================================================
const landingCSS = `
  @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Outfit:wght@300;400;500;600;700&display=swap');

  .lf-landing * { margin: 0; padding: 0; box-sizing: border-box; }

  .lf-landing {
    --lf-primary: #6366f1;
    --lf-primary-glow: rgba(99,102,241,0.2);
    --lf-secondary: #a78bfa;
    --lf-bg: #07070a;
    --lf-surface: #0c0c10;
    --lf-elevated: #131318;
    --lf-border: rgba(255,255,255,0.06);
    --lf-border-strong: rgba(255,255,255,0.1);
    --lf-text: #f4f4f5;
    --lf-text-muted: #a1a1aa;
    --lf-text-dim: #63637a;
    --lf-danger: #ef4444;
    --lf-success: #22c55e;
    --lf-font-display: 'Instrument Serif', Georgia, serif;
    --lf-font-body: 'Outfit', -apple-system, sans-serif;
    --lf-radius: 12px;

    font-family: var(--lf-font-body);
    background: var(--lf-bg);
    color: var(--lf-text);
    min-height: 100vh;
    -webkit-font-smoothing: antialiased;
    overflow-x: hidden;
  }

  .lf-landing input, .lf-landing textarea, .lf-landing button, .lf-landing select {
    font-family: var(--lf-font-body);
  }

  @keyframes lf-fadeUp { from { opacity:0; transform:translateY(24px); } to { opacity:1; transform:translateY(0); } }
  @keyframes lf-fadeIn { from { opacity:0; } to { opacity:1; } }
  @keyframes lf-pulse { 0%,100% { transform:scale(1); } 50% { transform:scale(1.05); } }
  @keyframes lf-spin { to { transform:rotate(360deg); } }
  @keyframes lf-shimmer { 0% { background-position:-200% 0; } 100% { background-position:200% 0; } }

  .lf-fade-up { animation: lf-fadeUp 0.7s cubic-bezier(0.16,1,0.3,1) both; }
  .lf-fade-in { animation: lf-fadeIn 0.5s ease both; }
`;

// ============================================================
// ICONS
// ============================================================
const LandingIcons = {
  Phone: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>,
  WhatsApp: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>,
  Send: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>,
  Mail: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>,
  MapPin: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>,
  Check: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  Home: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
};

// ============================================================
// LOADING SKELETON
// ============================================================
function LandingSkeleton() {
  const skeletonStyle = {
    background: "linear-gradient(90deg, var(--lf-elevated) 25%, var(--lf-surface) 50%, var(--lf-elevated) 75%)",
    backgroundSize: "200% 100%",
    animation: "lf-shimmer 1.5s infinite",
    borderRadius: "var(--lf-radius)",
  };
  return (
    <div className="lf-landing" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: "48px 24px", gap: "24px" }}>
      <div style={{ ...skeletonStyle, width: "120px", height: "40px" }} />
      <div style={{ ...skeletonStyle, width: "320px", height: "48px", maxWidth: "80%" }} />
      <div style={{ ...skeletonStyle, width: "240px", height: "20px" }} />
      <div style={{ ...skeletonStyle, width: "200px", height: "44px", marginTop: "16px" }} />
    </div>
  );
}

// ============================================================
// ERROR STATE
// ============================================================
function LandingError({ message }) {
  return (
    <div className="lf-landing" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: "48px 24px", gap: "16px", textAlign: "center" }}>
      <div style={{ width: "56px", height: "56px", borderRadius: "50%", background: "rgba(239,68,68,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "24px" }}>⚠</div>
      <h2 style={{ fontSize: "20px", fontWeight: 600, color: "var(--lf-text)" }}>Página no encontrada</h2>
      <p style={{ fontSize: "14px", color: "var(--lf-text-muted)", maxWidth: "360px" }}>{message}</p>
      <a href="/" style={{ marginTop: "8px", fontSize: "14px", color: "var(--lf-primary)", textDecoration: "none", fontWeight: 600 }}>← Volver al inicio</a>
    </div>
  );
}

// ============================================================
// MAIN LANDING COMPONENT
// ============================================================
export default function PublicLanding({ slug, subpage = "home", propSlug }) {
  const [branding, setBranding] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [allProperties, setAllProperties] = useState([]);

  // Form state
  const [form, setForm] = useState({ nombre: "", telefono: "", propiedad: "", mensaje: "" });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [formError, setFormError] = useState("");

  // Property filters
  const [propFilter, setPropFilter] = useState("all");
  const [propTypeFilter, setPropTypeFilter] = useState("all");
  const [propSearchQ, setPropSearchQ] = useState("");

  // Load branding
  useEffect(() => {
    if (!slug) { setError("No se especificó inmobiliaria"); setLoading(false); return; }

    async function loadBranding() {
      try {
        setLoading(true);
        const res = await fetch(BRANDING_URL(slug));
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const raw = await res.json();

        // Handle n8n array or single object
        let data;
        if (Array.isArray(raw)) {
          data = unwrapN8n(raw[0]);
        } else {
          data = unwrapN8n(raw);
        }

        if (!data || !data.nombre) throw new Error("Datos inválidos");
        setBranding(data);
      } catch (err) {
        console.error("Branding load failed:", err);
        setError("No se pudo cargar la información de esta inmobiliaria.");
      } finally {
        setLoading(false);
      }
    }
    loadBranding();
  }, [slug]);

  // Load properties (all active)
  const [properties, setProperties] = useState([]);
  useEffect(() => {
    if (!slug) return;
    async function loadProps() {
      try {
        const res = await fetch(PROPERTIES_URL(slug));
        if (!res.ok) return;
        const data = await res.json();
        const rawArray = Array.isArray(data) ? data : [];
        const all = rawArray.map(item => {
          const p = item.json ? item.json : item;
          return p;
        }).filter(p => safeStr(p.estado) === "activa");
        setAllProperties(all);
        setProperties(all.filter(p => safeStr(p.destacada) === "si"));
      } catch (err) {
        console.error("Properties load failed:", err);
      }
    }
    loadProps();
  }, [slug]);

  // Filtered properties for listings page
  const filteredListings = allProperties.filter(p => {
    if (propFilter !== "all" && safeStr(p.tipo_operacion) !== propFilter) return false;
    if (propTypeFilter !== "all" && safeStr(p.tipo_propiedad) !== propTypeFilter) return false;
    if (propSearchQ) {
      const q = propSearchQ.toLowerCase();
      if (!(safeStr(p.titulo).toLowerCase().includes(q) || safeStr(p.ubicacion).toLowerCase().includes(q) || safeStr(p.tipo_propiedad).toLowerCase().includes(q))) return false;
    }
    return true;
  });

  // Find specific property for detail page
  const currentProperty = propSlug ? allProperties.find(p => safeStr(p.slug) === propSlug) : null;

  // Apply dynamic colors
  const primaryColor = safeStr(branding?.color_primario) || "#6366f1";
  const secondaryColor = safeStr(branding?.color_secundario) || "#a78bfa";

  // Form handlers
  const updateField = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setFormError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.nombre.trim() || !form.telefono.trim()) {
      setFormError("Nombre y teléfono son obligatorios");
      return;
    }

    setSending(true);
    setFormError("");

    try {
      const res = await fetch(LEAD_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inmobiliaria_id: slug,
          nombre: form.nombre.trim(),
          telefono: form.telefono.trim(),
          propiedad: form.propiedad.trim(),
          mensaje: form.mensaje.trim(),
        }),
      });

      if (!res.ok) throw new Error("Error al enviar");
      setSent(true);
      setForm({ nombre: "", telefono: "", propiedad: "", mensaje: "" });
      setTimeout(() => setSent(false), 5000);
    } catch (err) {
      console.error("Lead submit failed:", err);
      setFormError("Error al enviar. Intente nuevamente.");
    } finally {
      setSending(false);
    }
  };

  const whatsappUrl = branding?.whatsapp
    ? `https://wa.me/${safeStr(branding.whatsapp).replace(/[^0-9]/g, "")}?text=${encodeURIComponent("Hola, quiero consultar sobre una propiedad")}`
    : null;

  // RENDER
  if (loading) return <><style>{landingCSS}</style><LandingSkeleton /></>;
  if (error) return <><style>{landingCSS}</style><LandingError message={error} /></>;
  if (!branding) return <><style>{landingCSS}</style><LandingError message="Inmobiliaria no encontrada" /></>;

  const nombre = safeStr(branding.nombre) || "Inmobiliaria";
  const heroTitulo = safeStr(branding.hero_titulo) || "Encontrá tu próximo hogar";
  const heroSubtitulo = safeStr(branding.hero_subtitulo) || "Te ayudamos a encontrar la propiedad ideal";
  const telefono = safeStr(branding.telefono);
  const emailContact = safeStr(branding.email);
  const direccion = safeStr(branding.direccion);
  const logoUrl = safeStr(branding.logo_url);

  return (
    <>
      <style>{landingCSS}</style>
      <style>{`
        .lf-landing { --lf-primary: ${primaryColor}; --lf-primary-glow: ${primaryColor}33; --lf-secondary: ${secondaryColor}; }
      `}</style>

      <div className="lf-landing">

        {/* ====== NAVBAR ====== */}
        <nav style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 50, padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(7,7,10,0.8)", backdropFilter: "blur(16px)", borderBottom: "1px solid var(--lf-border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }} onClick={() => navigate(`/${slug}`)}>
            {logoUrl ? (
              <img src={logoUrl} alt={nombre} style={{ height: "32px", objectFit: "contain", borderRadius: "4px" }} onError={(e) => e.target.style.display = "none"} />
            ) : (
              <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: `linear-gradient(135deg, var(--lf-primary), var(--lf-secondary))`, display: "flex", alignItems: "center", justifyContent: "center" }}><LandingIcons.Home /></div>
            )}
            <span style={{ fontSize: "16px", fontWeight: 600, letterSpacing: "-0.02em" }}>{nombre}</span>
          </div>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <span onClick={() => navigate(`/${slug}/propiedades`)} style={{ fontSize: "13px", fontWeight: 500, color: subpage === "propiedades" ? "var(--lf-primary)" : "var(--lf-text-muted)", cursor: "pointer", padding: "6px 12px", borderRadius: "6px", transition: "all 0.2s" }}
              onMouseEnter={(e) => e.currentTarget.style.color = "var(--lf-text)"} onMouseLeave={(e) => e.currentTarget.style.color = subpage === "propiedades" ? "var(--lf-primary)" : "var(--lf-text-muted)"}>
              Propiedades
            </span>
            <span onClick={() => { navigate(`/${slug}`); setTimeout(() => document.getElementById("contacto")?.scrollIntoView({ behavior: "smooth" }), 100); }} style={{ fontSize: "13px", fontWeight: 500, color: "var(--lf-text-muted)", cursor: "pointer", padding: "6px 12px", borderRadius: "6px", transition: "all 0.2s" }}
              onMouseEnter={(e) => e.currentTarget.style.color = "var(--lf-text)"} onMouseLeave={(e) => e.currentTarget.style.color = "var(--lf-text-muted)"}>
              Contacto
            </span>
            {whatsappUrl && (
              <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "8px 16px", background: "#25D366", color: "#fff", borderRadius: "8px", fontSize: "13px", fontWeight: 600, textDecoration: "none", transition: "transform 0.2s" }}
                onMouseEnter={(e) => e.currentTarget.style.transform = "scale(1.03)"} onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}>
                <LandingIcons.WhatsApp /> WhatsApp
              </a>
            )}
          </div>
        </nav>

        {/* ====== HOME PAGE ====== */}
        {subpage === "home" && (
          <>
        {/* ====== HERO ====== */}
        <section style={{ position: "relative", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "120px 24px 80px", textAlign: "center", overflow: "hidden" }}>
          {/* Background effects */}
          <div style={{ position: "absolute", top: "10%", left: "50%", transform: "translateX(-50%)", width: "800px", height: "800px", background: `radial-gradient(circle, ${primaryColor}12 0%, transparent 60%)`, pointerEvents: "none" }} />
          <div style={{ position: "absolute", top: "50%", left: "20%", width: "300px", height: "300px", background: `radial-gradient(circle, ${secondaryColor}08 0%, transparent 70%)`, pointerEvents: "none" }} />

          {/* Grid pattern */}
          <div style={{ position: "absolute", inset: 0, backgroundImage: `linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)`, backgroundSize: "64px 64px", pointerEvents: "none", mask: "radial-gradient(ellipse at center, black 30%, transparent 70%)" }} />

          <div style={{ position: "relative", zIndex: 1, maxWidth: "720px" }}>
            {/* Badge */}
            <div className="lf-fade-up" style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "6px 14px", borderRadius: "20px", background: "var(--lf-elevated)", border: "1px solid var(--lf-border-strong)", fontSize: "12px", fontWeight: 500, color: "var(--lf-text-muted)", marginBottom: "28px", letterSpacing: "0.04em", textTransform: "uppercase" }}>
              <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--lf-success)" }} />
              Consultas abiertas
            </div>

            {/* Title */}
            <h1 className="lf-fade-up" style={{ fontFamily: "var(--lf-font-display)", fontSize: "clamp(40px, 7vw, 72px)", fontWeight: 400, lineHeight: 1.05, letterSpacing: "-0.03em", color: "var(--lf-text)", marginBottom: "20px", animationDelay: "0.1s" }}>
              {heroTitulo}
            </h1>

            {/* Subtitle */}
            <p className="lf-fade-up" style={{ fontSize: "clamp(16px, 2.5vw, 19px)", lineHeight: 1.6, color: "var(--lf-text-muted)", maxWidth: "520px", margin: "0 auto 36px", fontWeight: 300, animationDelay: "0.2s" }}>
              {heroSubtitulo}
            </p>

            {/* CTA buttons */}
            <div className="lf-fade-up" style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap", animationDelay: "0.3s" }}>
              <a href="#contacto" style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "14px 28px", background: "var(--lf-primary)", color: "#fff", borderRadius: "10px", fontSize: "15px", fontWeight: 600, textDecoration: "none", boxShadow: `0 0 32px var(--lf-primary-glow)`, transition: "all 0.2s", letterSpacing: "-0.01em" }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = `0 8px 40px var(--lf-primary-glow)`; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = `0 0 32px var(--lf-primary-glow)`; }}>
                <LandingIcons.Send /> Consultar ahora
              </a>
              {whatsappUrl && (
                <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "14px 28px", background: "var(--lf-elevated)", color: "var(--lf-text)", border: "1px solid var(--lf-border-strong)", borderRadius: "10px", fontSize: "15px", fontWeight: 600, textDecoration: "none", transition: "all 0.2s" }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--lf-primary)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--lf-border-strong)"; e.currentTarget.style.transform = "translateY(0)"; }}>
                  <LandingIcons.WhatsApp /> WhatsApp
                </a>
              )}
            </div>
          </div>

          {/* Scroll indicator */}
          <div style={{ position: "absolute", bottom: "32px", left: "50%", transform: "translateX(-50%)", display: "flex", flexDirection: "column", alignItems: "center", gap: "8px", color: "var(--lf-text-dim)", fontSize: "11px", letterSpacing: "0.1em", textTransform: "uppercase" }}>
            <span>Scroll</span>
            <div style={{ width: "1px", height: "32px", background: "linear-gradient(to bottom, var(--lf-text-dim), transparent)" }} />
          </div>
        </section>

        {/* ====== FEATURED PROPERTIES ====== */}
        {properties.length > 0 && (
          <section style={{ padding: "40px 24px 80px", maxWidth: "1100px", margin: "0 auto" }}>
            <div style={{ textAlign: "center", marginBottom: "40px" }}>
              <h2 style={{ fontFamily: "var(--lf-font-display)", fontSize: "clamp(28px, 5vw, 40px)", fontWeight: 400, letterSpacing: "-0.02em", marginBottom: "12px" }}>Propiedades destacadas</h2>
              <p style={{ fontSize: "15px", color: "var(--lf-text-muted)", fontWeight: 300 }}>Explorá nuestras mejores opciones disponibles</p>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "20px" }}>
              {properties.map((prop, i) => {
                const precio = Number(prop.precio);
                const moneda = safeStr(prop.moneda) || "USD";
                const precioStr = precio ? `${moneda === "USD" ? "U$D" : "$"} ${precio.toLocaleString("es-AR")}` : "Consultar";
                const opLabel = safeStr(prop.tipo_operacion) === "alquiler" ? "Alquiler" : "Venta";
                const opColor = safeStr(prop.tipo_operacion) === "alquiler" ? "#3b82f6" : "#22c55e";
                const imgUrl = safeStr(prop.imagen_url);
                return (
                  <div key={i} className="lf-fade-up" style={{ background: "var(--lf-surface)", border: "1px solid var(--lf-border)", borderRadius: "var(--lf-radius)", overflow: "hidden", transition: "border-color 0.2s, transform 0.2s", animationDelay: `${i * 100}ms` }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--lf-border-strong)"; e.currentTarget.style.transform = "translateY(-4px)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--lf-border)"; e.currentTarget.style.transform = "translateY(0)"; }}>
                    <div style={{ height: "200px", background: imgUrl ? `url(${imgUrl}) center/cover` : "linear-gradient(135deg, var(--lf-elevated), var(--lf-surface))", position: "relative" }}>
                      {!imgUrl && <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--lf-text-dim)" }}><LandingIcons.Home /></div>}
                      <div style={{ position: "absolute", top: "12px", left: "12px", display: "flex", gap: "6px" }}>
                        <span style={{ padding: "4px 12px", fontSize: "11px", fontWeight: 600, borderRadius: "6px", color: opColor, background: "rgba(0,0,0,0.7)", textTransform: "uppercase", backdropFilter: "blur(8px)" }}>{opLabel}</span>
                        <span style={{ padding: "4px 12px", fontSize: "11px", fontWeight: 600, borderRadius: "6px", color: "#fff", background: "rgba(0,0,0,0.7)", textTransform: "uppercase", backdropFilter: "blur(8px)" }}>{safeStr(prop.tipo_propiedad) || "Propiedad"}</span>
                      </div>
                    </div>
                    <div style={{ padding: "20px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px", gap: "8px" }}>
                        <h3 style={{ fontSize: "15px", fontWeight: 600, letterSpacing: "-0.01em", flex: 1 }}>{safeStr(prop.titulo) || "Propiedad"}</h3>
                        <span style={{ fontSize: "15px", fontWeight: 700, color: opColor, whiteSpace: "nowrap" }}>{precioStr}</span>
                      </div>
                      <p style={{ fontSize: "13px", color: "var(--lf-text-dim)", marginBottom: "14px" }}>{safeStr(prop.ubicacion)}</p>
                      <div style={{ display: "flex", gap: "16px", fontSize: "12px", color: "var(--lf-text-muted)" }}>
                        {Number(prop.ambientes) > 0 && <span>{prop.ambientes} amb</span>}
                        {Number(prop.dormitorios) > 0 && <span>{prop.dormitorios} dorm</span>}
                        {Number(prop.banos) > 0 && <span>{prop.banos} baño{Number(prop.banos) > 1 ? "s" : ""}</span>}
                        {Number(prop.superficie_total) > 0 && <span>{prop.superficie_total}m²</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ textAlign: "center", marginTop: "32px" }}>
              <span onClick={() => navigate(`/${slug}/propiedades`)} style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "12px 28px", background: "var(--lf-elevated)", color: "var(--lf-text)", border: "1px solid var(--lf-border-strong)", borderRadius: "10px", fontSize: "14px", fontWeight: 600, cursor: "pointer", transition: "all 0.2s" }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--lf-primary)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--lf-border-strong)"; e.currentTarget.style.transform = "translateY(0)"; }}>
                Ver todas las propiedades →
              </span>
            </div>
          </section>
        )}

        {/* ====== CONTACT FORM ====== */}
        <section id="contacto" style={{ padding: "80px 24px 100px", maxWidth: "560px", margin: "0 auto" }}>
          <div className="lf-fade-up" style={{ textAlign: "center", marginBottom: "40px" }}>
            <h2 style={{ fontFamily: "var(--lf-font-display)", fontSize: "clamp(28px, 5vw, 40px)", fontWeight: 400, letterSpacing: "-0.02em", marginBottom: "12px" }}>Envianos tu consulta</h2>
            <p style={{ fontSize: "15px", color: "var(--lf-text-muted)", fontWeight: 300 }}>Completá el formulario y te respondemos a la brevedad</p>
          </div>

          {sent ? (
            <div className="lf-fade-up" style={{ textAlign: "center", padding: "48px 24px", background: "var(--lf-surface)", border: "1px solid var(--lf-border)", borderRadius: "var(--lf-radius)" }}>
              <div style={{ width: "56px", height: "56px", borderRadius: "50%", background: "rgba(34,197,94,0.1)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", color: "var(--lf-success)" }}><LandingIcons.Check /></div>
              <h3 style={{ fontSize: "18px", fontWeight: 600, marginBottom: "8px" }}>Consulta enviada</h3>
              <p style={{ fontSize: "14px", color: "var(--lf-text-muted)" }}>Nos comunicaremos con vos a la brevedad</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ background: "var(--lf-surface)", border: "1px solid var(--lf-border)", borderRadius: "var(--lf-radius)", padding: "32px", display: "flex", flexDirection: "column", gap: "20px" }}>
              {/* Nombre */}
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 500, color: "var(--lf-text-muted)", marginBottom: "6px" }}>Nombre *</label>
                <input type="text" value={form.nombre} onChange={(e) => updateField("nombre", e.target.value)} placeholder="Tu nombre completo"
                  style={{ width: "100%", padding: "12px 14px", background: "var(--lf-elevated)", border: "1px solid var(--lf-border)", borderRadius: "8px", color: "var(--lf-text)", fontSize: "14px", outline: "none", transition: "border-color 0.15s" }}
                  onFocus={(e) => e.target.style.borderColor = primaryColor} onBlur={(e) => e.target.style.borderColor = "var(--lf-border)"} />
              </div>

              {/* Teléfono */}
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 500, color: "var(--lf-text-muted)", marginBottom: "6px" }}>Teléfono *</label>
                <input type="tel" value={form.telefono} onChange={(e) => updateField("telefono", e.target.value)} placeholder="Ej: 341-555-0000"
                  style={{ width: "100%", padding: "12px 14px", background: "var(--lf-elevated)", border: "1px solid var(--lf-border)", borderRadius: "8px", color: "var(--lf-text)", fontSize: "14px", outline: "none", transition: "border-color 0.15s" }}
                  onFocus={(e) => e.target.style.borderColor = primaryColor} onBlur={(e) => e.target.style.borderColor = "var(--lf-border)"} />
              </div>

              {/* Propiedad */}
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 500, color: "var(--lf-text-muted)", marginBottom: "6px" }}>Propiedad de interés</label>
                <input type="text" value={form.propiedad} onChange={(e) => updateField("propiedad", e.target.value)} placeholder="Ej: Casa 3 ambientes en centro"
                  style={{ width: "100%", padding: "12px 14px", background: "var(--lf-elevated)", border: "1px solid var(--lf-border)", borderRadius: "8px", color: "var(--lf-text)", fontSize: "14px", outline: "none", transition: "border-color 0.15s" }}
                  onFocus={(e) => e.target.style.borderColor = primaryColor} onBlur={(e) => e.target.style.borderColor = "var(--lf-border)"} />
              </div>

              {/* Mensaje */}
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 500, color: "var(--lf-text-muted)", marginBottom: "6px" }}>Mensaje</label>
                <textarea value={form.mensaje} onChange={(e) => updateField("mensaje", e.target.value)} placeholder="Contanos qué estás buscando..." rows={4}
                  style={{ width: "100%", padding: "12px 14px", background: "var(--lf-elevated)", border: "1px solid var(--lf-border)", borderRadius: "8px", color: "var(--lf-text)", fontSize: "14px", outline: "none", resize: "vertical", minHeight: "100px", transition: "border-color 0.15s" }}
                  onFocus={(e) => e.target.style.borderColor = primaryColor} onBlur={(e) => e.target.style.borderColor = "var(--lf-border)"} />
              </div>

              {/* Error */}
              {formError && (
                <p style={{ fontSize: "13px", color: "var(--lf-danger)", padding: "8px 12px", background: "rgba(239,68,68,0.08)", borderRadius: "8px", border: "1px solid rgba(239,68,68,0.15)" }}>{formError}</p>
              )}

              {/* Submit */}
              <button type="submit" disabled={sending}
                style={{ padding: "14px", background: sending ? "var(--lf-elevated)" : "var(--lf-primary)", color: "#fff", border: "none", borderRadius: "10px", fontSize: "15px", fontWeight: 600, cursor: sending ? "wait" : "pointer", transition: "all 0.2s", boxShadow: sending ? "none" : `0 0 24px var(--lf-primary-glow)`, letterSpacing: "-0.01em", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
                onMouseEnter={(e) => { if (!sending) e.currentTarget.style.transform = "translateY(-1px)"; }}
                onMouseLeave={(e) => e.currentTarget.style.transform = "translateY(0)"}>
                {sending ? (
                  <><div style={{ width: "16px", height: "16px", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "lf-spin 0.7s linear infinite" }} /> Enviando...</>
                ) : (
                  <><LandingIcons.Send /> Enviar consulta</>
                )}
              </button>
            </form>
          )}
        </section>

        {/* ====== CONTACT INFO ====== */}
        {(telefono || emailContact || direccion || whatsappUrl) && (
          <section style={{ padding: "0 24px 80px", maxWidth: "560px", margin: "0 auto" }}>
            <div style={{ background: "var(--lf-surface)", border: "1px solid var(--lf-border)", borderRadius: "var(--lf-radius)", overflow: "hidden" }}>
              {[
                telefono && { icon: <LandingIcons.Phone />, label: "Teléfono", value: telefono, href: `tel:${telefono}` },
                whatsappUrl && { icon: <LandingIcons.WhatsApp />, label: "WhatsApp", value: "Enviar mensaje", href: whatsappUrl },
                emailContact && { icon: <LandingIcons.Mail />, label: "Email", value: emailContact, href: `mailto:${emailContact}` },
                direccion && { icon: <LandingIcons.MapPin />, label: "Dirección", value: direccion },
              ].filter(Boolean).map((item, i, arr) => (
                <div key={i} style={{ padding: "16px 20px", borderBottom: i < arr.length - 1 ? "1px solid var(--lf-border)" : "none", display: "flex", alignItems: "center", gap: "14px" }}>
                  <div style={{ color: "var(--lf-primary)", flexShrink: 0 }}>{item.icon}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: "11px", color: "var(--lf-text-dim)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "2px" }}>{item.label}</p>
                    {item.href ? (
                      <a href={item.href} target={item.href.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer" style={{ fontSize: "14px", color: "var(--lf-text)", textDecoration: "none", fontWeight: 500 }}
                        onMouseEnter={(e) => e.currentTarget.style.color = primaryColor} onMouseLeave={(e) => e.currentTarget.style.color = "var(--lf-text)"}>{item.value}</a>
                    ) : (
                      <p style={{ fontSize: "14px", color: "var(--lf-text)", fontWeight: 500 }}>{item.value}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
          </>
        )}

        {/* ====== PROPERTY LISTINGS PAGE ====== */}
        {subpage === "propiedades" && (
          <section style={{ padding: "100px 24px 60px", maxWidth: "1100px", margin: "0 auto" }}>
            <div style={{ marginBottom: "32px" }}>
              <h1 style={{ fontFamily: "var(--lf-font-display)", fontSize: "clamp(32px, 5vw, 48px)", fontWeight: 400, letterSpacing: "-0.02em", marginBottom: "8px" }}>Propiedades</h1>
              <p style={{ fontSize: "15px", color: "var(--lf-text-muted)", fontWeight: 300 }}>Explorá todas nuestras propiedades disponibles</p>
            </div>

            {/* Filters */}
            <div style={{ display: "flex", gap: "10px", marginBottom: "24px", flexWrap: "wrap" }}>
              <div style={{ position: "relative", flex: "1 1 240px", maxWidth: "360px" }}>
                <input placeholder="Buscar propiedades..." value={propSearchQ} onChange={(e) => setPropSearchQ(e.target.value)}
                  style={{ width: "100%", padding: "10px 12px 10px 14px", background: "var(--lf-elevated)", border: "1px solid var(--lf-border)", borderRadius: "8px", color: "var(--lf-text)", fontSize: "14px", outline: "none", fontFamily: "var(--lf-font-body)" }}
                  onFocus={(e) => e.target.style.borderColor = primaryColor} onBlur={(e) => e.target.style.borderColor = "var(--lf-border)"} />
              </div>
              <div style={{ display: "flex", gap: "6px" }}>
                {["all", "venta", "alquiler"].map(type => (
                  <button key={type} onClick={() => setPropFilter(type)} style={{ padding: "9px 16px", fontSize: "13px", fontWeight: 600, borderRadius: "8px", cursor: "pointer", fontFamily: "var(--lf-font-body)", transition: "all 0.2s", border: "1px solid", ...(propFilter === type ? { background: `${primaryColor}20`, color: primaryColor, borderColor: `${primaryColor}40` } : { background: "var(--lf-elevated)", color: "var(--lf-text-muted)", borderColor: "var(--lf-border)" }) }}>
                    {type === "all" ? "Todas" : type === "venta" ? "Venta" : "Alquiler"}
                  </button>
                ))}
              </div>
              <div style={{ display: "flex", gap: "6px" }}>
                {["all", "casa", "departamento", "local", "terreno"].map(type => (
                  <button key={type} onClick={() => setPropTypeFilter(type)} style={{ padding: "9px 14px", fontSize: "12px", fontWeight: 500, borderRadius: "8px", cursor: "pointer", fontFamily: "var(--lf-font-body)", transition: "all 0.2s", border: "1px solid", ...(propTypeFilter === type ? { background: `${primaryColor}20`, color: primaryColor, borderColor: `${primaryColor}40` } : { background: "var(--lf-elevated)", color: "var(--lf-text-muted)", borderColor: "var(--lf-border)" }) }}>
                    {type === "all" ? "Todos" : type.charAt(0).toUpperCase() + type.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Results count */}
            <p style={{ fontSize: "13px", color: "var(--lf-text-dim)", marginBottom: "20px" }}>{filteredListings.length} propiedad{filteredListings.length !== 1 ? "es" : ""} encontrada{filteredListings.length !== 1 ? "s" : ""}</p>

            {/* Grid */}
            {filteredListings.length === 0 ? (
              <div style={{ padding: "60px 24px", textAlign: "center", color: "var(--lf-text-dim)", background: "var(--lf-surface)", borderRadius: "var(--lf-radius)", border: "1px solid var(--lf-border)" }}>
                <p style={{ fontSize: "15px", marginBottom: "8px" }}>No se encontraron propiedades</p>
                <p style={{ fontSize: "13px" }}>Probá cambiando los filtros</p>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "20px" }}>
                {filteredListings.map((prop, i) => {
                  const precio = Number(prop.precio);
                  const moneda = safeStr(prop.moneda) || "USD";
                  const precioStr = precio ? `${moneda === "USD" ? "U$D" : "$"} ${precio.toLocaleString("es-AR")}` : "Consultar";
                  const opLabel = safeStr(prop.tipo_operacion) === "alquiler" ? "Alquiler" : "Venta";
                  const opColor = safeStr(prop.tipo_operacion) === "alquiler" ? "#3b82f6" : "#22c55e";
                  const imgUrl = safeStr(prop.imagen_url);
                  const propSlugVal = safeStr(prop.slug);
                  return (
                    <div key={i} className="lf-fade-up" onClick={() => propSlugVal && navigate(`/${slug}/propiedad/${propSlugVal}`)} style={{ background: "var(--lf-surface)", border: "1px solid var(--lf-border)", borderRadius: "var(--lf-radius)", overflow: "hidden", transition: "border-color 0.2s, transform 0.2s", animationDelay: `${i * 60}ms`, cursor: "pointer" }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--lf-border-strong)"; e.currentTarget.style.transform = "translateY(-4px)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--lf-border)"; e.currentTarget.style.transform = "translateY(0)"; }}>
                      <div style={{ height: "200px", background: imgUrl ? `url(${imgUrl}) center/cover` : "linear-gradient(135deg, var(--lf-elevated), var(--lf-surface))", position: "relative" }}>
                        {!imgUrl && <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--lf-text-dim)" }}><LandingIcons.Home /></div>}
                        <div style={{ position: "absolute", top: "12px", left: "12px", display: "flex", gap: "6px" }}>
                          <span style={{ padding: "4px 12px", fontSize: "11px", fontWeight: 600, borderRadius: "6px", color: opColor, background: "rgba(0,0,0,0.7)", textTransform: "uppercase", backdropFilter: "blur(8px)" }}>{opLabel}</span>
                          <span style={{ padding: "4px 12px", fontSize: "11px", fontWeight: 600, borderRadius: "6px", color: "#fff", background: "rgba(0,0,0,0.7)", textTransform: "uppercase", backdropFilter: "blur(8px)" }}>{safeStr(prop.tipo_propiedad)}</span>
                        </div>
                      </div>
                      <div style={{ padding: "20px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px", gap: "8px" }}>
                          <h3 style={{ fontSize: "15px", fontWeight: 600, letterSpacing: "-0.01em", flex: 1 }}>{safeStr(prop.titulo) || "Propiedad"}</h3>
                          <span style={{ fontSize: "15px", fontWeight: 700, color: opColor, whiteSpace: "nowrap" }}>{precioStr}</span>
                        </div>
                        <p style={{ fontSize: "13px", color: "var(--lf-text-dim)", marginBottom: "14px" }}>{safeStr(prop.ubicacion)}</p>
                        <div style={{ display: "flex", gap: "16px", fontSize: "12px", color: "var(--lf-text-muted)" }}>
                          {Number(prop.ambientes) > 0 && <span>{prop.ambientes} amb</span>}
                          {Number(prop.dormitorios) > 0 && <span>{prop.dormitorios} dorm</span>}
                          {Number(prop.banos) > 0 && <span>{prop.banos} baño{Number(prop.banos) > 1 ? "s" : ""}</span>}
                          {Number(prop.superficie_total) > 0 && <span>{prop.superficie_total}m²</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* ====== PROPERTY DETAIL PAGE ====== */}
        {subpage === "propiedad" && (
          <section style={{ padding: "90px 24px 60px", maxWidth: "900px", margin: "0 auto" }}>
            {!currentProperty ? (
              <div style={{ padding: "80px 24px", textAlign: "center" }}>
                <p style={{ fontSize: "16px", color: "var(--lf-text-muted)", marginBottom: "16px" }}>Propiedad no encontrada</p>
                <span onClick={() => navigate(`/${slug}/propiedades`)} style={{ fontSize: "14px", color: "var(--lf-primary)", cursor: "pointer", fontWeight: 600 }}>← Ver todas las propiedades</span>
              </div>
            ) : (() => {
              const p = currentProperty;
              const precio = Number(p.precio);
              const moneda = safeStr(p.moneda) || "USD";
              const precioStr = precio ? `${moneda === "USD" ? "U$D" : "$"} ${precio.toLocaleString("es-AR")}` : "Consultar";
              const opLabel = safeStr(p.tipo_operacion) === "alquiler" ? "Alquiler" : "Venta";
              const opColor = safeStr(p.tipo_operacion) === "alquiler" ? "#3b82f6" : "#22c55e";
              const imgUrl = safeStr(p.imagen_url);

              return (
                <div>
                  {/* Breadcrumb */}
                  <div style={{ marginBottom: "20px", fontSize: "13px", color: "var(--lf-text-dim)" }}>
                    <span onClick={() => navigate(`/${slug}`)} style={{ cursor: "pointer", transition: "color 0.2s" }} onMouseEnter={(e) => e.currentTarget.style.color = "var(--lf-text)"} onMouseLeave={(e) => e.currentTarget.style.color = "var(--lf-text-dim)"}>Inicio</span>
                    <span style={{ margin: "0 8px" }}>›</span>
                    <span onClick={() => navigate(`/${slug}/propiedades`)} style={{ cursor: "pointer", transition: "color 0.2s" }} onMouseEnter={(e) => e.currentTarget.style.color = "var(--lf-text)"} onMouseLeave={(e) => e.currentTarget.style.color = "var(--lf-text-dim)"}>Propiedades</span>
                    <span style={{ margin: "0 8px" }}>›</span>
                    <span style={{ color: "var(--lf-text-muted)" }}>{safeStr(p.titulo)}</span>
                  </div>

                  {/* Image */}
                  <div style={{ height: "clamp(250px, 40vw, 450px)", borderRadius: "var(--lf-radius)", overflow: "hidden", marginBottom: "28px", background: imgUrl ? `url(${imgUrl}) center/cover` : "linear-gradient(135deg, var(--lf-elevated), var(--lf-surface))", position: "relative" }}>
                    {!imgUrl && <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--lf-text-dim)", fontSize: "48px" }}><LandingIcons.Home /></div>}
                    <div style={{ position: "absolute", top: "16px", left: "16px", display: "flex", gap: "8px" }}>
                      <span style={{ padding: "6px 16px", fontSize: "12px", fontWeight: 600, borderRadius: "8px", color: opColor, background: "rgba(0,0,0,0.75)", textTransform: "uppercase", backdropFilter: "blur(8px)" }}>{opLabel}</span>
                      <span style={{ padding: "6px 16px", fontSize: "12px", fontWeight: 600, borderRadius: "8px", color: "#fff", background: "rgba(0,0,0,0.75)", textTransform: "uppercase", backdropFilter: "blur(8px)" }}>{safeStr(p.tipo_propiedad)}</span>
                    </div>
                  </div>

                  {/* Title & price */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px", marginBottom: "8px", flexWrap: "wrap" }}>
                    <h1 style={{ fontFamily: "var(--lf-font-display)", fontSize: "clamp(24px, 4vw, 36px)", fontWeight: 400, letterSpacing: "-0.02em" }}>{safeStr(p.titulo)}</h1>
                    <span style={{ fontSize: "clamp(20px, 3vw, 28px)", fontWeight: 700, color: opColor, whiteSpace: "nowrap" }}>{precioStr}</span>
                  </div>
                  <p style={{ fontSize: "15px", color: "var(--lf-text-muted)", marginBottom: "24px" }}>{safeStr(p.ubicacion)}</p>

                  {/* Features grid */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "12px", marginBottom: "28px" }}>
                    {[
                      { label: "Ambientes", value: Number(p.ambientes) },
                      { label: "Dormitorios", value: Number(p.dormitorios) },
                      { label: "Baños", value: Number(p.banos) },
                      { label: "Cochera", value: Number(p.cochera) },
                      { label: "Sup. Total", value: Number(p.superficie_total), unit: "m²" },
                      { label: "Sup. Cubierta", value: Number(p.superficie_cubierta), unit: "m²" },
                    ].filter(f => f.value > 0).map((f, i) => (
                      <div key={i} style={{ background: "var(--lf-surface)", border: "1px solid var(--lf-border)", borderRadius: "10px", padding: "16px", textAlign: "center" }}>
                        <p style={{ fontSize: "22px", fontWeight: 700, color: "var(--lf-text)", marginBottom: "4px" }}>{f.value}{f.unit || ""}</p>
                        <p style={{ fontSize: "11px", color: "var(--lf-text-dim)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{f.label}</p>
                      </div>
                    ))}
                  </div>

                  {/* Description */}
                  {safeStr(p.descripcion) && (
                    <div style={{ marginBottom: "32px" }}>
                      <h3 style={{ fontSize: "16px", fontWeight: 600, marginBottom: "12px" }}>Descripción</h3>
                      <p style={{ fontSize: "15px", color: "var(--lf-text-muted)", lineHeight: 1.7 }}>{safeStr(p.descripcion)}</p>
                    </div>
                  )}

                  {/* Contact form for this property */}
                  <div style={{ background: "var(--lf-surface)", border: "1px solid var(--lf-border)", borderRadius: "var(--lf-radius)", padding: "28px", marginBottom: "20px" }}>
                    <h3 style={{ fontSize: "16px", fontWeight: 600, marginBottom: "16px" }}>Consultar por esta propiedad</h3>
                    {sent ? (
                      <div style={{ textAlign: "center", padding: "24px" }}>
                        <p style={{ fontSize: "15px", color: "var(--lf-success)", fontWeight: 600 }}>Consulta enviada correctamente</p>
                        <p style={{ fontSize: "13px", color: "var(--lf-text-muted)", marginTop: "4px" }}>Nos comunicaremos a la brevedad</p>
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                          <input value={form.nombre} onChange={(e) => updateField("nombre", e.target.value)} placeholder="Tu nombre *" style={{ padding: "11px 14px", background: "var(--lf-elevated)", border: "1px solid var(--lf-border)", borderRadius: "8px", color: "var(--lf-text)", fontSize: "14px", outline: "none", fontFamily: "var(--lf-font-body)" }} />
                          <input value={form.telefono} onChange={(e) => updateField("telefono", e.target.value)} placeholder="Tu teléfono *" style={{ padding: "11px 14px", background: "var(--lf-elevated)", border: "1px solid var(--lf-border)", borderRadius: "8px", color: "var(--lf-text)", fontSize: "14px", outline: "none", fontFamily: "var(--lf-font-body)" }} />
                        </div>
                        <textarea value={form.mensaje} onChange={(e) => updateField("mensaje", e.target.value)} placeholder={`Hola, me interesa "${safeStr(p.titulo)}". ¿Podrían darme más información?`} rows={3} style={{ padding: "11px 14px", background: "var(--lf-elevated)", border: "1px solid var(--lf-border)", borderRadius: "8px", color: "var(--lf-text)", fontSize: "14px", outline: "none", resize: "vertical", fontFamily: "var(--lf-font-body)" }} />
                        {formError && <p style={{ fontSize: "13px", color: "var(--lf-danger)" }}>{formError}</p>}
                        <div style={{ display: "flex", gap: "10px" }}>
                          <button onClick={(e) => { e.preventDefault(); setForm(prev => ({ ...prev, propiedad: safeStr(p.titulo) })); handleSubmit(e); }} disabled={sending} style={{ flex: 1, padding: "12px", background: "var(--lf-primary)", color: "#fff", border: "none", borderRadius: "8px", fontSize: "14px", fontWeight: 600, cursor: sending ? "wait" : "pointer", fontFamily: "var(--lf-font-body)", boxShadow: `0 0 20px var(--lf-primary-glow)` }}>
                            {sending ? "Enviando..." : "Enviar consulta"}
                          </button>
                          {whatsappUrl && (
                            <a href={`https://wa.me/${safeStr(branding.whatsapp).replace(/[^0-9]/g, "")}?text=${encodeURIComponent(`Hola, me interesa la propiedad "${safeStr(p.titulo)}". ¿Podrían darme más información?`)}`} target="_blank" rel="noopener noreferrer" style={{ padding: "12px 20px", background: "#25D366", color: "#fff", border: "none", borderRadius: "8px", fontSize: "14px", fontWeight: 600, textDecoration: "none", display: "flex", alignItems: "center", gap: "6px" }}>
                              <LandingIcons.WhatsApp /> WhatsApp
                            </a>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
          </section>
        )}

        {/* ====== FOOTER ====== */}
        <footer style={{ padding: "24px", borderTop: "1px solid var(--lf-border)", textAlign: "center" }}>
          <p style={{ fontSize: "12px", color: "var(--lf-text-dim)" }}>© {new Date().getFullYear()} {nombre}. Todos los derechos reservados.</p>
          <p style={{ fontSize: "11px", color: "var(--lf-text-dim)", marginTop: "4px", opacity: 0.5 }}>Potenciado por LeadFlow</p>
        </footer>

        {/* ====== FLOATING WHATSAPP ====== */}
        {whatsappUrl && (
          <a href={whatsappUrl} target="_blank" rel="noopener noreferrer"
            style={{ position: "fixed", bottom: "24px", right: "24px", width: "56px", height: "56px", borderRadius: "50%", background: "#25D366", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 24px rgba(37,211,102,0.3)", zIndex: 40, transition: "transform 0.2s, box-shadow 0.2s", textDecoration: "none" }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.1)"; e.currentTarget.style.boxShadow = "0 6px 32px rgba(37,211,102,0.4)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = "0 4px 24px rgba(37,211,102,0.3)"; }}>
            <LandingIcons.WhatsApp />
          </a>
        )}
      </div>
    </>
  );
}
