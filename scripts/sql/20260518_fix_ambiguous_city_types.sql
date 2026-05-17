-- Fix is_village for the 12 ambiguous settlements that the EKATTE script could not
-- resolve automatically (same name exists as both city and village in different regions).
-- Resolved manually based on well-known Bulgarian geography.

update public.cities set is_village = false where slug in (
  'първомай',   -- гр. Първомай, обл. Пловдив
  'dobrich',    -- гр. Добрич, областен град
  'gabrovo',    -- гр. Габрово, областен град
  'razgrad',    -- гр. Разград, областен град
  'targovishte',-- гр. Търговище, областен град
  'elena',      -- гр. Елена, обл. Велико Търново
  'troyan',     -- гр. Троян, обл. Ловеч
  'apriltsi',   -- гр. Априлци, обл. Ловеч
  'kiten',      -- гр. Китен, обл. Бургас (черноморски курорт)
  'tvarditsa',  -- гр. Твърдица, обл. Сливен
  'elhovo'      -- гр. Елхово, обл. Ямбол
);

-- Баня: най-вероятно с. Баня (не гр. Баня, Карловско) — оставяме is_village = true
update public.cities set is_village = true where slug = 'banya';
