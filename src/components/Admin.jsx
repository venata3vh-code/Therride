import VariantEditor from './VariantEditor.jsx';
import { CATEGORIES, MODELS } from "../lib/catalog.js";
import React, { useState, useEffect, useRef } from "react";
import {
  LayoutDashboard,
  Package,
  ClipboardList,
  Settings,
  LogOut,
  ArrowUpRight,
  Plus,
  Search,
  Pencil,
  Trash2,
  Save,
  X,
  Upload,
  ImagePlus,
  LoaderCircle,
  CheckCircle2,
  ChevronRight,
  ArrowLeft,
  Eye,
  Copy,
  LockKeyhole,
  ShieldCheck,
  Menu,
  ExternalLink,
} from "lucide-react";
import { Link, go, Modal } from "../App.jsx";
import { supabase, adminAccess, uploadImage } from "../lib/supabase.js";
import { COLORS, money, readableError } from "../lib/commerce.js";
const statuses = {
  new: "Нова",
  confirmed: "Потвърдена",
  shipped: "Изпратена",
  completed: "Завършена",
  cancelled: "Анулирана",
};
const newProduct = () => ({
  name: "",
  slug: "",
  subtitle: "",
  description: "",
  price_cents: 1540,
  compare_at_cents: null,
  size_label: "",
  category: "Аксесоари",
  sku: "",
  manufacturer: "",
  fitment_type: "unspecified",
  compatible_models: [],
  model_years: "",
  fitment_notes: "",
  seo_title: "",
  seo_description: "",
  colors: ["Черно"],
  images: [],
  specs: {
    country: "",
    mounting: "",
    material: "",
    dimensions: "",
    included: "",
  },
  stock_quantity: null,
  is_active: false,
  featured: false,
  sort_order: 0,
});
const translit = (s) => {
  const bg = {
    а: "a",
    б: "b",
    в: "v",
    г: "g",
    д: "d",
    е: "e",
    ж: "zh",
    з: "z",
    и: "i",
    й: "y",
    к: "k",
    л: "l",
    м: "m",
    н: "n",
    о: "o",
    п: "p",
    р: "r",
    с: "s",
    т: "t",
    у: "u",
    ф: "f",
    х: "h",
    ц: "ts",
    ч: "ch",
    ш: "sh",
    щ: "sht",
    ъ: "a",
    ь: "",
    ю: "yu",
    я: "ya",
  };
  return [...s.toLowerCase()]
    .map((c) => bg[c] ?? c)
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120);
};
export default function Admin({ flash, toast, refreshStore }) {
  const [session, setSession] = useState(undefined),
    [user, setUser] = useState(null),
    [checking, setChecking] = useState(true),
    [tab, setTab] = useState("dashboard"),
    [products, setProducts] = useState([]),
    [orders, setOrders] = useState([]),
    [settings, setSettings] = useState(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false),
    [edit, setEdit] = useState(null),
    [order, setOrder] = useState(null),
    [deleteProduct, setDeleteProduct] = useState(null),
    [sidebar, setSidebar] = useState(false),
    [recovery, setRecovery] = useState(false);
  useEffect(() => {
    document.title = "Администрация — THERRIDE";
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (alive) setSession(data.session);
    });
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
      setSession(s);
    });
    return () => {
      alive = false;
      data.subscription.unsubscribe();
    };
  }, []);
  useEffect(() => {
    let live = true;
    if (session === undefined) return;
    setChecking(true);
    if (!session) {
      setUser(null);
      setChecking(false);
      return;
    }
    adminAccess()
      .then((u) => {
        if (live) {
          setUser(u);
          setChecking(false);
          if (!u)
            setError(
              "Този акаунт няма администраторски достъп. Достъпът се задава изрично от собственика.",
            );
        }
      })
      .catch((e) => {
        if (live) {
          setError(readableError(e));
          setChecking(false);
        }
      });
    return () => {
      live = false;
    };
  }, [session]);
  const reload = async () => {
    setLoading(true);
    setError("");
    try {
      const [p, o, s] = await Promise.all([
        supabase.from("products").select("*").order("sort_order"),
        supabase
          .from("orders")
          .select("*,order_items(*)")
          .order("created_at", { ascending: false })
          .limit(200),
        supabase.from("store_settings").select("*").eq("id", 1).single(),
      ]);
      if (p.error) throw p.error;
      if (o.error) throw o.error;
      if (s.error) throw s.error;
      setProducts(p.data);
      setOrders(o.data);
      setSettings(s.data);
    } catch (e) {
      setError(readableError(e));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    if (user) reload();
  }, [user?.id]);
  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setOrders([]);
    setProducts([]);
    setError("");
  };
  const saveProduct = async (p) => {
    const { id, created_at, updated_at, ...fields } = p;
    const { error } = id
      ? await supabase.from("products").update(fields).eq("id", id)
      : await supabase.from("products").insert(fields);
    if (error) throw error;
    setEdit(null);
    flash("Продуктът е запазен.");
    await reload();
    refreshStore();
  };
  const removeProduct = async () => {
    if (!deleteProduct) return;
    const { error } = await supabase
      .from("products")
      .delete()
      .eq("id", deleteProduct.id);
    if (error) {
      flash(readableError(error));
      return;
    }
    setDeleteProduct(null);
    flash("Продуктът е изтрит.");
    reload();
    refreshStore();
  };
  const toggle = async (p) => {
    const { error } = await supabase
      .from("products")
      .update({ is_active: !p.is_active })
      .eq("id", p.id);
    if (error) {
      flash(readableError(error));
      return;
    }
    reload();
    refreshStore();
  };
  if (checking)
    return (
      <div className="page-loading">
        <LoaderCircle className="spin" />
        Проверка на достъпа…
      </div>
    );
  if (recovery && session)
    return (
      <AuthPage
        recovery
        done={() => {
          setRecovery(false);
          logout();
        }}
      />
    );
  if (!user)
    return <AuthPage error={error} hasSession={!!session} signOut={logout} />;
  return (
    <div className="admin-shell">
      <aside className={"admin-sidebar " + (sidebar ? "sidebar-open" : "")}>
        <Link to="/" className="admin-brand">
          <img src="/images/logo.webp" width="66" height="66" alt="THERRIDE" />
          <div>
            THERRIDE<span>УПРАВЛЕНИЕ НА МАГАЗИНА</span>
          </div>
        </Link>
        <div className="admin-store-label">
          <span className="status-dot" /> ТВОЯТ МАГАЗИН
        </div>
        <nav aria-label="Администраторско меню">
          {[
            ["dashboard", LayoutDashboard, "Общ преглед"],
            ["products", Package, "Продукти"],
            ["orders", ClipboardList, "Поръчки"],
            ["settings", Settings, "Настройки"],
          ].map(([key, Icon, text]) => (
            <button
              key={key}
              className={tab === key ? "selected" : ""}
              onClick={() => {
                setTab(key);
                setSidebar(false);
                setEdit(null);
                setOrder(null);
              }}
            >
              <Icon size={19} />
              {text}
              {key === "orders" &&
                orders.filter((o) => o.status === "new").length > 0 && (
                  <span className="nav-badge">
                    {orders.filter((o) => o.status === "new").length}
                  </span>
                )}
            </button>
          ))}
        </nav>
        <div className="admin-sidebar-bottom">
          <Link to="/" className="sidebar-store-link">
            Отвори магазина <ArrowUpRight size={17} />
          </Link>
          <Link to="/shop?preview=1" className="sidebar-store-link">Преглед на черновите <Eye size={17}/></Link>
          <div className="admin-account">
            <div className="account-avatar">
              {user.email?.[0]?.toUpperCase()}
            </div>
            <div>
              <strong>Администратор</strong>
              <small>{user.email}</small>
            </div>
            <button
              className="icon-button"
              aria-label="Изход от профила"
              onClick={logout}
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>
      {sidebar && (
        <div className="sidebar-backdrop" onClick={() => setSidebar(false)} />
      )}
      <div className="admin-main">
        <header className="admin-header">
          <div>
            <button
              className="icon-button admin-mobile-menu"
              aria-label="Меню"
              onClick={() => setSidebar((s) => !s)}
            >
              <Menu />
            </button>
            <span>
              Магазин <ChevronRight size={14} />{" "}
              {edit
                ? "Редактиране"
                : {
                    dashboard: "Общ преглед",
                    products: "Продукти",
                    orders: "Поръчки",
                    settings: "Настройки",
                  }[tab]}
            </span>
          </div>
          <span className="admin-status">
            <ShieldCheck size={15} /> Защитен достъп
          </span>
        </header>
        <main className="admin-content">
          {error && (
            <div className="form-error" role="alert">
              {error}{" "}
              <button className="text-link" onClick={reload}>
                Опитай отново
              </button>
            </div>
          )}
          {loading && !settings ? (
            <div className="page-loading">
              <LoaderCircle className="spin" />
            </div>
          ) : edit ? (
            <ProductEditor
              key={edit.id || "new"}
              initial={edit}
              save={saveProduct}
              cancel={() => setEdit(null)}
              flash={flash}
            />
          ) : tab === "dashboard" ? (
            <Dashboard
              products={products}
              orders={orders}
              settings={settings}
              editProduct={setEdit}
              openOrders={() => setTab("orders")}
              openOrder={setOrder}
              openSettings={() => setTab("settings")}
            />
          ) : tab === "products" ? (
            <Products
              products={products}
              create={() => setEdit(newProduct())}
              edit={setEdit}
              toggle={toggle}
              remove={setDeleteProduct}
            />
          ) : tab === "orders" ? (
            <Orders orders={orders} select={setOrder} />
          ) : (
            settings && (
              <StoreSettings
                initial={settings}
                save={async (fields) => {
                  const { error } = await supabase
                    .from("store_settings")
                    .update(fields)
                    .eq("id", 1);
                  if (error) throw error;
                  flash("Настройките са запазени.");
                  reload();
                  refreshStore();
                }}
              />
            )
          )}
        </main>
      </div>
      {order && (
        <OrderModal
          order={orders.find((x) => x.id === order.id) || order}
          close={() => setOrder(null)}
          update={async (status, note) => {
            const { error } = await supabase
              .from("orders")
              .update({ status, admin_note: note })
              .eq("id", order.id);
            if (error) throw error;
            flash("Поръчката е обновена.");
            await reload();
          }}
        />
      )}
      {deleteProduct && (
        <Modal
          label="Изтриване на продукт"
          close={() => setDeleteProduct(null)}
        >
          <div className="confirm-dialog">
            <Trash2 size={35} />
            <h2>Изтриване на продукта?</h2>
            <p>
              „{deleteProduct.name}“ ще бъде премахнат от каталога. Можеш да го
              скриеш вместо да го изтриваш.
            </p>
            <div className="button-row">
              <button
                className="button button-light"
                onClick={() => setDeleteProduct(null)}
              >
                Отказ
              </button>
              <button className="button button-danger" onClick={removeProduct}>
                Изтрий продукта
              </button>
            </div>
          </div>
        </Modal>
      )}
      {toast && (
        <div role="status" className="toast">
          <CheckCircle2 size={18} />
          {toast}
        </div>
      )}
    </div>
  );
}
function AuthPage({ error: parentError, hasSession, signOut, recovery, done }) {
  const [mode, setMode] = useState(recovery ? "recovery" : "login"),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const handle = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setBusy(true);
    try {
      let result;
      if (mode === "signup") {
        result = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: location.origin + "/admin" },
        });
        if (!result.error)
          setMessage(
            "Потвърди имейла си от полученото писмо, после отвори отново панела. Акаунтът получава достъп само след изрично разрешение.",
          );
      } else if (mode === "reset") {
        result = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: location.origin + "/admin",
        });
        if (!result.error)
          setMessage(
            "Ако има акаунт с този имейл, ще получиш връзка за възстановяване.",
          );
      } else if (mode === "recovery") {
        result = await supabase.auth.updateUser({ password });
        if (!result.error) {
          setMessage("Паролата е обновена. Влез отново.");
          done?.();
        }
      } else
        result = await supabase.auth.signInWithPassword({ email, password });
      if (result?.error) throw result.error;
    } catch (e) {
      setError(readableError(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="auth-page">
      <div className="auth-brand">
        <Link to="/">
          <img
            src="/images/logo.webp"
            alt="THERRIDE"
            width="100"
            height="100"
          />
        </Link>
        <span>ТВОЯТ БРАНД. ТВОЕТО УПРАВЛЕНИЕ.</span>
        <h1>
          Всичко за
          <br />
          следващото
          <br />
          <em>каране.</em>
        </h1>
        <p>
          Продукти, снимки и поръчки.
          <br />
          На едно място.
        </p>
        <img
          className="auth-rider"
          src="/images/IMG_0205.jpg"
          alt="THERRIDE държачи в употреба"
        />
      </div>
      <div className="auth-form-wrap">
        <Link to="/" className="text-link back-to-store">
          <ArrowLeft size={15} />
          Обратно към магазина
        </Link>
        <form className="auth-form" onSubmit={handle}>
          <span className="eyebrow">
            <LockKeyhole size={14} /> АДМИНИСТРАТОРСКИ ДОСТЪП
          </span>
          <h2>
            {mode === "signup"
              ? "Създай своя акаунт."
              : mode === "reset"
                ? "Възстанови достъпа."
                : mode === "recovery"
                  ? "Нова парола."
                  : "Добре дошъл отново."}
          </h2>
          <p>Управлявай своя THERRIDE магазин.</p>
          {hasSession ? (
            <>
              <div className="form-error">
                {parentError || "Този акаунт няма администраторски права."}
              </div>
              <button type="button" className="button" onClick={signOut}>
                Влез с друг акаунт <LogOut size={17} />
              </button>
            </>
          ) : (
            <>
              {mode !== "recovery" && (
                <label>
                  Имейл
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Твоят администраторски имейл"
                  />
                </label>
              )}
              {mode !== "reset" && (
                <label>
                  Парола
                  <input
                    type="password"
                    required
                    minLength={mode === "login" ? 1 : 12}
                    maxLength={120}
                    autoComplete={
                      mode === "signup" || mode === "recovery"
                        ? "new-password"
                        : "current-password"
                    }
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={
                      mode === "signup" || mode === "recovery"
                        ? "Поне 12 знака"
                        : "Въведи парола"
                    }
                  />
                </label>
              )}
              {(error || parentError) && (
                <div className="form-error" role="alert">
                  {error || parentError}
                </div>
              )}
              {message && (
                <div className="form-success" role="status">
                  {message}
                </div>
              )}
              <button className="button" disabled={busy}>
                {busy ? (
                  <LoaderCircle className="spin" size={19} />
                ) : mode === "signup" ? (
                  "Създай акаунт"
                ) : mode === "reset" ? (
                  "Изпрати връзка"
                ) : mode === "recovery" ? (
                  "Запази паролата"
                ) : (
                  "Влез в панела"
                )}{" "}
                {!busy && <ArrowUpRight size={19} />}
              </button>
              {mode === "login" ? (
                <div className="auth-links">
                  <button
                    type="button"
                    onClick={() => {
                      setMode("reset");
                      setError("");
                    }}
                  >
                    Забравена парола?
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMode("signup");
                      setError("");
                    }}
                  >
                    Първи вход
                  </button>
                </div>
              ) : (
                mode !== "recovery" && (
                  <button
                    className="text-link"
                    type="button"
                    onClick={() => {
                      setMode("login");
                      setError("");
                      setMessage("");
                    }}
                  >
                    Обратно към входа
                  </button>
                )
              )}
              <p className="auth-note">
                Само изрично разрешени и потвърдени акаунти получават достъп до
                продуктите и поръчките.
              </p>
            </>
          )}
        </form>
        <span className="auth-footer">THERRIDE / ПРОИЗВЕДЕНО В БЪЛГАРИЯ</span>
      </div>
    </div>
  );
}
function Dashboard({
  products,
  orders,
  settings,
  editProduct,
  openOrders,
  openOrder,
  openSettings,
}) {
  const value = orders
    .filter((o) => o.status !== "cancelled")
    .reduce((s, o) => s + o.total_cents, 0);
  return (
    <>
      <div className="admin-page-heading">
        <div>
          <span className="eyebrow">ТВОЯТ МАГАЗИН, НАКРАТКО</span>
          <h1>Да подготвим следващото каране.</h1>
          <p>Ето какво се случва с THERRIDE.</p>
        </div>
        <button
          className="button button-small"
          onClick={() => editProduct(newProduct())}
        >
          <Plus size={17} />
          Нов продукт
        </button>
      </div>
      <div className="stat-grid">
        {[
          [
            Package,
            "Активни продукти",
            products.filter((p) => p.is_active).length,
            "от " + products.length + " общо",
          ],
          [
            ClipboardList,
            "Нови поръчки",
            orders.filter((o) => o.status === "new").length,
            "очакват обработка",
          ],
          [CheckCircle2, "Всички поръчки", orders.length, "до 200 последни"],
          [
            ArrowUpRight,
            "Стойност на поръчките",
            money(value),
            "без анулираните",
          ],
        ].map(([Icon, label, val, note]) => (
          <div className="stat-card" key={label}>
            <span>
              <Icon size={18} />
              {label}
            </span>
            <strong>{val}</strong>
            <small>{note}</small>
          </div>
        ))}
      </div>
      {settings && !settings.checkout_enabled && (
        <div className="setup-banner">
          <div>
            <span className="setup-icon">
              <Settings size={24} />
            </span>
            <div>
              <h3>Подготви магазина за първата поръчка.</h3>
              <p>
                Попълни фирмените данни, доставката и условията, след което
                активирай поръчките.
              </p>
            </div>
          </div>
          <button
            className="button button-light button-small"
            onClick={openSettings}
          >
            Настройки <ArrowUpRight size={16} />
          </button>
        </div>
      )}
      <div className="admin-panel">
        <div className="panel-heading">
          <h2>Последни поръчки</h2>
          <button className="text-link" onClick={openOrders}>
            Всички поръчки <ArrowUpRight size={16} />
          </button>
        </div>
        {orders.length ? (
          <OrderTable orders={orders.slice(0, 5)} select={openOrder} />
        ) : (
          <div className="admin-empty">
            <ClipboardList size={38} />
            <h3>Първата поръчка тепърва идва.</h3>
            <p>Тук ще виждаш новите поръчки и техния статус.</p>
          </div>
        )}
      </div>
      <div className="admin-panel">
        <div className="panel-heading">
          <h2>Твоите продукти</h2>
          <span>{products.length} продукта</span>
        </div>
        <div className="dashboard-products">
          {products.slice(0, 4).map((p) => (
            <button key={p.id} onClick={() => editProduct(p)}>
              <img src={p.images?.[0]?.url} alt="" width="70" height="85" />
              <div>
                <strong>{p.name}</strong>
                <span>{money(p.price_cents)}</span>
              </div>
              <Pencil size={16} />
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
function Products({ products, create, edit, toggle, remove }) {
  const [query, setQuery] = useState(""),
    [filter, setFilter] = useState("all");
  const shown = products.filter(
    (p) =>
      (filter === "all" ||
        (filter === "active" ? p.is_active : !p.is_active)) &&
      (p.name + " " + p.slug).toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <>
      <div className="admin-page-heading">
        <div>
          <h1>Продукти</h1>
          <p>Твоят каталог. Твоите правила.</p>
        </div>
        <button className="button button-small" onClick={create}>
          <Plus size={18} />
          Добави продукт
        </button>
      </div>
      <div className="admin-panel">
        <div className="admin-toolbar">
          <div className="filter-tabs">
            {[
              ["all", "Всички"],
              ["active", "Активни"],
              ["draft", "Скрити"],
            ].map(([v, n]) => (
              <button
                className={filter === v ? "selected" : ""}
                key={v}
                onClick={() => setFilter(v)}
              >
                {n}
              </button>
            ))}
          </div>
          <div className="shop-search">
            <Search size={17} />
            <input
              aria-label="Търсене в продуктите"
              placeholder="Търси продукт…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>
        <div className="table-scroll">
          <table className="admin-table products-table">
            <thead>
              <tr>
                <th>Продукт</th>
                <th>Статус</th>
                <th>Цена</th>
                <th>Наличност</th>
                <th>Цветове</th>
                <th>
                  <span className="sr-only">Действия</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {shown.map((p) => (
                <tr key={p.id}>
                  <td>
                    <button className="table-product" onClick={() => edit(p)}>
                      {p.images?.[0]?.url ? (
                        <img
                          src={p.images[0].url}
                          alt=""
                          width="54"
                          height="65"
                        />
                      ) : (
                        <span className="image-placeholder">
                          <ImagePlus />
                        </span>
                      )}
                      <span>
                        <strong>{p.name}</strong>
                        <small>{p.size_label || p.category}</small>
                      </span>
                    </button>
                  </td>
                  <td>
                    <button
                      className={
                        "badge " + (p.is_active ? "badge-green" : "badge-gray")
                      }
                      onClick={() => toggle(p)}
                      title="Промени видимостта"
                    >
                      {p.is_active ? "Активен" : "Скрит"}
                    </button>
                  </td>
                  <td>
                    <strong>{money(p.price_cents)}</strong>
                  </td>
                  <td>
                    {p.stock_quantity === null
                      ? "Без ограничение"
                      : p.stock_quantity + " бр."}
                  </td>
                  <td>{p.colors.length} цвята</td>
                  <td>
                    <div className="table-actions">
                      <button
                        className="icon-button"
                        aria-label={"Редактирай " + p.name}
                        onClick={() => edit(p)}
                      >
                        <Pencil size={17} />
                      </button>
                      <button
                        className="icon-button danger-text"
                        aria-label={"Изтрий " + p.name}
                        onClick={() => remove(p)}
                      >
                        <Trash2 size={17} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!shown.length && (
            <div className="admin-empty">
              <Package size={35} />
              <h3>Няма намерени продукти.</h3>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
function ProductEditor({ initial, save, cancel, flash }) {
  const [p, setP] = useState(() => structuredClone(initial)),
    [price, setPrice] = useState((initial.price_cents / 100).toFixed(2)),
    [compare, setCompare] = useState(
      initial.compare_at_cents ? String(initial.compare_at_cents / 100) : "",
    ),
    [busy, setBusy] = useState(false),
    [uploading, setUploading] = useState(false),
    [error, setError] = useState(""),
    [url, setUrl] = useState("");
  const input = useRef();
  const set = (k, v) => setP((p) => ({ ...p, [k]: v }));
  const spec = (k, v) => setP((p) => ({ ...p, specs: { ...p.specs, [k]: v } }));
  const saveForm = async (e) => {
    e.preventDefault();
    setError("");
    if (p.fitment_type === "specific" && !p.compatible_models?.length) {
      setError("Избери поне един потвърден модел.");
      return;
    }
    if(p.is_active&&p.inventory_confirmed===false){setError('Потвърди наличностите преди публикуване.');return;}
    if(p.variants?.some(v=>!v.label?.trim()||!Number.isInteger(v.price_cents)||v.price_cents<=0)){setError('Провери имената и цените на вариантите.');return;}
    if (!p.colors.length) {
      setError("Избери поне един цвят.");
      return;
    }
    if (p.is_active && !p.images.length) {
      setError("Добави поне една снимка за активен продукт.");
      return;
    }
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(p.slug)) {
      setError("Адресът трябва да съдържа латински букви, цифри и тирета.");
      return;
    }
    const cents = Math.round(Number(price.replace(",", ".")) * 100),
      compareCents = compare
        ? Math.round(Number(compare.replace(",", ".")) * 100)
        : null;
    if (!Number.isFinite(cents) || cents < 1 || cents > 10000000) {
      setError("Въведи валидна цена.");
      return;
    }
    if (compareCents !== null && compareCents <= cents) {
      setError("Старата цена трябва да е по-висока от текущата.");
      return;
    }
    setBusy(true);
    try {
      await save({ ...p, colors:p.variants?.length?p.variants.map(v=>v.label):p.colors,price_cents:p.variants?.length?Math.min(...p.variants.map(v=>v.price_cents)):cents, compare_at_cents: compareCents });
    } catch (e) {
      setError(readableError(e));
    } finally {
      setBusy(false);
    }
  };
  const upload = async (files) => {
    setError("");
    if (!files?.length) return;
    if (p.images.length + files.length > 20) {
      setError("До 20 снимки за продукт.");
      return;
    }
    setUploading(true);
    try {
      for (const file of files) {
        const image = await uploadImage(file);
        setP((p) => ({
          ...p,
          images: [...p.images, { ...image, alt: p.name }],
        }));
      }
    } catch (e) {
      setError(readableError(e));
    } finally {
      setUploading(false);
      if (input.current) input.current.value = "";
    }
  };
  const imageChange = (i, key, value) =>
    setP((p) => ({
      ...p,
      images: p.images.map((im, idx) =>
        idx === i ? { ...im, [key]: value } : im,
      ),
    }));
  const addUrl = () => {
    try {
      const u = new URL(url);
      if (u.protocol !== "https:") throw new Error();
      setP((p) => ({
        ...p,
        images: [...p.images, { url: u.href, alt: p.name, color: "" }],
      }));
      setUrl("");
    } catch {
      setError("Въведи пълен HTTPS адрес на изображение.");
    }
  };
  return (
    <form onSubmit={saveForm}>
      <div className="admin-page-heading">
        <div>
          <button type="button" className="text-link" onClick={cancel}>
            <ArrowLeft size={16} />
            Продукти
          </button>
          <h1>{p.id ? "Редактирай продукт" : "Нов продукт"}</h1>
        </div>
        <div className="button-row">
          <button
            type="button"
            className="button button-light button-small"
            onClick={cancel}
          >
            Отказ
          </button>
          <button className="button button-small" disabled={busy || uploading}>
            {busy ? (
              <LoaderCircle size={17} className="spin" />
            ) : (
              <Save size={17} />
            )}
            Запази продукта
          </button>
        </div>
      </div>
      {error && (
        <div className="form-error" role="alert">
          {error}
        </div>
      )}
      <div className="editor-layout">
        <div>
          <section className="admin-panel form-panel">
            <h2>Основна информация</h2>
            <label>
              Име на продукта
              <input
                required
                maxLength={160}
                value={p.name}
                onChange={(e) =>
                  setP((p) => ({
                    ...p,
                    name: e.target.value,
                    slug: initial.id ? p.slug : translit(e.target.value),
                  }))
                }
              />
            </label>
            <label>
              Кратко подзаглавие
              <input
                maxLength={180}
                value={p.subtitle}
                onChange={(e) => set("subtitle", e.target.value)}
              />
            </label>
            <label>
              Описание
              <textarea
                rows={9}
                maxLength={12000}
                value={p.description}
                onChange={(e) => set("description", e.target.value)}
                placeholder="Разкажи за продукта. Всеки нов ред се показва като отделен абзац."
              />
            </label>
            <div className="form-grid">
              <label>
                Адрес на продукта
                <input
                  required
                  maxLength={120}
                  value={p.slug}
                  onChange={(e) => set("slug", e.target.value)}
                />
                <small>/product/{p.slug}</small>
              </label>
              <label>
                Категория
                <select
                  value={p.category}
                  onChange={(e) => set("category", e.target.value)}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </section>
          <section className="admin-panel form-panel">
            <div className="panel-heading">
              <h2>Снимки</h2>
              <span>{p.images.length} / 20</span>
            </div>
            <button
              type="button"
              className="upload-zone"
              disabled={uploading}
              onClick={() => input.current?.click()}
            >
              {uploading ? (
                <LoaderCircle className="spin" />
              ) : (
                <Upload size={25} />
              )}
              <strong>
                {uploading
                  ? "Качване на снимките…"
                  : "Качи снимки от устройството си"}
              </strong>
              <span>JPG, PNG, WebP или AVIF · до 6 MB</span>
            </button>
            <input
              ref={input}
              type="file"
              hidden
              accept="image/jpeg,image/png,image/webp,image/avif"
              multiple
              onChange={(e) => upload(e.target.files)}
            />
            <div className="image-editor-grid">
              {p.images.map((im, i) => (
                <div className="image-editor" key={im.url + i}>
                  <div>
                    <img
                      src={im.url}
                      alt={im.alt || p.name}
                      width="220"
                      height="240"
                    />
                    <span>{i === 0 ? "Основна снимка" : i + 1}</span>
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={"Премахни снимка " + (i + 1)}
                      onClick={() =>
                        set(
                          "images",
                          p.images.filter((_, n) => n !== i),
                        )
                      }
                    >
                      <X size={16} />
                    </button>
                  </div>
                  <label>
                    Цвят на снимката
                    <select
                      value={im.color || ""}
                      onChange={(e) => imageChange(i, "color", e.target.value)}
                    >
                      <option value="">Обща / примерна снимка</option>
                      {p.colors.map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Описание на снимката
                    <input
                      value={im.alt || ""}
                      maxLength={200}
                      onChange={(e) => imageChange(i, "alt", e.target.value)}
                    />
                  </label>
                  {i > 0 && (
                    <button
                      type="button"
                      className="text-link"
                      onClick={() =>
                        set("images", [
                          im,
                          ...p.images.filter((_, n) => n !== i),
                        ])
                      }
                    >
                      Направи основна
                    </button>
                  )}
                </div>
              ))}
            </div>
            <details className="url-import">
              <summary>Добави снимка с адрес</summary>
              <div className="inline-input">
                <input
                  aria-label="HTTPS адрес на снимка"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://…"
                />
                <button
                  type="button"
                  className="button button-light button-small"
                  disabled={!url || p.images.length >= 20}
                  onClick={addUrl}
                >
                  Добави
                </button>
              </div>
            </details>
          </section>
          <section className="admin-panel form-panel">
            <h2>Част и съвместимост</h2>
            <div className="form-grid">
              <label>
                Артикулен номер (SKU)
                <input
                  value={p.sku || ""}
                  maxLength={100}
                  onChange={(e) => set("sku", e.target.value)}
                />
              </label>
              <label>
                Марка / производител
                <input
                  value={p.manufacturer || ""}
                  maxLength={100}
                  onChange={(e) => set("manufacturer", e.target.value)}
                />
              </label>
            </div>
            <label>
              Съвместимост
              <select
                value={p.fitment_type || "unspecified"}
                onChange={(e) => set("fitment_type", e.target.value)}
              >
                <option value="unspecified">Не е потвърдена</option>
                <option value="universal">Универсален монтаж</option>
                <option value="specific">За конкретни модели</option>
              </select>
            </label>
            {p.fitment_type === "specific" && (
              <fieldset>
                <legend>Потвърдени модели</legend>
                {MODELS.map((m) => (
                  <label key={m} className="filter-option">
                    <input
                      type="checkbox"
                      checked={(p.compatible_models || []).includes(m)}
                      onChange={(e) =>
                        set(
                          "compatible_models",
                          e.target.checked
                            ? [...(p.compatible_models || []), m]
                            : (p.compatible_models || []).filter(
                                (x) => x !== m,
                              ),
                        )
                      }
                    />
                    {m}
                  </label>
                ))}
              </fieldset>
            )}
            <label>
              Години / версия
              <input
                value={p.model_years || ""}
                maxLength={120}
                placeholder="Само проверени години и версии"
                onChange={(e) => set("model_years", e.target.value)}
              />
            </label>
            <label>
              Бележки за монтаж и съвместимост
              <textarea
                value={p.fitment_notes || ""}
                rows={4}
                maxLength={2000}
                onChange={(e) => set("fitment_notes", e.target.value)}
              />
            </label>
          </section>
          <section className="admin-panel form-panel">
            <h2>Показване в търсачките</h2>
            <label>
              SEO заглавие
              <input
                value={p.seo_title || ""}
                maxLength={100}
                placeholder={p.name + " — THERRIDE"}
                onChange={(e) => set("seo_title", e.target.value)}
              />
              <small>
                {(p.seo_title || "").length}/100 знака. Празно: използва името
                на продукта.
              </small>
            </label>
            <label>
              SEO описание
              <textarea
                value={p.seo_description || ""}
                rows={3}
                maxLength={220}
                onChange={(e) => set("seo_description", e.target.value)}
              />
              <small>
                Опиши точната част и модела. Празно: използва началото на
                описанието.
              </small>
            </label>
          </section>
          <VariantEditor product={p} onChange={setP}/>
          <section className="admin-panel form-panel">
            <h2>Характеристики</h2>
            <div className="form-grid">
              {[
                ["material", "Материал"],
                ["dimensions", "Размери"],
                ["country", "Производство"],
                ["mounting", "Начин на монтаж"],
              ].map(([key, label]) => (
                <label key={key}>
                  {label}
                  <input
                    maxLength={200}
                    value={p.specs?.[key] || ""}
                    onChange={(e) => spec(key, e.target.value)}
                  />
                </label>
              ))}
            </div>
            <label>
              Какво включва комплектът
              <input
                maxLength={500}
                value={p.specs?.included || ""}
                onChange={(e) => spec("included", e.target.value)}
              />
            </label>
          </section>
        </div>
        <aside>
          <section className="admin-panel form-panel">
            <h2>Публикуване</h2>
            <label className="toggle-label">
              <input
                type="checkbox"
                checked={p.is_active}
                onChange={(e) => set("is_active", e.target.checked)}
              />
              <span>
                <strong>Видим в магазина</strong>
                <small>Изключи, за да скриеш продукта.</small>
              </span>
            </label>
            <label className="toggle-label">
              <input
                type="checkbox"
                checked={p.featured}
                onChange={(e) => set("featured", e.target.checked)}
              />
              <span>
                <strong>Препоръчан продукт</strong>
                <small>Отбелязване за началната страница.</small>
              </span>
            </label>
            <label>
              Подредба
              <input
                type="number"
                min="0"
                max="10000"
                value={p.sort_order}
                onChange={(e) => set("sort_order", Number(e.target.value))}
              />
            </label>
          </section>
          <section className="admin-panel form-panel">
            <h2>Цена и наличност</h2>
            <label>
              Цена в EUR
              <input
                type="text"
                inputMode="decimal"
                required
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </label>
            <label>
              Стара цена в EUR (по желание)
              <input
                type="text"
                inputMode="decimal"
                value={compare}
                onChange={(e) => setCompare(e.target.value)}
                placeholder="Без зачеркната цена"
              />
            </label>
            <label>
              Налични бройки
              <input
                type="number"
                min="0"
                max="999999"
                value={p.stock_quantity ?? ""}
                placeholder="Без ограничение"
                onChange={(e) =>
                  set(
                    "stock_quantity",
                    e.target.value === "" ? null : Number(e.target.value),
                  )
                }
              />
              <small>
                Остави празно за поръчки без ограничение. 0 означава изчерпан.
              </small>
            </label>
            <label>
              Размер / вариант
              <input
                maxLength={80}
                value={p.size_label}
                onChange={(e) => set("size_label", e.target.value)}
                placeholder="Например: диаметър, размер или версия"
              />
            </label>
          </section>
          <section className="admin-panel form-panel">
            <h2>Цветове</h2>
            <div className="admin-color-list">
              {COLORS.map((c) => (
                <label key={c.name}>
                  <input
                    type="checkbox"
                    checked={p.colors.includes(c.name)}
                    onChange={(e) =>
                      set(
                        "colors",
                        e.target.checked
                          ? [...p.colors, c.name]
                          : p.colors.filter((x) => x !== c.name),
                      )
                    }
                  />
                  <span style={{ background: c.hex }} />
                  {c.name}
                </label>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </form>
  );
}
function Orders({ orders, select }) {
  const [filter, setFilter] = useState("all"),
    [query, setQuery] = useState("");
  const shown = orders.filter(
    (o) =>
      (filter === "all" || o.status === filter) &&
      (o.order_number + " " + o.customer_name + " " + o.phone)
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  return (
    <>
      <div className="admin-page-heading">
        <div>
          <h1>Поръчки</h1>
          <p>От първия клик до доставката.</p>
        </div>
        <span className="badge badge-gray">{orders.length} поръчки</span>
      </div>
      <div className="admin-panel">
        <div className="admin-toolbar">
          <select
            aria-label="Статус на поръчките"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">Всички статуси</option>
            {Object.entries(statuses).map(([v, t]) => (
              <option key={v} value={v}>
                {t}
              </option>
            ))}
          </select>
          <div className="shop-search">
            <Search size={17} />
            <input
              aria-label="Търси поръчка"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Номер, име или телефон…"
            />
          </div>
        </div>
        {shown.length ? (
          <OrderTable orders={shown} select={select} />
        ) : (
          <div className="admin-empty">
            <ClipboardList size={38} />
            <h3>Няма поръчки за показване.</h3>
            <p>Новите поръчки ще се появяват тук.</p>
          </div>
        )}
      </div>
    </>
  );
}
function OrderTable({ orders, select }) {
  return (
    <div className="table-scroll">
      <table className="admin-table">
        <thead>
          <tr>
            <th>Поръчка</th>
            <th>Клиент</th>
            <th>Дата</th>
            <th>Статус</th>
            <th>Сума</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id} onClick={() => select(o)} className="clickable-row">
              <td>
                <button className="table-link" onClick={() => select(o)}>
                  {o.order_number}
                </button>
              </td>
              <td>
                {o.customer_name}
                <small className="table-sub">{o.city}</small>
              </td>
              <td>{new Date(o.created_at).toLocaleDateString("bg-BG")}</td>
              <td>
                <span
                  className={
                    "badge badge-" +
                    {
                      new: "orange",
                      confirmed: "blue",
                      shipped: "blue",
                      completed: "green",
                      cancelled: "gray",
                    }[o.status]
                  }
                >
                  {statuses[o.status]}
                </span>
              </td>
              <td>
                <strong>{money(o.total_cents)}</strong>
                {o.shipping_cents === null && (
                  <small className="table-sub">без доставка</small>
                )}
              </td>
              <td>
                <ChevronRight size={17} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function OrderModal({ order: o, close, update }) {
  const [status, setStatus] = useState(o.status),
    [note, setNote] = useState(o.admin_note),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <Modal label={"Поръчка " + o.order_number} close={close} wide>
      <div className="order-dialog">
        <span className="eyebrow">ПОРЪЧКА</span>
        <h2>{o.order_number}</h2>
        <p className="muted">
          {new Date(o.created_at).toLocaleString("bg-BG")}
        </p>
        <div className="order-dialog-grid">
          <div>
            <h3>Клиент</h3>
            <strong>{o.customer_name}</strong>
            <a href={"tel:" + o.phone}>{o.phone}</a>
            {o.email && <a href={"mailto:" + o.email}>{o.email}</a>}
            <h3>Доставка</h3>
            <p>
              {o.courier === "econt" ? "Еконт" : "Спиди"} ·{" "}
              {o.delivery_type === "office" ? "До офис" : "До адрес"}
              <br />
              {o.city} {o.postal_code}
              <br />
              {o.address}
            </p>
            {o.customer_note && (
              <>
                <h3>Бележка от клиента</h3>
                <p>{o.customer_note}</p>
              </>
            )}
          </div>
          <div>
            <h3>Продукти</h3>
            {o.order_items?.map((i) => (
              <div className="order-item" key={i.id}>
                <div>
                  <strong>{i.product_name}</strong>
                  <span>
                    {i.color} · {i.quantity} бр.
                  </span>
                </div>
                <b>{money(i.unit_price_cents * i.quantity)}</b>
              </div>
            ))}
            <dl className="cost-summary">
              <div>
                <dt>Продукти</dt>
                <dd>{money(o.subtotal_cents)}</dd>
              </div>
              {o.discount_cents > 0 && (
                <div>
                  <dt>Отстъпка</dt>
                  <dd>−{money(o.discount_cents)}</dd>
                </div>
              )}
              <div>
                <dt>Доставка</dt>
                <dd>
                  {o.shipping_cents === null
                    ? "По тарифа"
                    : money(o.shipping_cents)}
                </dd>
              </div>
              <div className="cost-total">
                <dt>Общо{o.shipping_cents === null ? " без доставка" : ""}</dt>
                <dd>{money(o.total_cents)}</dd>
              </div>
            </dl>
            <p className="field-help">
              Плащане:{" "}
              {o.payment_method === "cod" ? "наложен платеж" : "Stripe"} ·{" "}
              {
                {
                  unpaid: "неплатена",
                  pending: "очаква плащане",
                  paid: "платена",
                  refunded: "възстановена",
                  failed: "неуспешно",
                  expired: "изтекло",
                }[o.payment_status]
              }
            </p>
          </div>
        </div>
        {o.payment_method==='stripe'&&<button type="button" className="button button-outline button-small" disabled={busy} onClick={async()=>{setBusy(true);setError('');try{const {data,error}=await supabase.functions.invoke('create-checkout',{body:{action:'reconcile',order_id:o.id}});if(error||data?.error)throw new Error(data?.error||'Проверката в Stripe не е достъпна.');setError('Статус: '+data.status+'. Затвори и обнови поръчките.');}catch(e){setError(e.message);}finally{setBusy(false);}}}>Провери плащането в Stripe</button>}
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            try {
              await update(status, note);
            } catch (e) {
              setError(readableError(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="form-grid">
            <label>
              Статус
              <select
                value={status}
                disabled={o.status === "cancelled"}
                onChange={(e) => setStatus(e.target.value)}
              >
                {Object.entries(statuses).map(([v, t]) => (
                  <option value={v} key={v}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Вътрешна бележка
              <input
                maxLength={1000}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </label>
          </div>
          {status === "cancelled" && o.status !== "cancelled" && (
            <p className="field-help">
              Анулирането освобождава резервираните наличности. Анулирана
              поръчка не се отваря повторно. При платена поръчка парите не се възстановяват автоматично — провери възстановяването в Stripe.
            </p>
          )}
          {error && (
            <div className="form-error" role="alert">
              {error}
            </div>
          )}
          <button className="button button-small" disabled={busy}>
            {busy ? (
              <LoaderCircle className="spin" size={16} />
            ) : (
              <Save size={16} />
            )}
            Запази промените
          </button>
        </form>
      </div>
    </Modal>
  );
}
function StoreSettings({ initial, save }) {
  const [s, setS] = useState(initial),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const set = (k, v) => setS((s) => ({ ...s, [k]: v }));
  const required = [
    ["business_name", "Име на търговеца"],
    ["business_address", "Адрес на търговеца"],
    ["business_registration", "Регистрационни данни"],
    ["return_address", "Адрес за връщане"],
    ["returns_text", "Условия за връщане"],
    ["privacy_text", "Политика за поверителност"],
    ["terms_text", "Общи условия"],
  ];
  const ready =
    required.every(([k]) => s[k]?.trim()) && s.contact_email?.includes("@");
  const input = (key, label, type = "text") => (
    <label>
      {label}
      <input
        type={type}
        maxLength={500}
        value={s[key] || ""}
        onChange={(e) => set(key, e.target.value)}
      />
    </label>
  );
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setError("");
        if (s.checkout_enabled && !ready) {
          setError(
            "Попълни всички данни от списъка преди активиране на поръчките.",
          );
          return;
        }
        setBusy(true);
        try {
          const { id, updated_at, ...fields } = s;
          await save(fields);
        } catch (e) {
          setError(readableError(e));
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="admin-page-heading">
        <div>
          <h1>Настройки на магазина</h1>
          <p>Съдържание, доставка и контакти — от едно място.</p>
        </div>
        <button className="button button-small" disabled={busy}>
          {busy ? (
            <LoaderCircle className="spin" size={17} />
          ) : (
            <Save size={17} />
          )}
          Запази
        </button>
      </div>
      {error && (
        <div className="form-error" role="alert">
          {error}
        </div>
      )}
      <div className="editor-layout">
        <div>
          <section className="admin-panel form-panel">
            <h2>Начална страница</h2>
            <label>
              Основно заглавие
              <textarea
                rows={3}
                maxLength={180}
                value={s.hero_title}
                onChange={(e) => set("hero_title", e.target.value)}
              />
              <small>Всеки нов ред се показва на нов ред в заглавието.</small>
            </label>
            <label>
              Кратко описание
              <textarea
                rows={3}
                maxLength={600}
                value={s.hero_description}
                onChange={(e) => set("hero_description", e.target.value)}
              />
            </label>
          </section>
          <section className="admin-panel form-panel">
            <h2>Контакти и данни за търговеца</h2>
            <div className="form-grid">
              {input("contact_email", "Имейл за контакт", "email")}
              {input("contact_phone", "Телефон", "tel")}
              {input("business_name", "Фирма / име на търговеца")}
              {input("business_registration", "ЕИК / регистрационен номер")}
            </div>
            {input("business_address", "Адрес на търговеца")}
            {input("return_address", "Адрес за връщане")}
            {input("instagram_url", "Instagram адрес", "url")}
          </section>
          <section className="admin-panel form-panel">
            <h2>Доставка и отстъпки</h2>
            <label>
              Информация за доставка
              <textarea
                rows={4}
                value={s.delivery_text}
                maxLength={12000}
                onChange={(e) => set("delivery_text", e.target.value)}
              />
            </label>
            <div className="form-grid">
              <label>
                Цена за доставка в EUR
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={
                    s.shipping_fee_cents === null
                      ? ""
                      : s.shipping_fee_cents / 100
                  }
                  placeholder="По тарифата на куриера"
                  onChange={(e) =>
                    set(
                      "shipping_fee_cents",
                      e.target.value === ""
                        ? null
                        : Math.round(Number(e.target.value) * 100),
                    )
                  }
                />
                <small>
                  Празно: доставката се заплаща по тарифата на куриера.
                </small>
              </label>
              <label>
                Безплатна доставка над EUR
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={
                    s.free_shipping_threshold_cents === null
                      ? ""
                      : s.free_shipping_threshold_cents / 100
                  }
                  placeholder="Без праг"
                  onChange={(e) =>
                    set(
                      "free_shipping_threshold_cents",
                      e.target.value === ""
                        ? null
                        : Math.round(Number(e.target.value) * 100),
                    )
                  }
                />
                <small>Прагът се изчислява след отстъпките.</small>
              </label>
              <label>
                Отстъпка при 2 броя (%)
                <input
                  type="number"
                  min="0"
                  max="80"
                  step="1"
                  value={s.discount_2}
                  onChange={(e) => set("discount_2", Number(e.target.value))}
                />
              </label>
              <label>
                Отстъпка при 3+ броя (%)
                <input
                  type="number"
                  min="0"
                  max="80"
                  step="1"
                  value={s.discount_3}
                  onChange={(e) => set("discount_3", Number(e.target.value))}
                />
              </label>
            </div>
          </section>
          {[
            ["returns_text", "Връщане и рекламации"],
            ["privacy_text", "Поверителност"],
            ["terms_text", "Общи условия"],
          ].map(([key, label]) => (
            <section className="admin-panel form-panel" key={key}>
              <h2>{label}</h2>
              <label>
                Текст за страницата
                <textarea
                  rows={9}
                  maxLength={24000}
                  value={s[key]}
                  onChange={(e) => set(key, e.target.value)}
                  placeholder="Въведи условията, които отговарят на твоята дейност."
                />
              </label>
            </section>
          ))}
        </div>
        <aside>
          <section className="admin-panel form-panel">
            <h2>Приемане на поръчки</h2>
            <label className="toggle-label">
              <input
                type="checkbox"
                checked={s.checkout_enabled}
                disabled={!ready}
                onChange={(e) => set("checkout_enabled", e.target.checked)}
              />
              <span>
                <strong>Онлайн поръчки</strong>
                <small>
                  {s.checkout_enabled
                    ? "Магазинът приема поръчки."
                    : "Попълни данните и активирай."}
                </small>
              </span>
            </label>
            <div className="launch-checklist">
              {required.map(([k, label]) => (
                <div key={k} className={s[k]?.trim() ? "done" : ""}>
                  <CheckCircle2 size={16} />
                  {label}
                </div>
              ))}
            </div>
          </section>
          <section className="admin-panel form-panel">
            <h2>Плащане</h2>
            <div className="setting-payment">
              <CheckCircle2 size={18} />
              <span>
                <strong>Наложен платеж</strong>
                <small>Наличен при активни поръчки.</small>
              </span>
            </div>
            <label className="toggle-label">
              <input
                type="checkbox"
                checked={s.stripe_enabled || false}
                onChange={(e) => set("stripe_enabled", e.target.checked)}
              />
              <span>
                <strong>Stripe Checkout</strong>
                <small>
                  Показва плащане с карта. Изисква сървърен ключ, webhook и
                  адрес на сайта в Supabase secrets. Проверете тестова покупка
                  преди активиране.
                </small>
              </span>
            </label>
          </section>
          <section className="admin-panel form-panel">
            <h2>Снимки по цветове</h2>
            <p className="field-help">
              В редакцията на всеки продукт избери цвета на снимката. Така
              клиентът вижда точния вариант, когато имаш снимка за него.
            </p>
          </section>
        </aside>
      </div>
    </form>
  );
}
