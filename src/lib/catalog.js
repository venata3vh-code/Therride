export const MODELS = ["Light Bee X", "Light Bee S", "Ultra Bee", "Storm Bee"];
export const MODEL_PAGES = [
 {model:'Light Bee X',slug:'light-bee-x',description:'Части и аксесоари с изрично посочена съвместимост за Sur-Ron Light Bee X. Избери категория и изпълнение за своя мотор.'},
 {model:'Light Bee S',slug:'light-bee-s',description:'Каталог за Sur-Ron Light Bee S (Light S). Провери версията, размерите и монтажните точки преди избор на част.'},
 {model:'Ultra Bee',slug:'ultra-bee',description:'Части за Sur-Ron Ultra Bee: спирачки, пластмаси, управление и още. Всяко изпълнение има собствена цена и данни за съвместимост.'},
 {model:'Storm Bee',slug:'storm-bee',description:'Твоето място за части за Sur-Ron Storm Bee. Публикуваме само артикули с изрично посочена съвместимост за този модел.'},
];
export const modelPagePath=model=>{const p=MODEL_PAGES.find(p=>p.model===model);return p?'/models/'+p.slug:'/shop';};
export const modelPageAtPath=path=>MODEL_PAGES.find(p=>path==='/models/'+p.slug);
export const CATEGORIES = [
 {id:'cockpit',name:'Кормило и управление',detail:'Контролът е в ръцете ти',icon:'drive'},
 {id:'frame',name:'Рама и ергономия',detail:'Детайли за твоето каране',icon:'accessory'},
 {id:'tools',name:'Консумативи и инструменти',detail:'Грижа за мотора',icon:'drive'},
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
    color = "",
    minPrice,
    maxPrice,
  } = {},
) {
  const q = query.trim().toLocaleLowerCase("bg");
  const hasMin=Number.isFinite(minPrice),hasMax=Number.isFinite(maxPrice);
  const selectedModel=model==='Light S'?'Light Bee S':model;
  const optionMatches=p=>{
    if(!color&&!hasMin&&!hasMax&&!stock)return true;
    const options=p.variants?.length?p.variants:(p.colors?.length?p.colors:['']).map(c=>({label:c,attributes:{color:c},price_cents:p.price_cents,stock_quantity:p.stock_quantity,availability:p.stock_quantity>0?'in_stock':'unknown'}));
    return options.some(v=>(!color||(v.attributes?.color||v.label)===color)&&(!hasMin||Number.isInteger(v.price_cents)&&v.price_cents>=minPrice)&&(!hasMax||Number.isInteger(v.price_cents)&&v.price_cents<=maxPrice)&&(!stock||p.inventory_confirmed!==false&&p.specs?.purchase_mode!=='inquiry'&&v.availability==='in_stock'&&Number.isInteger(v.stock_quantity)&&v.stock_quantity>0));
  };
  const filtered = products.filter(
    (p) =>
      (!category || categoryId(p.category) === category) &&
      (!selectedModel ||
        (p.fitment_type === "specific" &&
          p.compatible_models?.includes(selectedModel))) &&
      optionMatches(p) &&
      (!q ||
        [
          p.name,
          p.subtitle,
          p.sku,
          p.manufacturer,
          p.category,
          ...(p.compatible_models || []),
          ...(p.compatible_models?.includes('Light Bee S')?['Light S']:[]),
          ...(p.colors||[]),
          ...(p.variants||[]).map(v=>v.label),
        ]
          .join(" ")
          .toLocaleLowerCase("bg")
          .includes(q)),
  );
  return [...filtered].sort((a,b)=>{
    if(sort==='newest')return Number(!!b.catalogue_only)-Number(!!a.catalogue_only)||(a.sort_order||0)-(b.sort_order||0);
    if(sort==='price-low'||sort==='price-high'){
      if(!Number.isInteger(a.price_cents))return Number.isInteger(b.price_cents)?1:0;
      if(!Number.isInteger(b.price_cents))return -1;
      return sort==='price-low'?a.price_cents-b.price_cents:b.price_cents-a.price_cents;
    }
    return Number(!!b.featured)-Number(!!a.featured)||(a.sort_order||0)-(b.sort_order||0);
  });
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
