const USERS_KEY = 'grok_shared_users';
const ACCOUNT_PREFIX = 'grok_account_';
const QUOTA_PREFIX = 'grok_quota_';
const ADMIN_ACCOUNT_KEY = 'grok_admin_account';
const RESERVED_ADMIN = 'admin';
const DEFAULT_ADMIN_PASSWORD = 'admin123';

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

function getBootstrapAdminPassword(env) {
  const configured = typeof env?.ADMIN_DEFAULT_PASSWORD === 'string'
    ? env.ADMIN_DEFAULT_PASSWORD.trim()
    : '';
  if (configured.length >= 6) {
    return configured;
  }
  return DEFAULT_ADMIN_PASSWORD;
}

function isValidAdminAccount(account) {
  return !!account
    && typeof account === 'object'
    && typeof account.passwordHash === 'string'
    && account.passwordHash.length > 0
    && typeof account.salt === 'string'
    && account.salt.length > 0;
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

async function getAdminAccount(kv) {
  const raw = await kv.get(ADMIN_ACCOUNT_KEY);
  if (!raw) {
    return null;
  }

  let account;
  try {
    account = JSON.parse(raw);
  } catch (_) {
    throw new Error('管理员账号数据异常，请联系管理员处理');
  }

  if (!isValidAdminAccount(account)) {
    throw new Error('管理员账号数据异常，请联系管理员处理');
  }

  return account;
}

async function ensureAdminAccount(kv, env) {
  const existing = await getAdminAccount(kv);
  if (existing) {
    return existing;
  }

  const salt = randomSalt();
  const now = Date.now();
  const account = {
    username: RESERVED_ADMIN,
    usernameCanonical: RESERVED_ADMIN,
    passwordHash: await hashPassword(getBootstrapAdminPassword(env), salt),
    salt,
    createdAt: now,
    updatedAt: now,
    lastLoginAt: 0,
    mustChangePassword: true
  };

  await kv.put(ADMIN_ACCOUNT_KEY, JSON.stringify(account));
  await ensureUserListContains(kv, RESERVED_ADMIN);
  return account;
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

async function handleAdminLogin(kv, body, env) {
  const password = body?.password;
  const passwordError = validatePassword(password);
  if (passwordError) {
    return json({ error: passwordError }, 400);
  }

  let account;
  try {
    account = await ensureAdminAccount(kv, env);
  } catch (e) {
    return json({ error: e.message || '管理员账号读取失败' }, 500);
  }

  const computedHash = await hashPassword(password, account.salt);
  if (computedHash !== account.passwordHash) {
    return json({ error: '管理员密码错误' }, 401);
  }

  const now = Date.now();
  account.username = RESERVED_ADMIN;
  account.usernameCanonical = RESERVED_ADMIN;
  account.lastLoginAt = now;
  account.updatedAt = now;
  await kv.put(ADMIN_ACCOUNT_KEY, JSON.stringify(account));
  await ensureUserListContains(kv, RESERVED_ADMIN);

  return json({
    ok: true,
    username: RESERVED_ADMIN,
    firstLogin: account.mustChangePassword !== false
  });
}

async function handleAdminChangePassword(kv, body, env) {
  const oldPassword = body?.oldPassword;
  const newPassword = body?.newPassword;

  const oldPasswordError = validatePassword(oldPassword);
  if (oldPasswordError) {
    return json({ error: `原密码无效：${oldPasswordError}` }, 400);
  }

  const newPasswordError = validatePassword(newPassword);
  if (newPasswordError) {
    return json({ error: newPasswordError }, 400);
  }

  if (oldPassword === newPassword) {
    return json({ error: '新密码不能与原密码相同' }, 400);
  }

  let account;
  try {
    account = await ensureAdminAccount(kv, env);
  } catch (e) {
    return json({ error: e.message || '管理员账号读取失败' }, 500);
  }

  const oldHash = await hashPassword(oldPassword, account.salt);
  if (oldHash !== account.passwordHash) {
    return json({ error: '原密码错误' }, 401);
  }

  const salt = randomSalt();
  const now = Date.now();
  account.username = RESERVED_ADMIN;
  account.usernameCanonical = RESERVED_ADMIN;
  account.passwordHash = await hashPassword(newPassword, salt);
  account.salt = salt;
  account.updatedAt = now;
  account.lastLoginAt = account.lastLoginAt || now;
  account.mustChangePassword = false;
  if (typeof account.createdAt !== 'number') {
    account.createdAt = now;
  }

  await kv.put(ADMIN_ACCOUNT_KEY, JSON.stringify(account));
  await ensureUserListContains(kv, RESERVED_ADMIN);

  return json({ ok: true, username: RESERVED_ADMIN, firstLogin: false });
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
    if (action === 'admin_login') {
      return handleAdminLogin(kv, body, env);
    }
    if (action === 'admin_change_password') {
      return handleAdminChangePassword(kv, body, env);
    }

    return json({ error: 'action 必须是 register、login、admin_login 或 admin_change_password' }, 400);
  }

  if (request.method === 'DELETE') {
    return handleDelete(kv, request, env);
  }

  return json({ error: 'Method Not Allowed' }, 405);
}
