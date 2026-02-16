const CONFIG_KEY = 'grok_shared_admin_config';

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

export async function onRequest(context) {
  const { request, env } = context;
  const kv = getKv(env);

  if (!kv) {
    return json({ error: 'KV 绑定 GROK_STORE 未配置' }, 501);
  }

  if (request.method === 'GET') {
    try {
      const raw = await kv.get(CONFIG_KEY);
      const config = raw ? JSON.parse(raw) : null;
      return json({ config });
    } catch (e) {
      return json({ error: `读取共享配置失败: ${e.message}` }, 500);
    }
  }

  if (request.method === 'PUT') {
    if (!isWriteAuthorized(request, env)) {
      return json({ error: '未授权写入，请检查 x-admin-token' }, 401);
    }

    let body;
    try {
      body = await request.json();
    } catch (_) {
      return json({ error: '请求体必须是 JSON' }, 400);
    }

    const input = body?.config || body || {};
    const base = typeof input.base === 'string' ? input.base.trim() : '';
    const key = typeof input.key === 'string' ? input.key.trim() : '';

    if (!base || !key) {
      return json({ error: '配置缺少 base 或 key' }, 400);
    }

    const config = {
      base: base.replace(/\/+$/, ''),
      key,
      historyKey: 'grok_imagine_history',
      updatedAt: Date.now()
    };

    try {
      await kv.put(CONFIG_KEY, JSON.stringify(config));
      return json({ ok: true, config });
    } catch (e) {
      return json({ error: `保存共享配置失败: ${e.message}` }, 500);
    }
  }

  return json({ error: 'Method Not Allowed' }, 405);
}
