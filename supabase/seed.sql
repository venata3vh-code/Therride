-- Catalog recovered from the supplied theme and public product export.
-- Price preserved at EUR 15.40. No invented materials or stock counts.
insert into public.products(slug,name,subtitle,description,size_label,price_cents,category,colors,images,specs,stock_quantity,is_active,featured,sort_order) values('red-bull-250','Държач за кен 250 мл','За малкия кен. И големите планове.','Дръж напитката си на място върху мотора, велосипеда или тротинетката. Този размер е за тесни кенове 250 мл, като Red Bull и Hell.

Постави кена в държача до захващане. За да го освободиш, отдръпни внимателно лостчето — не издърпвай кена със сила.

Държачът се закрепва към подходяща повърхност с двустранна лента или винтове. Избери място, което не пречи на управлението и движението.','250 мл',1540,'Държачи за кенове',ARRAY['Черно','Бяло','Зелено','Червено','Синьо','Розово','Лилаво','Жълто','Оранжево','Бежово'],'[{"url":"/images/IMG_0106.jpg","alt":"Лилав държач THERRIDE с кен Red Bull 250 мл","color":"Лилаво"},{"url":"/images/IMG_0127.jpg","alt":"Детайл на държача за кен 250 мл","color":""}]'::jsonb,'{"country":"България","mounting":"Двустранна лента или винтове","material":"","dimensions":"","included":""}'::jsonb,null,true,true,0) on conflict(slug) do nothing;
insert into public.products(slug,name,subtitle,description,size_label,price_cents,category,colors,images,specs,stock_quantity,is_active,featured,sort_order) values('monster-500','Държач за кен 500 мл','Повече напитка. Същата свобода.','За по-големите кенове 500 мл, като Monster. Български държач за твоето каране — напитката е закрепена, а ръцете остават за управлението.

Закрепи държача към подходяща повърхност с двустранна лента или винтове. Провери стабилността преди всяко каране.

При изваждане използвай освобождаващото лостче. Формата на кена има значение — провери съвместимостта преди поръчка.','500 мл',1540,'Държачи за кенове',ARRAY['Черно','Бяло','Зелено','Червено','Синьо','Розово','Лилаво','Жълто','Оранжево','Бежово'],'[{"url":"/images/IMG_0142.jpg","alt":"Зелен държач THERRIDE с кен Monster 500 мл","color":"Зелено"},{"url":"/images/IMG_0145.jpg","alt":"Детайл на държача за кен 500 мл","color":""}]'::jsonb,'{"country":"България","mounting":"Двустранна лента или винтове","material":"","dimensions":"","included":""}'::jsonb,null,true,true,1) on conflict(slug) do nothing;
insert into public.products(slug,name,subtitle,description,size_label,price_cents,category,colors,images,specs,stock_quantity,is_active,featured,sort_order) values('slim-330','Държач за кен 330 мл — Slim','За високия и тесен кен.','Размер за високите и тесни кенове 330 мл, например съответните разфасовки на Coca-Cola, Sprite и Fanta.

Slim е различен от ниския и широк 330 мл. Сравни формата на своя кен със снимката, преди да избереш.

Монтаж на държача с двустранна лента или винтове. Кенът се поставя в захвата и се освобождава чрез лостчето.','330 мл · висок',1540,'Държачи за кенове',ARRAY['Черно','Бяло','Зелено','Червено','Синьо','Розово','Лилаво','Жълто','Оранжево','Бежово'],'[{"url":"/images/IMG_0164.jpg","alt":"Бял държач THERRIDE с висок кен Coca-Cola 330 мл","color":"Бяло"},{"url":"/images/IMG_0169.jpg","alt":"Детайл на държача Slim 330 мл","color":""}]'::jsonb,'{"country":"България","mounting":"Двустранна лента или винтове","material":"","dimensions":"","included":""}'::jsonb,null,true,true,2) on conflict(slug) do nothing;
insert into public.products(slug,name,subtitle,description,size_label,price_cents,category,colors,images,specs,stock_quantity,is_active,featured,sort_order) values('stubby-330','Държач за кен 330 мл — Stubby','За ниския и широк кен.','Размер за ниските и широки кенове 330 мл. Подходящата форма е важна — този модел е различен от високия и тесен Slim.

Избери цвят, закрепи държача с двустранна лента или винтове и провери стабилността преди потегляне.

За освобождаване на напитката използвай лостчето в края на държача. Не издърпвай кена със сила.','330 мл · нисък',1540,'Държачи за кенове',ARRAY['Черно','Бяло','Зелено','Червено','Синьо','Розово','Лилаво','Жълто','Оранжево','Бежово'],'[{"url":"/images/IMG_0131.jpg","alt":"Син държач THERRIDE с нисък и широк кен 330 мл","color":"Синьо"},{"url":"/images/IMG_0116.jpg","alt":"Детайл на държача Stubby 330 мл","color":""}]'::jsonb,'{"country":"България","mounting":"Двустранна лента или винтове","material":"","dimensions":"","included":""}'::jsonb,null,true,true,3) on conflict(slug) do nothing;

