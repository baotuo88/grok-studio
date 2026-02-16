/**
 * Grok AI - 完整版主应用（聊天 + 图像生成）
 */
'use strict';

const MAX_PROMPT_LENGTH = 1000;

// 应用状态
const AppState = {
  config: null,
  images: [],
  chatFiles: [], // 聊天附件
  elements: {},
  models: {
    chat: [],
    image: [],
    video: []
  },
  currentView: 'image' // 'chat' or 'image'
};

/**
 * 初始化 DOM 元素引用
 */
function initElements() {
  AppState.elements = {
    // 通用
    configModal: document.getElementById('configModal'),
    configBase: document.getElementById('configBase'),
    configKey: document.getElementById('configKey'),
    saveConfig: document.getElementById('saveConfig'),
    closeConfig: document.getElementById('closeConfig'),
    openConfig: document.getElementById('openConfig'),
    clearHistory: document.getElementById('clearHistory'),
    
    // 用户登录
    loginModal: document.getElementById('loginModal'),
    loginUsername: document.getElementById('loginUsername'),
    loginPassword: document.getElementById('loginPassword'),
    adminPasswordGroup: document.getElementById('adminPasswordGroup'),
    rememberMeGroup: document.getElementById('rememberMeGroup'),
    rememberMe: document.getElementById('rememberMe'),
    loginBtn: document.getElementById('loginBtn'),
    userInfo: document.getElementById('userInfo'),
    currentUsername: document.getElementById('currentUsername'),
    switchUser: document.getElementById('switchUser'),
    logoutBtn: document.getElementById('logoutBtn'),
    
    // 修改密码
    changePasswordModal: document.getElementById('changePasswordModal'),
    changePasswordBtn: document.getElementById('changePasswordBtn'),
    oldPassword: document.getElementById('oldPassword'),
    newPassword: document.getElementById('newPassword'),
    confirmPassword: document.getElementById('confirmPassword'),
    savePassword: document.getElementById('savePassword'),
    
    // 用户管理
    userManagementModal: document.getElementById('userManagementModal'),
    userManagementBtn: document.getElementById('userManagementBtn'),
    userManagementContent: document.getElementById('userManagementContent'),
    closeUserManagement: document.getElementById('closeUserManagement'),
    
    // 使用统计
    usageStatsModal: document.getElementById('usageStatsModal'),
    usageStatsBtn: document.getElementById('usageStatsBtn'),
    usageStatsContent: document.getElementById('usageStatsContent'),
    closeUsageStats: document.getElementById('closeUsageStats'),
    
    // 标签切换
    tabChat: document.getElementById('tabChat'),
    tabImage: document.getElementById('tabImage'),
    chatView: document.getElementById('chatView'),
    imageView: document.getElementById('imageView'),
    
    // 聊天相关
    chatModel: document.getElementById('chatModel'),
    messagesArea: document.getElementById('messagesArea'),
    chatInput: document.getElementById('chatInput'),
    chatCharCount: document.getElementById('chatCharCount'),
    sendMessage: document.getElementById('sendMessage'),
    chatAttachFile: document.getElementById('chatAttachFile'),
    chatFileInput: document.getElementById('chatFileInput'),
    chatFilePreview: document.getElementById('chatFilePreview'),
    chatFileList: document.getElementById('chatFileList'),
    
    // 图像生成相关
    model: document.getElementById('model'),
    prompt: document.getElementById('prompt'),
    charCount: document.getElementById('charCount'),
    inputImage: document.getElementById('inputImage'),
    previewContainer: document.getElementById('previewContainer'),
    previewGrid: document.getElementById('previewGrid'),
    imageCount: document.getElementById('imageCount'),
    clearImage: document.getElementById('clearImage'),
    referenceLabel: document.getElementById('referenceLabel'),
    imgN: document.getElementById('img-n'),
    strength: document.getElementById('strength'),
    aspect: document.getElementById('aspect'),
    length: document.getElementById('length'),
    nParam: document.getElementById('nParam'),
    strengthParam: document.getElementById('strengthParam'),
    aspectParam: document.getElementById('aspectParam'),
    lengthParam: document.getElementById('lengthParam'),
    generateBtn: document.getElementById('generateBtn'),
    results: document.getElementById('results'),
    empty: document.getElementById('empty'),
    selectAll: document.getElementById('selectAll'),
    downloadSelected: document.getElementById('downloadSelected'),
    cancelSelection: document.getElementById('cancelSelection')
  };
}

/**
 * 切换视图
 */
function switchView(view) {
  AppState.currentView = view;
  
  if (view === 'chat') {
    AppState.elements.chatView.classList.remove('hidden');
    AppState.elements.imageView.classList.add('hidden');
    AppState.elements.tabChat.classList.add('active');
    AppState.elements.tabImage.classList.remove('active');
  } else {
    AppState.elements.chatView.classList.add('hidden');
    AppState.elements.imageView.classList.remove('hidden');
    AppState.elements.tabChat.classList.remove('active');
    AppState.elements.tabImage.classList.add('active');
  }
}

function renderChatEmptyState() {
  return `
    <div class="empty-state">
      <i class="fas fa-comments"></i>
      <p>开始你的第一条消息</p>
      <small>可以提问、写作、总结、代码与创意探索</small>
    </div>
  `;
}

function autoResizeChatInput() {
  const input = AppState.elements.chatInput;
  input.style.height = 'auto';
  input.style.height = `${Math.min(input.scrollHeight, 176)}px`;
}

function updateChatSendState() {
  const hasContent = AppState.elements.chatInput.value.trim().length > 0;
  const hasModel = !!AppState.elements.chatModel.value;
  AppState.elements.sendMessage.disabled = !(hasContent && hasModel);
}

function updateChatCharCount() {
  const count = AppState.elements.chatInput.value.length;
  AppState.elements.chatCharCount.textContent = count;
}

function renderAssistantMarkdown(content) {
  const text = typeof content === 'string' ? content.trim() : '';
  const markdown = text || '（模型返回了空内容）';
  
  // 配置 marked 使用代码高亮
  marked.setOptions({
    gfm: true,
    breaks: true,
    highlight: function(code, lang) {
      if (lang && hljs.getLanguage(lang)) {
        try {
          return hljs.highlight(code, { language: lang }).value;
        } catch (e) {
          console.error('代码高亮失败:', e);
        }
      }
      return hljs.highlightAuto(code).value;
    }
  });
  
  return marked.parse(markdown);
}

