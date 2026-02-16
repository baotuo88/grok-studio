/**
 * API 调用和工具函数模块
 */
const API = {
  config: null,

  /**
   * 设置配置
   */
  setConfig(config) {
    this.config = config;
  },

  /**
   * 标准化媒体 URL（兼容相对路径、协议相对路径、带引号字符串）
   */
  normalizeUrl(url) {
    if (!url || typeof url !== 'string') return null;

    let value = url.trim();
    value = value.replace(/^['"`]+|['"`]+$/g, '');
    value = value.replace(/[)\],.;]+$/g, '');

    if (!value) return null;
    if (/^data:/i.test(value) || /^blob:/i.test(value)) return value;
    if (/^https?:\/\//i.test(value)) return value;
    if (value.startsWith('//')) return `${window.location.protocol}${value}`;

    if (value.startsWith('/')) {
      try {
        if (this.config?.base) {
          const base = new URL(this.config.base);
          return `${base.origin}${value}`;
        }
      } catch (e) {
        console.warn('解析 API Base URL 失败:', e);
      }
      return `${window.location.origin}${value}`;
    }

    try {
      if (this.config?.base) {
        const baseWithSlash = this.config.base.endsWith('/') ? this.config.base : `${this.config.base}/`;
        return new URL(value, baseWithSlash).toString();
      }
    } catch (e) {
      console.warn('拼接相对 URL 失败:', e);
    }

    return value;
  },

  /**
   * 构建媒体 URL 候选列表（兼容 /v1 前缀差异）
   */
  getMediaUrlCandidates(url) {
    const normalized = this.normalizeUrl(url);
    if (!normalized) return [];

    const set = new Set([normalized]);

    if (!this.config?.base) {
      return Array.from(set);
    }

    try {
      const base = new URL(this.config.base);
      const baseOrigin = base.origin;
      const basePath = base.pathname.replace(/\/+$/, '');
      const current = new URL(normalized);

      if (current.origin === baseOrigin && basePath && basePath !== '/') {
        const normalizedPath = current.pathname.startsWith('/')
          ? current.pathname
          : `/${current.pathname}`;

        // 候选：/v1 + /path（当服务把媒体挂在 API 版本路径下）
        if (!normalizedPath.startsWith(`${basePath}/`) && normalizedPath !== basePath) {
          const withBasePath = new URL(baseOrigin);
          withBasePath.pathname = `${basePath}${normalizedPath}`;
          withBasePath.search = current.search;
          set.add(withBasePath.toString());
        }
      }
    } catch (e) {
      console.warn('构建媒体候选 URL 失败:', e);
    }

    return Array.from(set);
  },

  /**
   * 尝试请求媒体，按候选 URL 依次重试
   */
  async fetchMedia(url, timeoutMs = 18000) {
    const candidates = this.getMediaUrlCandidates(url);
    if (candidates.length === 0) {
      throw new Error('无效媒体 URL');
    }

    let lastError = null;

    for (const candidate of candidates) {
      let timeoutId = null;
      const controller = new AbortController();
      try {
        timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        const res = await fetch(candidate, {
          headers: this.getMediaHeaders(candidate),
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          return { response: res, finalUrl: candidate };
        }

        let detail = '';
        try {
          const errJson = await res.clone().json();
          detail = errJson?.detail || errJson?.error?.message || '';
        } catch (_) {
          // ignore parse error
        }

        lastError = new Error(detail || `HTTP ${res.status}`);
      } catch (e) {
        lastError = e;
      } finally {
        if (timeoutId) clearTimeout(timeoutId);
      }
    }

    throw lastError || new Error('媒体请求失败');
  },

  /**
   * 为媒体资源请求构建请求头（同源 API 资源附带 Authorization）
   */
  getMediaHeaders(url) {
    const headers = {};
    if (!this.config?.key || !this.config?.base || !url) return headers;

    try {
      const mediaUrl = new URL(url);
      const apiBase = new URL(this.config.base);
      if (mediaUrl.origin === apiBase.origin) {
        headers.Authorization = `Bearer ${this.config.key}`;
      }
    } catch (e) {
      console.warn('解析媒体 URL 失败:', e);
    }

    return headers;
  },

  /**
   * 从内容中提取 URL
   */
  extractUrl(content, depth = 0) {
    if (depth > 5 || content == null) return null;

    if (typeof content === 'string') {
      return this.extractUrlFromString(content);
    }

    if (Array.isArray(content)) {
      for (const item of content) {
        const url = this.extractUrl(item, depth + 1);
        if (url) return url;
      }
      return null;
    }

    if (typeof content === 'object') {
      if (typeof content.url === 'string') {
        return this.normalizeUrl(content.url);
      }

      if (typeof content.image_url === 'string') {
        return this.normalizeUrl(content.image_url);
      }

      if (content.image_url && typeof content.image_url.url === 'string') {
        return this.normalizeUrl(content.image_url.url);
      }

      if (typeof content.b64_json === 'string' && content.b64_json) {
        return `data:image/png;base64,${content.b64_json}`;
      }

      const fields = ['content', 'text', 'output', 'data', 'result', 'message'];
      for (const key of fields) {
        if (content[key] == null) continue;
        const url = this.extractUrl(content[key], depth + 1);
        if (url) return url;
      }

      for (const value of Object.values(content)) {
        const url = this.extractUrl(value, depth + 1);
        if (url) return url;
      }
    }

    return null;
  },

  /**
   * 从字符串中提取 URL
   */
  extractUrlFromString(content) {
    if (!content) return null;

    const cleaned = content.replace(/```[\s\S]*?```/g, '').trim();

    if (
      /^https?:\/\//i.test(cleaned) ||
      cleaned.startsWith('/') ||
      cleaned.startsWith('//') ||
      cleaned.startsWith('data:image/')
    ) {
      return this.normalizeUrl(cleaned);
    }

    const markdownImageMatch = cleaned.match(/!\[[^\]]*\]\(([^)]+)\)/);
    if (markdownImageMatch?.[1]) {
      return this.normalizeUrl(markdownImageMatch[1]);
    }

    const markdownLinkMatch = cleaned.match(/\[[^\]]+\]\(([^)]+)\)/);
    if (markdownLinkMatch?.[1]) {
      return this.normalizeUrl(markdownLinkMatch[1]);
    }

    const urlMatch = cleaned.match(/(https?:\/\/[^\s<>"{}|\\^`\[\]]+|\/[^\s<>"{}|\\^`\[\]]+)/);
    if (urlMatch?.[1]) {
      return this.normalizeUrl(urlMatch[1]);
    }

    return null;
  },

  /**
   * POST JSON 请求
   */
  async post(endpoint, body) {
    if (!Config.isValid(this.config)) {
      throw new Error('API 配置未完成');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000);

    try {
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.key}`
      };

      const res = await fetch(this.config.base + endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error?.message || `请求失败: HTTP ${res.status}`);
      }

      return await res.json();
    } catch (e) {
      clearTimeout(timeoutId);
      if (e.name === 'AbortError') {
        throw new Error('请求超时，请稍后重试');
      }
      throw e;
    }
  },

  /**
   * POST FormData 请求
   */
  async postForm(endpoint, formData) {
    if (!Config.isValid(this.config)) {
      throw new Error('请先配置 API Base URL 和 Key');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000);

    try {
      const res = await fetch(this.config.base + endpoint, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${this.config.key}` },
        body: formData,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error?.message || `请求失败: HTTP ${res.status}`);
      }

      return await res.json();
    } catch (e) {
      clearTimeout(timeoutId);
      if (e.name === 'AbortError') {
        throw new Error('请求超时，请稍后重试');
      }
      throw e;
    }
  },

  /**
   * GET 请求
   */
  async get(endpoint) {
    if (!Config.isValid(this.config)) {
      throw new Error('API 配置未完成');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const headers = {
        'Authorization': `Bearer ${this.config.key}`
      };

      const res = await fetch(this.config.base + endpoint, {
        method: 'GET',
        headers,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error?.message || `请求失败: HTTP ${res.status}`);
      }

      return await res.json();
    } catch (e) {
      clearTimeout(timeoutId);
      if (e.name === 'AbortError') {
        throw new Error('请求超时，请稍后重试');
      }
      throw e;
    }
  },

  /**
   * 获取可用模型列表
   */
  async getModels() {
    try {
      const data = await this.get('/models');
      if (!data.data || !Array.isArray(data.data)) {
        throw new Error('模型列表格式错误');
      }
      return data.data;
    } catch (e) {
      console.error('获取模型列表失败:', e);
      return [];
    }
  }
};

/**
 * Blob URL 管理器
 */
const BlobManager = {
  urls: new Set(),

  add(url) {
    this.urls.add(url);
  },

  revoke(url) {
    if (this.urls.has(url)) {
      URL.revokeObjectURL(url);
      this.urls.delete(url);
    }
  },

  revokeAll() {
    this.urls.forEach(url => URL.revokeObjectURL(url));
    this.urls.clear();
  }
};

/**
 * 文件下载工具
 */
async function downloadFile(url) {
  const mediaUrl = API.normalizeUrl(url);
  if (!mediaUrl) {
    if (window.UI?.showError) {
      UI.showError('无效的下载链接');
    } else {
      alert('无效的下载链接');
    }
    return;
  }

  try {
    const { response, finalUrl } = await API.fetchMedia(mediaUrl, 20000);
    const filename = finalUrl.split('/').pop().split('?')[0] || 'grok_file';

    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
  } catch (e) {
    const candidates = API.getMediaUrlCandidates(mediaUrl);
    try {
      const a = document.createElement('a');
      a.href = candidates[0] || mediaUrl;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      console.error('打开下载链接失败:', err);
    }

    if (window.UI?.showError) {
      UI.showError(`下载失败：${e.message || '资源不可访问'}（已尝试新窗口打开）`);
    } else {
      alert('下载失败，已尝试新窗口打开');
    }
  }
}
