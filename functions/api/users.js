const USERS_KEY = 'grok_shared_users';
const MAX_USERS = 10000;

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
  return username.trim().slice(0, 64);
}

async function readUsers(kv) {
  const raw = await kv.get(USERS_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(normalizeUsername)
      .filter(Boolean);
  } catch (_) {
    return [];
  }
}

async function writeUsers(kv, users) {
  await kv.put(USERS_KEY, JSON.stringify(users));
}

export async function onRequest(context) {
  const { request, env } = context;
  const kv = getKv(env);

  if (!kv) {
    return json({ error: 'KV 绑定 GROK_STORE 未配置' }, 501);
  }

  if (request.method === 'GET') {
    try {
      const users = await readUsers(kv);
      return json({ users });
    } catch (e) {
      return json({ error: `读取用户列表失败: ${e.message}` }, 500);
    }
  }

  if (request.method === 'POST') {
    let body;
    try {
      body = await request.json();
    } catch (_) {
      return json({ error: '请求体必须是 JSON' }, 400);
    }

    const username = normalizeUsername(body?.username);
    if (!username) {
      return json({ error: '用户名不能为空' }, 400);
    }

    try {
      const users = await readUsers(kv);
      if (!users.includes(username)) {
        if (users.length >= MAX_USERS) {
          return json({ error: '用户数量已达上限' }, 400);
        }
        users.push(username);
        await writeUsers(kv, users);
      }
      return json({ ok: true, users });
    } catch (e) {
      return json({ error: `注册用户失败: ${e.message}` }, 500);
    }
  }

  if (request.method === 'DELETE') {
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
    if (!username) {
      return json({ error: '用户名不能为空' }, 400);
    }

    try {
      const users = await readUsers(kv);
      const nextUsers = users.filter(item => item !== username);
      await writeUsers(kv, nextUsers);
      return json({ ok: true, users: nextUsers });
    } catch (e) {
      return json({ error: `删除用户失败: ${e.message}` }, 500);
    }
  }

  return json({ error: 'Method Not Allowed' }, 405);
}
