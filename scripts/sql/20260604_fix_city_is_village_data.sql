-- Fix is_village for all cities in the database.
-- Root cause: is_village defaults to false, so every new city added via workers
-- or admin was incorrectly marked as "гр." regardless of actual settlement type.
--
-- Classification based on Bulgarian NSI EKATTE registry (as of 2025).
-- Resort complexes (к.к.) are left as false because the column has no NULL option;
-- their name_bg already carries the "к.к." prefix so the "гр." prefix compounds incorrectly
-- but that is a pre-existing UI concern handled separately.

-- ── Villages (с.) ─────────────────────────────────────────────────────────────
update public.cities set is_village = true where slug in (
  'arbanasi',               -- с. Арбанаси, Велико Търново
  'basarbovo',              -- с. Басарбово, Русе
  'belashtitsa',            -- с. Белащица, Пловдив
  'borisovo',               -- с. Борисово
  'bratya-kunchevi',        -- с. Братя Кунчеви, Пловдив
  'butan',                  -- с. Бутан, Враца
  'balgarevo',              -- с. Българево, Каварна
  'venets',                 -- с. Венец, Шумен
  'vetrintsi',              -- с. Ветринци, Велико Търново
  'vrabevo',                -- с. Врабево, Ловеч
  'gara-oreshets',          -- с. Гара Орешец, Враца
  'garvan',                 -- с. Гарван, Силистра
  'general-kantardzhievo',  -- с. Генерал Кантарджиево, Варна
  'georgi-damyanovo',       -- с. Георги Дамяново, Монтана
  'grancharovo',            -- с. Грънчарово, Добрич
  'debrene',                -- с. Дебрене, Добрич
  'dobrinishte',            -- с. Добринище, Банско
  'dolni-okol',             -- с. Долни Окол, София (провинция)
  'dolno-kamartsi',         -- с. Долно Камарци, Елин Пелин
  'dolno-ozirovo',          -- с. Долно Озирово, Берковица
  'dositeevo',              -- с. Доситеево, Хасково
  'dospey',                 -- с. Доспей, Самоков
  'drangovo',               -- с. Дрангово, Пловдив
  'dren',                   -- с. Дрен, Земен
  'zhaltesh',               -- с. Жълтеш, Стара Загора
  'zhitnitsa',              -- с. Житница, Карлово
  'zaychino-oreshe',        -- с. Зайчино ореше, Нова Загора
  'zamfirovo',              -- с. Замфирово, Берковица
  'zverino',                -- с. Зверино, Роман
  'ignatievo',              -- с. Игнатиево, Варна
  'izbeglii',               -- с. Избеглии, Самоков
  'iskrets',                -- с. Искрец, Своге
  'kaynardzha',             -- с. Кайнарджа, Силистра
  'kapitanovtsi',           -- с. Капитановци, Монтана
  'kladnitsa',              -- с. Кладница, Перник
  'kliment',                -- с. Климент, Шумен
  'koilovtsi',              -- с. Коиловци, Плевен
  'kostandovo',             -- с. Костандово, Ракитово
  'kostievo',               -- с. Костиево, Пловдив
  'kraynitsi',              -- с. Крайници, Кюстендил
  'kranevo',                -- с. Кранево, Балчик
  'krasen',                 -- с. Красен, Ловеч
  'kremikovtsi',            -- с. Кремиковци, София
  'kran',                   -- с. Крън, Казанлък
  'lesidren',               -- с. Лесидрен, Ловеч
  'lozen',                  -- с. Лозен, София
  'lozenets',               -- с. Лозенец, Созопол
  'lokorsko',               -- с. Локорско, Нови Искър
  'lyubenovo',              -- с. Любеново, Пазарджик
  'mechka',                 -- с. Мечка, Плевен
  'mechkarevo',             -- с. Мечкарево, Сливен
  'mladen',                 -- с. Младен, Ловеч
  'nikolovo',               -- с. Николово, Русе
  'novo-panicharevo',       -- с. Ново Паничарево, Царево
  'obedinenie',             -- с. Обединение, Пловдив
  'osenets',                -- с. Осенец, Разград
  'pavel-banya',            -- с. Павел баня, Казанлък
  'patalenitsa',            -- с. Паталеница, Пазарджик
  'patriarh-evtimovo',      -- с. Патриарх Евтимово, Пловдив
  'pelevun',                -- с. Пелевун, Кърджали
  'pisanets',               -- с. Писанец, Разград
  'polkovnik-serafimovo',   -- с. Полковник Серафимово, Смолян
  'parvenets',              -- с. Първенец, Пловдив
  'ravno-pole',             -- с. Равно поле, Елин Пелин
  'ravnogor',               -- с. Равногор, Брацигово
  'radovets',               -- с. Радовец, Ивайловград
  'rogosh',                 -- с. Рогош, Пловдив
  'sandrovo',               -- с. Сандрово, Русе
  'skobelevo',              -- с. Скобелево, Пловдив
  'slavyanovo',             -- с. Славяново, Плевен
  'slanchevo',              -- с. Слънчево, Айтос
  'smilyan',                -- с. Смилян, Смолян
  'svoboda',                -- с. Свобода, Нова Загора
  'starozagorski-bani',     -- с. Старозагорски бани, Стара Загора
  'startsevo',              -- с. Старцево, Ивайловград
  'stefanovo',              -- с. Стефаново
  'stoykite',               -- с. Стойките, Смолян
  'stoletovo',              -- с. Столетово, Казанлък
  'trudovets',              -- с. Трудовец, Ботевград
  'tsaratsovo',             -- с. Царацово, Пловдив
  'tsarevets',              -- с. Царевец, Велико Търново
  'chavdar',                -- с. Чавдар
  'chelopech',              -- с. Челопеч, Антон
  'chilno',                 -- с. Чилно, Тервел
  'chilnov',                -- с. Чилнов
  'chuprene',               -- с. Чупрене, Видин
  'yuper',                  -- с. Юпер, Ловеч
  'yavorovo'                -- с. Яворово
);

-- ── Verify counts after update ────────────────────────────────────────────────
-- Expected: ~88 villages, ~111 cities
-- select is_village, count(*) from public.cities group by is_village;
