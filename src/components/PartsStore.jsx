import React, { useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Search,
  SlidersHorizontal,
  X,
  Check,
  Disc3,
  Zap,
  Settings2,
  Wrench,
  Package,
  ShieldCheck,
  Truck,
  ChevronRight,
} from "lucide-react";
import { Link, Modal, go } from "../App.jsx";
import { money, COLORS } from "../lib/commerce.js";
import {
  CATEGORIES,
  MODELS,
  modelPagePath,
  filterProducts,
  fitmentLabel,
  categoryName,
} from "../lib/catalog.js";
import { ProductImage } from "./ProductImage.jsx";

const icons = {
  disc: Disc3,
  suspension: Settings2,
  drive: Wrench,
  electric: Zap,
  accessory: Package,
};
export function PartsHome({ products, settings, loading, error, retry }) {
  return (
    <>
      <section className="parts-hero">
        <div className="hero-copy">
          <span className="eyebrow">
            <span className="orange-line" /> THERRIDE / ЧАСТИ & АКСЕСОАРИ
          </span>
          <h1>
            {settings.hero_title.split("\n").map((line, i) => (
              <React.Fragment key={i}>
                {i > 0 && <br />}
                <span className={i === 1 ? "text-orange" : ""}>{line}</span>
              </React.Fragment>
            ))}
          </h1>
          <p>{settings.hero_description}</p>
          <div className="hero-actions">
            <Link to="/shop" className="button">
              Разгледай каталога <ArrowUpRight size={20} />
            </Link>
            <a href="#models" className="hero-secondary">
              Избери своя модел <ArrowRight size={17} />
            </a>
          </div>
          <div className="hero-foot">
            <span className="hero-coordinate">СЪЗДАДЕН В БЪЛГАРИЯ</span>
            <span>НАПРАВИ ГО СВОЙ.</span>
          </div>
        </div>
        <div className="hero-visual">
          <ProductImage
            src="/images/IMG_0205.jpg"
            alt="Sur-Ron с оригинални THERRIDE аксесоари"
            sizes="(max-width: 700px) 100vw, 50vw"
            priority
            width={1600}
            height={2400}
          />
          <div className="hero-image-note">
            <span>ОТ НАШИЯ ГАРАЖ</span>
            <strong>Карането е лично.</strong>
            <span className="image-cross">+</span>
          </div>
        </div>
      </section>
      <div className="benefit-bar">
        <span>
          <ShieldCheck /> Съвместимост преди всичко
        </span>
        <span>
          <Truck /> Доставка с Еконт и Спиди
        </span>
        <span>
          <Wrench /> От хора, които карат
        </span>
      </div>
      <section className="section-shell model-section" id="models">
        <div className="section-heading">
          <div>
            <span className="eyebrow">01 / ЗАПОЧНИ ОТ ТУК</span>
            <h2>Кой е твоят Sur-Ron?</h2>
          </div>
          <p>
            Различен модел. Различни части.
            <br />
            Избери точната отправна точка.
          </p>
        </div>
        <div className="model-grid">
          {MODELS.map((model, i) => (
            <Link
              key={model}
              to={modelPagePath(model)}
              className="model-card"
            >
              <span className="model-number">0{i + 1}</span>
              <div>
                <span>SUR-RON</span>
                <h3>{model}</h3>
                <small>{filterProducts(products,{model}).length} съвместими артикула</small>
              </div>
              <ArrowUpRight size={27} />
            </Link>
          ))}
        </div>
        <p className="section-note">
          Универсалните аксесоари са отделно в каталога. Моделът, годината и
          размерите определят съвместимостта.
        </p>
      </section>
      <section className="category-section">
        <div className="section-shell">
          <div className="section-heading">
            <div>
              <span className="eyebrow">02 / ПО СИСТЕМА</span>
              <h2>Следващият ти детайл.</h2>
            </div>
            <Link to="/shop" className="text-link">
              Целият каталог <ArrowUpRight size={18} />
            </Link>
          </div>
          <div className="category-grid">
            {CATEGORIES.map((c) => {
              const Icon = icons[c.icon];
              const count = products.filter(
                (p) => p.category === c.name,
              ).length;
              return (
                <Link
                  className="category-card"
                  to={"/shop?category=" + c.id}
                  key={c.id}
                >
                  <Icon size={42} strokeWidth={1.25} />
                  <h3>{c.name}</h3>
                  <p>{c.detail}</p>
                  <span>
                    {count ? `${count} продукта` : "Подготвяме селекцията"}
                    <ArrowUpRight size={18} />
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>
      {products.some(p=>p.catalogue_only)&&<section className="section-shell featured-section" id="new-parts">
        <div className="section-heading"><div><span className="eyebrow">НОВИ ЧАСТИ В THERRIDE</span><h2>Още избор за твоя Sur-Ron.</h2></div><Link to="/shop" className="text-link">Виж новите артикули <ArrowUpRight size={18}/></Link></div>
        <div className="product-grid">{products.filter(p=>p.catalogue_only).slice(0,8).map(p=><ProductCard key={p.id} product={p}/>)}</div>
      </section>}
      <section className="section-shell featured-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">03 / ПОДБРАНИ ЧАСТИ</span>
            <h2>
              Твоят следващ ъпгрейд.
              <br />
              Избери своя детайл.
            </h2>
          </div>
          <p>
            Части и аксесоари за различен стил на каране.
            <br />
            Провери модела и монтажа преди покупка.
          </p>
        </div>
        {error ? (
          <StoreError error={error} retry={retry} />
        ) : loading ? (
          <CatalogSkeleton />
        ) : (
          <div className="product-grid">
            {products
              .filter((p) => p.featured)
              .sort((a,b)=>Number(Boolean(b.sku?.startsWith("THR-OLX-")))-Number(Boolean(a.sku?.startsWith("THR-OLX-"))))
              .slice(0, 4)
              .map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
          </div>
        )}
        <div className="section-action">
          <Link
            to="/shop"
            className="button button-outline"
          >
            Всички части <ArrowRight size={18} />
          </Link>
        </div>
      </section>
      <section className="fitment-story section-shell" id="fitment">
        <div className="story-index">FIT / FIRST</div>
        <div>
          <span className="eyebrow">
            ДОБРИЯТ ЪПГРЕЙД ЗАПОЧВА С ПРАВИЛНИЯ ИЗБОР
          </span>
          <h2>
            Пасва на мотора.
            <br />
            <span>Пасва на твоето каране.</span>
          </h2>
          <p>
            Провери модела, годината и размерите преди поръчка. Не си сигурен?
            Изпрати ни снимка и името на частта. Ще уточним съвместимостта с
            теб.
          </p>
          <Link to="/info/contact" className="text-link">
            Помощ при избора <ArrowUpRight size={18} />
          </Link>
        </div>
        <div className="fitment-steps">
          {[
            "Избери точния модел",
            "Провери размерите и монтажа",
            "Подготви следващото каране",
          ].map((x, i) => (
            <div key={x}>
              <span>0{i + 1}</span>
              <p>{x}</p>
              <Check size={18} />
            </div>
          ))}
        </div>
      </section>
      <section className="brand-statement">
        <span className="eyebrow">
          СЪЗДАДЕН В БЪЛГАРИЯ. НАКЪДЕТО ТЕ ОТВЕДЕ ПЪТЯТ.
        </span>
        <h2>
          По-малко шум.
          <br />
          Повече каране.
        </h2>
        <Link to="/info/about" className="button button-dark">
          Това е Therride <ArrowUpRight size={18} />
        </Link>
      </section>
    </>
  );
}
export function ProductCard({ product: p }) {
  const previewParams=new URLSearchParams(location.search);
  const previewSuffix=previewParams.get('preview')==='1'?'?preview=1':previewParams.get('catalogPreview')==='1'?'?catalogPreview=1':'';
  return (
    <article className="product-card">
      <Link to={"/product/" + p.slug+previewSuffix} className="product-card-image">
        <ProductImage
          src={p.images?.[0]?.url}
          alt={p.images?.[0]?.alt || p.name}
          sizes="(max-width: 600px) 45vw, (max-width: 1000px) 30vw, 23vw"
          width={600}
          height={750}
        />
        {p.stock_quantity === 0 && (
          <span className="product-label">Изчерпан</span>
        )}
        <span className="card-arrow">
          <ArrowUpRight size={21} />
        </span>
      </Link>
      <div className="product-card-body">
        <span className="product-category">
          {p.manufacturer || "КАТАЛОГ"} / {p.category}
        </span>
        <h3>
          <Link to={"/product/" + p.slug+previewSuffix}>{p.name}</Link>
        </h3>
        <p className="card-fitment">{fitmentLabel(p)}</p>
        <div className="product-card-bottom">
          <strong>{p.variants?.some(v=>v.price_cents!==p.price_cents)?"от ":""}{money(p.price_cents)}</strong>
          {p.colors?.length > 1 && (
            <span
              className="card-colors"
              aria-label={p.colors.length + " цвята"}
            >
              {p.colors.slice(0, 4).map((c) => (
                <i
                  key={c}
                  style={{
                    background: COLORS.find((x) => x.name === c)?.hex || "#777",
                  }}
                />
              ))}
              <small>+{Math.max(0, p.colors.length - 4)}</small>
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
export function CatalogSkeleton() {
  return (
    <div
      className="product-grid"
      aria-label="Зареждане на каталога"
      aria-busy="true"
    >
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="catalog-skeleton">
          <div />
          <span />
          <span />
        </div>
      ))}
    </div>
  );
}
export function StoreError({ error, retry }) {
  return (
    <div className="store-error" role="alert">
      <p>{error}</p>
      <button className="button button-outline" onClick={retry}>
        Опитай отново
      </button>
    </div>
  );
}
export function PartsShop({ products, loading, error, retry, modelPage }) {
  const params = new URLSearchParams(location.search);
  const [query, setQuery] = useState(params.get("q") || ""),
    [category, setCategory] = useState(params.get("category") || ""),
    [model, setModel] = useState(modelPage?.model || params.get("model") || ""),
    [color, setColor] = useState(params.get("color") || ""),
    [minPrice, setMinPrice] = useState(params.get("min") || ""),
    [maxPrice, setMaxPrice] = useState(params.get("max") || ""),
    [stock, setStock] = useState(false),
    [sort, setSort] = useState("newest"),
    [filterOpen, setFilterOpen] = useState(false);
  const sync = (key, val) => {
    const next = new URLSearchParams(location.search);
    val ? next.set(key, val) : next.delete(key);
    history.replaceState(
      {},
      "",
      location.pathname + (next.size ? "?" + next.toString() : ""),
    );
  };
  const choose = (key, val) => {
    if(key==='model'&&modelPage){go(val?modelPagePath(val):'/shop');return;}
    ({ q: setQuery, category: setCategory, model: setModel, color:setColor, min:setMinPrice, max:setMaxPrice })[key](val);
    sync(key, val);
  };
  const clear = () => {
    setQuery("");
    setCategory("");
    setModel(modelPage?.model || "");
    setColor("");
    setMinPrice("");
    setMaxPrice("");
    setStock(false);
    history.replaceState({}, "", location.pathname);
  };
  const shown = filterProducts(products, {
    query,
    category,
    model,
    stock,
    sort,
    color,
    minPrice:minPrice===''?undefined:Math.round(Number(minPrice)*100),
    maxPrice:maxPrice===''?undefined:Math.round(Number(maxPrice)*100),
  });
  const filters = (
    <>
      <div className="filter-group">
        <h3>Твоят модел</h3>
        <label className="filter-option">
          <input
            type="radio"
            name="model"
            checked={!model}
            onChange={() => choose("model", "")}
          />
          Всички модели
        </label>
        {MODELS.map((m) => (
          <label className="filter-option" key={m}>
            <input
              type="radio"
              name="model"
              checked={model === m}
              onChange={() => choose("model", m)}
            />
            {m}
          </label>
        ))}
      </div>
      <div className="filter-group">
        <h3>Категория</h3>
        <label className="filter-option">
          <input
            type="radio"
            name="category"
            checked={!category}
            onChange={() => choose("category", "")}
          />
          Всички категории
        </label>
        {CATEGORIES.map((c) => (
          <label className="filter-option" key={c.id}>
            <input
              type="radio"
              name="category"
              checked={category === c.id}
              onChange={() => choose("category", c.id)}
            />
            {c.name}
            <small>
              {products.filter((p) => p.category === c.name).length}
            </small>
          </label>
        ))}
      </div>
      <div className="filter-group">
        <h3>Цена в евро</h3>
        <div className="price-filter-inputs">
          <label>От<input aria-label="Минимална цена в евро" type="number" min="0" step="0.01" value={minPrice} onChange={e=>choose('min',e.target.value)}/></label>
          <label>До<input aria-label="Максимална цена в евро" type="number" min="0" step="0.01" value={maxPrice} onChange={e=>choose('max',e.target.value)}/></label>
        </div>
      </div>
      <div className="filter-group">
        <h3>Цвят и покритие</h3>
        <select className="color-filter-select" aria-label="Филтър по цвят" value={color} onChange={e=>choose('color',e.target.value)}>
          <option value="">Всички цветове</option>
          {[...new Set(products.flatMap(p=>p.colors||[]))].filter(c=>c!=='Стандартен').sort((a,b)=>a.localeCompare(b,'bg')).map(c=><option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div className="filter-group">
        <label className="filter-option">
          <input
            type="checkbox"
            checked={stock}
            onChange={(e) => setStock(e.target.checked)}
          />
          Само с потвърдена наличност
        </label>
      </div>
      <Link to="/info/contact" className="filter-help">
        <Wrench size={22} />
        <strong>Нужна ти е помощ?</strong>
        <span>Да проверим съвместимостта.</span>
        <ArrowUpRight size={19} />
      </Link>
    </>
  );
  return (
    <section className="section-shell parts-shop">
      <nav className="breadcrumbs" aria-label="Навигация">
        <Link to="/">Начало</Link>
        <ChevronRight size={14} />
        {modelPage?<><Link to="/shop">Каталог</Link><ChevronRight size={14}/><span>{modelPage.model}</span></>:<span>Каталог</span>}
      </nav>
      <div className="catalog-heading">
        <div>
          <span className="eyebrow">ЧАСТИ. АКСЕСОАРИ. ТВОЕТО КАРАНЕ.</span>
          <h1>{model || categoryName(category) || "Каталогът на Therride"}</h1>
        </div>
        {modelPage?<p>{modelPage.description}</p>:<p>
          Първо съвместимостта.
          <br />
          След това — следващият маршрут.
        </p>}
      </div>
      <nav className="model-navigation" aria-label="Каталози по модел">{MODELS.map(m=><Link key={m} to={modelPagePath(m)} aria-current={model===m?'page':undefined}>{m}<span>{filterProducts(products,{model:m}).length}</span></Link>)}</nav>
      <div className="catalog-toolbar">
        <div className="catalog-search">
          <Search size={19} />
          <input
            type="search"
            aria-label="Търси продукт, марка или артикулен номер"
            placeholder="Продукт, марка или артикулен номер…"
            value={query}
            onChange={(e) => choose("q", e.target.value)}
          />
          {query && (
            <button
              aria-label="Изчисти търсенето"
              onClick={() => choose("q", "")}
            >
              <X size={17} />
            </button>
          )}
        </div>
        <button
          className="button button-outline mobile-filter"
          onClick={() => setFilterOpen(true)}
        >
          <SlidersHorizontal size={17} />
          Филтри
        </button>
        <label className="sort-label">
          <span className="sr-only">Подреди</span>
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="newest">Най-нови артикули</option>
            <option value="featured">Препоръчани</option>
            <option value="price-low">Цена: ниска → висока</option>
            <option value="price-high">Цена: висока → ниска</option>
          </select>
        </label>
      </div>
      <div className="catalog-layout">
        <aside className="catalog-filters" aria-label="Филтри">
          {filters}
        </aside>
        <div className="catalog-results">
          <div className="results-top">
            <span aria-live="polite">
              {shown.length} {shown.length === 1 ? "продукт" : "продукта"}
            </span>
            {(query || model || category || stock) && (
              <button className="text-link" onClick={clear}>
                Изчисти филтрите <X size={14} />
              </button>
            )}
          </div>
          {error ? (
            <StoreError error={error} retry={retry} />
          ) : loading ? (
            <CatalogSkeleton />
          ) : shown.length ? (
            <div className="product-grid">
              {shown.map((p) => (
                <ProductCard product={p} key={p.id} />
              ))}
            </div>
          ) : (
            <div className="catalog-empty">
              <Package size={42} strokeWidth={1.3} />
              <h2>
                {query ? "Няма точен резултат." : "Подготвяме тази селекция."}
              </h2>
              <p>
                {query
                  ? "Опитай с по-кратко име или артикулен номер."
                  : "Добавяме части с проверени данни за модела и монтажа. Кажи ни какво търсиш — модел, година и част."}
              </p>
              <Link to="/info/contact" className="button">
                Питай за конкретна част <ArrowUpRight size={17} />
              </Link>
              <Link className="text-link" to="/shop">Виж целия каталог</Link>
            </div>
          )}
          {model && (
            <p className="section-note">
              Показваме само части с изрично посочен модел {model}.
              Универсалните аксесоари са в целия каталог.
            </p>
          )}
        </div>
      </div>
      {filterOpen && (
        <Modal close={() => setFilterOpen(false)} label="Филтри на каталога">
          <div className="mobile-filter-panel">
            <h2>Твоят избор</h2>
            {filters}
            <button className="button" onClick={() => setFilterOpen(false)}>
              Покажи {shown.length} продукта <ArrowRight size={17} />
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}
