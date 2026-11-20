import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import {
  dateCn,
  execute,
  initDb,
  isPostgres,
  nowCn,
  queryAll,
  queryOne,
} from './db.js';
import {
  authMiddleware,
  hashPassword,
  signToken,
  verifyPassword,
} from './auth.js';

const app = express();
const PORT = Number(process.env.PORT || 3001);

app.set('trust proxy', 1);
app.use(express.json());
app.use(cookieParser());
app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

const MODULE_IDS = ['speed', 'nback', 'spaced', 'spatial', 'stroop'];

function setAuthCookie(req, res, token) {
  const isHttps =
    req.secure || req.headers['x-forwarded-proto'] === 'https';
  res.cookie('mc_token', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isHttps,
    maxAge: 14 * 24 * 60 * 60 * 1000,
  });
}

function sanitizeUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    role: row.role || 'user',
    fontScale: row.font_scale,
    soundEnabled: Boolean(row.sound_enabled),
    dailyGoalMinutes: row.daily_goal_minutes,
    createdAt: row.created_at,
  };
}

async function ensureAdminAccount() {
  if (process.env.ADMIN_USERNAME) {
    const target = process.env.ADMIN_USERNAME.trim().toLowerCase();
    await execute("UPDATE users SET role = 'admin' WHERE username = ?", [target]);
  }
  const adminPass = process.env.ADMIN_PASSWORD;
  if (!adminPass) return;
  const existingAdmin = await queryOne("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
  if (existingAdmin) return;
  const adminUser = (process.env.ADMIN_USERNAME || 'admin').trim().toLowerCase();
  const existingByName = await queryOne('SELECT id FROM users WHERE username = ?', [adminUser]);
  if (existingByName) {
    await execute("UPDATE users SET role = 'admin' WHERE id = ?", [existingByName.id]);
    return;
  }
  const res = await execute(
    "INSERT INTO users (username, display_name, password_hash, role, created_at) VALUES (?, '管理员', ?, 'admin', ?)",
    [adminUser, hashPassword(adminPass), nowCn()],
    { returningId: true }
  );
  await ensureUserLevels(res.lastInsertRowid);
}

async function adminMiddleware(req, res, next) {
  try {
    const user = await queryOne('SELECT id, role FROM users WHERE id = ?', [req.userId]);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ error: '需要管理员权限' });
    }
    next();
  } catch (err) {
    next(err);
  }
}

async function ensureUserLevels(userId) {
  const now = nowCn();
  for (const mod of MODULE_IDS) {
    await execute(
      `INSERT INTO user_module_levels (user_id, module_id, current_level, best_score, total_sessions, updated_at)
       VALUES (?, ?, 1, 0, 0, ?)
       ON CONFLICT (user_id, module_id) DO NOTHING`,
      [userId, mod, now]
    );
  }
}

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, db: isPostgres ? 'postgres' : 'sqlite', time: new Date().toISOString() });
});