function addCodeCopyButtons(contentDiv) {
  const codeBlocks = contentDiv.querySelectorAll('pre code');
  codeBlocks.forEach((codeBlock) => {
    const pre = codeBlock.parentElement;
    if (pre.querySelector('.code-copy-btn')) return; // 已添加
    
    // 检测语言
    const lang = Array.from(codeBlock.classList)
      .find(cls => cls.startsWith('language-'))
      ?.replace('language-', '') || 'code';
    
    // 创建包装器
    const wrapper = document.createElement('div');
    wrapper.className = 'code-block-wrapper';
    pre.parentNode.insertBefore(wrapper, pre);
    wrapper.appendChild(pre);
    
    // 创建头部
    const header = document.createElement('div');
    header.className = 'code-block-header';
    header.innerHTML = `
      <span class="code-block-lang">${lang}</span>
      <button class="code-copy-btn" type="button">
        <i class="fas fa-copy"></i>
        <span>复制</span>
      </button>
    `;
    
    pre.parentNode.insertBefore(header, pre);
    
    // 添加复制功能
    const copyBtn = header.querySelector('.code-copy-btn');
    copyBtn.addEventListener('click', async () => {
      const code = codeBlock.textContent;
      try {
        await navigator.clipboard.writeText(code);
        copyBtn.classList.add('copied');
        copyBtn.innerHTML = '<i class="fas fa-check"></i><span>已复制</span>';
        setTimeout(() => {
          copyBtn.classList.remove('copied');
          copyBtn.innerHTML = '<i class="fas fa-copy"></i><span>复制</span>';
        }, 2000);
      } catch (e) {
        console.error('复制失败:', e);
      }
    });
  });
}

function setModelSelectState(message) {
  const safeMessage = message || '暂无可用模型';
  AppState.elements.chatModel.innerHTML = `<option value="">${safeMessage}</option>`;
  AppState.elements.model.innerHTML = `<option value="">${safeMessage}</option>`;
  updateChatSendState();
}

/**
 * 加载并分类模型
 */
async function loadModels() {
  try {
    const models = await API.getModels();
    
    // 分类模型
    AppState.models.chat = models.filter(m => 
      !m.id.includes('imagine') && !m.id.includes('vision')
    );
    
    AppState.models.image = models.filter(m => 
      m.id.includes('imagine') && !m.id.includes('video') && !m.id.includes('edit')
    );
    
    AppState.models.video = models.filter(m => 
      m.id.includes('video')
    );
    
    const editModels = models.filter(m => m.id.includes('edit'));
    
    // 填充聊天模型下拉框
    AppState.elements.chatModel.innerHTML = '';
    if (AppState.models.chat.length > 0) {
      AppState.models.chat.forEach(model => {
        const option = document.createElement('option');
        option.value = model.id;
        option.textContent = model.id;
        AppState.elements.chatModel.appendChild(option);
      });
    } else {
      AppState.elements.chatModel.innerHTML = '<option value="">无可用聊天模型</option>';
    }
    
    // 填充图像生成模型下拉框
    AppState.elements.model.innerHTML = '';
    
    if (AppState.models.image.length > 0) {
      AppState.models.image.forEach(model => {
        const option = document.createElement('option');
        option.value = model.id;
        option.textContent = `${model.id}（图像生成）`;
        AppState.elements.model.appendChild(option);
      });
    }
    
    if (editModels.length > 0) {
      editModels.forEach(model => {
        const option = document.createElement('option');
        option.value = model.id;
        option.textContent = `${model.id}（图像编辑）`;
        AppState.elements.model.appendChild(option);
      });
    }
    
    if (AppState.models.video.length > 0) {
      AppState.models.video.forEach(model => {
        const option = document.createElement('option');
        option.value = model.id;
        option.textContent = `${model.id}（视频生成）`;
        AppState.elements.model.appendChild(option);
      });
    }
    
    if (AppState.elements.model.children.length === 0) {
      AppState.elements.model.innerHTML = '<option value="">无可用模型</option>';
    }

    updateChatSendState();
    
  } catch (e) {
    console.error('加载模型失败:', e);
    setModelSelectState('模型加载失败');
    UI.showError('加载模型列表失败，请检查 API 配置');
  }
}

/**
 * 处理聊天文件上传
 */
function handleChatFileUpload(files) {
  if (!files || files.length === 0) return;
  
  const maxFiles = 5; // 最多5个文件
  const maxSize = 10 * 1024 * 1024; // 单个文件最大10MB
  
  Array.from(files).slice(0, maxFiles).forEach(file => {
    if (file.size > maxSize) {
      UI.showError(`文件 ${file.name} 超过10MB限制`);
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const fileData = {
        name: file.name,
        type: file.type.startsWith('image/') ? 'image' : 'document',
        data: e.target.result,
        size: file.size
      };
      
      AppState.chatFiles.push(fileData);
      renderChatFilePreview();
    };
    
    reader.onerror = () => {
      UI.showError(`读取文件 ${file.name} 失败`);
    };
    
    reader.readAsDataURL(file);
  });
  
  if (files.length > maxFiles) {
    UI.showError(`最多只能上传${maxFiles}个文件，已自动截取前${maxFiles}个`);
  }
}

/**
 * 渲染聊天文件预览
 */
function renderChatFilePreview() {
  if (AppState.chatFiles.length === 0) {
    AppState.elements.chatFilePreview.classList.add('hidden');
    return;
  }
  
  AppState.elements.chatFilePreview.classList.remove('hidden');
  AppState.elements.chatFileList.innerHTML = '';
  
  AppState.chatFiles.forEach((file, index) => {
    const item = document.createElement('div');
    item.className = 'chat-file-item';
    
    if (file.type === 'image') {
      const img = document.createElement('img');
      img.src = file.data;
      img.alt = file.name;
      item.appendChild(img);
    } else {
      item.classList.add('chat-file-item-doc');
      const icon = document.createElement('i');
      icon.className = 'fas fa-file-alt';
      const name = document.createElement('span');
      name.textContent = file.name;
      item.appendChild(icon);
      item.appendChild(name);
    }
    
    const removeBtn = document.createElement('button');
    removeBtn.className = 'chat-file-remove';
    removeBtn.innerHTML = '<i class="fas fa-times"></i>';
    removeBtn.onclick = () => removeChatFile(index);
    
    item.appendChild(removeBtn);
    AppState.elements.chatFileList.appendChild(item);
  });
}

