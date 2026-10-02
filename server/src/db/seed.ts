import bcrypt from 'bcryptjs';
import { pool } from './pool.js';

/** Wipes business data and inserts a rich demo dataset. */
async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `TRUNCATE notifications, waitlist, reviews, favorites, booking_events, bookings, booking_series, customers, time_off, breaks,
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
      resourceType: string; name: string; title: string; bio: string; emoji: string; color: string;
      step: number; lead: number; horizon: number;
      services: [string, string, number, number][]; // name, desc, duration, buffer
      hours: Record<number, [string, string][]>;            // weekday -> windows
      breaks?: [number, string, string, string][];          // weekday, start, end, label
    };

    const providers: P[] = [
      {
        resourceType: 'study_room', name: '静心自习室 A', title: '安静学习空间', emoji: '📚', color: '#0ea5e9',
        bio: '适合个人学习、考研备考和专注办公，提供稳定网络、插座与自然采光。',
        step: 15, lead: 120, horizon: 21,
        services: [
          ['单人学习座位', '独立座位、插座与高速网络', 60, 10],
          ['小组学习桌', '适合 2—4 人协作学习', 120, 15],
          ['专注学习时段', '连续 3 小时安静学习空间', 180, 15],
        ],
        hours: { 1: [['09:00', '13:00'], ['17:00', '20:00']], 2: [['09:00', '13:00'], ['17:00', '20:00']], 3: [['09:00', '13:00']], 4: [['09:00', '13:00'], ['17:00', '20:00']], 5: [['09:00', '13:00']], 6: [['10:00', '14:00']] },
        breaks: [[1, '11:00', '11:15', '茶歇'], [2, '11:00', '11:15', '茶歇'], [4, '11:00', '11:15', '茶歇']],
      },
      {
        resourceType: 'study_room', name: '图书馆研习室 B', title: '小组研习空间', emoji: '📝', color: '#14b8a6',
        bio: '靠近图书馆与教学楼，适合课程讨论、论文写作和安静自习。',
        step: 20, lead: 60, horizon: 30,
        services: [
          ['单人研习位', '带台灯与储物柜的学习座位', 60, 5],
          ['小组研讨桌', '白板与投屏设备齐全', 90, 15],
          ['论文冲刺时段', '适合集中完成课程任务', 180, 15],
        ],
        hours: { 1: [['10:00', '18:00']], 2: [['10:00', '18:00']], 3: [['10:00', '18:00']], 4: [['10:00', '18:00']], 5: [['10:00', '18:00']] },
        breaks: [[1, '13:30', '14:30', '午休'], [2, '13:30', '14:30', '午休'], [3, '13:30', '14:30', '午休'], [4, '13:30', '14:30', '午休'], [5, '13:30', '14:30', '午休']],
      },
      {
        resourceType: 'meeting_room', name: '创新会议室 1', title: '小组会议与路演空间', emoji: '🏫', color: '#ec4899',
        bio: '配备投影、白板和可移动桌椅，适合课程展示、社团会议和项目路演。',
        step: 15, lead: 30, horizon: 14,
        services: [
          ['课程项目讨论', '投影、白板与 8 人座位', 60, 15],
          ['社团例会', '可移动桌椅与会议屏幕', 90, 15],
          ['项目路演彩排', '大屏、音响与演示空间', 120, 20],
          ['面试模拟间', '适合模拟面试与小型答辩', 45, 10],
        ],
        hours: { 0: [['11:00', '17:00']], 2: [['10:00', '20:00']], 3: [['10:00', '20:00']], 4: [['10:00', '20:00']], 5: [['10:00', '20:00']], 6: [['09:00', '21:00']] },
        breaks: [[6, '13:00', '13:45', '午休']],
      },
      {
        resourceType: 'meeting_room', name: '社团活动室 2', title: '社团活动与面试空间', emoji: '🎤', color: '#f59e0b',
        bio: '适合学生组织活动、招聘面试和小型工作坊，支持灵活布置。',
        step: 10, lead: 30, horizon: 14,
        services: [
          ['招聘面试', '适合 1 对 1 面试与交流', 45, 10],
          ['社团工作坊', '桌椅、白板与投影设备', 90, 10],
          ['学生组织活动', '灵活空间与扩音设备', 120, 15],
        ],
        hours: { 0: [['10:00', '16:00']], 1: [['11:00', '20:00']], 3: [['11:00', '20:00']], 4: [['11:00', '20:00']], 5: [['11:00', '21:00']], 6: [['10:00', '21:00']] },
      },
      {
        resourceType: 'equipment', name: '电子实验室', title: '电子与嵌入式设备', emoji: '🧪', color: '#22c55e',
        bio: '提供示波器、万用表和开发板，适合课程实验与学生项目开发。',
        step: 30, lead: 60, horizon: 30,
        services: [
          ['基础实验台', '示波器、万用表与电源', 60, 10],
          ['开发板套装', '开发板、烧录器与连接线', 120, 10],
          ['团队实验时段', '最多 4 人协作使用实验设备', 180, 15],
        ],
        hours: { 0: [['06:00', '23:00']], 1: [['06:00', '23:00']], 2: [['06:00', '23:00']], 3: [['06:00', '23:00']], 4: [['06:00', '23:00']], 5: [['06:00', '23:00']], 6: [['06:00', '23:00']] },
      },
      {
        resourceType: 'equipment', name: '摄影与创作设备室', title: '影像与内容创作设备', emoji: '📷', color: '#8b5cf6',
        bio: '提供相机、灯光和录音设备，适合课程作业、校园活动记录与作品创作。',
        step: 30, lead: 30, horizon: 21,
        services: [
          ['相机与灯光套装', '相机、三脚架与基础灯光', 120, 10],
          ['视频拍摄套装', '相机、灯光与无线麦克风', 180, 15],
        ],
        hours: { 0: [['06:00', '22:00']], 1: [['06:00', '22:00']], 2: [['06:00', '22:00']], 3: [['06:00', '22:00']], 4: [['06:00', '22:00']], 5: [['06:00', '22:00']], 6: [['06:00', '22:00']] },
      },
    ];

    const serviceIds: number[][] = [];
    for (const p of providers) {
      const { rows: [prov] } = await client.query(
        `INSERT INTO providers (resource_type, name, title, bio, emoji, color, slot_step_min, min_lead_min, booking_horizon_days)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
        [p.resourceType, p.name, p.title, p.bio, p.emoji, p.color, p.step, p.lead, p.horizon]
      );
      const ids: number[] = [];
      for (const [name, desc, dur, buf] of p.services) {
        const { rows: [svc] } = await client.query(
          `INSERT INTO services (provider_id, name, description, duration_min, buffer_min)
           VALUES ($1,$2,$3,$4,$5) RETURNING id`,
          [prov.id, name, desc, dur, buf]
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

    // demo customer account so account/favorites features work out of the box
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

    // Campus resources: two meeting reservations and one equipment session
    const samples: [number, number, Date, number, number][] = [
      // providerIdx, serviceIdx, start, customerIdx, durationMin
      [4, 0, at(18, 0), 0, 60],
      [4, 1, at(20, 0), 1, 90],
      [5, 0, at(7, 0), 2, 60],
    ];
    for (const [pi, si, start, ci, dur] of samples) {
      await client.query(
        `INSERT INTO bookings (code, provider_id, service_id, customer_id, starts_at, ends_at, status)
         VALUES ($1,$2,$3,$4,$5,$6,'confirmed')`,
        [code(), pi + 1, serviceIds[pi][si], customerIds[ci], start, addMin(start, dur)]
      );
    }

    // ---- completed history + reviews -------------------------------------
    const past = (daysAgo: number, h: number) => {
      const d = new Date();
      d.setDate(d.getDate() - daysAgo);
      d.setHours(h, 0, 0, 0);
      return d;
    };
    // providerIdx, serviceIdx, daysAgo, hour, customerIdx, durationMin, rating, comment
    const history: [number, number, number, number, number, number, number, string][] = [
      [0, 0, 12, 10, 3, 60, 5, '空间安静整洁，插座和网络都很方便。'],
      [2, 0, 8, 11, 3, 60, 4, '投影和白板很好用，小组讨论效率很高。'],
      [4, 0, 5, 19, 0, 60, 5, '设备状态很好，实验预约流程也很清晰。'],
      [3, 0, 3, 12, 1, 45, 4, '面试空间安静，预约操作很方便。'],
      [1, 0, 2, 15, 2, 60, 5, '研习室环境舒适，适合长时间学习。'],
    ];
    for (const [pi, si, daysAgo, h, ci, dur, rating, comment] of history) {
      const start = past(daysAgo, h);
      const { rows: [b] } = await client.query(
        `INSERT INTO bookings (code, provider_id, service_id, customer_id, starts_at, ends_at, status)
         VALUES ($1,$2,$3,$4,$5,$6,'completed')
         RETURNING id, code, customer_id, provider_id`,
        [code(), pi + 1, serviceIds[pi][si], customerIds[ci], start, addMin(start, dur)]
      );
      await client.query(
        `INSERT INTO reviews (booking_id, provider_id, customer_id, rating, comment)
         VALUES ($1,$2,$3,$4,$5)`,
        [b.id, b.provider_id, b.customer_id, rating, comment]
      );
    }

    // demo customer favorites
    await client.query(
      `INSERT INTO favorites (customer_id, provider_id) VALUES ($1, 1), ($1, 5)`,
      [demoCustomer.id]
    );

    await client.query('COMMIT');
    console.log(
      '✔ Seeded: admin (admin@bookit.local / admin123), demo customer (customer@bookit.local / customer123),\n' +
      '  6 campus resources with upcoming + completed reservations, reviews and favorites.'
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
