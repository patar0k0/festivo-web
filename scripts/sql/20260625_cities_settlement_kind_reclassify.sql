-- 20260625_cities_settlement_kind_reclassify.sql
--
-- Цел: систематична поправка на cities.is_village + затваряне на дупката, която
-- я причини.
--
-- Първопричина (виж 20260321_cities_is_village.sql): колоната беше
-- `boolean NOT NULL DEFAULT false`, т.е. "при липса на класификация → град".
-- Затова всяко място, добавено от workers/admin/poster ingest без изрична
-- класификация, се показваше с "гр.", дори да е село. Backfill-ът от 04.06
-- поправи само ръчно изброен списък, а в него попаднаха и няколко града,
-- сложени по грешка като села.
--
-- Поправка:
--   1) Колоната става NULLABLE с DEFAULT NULL — нов запис без класификация вече
--      няма префикс (по-безопасно от грешен "гр."). NULL = "неизвестно/неприложимо"
--      (курорти, местности). Кодът вече е null-aware (settlementPrefix(null)="").
--   2) Преизчисляване на всички 262 реда срещу авторитетния списък на българските
--      градове (EKATTE/НСИ). Курортните комплекси → NULL.
--
-- Идемпотентно: повторно изпълнение дава същия резултат.

-- ── 1) Schema: позволи NULL, спри default=false ─────────────────────────────
alter table public.cities alter column is_village drop not null;
alter table public.cities alter column is_village drop default;

comment on column public.cities.is_village is
  'true = село (префикс „с."), false = град (префикс „гр."), NULL = неизвестно/неприложимо (курорт, местност) → без префикс';

-- ── 2) Преизчисляване ───────────────────────────────────────────────────────
-- Курорти (нито град, нито село) → NULL
update public.cities set is_village = null
where slug in ('borovets', 'k-k-malyovitsa');

-- Градове → false
update public.cities set is_village = false
where slug in (
  'aytos','antonovo','apriltsi','ardino','asenovgrad','ahtopol','balchik','bansko','batak','belene',
  'belogradchik','blagoevgrad','bolyarovo','brezovo','burgas','byala-cherkva','varna','veliki-preslav','veliko-tarnovo','velingrad',
  'vidin','vratsa','varshets','gabrovo','gorna-oryahovitsa','gramada','devin','devnya','dimitrovgrad','dimovo',
  'dobrich','dobrinishte','dryanovo','dupnitsa','elena','elhovo','etropole','zlatograd','ignatievo','kavarna',
  'kazanlak','kalofer','karlovo','kiten','kozloduy','koprivshtitsa','kostandovo','kostinbrod','kotel','krumovgrad',
  'kran','kubrat','kuklen','kula','kardzhali','kyustendil','levski','lovech','lyaskovets','madan',
  'malko-tarnovo','mezdra','melnik','momchilgrad','montana','nesebar','nikolaevo','novi-pazar','obzor','pavel-banya',
  'pavlikeni','pazardzhik','panagyurishte','pernik','peshtera','pleven','plovdiv','pomorie','popovo','pordim',
  'primorsko','parvomay','radomir','razgrad','ruse','samokov','sandanski','svilengrad','svishtov','svoge',
  'sevlievo','silistra','sliven','smolyan','sozopol','sofia','stara-zagora','tvarditsa','tervel','teteven',
  'troyan','tryavna','tutrakan','targovishte','haskovo','hisarya','tsarevo','chirpan','shumen','yambol'
);

-- Всичко останало (което не е курорт и не е град) → село
update public.cities set is_village = true
where slug not in ('borovets', 'k-k-malyovitsa')
  and slug not in (
  'aytos','antonovo','apriltsi','ardino','asenovgrad','ahtopol','balchik','bansko','batak','belene',
  'belogradchik','blagoevgrad','bolyarovo','brezovo','burgas','byala-cherkva','varna','veliki-preslav','veliko-tarnovo','velingrad',
  'vidin','vratsa','varshets','gabrovo','gorna-oryahovitsa','gramada','devin','devnya','dimitrovgrad','dimovo',
  'dobrich','dobrinishte','dryanovo','dupnitsa','elena','elhovo','etropole','zlatograd','ignatievo','kavarna',
  'kazanlak','kalofer','karlovo','kiten','kozloduy','koprivshtitsa','kostandovo','kostinbrod','kotel','krumovgrad',
  'kran','kubrat','kuklen','kula','kardzhali','kyustendil','levski','lovech','lyaskovets','madan',
  'malko-tarnovo','mezdra','melnik','momchilgrad','montana','nesebar','nikolaevo','novi-pazar','obzor','pavel-banya',
  'pavlikeni','pazardzhik','panagyurishte','pernik','peshtera','pleven','plovdiv','pomorie','popovo','pordim',
  'primorsko','parvomay','radomir','razgrad','ruse','samokov','sandanski','svilengrad','svishtov','svoge',
  'sevlievo','silistra','sliven','smolyan','sozopol','sofia','stara-zagora','tvarditsa','tervel','teteven',
  'troyan','tryavna','tutrakan','targovishte','haskovo','hisarya','tsarevo','chirpan','shumen','yambol'
);