/**
 * 移除聊天文件
 */
function removeChatFile(index) {
  AppState.chatFiles.splice(index, 1);
  renderChatFilePreview();
}

/**
 * 清空聊天文件
 */
function clearChatFiles() {
  AppState.chatFiles = [];
  AppState.elements.chatFileInput.value = '';
  renderChatFilePreview();
}

/**
 * 添加聊天消息到 UI
 */
function addMessageToUI(role, content, files = []) {
  const emptyState = AppState.elements.messagesArea.querySelector('.empty-state');
  if (emptyState) {
    emptyState.remove();
  }

  const messageDiv = document.createElement('div');
  messageDiv.className = 'message ' + role;
  
  const avatar = document.createElement('div');
  avatar.className = 'message-avatar';
  avatar.innerHTML = role === 'user' ? '<i class="fas fa-user"></i>' : '<i class="fas fa-robot"></i>';
  
  const contentDiv = document.createElement('div');
  contentDiv.className = 'message-content';
  
  if (role === 'assistant') {
    contentDiv.innerHTML = renderAssistantMarkdown(content);
    
    // 添加代码复制按钮
    addCodeCopyButtons(contentDiv);
    
    // 为链接添加属性
    contentDiv.querySelectorAll('a').forEach((link) => {
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
    });
  } else {
    // 用户消息
    // 如果有文件附件，先显示文件
    if (files && files.length > 0) {
      const filesDiv = document.createElement('div');
      filesDiv.className = 'chat-file-list';
      filesDiv.style.marginBottom = '0.5rem';
      
      files.forEach(file => {
        const fileItem = document.createElement('div');
        fileItem.className = 'chat-file-item';
        fileItem.style.cursor = 'default';
        
        if (file.type === 'image') {
          const img = document.createElement('img');
          img.src = file.data;
          img.alt = file.name;
          fileItem.appendChild(img);
        } else {
          fileItem.classList.add('chat-file-item-doc');
          const icon = document.createElement('i');
          icon.className = 'fas fa-file-alt';
          const name = document.createElement('span');
          name.textContent = file.name;
          fileItem.appendChild(icon);
          fileItem.appendChild(name);
        }
        
        filesDiv.appendChild(fileItem);
      });
      
      contentDiv.appendChild(filesDiv);
    }
    
    // 显示文本内容
    const textDiv = document.createElement('div');
    // 提取文本内容（如果是数组格式）
    let textContent = content;
    if (Array.isArray(content)) {
      textContent = content.find(item => item.type === 'text')?.text || '';
    }
    textDiv.textContent = textContent;
    contentDiv.appendChild(textDiv);
  }
  
  messageDiv.appendChild(avatar);
  messageDiv.appendChild(contentDiv);
  
  AppState.elements.messagesArea.appendChild(messageDiv);
  AppState.elements.messagesArea.scrollTop = AppState.elements.messagesArea.scrollHeight;
}

/**
 * 发送聊天消息
 */
async function sendChatMessage() {
  const content = AppState.elements.chatInput.value.trim();
  const model = AppState.elements.chatModel.value;
  const files = [...AppState.chatFiles]; // 复制文件列表
  
  if (!content && files.length === 0) {
    UI.showError('请输入消息或上传文件');
    return;
  }
  
  if (!model) {
    UI.showError('请选择模型');
    return;
  }
  
  // 检查配额
  try {
    UserManager.incrementUsage('chat');
  } catch (e) {
    UI.showError(e.message);
    return;
  }
  
  // 清空输入框和文件
  AppState.elements.chatInput.value = '';
  autoResizeChatInput();
  updateChatSendState();
  updateChatCharCount();
  clearChatFiles();
  
  // 添加用户消息（包含文件）
  addMessageToUI('user', content || '请分析这些文件', files);
  
  // 显示加载状态
  const loadingDiv = document.createElement('div');
  loadingDiv.className = 'message assistant message-loading';
  loadingDiv.innerHTML = `
    <div class="message-avatar"><i class="fas fa-robot"></i></div>
    <div class="message-content"><i class="fas fa-spinner spinner"></i> 思考中...</div>
  `;
  AppState.elements.messagesArea.appendChild(loadingDiv);
  AppState.elements.messagesArea.scrollTop = AppState.elements.messagesArea.scrollHeight;
  
  try {
    const response = await Chat.sendMessage(content || '请分析这些文件', model, files);
    
    // 移除加载状态
    loadingDiv.remove();
    
    // 添加助手回复
    addMessageToUI('assistant', response.content);
    
    // 记录使用统计
    UserManager.recordUsage('chat', { model, messageLength: content.length });
    
    // 更新配额显示
    updateQuotaDisplay();
    
  } catch (e) {
    loadingDiv.remove();
    
    // 更新会话列表
    await loadChatSessions();
    UI.showError(e.message || '发送消息失败');
  }
}

/**
 * 加载聊天会话列表
 */
async function loadChatSessions() {
  const sessions = await Chat.getSessions();
  const sessionsList = document.getElementById('sessionsList');
  
  if (sessions.length === 0) {
    sessionsList.innerHTML = '<div class="sessions-empty">暂无历史会话</div>';
    return;
  }
  
  sessionsList.innerHTML = '';
  sessions.forEach(session => {
    const item = document.createElement('div');
    item.className = 'session-item';
    if (session.id === Chat.getCurrentSessionId()) {
      item.classList.add('active');
    }
    item.dataset.sessionId = session.id;
    
    const timeStr = new Date(session.updatedAt).toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
    
    item.innerHTML = `
      <div class="session-item-icon">
        <i class="fas fa-comment-dots"></i>
      </div>
      <div class="session-item-content">
        <div class="session-item-title">${session.title}</div>
        <div class="session-item-time">${timeStr}</div>
      </div>
      <div class="session-item-actions">
        <button class="session-action-btn rename" title="重命名">
          <i class="fas fa-edit"></i>
        </button>
        <button class="session-action-btn delete" title="删除">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    `;
    
    // 点击切换会话
    item.addEventListener('click', (e) => {
      if (e.target.closest('.session-action-btn')) return;
      switchToSession(session.id);
    });
    
    // 重命名按钮
    item.querySelector('.rename').addEventListener('click', (e) => {
      e.stopPropagation();
      renameSession(session.id, session.title);
    });
    
    // 删除按钮
    item.querySelector('.delete').addEventListener('click', async (e) => {
      e.stopPropagation();
      if (confirm('确定要删除这个会话吗？')) {
        await Chat.deleteSession(session.id);
        await loadChatSessions();
        if (session.id === Chat.getCurrentSessionId()) {
          startNewChat();
        }
      }
    });
    
    sessionsList.appendChild(item);
  });
}

