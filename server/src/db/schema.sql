-- ============================================================================
-- Appointment Booking System — PostgreSQL schema
--
-- Conflict prevention strategy (defense in depth):
--   1. Application layer: slot is re-validated inside the booking transaction
--      while holding a per-provider advisory lock (pg_advisory_xact_lock).
--   2. Database layer: a GiST EXCLUSION constraint on (provider_id, time range)
--      makes overlapping active bookings *impossible* to persist, even if the
--      application layer is bypassed or buggy. This is the last line of defense.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Range type over TIME (Postgres ships tstzrange but not a time-of-day range)
DO $$ BEGIN
  CREATE TYPE timerange AS RANGE (subtype = time);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------- admin users
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name          TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------- providers
-- A provider is a bookable campus resource.
CREATE TABLE IF NOT EXISTS providers (
  id                   SERIAL PRIMARY KEY,
  resource_type        TEXT NOT NULL CHECK (resource_type IN ('study_room', 'meeting_room', 'equipment')),
  name                 TEXT NOT NULL,
  title                TEXT NOT NULL DEFAULT '',        -- e.g. "Cardiologist", "Senior Stylist", "5-a-side football"
  bio                  TEXT NOT NULL DEFAULT '',
  emoji                TEXT NOT NULL DEFAULT '📅',
  color                TEXT NOT NULL DEFAULT '#6366f1',
  slot_step_min        INT  NOT NULL DEFAULT 15 CHECK (slot_step_min BETWEEN 5 AND 120),
  min_lead_min         INT  NOT NULL DEFAULT 60 CHECK (min_lead_min >= 0),      -- bookings must be at least this far in the future
  booking_horizon_days INT  NOT NULL DEFAULT 30 CHECK (booking_horizon_days BETWEEN 1 AND 365),
  reschedule_cutoff_min INT NOT NULL DEFAULT 120 CHECK (reschedule_cutoff_min >= 0), -- customers may self-reschedule until this close to start
  active               BOOLEAN NOT NULL DEFAULT TRUE,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE providers ADD COLUMN IF NOT EXISTS reschedule_cutoff_min INT NOT NULL DEFAULT 120 CHECK (reschedule_cutoff_min >= 0);

-- ------------------------------------------------------------------ services
CREATE TABLE IF NOT EXISTS services (
  id             SERIAL PRIMARY KEY,
  provider_id    INT NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  description    TEXT NOT NULL DEFAULT '',
  duration_min   INT NOT NULL CHECK (duration_min BETWEEN 5 AND 480),
  buffer_min     INT NOT NULL DEFAULT 0 CHECK (buffer_min BETWEEN 0 AND 120),  -- prep/cleanup gap enforced around bookings
  active         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_services_provider ON services(provider_id);

-- ------------------------------------------------- weekly recurring schedule
-- Working windows per weekday (0 = Sunday .. 6 = Saturday). A provider may
-- have multiple windows per day (e.g. 09:00-13:00 and 16:00-20:00).
CREATE TABLE IF NOT EXISTS schedules (
  id          SERIAL PRIMARY KEY,
  provider_id INT NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  weekday     INT NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_time  TIME NOT NULL,
  end_time    TIME NOT NULL,
  CHECK (start_time < end_time),
  -- windows on the same weekday must not overlap each other
  CONSTRAINT schedules_no_overlap EXCLUDE USING gist (
    provider_id WITH =,
    weekday     WITH =,
    timerange(start_time, end_time) WITH &&
  )
);
CREATE INDEX IF NOT EXISTS idx_schedules_provider ON schedules(provider_id);

-- Recurring breaks inside working windows (lunch, maintenance, prayer, etc.)
CREATE TABLE IF NOT EXISTS breaks (
  id          SERIAL PRIMARY KEY,
  provider_id INT NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  weekday     INT NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_time  TIME NOT NULL,
  end_time    TIME NOT NULL,
  label       TEXT NOT NULL DEFAULT 'Break',
  CHECK (start_time < end_time)
);
CREATE INDEX IF NOT EXISTS idx_breaks_provider ON breaks(provider_id);

-- One-off unavailability (vacation, sick day, tournament, renovation…)
CREATE TABLE IF NOT EXISTS time_off (
  id          SERIAL PRIMARY KEY,
  provider_id INT NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  starts_at   TIMESTAMPTZ NOT NULL,
  ends_at     TIMESTAMPTZ NOT NULL,
  reason      TEXT NOT NULL DEFAULT '',
  CHECK (starts_at < ends_at)
);
CREATE INDEX IF NOT EXISTS idx_time_off_provider ON time_off(provider_id, starts_at);

-- ----------------------------------------------------------------- customers
CREATE TABLE IF NOT EXISTS customers (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  phone         TEXT NOT NULL DEFAULT '',
  password_hash TEXT,                        -- NULL = guest-only record (no account)
  notes         TEXT NOT NULL DEFAULT '',    -- private admin/CRM notes
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS notes TEXT NOT NULL DEFAULT '';

-- ------------------------------------------------------------------ bookings
CREATE TABLE IF NOT EXISTS bookings (
  id           SERIAL PRIMARY KEY,
  code         TEXT NOT NULL UNIQUE,                    -- short human-friendly reference, e.g. BK-7F3K2A
  provider_id  INT NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  service_id   INT NOT NULL REFERENCES services(id),
  customer_id  INT NOT NULL REFERENCES customers(id),
  starts_at    TIMESTAMPTZ NOT NULL,
  ends_at      TIMESTAMPTZ NOT NULL,
  status       TEXT NOT NULL DEFAULT 'confirmed'
               CHECK (status IN ('confirmed', 'completed', 'cancelled', 'no_show')),
  notes        TEXT NOT NULL DEFAULT '',
  cancel_token UUID NOT NULL DEFAULT gen_random_uuid(),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (starts_at < ends_at),

  -- THE conflict-prevention constraint. Two bookings for the same provider
  -- whose [starts_at, ends_at) ranges overlap cannot both be active.
  -- cancelled and no-show bookings are excluded so their slots are released.
  CONSTRAINT bookings_no_overlap EXCLUDE USING gist (
    provider_id WITH =,
    tstzrange(starts_at, ends_at) WITH &&
  ) WHERE (status IN ('confirmed', 'completed'))
);
CREATE INDEX IF NOT EXISTS idx_bookings_provider_time ON bookings(provider_id, starts_at);
CREATE INDEX IF NOT EXISTS idx_bookings_customer ON bookings(customer_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
/* Legacy payment, refund, coupon and loyalty definitions were removed.
   The migration below drops these objects from existing databases. */
/*
-- ------------------------------------------------------------------ payments
CREATE TABLE IF NOT EXISTS payments (
  id           SERIAL PRIMARY KEY,
  booking_id   INT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  provider     TEXT NOT NULL CHECK (provider IN ('mock', 'razorpay')),
  order_id     TEXT NOT NULL UNIQUE,               -- gateway order id (mock_order_…)
  payment_id   TEXT,                               -- gateway payment id, set on capture
  amount_cents INT  NOT NULL CHECK (amount_cents > 0),   -- INR paise
  currency     TEXT NOT NULL DEFAULT 'INR',
  status       TEXT NOT NULL DEFAULT 'created'
               CHECK (status IN ('created', 'captured', 'partially_refunded', 'refunded', 'failed')),
  method       TEXT NOT NULL DEFAULT '',
  error        TEXT NOT NULL DEFAULT '',
  raw          JSONB NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_payments_booking ON payments(booking_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
-- one live (non-failed) payment attempt per booking; retries reuse the order
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_booking_live ON payments(booking_id) WHERE status <> 'failed';

-- ------------------------------------------------------------------- refunds
CREATE TABLE IF NOT EXISTS refunds (
  id                 SERIAL PRIMARY KEY,
  payment_id         INT NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  provider_refund_id TEXT NOT NULL,
  amount_cents       INT NOT NULL CHECK (amount_cents > 0),
  reason             TEXT NOT NULL DEFAULT '',       -- customer_cancel | admin_cancel | admin_manual | expired_capture
  status             TEXT NOT NULL DEFAULT 'processed' CHECK (status IN ('pending', 'processed', 'failed')),
  raw                JSONB NOT NULL DEFAULT '{}',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_refunds_payment ON refunds(payment_id);

-- ------------------------------------------------------------------- coupons
CREATE TABLE IF NOT EXISTS coupons (
  id               SERIAL PRIMARY KEY,
  code             TEXT NOT NULL UNIQUE,             -- stored uppercase
  type             TEXT NOT NULL CHECK (type IN ('percent', 'fixed')),
  value            INT  NOT NULL CHECK (value > 0),  -- percent (1-100) or paise
  max_uses         INT,                              -- NULL = unlimited
  used_count       INT  NOT NULL DEFAULT 0 CHECK (used_count >= 0),
  min_amount_cents INT  NOT NULL DEFAULT 0,
  valid_from       TIMESTAMPTZ,
  valid_to         TIMESTAMPTZ,
  active           BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (type <> 'percent' OR value <= 100)
);

-- ------------------------------------------------------------ loyalty points
-- Append-only ledger; balance = sum(points). The partial unique index makes
-- earn/reverse idempotent per booking even under admin retries.
CREATE TABLE IF NOT EXISTS loyalty_ledger (
  id          SERIAL PRIMARY KEY,
  customer_id INT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  booking_id  INT REFERENCES bookings(id) ON DELETE SET NULL,
  points      INT NOT NULL,                -- positive = earn, negative = redeem
  reason      TEXT NOT NULL CHECK (reason IN ('earned_completed', 'redeemed', 'redemption_reversed', 'admin_adjust')),
  detail      TEXT NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_loyalty_customer ON loyalty_ledger(customer_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_loyalty_booking_reason
  ON loyalty_ledger(booking_id, reason) WHERE booking_id IS NOT NULL;

*/
-- ------------------------------------------------------------ booking series
-- A weekly/biweekly run of bookings. Occurrences are ordinary bookings rows
-- (constraint, reminders, cancellation all work untouched) linked by series_id.
CREATE TABLE IF NOT EXISTS booking_series (
  id          SERIAL PRIMARY KEY,
  code        TEXT NOT NULL UNIQUE,                    -- SR-XXXXXX
  provider_id INT NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  service_id  INT NOT NULL REFERENCES services(id),
  customer_id INT NOT NULL REFERENCES customers(id),
  frequency   TEXT NOT NULL CHECK (frequency IN ('weekly', 'biweekly')),
  occurrences INT NOT NULL CHECK (occurrences BETWEEN 2 AND 12),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS series_id INT REFERENCES booking_series(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_bookings_series ON bookings(series_id) WHERE series_id IS NOT NULL;

-- ------------------------------------------------------------------ waitlist
CREATE TABLE IF NOT EXISTS waitlist (
  id          SERIAL PRIMARY KEY,
  provider_id INT NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  service_id  INT NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  date        DATE NOT NULL,
  name        TEXT NOT NULL,
  email       TEXT NOT NULL,
  phone       TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'waiting'
              CHECK (status IN ('waiting', 'notified', 'converted', 'expired')),
  token       UUID NOT NULL DEFAULT gen_random_uuid(),
  notified_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider_id, service_id, date, email)        -- no duplicate joins
);
CREATE INDEX IF NOT EXISTS idx_waitlist_match ON waitlist(provider_id, date, status);

-- ------------------------------------------------------------------- reviews
-- One review per booking, only for completed bookings (enforced in the API).
-- provider_id/customer_id are denormalized from the booking row (never taken
-- from client input) so rating aggregates stay one cheap indexed query.
CREATE TABLE IF NOT EXISTS reviews (
  id          SERIAL PRIMARY KEY,
  booking_id  INT NOT NULL UNIQUE REFERENCES bookings(id) ON DELETE CASCADE,
  provider_id INT NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  customer_id INT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  rating      INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment     TEXT NOT NULL DEFAULT '',
  hidden      BOOLEAN NOT NULL DEFAULT FALSE,   -- admin moderation
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reviews_provider_visible ON reviews(provider_id) WHERE NOT hidden;

-- ----------------------------------------------------------------- favorites
CREATE TABLE IF NOT EXISTS favorites (
  customer_id INT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  provider_id INT NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (customer_id, provider_id)
);

-- ------------------------------------------------------- notification outbox
-- Every outbound message (confirmations, cancellations, reminders, waitlist
-- pings…) is a row here. An in-process dispatcher claims due rows with
-- FOR UPDATE SKIP LOCKED and delivers them, so email gets retries with
-- backoff, an audit trail, idempotent enqueues, and survives restarts.
CREATE TABLE IF NOT EXISTS notifications (
  id              SERIAL PRIMARY KEY,
  booking_id      INT REFERENCES bookings(id) ON DELETE CASCADE,
  waitlist_id     INT,                        -- FK attached next to the waitlist table
  channel         TEXT NOT NULL DEFAULT 'email' CHECK (channel IN ('email', 'sms', 'whatsapp')),
  template        TEXT NOT NULL CHECK (template IN
                    ('confirmation', 'cancellation', 'rescheduled',
                     'reminder_24h', 'reminder_1h', 'waitlist_slot_open',
                     'series_summary', 'series_cancelled')),
  recipient       TEXT NOT NULL,
  payload         JSONB NOT NULL DEFAULT '{}',        -- template extras; content renders at send time
  scheduled_for   TIMESTAMPTZ NOT NULL DEFAULT now(),
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(), -- backoff cursor
  attempts        INT NOT NULL DEFAULT 0,
  last_error      TEXT NOT NULL DEFAULT '',
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'void')),
  sent_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (booking_id IS NOT NULL OR waitlist_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_notifications_due ON notifications(next_attempt_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_notifications_booking ON notifications(booking_id);
-- one live reminder of each kind per booking per channel (idempotent enqueue;
-- rescheduling voids old reminders so fresh ones can be enqueued)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_notifications_reminder
  ON notifications(booking_id, channel, template)
  WHERE template IN ('reminder_24h', 'reminder_1h') AND status <> 'void';
DO $$ BEGIN
  ALTER TABLE notifications ADD CONSTRAINT notifications_waitlist_fk
    FOREIGN KEY (waitlist_id) REFERENCES waitlist(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ------------------------------------------------------------------ audit log
CREATE TABLE IF NOT EXISTS booking_events (
  id         SERIAL PRIMARY KEY,
  booking_id INT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  event      TEXT NOT NULL,          -- created | cancelled | completed | no_show | email_sent …
  actor      TEXT NOT NULL,          -- 'customer' | 'admin:<email>' | 'system'
  detail     TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_booking_events_booking ON booking_events(booking_id);

-- ------------------------------------------------------------------ campus migration
-- The original demo used doctors, payments, coupons and loyalty points. The
-- product is now a campus resource reservation platform. Keep this migration
-- idempotent so existing local databases move to the new model safely.
ALTER TABLE providers ADD COLUMN IF NOT EXISTS resource_type TEXT;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'providers' AND column_name = 'business_type') THEN
    UPDATE providers
    SET resource_type = CASE business_type
      WHEN 'doctor' THEN 'study_room'
      WHEN 'salon' THEN 'meeting_room'
      WHEN 'turf' THEN 'equipment'
      ELSE 'study_room'
    END
    WHERE resource_type IS NULL;
  END IF;
END $$;

-- Migrate the bundled demo catalog without touching user-created resources.
UPDATE providers SET name = '静心自习室 A', title = '安静学习空间',
  bio = '适合个人学习、考研备考和专注办公，提供稳定网络、插座与自然采光。'
WHERE name = 'Asha Rao 医生';
UPDATE providers SET name = '图书馆研习室 B', title = '小组研习空间',
  bio = '靠近图书馆与教学楼，适合课程讨论、论文写作和安静自习。'
WHERE name = 'Kabir Mehta 医生';
UPDATE providers SET name = '创新会议室 1', title = '小组会议与路演空间',
  bio = '配备投影、白板和可移动桌椅，适合课程展示、社团会议和项目路演。'
WHERE name = 'Meera @ Glow 美发工作室';
UPDATE providers SET name = '社团活动室 2', title = '社团活动与面试空间',
  bio = '适合学生组织活动、招聘面试和小型工作坊，支持灵活布置。'
WHERE name = 'Arjun @ FadeLab 理发店';
UPDATE providers SET name = '电子实验室', title = '电子与嵌入式设备',
  bio = '提供示波器、万用表和开发板，适合课程实验与学生项目开发。'
WHERE name = 'GreenKick 体育馆 — 场地 1';
UPDATE providers SET name = '摄影与创作设备室', title = '影像与内容创作设备',
  bio = '提供相机、灯光和录音设备，适合课程作业、校园活动记录与作品创作。'
WHERE name = 'SmashPoint — 羽毛球场 2';
UPDATE services s SET name = CASE s.name
    WHEN '初诊咨询' THEN '单人学习座位'
    WHEN '复诊' THEN '小组学习桌'
    WHEN '心脏超声筛查' THEN '专注学习时段'
  END,
  description = CASE s.name
    WHEN '初诊咨询' THEN '独立座位、插座与高速网络'
    WHEN '复诊' THEN '适合 2—4 人协作学习'
    WHEN '心脏超声筛查' THEN '连续 3 小时安静学习空间'
  END
FROM providers p WHERE s.provider_id = p.id AND p.name = '静心自习室 A'
  AND s.name IN ('初诊咨询', '复诊', '心脏超声筛查');
UPDATE services s SET name = CASE s.name
    WHEN '问诊' THEN '单人研习位'
    WHEN '化学换肤' THEN '小组研讨桌'
    WHEN '痣 / 皮赘去除' THEN '论文冲刺时段'
  END,
  description = CASE s.name
    WHEN '问诊' THEN '带台灯与储物柜的学习座位'
    WHEN '化学换肤' THEN '白板与投屏设备齐全'
    WHEN '痣 / 皮赘去除' THEN '适合集中完成课程任务'
  END
FROM providers p WHERE s.provider_id = p.id AND p.name = '图书馆研习室 B'
  AND s.name IN ('问诊', '化学换肤', '痣 / 皮赘去除');
UPDATE services s SET name = CASE s.name
    WHEN '剪发与吹风造型' THEN '课程项目讨论'
    WHEN '全头染发' THEN '社团例会'
    WHEN '新娘妆试妆' THEN '项目路演彩排'
    WHEN '快速修剪' THEN '面试模拟间'
  END,
  description = CASE s.name
    WHEN '剪发与吹风造型' THEN '投影、白板与 8 人座位'
    WHEN '全头染发' THEN '可移动桌椅与会议屏幕'
    WHEN '新娘妆试妆' THEN '大屏、音响与演示空间'
    WHEN '快速修剪' THEN '适合模拟面试与小型答辩'
  END
FROM providers p WHERE s.provider_id = p.id AND p.name = '创新会议室 1'
  AND s.name IN ('剪发与吹风造型', '全头染发', '新娘妆试妆', '快速修剪');
UPDATE services s SET name = CASE s.name
    WHEN '净肤渐变 + 胡须' THEN '招聘面试'
    WHEN '经典理发' THEN '社团工作坊'
    WHEN '热毛巾剃须' THEN '学生组织活动'
  END
FROM providers p WHERE s.provider_id = p.id AND p.name = '社团活动室 2'
  AND s.name IN ('净肤渐变 + 胡须', '经典理发', '热毛巾剃须');
UPDATE services s SET name = CASE s.name
    WHEN '1 小时场地' THEN '基础实验台'
    WHEN '1.5 小时场地' THEN '开发板套装'
    WHEN '2 小时场地' THEN '团队实验时段'
  END
FROM providers p WHERE s.provider_id = p.id AND p.name = '电子实验室'
  AND s.name IN ('1 小时场地', '1.5 小时场地', '2 小时场地');
UPDATE services s SET name = CASE s.name
    WHEN '1 小时球场预约' THEN '相机与灯光套装'
    WHEN '2 小时球场预约' THEN '视频拍摄套装'
  END
FROM providers p WHERE s.provider_id = p.id AND p.name = '摄影与创作设备室'
  AND s.name IN ('1 小时球场预约', '2 小时球场预约');
ALTER TABLE providers DROP COLUMN IF EXISTS business_type;
ALTER TABLE providers ALTER COLUMN resource_type SET DEFAULT 'study_room';
ALTER TABLE providers ALTER COLUMN resource_type SET NOT NULL;
DO $$ BEGIN
  ALTER TABLE providers ADD CONSTRAINT providers_resource_type_check
    CHECK (resource_type IN ('study_room', 'meeting_room', 'equipment'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DROP TABLE IF EXISTS refunds, payments, coupons, loyalty_ledger CASCADE;
ALTER TABLE services DROP COLUMN IF EXISTS price_cents;
ALTER TABLE bookings DROP COLUMN IF EXISTS price_cents;
ALTER TABLE services DROP COLUMN IF EXISTS payment_policy;
ALTER TABLE services DROP COLUMN IF EXISTS deposit_pct;
ALTER TABLE bookings DROP COLUMN IF EXISTS discount_cents;
ALTER TABLE bookings DROP COLUMN IF EXISTS coupon_code;
ALTER TABLE bookings DROP COLUMN IF EXISTS points_redeemed;
ALTER TABLE bookings DROP COLUMN IF EXISTS amount_due_cents;
ALTER TABLE bookings DROP COLUMN IF EXISTS expires_at;
DROP INDEX IF EXISTS idx_bookings_pending_expiry;

UPDATE bookings SET status = 'confirmed' WHERE status = 'pending_payment';
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_status_check;
ALTER TABLE bookings ADD CONSTRAINT bookings_status_check
  CHECK (status IN ('confirmed', 'completed', 'cancelled', 'no_show'));
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_no_overlap;
ALTER TABLE bookings ADD CONSTRAINT bookings_no_overlap EXCLUDE USING gist (
  provider_id WITH =,
  tstzrange(starts_at, ends_at) WITH &&
) WHERE (status IN ('confirmed', 'completed'));

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_template_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_template_check
  CHECK (template IN ('confirmation', 'cancellation', 'rescheduled',
    'reminder_24h', 'reminder_1h', 'waitlist_slot_open', 'series_summary',
    'series_cancelled'));
