import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import { db } from './db.js';
import {
  authMiddleware,
  hashPassword,
  signToken,
  verifyPassword,
} from './auth.js';

const app = express();
const PORT = Number(process.env.PORT || 3001);
const isProd = process.env.NODE_ENV === 'production';

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

function ensureAdminAccount() {
  const adminPass = process.env.ADMIN_PASSWORD;
  if (!adminPass) return;
  const existingAdmin = db.prepare("SELECT id FROM users WHERE role = 'admin' LIMIT 1").get();
  if (existingAdmin) return;
  const adminUser = (process.env.ADMIN_USERNAME || 'admin').trim().toLowerCase();
  const existingByName = db.prepare('SELECT id FROM users WHERE username = ?').get(adminUser);
  if (existingByName) {
    db.prepare("UPDATE users SET role = 'admin' WHERE id = ?").run(existingByName.id);
    return;
  }
  const res = db
    .prepare("INSERT INTO users (username, display_name, password_hash, role) VALUES (?, '管理员', ?, 'admin')")
    .run(adminUser, hashPassword(adminPass));
  ensureUserLevels(Number(res.lastInsertRowid));
}

ensureAdminAccount();

function adminMiddleware(req, res, next) {
  const user = db.prepare('SELECT id, role FROM users WHERE id = ?').get(req.userId);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: '需要管理员权限' });
  }
  next();
}

function ensureUserLevels(userId) {
  const insert = db.prepare(`
    INSERT OR IGNORE INTO user_module_levels (user_id, module_id, current_level, best_score, total_sessions)
    VALUES (?, ?, 1, 0, 0)
  `);
  for (const mod of MODULE_IDS) {
    insert.run(userId, mod);
  }
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

app.post('/api/auth/register', (req, res) => {
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

  const existing = db
    .prepare('SELECT id FROM users WHERE username = ?')
    .get(cleanUser);
  if (existing) {
    return res.status(409).json({ error: '该账号已存在，请直接登录或更换账号名' });
  }

  const hasAdmin = db.prepare("SELECT id FROM users WHERE role = 'admin' LIMIT 1").get();
  const assignedRole = hasAdmin ? 'user' : 'admin';

  const passwordHash = hashPassword(cleanPass);
  const result = db
    .prepare(
      'INSERT INTO users (username, display_name, password_hash, role) VALUES (?, ?, ?, ?)'
    )
    .run(cleanUser, cleanName, passwordHash, assignedRole);

  const userId = Number(result.lastInsertRowid);
  ensureUserLevels(userId);

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  const token = signToken(user);
  setAuthCookie(req, res, token);

  res.status(201).json({ user: sanitizeUser(user), token });
});

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body || {};
  const cleanUser = String(username || '').trim().toLowerCase();
  const cleanPass = String(password || '');

  const user = db
    .prepare('SELECT * FROM users WHERE username = ?')
    .get(cleanUser);

  if (!user || !verifyPassword(cleanPass, user.password_hash)) {
    return res.status(401).json({ error: '账号或密码不正确' });
  }

  ensureUserLevels(user.id);
  const token = signToken(user);
  setAuthCookie(req, res, token);

  res.json({ user: sanitizeUser(user), token });
});

app.post('/api/auth/demo', (_req, res) => {
  const demoUsername = 'baba_demo';
  let user = db
    .prepare('SELECT * FROM users WHERE username = ?')
    .get(demoUsername);

  if (!user) {
    const hash = hashPassword('123456');
    const result = db
      .prepare(
        'INSERT INTO users (username, display_name, password_hash) VALUES (?, ?, ?)'
      )
      .run(demoUsername, '李先生（体验账号）', hash);
    const userId = Number(result.lastInsertRowid);
    ensureUserLevels(userId);
    user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  }

  const token = signToken(user);
  setAuthCookie(req, res, token);
  res.json({ user: sanitizeUser(user), token });
});

app.post('/api/auth/logout', (_req, res) => {
  res.clearCookie('mc_token');
  res.json({ ok: true });
});

app.get('/api/auth/me', authMiddleware, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId);
  if (!user) {
    return res.status(401).json({ error: '用户不存在' });
  }
  ensureUserLevels(user.id);
  res.json({ user: sanitizeUser(user) });
});

