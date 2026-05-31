-- Outreach email templates — admin-managed templates for organizer outreach campaigns.
-- Used in /admin/organizers/[id]/edit "✉ Покани" modal to pre-fill subject + body.

CREATE TABLE IF NOT EXISTS outreach_email_templates (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL,
  subject     text        NOT NULL DEFAULT '',
  body        text        NOT NULL DEFAULT '',
  sort_order  integer     NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Only admins (service role) access this table.
ALTER TABLE outreach_email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "no_public_access" ON outreach_email_templates
  FOR ALL USING (false);

-- Seed with three starter templates
INSERT INTO outreach_email_templates (name, subject, body, sort_order) VALUES (
  'Народни читалища',
  'Festivo.bg — фестивалите на вашето читалище вече са онлайн',
  'Здравейте,

Казвам се Борислав — направих Festivo.bg, сайт за фестивали в България. Исках да има едно място, откъдето хората да намират местни събори, фолклорни фестивали и градски празници — неща, за които иначе научаваш само ако случайно минеш покрай плакат.

Фестивалите на {{organizerName}} вече са там:

{{festivalList}}

Хората, които намерят вашия фестивал, могат да го запазят в „Моят план" и получават напомняне преди началото — полезно, защото такива неща лесно се забравят.

Ако поемете профила си, можете сами да редактирате информацията, да добавяте снимки и да виждате колко души са проявили интерес. Процесът е бърз:
{{claimUrl}}

За тази година давам безплатен VIP статус на читалища — по-добро класиране в сайта и малка отличителна значка. Без скрити условия.

Ако имате въпроси — пишете ми директно на този имейл.

Борислав
b.yakov@festivo.bg',
  10
), (
  'Общини и кметства',
  'Festivo.bg — местните ви фестивали вече са видими за цяла България',
  'Здравейте,

Казвам се Борислав — направих Festivo.bg, сайт за фестивали в България.

Фестивалите на {{organizerName}} вече са там:

{{festivalList}}

Много хора използват сайта, когато планират почивни дни и търсят какво се случва по региони. Когато намерят интересно събитие, го запазват в „Моят план" и получават напомняне преди началото.

Ако поемете профила си, можете да редактирате информацията и да добавяте нови фестивали. Ето линкът:
{{claimUrl}}

За тази година давам безплатен VIP статус на общини и кметства — по-добро класиране и отличителна значка на профила. Без никакви условия.

Ако имате въпроси — пишете ми.

Борислав
b.yakov@festivo.bg',
  20
), (
  'Общ шаблон',
  'Festivo.bg — намерих вашите фестивали',
  'Здравейте,

Казвам се Борислав — направих Festivo.bg, сайт за фестивали в България.

Фестивалите на {{organizerName}} вече са в сайта:

{{festivalList}}

Хората могат да ги намерят, да ги запазят и да получат напомняне преди началото.

Ако искате да управлявате профила си — редакция, снимки, нови фестивали — може да го поемете оттук:
{{claimUrl}}

За тази година давам безплатен VIP статус на по-малките организатори. Пишете ми ако имате въпроси.

Борислав
b.yakov@festivo.bg',
  30
);
