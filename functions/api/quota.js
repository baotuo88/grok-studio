const QUOTA_PREFIX = 'grok_quota_';

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

function getQuotaKey(username) {
  return `${QUOTA_PREFIX}${username}`;
}

function getDefaultQuota() {
  return {
    chatLimit: 100,
    imageLimit: 50,
    chatUsed: 0,
    imageUsed: 0,
    lastReset: new Date().toDateString()
  };
}

function normalizeQuota(input = {}) {
  const defaults = getDefaultQuota();
  const toSafeInt = (value, fallback) => {
    const num = Number(value);
    if (!Number.isFinite(num)) return fallback;
    return Math.max(0, Math.floor(num));
  };

  const chatLimit = toSafeInt(input.chatLimit, defaults.chatLimit);
  const imageLimit = toSafeInt(input.imageLimit, defaults.imageLimit);
  const chatUsed = Math.min(toSafeInt(input.chatUsed, defaults.chatUsed), chatLimit);
  const imageUsed = Math.min(toSafeInt(input.imageUsed, defaults.imageUsed), imageLimit);

  return {
    chatLimit,
    imageLimit,
    chatUsed,
    imageUsed,
    lastReset: typeof input.lastReset === 'string' && input.lastReset
      ? input.lastReset
      : defaults.lastReset
  };
}

function resetQuotaIfNeeded(quota) {
  const today = new Date().toDateString();
  if (quota.lastReset !== today) {
    quota.chatUsed = 0;
    quota.imageUsed = 0;
    quota.lastReset = today;
    return true;
  }
  return false;
}

async function readQuota(kv, username) {
  const key = getQuotaKey(username);
  const raw = await kv.get(key);
  let quota = getDefaultQuota();

  if (raw) {
    try {
      quota = normalizeQuota(JSON.parse(raw));
    } catch (_) {
      quota = getDefaultQuota();
    }
  }

  const changedByReset = resetQuotaIfNeeded(quota);
  if (!raw || changedByReset) {
    await kv.put(key, JSON.stringify(quota));
  }

  return quota;
}

async function writeQuota(kv, username, quota) {
  const normalized = normalizeQuota(quota);
  const key = getQuotaKey(username);
  await kv.put(key, JSON.stringify(normalized));
  return normalized;
}

export async function onRequest(context) {
  const { request, env } = context;
  const kv = getKv(env);

  if (!kv) {
    return json({ error: 'KV 绑定 GROK_STORE 未配置' }, 501);
  }

  const method = request.method;

  if (method === 'GET') {
    const url = new URL(request.url);
    const username = normalizeUsername(url.searchParams.get('username'));
    if (!username) {
      return json({ error: 'username 不能为空' }, 400);
    }

    try {
      const quota = await readQuota(kv, username);
      return json({ quota });
    } catch (e) {
      return json({ error: `读取用户配额失败: ${e.message}` }, 500);
    }
  }

  if (method === 'POST') {
    let body;
    try {
      body = await request.json();
    } catch (_) {
      return json({ error: '请求体必须是 JSON' }, 400);
    }

    const username = normalizeUsername(body?.username);
    const type = body?.type;
    if (!username) {
      return json({ error: 'username 不能为空' }, 400);
    }
    if (type !== 'chat' && type !== 'image') {
      return json({ error: 'type 必须是 chat 或 image' }, 400);
    }

    try {
      const quota = await readQuota(kv, username);

      if (type === 'chat') {
        if (quota.chatUsed >= quota.chatLimit) {
          return json({ error: `已达到每日聊天次数限制（${quota.chatLimit}次）` }, 400);
        }
        quota.chatUsed += 1;
      } else {
        if (quota.imageUsed >= quota.imageLimit) {
          return json({ error: `已达到每日图像生成次数限制（${quota.imageLimit}次）` }, 400);
        }
        quota.imageUsed += 1;
      }

      const saved = await writeQuota(kv, username, quota);
      return json({ ok: true, quota: saved });
    } catch (e) {
      return json({ error: `更新用户配额失败: ${e.message}` }, 500);
    }
  }

  if (method === 'PUT') {
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
      return json({ error: 'username 不能为空' }, 400);
    }

    const inputQuota = body?.quota || {};

    try {
      const saved = await writeQuota(kv, username, inputQuota);
      return json({ ok: true, quota: saved });
    } catch (e) {
      return json({ error: `设置用户配额失败: ${e.message}` }, 500);
    }
  }

  if (method === 'DELETE') {
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
      return json({ error: 'username 不能为空' }, 400);
    }

    try {
      await kv.delete(getQuotaKey(username));
      return json({ ok: true });
    } catch (e) {
      return json({ error: `删除用户配额失败: ${e.message}` }, 500);
    }
  }

  return json({ error: 'Method Not Allowed' }, 405);
}