app.patch('/api/auth/preferences', authMiddleware, (req, res) => {
  const { fontScale, soundEnabled, dailyGoalMinutes, displayName } = req.body || {};
  const current = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId);
  if (!current) return res.status(404).json({ error: '用户不存在' });

  const nextFont = fontScale === 'normal' || fontScale === 'large' ? fontScale : current.font_scale;
  const nextSound = typeof soundEnabled === 'boolean' ? (soundEnabled ? 1 : 0) : current.sound_enabled;
  const nextGoal =
    Number.isFinite(Number(dailyGoalMinutes)) && Number(dailyGoalMinutes) >= 5 && Number(dailyGoalMinutes) <= 60
      ? Math.round(Number(dailyGoalMinutes))
      : current.daily_goal_minutes;
  const nextName =
    typeof displayName === 'string' && displayName.trim().length > 0
      ? displayName.trim().slice(0, 24)
      : current.display_name;

  db.prepare(
    `UPDATE users SET font_scale = ?, sound_enabled = ?, daily_goal_minutes = ?, display_name = ? WHERE id = ?`
  ).run(nextFont, nextSound, nextGoal, nextName, req.userId);

  const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId);
  res.json({ user: sanitizeUser(updated) });
});

function buildOverview(userId) {
  ensureUserLevels(userId);

  const levels = db
    .prepare(
      'SELECT module_id, current_level, best_score, total_sessions, updated_at FROM user_module_levels WHERE user_id = ?'
    )
    .all(userId);

  const todayRows = db
    .prepare(
      `SELECT module_id, duration_sec, score, accuracy
       FROM training_sessions
       WHERE user_id = ? AND date(created_at) = date('now', 'localtime')`
    )
    .all(userId);

  const todaySeconds = todayRows.reduce((sum, r) => sum + (r.duration_sec || 0), 0);
  const todayModules = [...new Set(todayRows.map((r) => r.module_id))];

  const dailyRows = db
    .prepare(
      `SELECT date(created_at) as day,
              COUNT(*) as sessions,
              SUM(duration_sec) as total_sec,
              ROUND(AVG(accuracy), 1) as avg_accuracy
       FROM training_sessions
       WHERE user_id = ? AND date(created_at) >= date('now', 'localtime', '-13 days')
       GROUP BY date(created_at)
       ORDER BY day ASC`
    )
    .all(userId);

  const allDays = db
    .prepare(
      `SELECT DISTINCT date(created_at) as day
       FROM training_sessions
       WHERE user_id = ?
       ORDER BY day DESC`
    )
    .all(userId)
    .map((r) => r.day);

  let streakDays = 0;
  if (allDays.length > 0) {
    const todayStr = db.prepare("SELECT date('now', 'localtime') as d").get().d;
    const yesterdayStr = db.prepare("SELECT date('now', 'localtime', '-1 day') as d").get().d;
    if (allDays[0] === todayStr || allDays[0] === yesterdayStr) {
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
  }

  const domainStats = db
    .prepare(
      `SELECT module_id,
              COUNT(*) as count,
              ROUND(AVG(accuracy), 1) as avg_accuracy,
              ROUND(AVG(avg_reaction_ms)) as avg_reaction_ms,
              MAX(score) as max_score
       FROM training_sessions
       WHERE user_id = ?
       GROUP BY module_id`
    )
    .all(userId);

  return {
    levels,
    today: {
      minutes: Math.round(todaySeconds / 60),
      seconds: todaySeconds,
      sessionsCount: todayRows.length,
      completedModules: todayModules,
    },
    streakDays,
    recentDays: dailyRows,
    domainStats,
  };
}

function avgField(rows, field) {
  const valid = rows.filter((r) => Number.isFinite(r[field]) && (field !== 'avg_reaction_ms' || r[field] > 0));
  if (valid.length === 0) return null;
  return Math.round(valid.reduce((sum, r) => sum + r[field], 0) / valid.length);
}

function buildEffectiveness(userId) {
  const allRows = db
    .prepare(
      `SELECT id, module_id, difficulty_level, score, accuracy, avg_reaction_ms, created_at
       FROM training_sessions
       WHERE user_id = ?
       ORDER BY id ASC`
    )
    .all(userId);

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
    accuracy: Math.round(r.accuracy),
    reactionMs: r.avg_reaction_ms,
    level: r.difficulty_level,
    date: r.created_at.slice(5, 10),
  }));

  return { byModule, trend };
}

app.get('/api/training/overview', authMiddleware, (req, res) => {
  res.json(buildOverview(req.userId));
});

