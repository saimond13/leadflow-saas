import { useState, useEffect } from "react";

// ============================================================
// SIMPLE ROUTER
// Detects URL path and renders the correct view.
// No react-router dependency needed.
//
// Routes:
//   /panel  or  /panel/*   → Dashboard (private)
//   /                      → Redirect to /panel
//   /:slug                 → Public landing for that inmobiliaria
// ============================================================

// Lazy imports to keep bundles separate
import Dashboard from "./Dashboard";
import PublicLanding from "./PublicLanding";

// Reserved paths that should NOT be treated as inmobiliaria slugs
const RESERVED = new Set(["panel", "login", "admin", "api", "favicon.ico"]);

function getRoute() {
  const path = window.location.pathname.replace(/\/+$/, "") || "/";
  const segments = path.split("/").filter(Boolean);

  if (segments.length === 0) {
    return { view: "panel" };
  }

  if (segments[0] === "panel") {
    return { view: "panel" };
  }

  // Any other single segment = public landing slug
  const slug = segments[0];
  if (!RESERVED.has(slug)) {
    return { view: "landing", slug };
  }

  return { view: "panel" };
}

export default function App() {
  const [route, setRoute] = useState(getRoute);

  // Listen for popstate (back/forward)
  useEffect(() => {
    const handleNav = () => setRoute(getRoute());
    window.addEventListener("popstate", handleNav);
    return () => window.removeEventListener("popstate", handleNav);
  }, []);

  if (route.view === "landing") {
    return <PublicLanding slug={route.slug} />;
  }

  return <Dashboard />;
}
