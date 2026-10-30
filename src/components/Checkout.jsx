import {optionFor,optionAvailable} from '../lib/variants.js';
import React, { useState, useRef, useEffect } from "react";
import {
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  LockKeyhole,
  LoaderCircle,
  Truck,
} from "lucide-react";
import { Link, CartLines, CostSummary } from "../App.jsx";
import { supabase } from "../lib/supabase.js";
import { totals, money, readableError } from "../lib/commerce.js";
export default function Checkout({
  cart,
  products,
  settings,
  update,
  done,
  loading,
}) {
  const [customer, setCustomer] = useState(() => {
      try {
        const saved = JSON.parse(
          sessionStorage.getItem("therride-checkout-draft") || "null",
        );
        if (saved) return saved;
      } catch {}
      return {
        name: "",
        email: "",
        phone: "",
        city: "",
        address: "",
        postal_code: "",
        courier: "econt",
        delivery_type: "office",
        note: "",
      };
    }),
    [consent, setConsent] = useState(false),
    [website, setWebsite] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [receipt, setReceipt] = useState(null),
    [payment, setPayment] = useState("cod"),
    [paymentConfig, setPaymentConfig] = useState({
      ready: false,
      livemode: false,
    });
  useEffect(() => {
    try {
      sessionStorage.setItem(
        "therride-checkout-draft",
        JSON.stringify(customer),
      );
    } catch {}
  }, [customer]);
  useEffect(() => {
    let active = true;
    supabase.functions
      .invoke("create-checkout", { body: { action: "config" } })
      .then(({ data }) => {
        if (active && data) setPaymentConfig(data);
      });
    return () => {
      active = false;
    };
  }, []);
  const lock = useRef(false),
    attempt = useRef(null);
  const amount = totals(cart, products, settings);
  const invalid = cart.some(
    (l) =>
      !products.some(
        (p) => p.id === l.product_id && optionAvailable(p,optionFor(p,l)) && (optionFor(p,l).stock_quantity==null||optionFor(p,l).stock_quantity>=l.quantity),
      ),
  );
  useEffect(() => {
    document.title = "Завърши поръчката — THERRIDE";
  }, []);
  const field = (name, label, extra = {}) => (
    <label>
      {label}
      <input
        name={name}
        value={customer[name]}
        onChange={(e) => setCustomer((c) => ({ ...c, [name]: e.target.value }))}
        {...extra}
      />
    </label>
  );
  const submit = async (e) => {
    e.preventDefault();
    if (lock.current) return;
    setError("");
    if (invalid) {
      setError("Обнови количката: има неналичен продукт или цвят.");
      return;
    }
    if (!settings.checkout_enabled) {
      setError(
        "Поръчките още не са активирани. Свържи се с нас за съдействие.",
      );
      return;
    }
    const body = {
      customer,
      items: cart,
      consent,
      website,
      payment_method: payment,
    };
    lock.current = true;
    setBusy(true);
    try {
      const digest = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(JSON.stringify(body)),
      );
      const signature = Array.from(new Uint8Array(digest), (b) =>
        b.toString(16).padStart(2, "0"),
      ).join("");
      try {
        attempt.current = JSON.parse(
          sessionStorage.getItem("therride-checkout-attempt") || "null",
        );
      } catch {}
      if (attempt.current?.signature !== signature)
        attempt.current = { signature, key: crypto.randomUUID() };
      try {
        sessionStorage.setItem(
          "therride-checkout-attempt",
          JSON.stringify(attempt.current),
        );
      } catch {}
      const { data, error: apiError } = await supabase.functions.invoke(
        payment === "stripe" ? "create-checkout" : "place-order",
        { body: { ...body, idempotency_key: attempt.current.key } },
      );
      if (apiError) {
        let text;
        try {
          text = (await apiError.context.json()).error;
        } catch {}
        throw new Error(text || "Неуспешна връзка. Опитай отново.");
      }
      if (data?.error) throw new Error(data.error);
      if (payment === "stripe") {
        const destination = new URL(data?.url || "");
        if (
          destination.protocol !== "https:" ||
          destination.hostname !== "checkout.stripe.com"
        )
          throw new Error("Невалиден адрес за плащане.");
        location.assign(destination.href);
        return;
      }
      if (!data?.order_number)
        throw new Error("Липсва потвърждение на поръчката. Опитай отново.");
      setReceipt(data);
      try {
        sessionStorage.removeItem("therride-checkout-draft");
        sessionStorage.removeItem("therride-checkout-attempt");
      } catch {}
      done();
    } catch (e) {
      setError(readableError(e));
    } finally {
      setBusy(false);
      lock.current = false;
    }
  };
  if (receipt)
    return (
      <div className="checkout-success section-shell">
        <CheckCircle2 size={62} />
        <span className="eyebrow">ПОРЪЧКАТА Е ЗАПИСАНА</span>
        <h1>
          Благодарим ти.
          <br />
          Скоро си в движение.
        </h1>
        <p>
          Номер на поръчка: <strong>{receipt.order_number}</strong>
        </p>
        <p>
          {receipt.shipping_cents === null ? "Продукти: " : "Обща сума: "}
          <strong>{money(receipt.total_cents)}</strong>. Плащането е с наложен
          платеж.
          {receipt.shipping_cents === null &&
            " Доставката се заплаща по тарифата на куриера."}
        </p>
        <p>
          Запази номера. При въпроси пиши на{" "}
          <a href={"mailto:" + settings.contact_email}>
            {settings.contact_email}
          </a>
          .
        </p>
        <Link className="button" to="/shop">
          Обратно към продуктите <ArrowRight size={18} />
        </Link>
      </div>
    );
  if (loading)
    return (
      <div className="page-loading">
        <LoaderCircle className="spin" />
      </div>
    );
  if (!cart.length)
    return (
      <div className="empty page-shell">
        <ShoppingBag size={45} />
        <h1>Количката е празна.</h1>
        <Link to="/shop" className="button">
          Избери държач <ArrowRight size={18} />
        </Link>
      </div>
    );
  return (
    <div className="section-shell checkout-page">
      <Link to="/shop" className="text-link">
        <ArrowLeft size={16} />
        Към продуктите
      </Link>
      <h1>
        Още една стъпка.
        <br />
        <span className="muted">После — към пътя.</span>
      </h1>
      {!settings.checkout_enabled && (
        <div className="notice">
          Магазинът се подготвя за новото начало. За поръчка в момента пиши на{" "}
          <a href={"mailto:" + settings.contact_email}>
            {settings.contact_email}
          </a>
          .
        </div>
      )}
      <form className="checkout-layout" onSubmit={submit}>
        <div className="checkout-form">
          <section>
            <h2>
              <span>01</span> Данни за контакт
            </h2>
            {field("name", "Име и фамилия", {
              required: true,
              minLength: 3,
              maxLength: 160,
              autoComplete: "name",
            })}
            <div className="form-grid">
              {field("phone", "Телефон", {
                required: true,
                type: "tel",
                minLength: 7,
                maxLength: 25,
                autoComplete: "tel",
              })}
              {field("email", "Имейл (по желание)", {
                type: "email",
                maxLength: 200,
                autoComplete: "email",
              })}
            </div>
          </section>
          <section>
            <h2>
              <span>02</span> Доставка
            </h2>
            <fieldset className="delivery-options">
              <legend>Куриер</legend>
              {[
                ["econt", "Еконт"],
                ["speedy", "Спиди"],
              ].map(([v, n]) => (
                <label
                  key={v}
                  className={customer.courier === v ? "selected" : ""}
                >
                  <input
                    type="radio"
                    name="courier"
                    value={v}
                    checked={customer.courier === v}
                    onChange={() => setCustomer((c) => ({ ...c, courier: v }))}
                  />
                  {n}
                </label>
              ))}
            </fieldset>
            <fieldset className="delivery-options">
              <legend>Доставка до</legend>
              {[
                ["office", "Офис на куриер"],
                ["address", "Адрес"],
              ].map(([v, n]) => (
                <label
                  key={v}
                  className={customer.delivery_type === v ? "selected" : ""}
                >
                  <input
                    type="radio"
                    name="delivery"
                    value={v}
                    checked={customer.delivery_type === v}
                    onChange={() =>
                      setCustomer((c) => ({ ...c, delivery_type: v }))
                    }
                  />
                  {n}
                </label>
              ))}
            </fieldset>
            <div className="form-grid">
              {field("city", "Населено място", {
                required: true,
                minLength: 2,
                maxLength: 120,
                autoComplete: "address-level2",
              })}
              {field("postal_code", "Пощенски код (по желание)", {
                maxLength: 20,
                autoComplete: "postal-code",
              })}
            </div>
            {field(
              "address",
              customer.delivery_type === "office"
                ? "Име и адрес на офиса"
                : "Улица, номер, блок, вход",
              {
                required: true,
                minLength: 3,
                maxLength: 500,
                autoComplete:
                  customer.delivery_type === "address"
                    ? "street-address"
                    : "off",
                placeholder:
                  customer.delivery_type === "office"
                    ? "Напиши точно кой офис избираш"
                    : "",
              },
            )}
            <p className="field-help">
              {customer.delivery_type === "office"
                ? "Посочи точния офис на избрания куриер."
                : "Посочи пълен адрес за доставка."}{" "}
              {settings.delivery_text}
            </p>
            <label>
              Бележка (по желание)
              <textarea
                maxLength={1000}
                value={customer.note}
                onChange={(e) =>
                  setCustomer((c) => ({ ...c, note: e.target.value }))
                }
              />
            </label>
          </section>
          <section>
            <h2>
              <span>03</span> Плащане
            </h2>
            <fieldset className="payment-options">
              <legend className="sr-only">Избери плащане</legend>
              <label
                className={
                  "payment-option " + (payment === "cod" ? "selected" : "")
                }
              >
                <input
                  type="radio"
                  name="payment"
                  checked={payment === "cod"}
                  onChange={() => setPayment("cod")}
                />
                <span>
                  <strong>Наложен платеж</strong>
                  <small>Плащаш при получаване.</small>
                </span>
              </label>
              {settings.stripe_enabled && paymentConfig.ready && (
                <label
                  className={
                    "payment-option " + (payment === "stripe" ? "selected" : "")
                  }
                >
                  <input
                    type="radio"
                    name="payment"
                    checked={payment === "stripe"}
                    onChange={() => setPayment("stripe")}
                  />
                  <span>
                    <strong>Карта / дигитален портфейл</strong>
                    <small>Защитено плащане чрез Stripe.</small>
                  </span>
                </label>
              )}
            </fieldset>
            {payment === "stripe" && !paymentConfig.livemode && (
              <p className="payment-test-note">
                Тестов режим: използвай само тестови данни за плащане. Не се
                извършва реално плащане.
              </p>
            )}
            {new URLSearchParams(location.search).get("payment") ===
              "cancelled" && (
              <p className="field-help">
                Плащането не е завършено. Данните ти са запазени; можеш да
                продължиш.
              </p>
            )}
            <label className="consent">
              <input
                type="checkbox"
                required
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
              />
              <span>
                Запознат съм с <Link to="/info/terms">условията</Link> и{" "}
                <Link to="/info/privacy">обработката на данните ми</Link> за
                изпълнение на поръчката.
                {amount.shipping === null &&
                  " Доставката се заплаща отделно по тарифата на куриера."}
              </span>
            </label>
            <div className="honey" aria-hidden="true">
              <label>
                Уебсайт
                <input
                  tabIndex="-1"
                  autoComplete="off"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                />
              </label>
            </div>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <button
              className="button checkout-submit"
              disabled={busy || !settings.checkout_enabled || invalid}
            >
              {busy ? (
                <>
                  <LoaderCircle className="spin" size={18} />
                  Изпращане…
                </>
              ) : (
                <>
                  {payment === "stripe"
                    ? "Продължи към плащане"
                    : "Поръчай с наложен платеж"}{" "}
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </section>
        </div>
        <aside className="checkout-summary">
          <h2>Твоят избор</h2>
          <CartLines cart={cart} products={products} update={update} />
          <CostSummary amount={amount} />
          <p className="secure-note">
            <LockKeyhole size={15} /> Цените се потвърждават при изпращане на
            поръчката.
          </p>
        </aside>
      </form>
    </div>
  );
}
