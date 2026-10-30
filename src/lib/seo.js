export function pageMeta(path, products = [], settings = {}) {
  const common = {
    title: "THERRIDE — Части и аксесоари за Sur-Ron",
    description:
      "Части и аксесоари за Sur-Ron Light Bee, Ultra Bee и Storm Bee. Избор по модел, съвместимост и категория. THERRIDE — твоят мотор, твоите правила.",
    image: "/images/IMG_0205-1200.webp",
  };
  const info = {
    delivery: [
      "Доставка с Еконт и Спиди",
      "Информация за доставката, куриерите и стойността на поръчката в THERRIDE.",
    ],
    returns: [
      "Връщане и рекламации",
      "Информация за връщане и рекламации на продукти от THERRIDE.",
    ],
    contact: [
      "Контакти и помощ при избора",
      "Попитай THERRIDE за част, модел и съвместимост със Sur-Ron.",
    ],
    about: [
      "За Therride — карането е лично",
      "От собствените ни аксесоари до части за Sur-Ron. Историята и посоката на THERRIDE.",
    ],
    privacy: ["Поверителност", "Как обработваме личните данни в THERRIDE."],
    terms: ["Общи условия", "Условия за покупки от THERRIDE."],
  };
  if (path === "/") return common;
  if (path === "/shop")
    return {
      ...common,
      title: "Каталог: части и аксесоари за Sur-Ron — THERRIDE",
    };
  if (path.startsWith("/info/") && info[path.slice(6)])
    return {
      ...common,
      title: info[path.slice(6)][0] + " — THERRIDE",
      description: info[path.slice(6)][1],
    };
  if (path.startsWith("/product/")) {
    const p = products.find(
      (p) => p.slug === decodeURIComponent(path.slice(9)),
    );
    if (p)
      return {
        ...common,
        title: p.seo_title || p.name + " — THERRIDE",
        description: p.seo_description || p.description.slice(0, 160),
        image: p.images?.[0]?.url || common.image,
        product: p,
      };
  }
  return {
    ...common,
    title: path.startsWith("/admin")
      ? "Администрация — THERRIDE"
      : path.startsWith("/checkout")
        ? "Твоята поръчка — THERRIDE"
        : "Страницата не е намерена — THERRIDE",
    noindex: true,
  };
}
export function structuredData(path, products, settings, site) {
  if (!site) return [];
  const meta = pageMeta(path, products, settings),
    p = meta.product;
  const absolute = (url) => new URL(url, site).href;
  if (p) {
    const product = {
      "@context": "https://schema.org",
      "@type": "Product",
      name: p.name,
      description: p.description,
      image: (p.images || []).map((i) => absolute(i.url)),
      ...(p.sku ? { sku: p.sku } : {}),
      ...(p.manufacturer
        ? { brand: { "@type": "Brand", name: p.manufacturer } }
        : {}),
    };
    if (settings.checkout_enabled)
      product.offers = {
        "@type": "Offer",
        url: absolute(path),
        price: (p.price_cents / 100).toFixed(2),
        priceCurrency: "EUR",
        ...(p.stock_quantity !== null
          ? {
              availability:
                "https://schema.org/" +
                (p.stock_quantity > 0 ? "InStock" : "OutOfStock"),
            }
          : {}),
      };
    return [
      product,
      {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Начало",
            item: site + "/",
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "Каталог",
            item: site + "/shop",
          },
          {
            "@type": "ListItem",
            position: 3,
            name: p.name,
            item: absolute(path),
          },
        ],
      },
    ];
  }
  if (path === "/")
    return [
      {
        "@context": "https://schema.org",
        "@type": "Organization",
        name: "THERRIDE",
        url: site,
        logo: site + "/images/logo.webp",
        ...(settings.instagram_url ? { sameAs: [settings.instagram_url] } : {}),
      },
      {
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: "THERRIDE",
        url: site,
        inLanguage: "bg-BG",
      },
    ];
  return [];
}
