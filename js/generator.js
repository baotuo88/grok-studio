/**
 * 图像/视频生成协调器
 */
const Generator = {
  /**
   * 解析并标准化媒体 URL（兼容 url/b64_json/嵌套对象）
   */
  resolveMediaUrl(payload) {
    if (!payload) return null;

    if (typeof payload === 'string') {
      return API.normalizeUrl(payload) || API.extractUrl(payload);
    }

    if (typeof payload === 'object' && payload.b64_json) {
      return `data:image/png;base64,${payload.b64_json}`;
    }

    const extracted = API.extractUrl(payload);
    return API.normalizeUrl(extracted || '');
  },

  /**
   * 生成图像
   */
  async generateImages(prompt, n, aspect) {
    const body = {
      model: 'grok-imagine-1.0',
      prompt,
      n: Math.min(Math.max(n, 1), 10),
      size: aspect,
      concurrency: 3,
      response_format: "url"
    };

    const data = await API.post('/images/generations', body);

    if (!data.data || !Array.isArray(data.data)) {
      throw new Error('API 返回数据格式错误');
    }

    return data.data
      .map(item => ({ url: this.resolveMediaUrl(item.url ? item.url : item) }))
      .filter(item => item.url);
  },

  /**
   * 生成视频
   */
  async generateVideo(prompt, aspect, length, base64Image = null) {
    const body = {
      model: 'grok-imagine-1.0-video',
      messages: [],
      n: 1,
      video_config: {
        aspect_ratio: aspect || "9:16",
        video_length: length || 6,
        resolution: "HD"
      }
    };

    if (base64Image) {
      body.messages.push({
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: base64Image } }
        ]
      });
    } else {
      body.messages.push({ role: "user", content: prompt });
    }

    const data = await API.post('/chat/completions', body);

    if (!data.choices || !Array.isArray(data.choices)) {
      throw new Error('API 返回数据格式错误');
    }

    return data.choices
      .map(item => ({ url: this.resolveMediaUrl(item.message?.content || item) }))
      .filter(item => item.url);
  },

  /**
   * 生成图像变体
   */
  async generateImageVariants(prompt, base64Image, strength) {
    const body = {
      model: 'grok-imagine-1.0',
      messages: [{
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: base64Image } }
        ]
      }],
      n: 1,
      strength: strength || 0.75
    };

    const data = await API.post('/chat/completions', body);

    if (!data.choices || !Array.isArray(data.choices)) {
      throw new Error('API 返回数据格式错误');
    }

    return data.choices
      .map(item => ({ url: this.resolveMediaUrl(item.message?.content || item) }))
      .filter(item => item.url);
  },

  /**
   * 图像编辑（多图支持）
   */
  async generateImageEdit(prompt, base64Images, n) {
    const formData = new FormData();
    formData.append('model', 'grok-imagine-1.0-edit');
    formData.append('prompt', prompt);
    formData.append('n', n || '1');
    formData.append('response_format', 'url');

    base64Images.forEach((base64, index) => {
      const base64Data = base64.split(',')[1];
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'image/png' });
      formData.append('image', blob, `reference_${index}.png`);
    });

    const data = await API.postForm('/images/edits', formData);

    if (!data.data || !Array.isArray(data.data)) {
      throw new Error('API 返回数据格式错误');
    }

    return data.data
      .map(item => ({ url: this.resolveMediaUrl(item.url ? item.url : item) }))
      .filter(item => item.url);
  }
};
