import { useEffect } from "react";
import { pageMeta, structuredData } from "../lib/seo.js";
export function Seo({ path, products, settings }) {
  useEffect(() => {
    const site = (import.meta.env.VITE_SITE_URL || location.origin).replace(
      /\/$/,
      "",
    );
    const m = pageMeta(path, products, settings);
    document.title = m.title;
    const meta = (attr, key, value) => {
      let el = document.head.querySelector(`meta[${attr}="${key}"]`);
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute(attr, key);
        document.head.appendChild(el);
      }
      el.content = value;
    };
    meta("name", "description", m.description);
    meta("name", "robots", (m.noindex||new URLSearchParams(location.search).get('preview')==='1') ? "noindex,follow" : "index,follow");
    meta("property", "og:title", m.title);
    meta("property", "og:description", m.description);
    meta("property", "og:image", new URL(m.image, site).href);
    meta("property", "og:url", site + path);
    meta("property", "og:type", m.product ? "product" : "website");
    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.appendChild(canonical);
    }
    canonical.href = site + path;
    document
      .querySelectorAll("script[data-therride-schema]")
      .forEach((n) => n.remove());
    for (const data of structuredData(path, products, settings, site)) {
      const s = document.createElement("script");
      s.type = "application/ld+json";
      s.dataset.therrideSchema = "true";
      s.textContent = JSON.stringify(data);
      document.head.appendChild(s);
    }
  }, [path, products, settings]);
  return null;
}
