/**
 * 多选管理模块
 */
const SelectionManager = {
  selectedCards: new Set(),
  isMultiSelectMode: false,

  /**
   * 启用多选模式
   */
  enable() {
    if (this.isMultiSelectMode) return;
    this.isMultiSelectMode = true;
    document.body.classList.add('multi-select-mode');
    this.updateBar();
  },

  /**
   * 禁用多选模式
   */
  disable() {
    this.isMultiSelectMode = false;
    document.body.classList.remove('multi-select-mode');
    this.selectedCards.clear();
    document.querySelectorAll('.select-checkbox').forEach(cb => cb.checked = false);
    document.querySelectorAll('.card.is-selected').forEach(card => card.classList.remove('is-selected'));
    this.updateBar();
  },

  /**
   * 切换卡片选中状态
   */
  toggle(card) {
    const checkbox = card.querySelector('.select-checkbox');
    if (!checkbox) return;
    checkbox.checked = !checkbox.checked;

    if (checkbox.checked) {
      this.selectedCards.add(card);
      card.classList.add('is-selected');
    } else {
      this.selectedCards.delete(card);
      card.classList.remove('is-selected');
    }

    this.updateBar();

    if (this.selectedCards.size === 0) {
      this.disable();
    }
  },

  /**
   * 全选
   */
  selectAll() {
    document.querySelectorAll('.card').forEach(card => {
      const checkbox = card.querySelector('.select-checkbox');
      if (!checkbox) return;
      if (!checkbox.checked) {
        checkbox.checked = true;
        this.selectedCards.add(card);
        card.classList.add('is-selected');
      }
    });
    this.updateBar();
  },

  /**
   * 更新选择栏
   */
  updateBar() {
    const bar = document.getElementById('selectionBar');
    const count = document.getElementById('selectedCount');

    if (this.selectedCards.size > 0) {
      count.textContent = this.selectedCards.size;
      bar.classList.remove('hidden');
      bar.classList.add('show');
    } else {
      bar.classList.add('hidden');
      bar.classList.remove('show');
    }
  },

  /**
   * 批量下载选中项
   */
  async downloadSelected() {
    const cards = Array.from(this.selectedCards);
    for (let i = 0; i < cards.length; i++) {
      await downloadFile(cards[i].dataset.url);
      if (i < cards.length - 1) {
        await new Promise(r => setTimeout(r, 2000));
      }
    }
  },

  /**
   * 批量删除选中项
   */
  async deleteSelected() {
    if (!confirm(`确定要删除选中的 ${this.selectedCards.size} 张图片吗？`)) {
      return;
    }

    const cards = Array.from(this.selectedCards);
    
    for (const card of cards) {
      const url = card.dataset.url;
      // 从历史记录中删除
      await History.deleteByUrl(url);
      // 从 DOM 中移除
      card.remove();
    }

    // 清空选择
    this.selectedCards.clear();
    this.disable();

    // 检查是否还有结果
    const results = document.getElementById('results');
    if (results.children.length === 0) {
      document.getElementById('empty').classList.remove('hidden');
    }
  },

  /**
   * 检查是否处于多选模式
   */
  isActive() {
    return this.isMultiSelectMode;
  }
};

// 全局暴露
window.SelectionManager = SelectionManager;