/**
 * 切换到指定会话
 */
async function switchToSession(sessionId) {
  await Chat.switchSession(sessionId);
  const messages = await Chat.loadMessages(sessionId);
  
  // 清空消息区域
  AppState.elements.messagesArea.innerHTML = '';
  
  // 渲染所有消息
  messages.forEach(msg => {
    addMessageToUI(msg.role, msg.content, msg.files || []);
  });
  
  // 更新会话列表的激活状态
  document.querySelectorAll('.session-item').forEach(item => {
    item.classList.toggle('active', item.dataset.sessionId == sessionId);
  });
  
  // 如果没有消息，显示空状态
  if (messages.length === 0) {
    AppState.elements.messagesArea.innerHTML = renderChatEmptyState();
  }
}

/**
 * 重命名会话
 */
async function renameSession(sessionId, currentTitle) {
  const newTitle = prompt('请输入新的会话名称：', currentTitle);
  if (newTitle && newTitle.trim() && newTitle !== currentTitle) {
    await Chat.renameSession(sessionId, newTitle.trim());
    await loadChatSessions();
  }
}

/**
 * 开始新对话
 */
async function startNewChat() {
  Chat.clearHistory();
  AppState.elements.messagesArea.innerHTML = renderChatEmptyState();
  AppState.elements.chatInput.value = '';
  autoResizeChatInput();
  updateChatSendState();
  updateChatCharCount();
  
  // 取消所有会话的激活状态
  document.querySelectorAll('.session-item').forEach(item => {
    item.classList.remove('active');
  });
}

/**
 * 清除聊天历史
 */
function clearChatHistory() {
  if (confirm('确定要清除聊天历史吗？')) {
    startNewChat();
  }
}

// ========== 以下是图像生成相关函数（从 app.js 复制） ==========

function updateReferenceLabel() {
  const isEdit = AppState.elements.model.value.includes('edit');
  AppState.elements.referenceLabel.innerHTML = isEdit
    ? '<i class="fas fa-image"></i> 参考图像（必填，支持多张，最多16张）'
    : '<i class="fas fa-image"></i> 参考图像（可选）';
}

function updateParams() {
  const isVideo = AppState.elements.model.value.includes('video');
  const isEdit = AppState.elements.model.value.includes('edit');
  const hasImage = AppState.images.length > 0;

  AppState.elements.nParam.classList.toggle('hidden', !(!isVideo && (!hasImage || isEdit)));
  AppState.elements.strengthParam.classList.toggle('hidden', !(hasImage && !isEdit && !isVideo));
  AppState.elements.lengthParam.classList.toggle('hidden', !isVideo);
  AppState.elements.aspectParam.classList.toggle('hidden', !(isVideo || (!hasImage && !isEdit)));
}

function updateCharCount() {
  AppState.elements.charCount.textContent = AppState.elements.prompt.value.length;
}

function clearImage() {
  AppState.images = [];
  AppState.elements.previewGrid.innerHTML = '';
  AppState.elements.previewContainer.style.display = 'none';
  AppState.elements.inputImage.value = '';
  AppState.elements.imageCount.textContent = '0';
  updateParams();
}

