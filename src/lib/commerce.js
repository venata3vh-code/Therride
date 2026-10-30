import {optionFor,optionAvailable,imagesFor} from './variants.js';
export const money = (cents) =>
  new Intl.NumberFormat("bg-BG", { style: "currency", currency: "EUR" }).format(
    cents / 100,
  );
export const COLORS = [
  { name: "Черно", hex: "#222624" },
  { name: "Бяло", hex: "#ffffff" },
  { name: "Зелено", hex: "#23894d" },
  { name: "Червено", hex: "#df3b32" },
  { name: "Синьо", hex: "#3865d7" },
  { name: "Розово", hex: "#f2a8c2" },
  { name: "Лилаво", hex: "#9047ca" },
  { name: "Жълто", hex: "#f3d13a" },
  { name: "Оранжево", hex: "#ff6b00" },
  { name: "Бежово", hex: "#d4be96" },
];
export function totals(cart, products, settings = {}) {
  let subtotal = 0,
    count = 0;
  for (const line of cart) {
    const p = products.find((p) => p.id === line.product_id);
    if (
      !p ||
      !optionAvailable(p,optionFor(p,line)) ||
      !Number.isInteger(line.quantity) ||
      line.quantity < 1 ||
      line.quantity > 10
    )
      continue;
    subtotal += optionFor(p,line).price_cents * line.quantity;
    count += line.quantity;
  }
  const pct =
    count >= 3
      ? Number(settings.discount_3 || 0)
      : count >= 2
        ? Number(settings.discount_2 || 0)
        : 0;
  const discount = Math.round(
    (subtotal * Math.min(80, Math.max(0, pct))) / 100,
  );
  const net = subtotal - discount;
  const free =
    net > 0 &&
    settings.free_shipping_threshold_cents !== null &&
    settings.free_shipping_threshold_cents !== undefined &&
    net >= settings.free_shipping_threshold_cents;
  const shipping = free ? 0 : (settings.shipping_fee_cents ?? null);
  return {
    subtotal,
    discount,
    percent: pct,
    net,
    shipping,
    total: net + (shipping || 0),
    count,
    free,
  };
}
export function normalizeCart(input) {
  if (!Array.isArray(input)) return [];
  return input
    .filter(
      (x) =>
        x &&
        typeof x.product_id === "string" &&
        typeof x.color === "string" &&
        Number.isInteger(x.quantity) &&
        x.quantity > 0,
    )
    .slice(0, 20)
    .map((x) => ({
      product_id: x.product_id,
      color: x.color,
      quantity: Math.min(x.quantity, 10),
      ...(typeof x.variant_id==='string'&&/^[a-z0-9][a-z0-9-]{0,100}$/.test(x.variant_id)?{variant_id:x.variant_id}:{}),
    }));
}
export const readableError = (err) => {
  const m = err?.message || String(err);
  if (/invalid login/i.test(m)) return "Провери имейла и паролата си.";
  if (/email not confirmed/i.test(m))
    return "Потвърди имейла си от полученото писмо.";
  if (/rate limit/i.test(m))
    return "Твърде много опити. Опитай отново след малко.";
  if (/permission|row-level|policy|42501/i.test(m))
    return "Нямаш права за това действие. Влез с администраторския акаунт.";
  return m;
};
export function imageFor(product, ref) {return imagesFor(product,ref)[0]||{url:'/images/logo.webp',alt:product?.name||'THERRIDE'};}
