/**
 * UI 组件和卡片管理模块
 */
const UI = {
  videoObserver: null,
  imageObserver: null,

  /**
   * 初始化 Intersection Observers（性能优化：懒加载）
   */
  initObservers() {
    // 视频懒播放
    this.videoObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        const video = entry.target;
        if (entry.isIntersecting) {
          video.play().catch(() => {});
        } else {
          video.pause();
        }
      });
    }, { threshold: 0.5 });

    // 图片懒加载（性能优化）
    this.imageObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          const src = img.dataset.src;
          if (src && !img.src) {
            img.src = src;
            img.removeAttribute('data-src');
            this.imageObserver.unobserve(img);
          }
        }
      });
    }, { rootMargin: '50px' });
  },

  /**
   * 优先通过 fetch 获取受保护媒体，再回退为直链加载
   */
  async resolvePreviewSource(url, expectedType = 'image') {
    if (!/^https?:\/\//i.test(url)) {
      return { src: url, fallbackSrc: '', finalUrl: url, reason: '' };
    }

    try {
      const { response, finalUrl } = await API.fetchMedia(url, 18000);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const blob = await response.blob();
      const mime = (blob.type || '').toLowerCase();

      if (expectedType === 'image') {
        const imageBlob = await this.normalizeImageBlobMime(blob);
        const renderable = await this.isRenderableImageBlob(imageBlob);
        if (renderable) {
          const blobUrl = URL.createObjectURL(imageBlob);
          BlobManager.add(blobUrl);
          let fallbackSrc = '';
          if (imageBlob.size > 0 && imageBlob.size <= 8 * 1024 * 1024) {
            fallbackSrc = await this.blobToDataUrl(imageBlob);
          }
          return { src: blobUrl, fallbackSrc, finalUrl, reason: '' };
        }

        const payload = await this.extractPossibleErrorText(imageBlob);
        if (payload) {
          throw new Error(payload);
        }

        return { src: finalUrl, fallbackSrc: '', finalUrl, reason: '' };
      }

      if (expectedType === 'image' && mime.startsWith('video/')) {
        return { src: finalUrl, fallbackSrc: '', finalUrl, reason: '' };
      }

      if (expectedType === 'video' && mime.startsWith('image/')) {
        return { src: finalUrl, fallbackSrc: '', finalUrl, reason: '' };
      }

      const blobUrl = URL.createObjectURL(blob);
      BlobManager.add(blobUrl);
      return { src: blobUrl, fallbackSrc: '', finalUrl, reason: '' };
    } catch (e) {
      return {
        src: url,
        fallbackSrc: '',
        finalUrl: url,
        reason: e?.message ? String(e.message).slice(0, 180) : '媒体加载失败'
      };
    }
  },

  /**
   * 修正错误的图片 MIME（例如 application/octet-stream）
   */
  async normalizeImageBlobMime(blob) {
    if (!blob || blob.size === 0) return blob;
    const mime = (blob.type || '').toLowerCase();

    if (mime.startsWith('image/')) {
      return blob;
    }

    const detected = await this.detectImageMime(blob);
    if (!detected) {
      return blob;
    }

    try {
      return blob.slice(0, blob.size, detected);
    } catch (_) {
      return blob;
    }
  },

  /**
   * 通过文件头识别常见图片格式
   */
  async detectImageMime(blob) {
    if (!blob || blob.size < 12) return '';

    try {
      const head = new Uint8Array(await blob.slice(0, 32).arrayBuffer());
      if (head.length >= 8 &&
        head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4E && head[3] === 0x47 &&
        head[4] === 0x0D && head[5] === 0x0A && head[6] === 0x1A && head[7] === 0x0A) {
        return 'image/png';
      }

      if (head.length >= 3 && head[0] === 0xFF && head[1] === 0xD8 && head[2] === 0xFF) {
        return 'image/jpeg';
      }

      if (head.length >= 6 &&
        head[0] === 0x47 && head[1] === 0x49 && head[2] === 0x46 &&
        head[3] === 0x38 && (head[4] === 0x37 || head[4] === 0x39) && head[5] === 0x61) {
        return 'image/gif';
      }

      if (head.length >= 12 &&
        head[0] === 0x52 && head[1] === 0x49 && head[2] === 0x46 && head[3] === 0x46 &&
        head[8] === 0x57 && head[9] === 0x45 && head[10] === 0x42 && head[11] === 0x50) {
        return 'image/webp';
      }

      if (head.length >= 12 &&
        head[4] === 0x66 && head[5] === 0x74 && head[6] === 0x79 && head[7] === 0x70 &&
        ((head[8] === 0x61 && head[9] === 0x76 && head[10] === 0x69 && head[11] === 0x66) ||
          (head[8] === 0x6D && head[9] === 0x69 && head[10] === 0x66 && head[11] === 0x31))) {
        return 'image/avif';
      }
    } catch (_) {
      return '';
    }

    return '';
  },

  /**
   * Blob 转 data URL（用于 blob: 被策略拦截时回退）
   */
  blobToDataUrl(blob) {
    return new Promise((resolve) => {
      try {
        const reader = new FileReader();
        reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
        reader.onerror = () => resolve('');
        reader.readAsDataURL(blob);
      } catch (_) {
        resolve('');
      }
    });
  },

  /**
   * 校验 Blob 是否可被浏览器当作图片渲染
   */
  async isRenderableImageBlob(blob) {
    if (!blob || blob.size === 0) return false;

    if (typeof createImageBitmap === 'function') {
      try {
        const bitmap = await createImageBitmap(blob);
        if (bitmap?.close) {
          bitmap.close();
        }
        return true;
      } catch (_) {
        // fallback to Image
      }
    }

    return new Promise((resolve) => {
      const testUrl = URL.createObjectURL(blob);
      const testImg = new Image();

      const cleanup = () => {
        URL.revokeObjectURL(testUrl);
      };

      testImg.onload = () => {
        cleanup();
        resolve(true);
      };

      testImg.onerror = () => {
        cleanup();
        resolve(false);
      };

      testImg.src = testUrl;
    });
  },

  /**
   * 从疑似错误响应里提取可读文本（限制大小，防止误把二进制当文本）
   */
  async extractPossibleErrorText(blob) {
    if (!blob || blob.size === 0 || blob.size > 64 * 1024) return '';

    try {
      const text = (await blob.text()).trim();
      if (!text) return '';

      const looksLikeError = /^(\{|\[|<|error[:\s]|{"detail"|{"error")/i.test(text);
      if (!looksLikeError) return '';

      return text.slice(0, 200);
    } catch (_) {
      return '';
    }
  },

  /**
   * 创建图片卡片（性能优化：使用 DocumentFragment）
   */
  createImageCard(url, prompt) {
    const mediaUrl = API.normalizeUrl(url) || API.extractUrl(url) || '';
    const card = document.createElement('div');
    card.className = 'result-card card result-card-simple';
    card.dataset.url = mediaUrl;
    card.dataset.prompt = prompt || '';

    card.innerHTML = `
      <label class="card-select" title="选择此结果">
        <input type="checkbox" class="select-checkbox" aria-label="选择结果">
        <span class="card-select-indicator"><i class="fas fa-check"></i></span>
      </label>
      <div class="result-image-wrapper">
        <div class="result-loading-placeholder">
          <i class="fas fa-spinner spinner"></i>
        </div>
      </div>
      <div class="result-actions">
        <button class="action-btn delete-btn" title="删除">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    `;

    this.attachCardEvents(card);
    return card;
  },

  /**
   * 创建视频卡片
   */
  createVideoCard(url, prompt) {
    const mediaUrl = API.normalizeUrl(url) || API.extractUrl(url) || '';
    const card = document.createElement('div');
    card.className = 'result-card card';
    card.dataset.url = mediaUrl;
    card.dataset.prompt = prompt || '';

    card.innerHTML = `
      <label class="card-select" title="选择此结果">
        <input type="checkbox" class="select-checkbox" aria-label="选择结果">
        <span class="card-select-indicator"><i class="fas fa-check"></i></span>
      </label>
      <div class="result-image-wrapper">
        <div class="result-loading-placeholder">
          <i class="fas fa-spinner spinner"></i>
        </div>
      </div>
      <div class="result-actions">
        <button class="action-btn single-download">
          <i class="fas fa-download"></i> 下载
        </button>
        <button class="action-btn copy-url-btn">
          <i class="fas fa-link"></i> 链接
        </button>
      </div>
    `;

    this.attachCardEvents(card, true);
    return card;
  },

  /**
   * 附加卡片事件（性能优化：事件委托）
   */
  attachCardEvents(card, isVideo = false) {
    const selection = window.SelectionManager;

    // 删除按钮
    const deleteBtn = card.querySelector('.delete-btn');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (confirm('确定要删除这张图片吗？')) {
          await this.deleteCard(card);
        }
      });
    }

    // 图片点击预览（仅图片）
    if (!isVideo) {
      const imageWrapper = card.querySelector('.result-image-wrapper');
      if (imageWrapper) {
        imageWrapper.addEventListener('click', (e) => {
          if (selection && selection.isActive()) return;
          if (e.target.closest('.result-actions') || e.target.closest('.card-select')) return;
          e.preventDefault();
          this.openImagePreview(card);
        });
      }
    }

    // 多选入口：点击选择圈 / 双击 / 长按
    const selectToggle = card.querySelector('.card-select');
    if (selectToggle && selection) {
      selectToggle.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!selection.isActive()) {
          selection.enable();
        }
        selection.toggle(card);
      });
    }

    card.addEventListener('click', (e) => {
      if (!selection || !selection.isActive()) return;
      if (e.target.closest('.result-actions') || e.target.closest('.card-select')) return;
      e.preventDefault();
      selection.toggle(card);
    });

    card.addEventListener('dblclick', (e) => {
      if (!selection) return;
      if (e.target.closest('.result-actions') || e.target.closest('.card-select')) return;
      e.preventDefault();
      if (!selection.isActive()) {
        selection.enable();
      }
      selection.toggle(card);
    });

    let touchTimer = null;
    const cancelTouchTimer = () => {
      if (!touchTimer) return;
      clearTimeout(touchTimer);
      touchTimer = null;
    };

    card.addEventListener('touchstart', (e) => {
      if (!selection || selection.isActive()) return;
      if (e.target.closest('.result-actions') || e.target.closest('.card-select')) return;
      touchTimer = setTimeout(() => {
        selection.enable();
        selection.toggle(card);
        if (navigator.vibrate) {
          navigator.vibrate(12);
        }
      }, 460);
    }, { passive: true });

    card.addEventListener('touchend', cancelTouchTimer);
    card.addEventListener('touchmove', cancelTouchTimer);
    card.addEventListener('touchcancel', cancelTouchTimer);
  },

  /**
   * 加载图片预览（性能优化：懒加载 + 重试机制）
   */
  async loadImagePreview(card, url) {
    const wrapper = card.querySelector('.result-image-wrapper');
    if (!wrapper) return;
    const mediaUrl = API.normalizeUrl(url);
    if (!mediaUrl) {
      wrapper.innerHTML = `
        <div class="result-preview-fallback">
          <i class="fas fa-link-slash"></i>
          <p>链接无效<br>请重新生成</p>
        </div>
      `;
      return;
    }

    card.dataset.url = mediaUrl;

    let retryCount = 0;
    let activeAttempt = 0;

    const showFallback = (reason = '') => {
      const fallbackReason = reason || (card.dataset.url ? `URL: ${card.dataset.url}` : '');
      const info = fallbackReason ? `<small>${this.escapeHtml(fallbackReason).slice(0, 220)}</small>` : '';
      wrapper.innerHTML = `
        <div class="result-preview-fallback">
          <i class="fas fa-exclamation-circle"></i>
          <p>加载失败<br>点击下载查看</p>
          ${info}
        </div>
      `;
    };

    const tryLoad = async () => {
      const attemptId = ++activeAttempt;
      const img = document.createElement('img');
      img.alt = card.dataset.prompt || '生成的图像';
      img.loading = 'eager';  // 改为 eager 确保立即加载
      img.decoding = 'async';
      let sourceMeta = null;
      let triedFallbackSrc = false;

      let settled = false;
      
      const onSuccess = () => {
        if (attemptId !== activeAttempt || settled) return;
        settled = true;
        wrapper.innerHTML = '';
        wrapper.appendChild(img);
      };
      
      img.onload = onSuccess;

      img.onerror = () => {
        if (attemptId !== activeAttempt || settled) return;
        if (!triedFallbackSrc && sourceMeta?.fallbackSrc && sourceMeta.fallbackSrc !== img.src) {
          triedFallbackSrc = true;
          img.src = sourceMeta.fallbackSrc;
          return;
        }

        settled = true;
        if (retryCount < 2) {
          retryCount++;
          setTimeout(tryLoad, 1000 * retryCount);
        } else {
          showFallback(card.dataset.previewError || '');
        }
      };

      sourceMeta = await this.resolvePreviewSource(mediaUrl, 'image');
      if (attemptId !== activeAttempt) return;
      card.dataset.url = sourceMeta.finalUrl || mediaUrl;
      card.dataset.previewError = sourceMeta.reason || '';
      img.src = sourceMeta.src;

      // 检查图片是否已经加载完成（可能在设置 src 之前就已缓存）
      if (img.complete && img.naturalWidth > 0) {
        onSuccess();
        return;
      }

      // 避免网络挂起时无限等待；缩短超时时间到 15 秒
      setTimeout(() => {
        if (attemptId !== activeAttempt || settled) return;
        // 再次检查是否已加载完成
        if (img.complete && img.naturalWidth > 0) {
          onSuccess();
        } else if (!img.complete || !img.naturalWidth) {
          img.onerror();
        }
      }, 15000);
    };

    tryLoad();
  },

  /**
   * 加载视频预览（性能优化：懒播放）
   */
  async loadVideoPreview(card, url) {
    const wrapper = card.querySelector('.result-image-wrapper');
    if (!wrapper) return;
    const mediaUrl = API.normalizeUrl(url);
    if (!mediaUrl) {
      wrapper.innerHTML = `
        <div class="result-preview-fallback">
          <i class="fas fa-link-slash"></i>
          <p>链接无效<br>请重新生成</p>
        </div>
      `;
      return;
    }

    card.dataset.url = mediaUrl;

    wrapper.innerHTML = '';
    const video = document.createElement('video');
    video.controls = false;
    video.muted = true;
    video.playsInline = true;
    video.loop = true;
    video.preload = 'metadata';

    const source = document.createElement('source');
    const previewSource = await this.resolvePreviewSource(mediaUrl, 'video');
    card.dataset.url = previewSource.finalUrl || mediaUrl;
    source.src = previewSource.src;
    source.type = 'video/mp4';
    video.appendChild(source);

    video.onerror = () => {
      wrapper.innerHTML = `
        <div class="result-preview-fallback">
          <i class="fas fa-play-circle"></i>
          <p>预览不可用<br>请下载查看</p>
        </div>
      `;
    };

    const timeout = setTimeout(() => {
      if (video.readyState < 2) video.onerror();
    }, 15000);

    video.addEventListener('loadeddata', () => clearTimeout(timeout));

    wrapper.appendChild(video);
    this.videoObserver.observe(video);
  },

  /**
   * 复制到剪贴板（带反馈）
   */
  copyToClipboard(text, button) {
    if (!text) {
      this.showError('没有可复制的内容');
      return;
    }

    navigator.clipboard.writeText(text).then(() => {
      const orig = button.innerHTML;
      button.innerHTML = '<i class="fas fa-check"></i> 已复制';
      setTimeout(() => {
        button.innerHTML = orig;
      }, 1800);
    }).catch(() => {
      this.showError('复制失败，请检查浏览器权限');
    });
  },

  /**
   * HTML 转义（安全性优化）
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  /**
   * 显示错误提示
   */
  showError(message) {
    console.error('错误:', message);
    const errorEl = document.getElementById('error');
    const errorText = document.getElementById('errorText');
    errorText.textContent = message;
    errorEl.classList.remove('hidden');
    setTimeout(() => errorEl.classList.add('hidden'), 5000);
  },

  /**
   * 显示/隐藏进度条
   */
  showProgress() {
    document.getElementById('generationProgress').classList.add('show');
    document.getElementById('generateBtn').disabled = true;
  },

  hideProgress() {
    document.getElementById('generationProgress').classList.remove('show');
    document.getElementById('generateBtn').disabled = false;
  },

  /**
   * 删除卡片
   */
  async deleteCard(card) {
    const url = card.dataset.url;
    const isVideo = card.dataset.isVideo === 'true';
    
    // 从历史记录中删除
    await History.deleteByUrl(url);
    
    // 从 DOM 中移除
    card.remove();
    
    // 检查是否还有结果
    const results = document.getElementById('results');
    if (results.children.length === 0) {
      document.getElementById('empty').classList.remove('hidden');
    }
  },

  /**
   * 打开图片预览
   */
  openImagePreview(card) {
    const modal = document.getElementById('imagePreviewModal');
    const previewImage = document.getElementById('previewImage');
    const previewCounter = document.getElementById('previewCounter');
    const downloadBtn = document.getElementById('downloadPreviewImage');
    const copyPromptBtn = document.getElementById('copyPreviewPrompt');
    const prevBtn = document.getElementById('prevImage');
    const nextBtn = document.getElementById('nextImage');
    const closeBtn = document.getElementById('closePreview');
    
    // 获取所有图片卡片
    const allCards = Array.from(document.querySelectorAll('.result-card:not([data-is-video="true"])'));
    let currentIndex = allCards.indexOf(card);
    
    const updatePreview = () => {
      const currentCard = allCards[currentIndex];
      const img = currentCard.querySelector('img');
      
      if (img && img.src) {
        previewImage.src = img.src;
      } else {
        previewImage.src = currentCard.dataset.url;
      }
      
      previewCounter.textContent = `${currentIndex + 1} / ${allCards.length}`;
      
      prevBtn.disabled = currentIndex === 0;
      nextBtn.disabled = currentIndex === allCards.length - 1;
      
      // 更新下载和复制按钮
      downloadBtn.onclick = () => downloadFile(currentCard.dataset.url);
      copyPromptBtn.onclick = () => {
        this.copyToClipboard(currentCard.dataset.prompt, copyPromptBtn);
      };
    };
    
    // 导航按钮
    prevBtn.onclick = () => {
      if (currentIndex > 0) {
        currentIndex--;
        updatePreview();
      }
    };
    
    nextBtn.onclick = () => {
      if (currentIndex < allCards.length - 1) {
        currentIndex++;
        updatePreview();
      }
    };
    
    // 关闭按钮
    const closePreview = () => {
      modal.classList.add('hidden');
      document.body.style.overflow = '';
    };
    
    closeBtn.onclick = closePreview;
    modal.querySelector('.preview-modal-backdrop').onclick = closePreview;
    
    // 键盘导航
    const handleKeydown = (e) => {
      if (e.key === 'Escape') {
        closePreview();
        document.removeEventListener('keydown', handleKeydown);
      } else if (e.key === 'ArrowLeft' && currentIndex > 0) {
        currentIndex--;
        updatePreview();
      } else if (e.key === 'ArrowRight' && currentIndex < allCards.length - 1) {
        currentIndex++;
        updatePreview();
      }
    };
    
    document.addEventListener('keydown', handleKeydown);
    
    // 显示模态框
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    updatePreview();
  }
};
