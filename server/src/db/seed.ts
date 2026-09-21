import bcrypt from 'bcryptjs';
import { pool } from './pool.js';

/** Wipes business data and inserts a rich demo dataset. */
async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `TRUNCATE notifications, waitlist, reviews, loyalty_ledger, favorites, refunds, payments,
                coupons, booking_events, bookings, booking_series, customers, time_off, breaks,
                schedules, services, providers
       RESTART IDENTITY CASCADE`
    );

    // ---- admin user -------------------------------------------------------
    const hash = await bcrypt.hash('admin123', 10);
    await client.query(
      `INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3)
       ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, name = EXCLUDED.name`,
      ['admin@bookit.local', hash, 'Admin']
    );

    // ---- providers --------------------------------------------------------
    type P = {
      type: string; name: string; title: string; bio: string; emoji: string; color: string;
      step: number; lead: number; horizon: number;
      services: [string, string, number, number, number][]; // name, desc, duration, buffer, priceCents
      hours: Record<number, [string, string][]>;            // weekday -> windows
      breaks?: [number, string, string, string][];          // weekday, start, end, label
    };

    const providers: P[] = [
      {
        type: 'doctor', name: 'Asha Rao 医生', title: '心脏科医生', emoji: '🩺', color: '#0ea5e9',
        bio: '拥有 15 年以上预防性心脏病学经验，MBBS、心脏病学 MD。以耐心细致的问诊著称。',
        step: 15, lead: 120, horizon: 21,
        services: [
          ['初诊咨询', '完整病史、检查与心电图解读', 30, 10, 80000],
          ['复诊', '检查报告解读与用药调整', 15, 5, 50000],
          ['心脏超声筛查', '心脏超声检查并当场解读', 45, 15, 250000],
        ],
        hours: { 1: [['09:00', '13:00'], ['17:00', '20:00']], 2: [['09:00', '13:00'], ['17:00', '20:00']], 3: [['09:00', '13:00']], 4: [['09:00', '13:00'], ['17:00', '20:00']], 5: [['09:00', '13:00']], 6: [['10:00', '14:00']] },
        breaks: [[1, '11:00', '11:15', '茶歇'], [2, '11:00', '11:15', '茶歇'], [4, '11:00', '11:15', '茶歇']],
      },
      {
        type: 'doctor', name: 'Kabir Mehta 医生', title: '皮肤科医生', emoji: '🧴', color: '#14b8a6',
        bio: '专注皮肤、头发和指甲问题，皮肤科 MD，拥有美容皮肤科进修经历。',
        step: 20, lead: 60, horizon: 30,
        services: [
          ['问诊', '诊断与治疗方案', 20, 5, 60000],
          ['化学换肤', '包含术后护理套装', 40, 20, 180000],
          ['痣 / 皮赘去除', '局部麻醉下的小型操作', 30, 15, 220000],
        ],
        hours: { 1: [['10:00', '18:00']], 2: [['10:00', '18:00']], 3: [['10:00', '18:00']], 4: [['10:00', '18:00']], 5: [['10:00', '18:00']] },
        breaks: [[1, '13:30', '14:30', '午休'], [2, '13:30', '14:30', '午休'], [3, '13:30', '14:30', '午休'], [4, '13:30', '14:30', '午休'], [5, '13:30', '14:30', '午休']],
      },
      {
        type: 'salon', name: 'Meera @ Glow 美发工作室', title: '资深造型师', emoji: '💇‍♀️', color: '#ec4899',
        bio: '专注染发与新娘造型。在创立 Glow 美发工作室前，曾在 Toni&Guy 工作 10 年。',
        step: 15, lead: 30, horizon: 14,
        services: [
          ['剪发与吹风造型', '咨询、洗发、剪发与造型', 45, 15, 120000],
          ['全头染发', '无氨染发，包含洗发', 90, 15, 350000],
          ['新娘妆试妆', '完整试妆并拍照', 120, 30, 600000],
          ['快速修剪', '日常维护修剪，干剪', 20, 10, 60000],
        ],
        hours: { 0: [['11:00', '17:00']], 2: [['10:00', '20:00']], 3: [['10:00', '20:00']], 4: [['10:00', '20:00']], 5: [['10:00', '20:00']], 6: [['09:00', '21:00']] },
        breaks: [[6, '13:00', '13:45', '午休']],
      },
      {
        type: 'salon', name: 'Arjun @ FadeLab 理发店', title: '理发与造型师', emoji: '💈', color: '#f59e0b',
        bio: '专注精准渐变、胡须修型和热毛巾剃须。不接受临时到店，只接受预约。',
        step: 10, lead: 30, horizon: 14,
        services: [
          ['净肤渐变 + 胡须', '招牌渐变发型与胡须修线', 40, 10, 90000],
          ['经典理发', '剪刀剪发与造型', 30, 10, 60000],
          ['热毛巾剃须', '直剃刀与热毛巾护理', 25, 5, 50000],
        ],
        hours: { 0: [['10:00', '16:00']], 1: [['11:00', '20:00']], 3: [['11:00', '20:00']], 4: [['11:00', '20:00']], 5: [['11:00', '21:00']], 6: [['10:00', '21:00']] },
      },
      {
        type: 'turf', name: 'GreenKick 体育馆 — 场地 1', title: '五人制足球场', emoji: '⚽', color: '#22c55e',
        bio: 'FIFA 认证人造草坪，配备泛光灯和更衣室，最多容纳 12 人。',
        step: 30, lead: 60, horizon: 30,
        services: [
          ['1 小时场地', '整块场地，包含足球', 60, 0, 120000],
          ['1.5 小时场地', '整块场地，包含足球', 90, 0, 170000],
          ['2 小时场地', '整块场地，包含足球和分队背心', 120, 0, 220000],
        ],
        hours: { 0: [['06:00', '23:00']], 1: [['06:00', '23:00']], 2: [['06:00', '23:00']], 3: [['06:00', '23:00']], 4: [['06:00', '23:00']], 5: [['06:00', '23:00']], 6: [['06:00', '23:00']] },
      },
      {
        type: 'turf', name: 'SmashPoint — 羽毛球场 2', title: '室内合成地板球场', emoji: '🏸', color: '#8b5cf6',
        bio: 'BWF 标准合成地板，配备赛事级照明，可租借球拍。',
        step: 30, lead: 30, horizon: 21,
        services: [
          ['1 小时球场预约', '球场与羽毛球（羽毛球另计）', 60, 0, 40000],
          ['2 小时球场预约', '球场与羽毛球（羽毛球另计）', 120, 0, 75000],
        ],
        hours: { 0: [['06:00', '22:00']], 1: [['06:00', '22:00']], 2: [['06:00', '22:00']], 3: [['06:00', '22:00']], 4: [['06:00', '22:00']], 5: [['06:00', '22:00']], 6: [['06:00', '22:00']] },
      },
    ];

    const serviceIds: number[][] = [];
    for (const p of providers) {
      const { rows: [prov] } = await client.query(
        `INSERT INTO providers (business_type, name, title, bio, emoji, color, slot_step_min, min_lead_min, booking_horizon_days)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
        [p.type, p.name, p.title, p.bio, p.emoji, p.color, p.step, p.lead, p.horizon]
      );
      const ids: number[] = [];
      for (const [name, desc, dur, buf, price] of p.services) {
        const { rows: [svc] } = await client.query(
          `INSERT INTO services (provider_id, name, description, duration_min, buffer_min, price_cents)
           VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
          [prov.id, name, desc, dur, buf, price]
        );
        ids.push(svc.id);
      }
      serviceIds.push(ids);
      for (const [weekday, windows] of Object.entries(p.hours)) {
        for (const [start, end] of windows) {
          await client.query(
            `INSERT INTO schedules (provider_id, weekday, start_time, end_time) VALUES ($1,$2,$3,$4)`,
            [prov.id, Number(weekday), start, end]
          );
        }
      }
      for (const [weekday, start, end, label] of p.breaks ?? []) {
        await client.query(
          `INSERT INTO breaks (provider_id, weekday, start_time, end_time, label) VALUES ($1,$2,$3,$4,$5)`,
          [prov.id, weekday, start, end, label]
        );
      }
    }

    // ---- payment policies: turf slots are prepaid, FadeLab takes deposits --
    await client.query(`UPDATE services s SET payment_policy = 'full'
                        FROM providers p WHERE p.id = s.provider_id AND p.business_type = 'turf'`);
    await client.query(`UPDATE services s SET payment_policy = 'deposit', deposit_pct = 25
                        FROM providers p WHERE p.id = s.provider_id AND p.name LIKE '%FadeLab%'`);

    // ---- demo coupons -----------------------------------------------------
    await client.query(
      `INSERT INTO coupons (code, type, value, min_amount_cents, max_uses) VALUES
       ('WELCOME10', 'percent', 10, 50000, NULL),
       ('FLAT200', 'fixed', 20000, 100000, 50)`
    );

    // ---- sample customers + bookings (tomorrow, aligned to schedules) -----
    const customers = [
      ['Rohan Iyer', 'rohan@example.com', '+91 98765 11111'],
      ['Sneha Kulkarni', 'sneha@example.com', '+91 98765 22222'],
      ['Vikram Shetty', 'vikram@example.com', '+91 98765 33333'],
    ];
    const customerIds: number[] = [];
    for (const [name, email, phone] of customers) {
      const { rows: [c] } = await client.query(
        `INSERT INTO customers (name, email, phone) VALUES ($1,$2,$3) RETURNING id`,
        [name, email, phone]
      );
      customerIds.push(c.id);
    }

    // demo customer ACCOUNT so accounts/loyalty/favorites demo out of the box
    const customerHash = await bcrypt.hash('customer123', 10);
    const { rows: [demoCustomer] } = await client.query(
      `INSERT INTO customers (name, email, phone, password_hash)
       VALUES ('Demo Customer', 'customer@bookit.local', '+91 98765 00000', $1) RETURNING id`,
      [customerHash]
    );
    customerIds.push(demoCustomer.id);

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const at = (h: number, m: number) => {
      const d = new Date(tomorrow);
      d.setHours(h, m, 0, 0);
      return d;
    };
    const addMin = (d: Date, min: number) => new Date(d.getTime() + min * 60000);
    const code = () =>
      'BK-' + Array.from({ length: 6 }, () => 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 31)]).join('');

    // Turf 1: two evening games tomorrow; SmashPoint: one morning session
    const samples: [number, number, Date, number, number][] = [
      // providerIdx, serviceIdx, start, customerIdx, durationMin
      [4, 0, at(18, 0), 0, 60],
      [4, 1, at(20, 0), 1, 90],
      [5, 0, at(7, 0), 2, 60],
    ];
    for (const [pi, si, start, ci, dur] of samples) {
      await client.query(
        `INSERT INTO bookings (code, provider_id, service_id, customer_id, starts_at, ends_at, status, price_cents)
         VALUES ($1,$2,$3,$4,$5,$6,'confirmed',
                 (SELECT price_cents FROM services WHERE id = $3))`,
        [code(), pi + 1, serviceIds[pi][si], customerIds[ci], start, addMin(start, dur)]
      );
    }

    // ---- completed history + reviews + loyalty (past dates) ---------------
    const past = (daysAgo: number, h: number) => {
      const d = new Date();
      d.setDate(d.getDate() - daysAgo);
      d.setHours(h, 0, 0, 0);
      return d;
    };
    // providerIdx, serviceIdx, daysAgo, hour, customerIdx, durationMin, rating, comment
    const history: [number, number, number, number, number, number, number, string][] = [
      [0, 0, 12, 10, 3, 30, 5, 'Rao 医生问诊耐心，解释得非常清楚，强烈推荐。'],
      [2, 0, 8, 11, 3, 45, 4, '剪发效果很好，不过比预约时间晚了几分钟。'],
      [4, 0, 5, 19, 0, 60, 5, '场地很棒，泛光灯和草坪都保持得很好！'],
      [3, 0, 3, 12, 1, 40, 4, '渐变发型很利落，预约也很方便。'],
      [1, 0, 2, 15, 2, 20, 5, '问诊快速而专业。'],
    ];
    for (const [pi, si, daysAgo, h, ci, dur, rating, comment] of history) {
      const start = past(daysAgo, h);
      const { rows: [b] } = await client.query(
        `INSERT INTO bookings (code, provider_id, service_id, customer_id, starts_at, ends_at, status, price_cents)
         VALUES ($1,$2,$3,$4,$5,$6,'completed',
                 (SELECT price_cents FROM services WHERE id = $3))
         RETURNING id, code, customer_id, provider_id, price_cents`,
        [code(), pi + 1, serviceIds[pi][si], customerIds[ci], start, addMin(start, dur)]
      );
      await client.query(
        `INSERT INTO reviews (booking_id, provider_id, customer_id, rating, comment)
         VALUES ($1,$2,$3,$4,$5)`,
        [b.id, b.provider_id, b.customer_id, rating, comment]
      );
      const points = Math.floor(b.price_cents / 1000);
      if (points > 0) {
        await client.query(
          `INSERT INTO loyalty_ledger (customer_id, booking_id, points, reason, detail)
           VALUES ($1,$2,$3,'earned_completed',$4)`,
          [b.customer_id, b.id, points, `Completed ${b.code}`]
        );
      }
    }

    // demo customer favorites
    await client.query(
      `INSERT INTO favorites (customer_id, provider_id) VALUES ($1, 1), ($1, 5)`,
      [demoCustomer.id]
    );

    await client.query('COMMIT');
    console.log(
      '✔ Seeded: admin (admin@bookit.local / admin123), demo customer (customer@bookit.local / customer123),\n' +
      '  6 providers with payment policies, coupons WELCOME10 & FLAT200, upcoming + completed bookings,\n' +
      '  reviews, loyalty points and favorites.'
    );
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
  await pool.end();
}

main().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
