import crypto from 'node:crypto';
import { db } from './db.js';

export function hashPassword(password) {
  return crypto.createHash('sha256').update(password + 's3cr3t').digest('hex');
}

export function verifyPassword(password, stored) {
  return crypto.timingSafeEqual(Buffer.from(hashPassword(password)), Buffer.from(stored));
}

export function createSessionForUser(userId) {
  const token = crypto.randomBytes(24).toString('hex');
  db.prepare('INSERT INTO sessions (token, user_id) VALUES (?, ?)').run(token, userId);
  return token;
}

export function userFromToken(token) {
  if (!token) return null;
  const row = db.prepare(`
    SELECT u.id, u.username, u.role FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.token = ?
  `).get(token);
  return row || null;
}

export function destroySession(token) {
  if (token) db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
}

export function parseCookies(cookieHeader) {
  const out = {};
  if (!cookieHeader) return out;
  for (const part of cookieHeader.split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (k) out[k] = decodeURIComponent(rest.join('='));
  }
  return out;
}

export function setSessionCookie(res, token) {
  res.setHeader('Set-Cookie', `session=${token}; Path=/; HttpOnly; SameSite=Lax`);
}

export function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', 'session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
}

export function currentSession(req) {
  const cookies = parseCookies(req.headers.cookie);
  return userFromToken(cookies.session);
}