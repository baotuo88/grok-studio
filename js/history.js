/**
 * 历史记录管理模块
 */
const History = {
  db: null,

  /**
   * 初始化数据库
   */
  init() {
    const dbName = UserManager.getUserDBName('GrokImagineDB');
    this.db = new Dexie(dbName);
    this.db.version(1).stores({
      history: '++id, url, isVideo, prompt, timestamp'
    });
  },

  /**
   * 从 localStorage 迁移旧数据到 IndexedDB
   */
  async migrateFromLocalStorage(historyKey) {
    try {
      const oldItems = localStorage.getItem(historyKey);
      if (!oldItems) return;

      const items = JSON.parse(oldItems);
      if (!Array.isArray(items)) return;

      for (const item of items) {
        if (!item || !item.url) continue;
        const existing = await this.db.history.where('url').equals(item.url).first();
        if (existing) continue;

        await this.db.history.add({
          url: item.url,
          isVideo: item.isVideo || false,
          prompt: (item.prompt || '').substring(0, 200),
          timestamp: item.timestamp || Date.now()
        });
      }

      localStorage.removeItem(historyKey);
      console.log('历史记录已迁移到 IndexedDB');
    } catch (e) {
      console.error('迁移失败', e);
    }
  },

  /**
   * 加载历史记录
   */
  async load() {
    try {
      const items = await this.db.history.orderBy('timestamp').reverse().toArray();
      return items;
    } catch (e) {
      console.error('加载历史失败', e);
      return [];
    }
  },

  /**
   * 保存新记录
   */
  async save(url, isVideo, prompt) {
    try {
      const existing = await this.db.history.where('url').equals(url).first();
      if (existing) return;

      await this.db.history.add({
        url,
        isVideo,
        prompt: prompt.substring(0, 200),
        timestamp: Date.now()
      });
    } catch (e) {
      console.error('保存历史失败', e);
    }
  },

  /**
   * 根据 URL 删除单条记录
   */
  async deleteByUrl(url) {
    try {
      await this.db.history.where('url').equals(url).delete();
    } catch (e) {
      console.error('删除历史失败', e);
    }
  },

  /**
   * 清除所有历史记录
   */
  async clear() {
    await this.db.history.clear();
  }
};