app.post(
  '/api/auth/register',
  wrap(async (req, res) => {
    const { username, password, displayName } = req.body || {};
    const cleanUser = String(username || '').trim().toLowerCase();
    const cleanPass = String(password || '');
    const cleanName = String(displayName || '').trim() || cleanUser;

    if (cleanUser.length < 2 || cleanUser.length > 32) {
      return res.status(400).json({ error: '账号长度需在 2 到 32 个字符之间' });
    }
    if (cleanPass.length < 4) {
      return res.status(400).json({ error: '密码至少需要 4 位' });
    }

    const existing = await queryOne('SELECT id FROM users WHERE username = ?', [cleanUser]);
    if (existing) {
      return res.status(409).json({ error: '该账号已存在，请直接登录或更换账号名' });
    }

    const hasAdmin = await queryOne("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
    const assignedRole = hasAdmin ? 'user' : 'admin';

    const passwordHash = hashPassword(cleanPass);
    const result = await execute(
      'INSERT INTO users (username, display_name, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)',
      [cleanUser, cleanName, passwordHash, assignedRole, nowCn()],
      { returningId: true }
    );

    const userId = result.lastInsertRowid;
    await ensureUserLevels(userId);

    const user = await queryOne('SELECT * FROM users WHERE id = ?', [userId]);
    const token = signToken(user);
    setAuthCookie(req, res, token);

    res.status(201).json({ user: sanitizeUser(user), token });
  })
);

app.post(
  '/api/auth/login',
  wrap(async (req, res) => {
    const { username, password } = req.body || {};
    const cleanUser = String(username || '').trim().toLowerCase();
    const cleanPass = String(password || '');

    const user = await queryOne('SELECT * FROM users WHERE username = ?', [cleanUser]);
    if (!user || !verifyPassword(cleanPass, user.password_hash)) {
      return res.status(401).json({ error: '账号或密码不正确' });
    }

    await ensureUserLevels(user.id);
    const token = signToken(user);
    setAuthCookie(req, res, token);

    res.json({ user: sanitizeUser(user), token });
  })
);

app.post(
  '/api/auth/demo',
  wrap(async (req, res) => {
    const demoUsername = 'baba_demo';
    let user = await queryOne('SELECT * FROM users WHERE username = ?', [demoUsername]);

    if (!user) {
      const hash = hashPassword('123456');
      const result = await execute(
        'INSERT INTO users (username, display_name, password_hash, created_at) VALUES (?, ?, ?, ?)',
        [demoUsername, '李先生（体验账号）', hash, nowCn()],
        { returningId: true }
      );
      await ensureUserLevels(result.lastInsertRowid);
      user = await queryOne('SELECT * FROM users WHERE id = ?', [result.lastInsertRowid]);
    }

    const token = signToken(user);
    setAuthCookie(req, res, token);
    res.json({ user: sanitizeUser(user), token });
  })
);

app.post('/api/auth/logout', (_req, res) => {
  res.clearCookie('mc_token');
  res.json({ ok: true });
});

app.get(
  '/api/auth/me',
  authMiddleware,
  wrap(async (req, res) => {
    const user = await queryOne('SELECT * FROM users WHERE id = ?', [req.userId]);
    if (!user) {
      return res.status(401).json({ error: '用户不存在' });
    }
    await ensureUserLevels(user.id);
    res.json({ user: sanitizeUser(user) });
  })
);

app.patch(
  '/api/auth/preferences',
  authMiddleware,
  wrap(async (req, res) => {
    const { fontScale, soundEnabled, dailyGoalMinutes, displayName } = req.body || {};
    const current = await queryOne('SELECT * FROM users WHERE id = ?', [req.userId]);
    if (!current) return res.status(404).json({ error: '用户不存在' });

    const nextFont = fontScale === 'normal' || fontScale === 'large' ? fontScale : current.font_scale;
    const nextSound = typeof soundEnabled === 'boolean' ? (soundEnabled ? 1 : 0) : current.sound_enabled;
    const nextGoal =
      Number.isFinite(Number(dailyGoalMinutes)) &&
      Number(dailyGoalMinutes) >= 5 &&
      Number(dailyGoalMinutes) <= 60
        ? Math.round(Number(dailyGoalMinutes))
        : current.daily_goal_minutes;
    const nextName =
      typeof displayName === 'string' && displayName.trim().length > 0
        ? displayName.trim().slice(0, 24)
        : current.display_name;

    await execute(
      'UPDATE users SET font_scale = ?, sound_enabled = ?, daily_goal_minutes = ?, display_name = ? WHERE id = ?',
      [nextFont, nextSound, nextGoal, nextName, req.userId]
    );

    const updated = await queryOne('SELECT * FROM users WHERE id = ?', [req.userId]);
    res.json({ user: sanitizeUser(updated) });
  })
);

async function buildOverview(userId) {
  await ensureUserLevels(userId);

  const levels = await queryAll(
    'SELECT module_id, current_level, best_score, total_sessions, updated_at FROM user_module_levels WHERE user_id = ?',
    [userId]
  );

  const todayStr = dateCn(0);
  const yesterdayStr = dateCn(-1);
  const since14Str = dateCn(-13);

  const todayRows = await queryAll(
    'SELECT module_id, duration_sec, score, accuracy FROM training_sessions WHERE user_id = ? AND SUBSTR(created_at, 1, 10) = ?',
    [userId, todayStr]
  );

  const todaySeconds = todayRows.reduce((sum, r) => sum + Number(r.duration_sec || 0), 0);
  const todayModules = [...new Set(todayRows.map((r) => r.module_id))];

  const dailyRows = await queryAll(
    `SELECT SUBSTR(created_at, 1, 10) as day,
            COUNT(*) as sessions,
            SUM(duration_sec) as total_sec,
            ROUND(AVG(accuracy)::numeric, 1) as avg_accuracy
     FROM training_sessions
     WHERE user_id = ? AND SUBSTR(created_at, 1, 10) >= ?
     GROUP BY SUBSTR(created_at, 1, 10)
     ORDER BY day ASC`.replace(isPostgres ? '' : '::numeric', ''),
    [userId, since14Str]
  );

  const allDays = (
    await queryAll(
      `SELECT DISTINCT SUBSTR(created_at, 1, 10) as day
       FROM training_sessions
       WHERE user_id = ?
       ORDER BY day DESC`,
      [userId]
    )
  ).map((r) => r.day);

  let streakDays = 0;
  if (allDays.length > 0 && (allDays[0] === todayStr || allDays[0] === yesterdayStr)) {
    let expected = new Date(allDays[0] + 'T00:00:00');
    for (const dayStr of allDays) {
      const expStr = expected.toISOString().slice(0, 10);
      if (dayStr === expStr) {
        streakDays++;
        expected.setDate(expected.getDate() - 1);
      } else {
        break;
      }
    }
  }

  const domainStats = await queryAll(
    `SELECT module_id,
            COUNT(*) as count,
            ROUND(AVG(accuracy)${isPostgres ? '::numeric' : ''}, 1) as avg_accuracy,
            ROUND(AVG(avg_reaction_ms)) as avg_reaction_ms,
            MAX(score) as max_score
     FROM training_sessions
     WHERE user_id = ?
     GROUP BY module_id`,
    [userId]
  );

  return {
    levels,
    today: {
      minutes: Math.round(todaySeconds / 60),
      seconds: todaySeconds,
      sessionsCount: todayRows.length,
      completedModules: todayModules,
    },
    streakDays,
    recentDays: dailyRows.map((d) => ({
      day: d.day,
      sessions: Number(d.sessions),
      total_sec: Number(d.total_sec || 0),
      avg_accuracy: Number(d.avg_accuracy || 0),
    })),
    domainStats: domainStats.map((s) => ({
      module_id: s.module_id,
      count: Number(s.count),
      avg_accuracy: Number(s.avg_accuracy || 0),
      avg_reaction_ms: Number(s.avg_reaction_ms || 0),
      max_score: Number(s.max_score || 0),
    })),
  };
}

function avgField(rows, field) {
  const valid = rows.filter(
    (r) => Number.isFinite(Number(r[field])) && (field !== 'avg_reaction_ms' || Number(r[field]) > 0)
  );
  if (valid.length === 0) return null;
  return Math.round(valid.reduce((sum, r) => sum + Number(r[field]), 0) / valid.length);
}

async function buildEffectiveness(userId) {
  const allRows = await queryAll(
    `SELECT id, module_id, difficulty_level, score, accuracy, avg_reaction_ms, created_at
     FROM training_sessions
     WHERE user_id = ?
     ORDER BY id ASC`,
    [userId]
  );

  const byModule = MODULE_IDS.map((moduleId) => {
    const rows = allRows.filter((r) => r.module_id === moduleId);
    if (rows.length === 0) {
      return {
        moduleId,
        sessionsCount: 0,
        baselineAccuracy: null,
        recentAccuracy: null,
        baselineReactionMs: null,
        recentReactionMs: null,
        startLevel: 1,
        currentLevel: 1,
      };
    }
    const windowSize = Math.min(3, Math.ceil(rows.length / 2));
    const baselineRows = rows.slice(0, windowSize);
    const recentRows = rows.slice(-windowSize);

    return {
      moduleId,
      sessionsCount: rows.length,
      baselineAccuracy: avgField(baselineRows, 'accuracy'),
      recentAccuracy: avgField(recentRows, 'accuracy'),
      baselineReactionMs: avgField(baselineRows, 'avg_reaction_ms'),
      recentReactionMs: avgField(recentRows, 'avg_reaction_ms'),
      startLevel: baselineRows[0].difficulty_level,
      currentLevel: recentRows[recentRows.length - 1].difficulty_level,
    };
  });

  const trend = allRows.slice(-20).map((r) => ({
    id: r.id,
    moduleId: r.module_id,
    accuracy: Math.round(Number(r.accuracy)),
    reactionMs: Number(r.avg_reaction_ms),
    level: r.difficulty_level,
    date: String(r.created_at).slice(5, 10),
  }));

  return { byModule, trend };
}

app.get(
  '/api/training/overview',
  authMiddleware,
  wrap(async (req, res) => {
    res.json(await buildOverview(req.userId));
  })
);

app.get(
  '/api/training/effectiveness',
  authMiddleware,
  wrap(async (req, res) => {
    res.json(await buildEffectiveness(req.userId));
  })
);

app.get(
  '/api/auth/share-token',
  authMiddleware,
  wrap(async (req, res) => {
    const row = await queryOne('SELECT share_token FROM users WHERE id = ?', [req.userId]);
    res.json({ shareToken: row?.share_token || null });
  })
);

app.post(
  '/api/auth/share-token',
  authMiddleware,
  wrap(async (req, res) => {
    const existing = await queryOne('SELECT share_token FROM users WHERE id = ?', [req.userId]);
    let token = existing?.share_token;
    if (!token) {
      token = crypto.randomBytes(10).toString('hex');
      await execute('UPDATE users SET share_token = ? WHERE id = ?', [token, req.userId]);
    }
    res.json({ shareToken: token });
  })
);

app.delete(
  '/api/auth/share-token',
  authMiddleware,
  wrap(async (req, res) => {
    await execute('UPDATE users SET share_token = NULL WHERE id = ?', [req.userId]);
    res.json({ shareToken: null });
  })
);

app.get(
  '/api/share/:token',
  wrap(async (req, res) => {
    const token = String(req.params.token || '').trim();
    if (!token) return res.status(404).json({ error: '无效的查看链接' });
    const user = await queryOne('SELECT id, display_name FROM users WHERE share_token = ?', [token]);
    if (!user) {
      return res.status(404).json({ error: '该家属查看链接不存在或已失效' });
    }
    const overview = await buildOverview(user.id);
    const effectiveness = await buildEffectiveness(user.id);
    const sessions = await queryAll(
      `SELECT id, module_id, difficulty_level, score, accuracy, avg_reaction_ms, duration_sec, trials_completed, created_at
       FROM training_sessions
       WHERE user_id = ?
       ORDER BY id DESC
       LIMIT 15`,
      [user.id]
    );

    res.json({
      displayName: user.display_name,
      overview,
      effectiveness,
      sessions,
    });
  })
);

// Admin endpoints
app.get(
  '/api/admin/users',
  authMiddleware,
  adminMiddleware,
  wrap(async (_req, res) => {
    const rows = await queryAll(
      `SELECT u.id, u.username, u.display_name, u.role, u.created_at,
              COUNT(s.id) as total_sessions,
              MAX(s.created_at) as last_active_at
       FROM users u
       LEFT JOIN training_sessions s ON s.user_id = u.id
       GROUP BY u.id
       ORDER BY u.id ASC`
    );

    res.json({
      users: rows.map((r) => ({
        id: r.id,
        username: r.username,
        displayName: r.display_name,
        role: r.role || 'user',
        createdAt: r.created_at,
        totalSessions: Number(r.total_sessions || 0),
        lastActiveAt: r.last_active_at || null,
      })),
    });
  })
);

app.get(
  '/api/admin/users/:id/report',
  authMiddleware,
  adminMiddleware,
  wrap(async (req, res) => {
    const targetId = Number(req.params.id);
    const user = await queryOne('SELECT id, display_name FROM users WHERE id = ?', [targetId]);
    if (!user) return res.status(404).json({ error: '用户不存在' });

    const sessions = await queryAll(
      `SELECT id, module_id, difficulty_level, score, accuracy, avg_reaction_ms, duration_sec, trials_completed, created_at
       FROM training_sessions
       WHERE user_id = ?
       ORDER BY id DESC
       LIMIT 15`,
      [user.id]
    );

    res.json({
      displayName: user.display_name,
      overview: await buildOverview(user.id),
      effectiveness: await buildEffectiveness(user.id),
      sessions,
    });
  })
);

app.post(
  '/api/admin/users/:id/reset-password',
  authMiddleware,
  adminMiddleware,
  wrap(async (req, res) => {
    const targetId = Number(req.params.id);
    const newPassword = String(req.body?.newPassword || '');
    if (newPassword.length < 4) {
      return res.status(400).json({ error: '新密码至少需要 4 位' });
    }
    const user = await queryOne('SELECT id FROM users WHERE id = ?', [targetId]);
    if (!user) return res.status(404).json({ error: '用户不存在' });

    await execute('UPDATE users SET password_hash = ? WHERE id = ?', [
      hashPassword(newPassword),
      targetId,
    ]);
    res.json({ ok: true });
  })
);

app.delete(
  '/api/admin/users/:id',
  authMiddleware,
  adminMiddleware,
  wrap(async (req, res) => {
    const targetId = Number(req.params.id);
    if (targetId === req.userId) {
      return res.status(400).json({ error: '不能删除当前登录的管理员账号' });
    }
    await execute('DELETE FROM users WHERE id = ?', [targetId]);
    res.json({ ok: true });
  })
);

app.post(
  '/api/training/sessions',
  authMiddleware,
  wrap(async (req, res) => {
    const {
      moduleId,
      difficultyLevel = 1,
      score = 0,
      accuracy = 0,
      avgReactionMs = 0,
      durationSec = 0,
      trialsCompleted = 0,
      details = null,
    } = req.body || {};

    if (!MODULE_IDS.includes(moduleId)) {
      return res.status(400).json({ error: '无效的训练模块' });
    }

    await ensureUserLevels(req.userId);

    const cleanAcc = Math.max(0, Math.min(100, Number(accuracy) || 0));
    const cleanScore = Math.max(0, Math.round(Number(score) || 0));
    const cleanLevel = Math.max(1, Math.min(10, Math.round(Number(difficultyLevel) || 1)));
    const cleanReaction = Math.max(0, Math.round(Number(avgReactionMs) || 0));
    const cleanDuration = Math.max(1, Math.round(Number(durationSec) || 0));
    const cleanTrials = Math.max(0, Math.round(Number(trialsCompleted) || 0));
    const now = nowCn();

    await execute(
      `INSERT INTO training_sessions
       (user_id, module_id, difficulty_level, score, accuracy, avg_reaction_ms, duration_sec, trials_completed, details_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.userId,
        moduleId,
        cleanLevel,
        cleanScore,
        cleanAcc,
        cleanReaction,
        cleanDuration,
        cleanTrials,
        details ? JSON.stringify(details) : null,
        now,
      ]
    );

    const current = await queryOne(
      'SELECT current_level, best_score, total_sessions FROM user_module_levels WHERE user_id = ? AND module_id = ?',
      [req.userId, moduleId]
    );

    let nextLevel = current ? current.current_level : cleanLevel;
    let levelChange = 0;

    if (cleanAcc >= 85 && nextLevel < 10) {
      nextLevel += 1;
      levelChange = 1;
    } else if (cleanAcc < 60 && nextLevel > 1) {
      nextLevel -= 1;
      levelChange = -1;
    }

    const nextBest = Math.max(current?.best_score || 0, cleanScore);
    const nextTotal = (current?.total_sessions || 0) + 1;

    await execute(
      `UPDATE user_module_levels
       SET current_level = ?, best_score = ?, total_sessions = ?, updated_at = ?
       WHERE user_id = ? AND module_id = ?`,
      [nextLevel, nextBest, nextTotal, now, req.userId, moduleId]
    );

    res.status(201).json({
      saved: true,
      nextLevel,
      levelChange,
      bestScore: nextBest,
    });
  })
);

app.get(
  '/api/training/sessions',
  authMiddleware,
  wrap(async (req, res) => {
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
    const rows = await queryAll(
      `SELECT id, module_id, difficulty_level, score, accuracy, avg_reaction_ms, duration_sec, trials_completed, created_at
       FROM training_sessions
       WHERE user_id = ?
       ORDER BY id DESC
       LIMIT ?`,
      [req.userId, limit]
    );

    res.json({ sessions: rows });
  })
);

app.get(
  '/api/spaced/due',
  authMiddleware,
  wrap(async (req, res) => {
    const rows = await queryAll(
      `SELECT item_key, interval_days, ease_factor, repetitions, next_review_at
       FROM spaced_items
       WHERE user_id = ? AND next_review_at <= ?`,
      [req.userId, nowCn()]
    );
    res.json({ dueItems: rows });
  })
);

app.post(
  '/api/spaced/review',
  authMiddleware,
  wrap(async (req, res) => {
    const { results } = req.body || {};
    if (!Array.isArray(results)) {
      return res.status(400).json({ error: '无效的复习结果' });
    }

    const now = nowCn();
    for (const item of results) {
      const key = String(item.itemKey || '');
      const correct = Boolean(item.correct);
      if (!key) continue;

      const existing = await queryOne(
        'SELECT * FROM spaced_items WHERE user_id = ? AND item_key = ?',
        [req.userId, key]
      );
      let reps = existing ? existing.repetitions : 0;
      let ef = existing ? existing.ease_factor : 2.5;
      let interval = existing ? existing.interval_days : 0;

      if (correct) {
        if (reps === 0) interval = 1;
        else if (reps === 1) interval = 3;
        else interval = Math.round(interval * ef);
        reps += 1;
        ef = Math.max(1.3, ef + 0.05);
      } else {
        reps = 0;
        interval = 1;
        ef = Math.max(1.3, ef - 0.2);
      }

      const nextReviewStr = `${dateCn(interval)} 00:00:00`;

      await execute(
        `INSERT INTO spaced_items (user_id, item_key, interval_days, ease_factor, repetitions, next_review_at, last_reviewed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(user_id, item_key) DO UPDATE SET
           interval_days = excluded.interval_days,
           ease_factor = excluded.ease_factor,
           repetitions = excluded.repetitions,
           next_review_at = excluded.next_review_at,
           last_reviewed_at = excluded.last_reviewed_at`,
        [req.userId, key, interval, ef, reps, nextReviewStr, now]
      );
    }

    res.json({ ok: true });
  })
);

const clientDist = path.join(process.cwd(), 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.use((err, _req, res, _next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: '服务器内部错误，请稍后重试' });
});

initDb()
  .then(async () => {
    await ensureAdminAccount();
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`MemoryCare server running at http://0.0.0.0:${PORT} (${isPostgres ? 'PostgreSQL' : 'SQLite'})`);
    });
  })
  .catch((err) => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  });