app.get('/api/training/effectiveness', authMiddleware, (req, res) => {
  res.json(buildEffectiveness(req.userId));
});

app.get('/api/auth/share-token', authMiddleware, (req, res) => {
  const row = db.prepare('SELECT share_token FROM users WHERE id = ?').get(req.userId);
  res.json({ shareToken: row?.share_token || null });
});

app.post('/api/auth/share-token', authMiddleware, (req, res) => {
  const existing = db.prepare('SELECT share_token FROM users WHERE id = ?').get(req.userId);
  let token = existing?.share_token;
  if (!token) {
    token = crypto.randomBytes(10).toString('hex');
    db.prepare('UPDATE users SET share_token = ? WHERE id = ?').run(token, req.userId);
  }
  res.json({ shareToken: token });
});

app.delete('/api/auth/share-token', authMiddleware, (req, res) => {
  db.prepare('UPDATE users SET share_token = NULL WHERE id = ?').run(req.userId);
  res.json({ shareToken: null });
});

app.get('/api/share/:token', (req, res) => {
  const token = String(req.params.token || '').trim();
  if (!token) return res.status(404).json({ error: '无效的查看链接' });
  const user = db.prepare('SELECT id, display_name FROM users WHERE share_token = ?').get(token);
  if (!user) {
    return res.status(404).json({ error: '该家属查看链接不存在或已失效' });
  }
  const overview = buildOverview(user.id);
  const effectiveness = buildEffectiveness(user.id);
  const sessions = db
    .prepare(
      `SELECT id, module_id, difficulty_level, score, accuracy, avg_reaction_ms, duration_sec, trials_completed, created_at
       FROM training_sessions
       WHERE user_id = ?
       ORDER BY id DESC
       LIMIT 15`
    )
    .all(user.id);

  res.json({
    displayName: user.display_name,
    overview,
    effectiveness,
    sessions,
  });
});

// Admin endpoints
app.get('/api/admin/users', authMiddleware, adminMiddleware, (_req, res) => {
  const rows = db
    .prepare(
      `SELECT u.id, u.username, u.display_name, u.role, u.created_at,
              COUNT(s.id) as total_sessions,
              MAX(s.created_at) as last_active_at
       FROM users u
       LEFT JOIN training_sessions s ON s.user_id = u.id
       GROUP BY u.id
       ORDER BY u.id ASC`
    )
    .all();

  res.json({
    users: rows.map((r) => ({
      id: r.id,
      username: r.username,
      displayName: r.display_name,
      role: r.role || 'user',
      createdAt: r.created_at,
      totalSessions: r.total_sessions || 0,
      lastActiveAt: r.last_active_at || null,
    })),
  });
});

app.get('/api/admin/users/:id/report', authMiddleware, adminMiddleware, (req, res) => {
  const targetId = Number(req.params.id);
  const user = db.prepare('SELECT id, display_name FROM users WHERE id = ?').get(targetId);
  if (!user) return res.status(404).json({ error: '用户不存在' });

  const sessions = db
    .prepare(
      `SELECT id, module_id, difficulty_level, score, accuracy, avg_reaction_ms, duration_sec, trials_completed, created_at
       FROM training_sessions
       WHERE user_id = ?
       ORDER BY id DESC
       LIMIT 15`
    )
    .all(user.id);

  res.json({
    displayName: user.display_name,
    overview: buildOverview(user.id),
    effectiveness: buildEffectiveness(user.id),
    sessions,
  });
});

app.post('/api/admin/users/:id/reset-password', authMiddleware, adminMiddleware, (req, res) => {
  const targetId = Number(req.params.id);
  const newPassword = String(req.body?.newPassword || '');
  if (newPassword.length < 4) {
    return res.status(400).json({ error: '新密码至少需要 4 位' });
  }
  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(targetId);
  if (!user) return res.status(404).json({ error: '用户不存在' });

  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(newPassword), targetId);
  res.json({ ok: true });
});

app.delete('/api/admin/users/:id', authMiddleware, adminMiddleware, (req, res) => {
  const targetId = Number(req.params.id);
  if (targetId === req.userId) {
    return res.status(400).json({ error: '不能删除当前登录的管理员账号' });
  }
  db.prepare('DELETE FROM users WHERE id = ?').run(targetId);
  res.json({ ok: true });
});