function handleImageUpload(files) {
  if (files.length === 0) {
    clearImage();
    return;
  }

  AppState.images = [];
  AppState.elements.previewGrid.innerHTML = '';
  AppState.elements.previewContainer.style.display = 'none';

  const isEdit = AppState.elements.model.value.includes('edit');
  const maxImages = isEdit ? 16 : 1;
  const processFiles = isEdit ? Array.from(files).slice(0, maxImages) : [files[0]];

  if (processFiles.length === 0) {
    clearImage();
    return;
  }

  AppState.elements.previewContainer.style.display = 'block';

  processFiles.forEach((file) => {
    if (!file.type.startsWith('image/')) {
      UI.showError('只能上传图片文件');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      UI.showError('单张图片不能超过10MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      AppState.images.push(ev.target.result);

      const item = document.createElement('div');
      item.className = 'preview-item aspect-square';
      const img = document.createElement('img');
      img.src = ev.target.result;
      img.alt = `参考图${AppState.images.length}`;
      img.style.width = '100%';
      img.style.height = '100%';
      img.style.objectFit = 'cover';
      item.appendChild(img);
      AppState.elements.previewGrid.appendChild(item);
      AppState.elements.imageCount.textContent = AppState.images.length;
      updateParams();
    };

    reader.onerror = () => UI.showError('读取图片失败');
    reader.readAsDataURL(file);
  });

  if (files.length > maxImages && isEdit) {
    UI.showError('编辑模式最多支持16张参考图像，已自动截取前16张');
  }
}

async function loadHistoryToUI() {
  const items = await History.load();
  const fragment = document.createDocumentFragment();

  items.forEach(item => {
    const card = item.isVideo
      ? UI.createVideoCard(item.url, item.prompt)
      : UI.createImageCard(item.url, item.prompt);

    card.dataset.isVideo = item.isVideo;
    fragment.appendChild(card);

    requestAnimationFrame(() => {
      if (item.isVideo) {
        UI.loadVideoPreview(card, item.url);
      } else {
        UI.loadImagePreview(card, item.url);
      }
    });
  });

  AppState.elements.results.appendChild(fragment);

  if (items.length > 0) {
    AppState.elements.empty.classList.add('hidden');
  }
}

async function generate() {
  const prompt = AppState.elements.prompt.value.trim();

  if (!prompt) {
    UI.showError('请填写提示词');
    AppState.elements.prompt.focus();
    return;
  }

  if (prompt.length < 2) {
    UI.showError('提示词太短，请至少输入 2 个字符');
    AppState.elements.prompt.focus();
    return;
  }

  const selectedModel = AppState.elements.model.value;
  const isVideo = selectedModel.includes('video');
  const isEdit = selectedModel.includes('edit');
  const images = AppState.images;

  if (isEdit && images.length === 0) {
    UI.showError('图像编辑模式必须上传至少一张参考图像');
    return;
  }

  // 检查配额
  try {
    UserManager.incrementUsage('image');
  } catch (e) {
    UI.showError(e.message);
    return;
  }

  UI.showProgress();

  try {
    let results;

    if (isVideo) {
      const aspect = AppState.elements.aspect.value;
      const length = parseInt(AppState.elements.length.value);
      results = await Generator.generateVideo(prompt, aspect, length, images.length > 0 ? images[0] : null);
    } else if (isEdit) {
      const n = parseInt(AppState.elements.imgN.value);
      results = await Generator.generateImageEdit(prompt, images, n);
    } else if (images.length > 0) {
      const strength = parseFloat(AppState.elements.strength.value);
      results = await Generator.generateImageVariants(prompt, images[0], strength);
    } else {
      const n = parseInt(AppState.elements.imgN.value);
      const aspect = AppState.elements.aspect.value;
      results = await Generator.generateImages(prompt, n, aspect);
    }

    if (!results || results.length === 0) {
      throw new Error('无生成结果');
    }

    const fragment = document.createDocumentFragment();

    results.forEach(item => {
      const card = isVideo
        ? UI.createVideoCard(item.url, prompt)
        : UI.createImageCard(item.url, prompt);

      card.dataset.isVideo = isVideo;
      fragment.appendChild(card);

      requestAnimationFrame(() => {
        if (isVideo) {
          UI.loadVideoPreview(card, item.url);
        } else {
          UI.loadImagePreview(card, item.url);
        }
      });

      History.save(item.url, isVideo, prompt).catch(e => console.error('保存历史失败', e));
    });

    AppState.elements.results.insertBefore(fragment, AppState.elements.results.firstChild);
    AppState.elements.empty.classList.add('hidden');

    // 记录使用统计
    UserManager.recordUsage('image', { 
      model: selectedModel, 
      type: isVideo ? 'video' : (isEdit ? 'edit' : 'generate'),
      count: results.length 
    });
    
    // 更新配额显示
    updateQuotaDisplay();

  } catch (err) {
    console.error('生成失败:', err);
    UI.showError(err.message || '生成失败，请检查网络或配额');
  } finally {
    UI.hideProgress();
  }
}

function showConfigModal() {
  // 只有管理员可以配置
  if (!UserManager.isAdmin()) {
    UI.showError('只有管理员可以配置 API');
    return;
  }
  
  AppState.elements.configBase.value = AppState.config.base;
  AppState.elements.configKey.value = AppState.config.key;
  AppState.elements.configModal.classList.remove('hidden');
}

function hideConfigModal() {
  AppState.elements.configModal.classList.add('hidden');
}

async function saveConfig() {
  const newConfig = {
    base: AppState.elements.configBase.value.trim(),
    key: AppState.elements.configKey.value.trim(),
    historyKey: 'grok_imagine_history'
  };

  if (!newConfig.base || !newConfig.key) {
    UI.showError('请填写完整的 Base URL 和 API Key');
    return;
  }

  AppState.config = newConfig;
  Config.save(newConfig);
  API.setConfig(newConfig);

  const syncResult = await UserManager.syncAdminConfigToCloud(newConfig);
  if (!syncResult.ok && syncResult.reason !== 'cloud_unavailable') {
    UI.showError(`本地配置已保存，但云端同步失败：${syncResult.reason}`);
  }

  hideConfigModal();
  
  // 重新加载模型列表
  await loadModels();
  
  UI.showError('配置已保存');
  updateChatSendState();
}

/**
 * 显示登录界面
 */
function showLoginModal() {
  AppState.elements.loginModal.classList.remove('hidden');
  AppState.elements.loginUsername.value = '';
  AppState.elements.loginPassword.value = '';
  AppState.elements.adminPasswordGroup.style.display = 'none';
  AppState.elements.loginUsername.focus();
}

/**
 * 隐藏登录界面
 */
function hideLoginModal() {
  AppState.elements.loginModal.classList.add('hidden');
}

/**
 * 检查是否是管理员用户名，显示/隐藏密码框和记住我选项
 */
function checkAdminUsername() {
  const username = AppState.elements.loginUsername.value.trim();
  if (username === UserManager.ADMIN_USERNAME) {
    AppState.elements.adminPasswordGroup.style.display = 'block';
    AppState.elements.rememberMeGroup.style.display = 'block';
  } else {
    AppState.elements.adminPasswordGroup.style.display = 'none';
    AppState.elements.rememberMeGroup.style.display = 'none';
  }
}

/**
 * 处理用户登录
 */
async function handleLogin() {
  const username = AppState.elements.loginUsername.value.trim();
  const password = AppState.elements.loginPassword.value;
  const rememberMe = AppState.elements.rememberMe.checked;
  
  if (!username) {
    UI.showError('请输入用户名');
    return;
  }
  
  try {
    UserManager.login(username, password, rememberMe);
    window.location.reload();
  } catch (e) {
    UI.showError(e.message || '登录失败');
  }
}

/**
 * 处理用户登出
 */
async function handleLogout() {
  if (!confirm('确定要登出吗？')) {
    return;
  }
  
  UserManager.logout();
  
  // 清空当前数据
  AppState.elements.results.innerHTML = '';
  AppState.elements.messagesArea.innerHTML = renderChatEmptyState();
  
  // 显示登录界面
  showLoginModal();
  
  // 隐藏用户信息
  AppState.elements.userInfo.classList.add('hidden');
}

/**
 * 切换用户
 */
async function handleSwitchUser() {
  if (!confirm('切换用户将清空当前界面数据，确定要继续吗？')) {
    return;
  }
  
  UserManager.logout();
  
  // 清空当前数据
  AppState.elements.results.innerHTML = '';
  AppState.elements.messagesArea.innerHTML = renderChatEmptyState();
  
  // 显示登录界面
  showLoginModal();
  
  // 隐藏用户信息
  AppState.elements.userInfo.classList.add('hidden');
}

/**
 * 更新用户信息显示
 */
function updateUserInfo() {
  const user = UserManager.getCurrentUser();
  if (user) {
    AppState.elements.currentUsername.textContent = user.username;
    AppState.elements.userInfo.classList.remove('hidden');
    
    // 显示/隐藏管理员专属按钮
    if (UserManager.isAdmin()) {
      AppState.elements.userManagementBtn.style.display = 'inline-block';
      AppState.elements.changePasswordBtn.style.display = 'inline-block';
    } else {
      AppState.elements.userManagementBtn.style.display = 'none';
      AppState.elements.changePasswordBtn.style.display = 'none';
    }
    
    // 更新配额显示
    updateQuotaDisplay();
  } else {
    AppState.elements.userInfo.classList.add('hidden');
  }
}

/**
 * 更新配额显示
 */
function updateQuotaDisplay() {
  const quota = UserManager.getCurrentUserQuota();
  if (quota) {
    const chatRemaining = quota.chatLimit - quota.chatUsed;
    const imageRemaining = quota.imageLimit - quota.imageUsed;
    
    // 可以在这里添加配额显示的UI元素
    console.log(`今日剩余：聊天 ${chatRemaining}/${quota.chatLimit}，图像 ${imageRemaining}/${quota.imageLimit}`);
  }
}

/**
 * 显示修改密码模态框
 */
function showChangePasswordModal(isFirstLogin = false) {
  AppState.elements.changePasswordModal.classList.remove('hidden');
  AppState.elements.oldPassword.value = '';
  AppState.elements.newPassword.value = '';
  AppState.elements.confirmPassword.value = '';
  
  if (isFirstLogin) {
    // 首次登录时不能关闭模态框
    AppState.elements.changePasswordModal.style.pointerEvents = 'auto';
  }
  
  AppState.elements.oldPassword.focus();
}

/**
 * 隐藏修改密码模态框
 */
function hideChangePasswordModal() {
  AppState.elements.changePasswordModal.classList.add('hidden');
}

/**
 * 处理修改密码
 */
async function handleChangePassword() {
  const oldPassword = AppState.elements.oldPassword.value;
  const newPassword = AppState.elements.newPassword.value;
  const confirmPassword = AppState.elements.confirmPassword.value;
  
  if (!oldPassword || !newPassword || !confirmPassword) {
    UI.showError('请填写所有字段');
    return;
  }
  
  if (newPassword !== confirmPassword) {
    UI.showError('两次输入的新密码不一致');
    return;
  }
  
  try {
    UserManager.changeAdminPassword(oldPassword, newPassword);
    hideChangePasswordModal();
    UI.showError('密码修改成功');
    
    // 如果是首次登录，现在可以继续初始化应用
    if (UserManager.isAdmin()) {
      await reinitializeApp();
      updateUserInfo();
    }
  } catch (e) {
    UI.showError(e.message || '修改密码失败');
  }
}

/**
 * 显示用户管理界面
 */
async function showUserManagement() {
  if (!UserManager.isAdmin()) {
    UI.showError('只有管理员可以访问用户管理');
    return;
  }
  
  const users = await UserManager.getAllUsersAsync();
  const currentUser = UserManager.getCurrentUser();
  
  let html = `
    <div style="margin-bottom: 20px;">
      <h3 style="margin-bottom: 12px; font-size: 16px; font-weight: 600;">用户列表</h3>
      <div style="background: #f4f7fb; padding: 12px; border-radius: 8px; margin-bottom: 12px;">
        <p style="margin: 0; color: #666; font-size: 14px;">
          <i class="fas fa-info-circle"></i> 
          共有 ${users.length} 个用户
        </p>
      </div>
    </div>
    
    <div style="max-height: 400px; overflow-y: auto;">
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="background: #f4f7fb; border-bottom: 2px solid #e5e7eb;">
            <th style="padding: 12px; text-align: left; font-weight: 600;">用户名</th>
            <th style="padding: 12px; text-align: center; font-weight: 600;">聊天配额</th>
            <th style="padding: 12px; text-align: center; font-weight: 600;">图像配额</th>
            <th style="padding: 12px; text-align: center; font-weight: 600;">操作</th>
          </tr>
        </thead>
        <tbody>
  `;
  
  users.forEach(username => {
    const quota = UserManager.getUserQuota(username);
    const isCurrentUser = currentUser && currentUser.username === username;
    const isAdmin = username === UserManager.ADMIN_USERNAME;
    
    html += `
      <tr style="border-bottom: 1px solid #e5e7eb;">
        <td style="padding: 12px;">
          ${username}
          ${isAdmin ? '<span style="color: #f97316; font-size: 12px; margin-left: 8px;"><i class="fas fa-crown"></i> 管理员</span>' : ''}
          ${isCurrentUser ? '<span style="color: #0ea5e9; font-size: 12px; margin-left: 8px;">(当前)</span>' : ''}
        </td>
        <td style="padding: 12px; text-align: center;">
          <div style="margin-bottom: 4px;">${quota.chatUsed} / ${quota.chatLimit}</div>
          <input type="number" 
                 class="quota-input" 
                 data-username="${username}" 
                 data-type="chat" 
                 value="${quota.chatLimit}" 
                 min="0" 
                 style="width: 80px; padding: 4px 8px; border: 1px solid #e5e7eb; border-radius: 4px; text-align: center;">
        </td>
        <td style="padding: 12px; text-align: center;">
          <div style="margin-bottom: 4px;">${quota.imageUsed} / ${quota.imageLimit}</div>
          <input type="number" 
                 class="quota-input" 
                 data-username="${username}" 
                 data-type="image" 
                 value="${quota.imageLimit}" 
                 min="0" 
                 style="width: 80px; padding: 4px 8px; border: 1px solid #e5e7eb; border-radius: 4px; text-align: center;">
        </td>
        <td style="padding: 12px; text-align: center;">
          <button class="btn-secondary" 
                  onclick="updateUserQuota('${username}')" 
                  style="padding: 6px 12px; font-size: 13px; margin-right: 8px;">
            <i class="fas fa-save"></i> 保存
          </button>
          ${!isAdmin ? `
            <button class="btn-danger" 
                    onclick="deleteUser('${username}')" 
                    style="padding: 6px 12px; font-size: 13px;">
              <i class="fas fa-trash"></i> 删除
            </button>
          ` : ''}
        </td>
      </tr>
    `;
  });
  
  html += `
        </tbody>
      </table>
    </div>
  `;
  
  AppState.elements.userManagementContent.innerHTML = html;
  AppState.elements.userManagementModal.classList.remove('hidden');
}

/**
 * 隐藏用户管理界面
 */
function hideUserManagement() {
  AppState.elements.userManagementModal.classList.add('hidden');
}

/**
 * 更新用户配额
 */
window.updateUserQuota = function(username) {
  const chatInput = document.querySelector(`input[data-username="${username}"][data-type="chat"]`);
  const imageInput = document.querySelector(`input[data-username="${username}"][data-type="image"]`);
  
  const chatLimit = parseInt(chatInput.value);
  const imageLimit = parseInt(imageInput.value);
  
  if (isNaN(chatLimit) || isNaN(imageLimit) || chatLimit < 0 || imageLimit < 0) {
    UI.showError('配额必须是非负整数');
    return;
  }
  
  try {
    const quota = UserManager.getUserQuota(username);
    quota.chatLimit = chatLimit;
    quota.imageLimit = imageLimit;
    UserManager.setUserQuota(username, quota);
    UI.showError('配额已更新');
  } catch (e) {
    UI.showError(e.message || '更新配额失败');
  }
};

/**
 * 删除用户
 */
window.deleteUser = async function(username) {
  if (!confirm(`确定要删除用户 "${username}" 及其所有数据吗？此操作不可恢复！`)) {
    return;
  }
  
  try {
    UserManager.deleteUserData(username);
    UI.showError('用户已删除');
    await showUserManagement(); // 刷新列表
  } catch (e) {
    UI.showError(e.message || '删除用户失败');
  }
};

/**
 * 显示使用统计
 */
function showUsageStats() {
  const user = UserManager.getCurrentUser();
  if (!user) {
    UI.showError('请先登录');
    return;
  }
  
  const summary = UserManager.getStatsSummary();
  const quota = UserManager.getCurrentUserQuota();
  
  let html = `
    <div style="margin-bottom: 24px;">
      <h3 style="margin-bottom: 16px; font-size: 16px; font-weight: 600;">配额使用情况</h3>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 12px; color: white;">
          <div style="font-size: 14px; opacity: 0.9; margin-bottom: 8px;">
            <i class="fas fa-comments"></i> 聊天配额
          </div>
          <div style="font-size: 28px; font-weight: 700; margin-bottom: 4px;">
            ${quota.chatUsed} / ${quota.chatLimit}
          </div>
          <div style="font-size: 13px; opacity: 0.8;">
            剩余 ${quota.chatLimit - quota.chatUsed} 次
          </div>
        </div>
        <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); padding: 20px; border-radius: 12px; color: white;">
          <div style="font-size: 14px; opacity: 0.9; margin-bottom: 8px;">
            <i class="fas fa-image"></i> 图像配额
          </div>
          <div style="font-size: 28px; font-weight: 700; margin-bottom: 4px;">
            ${quota.imageUsed} / ${quota.imageLimit}
          </div>
          <div style="font-size: 13px; opacity: 0.8;">
            剩余 ${quota.imageLimit - quota.imageUsed} 次
          </div>
        </div>
      </div>
    </div>
    
    <div style="margin-bottom: 24px;">
      <h3 style="margin-bottom: 16px; font-size: 16px; font-weight: 600;">使用统计</h3>
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px;">
        <div style="background: #f4f7fb; padding: 16px; border-radius: 8px; text-align: center;">
          <div style="font-size: 13px; color: #666; margin-bottom: 8px;">今日</div>
          <div style="font-size: 20px; font-weight: 600; color: #0ea5e9; margin-bottom: 4px;">
            ${summary.today.chat + summary.today.image}
          </div>
          <div style="font-size: 12px; color: #999;">
            聊天 ${summary.today.chat} · 图像 ${summary.today.image}
          </div>
        </div>
        <div style="background: #f4f7fb; padding: 16px; border-radius: 8px; text-align: center;">
          <div style="font-size: 13px; color: #666; margin-bottom: 8px;">本月</div>
          <div style="font-size: 20px; font-weight: 600; color: #10b981; margin-bottom: 4px;">
            ${summary.thisMonth.chat + summary.thisMonth.image}
          </div>
          <div style="font-size: 12px; color: #999;">
            聊天 ${summary.thisMonth.chat} · 图像 ${summary.thisMonth.image}
          </div>
        </div>
        <div style="background: #f4f7fb; padding: 16px; border-radius: 8px; text-align: center;">
          <div style="font-size: 13px; color: #666; margin-bottom: 8px;">总计</div>
          <div style="font-size: 20px; font-weight: 600; color: #f97316; margin-bottom: 4px;">
            ${summary.total.chat + summary.total.image}
          </div>
          <div style="font-size: 12px; color: #999;">
            聊天 ${summary.total.chat} · 图像 ${summary.total.image}
          </div>
        </div>
      </div>
    </div>
    
    <div style="background: #fff7ed; padding: 12px; border-radius: 8px; border-left: 4px solid #f97316;">
      <p style="margin: 0; color: #666; font-size: 14px;">
        <i class="fas fa-info-circle"></i> 
        配额每日 00:00 自动重置
      </p>
    </div>
  `;
  
  AppState.elements.usageStatsContent.innerHTML = html;
  AppState.elements.usageStatsModal.classList.remove('hidden');
}

/**
 * 隐藏使用统计
 */
function hideUsageStats() {
  AppState.elements.usageStatsModal.classList.add('hidden');
}

/**
 * 重新初始化应用（用户切换后）
 */
async function reinitializeApp() {
  // 重新初始化数据库
  History.init();
  Chat.init();
  
  await UserManager.syncAdminConfigFromCloud();

  // 重新加载配置
  AppState.config = Config.load();
  API.setConfig(AppState.config);
  
  // 重新加载模型
  if (Config.isValid(AppState.config)) {
    await loadModels();
  } else {
    setModelSelectState('请联系管理员配置 API');
    if (UserManager.isAdmin()) {
      showConfigModal();
    } else {
      UI.showError('请联系管理员配置 API');
    }
  }
  
  // 重新加载历史记录
  AppState.elements.results.innerHTML = '';
  AppState.elements.empty.classList.remove('hidden');
  await loadHistoryToUI();
  
  // 重新加载聊天会话
  AppState.elements.messagesArea.innerHTML = renderChatEmptyState();
  await loadChatSessions();
}

/**
 * 初始化应用
 */
async function initApp() {
  // 初始化用户系统
  UserManager.init();

  marked.setOptions({
    gfm: true,
    breaks: true
  });

  initElements();
  
  // 检查用户登录状态
  if (!UserManager.isLoggedIn()) {
    showLoginModal();
    
    // 仅绑定登录相关事件
    AppState.elements.loginBtn.addEventListener('click', handleLogin);
    AppState.elements.loginUsername.addEventListener('input', checkAdminUsername);
    AppState.elements.loginUsername.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        if (AppState.elements.adminPasswordGroup.style.display !== 'none') {
          e.preventDefault();
          AppState.elements.loginPassword.focus();
        } else {
          handleLogin();
        }
      }
    });
    AppState.elements.loginPassword.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        handleLogin();
      }
    });
    
    return; // 未登录时不继续初始化
  }

  hideLoginModal();
  
  // 更新用户信息显示
  updateUserInfo();
  
  UI.initObservers();
  History.init();
  Chat.init(); // 初始化聊天数据库

  await UserManager.syncAdminConfigFromCloud();

  AppState.config = Config.load();
  API.setConfig(AppState.config);

  if (!Config.isValid(AppState.config)) {
    setModelSelectState('请联系管理员配置 API');

    // 只有管理员可以配置
    if (UserManager.isAdmin()) {
      showConfigModal();
    } else {
      UI.showError('请联系管理员配置 API');
    }
  } else {
    // 自动加载模型列表
    await loadModels();
  }

  await History.migrateFromLocalStorage(AppState.config.historyKey);
  await loadHistoryToUI();
  await loadChatSessions(); // 加载聊天会话列表

  updateCharCount();
  updateParams();
  updateReferenceLabel();
  autoResizeChatInput();
  updateChatSendState();
  // 标签切换
  AppState.elements.tabChat.addEventListener('click', () => switchView('chat'));
  AppState.elements.tabImage.addEventListener('click', () => switchView('image'));

  // 聊天相关事件
  document.getElementById('newChat').addEventListener('click', startNewChat);
  AppState.elements.sendMessage.addEventListener('click', sendChatMessage);
  AppState.elements.chatInput.addEventListener('input', () => {
    autoResizeChatInput();
    updateChatSendState();
    updateChatCharCount();
  });
  AppState.elements.chatModel.addEventListener('change', updateChatSendState);
  AppState.elements.chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendChatMessage();
    }
  });
  
  // 聊天文件上传
  AppState.elements.chatAttachFile.addEventListener('click', () => {
    AppState.elements.chatFileInput.click();
  });
  AppState.elements.chatFileInput.addEventListener('change', (e) => {
    handleChatFileUpload(e.target.files);
  });

  // 图像生成相关事件
  AppState.elements.prompt.addEventListener('input', updateCharCount);
  AppState.elements.inputImage.addEventListener('change', (e) => handleImageUpload(e.target.files));
  AppState.elements.clearImage.addEventListener('click', clearImage);
  AppState.elements.model.addEventListener('change', () => {
    updateParams();
    updateReferenceLabel();
  });
  AppState.elements.generateBtn.addEventListener('click', generate);

  // 清除历史
  AppState.elements.clearHistory.addEventListener('click', async () => {
    if (AppState.currentView === 'chat') {
      clearChatHistory();
    } else {
      if (confirm('确定要清除所有历史记录吗？此操作不可恢复。')) {
        await History.clear();
        AppState.elements.results.innerHTML = '';
        AppState.elements.empty.classList.remove('hidden');
        BlobManager.revokeAll();
        SelectionManager.disable();
      }
    }
  });

  // 多选相关
  AppState.elements.selectAll.addEventListener('click', () => SelectionManager.selectAll());
  AppState.elements.downloadSelected.addEventListener('click', () => SelectionManager.downloadSelected());
  document.getElementById('deleteSelected').addEventListener('click', () => SelectionManager.deleteSelected());
  AppState.elements.cancelSelection.addEventListener('click', () => SelectionManager.disable());

  // 配置相关
  AppState.elements.openConfig.addEventListener('click', showConfigModal);
  AppState.elements.saveConfig.addEventListener('click', saveConfig);
  AppState.elements.closeConfig.addEventListener('click', hideConfigModal);
  AppState.elements.configModal.addEventListener('click', (e) => {
    if (e.target === AppState.elements.configModal) hideConfigModal();
  });
  
  // 用户相关
  AppState.elements.loginBtn.addEventListener('click', handleLogin);
  AppState.elements.loginUsername.addEventListener('input', checkAdminUsername);
  AppState.elements.loginUsername.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      // 如果是管理员且密码框显示，焦点移到密码框
      if (AppState.elements.adminPasswordGroup.style.display !== 'none') {
        e.preventDefault();
        AppState.elements.loginPassword.focus();
      } else {
        handleLogin();
      }
    }
  });
  AppState.elements.loginPassword.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      handleLogin();
    }
  });
  AppState.elements.switchUser.addEventListener('click', handleSwitchUser);
  AppState.elements.logoutBtn.addEventListener('click', handleLogout);
  
  // 修改密码
  AppState.elements.changePasswordBtn.addEventListener('click', () => showChangePasswordModal(false));
  AppState.elements.savePassword.addEventListener('click', handleChangePassword);
  AppState.elements.changePasswordModal.addEventListener('click', (e) => {
    if (e.target === AppState.elements.changePasswordModal && !UserManager.isAdminFirstLogin()) {
      hideChangePasswordModal();
    }
  });
  
  // 用户管理
  AppState.elements.userManagementBtn.addEventListener('click', showUserManagement);
  AppState.elements.closeUserManagement.addEventListener('click', hideUserManagement);
  AppState.elements.userManagementModal.addEventListener('click', (e) => {
    if (e.target === AppState.elements.userManagementModal) {
      hideUserManagement();
    }
  });
  
  // 使用统计
  AppState.elements.usageStatsBtn.addEventListener('click', showUsageStats);
  AppState.elements.closeUsageStats.addEventListener('click', hideUsageStats);
  AppState.elements.usageStatsModal.addEventListener('click', (e) => {
    if (e.target === AppState.elements.usageStatsModal) {
      hideUsageStats();
    }
  });

  // 快捷键
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      if (AppState.currentView === 'chat' && AppState.elements.chatInput.value.trim()) {
        sendChatMessage();
      } else if (AppState.currentView === 'image' && !AppState.elements.generateBtn.disabled) {
        generate();
      }
    }
  });

  if (UserManager.isAdmin() && UserManager.isAdminFirstLogin()) {
    showChangePasswordModal(true);
  }

  window.addEventListener('beforeunload', () => BlobManager.revokeAll());
}

document.addEventListener('DOMContentLoaded', initApp);
