import fs from 'node:fs/promises';
const db=JSON.parse(await fs.readFile('therride-products.json','utf8'));
const old=JSON.parse(await fs.readFile('catalog/baseline-snapshot.json','utf8')).products;
const current=JSON.parse(await fs.readFile('catalog/published-snapshot.json','utf8'));
const recheck=JSON.parse(await fs.readFile('catalog/facebook-recheck-report.json','utf8'));
const clean=s=>s.toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
const matches=db.products.flatMap(p=>old.filter(o=>o.category===p.category&&clean(o.name)===clean(p.name)).map(o=>({new_sku:p.sku,old_sku:o.sku,name:p.name})));
const euro=c=>c===null?'За проверка':(c/100).toFixed(2)+' €';
const cell=s=>String(s??'').replaceAll('|',' / ').replaceAll('\n',' ');
const table=(heads,rows)=>[heads.map(cell).join(' | '),heads.map(()=>'---').join(' | '),...rows.map(r=>r.map(cell).join(' | '))].map(r=>'| '+r+' |').join('\n');
const supported=db.products.filter(p=>p.publication.in_scope),excluded=db.products.filter(p=>!p.publication.in_scope),priceReviews=db.products.filter(p=>p._internal.price_review),identity=db.products.filter(p=>p._internal.identity_review);
const ledger=db.sources.map(s=>{const ps=db.products.filter(p=>p._internal.source_numbers.includes(s.number));return [s.number,'['+s.title+']('+s.url+')',s.date_label,s.prices.map(p=>p.amount+' EUR').join('; '),ps.map(p=>p.sku).join('; '),ps.every(p=>!p.publication.in_scope)?'Извън моделния обхват':ps.some(p=>p._internal.price_review)?'Противоречива цена':'Обработена'];});
const variants=db.products.flatMap(p=>p.variants.map(v=>[p.sku,v.sku,p.name,v.label,v._internal.original_price?v._internal.original_price.amount+' '+v._internal.original_price.currency:'Противоречиви цени',euro(v.price_cents),v.stock_quantity,'Не',p.publication.in_scope?'Да':'Не',v._internal.source_number]));
await fs.writeFile('catalog/existing-product-matches.json',JSON.stringify(matches,null,2)+'\n');
await fs.writeFile('product-images/image-review.json',JSON.stringify({generated_date:db.generated_date,accepted_images:0,source_seller_images_used:false,research:'image-research-2026-11-02.json',products:db.products.map(p=>({id:p.id,sku:p.sku,name:p.name,status:'exact_identity_and_commercial_rights_unconfirmed',target_count_min:3,target_count_max:5,target_views:['Преден ракурс','Обратна страна','Монтажни точки','Страничен ракурс','Маркировка'],variants:p.variants.map(v=>({variant_id:v.id,label:v.label,images:[]})),reason:'Нужни са точно съпоставяне на изпълнението и разрешение за търговско използване или собствени снимки.'}))},null,2)+'\n');
const report=`# THERRIDE — действителен импорт и контрол на каталога

Дата: ${db.generated_date}, Europe/Sofia. Източник: [SurRon FANS](${db.source.canonical_url}).

**103 Facebook артикула са внесени в действащата Supabase база; общо 147 видими позиции. Ultra Bee и Storm Bee имат отделни страници. Netlify публикация не е извършена: сигурният вход не беше довършен.**

## Пълнота и повторна проверка

${table(['Показател','Резултат'],[['Публични публикации',db.sources.length],['Оригинални ценови наблюдения',recheck.total_original_price_values],['Нормализирани продукти',db.products.length],['Всички варианти',variants.length],['Видими Facebook продукти / варианти',supported.length+' / '+supported.reduce((n,p)=>n+p.variants.length,0)],['Общо позиции в Supabase',current.products.length],['Facebook позиции за Light Bee X/S',93],['Ultra Bee, включително 1 общ продукт',11],['Потвърдени от източника продукти за Storm Bee',0],['Архивни продукти извън обхвата',excluded.length],['Ценови конфликти',priceReviews.length],['Допълнителни проверки на идентичността',identity.length],['Съпоставени съществуващи записи',matches.length],['Нови снимки с доказани права',0]])}

Повторната проверка на 2 ноември достигна дъното на списъка до 12 август. Всички 113 предишни публикации и 132 ценови стойности са проверени отново без промяна. Открит е пропуснатият по-рано гумен предпазител за задния амортисьор: източник №114, 30.00 EUR → 25.00 EUR, Light Bee S/X. Това е отделен артикул от текстилния калъф. Номерата 1–113 са запазени, за да не се променят установените връзки.

След три проверки на дъното няма нови записи и няма активен индикатор за зареждане. Виртуализирани/свити публикации са проверени по директните им публични връзки. Различни pfbid връзки към една публикация са сверени чрез числовия photo-post ID. Регистър: catalog/facebook-price-evidence.json; заключение: catalog/facebook-recheck-report.json.

Това удостоверява достъпния публичен списък към проверката. Изтрити, скрити и бъдещи публикации не могат да бъдат удостоверени. Относителните дати са запазени като наблюдавани етикети, без измислени часове.

## Цени

За всеки еднозначно оценен вариант е приложено оригинална EUR цена минус 5.00 EUR, в цели евроцентове. За BGN е реализирана точна конверсия по 1.95583 BGN/EUR преди отстъпката; в наблюдавания списък няма BGN цени. Повторен импорт не намалява цената отново. Оригиналните цени са в административните JSON/CSV и private.catalogue_product_sources; не се изпращат в публичните продукти и не се показват като зачеркната промоционална цена.

${table(['SKU','Артикул','Противоречиви източници','Решение'],priceReviews.map(p=>[p.sku,p.name,p._internal.price_candidates.map(c=>'№'+c.source+': '+c.amount+' EUR').join('; '),'Видим със запитване; price_cents=null, без измислена нулева цена.']))}

## Supabase и защита на наличностите

Проект: abbwqzvlprpjkfmssktf. В products са внесени 103 Facebook позиции: 98 нови ID и 5 запазени съществуващи ID. Общият каталог е 147 позиции. Пълните 106 изходни продукта, включително 3 извън моделния обхват, се пазят в private.catalogue_product_sources. Изходният стар каталог е архивиран в private.catalogue_import_backups преди промените.

Наличностите на новите варианти започват от конфигурируеми 10 броя. Те са unknown, inventory_confirmed=false и purchase_mode=inquiry. Не са потвърдена физическа стока. Поръчките и плащанията за такива артикули се отхвърлят и от сървъра. Администраторът може да редактира всяко количество, снимки, текстове и видимост; редакциите в базата имат предимство пред включения резервен каталог. Скрит от администратора продукт не се появява отново от статичния файл.

Миграцията допуска празна цена само при запитване и непотвърдена наличност. Запазени са съществуващите проверки на вариантите, резервираните бройки и RLS. Новите частни таблици нямат права за anon/authenticated. Проверка в транзакция потвърди приемане на запитване с null цена, след което тестовият запис беше отменен. Няма създадени клиентски поръчки.

## Дублиране и идентичност

Повторен импорт съпоставя стабилни ID/SKU и не създава допълнителни артикули. Цветовете и размерите са варианти. Различните части в обща публикация са разделени.

${table(['Ново SKU','Старо SKU','Артикул'],matches.map(m=>[m.new_sku,m.old_sku,m.name]))}

Петте съвпадения по име/категория запазват старите ID и адреси; новите адреси са алиаси. Старите снимки и потвърдени количества не се пренасят към новите запитвания. Маркировката identity_match_status остава pending_verification: общото име не доказва еднакъв производител или физическо изпълнение. Архивът позволява възстановяване на първоначалните записи.

${table(['SKU','Артикул','Нужна проверка'],identity.map(p=>[p.sku,p.name,p._internal.identity_review]))}

## Ultra Bee, Storm Bee и съвместимост

Има отделни страници /models/light-bee-x, /models/light-bee-s, /models/ultra-bee и /models/storm-bee, начални моделни карти, навигация и филтри. Ultra Bee има 11 съвместими Facebook артикула. В проверения източник няма изрично заявени продукти за Storm Bee; страницата е възстановена с честно празно състояние и връзка за запитване. Съвместимостта не се пренася по сходна снимка, функция или универсално означение. Изричните модели са твърдения в публичните обяви, а не независима производителска сертификация.

${table(['SKU','Артикул','Защо е архивиран'],excluded.map(p=>[p.sku,p.name,p._internal.excluded_reason==='specific_model_unconfirmed'?'Не е потвърден конкретен модел.':'Изрично е за Talaria, не за поддържан Sur-Ron.']))}

## Снимки и оригинални описания

Не са сваляни или използвани снимки от SurRon FANS. Проверени са 170 артикула в официалния каталог, 9 категории, GUTS, официални Ultra Bee/Storm Bee галерии и целеви алтернативи. За 40 продукта има конкретни кандидати с URL, брой/размери на изображенията и референтни производителски номера. Няма снимка с едновременно доказана точна идентичност и разрешение за търговско използване. Не са поставени произволни изображения или генерирани несъществуващи ракурси. Всеки от 106-те продукта има задача за 3–5 точни ракурса и съответните варианти.

Подробности: product-images/image-research-2026-11-02.json и .md. Кандидатите не са готови магазинни снимки. Например официален диск 203 mm не се използва за обявен диск 200 или 250 mm; ремък 560-8m не доказва производител/ширина. Снимките от по-ранния собствен OLX каталог са запазени за съществуващите продукти и не се представят като нови изображения на Facebook частите.

Българските описания и SEO текстове са съставени за THERRIDE, без копиране на разказния текст на продавача. Не се добавят непотвърдени размери, сплави, OEM произход, електрически параметри или моменти на затягане. Карбонова визия не се представя като карбонов композит.

## Проверки и публикуване

- 43 автоматични теста: цени EUR/BGN, всички източници, CSV, повторен импорт, ID/варианти, количка, филтри, четири моделни страници и приоритет на администраторските редакции.
- Готов production build: 164 страници + 404, 147 действителни продуктови карти и всички 103 нови продуктови адреса.
- Браузърна проверка на реалния сайт в средата за преглед: 147 карти; Ultra Bee 11; Storm Bee 0 с правилно празно състояние; търсене на гумения предпазител → 1 резултат; синьо + до 50 EUR → 11 резултата; вариант на Ultra Bee калник сменя цената 35.00 → 40.00 EUR.
- CSV: 137 реда, 30 колони, UTF-8 BOM, обратно прочитане и съпоставка с JSON.
- GitHub проект: https://github.com/venata3vh-code/Therride. Netlify настройките използват npm run build и dist/. Включен е и готов статичен пакет за директно Netlify качване.
- Netlify deployment не е изпълнен: изборът за Google вход беше направен, но следващата защитена заявка за вход беше отказана. Не са искани пароли в чата.
- Supabase advisor няма нови критични находки. Двете частни таблици са затворени без клиентски RLS политики по замисъл. Предварително съществуваща Auth настройка за защита от компрометирани пароли остава изключена.
- Автоматичната проверка спря Supabase CLI при опит за аналитична телеметрия. Миграцията и проверките са изпълнени чрез избрания Supabase plugin; CLI операцията не е повтаряна.

## Всички обработени публикации

${table(['№','Публикация','Наблюдавана дата','Оригинални цени','SKU','Резултат'],ledger)}

## Всички варианти и изчислени цени

${table(['SKU продукт','SKU вариант','Артикул','Вариант','Оригинална цена','THERRIDE цена','Начално количество','Наличност потвърдена','Моделен обхват','Източник №'],variants)}
`;
await fs.writeFile('import-report.md',report);
console.log(JSON.stringify({report_sources:ledger.length,report_variants:variants.length,existing_matches:matches.length,image_tasks:db.products.length}));
