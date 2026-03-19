import { useState, useEffect } from "react";

// ============================================================
// SIMPLE ROUTER
// Routes:
//   /panel  or  /panel/*        → Dashboard (private)
//   /                           → Redirect to /panel
//   /:slug                      → Public landing home
//   /:slug/propiedades          → Property listings
//   /:slug/propiedad/:propSlug  → Property detail page
// ============================================================

import Dashboard from "./Dashboard";
import PublicLanding from "./PublicLanding";

const RESERVED = new Set(["panel", "login", "admin", "api", "favicon.ico"]);

function getRoute() {
  const path = window.location.pathname.replace(/\/+$/, "") || "/";
  const segments = path.split("/").filter(Boolean);

  if (segments.length === 0) return { view: "panel" };
  if (segments[0] === "panel") return { view: "panel" };

  const slug = segments[0];
  if (RESERVED.has(slug)) return { view: "panel" };

  // /:slug/propiedades
  if (segments[1] === "propiedades") return { view: "landing", slug, subpage: "propiedades" };

  // /:slug/propiedad/:propSlug
  if (segments[1] === "propiedad" && segments[2]) return { view: "landing", slug, subpage: "propiedad", propSlug: segments[2] };

  // /:slug (home)
  return { view: "landing", slug, subpage: "home" };
}

// Helper for SPA navigation without page reload
function navigate(url) {
  window.history.pushState({}, "", url);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export { navigate };

export default function App() {
  const [route, setRoute] = useState(getRoute);

  useEffect(() => {
    const handleNav = () => setRoute(getRoute());
    window.addEventListener("popstate", handleNav);
    return () => window.removeEventListener("popstate", handleNav);
  }, []);

  if (route.view === "landing") {
    return <PublicLanding slug={route.slug} subpage={route.subpage} propSlug={route.propSlug} />;
  }

  return <Dashboard />;
}