app.post('/api/training/sessions', authMiddleware, (req, res) => {
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

  ensureUserLevels(req.userId);

  const cleanAcc = Math.max(0, Math.min(100, Number(accuracy) || 0));
  const cleanScore = Math.max(0, Math.round(Number(score) || 0));
  const cleanLevel = Math.max(1, Math.min(10, Math.round(Number(difficultyLevel) || 1)));
  const cleanReaction = Math.max(0, Math.round(Number(avgReactionMs) || 0));
  const cleanDuration = Math.max(1, Math.round(Number(durationSec) || 0));
  const cleanTrials = Math.max(0, Math.round(Number(trialsCompleted) || 0));

  db.prepare(
    `INSERT INTO training_sessions
     (user_id, module_id, difficulty_level, score, accuracy, avg_reaction_ms, duration_sec, trials_completed, details_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    req.userId,
    moduleId,
    cleanLevel,
    cleanScore,
    cleanAcc,
    cleanReaction,
    cleanDuration,
    cleanTrials,
    details ? JSON.stringify(details) : null
  );

  const current = db
    .prepare(
      'SELECT current_level, best_score, total_sessions FROM user_module_levels WHERE user_id = ? AND module_id = ?'
    )
    .get(req.userId, moduleId);

  let nextLevel = current ? current.current_level : cleanLevel;
  let levelChange = 0;

  // Adaptive staircase rule from cognitive training RCTs:
  // >= 85% accuracy promotes difficulty; < 60% steps down to prevent frustration
  if (cleanAcc >= 85 && nextLevel < 10) {
    nextLevel += 1;
    levelChange = 1;
  } else if (cleanAcc < 60 && nextLevel > 1) {
    nextLevel -= 1;
    levelChange = -1;
  }

  const nextBest = Math.max(current?.best_score || 0, cleanScore);
  const nextTotal = (current?.total_sessions || 0) + 1;

  db.prepare(
    `UPDATE user_module_levels
     SET current_level = ?, best_score = ?, total_sessions = ?, updated_at = datetime('now', 'localtime')
     WHERE user_id = ? AND module_id = ?`
  ).run(nextLevel, nextBest, nextTotal, req.userId, moduleId);

  res.status(201).json({
    saved: true,
    nextLevel,
    levelChange,
    bestScore: nextBest,
  });
});

app.get('/api/training/sessions', authMiddleware, (req, res) => {
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
  const rows = db
    .prepare(
      `SELECT id, module_id, difficulty_level, score, accuracy, avg_reaction_ms, duration_sec, trials_completed, created_at
       FROM training_sessions
       WHERE user_id = ?
       ORDER BY id DESC
       LIMIT ?`
    )
    .all(req.userId, limit);

  res.json({ sessions: rows });
});

app.get('/api/spaced/due', authMiddleware, (req, res) => {
  const rows = db
    .prepare(
      `SELECT item_key, interval_days, ease_factor, repetitions, next_review_at
       FROM spaced_items
       WHERE user_id = ? AND next_review_at <= datetime('now', 'localtime')`
    )
    .all(req.userId);
  res.json({ dueItems: rows });
});

app.post('/api/spaced/review', authMiddleware, (req, res) => {
  const { results } = req.body || {};
  if (!Array.isArray(results)) {
    return res.status(400).json({ error: '无效的复习结果' });
  }

  const selectStmt = db.prepare(
    'SELECT * FROM spaced_items WHERE user_id = ? AND item_key = ?'
  );
  const upsertStmt = db.prepare(`
    INSERT INTO spaced_items (user_id, item_key, interval_days, ease_factor, repetitions, next_review_at, last_reviewed_at)
    VALUES (?, ?, ?, ?, ?, datetime('now', 'localtime', ?), datetime('now', 'localtime'))
    ON CONFLICT(user_id, item_key) DO UPDATE SET
      interval_days = excluded.interval_days,
      ease_factor = excluded.ease_factor,
      repetitions = excluded.repetitions,
      next_review_at = excluded.next_review_at,
      last_reviewed_at = excluded.last_reviewed_at
  `);

  for (const item of results) {
    const key = String(item.itemKey || '');
    const correct = Boolean(item.correct);
    if (!key) continue;

    const existing = selectStmt.get(req.userId, key);
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

    upsertStmt.run(req.userId, key, interval, ef, reps, `+${interval} days`);
  }

  res.json({ ok: true });
});

// Serve built frontend in production
const clientDist = path.join(process.cwd(), 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`MemoryCare server running at http://0.0.0.0:${PORT}`);
});
