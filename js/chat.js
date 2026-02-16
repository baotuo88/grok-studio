/**
 * 聊天功能模块 - 支持多会话管理
 */
const Chat = {
  db: null,
  currentSessionId: null,
  currentMessages: [],
  systemPrompt: [
    '你是中文助手。',
    '回答要优先清晰和可执行，默认使用简洁结构：结论 + 关键点 + 需要时给步骤。',
    '当输出表格或列表时，避免冗长段落，控制在用户可快速阅读的长度。'
  ].join(' '),

  /**
   * 初始化数据库
   */
  init() {
    const dbName = UserManager.getUserDBName('GrokChatDB');
    this.db = new Dexie(dbName);
    this.db.version(1).stores({
      sessions: '++id, title, createdAt, updatedAt',
      messages: '++id, sessionId, role, content, timestamp'
    });
  },

  /**
   * 创建新会话
   */
  async createSession(title = null) {
    const session = {
      title: title || `对话 ${new Date().toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}`,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    
    const id = await this.db.sessions.add(session);
    this.currentSessionId = id;
    this.currentMessages = [];
    return id;
  },

  /**
   * 获取所有会话列表
   */
  async getSessions() {
    try {
      const sessions = await this.db.sessions.orderBy('updatedAt').reverse().toArray();
      return sessions;
    } catch (e) {
      console.error('获取会话列表失败:', e);
      return [];
    }
  },

  /**
   * 切换到指定会话
   */
  async switchSession(sessionId) {
    this.currentSessionId = sessionId;
    await this.loadMessages(sessionId);
  },

  /**
   * 加载会话消息
   */
  async loadMessages(sessionId) {
    try {
      const messages = await this.db.messages
        .where('sessionId').equals(sessionId)
        .sortBy('timestamp');
      this.currentMessages = messages;
      return messages;
    } catch (e) {
      console.error('加载消息失败:', e);
      return [];
    }
  },

  /**
   * 重命名会话
   */
  async renameSession(sessionId, newTitle) {
    try {
      await this.db.sessions.update(sessionId, {
        title: newTitle,
        updatedAt: Date.now()
      });
    } catch (e) {
      console.error('重命名会话失败:', e);
    }
  },

  /**
   * 删除会话
   */
  async deleteSession(sessionId) {
    try {
      await this.db.messages.where('sessionId').equals(sessionId).delete();
      await this.db.sessions.delete(sessionId);
      
      if (this.currentSessionId === sessionId) {
        this.currentSessionId = null;
        this.currentMessages = [];
      }
    } catch (e) {
      console.error('删除会话失败:', e);
    }
  },

  /**
   * 标准化助手返回内容（兼容字符串/数组/对象）
   */
  normalizeContent(content) {
    if (typeof content === 'string') return content;

    if (Array.isArray(content)) {
      return content
        .map(item => {
          if (typeof item === 'string') return item;
          if (item?.type === 'text' && typeof item.text === 'string') return item.text;
          if (typeof item?.text === 'string') return item.text;
          return '';
        })
        .filter(Boolean)
        .join('\n\n');
    }

    if (content && typeof content === 'object') {
      if (typeof content.text === 'string') return content.text;
      if (typeof content.content === 'string') return content.content;
      return JSON.stringify(content, null, 2);
    }

    return '';
  },

  /**
   * 发送聊天消息（支持文件附件）
   */
  async sendMessage(content, model, files = []) {
    // 如果没有当前会话，创建一个
    if (!this.currentSessionId) {
      await this.createSession();
    }

    // 构建消息内容（支持多模态）
    let messageContent = content;
    if (files.length > 0) {
      // 如果有文件，构建多模态消息格式
      messageContent = [
        { type: 'text', text: content }
      ];
      
      // 添加文件内容
      files.forEach(file => {
        if (file.type === 'image') {
          messageContent.push({
            type: 'image_url',
            image_url: { url: file.data }
          });
        } else {
          // 文档类型，添加文本说明
          messageContent[0].text += `\n\n[附件: ${file.name}]`;
        }
      });
    }

    const userMessage = {
      sessionId: this.currentSessionId,
      role: 'user',
      content: messageContent,
      files: files, // 保存文件信息用于显示
      timestamp: Date.now()
    };

    // 保存用户消息到数据库
    await this.db.messages.add(userMessage);
    this.currentMessages.push(userMessage);

    // 更新会话时间
    await this.db.sessions.update(this.currentSessionId, {
      updatedAt: Date.now()
    });

    try {
      // 构建API请求消息
      const apiMessages = [
        { role: 'system', content: this.systemPrompt },
        ...this.currentMessages.map(m => ({
          role: m.role,
          content: m.content
        }))
      ];

      const response = await API.post('/chat/completions', {
        model: model,
        messages: apiMessages,
        stream: false
      });

      if (!response.choices || !response.choices[0]) {
        throw new Error('无效的响应格式');
      }

      const assistantMessage = {
        sessionId: this.currentSessionId,
        role: 'assistant',
        content: this.normalizeContent(response.choices[0].message?.content),
        timestamp: Date.now()
      };

      // 保存助手消息到数据库
      await this.db.messages.add(assistantMessage);
      this.currentMessages.push(assistantMessage);

      // 更新会话时间
      await this.db.sessions.update(this.currentSessionId, {
        updatedAt: Date.now()
      });

      return assistantMessage;

    } catch (e) {
      console.error('发送消息失败:', e);
      throw e;
    }
  },

  /**
   * 清空当前对话历史
   */
  clearHistory() {
    this.currentMessages = [];
    this.currentSessionId = null;
  },

  /**
   * 获取当前对话历史
   */
  getHistory() {
    return this.currentMessages;
  },

  /**
   * 获取当前会话ID
   */
  getCurrentSessionId() {
    return this.currentSessionId;
  }
};
