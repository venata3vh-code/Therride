export const MODELS = ["Light Bee X", "Light Bee S", "Ultra Bee", "Storm Bee"];
export const CATEGORIES = [
 {id:"bodywork",name:"Пластмаси и защити",detail:"Защита и визия",icon:"accessory"},
 {id:"maintenance",name:"Поддръжка",detail:"Грижа за следващото каране",icon:"drive"},
  {
    id: "brakes",
    name: "Спирачки",
    detail: "Контрол във всеки завой",
    icon: "disc",
  },
  {
    id: "suspension",
    name: "Окачване",
    detail: "За следващия терен",
    icon: "suspension",
  },
  {
    id: "drivetrain",
    name: "Задвижване",
    detail: "От мотора до колелото",
    icon: "drive",
  },
  {
    id: "electrical",
    name: "Електроника",
    detail: "Свързано с карането",
    icon: "electric",
  },
  {
    id: "accessories",
    name: "Аксесоари",
    detail: "Детайлите са твои",
    icon: "accessory",
  },
];
export const categoryName = (id) =>
  CATEGORIES.find((c) => c.id === id)?.name || id;
export const categoryId = (name) =>
  CATEGORIES.find((c) => c.name === name)?.id || "accessories";
export function fitmentLabel(p) {
  if (p.fitment_type === "specific" && p.compatible_models?.length)
    return p.compatible_models.join(" / ");
  if (p.fitment_type === "universal") return "Универсален монтаж";
  return "Провери съвместимостта";
}
export function filterProducts(
  products,
  {
    query = "",
    category = "",
    model = "",
    stock = false,
    sort = "featured",
  } = {},
) {
  const q = query.trim().toLocaleLowerCase("bg");
  const filtered = products.filter(
    (p) =>
      (!category || categoryId(p.category) === category) &&
      (!model ||
        (p.fitment_type === "specific" &&
          p.compatible_models?.includes(model))) &&
      (!stock ||
        (Number.isInteger(p.stock_quantity) && p.stock_quantity > 0)) &&
      (!q ||
        [
          p.name,
          p.subtitle,
          p.sku,
          p.manufacturer,
          p.category,
          ...(p.compatible_models || []),
        ]
          .join(" ")
          .toLocaleLowerCase("bg")
          .includes(q)),
  );
  return [...filtered].sort((a, b) =>
    sort === "price-low"
      ? a.price_cents - b.price_cents
      : sort === "price-high"
        ? b.price_cents - a.price_cents
        : b.featured - a.featured || a.sort_order - b.sort_order,
  );
}
export const DEFAULT_SETTINGS = {
  hero_title: "ТВОЯТ SUR-RON.\nТВОИТЕ ПРАВИЛА.",
  hero_description:
    "Части и аксесоари за следващата ти посока. Започни от модела. Избери своя детайл.",
  contact_email: "therride7@gmail.com",
  instagram_url: "https://www.instagram.com/_therride_/",
  free_shipping_threshold_cents: 3699,
  checkout_enabled: false,
  stripe_enabled: false,
};
