import {optionsFor,optionFor,optionAvailable,imagesFor,linePrice} from './lib/variants.js';
import React, {
  useState,
  useEffect,
  useMemo,
  useRef,
  Suspense,
  lazy,
} from "react";
import {
  ArrowRight,
  ArrowUpRight,
  ShoppingBag,
  Menu,
  X,
  Plus,
  Minus,
  Check,
  ChevronRight,
  ChevronDown,
  Truck,
  ShieldCheck,
  Flag,
  Package,
  Mail,
  LockKeyhole,
  LoaderCircle,
  Trash2,
  Search,
  CheckCircle2,
  ArrowLeft,
  MoveUpRight,
} from "lucide-react";
import { loadCatalog } from "./lib/catalog-api.js";
import { DEFAULT_SETTINGS, fitmentLabel } from "./lib/catalog.js";
import {
  PartsHome as Home,
  PartsShop as Shop,
  ProductCard,
} from "./components/PartsStore.jsx";
import { ProductImage } from "./components/ProductImage.jsx";
import { Seo } from "./components/Seo.jsx";
import {
  money,
  COLORS,
  totals,
  normalizeCart,
  imageFor,
  readableError,
} from "./lib/commerce.js";
const PaymentReturn = lazy(() => import("./components/PaymentReturn.jsx"));
const Checkout = lazy(() => import("./components/Checkout.jsx"));
const Admin = lazy(() => import("./components/Admin.jsx"));
function useRoute() {
  const [path, setPath] = useState(
    (location.pathname.replace(/\/+$/, "") || "/") + location.search,
  );
  useEffect(() => {
    const f = () =>
      setPath((location.pathname.replace(/\/+$/, "") || "/") + location.search);
    addEventListener("popstate", f);
    return () => removeEventListener("popstate", f);
  }, []);
  return path;
}
export function go(url) {
  history.pushState({}, "", url);
  dispatchEvent(new PopStateEvent("popstate"));
  if (url.includes("#"))
    setTimeout(
      () =>
        document
          .getElementById(url.split("#")[1])
          ?.scrollIntoView({ behavior: "smooth" }),
      60,
    );
  else window.scrollTo({ top: 0, behavior: "instant" });
}
export function Link({ to, children, onClick, ...props }) {
  return (
    <a
      href={to}
      {...props}
      onClick={(e) => {
        onClick?.(e);
        if (
          !e.defaultPrevented &&
          !e.metaKey &&
          !e.ctrlKey &&
          !e.shiftKey &&
          e.button === 0
        ) {
          e.preventDefault();
          go(to);
        }
      }}
    >
      {children}
    </a>
  );
}
function Instagram({ size = 24, ...props }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      {...props}
    >
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.7" r=".9" fill="currentColor" stroke="none" />
    </svg>
  );
}
const initialSettings = DEFAULT_SETTINGS;
export function Modal({ children, close, label, wide = false }) {
  const ref = useRef();
  const closeRef=useRef(close);closeRef.current=close;
  useEffect(() => {
    const prev = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const el = ref.current;
    const focusable = () =>
      [
        ...el.querySelectorAll(
          'button,a[href],input,textarea,select,[tabindex="0"]',
        ),
      ].filter((x) => !x.disabled && x.getClientRects().length);
    focusable()[0]?.focus();
    const handler = (e) => {
      if (e.key === "Escape") closeRef.current();
      if (e.key === "Tab") {
        const list = focusable(),
          first = list[0],
          last = list.at(-1);
        if (!list.length) {
          e.preventDefault();
          return;
        }
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", handler);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", handler);
      prev?.focus?.();
    };
  }, []);
  return (
    <div
      className="modal-shade"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <section
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className={"modal " + (wide ? "modal-wide" : "")}
      >
        <button
          className="icon-button modal-close"
          aria-label="Затвори"
          onClick={close}
        >
          <X size={22} />
        </button>
        {children}
      </section>
    </div>
  );
}
function App() {
  const route = useRoute();
  const path = route.split("?")[0];
  const [products, setProducts] = useState(() => {
      try {
        return (
          JSON.parse(document.getElementById("store-data")?.textContent || "{}")
            .products || []
        );
      } catch {
        return [];
      }
    }),
    [settings, setSettings] = useState(() => {
      try {
        return (
          JSON.parse(document.getElementById("store-data")?.textContent || "{}")
            .settings || initialSettings
        );
      } catch {
        return initialSettings;
      }
    }),
    [loading, setLoading] = useState(!document.getElementById("store-data")),
    [error, setError] = useState("");
  const [cart, setCart] = useState(() => {
    try {
      return normalizeCart(
        JSON.parse(localStorage.getItem("therride-cart") || "[]"),
      );
    } catch {
      return [];
    }
  });
  const [cartOpen, setCartOpen] = useState(false),
    [menuOpen, setMenuOpen] = useState(false),
    [toast, setToast] = useState("");
  const flash = (t) => setToast(t);
  const refresh = async () => {
    setError("");
    try {
      let d=await loadCatalog();
      if(new URLSearchParams(location.search).get('preview')==='1'){
        const {supabase,adminAccess}=await import('./lib/supabase.js');
        if(!await adminAccess())throw new Error('Влез като администратор за преглед на черновите.');
        const result=await supabase.from('products').select('*').order('sort_order');if(result.error)throw result.error;d={...d,products:result.data};
      }
      setProducts(d.products);
      setSettings(d.settings);
    } catch (e) {
      setError("Каталогът не се зареди. Опитай отново след малко.");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    refresh();
  }, [route.includes('preview=1')]);
  useEffect(() => {
    try {
      localStorage.setItem("therride-cart", JSON.stringify(cart));
    } catch {}
  }, [cart]);
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(""), 4000);
      return () => clearTimeout(t);
    }
  }, [toast]);
  useEffect(() => {
    setCartOpen(false);
    setMenuOpen(false);
    document.querySelector('meta[name="robots"]')?.remove();
    if (path.startsWith("/admin") || path.startsWith("/checkout")) {
      const m = document.createElement("meta");
      m.name = "robots";
      m.content = "noindex,nofollow";
      document.head.appendChild(m);
    }
    if (path === "/")
      document.title = "THERRIDE — Части и аксесоари за Sur-Ron";
  }, [path]);
  useEffect(() => {
    const close = () => {
      setCartOpen(false);
      setMenuOpen(false);
    };
    addEventListener("popstate", close);
    return () => removeEventListener("popstate", close);
  }, []);
  const amount = totals(cart, products, settings);
  const add=(product,key,quantity)=>{const v=optionFor(product,key);if(!optionAvailable(product,v)){flash('Вариантът няма потвърдена наличност.');return;}const exists=cart.find(x=>x.product_id===product.id&&(x.variant_id||x.color)===v.id);const q=(exists?.quantity||0)+quantity;const shared=product.variants?.length?0:cart.filter(x=>x.product_id===product.id&&x!==exists).reduce((n,x)=>n+x.quantity,0);if(q>10||(v.stock_quantity!=null&&q+shared>v.stock_quantity)){flash('Избраното количество надвишава наличността или лимита от 10 броя.');return;}setCart(c=>exists?c.map(x=>x===exists?{...x,quantity:q}:x):[...c,{product_id:product.id,color:v.label,quantity,...(product.variants?.length?{variant_id:v.id}:{})}]);setCartOpen(true);};
  const update=(line,q)=>setCart(current=>{const p=products.find(p=>p.id===line.product_id),v=optionFor(p,line);const other=p?.variants?.length?0:current.filter(x=>x!==line&&x.product_id===line.product_id).reduce((n,x)=>n+x.quantity,0);const limit=v?.stock_quantity==null?10:Math.max(0,Math.min(10,v.stock_quantity-other));return q<=0?current.filter(x=>x!==line):current.map(x=>x===line?{...x,quantity:Math.min(q,limit)}:x).filter(x=>x.quantity>0);});
  if (path.startsWith("/admin"))
    return (
      <Suspense
        fallback={
          <div className="page-loading">
            <LoaderCircle className="spin" />
            Зареждане на панела…
          </div>
        }
      >
        <Admin flash={flash} toast={toast} refreshStore={refresh} />
      </Suspense>
    );
  let page;
  if (path === "/")
    page = (
      <Home
        products={products}
        settings={settings}
        loading={loading}
        error={error}
        retry={refresh}
      />
    );
  else if (path === "/shop")
    page = (
      <Shop
        key={route}
        products={products}
        loading={loading}
        error={error}
        retry={refresh}
      />
    );
  else if (path.startsWith("/product/"))
    page = (
      <Product
        key={path}
        product={products.find(
          (p) => p.slug === decodeURIComponent(path.slice(9)),
        )}
        products={products}
        loading={loading}
        settings={settings}
        add={add}
      />
    );
  else if (path === "/checkout/return")
    page = (
      <Suspense
        fallback={<div className="page-loading">Проверка на плащането…</div>}
      >
        <PaymentReturn done={() => setCart([])} />
      </Suspense>
    );
  else if (path === "/checkout")
    page = (
      <Suspense
        fallback={
          <div className="page-loading">
            <LoaderCircle className="spin" />
            Подготвяме поръчката…
          </div>
        }
      >
        <Checkout
          products={products}
          cart={cart}
          settings={settings}
          update={update}
          done={() => setCart([])}
          loading={loading}
        />
      </Suspense>
    );
  else if (path.startsWith("/info/"))
    page = <Info type={path.slice(6)} settings={settings} />;
  else
    page = (
      <div className="empty page-shell">
        <span className="eyebrow">404</span>
        <h1>Този път свършва тук.</h1>
        <p>Страницата не е намерена. Да се върнем към карането.</p>
        <Link to="/shop" className="button">
          Към продуктите <ArrowRight size={18} />
        </Link>
      </div>
    );
  return (
    <>
      <a className="skip-link" href="#content">
        Към съдържанието
      </a>
      <div className="top-strip">
        <span>
          <span className="status-dot" /> ЧАСТИ & АКСЕСОАРИ ЗА SUR-RON
        </span>
        <span>Твоят мотор. Твоето каране.</span>
      </div>
      <header className="site-header">
        <div className="header-inner">
          <Link to="/" className="brand" aria-label="THERRIDE — начало">
            <img
              src="/images/logo.webp"
              alt="THERRIDE"
              width="82"
              height="72"
            />
            <span className="brand-word">
              THERRIDE
            </span>
          </Link>
          <nav className="desktop-nav" aria-label="Главно меню">
            <Link to="/shop" className={path === "/shop" ? "active" : ""}>
              Каталог
            </Link>
            <Link to="/#models">Твоят модел</Link>
            <Link to="/#fitment">Съвместимост</Link>
            <Link to="/info/contact">Контакти</Link>
          </nav>
          <div className="header-actions">
            <button
              className="cart-button"
              aria-label={"Количка, " + amount.count + " продукта"}
              onClick={() => setCartOpen(true)}
            >
              <ShoppingBag size={20} />
              <span className="cart-word">Количка</span>
              <span className="cart-count">{amount.count}</span>
            </button>
            <button
              className="icon-button mobile-menu"
              aria-label="Отвори менюто"
              onClick={() => setMenuOpen(true)}
            >
              <Menu />
            </button>
          </div>
        </div>
      </header>
      <Seo path={path} products={products} settings={settings} />
      <main id="content" tabIndex={-1}>{new URLSearchParams(location.search).get('preview')==='1'&&<div className="draft-preview-banner">Администраторски преглед на чернови · поръчките изискват потвърдена наличност</div>}
        {page}
      </main>
      <Footer settings={settings} />
      {cartOpen && (
        <CartDrawer
          cart={cart}
          products={products}
          settings={settings}
          update={update}
          close={() => setCartOpen(false)}
        />
      )}{" "}
      {menuOpen && (
        <Modal label="Главно меню" close={() => setMenuOpen(false)}>
          <nav className="mobile-nav">
            <Link to="/">Начало</Link>
            <Link to="/shop">Каталог</Link>
            <Link to="/#models">Твоят модел</Link>
            <Link to="/#fitment">Съвместимост</Link>
            <Link to="/info/contact">Контакти</Link>
          </nav>
        </Modal>
      )}
      {toast && (
        <div role="status" className="toast">
          <CheckCircle2 size={19} />
          {toast}
        </div>
      )}
    </>
  );
}
function Product({ product: p, products, loading, settings, add }) {
  const [color, setColor] = useState(
      p?.variants?.[0]?.id || p?.images?.[0]?.color || p?.colors?.[0] || "Черно",
    ),
    [quantity, setQuantity] = useState(1),
    [gallery, setGallery] = useState(0);
  useEffect(() => {
    if (p) {
      setColor(p.variants?.[0]?.id || p.images?.[0]?.color || p.colors[0]);
      document.title = p.name + " — THERRIDE";
    }
  }, [p?.id]);
  if (loading)
    return (
      <div className="page-loading">
        <LoaderCircle className="spin" />
        Зареждане на продукта…
      </div>
    );
  if (!p)
    return (
      <div className="empty page-shell">
        <h1>Продуктът не е наличен.</h1>
        <Link to="/shop" className="button">
          Към каталога
        </Link>
      </div>
    );
  const option=optionFor(p,color);
  const galleryImages=imagesFor(p,color);
  const selected = imageFor(p, color);
  const img = galleryImages[gallery] || selected;
  const exact=option?.images?.some(i=>i.url===img?.url)||img?.color===option?.label;
  return (
    <div className="section-shell product-page">
      <div className="breadcrumbs">
        <Link to="/shop">Каталог</Link>
        <ChevronRight size={14} />
        <span>{p.size_label}</span>
      </div>
      <div className="product-detail">
        <div className="product-gallery">
          <div className="product-main-photo">
            <ProductImage
              priority
              sizes="(max-width: 800px) 100vw, 50vw"
              src={img?.url}
              alt={img?.alt || p.name}
              width="1000"
              height="1400"
            />
            <span className="size-badge">{p.size_label}</span>
          </div>
          <div className="thumbnail-row">
            {galleryImages.map((im, i) => (
              <button
                key={im.url + i}
                aria-label={"Снимка " + (i + 1)}
                className={gallery === i ? "selected" : ""}
                onClick={() => setGallery(i)}
              >
                <ProductImage
                  src={im.url}
                  alt=""
                  sizes="90px"
                  width="90"
                  height="90"
                />
              </button>
            ))}
          </div>
          {img?.url&&!exact && (
            <p className="photo-disclaimer">
              {img?.caption || (img?.color ? "На снимката: " + img.color + ". " : "Общ кадър на продукта. ")}
              Избран цвят: <strong>{option?.label||color}</strong>.
            </p>
          )}
        </div>
        <div className="product-info">
          <span className="eyebrow">
            {p.manufacturer || "THERRIDE"} / {p.category}
          </span>
          <h1>{p.name}</h1>
          <p className="product-tagline">{p.subtitle}</p>
          <div className="fitment-box">
            <ShieldCheck size={21} />
            <div>
              <strong>{fitmentLabel(p)}</strong>
              <p>
                {p.fitment_notes ||
                  "Провери размерите и мястото за монтаж преди поръчка."}
              </p>
              {p.model_years && <small>Години: {p.model_years}</small>}
              {p.sku && <small>Артикул: {p.sku}</small>}
            </div>
          </div>
          <div className="detail-price">
            <strong>{money(option?.price_cents||p.price_cents)}</strong>
            {p.compare_at_cents > p.price_cents && (
              <del>{money(p.compare_at_cents)}</del>
            )}
            <span>EUR</span>
          </div>
          <fieldset className="color-picker">
            <legend>
              Цвят / изпълнение: <strong>{option?.label||color}</strong>
            </legend>
            <div>
              {optionsFor(p).map(({id:c,label:variantLabel}) => (
                <button
                  type="button"
                  key={c}
                  className={"swatch " + (c === color ? "selected" : "")}
                  style={{
                    "--swatch": COLORS.find((x) => x.name === variantLabel)?.hex || "#aaa",
                  }}
                  aria-label={variantLabel}
                  aria-pressed={c === color}
                  title={variantLabel}
                  onClick={() => {
                    setColor(c);
                    setGallery(0);
                  }}
                >
                  <span />
                  <span className="variant-option-label">{variantLabel}</span>
                  {c === color && (
                    <Check
                      size={15}
                      style={{
                        color: ["Бяло", "Жълто", "Бежово", "Розово"].includes(c)
                          ? "#111"
                          : "#fff",
                      }}
                    />
                  )}
                </button>
              ))}
            </div>
          </fieldset>
          <div className="buy-row">
            <div className="quantity-control">
              <button
                aria-label="Намали количеството"
                disabled={quantity === 1}
                onClick={() => setQuantity((q) => q - 1)}
              >
                <Minus size={15} />
              </button>
              <span aria-live="polite">{quantity}</span>
              <button
                aria-label="Увеличи количеството"
                disabled={
                  quantity >= 10 ||
                  (option?.stock_quantity !== null && quantity >= option?.stock_quantity)
                }
                onClick={() => setQuantity((q) => q + 1)}
              >
                <Plus size={15} />
              </button>
            </div>
            {p.specs?.purchase_mode==='inquiry'?<Link className="button" to={'/info/contact?product='+encodeURIComponent(p.sku||p.name)}>Запитване за продукта <ArrowUpRight size={18}/></Link>:<button
              className="button"
              disabled={!optionAvailable(p,option)}
              onClick={() => add(p, color, quantity)}
            >
              {!optionAvailable(p,option) ? (option?.stock_quantity===0?"Изчерпан":"За потвърждение") : "Добави в количката"}
              <ShoppingBag size={18} />
            </button>}
          </div>
          <div className="purchase-notes">
            <span>
              <CheckCircle2 size={17} />{" "}
              {p.specs?.purchase_mode==='inquiry'?'Наличен · уточни точния вариант':optionAvailable(p,option)?'Потвърдено наличен':option?.stock_quantity===0?'Временно изчерпан':'Наличността се уточнява'}
            </span>
            <span>
              <Truck size={17} />
              {settings.free_shipping_threshold_cents != null
                ? "Безплатна доставка над " +
                  money(settings.free_shipping_threshold_cents)
                : "Доставка с куриер"}
            </span>
            <span>
              <LockKeyhole size={17} />
              {settings.stripe_enabled
                ? "Карта или наложен платеж"
                : "Наложен платеж"}
            </span>
          </div>
          <div className="product-description">
            {p.description
              .split("\n")
              .filter(Boolean)
              .map((text, i) => (
                <p key={i}>{text}</p>
              ))}
          </div>
          <details className="detail-accordion" open>
            <summary>
              Характеристики <Plus size={17} />
            </summary>
            <dl>
              <div>
                <dt>Размер / вариант</dt>
                <dd>{p.size_label}</dd>
              </div>
              <div>
                <dt>Производство</dt>
                <dd>{p.specs?.country || "Не е посочено"}</dd>
              </div>
              <div>
                <dt>Монтаж</dt>
                <dd>{p.specs?.mounting || "Виж описанието"}</dd>
              </div>
              {[
                ["material", "Материал"],
                ["dimensions", "Размери"],
                ["included", "В комплекта"],
              ]
                .filter(([k]) => p.specs?.[k])
                .map(([k, t]) => (
                  <div key={k}>
                    <dt>{t}</dt>
                    <dd>{p.specs[k]}</dd>
                  </div>
                ))}
            </dl>
          </details>
          <details className="detail-accordion">
            <summary>
              Доставка и връщане <Plus size={17} />
            </summary>
            <p>{settings.delivery_text}</p>
            <Link to="/info/delivery">Доставка →</Link>
            <Link to="/info/returns">Връщане →</Link>
          </details>
        </div>
      </div>
      <div className="related">
        <div className="section-heading">
          <h2>
            Още от каталога.
            <br />
            <span className="muted">Детайлите правят разликата.</span>
          </h2>
          <Link className="text-link" to="/shop">
            Всички продукти <ArrowUpRight size={18} />
          </Link>
        </div>
        <div className="product-grid">
          {products
            .filter((x) => x.id !== p.id)
            .slice(0, 3)
            .map((x) => (
              <ProductCard key={x.id} product={x} />
            ))}
        </div>
      </div>
    </div>
  );
}
export function CartLines({ cart, products, update }) {
  return (
    <div className="cart-lines">
      {cart.map((line, i) => {
        const p = products.find((x) => x.id === line.product_id);
        if (!p)
          return (
            <div className="cart-line" key={i}>
              <p>Този продукт вече не е наличен.</p>
              <button className="text-link" onClick={() => update(line, 0)}>
                Премахни
              </button>
            </div>
          );
        const img = imageFor(p, line.variant_id||line.color);
        return (
          <article className="cart-line" key={line.product_id + line.color}>
            <ProductImage
              src={img.url}
              alt={p.name}
              sizes="90px"
              width="90"
              height="120"
            />
            <div>
              <Link to={"/product/" + p.slug}>{p.name}</Link>
              <span className="line-color">
                <i
                  style={{
                    background: COLORS.find((c) => c.name === line.color)?.hex,
                  }}
                />
                {line.color}
              </span>
              {img.color && img.color !== line.color && (
                <small className="muted">Илюстративна снимка</small>
              )}
              <div className="quantity-control small">
                <button
                  aria-label={"Намали " + p.name}
                  onClick={() => update(line, line.quantity - 1)}
                >
                  <Minus size={13} />
                </button>
                <span>{line.quantity}</span>
                <button
                  aria-label={"Увеличи " + p.name}
                  disabled={line.quantity >= 10}
                  onClick={() => update(line, line.quantity + 1)}
                >
                  <Plus size={13} />
                </button>
              </div>
            </div>
            <div className="line-end">
              <strong>{money(linePrice(p,line) * line.quantity)}</strong>
              <button
                className="icon-button"
                aria-label={"Премахни " + p.name + " " + line.color}
                onClick={() => update(line, 0)}
              >
                <Trash2 size={16} />
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}
export function CostSummary({ amount }) {
  return (
    <dl className="cost-summary">
      <div>
        <dt>Продукти</dt>
        <dd>{money(amount.subtotal)}</dd>
      </div>
      {amount.discount > 0 && (
        <div className="savings">
          <dt>Отстъпка {amount.percent}%</dt>
          <dd>−{money(amount.discount)}</dd>
        </div>
      )}
      <div>
        <dt>Доставка</dt>
        <dd>
          {amount.shipping === null
            ? "По тарифа на куриера"
            : amount.shipping === 0
              ? "Безплатна"
              : money(amount.shipping)}
        </dd>
      </div>
      <div className="cost-total">
        <dt>{amount.shipping === null ? "Общо без доставка" : "Общо"}</dt>
        <dd>{money(amount.total)}</dd>
      </div>
    </dl>
  );
}
function CartDrawer({ cart, products, settings, update, close }) {
  const amount = totals(cart, products, settings);
  return (
    <div
      className="drawer-shade"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <section
        className="cart-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Твоята количка"
      >
        <div className="drawer-header">
          <h2>
            Твоята количка <span>{amount.count}</span>
          </h2>
          <button
            className="icon-button"
            aria-label="Затвори количката"
            onClick={close}
          >
            <X />
          </button>
        </div>
        {!cart.length ? (
          <div className="empty">
            <ShoppingBag size={40} />
            <h3>Следващият ти ъпгрейд е тук.</h3>
            <p>Избери своя детайл от каталога. Следващият маршрут те чака.</p>
            <Link to="/shop" onClick={close} className="button">
              Към продуктите <ArrowRight size={18} />
            </Link>
          </div>
        ) : (
          <>
            <CartLines cart={cart} products={products} update={update} />
            <div className="drawer-bottom">
              {settings.free_shipping_threshold_cents != null && (
                <div className="shipping-progress">
                  <p>
                    {amount.free
                      ? "Достигна безплатна доставка."
                      : "Още " +
                        money(
                          Math.max(
                            0,
                            settings.free_shipping_threshold_cents - amount.net,
                          ),
                        ) +
                        " до безплатна доставка."}
                  </p>
                  <div>
                    <span
                      style={{
                        width:
                          Math.min(
                            100,
                            (amount.net /
                              settings.free_shipping_threshold_cents) *
                              100,
                          ) + "%",
                      }}
                    />
                  </div>
                </div>
              )}
              <CostSummary amount={amount} />
              <Link to="/checkout" className="button" onClick={close}>
                Към поръчка <ArrowRight size={18} />
              </Link>
              <span className="secure-note">
                <LockKeyhole size={14} /> Данните ти са защитени при изпращане.
              </span>
            </div>
          </>
        )}
      </section>
      <DrawerFocus close={close} />
    </div>
  );
}
function DrawerFocus({ close }) {
  useEffect(() => {
    const prev = document.activeElement;
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const panel = document.querySelector(".cart-drawer");
    const items = () =>
      [...panel.querySelectorAll("a,button,input")].filter(
        (x) => !x.disabled && x.getClientRects().length,
      );
    items()[0]?.focus();
    const onKey = (e) => {
      if (e.key === "Escape") close();
      if (e.key === "Tab") {
        const a = items();
        if (e.shiftKey && document.activeElement === a[0]) {
          e.preventDefault();
          a.at(-1)?.focus();
        } else if (!e.shiftKey && document.activeElement === a.at(-1)) {
          e.preventDefault();
          a[0]?.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = old;
      document.removeEventListener("keydown", onKey);
      prev?.focus?.();
    };
  }, []);
  return null;
}
function Info({ type, settings: s }) {
  const data = {
    delivery: {
      title: "Доставка",
      text:
        s.delivery_text +
        "\n\nКуриери: Еконт и Спиди. При доставка до офис посочи точното име и адрес на офиса.\n\n" +
        (s.shipping_fee_cents === null
          ? "Доставката се заплаща по тарифата на избрания куриер."
          : "Цена за доставка: " + money(s.shipping_fee_cents || 0) + ".") +
        (s.free_shipping_threshold_cents != null
          ? " Безплатна доставка за поръчки над " +
            money(s.free_shipping_threshold_cents) +
            " след отстъпките."
          : ""),
    },
    returns: {
      title: "Връщане и рекламации",
      text:
        s.returns_text ||
        "Свържи се с нас за въпроси относно връщане или рекламация. Посочи номера на поръчката и опиши случая.\n\nПълните условия за връщане ще бъдат добавени преди активиране на онлайн поръчките.",
    },
    privacy: {
      title: "Поверителност",
      text:
        s.privacy_text ||
        "За изпълнение на поръчката обработваме въведените от теб име, телефон, адрес и имейл, когато е предоставен. Данните са достъпни само за администратор на магазина.\n\nИзползваме локално съхранение в браузъра за количката. Входът на администратора използва сесия за удостоверяване. Не сме включили рекламни пиксели или проследяване.\n\nПълните данни за администратора на лични данни и условията за обработка се попълват преди активиране на поръчките.",
    },
    terms: {
      title: "Общи условия",
      text:
        s.terms_text ||
        "Онлайн поръчките са в подготовка. Пълните данни за търговеца и условията за покупка се добавят преди активирането им. За информация се свържи с нас.",
    },
    about: {
      title: "Карането е лично.",
      text: "Therride започна от един малък детайл: място за напитката по време на каране. Проектирахме свои държачи и ги произведохме в България.\n\nДнес посоката е по-голяма: части и аксесоари за Sur-Ron. Същата идея остава — да направиш мотора свой, с детайли, които разбираш и избираш съзнателно.\n\nИзбираме ясните описания, точната съвместимост и честната информация за наличности. Когато нещо трябва да се провери, ще го кажем.\n\nTherride е независим магазин. Sur-Ron е марка на съответния притежател; имената на моделите служат за обозначаване на съвместимост.",
    },
    contact: {
      title: "Да поговорим за карането.",
      text: "Търсиш част за Sur-Ron? Изпрати ни модела, годината и снимка на частта. Ще проверим съвместимостта, наличността и условията за доставка.",
    },
  }[type];
  useEffect(() => {
    document.title = (data?.title || "Информация") + " — THERRIDE";
  }, [type]);
  if (!data)
    return (
      <div className="empty page-shell">
        <h1>Страницата не е намерена.</h1>
      </div>
    );
  return (
    <section className="section-shell info-page">
      <span className="eyebrow">THERRIDE / ИНФОРМАЦИЯ</span>
      <h1>{data.title}</h1>
      <div className="info-copy">
        {data.text
          .split("\n")
          .filter(Boolean)
          .map((t, i) => (
            <p key={i}>{t}</p>
          ))}
      </div>
      {type === "returns" && s.return_address && (
        <p>
          <strong>Адрес за връщане:</strong> {s.return_address}
        </p>
      )}
      <div className="contact-cards">
        <a href={"mailto:" + s.contact_email+(new URLSearchParams(location.search).get('product')?'?subject='+encodeURIComponent('Запитване за '+new URLSearchParams(location.search).get('product')):'')}>
          <Mail />
          <span>
            Пиши ни<strong>{s.contact_email}</strong>
          </span>
          <ArrowUpRight />
        </a>
        {s.contact_phone && (
          <a href={"tel:" + s.contact_phone}>
            <span>
              Обади се<strong>{s.contact_phone}</strong>
            </span>
            <ArrowUpRight />
          </a>
        )}
        <a href={s.instagram_url} target="_blank" rel="noopener noreferrer">
          <Instagram />
          <span>
            Последвай карането<strong>@_therride_</strong>
          </span>
          <ArrowUpRight />
        </a>
      </div>
      {s.business_name && (
        <div className="business-data">
          <strong>{s.business_name}</strong>
          <p>{s.business_address}</p>
          {s.business_registration && <p>ЕИК: {s.business_registration}</p>}
        </div>
      )}
    </section>
  );
}
function Footer({ settings: s }) {
  return (
    <footer className="site-footer">
      <div className="footer-grid">
        <div className="footer-brand">
          <img
            src="/images/logo.webp"
            alt="THERRIDE"
            width="105"
            height="105"
            loading="lazy"
          />
          <p>
            Твоят Sur-Ron.
            <br />
            Твоите правила.
          </p>
          <a
            href={s.instagram_url}
            aria-label="THERRIDE в Instagram"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Instagram size={20} />
          </a>
        </div>
        <div>
          <h3>Към следващото каране</h3>
          <Link to="/shop">Каталог</Link>
          <Link to="/#models">Твоят модел</Link>
          <Link to="/#fitment">Помощ при избора</Link>
        </div>
        <div>
          <h3>Полезно</h3>
          <Link to="/info/delivery">Доставка</Link>
          <Link to="/info/returns">Връщане и рекламации</Link>
          <Link to="/info/contact">Контакти</Link>
        </div>
        <div>
          <h3>Имаш въпрос?</h3>
          <a href={"mailto:" + s.contact_email}>
            {s.contact_email} <ArrowUpRight size={14} />
          </a>
          <p>
            Части, аксесоари и внимание
            <br />
            към следващото каране.
          </p>
        </div>
      </div>
      <div className="footer-bottom">
        <span>
          © {new Date().getFullYear()} THERRIDE. Независим магазин за части и
          аксесоари.
        </span>
        <div>
          <Link to="/info/privacy">Поверителност</Link>
          <Link to="/info/terms">Общи условия</Link>
          <Link to="/admin">
            Администрация <LockKeyhole size={12} />
          </Link>
        </div>
        <span className="made-in">
          BG <span className="status-dot" />
        </span>
      </div>
    </footer>
  );
}
export default App;
