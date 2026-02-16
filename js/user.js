/**
 * 用户管理模块
 */
const UserManager = {
  currentUser: null,
  ADMIN_USERNAME: 'admin',
  ADMIN_PASSWORD: 'admin123', // 管理员默认密码
  STORAGE_KEY: 'grok_current_user',
  ADMIN_CONFIG_KEY: 'grok_admin_config',
  ADMIN_PASSWORD_KEY: 'grok_admin_password',
  ADMIN_FIRST_LOGIN_KEY: 'grok_admin_first_login',
  REMEMBER_ME_KEY: 'grok_remember_me',
  SESSION_EXPIRY_KEY: 'grok_session_expiry',
  USERS_LIST_KEY: 'grok_users_list', // 用户列表
  ADMIN_WRITE_TOKEN_KEY: 'grok_admin_write_token', // 可选：Cloudflare 写入令牌
  CLOUD_CONFIG_ENDPOINT: '/api/shared-config',
  CLOUD_USERS_ENDPOINT: '/api/users',

  /**
   * 初始化用户系统
   */
  init() {
    const savedUser = localStorage.getItem(this.STORAGE_KEY);
    if (savedUser) {
      try {
        this.currentUser = JSON.parse(savedUser);
        
        // 检查会话是否过期（只在有记住我选项时检查）
        const rememberMe = localStorage.getItem(this.REMEMBER_ME_KEY);
        if (rememberMe === 'true') {
          const sessionExpiry = localStorage.getItem(this.SESSION_EXPIRY_KEY);
          if (sessionExpiry) {
            const expiryTime = parseInt(sessionExpiry);
            if (Date.now() > expiryTime) {
              // 会话已过期，清除登录状态
              this.logout();
              return;
            }
          }
        } else {
          // 没有记住我选项，设置默认24小时过期
          const sessionExpiry = localStorage.getItem(this.SESSION_EXPIRY_KEY);
          if (!sessionExpiry) {
            const expiryTime = Date.now() + (24 * 60 * 60 * 1000);
            localStorage.setItem(this.SESSION_EXPIRY_KEY, expiryTime.toString());
          } else {
            const expiryTime = parseInt(sessionExpiry);
            if (Date.now() > expiryTime) {
              this.logout();
              return;
            }
          }
        }

        if (this.currentUser && this.currentUser.username) {
          this.registerUser(this.currentUser.username);
        }
      } catch (e) {
        this.currentUser = null;
      }
    }
  },

  /**
   * 检查是否已登录
   */
  isLoggedIn() {
    return this.currentUser !== null;
  },

  /**
   * 获取当前用户
   */
  getCurrentUser() {
    return this.currentUser;
  },

  /**
   * 检查是否是管理员
   */
  isAdmin() {
    return this.currentUser && this.currentUser.username === this.ADMIN_USERNAME;
  },

  /**
   * 检查管理员是否是首次登录
   */
  isAdminFirstLogin() {
    const firstLogin = localStorage.getItem(this.ADMIN_FIRST_LOGIN_KEY);
    return firstLogin === null || firstLogin === 'true';
  },

  /**
   * 标记管理员已完成首次登录
   */
  markAdminFirstLoginComplete() {
    localStorage.setItem(this.ADMIN_FIRST_LOGIN_KEY, 'false');
  },

  /**
   * 获取管理员密码
   */
  getAdminPassword() {
    const savedPassword = localStorage.getItem(this.ADMIN_PASSWORD_KEY);
    return savedPassword || this.ADMIN_PASSWORD;
  },

  /**
   * 修改管理员密码
   */
  changeAdminPassword(oldPassword, newPassword) {
    if (!this.isAdmin()) {
      throw new Error('只有管理员可以修改密码');
    }

    const currentPassword = this.getAdminPassword();
    if (oldPassword !== currentPassword) {
      throw new Error('原密码错误');
    }

    if (!newPassword || newPassword.length < 6) {
      throw new Error('新密码至少需要6个字符');
    }

    localStorage.setItem(this.ADMIN_PASSWORD_KEY, newPassword);
    this.markAdminFirstLoginComplete();
  },

  /**
   * 设置记住我选项
   */
  setRememberMe(remember, days = 7) {
    if (remember) {
      localStorage.setItem(this.REMEMBER_ME_KEY, 'true');
      // 设置会话过期时间（天数转换为毫秒）
      const expiryTime = Date.now() + (days * 24 * 60 * 60 * 1000);
      localStorage.setItem(this.SESSION_EXPIRY_KEY, expiryTime.toString());
    } else {
      localStorage.removeItem(this.REMEMBER_ME_KEY);
      // 设置会话过期时间为24小时
      const expiryTime = Date.now() + (24 * 60 * 60 * 1000);
      localStorage.setItem(this.SESSION_EXPIRY_KEY, expiryTime.toString());
    }
  },

  /**
   * 检查是否启用了记住我
   */
  isRememberMeEnabled() {
    return localStorage.getItem(this.REMEMBER_ME_KEY) === 'true';
  },

  /**
   * 用户登录
   */
  login(username, password = null, rememberMe = false) {
    if (!username || !username.trim()) {
      throw new Error('用户名不能为空');
    }

    const trimmedUsername = username.trim();
    
    // 如果是管理员，需要验证密码
    if (trimmedUsername === this.ADMIN_USERNAME) {
      if (!password) {
        throw new Error('管理员需要输入密码');
      }
      const currentPassword = this.getAdminPassword();
      if (password !== currentPassword) {
        throw new Error('管理员密码错误');
      }
    }

    const user = {
      username: trimmedUsername,
      loginTime: Date.now()
    };

    this.currentUser = user;
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(user));
    
    // 注册用户到用户列表
    this.registerUser(trimmedUsername);
    
    // 设置记住我选项
    this.setRememberMe(rememberMe);
    
    return user;
  },

  /**
   * 用户登出
   */
  logout() {
    this.currentUser = null;
    localStorage.removeItem(this.STORAGE_KEY);
    localStorage.removeItem(this.SESSION_EXPIRY_KEY);
  },

  /**
   * 获取管理员配置
   */
  getAdminConfig() {
    const config = localStorage.getItem(this.ADMIN_CONFIG_KEY);
    if (config) {
      try {
        return JSON.parse(config);
      } catch (e) {
        return null;
      }
    }
    return null;
  },

  /**
   * 保存管理员配置
   */
  saveAdminConfig(config) {
    if (!this.isAdmin()) {
      throw new Error('只有管理员可以保存配置');
    }
    localStorage.setItem(this.ADMIN_CONFIG_KEY, JSON.stringify(config));
  },

  /**
   * 获取 Cloudflare 写入令牌（可选）
   */
  getCloudAdminToken() {
    const token = localStorage.getItem(this.ADMIN_WRITE_TOKEN_KEY);
    return token ? token.trim() : '';
  },

  /**
   * 请求 Cloudflare Pages Functions（可选）
   */
  async requestCloud(endpoint, options = {}) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
      const res = await fetch(endpoint, {
        credentials: 'same-origin',
        ...options,
        signal: controller.signal
      });

      if (res.status === 404 || res.status === 501) {
        return null;
      }

      let payload = null;
      try {
        payload = await res.json();
      } catch (_) {
        payload = null;
      }

      if (!res.ok) {
        const message = payload?.error || `HTTP ${res.status}`;
        throw new Error(message);
      }

      return payload;
    } catch (e) {
      if (e.name === 'AbortError') {
        return null;
      }
      throw e;
    } finally {
      clearTimeout(timeoutId);
    }
  },

  /**
   * 从 Cloudflare KV 拉取管理员配置并同步到本地
   */
  async syncAdminConfigFromCloud() {
    try {
      const data = await this.requestCloud(this.CLOUD_CONFIG_ENDPOINT, { method: 'GET' });
      const cloudConfig = data?.config;
      if (cloudConfig && cloudConfig.base && cloudConfig.key) {
        localStorage.setItem(this.ADMIN_CONFIG_KEY, JSON.stringify(cloudConfig));
        return cloudConfig;
      }
    } catch (e) {
      console.warn('拉取云端管理员配置失败:', e);
    }
    return null;
  },

  /**
   * 将管理员配置同步到 Cloudflare KV
   */
  async syncAdminConfigToCloud(config) {
    if (!this.isAdmin()) {
      return { ok: false, reason: 'not_admin' };
    }

    try {
      const headers = { 'Content-Type': 'application/json' };
      const token = this.getCloudAdminToken();
      if (token) {
        headers['x-admin-token'] = token;
      }

      const payload = await this.requestCloud(this.CLOUD_CONFIG_ENDPOINT, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ config })
      });

      if (payload === null) {
        return { ok: false, reason: 'cloud_unavailable' };
      }

      return { ok: true };
    } catch (e) {
      return { ok: false, reason: e.message || 'sync_failed' };
    }
  },

  /**
   * 注册用户到 Cloudflare KV（可选）
   */
  async registerUserToCloud(username) {
    if (!username) return;

    try {
      const payload = await this.requestCloud(this.CLOUD_USERS_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username })
      });
      if (payload === null) {
        return;
      }
    } catch (e) {
      console.warn('云端注册用户失败:', e);
    }
  },

  /**
   * 获取 Cloudflare KV 用户列表（可选）
   */
  async getCloudUsers() {
    try {
      const data = await this.requestCloud(this.CLOUD_USERS_ENDPOINT, { method: 'GET' });
      if (!data || !Array.isArray(data.users)) {
        return [];
      }
      return data.users.filter(u => typeof u === 'string' && u.trim());
    } catch (e) {
      console.warn('获取云端用户列表失败:', e);
      return [];
    }
  },

  /**
   * 从 Cloudflare KV 删除用户（可选）
   */
  async removeUserFromCloud(username) {
    if (!username) return;

    try {
      const headers = { 'Content-Type': 'application/json' };
      const token = this.getCloudAdminToken();
      if (token) {
        headers['x-admin-token'] = token;
      }

      await this.requestCloud(this.CLOUD_USERS_ENDPOINT, {
        method: 'DELETE',
        headers,
        body: JSON.stringify({ username })
      });
    } catch (e) {
      console.warn('云端删除用户失败:', e);
    }
  },

  /**
   * 获取用户的数据库名称
   */
  getUserDBName(baseName) {
    if (!this.currentUser) {
      return baseName;
    }
    return `${baseName}_${this.currentUser.username}`;
  },

  /**
   * 注册用户到用户列表
   */
  registerUser(username) {
    try {
      if (!username || !username.trim()) {
        return;
      }

      const normalizedUsername = username.trim();
      const usersList = this.getUsersList();
      if (!usersList.includes(normalizedUsername)) {
        usersList.push(normalizedUsername);
        localStorage.setItem(this.USERS_LIST_KEY, JSON.stringify(usersList));
      }

      this.registerUserToCloud(normalizedUsername).catch(() => {});
    } catch (e) {
      console.error('注册用户失败:', e);
    }
  },

  /**
   * 获取用户列表
   */
  getUsersList() {
    try {
      const saved = localStorage.getItem(this.USERS_LIST_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error('获取用户列表失败:', e);
    }
    return [];
  },

  /**
   * 获取所有用户列表（从注册列表和数据库中合并）
   */
  getAllUsers() {
    const users = new Set(this.getUsersList());

    if (this.currentUser && this.currentUser.username) {
      users.add(this.currentUser.username);
    }
    
    // 从数据库键名中提取用户名（兼容旧数据）
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;

      const chatPrefix = 'GrokChatDB_';
      const imagePrefix = 'GrokImagineDB_';
      if (key.startsWith(chatPrefix)) {
        users.add(key.substring(chatPrefix.length));
      } else if (key.startsWith(imagePrefix)) {
        users.add(key.substring(imagePrefix.length));
      }
    }
    
    return Array.from(users).filter(Boolean);
  },

  /**
   * 从 IndexedDB 获取用户（兼容旧数据）
   */
  async getIndexedDBUsers() {
    if (typeof Dexie === 'undefined' || typeof Dexie.getDatabaseNames !== 'function') {
      return [];
    }

    try {
      const names = await Dexie.getDatabaseNames();
      const users = new Set();

      names.forEach(name => {
        if (typeof name !== 'string') return;
        if (name.startsWith('GrokChatDB_')) {
          users.add(name.substring('GrokChatDB_'.length));
        } else if (name.startsWith('GrokImagineDB_')) {
          users.add(name.substring('GrokImagineDB_'.length));
        }
      });

      return Array.from(users).filter(Boolean);
    } catch (e) {
      console.warn('读取 IndexedDB 用户失败:', e);
      return [];
    }
  },

  /**
   * 获取所有用户列表（本地 + IndexedDB + Cloudflare KV）
   */
  async getAllUsersAsync() {
    const users = new Set(this.getAllUsers());
    const indexedUsers = await this.getIndexedDBUsers();
    indexedUsers.forEach(username => users.add(username));

    const cloudUsers = await this.getCloudUsers();
    cloudUsers.forEach(username => users.add(username));

    return Array.from(users)
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'));
  },

  /**
   * 获取用户配额信息
   */
  getUserQuota(username) {
    const quotaKey = `grok_user_quota_${username}`;
    const quota = localStorage.getItem(quotaKey);
    if (quota) {
      try {
        return JSON.parse(quota);
      } catch (e) {
        return this.getDefaultQuota();
      }
    }
    return this.getDefaultQuota();
  },

  /**
   * 获取默认配额
   */
  getDefaultQuota() {
    return {
      chatLimit: 100,        // 每日聊天次数限制
      imageLimit: 50,        // 每日图像生成次数限制
      chatUsed: 0,           // 已使用聊天次数
      imageUsed: 0,          // 已使用图像生成次数
      lastReset: new Date().toDateString()  // 上次重置日期
    };
  },

  /**
   * 设置用户配额
   */
  setUserQuota(username, quota) {
    if (!this.isAdmin()) {
      throw new Error('只有管理员可以设置配额');
    }
    const quotaKey = `grok_user_quota_${username}`;
    localStorage.setItem(quotaKey, JSON.stringify(quota));
  },

  /**
   * 检查并重置每日配额
   */
  checkAndResetDailyQuota(username) {
    const quota = this.getUserQuota(username);
    const today = new Date().toDateString();
    
    if (quota.lastReset !== today) {
      // 新的一天，重置使用次数
      quota.chatUsed = 0;
      quota.imageUsed = 0;
      quota.lastReset = today;
      const quotaKey = `grok_user_quota_${username}`;
      localStorage.setItem(quotaKey, JSON.stringify(quota));
    }
    
    return quota;
  },

  /**
   * 增加使用次数
   */
  incrementUsage(type) {
    if (!this.currentUser) {
      throw new Error('用户未登录');
    }

    const username = this.currentUser.username;
    const quota = this.checkAndResetDailyQuota(username);

    if (type === 'chat') {
      if (quota.chatUsed >= quota.chatLimit) {
        throw new Error(`已达到每日聊天次数限制（${quota.chatLimit}次）`);
      }
      quota.chatUsed++;
    } else if (type === 'image') {
      if (quota.imageUsed >= quota.imageLimit) {
        throw new Error(`已达到每日图像生成次数限制（${quota.imageLimit}次）`);
      }
      quota.imageUsed++;
    }

    const quotaKey = `grok_user_quota_${username}`;
    localStorage.setItem(quotaKey, JSON.stringify(quota));
    
    return quota;
  },

  /**
   * 获取当前用户配额状态
   */
  getCurrentUserQuota() {
    if (!this.currentUser) {
      return null;
    }
    return this.checkAndResetDailyQuota(this.currentUser.username);
  },

  /**
   * 记录使用统计
   */
  recordUsage(type, details = {}) {
    if (!this.currentUser) {
      return;
    }

    const statsKey = `grok_usage_stats_${this.currentUser.username}`;
    let stats = [];
    
    try {
      const saved = localStorage.getItem(statsKey);
      if (saved) {
        stats = JSON.parse(saved);
      }
    } catch (e) {
      stats = [];
    }

    stats.push({
      type,
      timestamp: Date.now(),
      date: new Date().toISOString(),
      ...details
    });

    // 只保留最近1000条记录
    if (stats.length > 1000) {
      stats = stats.slice(-1000);
    }

    localStorage.setItem(statsKey, JSON.stringify(stats));
  },

  /**
   * 获取使用统计
   */
  getUsageStats(username = null) {
    const targetUsername = username || (this.currentUser ? this.currentUser.username : null);
    if (!targetUsername) {
      return [];
    }

    const statsKey = `grok_usage_stats_${targetUsername}`;
    try {
      const saved = localStorage.getItem(statsKey);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      return [];
    }
    return [];
  },

  /**
   * 获取统计摘要
   */
  getStatsSummary(username = null) {
    const stats = this.getUsageStats(username);
    const today = new Date().toDateString();
    const thisMonth = new Date().getMonth();
    const thisYear = new Date().getFullYear();

    const summary = {
      total: {
        chat: 0,
        image: 0
      },
      today: {
        chat: 0,
        image: 0
      },
      thisMonth: {
        chat: 0,
        image: 0
      },
      thisYear: {
        chat: 0,
        image: 0
      }
    };

    stats.forEach(stat => {
      const statDate = new Date(stat.timestamp);
      const statDateStr = statDate.toDateString();
      const statMonth = statDate.getMonth();
      const statYear = statDate.getFullYear();

      // 总计
      if (stat.type === 'chat') {
        summary.total.chat++;
      } else if (stat.type === 'image') {
        summary.total.image++;
      }

      // 今日
      if (statDateStr === today) {
        if (stat.type === 'chat') {
          summary.today.chat++;
        } else if (stat.type === 'image') {
          summary.today.image++;
        }
      }

      // 本月
      if (statMonth === thisMonth && statYear === thisYear) {
        if (stat.type === 'chat') {
          summary.thisMonth.chat++;
        } else if (stat.type === 'image') {
          summary.thisMonth.image++;
        }
      }

      // 本年
      if (statYear === thisYear) {
        if (stat.type === 'chat') {
          summary.thisYear.chat++;
        } else if (stat.type === 'image') {
          summary.thisYear.image++;
        }
      }
    });

    return summary;
  },

  /**
   * 删除用户数据
   */
  deleteUserData(username) {
    if (!this.isAdmin()) {
      throw new Error('只有管理员可以删除用户数据');
    }

    if (username === this.ADMIN_USERNAME) {
      throw new Error('不能删除管理员账户');
    }

    // 删除用户相关的所有数据
    const keysToDelete = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (
        key.includes(`_${username}`) ||
        key === `grok_user_quota_${username}` ||
        key === `grok_usage_stats_${username}`
      )) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => localStorage.removeItem(key));
    
    // 从用户列表中移除
    try {
      const usersList = this.getUsersList();
      const index = usersList.indexOf(username);
      if (index > -1) {
        usersList.splice(index, 1);
        localStorage.setItem(this.USERS_LIST_KEY, JSON.stringify(usersList));
      }
    } catch (e) {
      console.error('从用户列表移除失败:', e);
    }

    this.removeUserFromCloud(username).catch(() => {});
  }
};
