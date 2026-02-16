const USERS_KEY = 'grok_shared_users';
const ACCOUNT_PREFIX = 'grok_account_';
const QUOTA_PREFIX = 'grok_quota_';
const RESERVED_ADMIN = 'admin';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    }
  });
}

function getKv(env) {
  return env?.GROK_STORE || null;
}

function isWriteAuthorized(request, env) {
  const expectedToken = env?.ADMIN_WRITE_TOKEN;
  if (!expectedToken) {
    return true;
  }

  const requestToken = (request.headers.get('x-admin-token') || '').trim();
  return requestToken && requestToken === expectedToken;
}

function normalizeUsername(username) {
  if (typeof username !== 'string') return '';
  return username.trim();
}

function canonicalUsername(username) {
  return normalizeUsername(username).toLowerCase();
}

function validateUsername(username) {
  if (!username) {
    return '用户名不能为空';
  }
  if (username.length < 2 || username.length > 32) {
    return '用户名长度需在 2 到 32 个字符之间';
  }
  if (/\s/.test(username)) {
    return '用户名不能包含空白字符';
  }
  return '';
}

function validatePassword(password) {
  if (typeof password !== 'string' || password.length < 6) {
    return '密码至少需要 6 个字符';
  }
  return '';
}

function accountKey(usernameCanonical) {
  return `${ACCOUNT_PREFIX}${usernameCanonical}`;
}

function quotaKey(username) {
  return `${QUOTA_PREFIX}${username}`;
}

function toHex(buffer) {
  const view = new Uint8Array(buffer);
  let out = '';
  for (const value of view) {
    out += value.toString(16).padStart(2, '0');
  }
  return out;
}

function randomSalt() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return toHex(bytes.buffer);
}

async function hashPassword(password, salt) {
  const payload = new TextEncoder().encode(`${salt}:${password}`);
  const digest = await crypto.subtle.digest('SHA-256', payload);
  return toHex(digest);
}

async function ensureUserListContains(kv, username) {
  const raw = await kv.get(USERS_KEY);
  let users = [];

  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        users = parsed
          .filter(item => typeof item === 'string')
          .map(item => item.trim())
          .filter(Boolean);
      }
    } catch (_) {
      users = [];
    }
  }

  if (!users.includes(username)) {
    users.push(username);
    await kv.put(USERS_KEY, JSON.stringify(users));
  }
}

async function removeUserFromList(kv, username) {
  const raw = await kv.get(USERS_KEY);
  if (!raw) return;

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return;

    const nextUsers = parsed.filter(item => item !== username);
    await kv.put(USERS_KEY, JSON.stringify(nextUsers));
  } catch (_) {
    // ignore malformed list
  }
}

async function handleRegister(kv, body) {
  const username = normalizeUsername(body?.username);
  const usernameCanonical = canonicalUsername(username);
  const password = body?.password;

  const usernameError = validateUsername(username);
  if (usernameError) {
    return json({ error: usernameError }, 400);
  }

  if (usernameCanonical === RESERVED_ADMIN) {
    return json({ error: 'admin 为系统保留账号，不能注册' }, 400);
  }

  const passwordError = validatePassword(password);
  if (passwordError) {
    return json({ error: passwordError }, 400);
  }

  const key = accountKey(usernameCanonical);
  const existing = await kv.get(key);
  if (existing) {
    return json({ error: '用户名已存在，请更换后重试' }, 409);
  }

  const salt = randomSalt();
  const passwordHash = await hashPassword(password, salt);
  const now = Date.now();
  const account = {
    username,
    usernameCanonical,
    passwordHash,
    salt,
    createdAt: now,
    updatedAt: now,
    lastLoginAt: now
  };

  await kv.put(key, JSON.stringify(account));
  await ensureUserListContains(kv, username);

  return json({ ok: true, username });
}

async function handleLogin(kv, body) {
  const username = normalizeUsername(body?.username);
  const usernameCanonical = canonicalUsername(username);
  const password = body?.password;

  const usernameError = validateUsername(username);
  if (usernameError) {
    return json({ error: usernameError }, 400);
  }

  const passwordError = validatePassword(password);
  if (passwordError) {
    return json({ error: passwordError }, 400);
  }

  const key = accountKey(usernameCanonical);
  const raw = await kv.get(key);
  if (!raw) {
    return json({ error: '用户不存在，请先注册' }, 404);
  }

  let account;
  try {
    account = JSON.parse(raw);
  } catch (_) {
    return json({ error: '账号数据异常，请联系管理员处理' }, 500);
  }

  const computedHash = await hashPassword(password, account.salt || '');
  if (!account.passwordHash || computedHash !== account.passwordHash) {
    return json({ error: '用户名或密码错误' }, 401);
  }

  account.lastLoginAt = Date.now();
  account.updatedAt = Date.now();
  await kv.put(key, JSON.stringify(account));
  await ensureUserListContains(kv, account.username || username);

  return json({ ok: true, username: account.username || username });
}

async function handleDelete(kv, request, env) {
  if (!isWriteAuthorized(request, env)) {
    return json({ error: '未授权写入，请检查 x-admin-token' }, 401);
  }

  let body;
  try {
    body = await request.json();
  } catch (_) {
    return json({ error: '请求体必须是 JSON' }, 400);
  }

  const username = normalizeUsername(body?.username);
  const usernameCanonical = canonicalUsername(username);
  if (!username) {
    return json({ error: '用户名不能为空' }, 400);
  }

  if (usernameCanonical === RESERVED_ADMIN) {
    return json({ error: '不能删除管理员账号' }, 400);
  }

  try {
    await kv.delete(accountKey(usernameCanonical));
    await removeUserFromList(kv, username);
    await kv.delete(quotaKey(username));
    return json({ ok: true });
  } catch (e) {
    return json({ error: `删除账号失败: ${e.message}` }, 500);
  }
}

export async function onRequest(context) {
  const { request, env } = context;
  const kv = getKv(env);

  if (!kv) {
    return json({ error: 'KV 绑定 GROK_STORE 未配置' }, 501);
  }

  if (request.method === 'POST') {
    let body;
    try {
      body = await request.json();
    } catch (_) {
      return json({ error: '请求体必须是 JSON' }, 400);
    }

    const action = body?.action;
    if (action === 'register') {
      return handleRegister(kv, body);
    }
    if (action === 'login') {
      return handleLogin(kv, body);
    }

    return json({ error: 'action 必须是 register 或 login' }, 400);
  }

  if (request.method === 'DELETE') {
    return handleDelete(kv, request, env);
  }

  return json({ error: 'Method Not Allowed' }, 405);
}
