/**
 * 配置管理模块
 */
const Config = {
  storageKey: 'grok_imagine_config',
  defaults: {
    base: '',
    key: '',
    historyKey: 'grok_imagine_history'
  },

  /**
   * 加载配置（优先从 URL 参数，其次从管理员配置，最后从用户配置）
   */
  load() {
    const params = new URLSearchParams(location.search);
    const fromUrl = {
      base: params.get('base') || '',
      key: params.get('key') || '',
      historyKey: params.get('historyKey') || this.defaults.historyKey
    };

    if (fromUrl.base && fromUrl.key) {
      this.save(fromUrl);
      return fromUrl;
    }

    // 如果是管理员，加载管理员配置
    if (UserManager.isAdmin()) {
      const adminConfig = UserManager.getAdminConfig();
      if (adminConfig && adminConfig.base && adminConfig.key) {
        return { ...this.defaults, ...adminConfig };
      }
    } else {
      // 普通用户，优先使用管理员配置
      const adminConfig = UserManager.getAdminConfig();
      if (adminConfig && adminConfig.base && adminConfig.key) {
        return { ...this.defaults, ...adminConfig };
      }
    }

    // 加载用户自己的配置
    try {
      const saved = localStorage.getItem(this.storageKey);
      if (saved) {
        return { ...this.defaults, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.error('加载配置失败', e);
    }

    return { ...this.defaults };
  },

  /**
   * 保存配置到 localStorage（管理员保存到管理员配置）
   */
  save(config) {
    try {
      if (UserManager.isAdmin()) {
        UserManager.saveAdminConfig(config);
      } else {
        localStorage.setItem(this.storageKey, JSON.stringify(config));
      }
    } catch (e) {
      console.error('保存配置失败', e);
    }
  },

  /**
   * 验证配置是否有效
   */
  isValid(config) {
    return config.base && config.key && config.base.trim() && config.key.trim();
  }
};
