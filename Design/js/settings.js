// ============================================
// Profile / Settings Page
// Matches http://localhost:13000/zh/profile
// ============================================

(function() {
  var app = document.getElementById('app');
  app.innerHTML = '';

  // --- Data ---
  var providers = [
    { id: 'ark', name: '火山引擎 Ark', hasApiKey: false, apiKey: '', baseUrl: '' },
    { id: 'google', name: 'Google AI Studio', hasApiKey: false, apiKey: '', baseUrl: '' },
    { id: 'bailian', name: '阿里云百炼', hasApiKey: false, apiKey: '', baseUrl: '' },
    { id: 'openrouter', name: 'OpenRouter', hasApiKey: false, apiKey: '', baseUrl: 'https://openrouter.ai/api/v1' },
    { id: 'minimax', name: '海螺 MiniMax', hasApiKey: false, apiKey: '', baseUrl: 'https://api.minimaxi.com/v1' },
    { id: 'vidu', name: '生数科技 Vidu', hasApiKey: false, apiKey: '', baseUrl: '' },
    { id: 'fal', name: 'FAL', hasApiKey: false, apiKey: '', baseUrl: '' },
  ];

  var models = [
    // LLM
    { modelId: 'google/gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro', type: 'llm', provider: 'openrouter' },
    { modelId: 'google/gemini-3-pro-preview', name: 'Gemini 3 Pro', type: 'llm', provider: 'openrouter' },
    { modelId: 'google/gemini-3-flash-preview', name: 'Gemini 3 Flash', type: 'llm', provider: 'openrouter' },
    { modelId: 'anthropic/claude-sonnet-4.5', name: 'Claude Sonnet 4.5', type: 'llm', provider: 'openrouter' },
    { modelId: 'anthropic/claude-sonnet-4', name: 'Claude Sonnet 4', type: 'llm', provider: 'openrouter' },
    { modelId: 'openai/gpt-5.4', name: 'GPT-5.4', type: 'llm', provider: 'openrouter' },
    { modelId: 'google/gemini-3.1-flash-lite-preview', name: 'Gemini 3.1 Flash Lite', type: 'llm', provider: 'openrouter' },
    { modelId: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro', type: 'llm', provider: 'google' },
    { modelId: 'gemini-3-flash-preview', name: 'Gemini 3 Flash', type: 'llm', provider: 'google' },
    { modelId: 'gemini-3.1-flash-lite-preview', name: 'Gemini 3.1 Flash-Lite', type: 'llm', provider: 'google' },
    { modelId: 'doubao-seed-1-8-251228', name: 'Doubao Seed 1.8', type: 'llm', provider: 'ark' },
    { modelId: 'doubao-seed-2-0-pro-260215', name: 'Doubao Seed 2.0 Pro', type: 'llm', provider: 'ark' },
    { modelId: 'doubao-seed-2-0-lite-260215', name: 'Doubao Seed 2.0 Lite', type: 'llm', provider: 'ark' },
    { modelId: 'doubao-seed-2-0-mini-260215', name: 'Doubao Seed 2.0 Mini', type: 'llm', provider: 'ark' },
    { modelId: 'doubao-seed-1-6-251015', name: 'Doubao Seed 1.6', type: 'llm', provider: 'ark' },
    { modelId: 'doubao-seed-1-6-lite-251015', name: 'Doubao Seed 1.6 Lite', type: 'llm', provider: 'ark' },
    { modelId: 'qwen3.5-plus', name: 'Qwen 3.5 Plus', type: 'llm', provider: 'bailian' },
    { modelId: 'qwen3.5-flash', name: 'Qwen 3.5 Flash', type: 'llm', provider: 'bailian' },
    { modelId: 'MiniMax-M2.5', name: 'MiniMax M2.5', type: 'llm', provider: 'minimax' },
    { modelId: 'MiniMax-M2.5-highspeed', name: 'MiniMax M2.5 Highspeed', type: 'llm', provider: 'minimax' },
    { modelId: 'MiniMax-M2.1', name: 'MiniMax M2.1', type: 'llm', provider: 'minimax' },
    { modelId: 'MiniMax-M2', name: 'MiniMax M2', type: 'llm', provider: 'minimax' },
    // Image
    { modelId: 'banana', name: 'Banana Pro', type: 'image', provider: 'fal' },
    { modelId: 'banana-2', name: 'Banana 2', type: 'image', provider: 'fal' },
    { modelId: 'doubao-seedream-4-5-251128', name: 'Seedream 4.5', type: 'image', provider: 'ark' },
    { modelId: 'doubao-seedream-4-0-250828', name: 'Seedream 4.0', type: 'image', provider: 'ark' },
    { modelId: 'gemini-3-pro-image-preview', name: 'Banana Pro', type: 'image', provider: 'google' },
    { modelId: 'gemini-3.1-flash-image-preview', name: 'Nano Banana 2', type: 'image', provider: 'google' },
    { modelId: 'gemini-3-pro-image-preview-batch', name: 'Banana Pro (Batch)', type: 'image', provider: 'google' },
    { modelId: 'gemini-2.5-flash-image', name: 'Gemini 2.5 Flash Image', type: 'image', provider: 'google' },
    { modelId: 'imagen-4.0-generate-001', name: 'Imagen 4', type: 'image', provider: 'google' },
    { modelId: 'imagen-4.0-ultra-generate-001', name: 'Imagen 4 Ultra', type: 'image', provider: 'google' },
    { modelId: 'imagen-4.0-fast-generate-001', name: 'Imagen 4 Fast', type: 'image', provider: 'google' },
    // Video
    { modelId: 'doubao-seedance-1-0-pro-fast-251015', name: 'Seedance 1.0 Pro Fast', type: 'video', provider: 'ark' },
    { modelId: 'doubao-seedance-1-5-pro-251215', name: 'Seedance 1.5 Pro', type: 'video', provider: 'ark' },
    { modelId: 'doubao-seedance-2-0-260128', name: 'Seedance 2.0', type: 'video', provider: 'ark' },
    { modelId: 'veo-3.1-generate-preview', name: 'Veo 3.1', type: 'video', provider: 'google' },
    { modelId: 'veo-3.1-fast-generate-preview', name: 'Veo 3.1 Fast', type: 'video', provider: 'google' },
    { modelId: 'veo-3.0-generate-001', name: 'Veo 3.0', type: 'video', provider: 'google' },
    { modelId: 'veo-2.0-generate-001', name: 'Veo 2.0', type: 'video', provider: 'google' },
    { modelId: 'wan2.7-i2v', name: 'Wan2.7 I2V', type: 'video', provider: 'bailian' },
    { modelId: 'wan2.6-i2v-flash', name: 'Wan2.6 I2V Flash', type: 'video', provider: 'bailian' },
    { modelId: 'fal-wan25', name: 'Wan 2.6', type: 'video', provider: 'fal' },
    { modelId: 'fal-veo31', name: 'Veo 3.1', type: 'video', provider: 'fal' },
    { modelId: 'fal-sora2', name: 'Sora 2', type: 'video', provider: 'fal' },
    { modelId: 'fal-ai/kling-video/v2.5-turbo/pro/image-to-video', name: 'Kling 2.5 Turbo Pro', type: 'video', provider: 'fal' },
    { modelId: 'fal-ai/kling-video/v3/standard/image-to-video', name: 'Kling 3 Standard', type: 'video', provider: 'fal' },
    { modelId: 'fal-ai/kling-video/v3/pro/image-to-video', name: 'Kling 3 Pro', type: 'video', provider: 'fal' },
    { modelId: 'minimax-hailuo-2.3', name: 'Hailuo 2.3', type: 'video', provider: 'minimax' },
    { modelId: 'minimax-hailuo-2.3-fast', name: 'Hailuo 2.3 Fast', type: 'video', provider: 'minimax' },
    { modelId: 'minimax-hailuo-02', name: 'Hailuo 02', type: 'video', provider: 'minimax' },
    { modelId: 'viduq3-pro', name: 'Vidu Q3 Pro', type: 'video', provider: 'vidu' },
    { modelId: 'viduq2-pro', name: 'Vidu Q2 Pro', type: 'video', provider: 'vidu' },
    { modelId: 'viduq2-turbo', name: 'Vidu Q2 Turbo', type: 'video', provider: 'vidu' },
    { modelId: 'vidu2.0', name: 'Vidu 2.0', type: 'video', provider: 'vidu' },
    // Audio
    { modelId: 'fal-ai/index-tts-2/text-to-speech', name: 'IndexTTS 2', type: 'audio', provider: 'fal' },
    { modelId: 'qwen3-tts-vd-2026-01-26', name: 'Qwen3 TTS', type: 'audio', provider: 'bailian' },
    { modelId: 'qwen-voice-design', name: 'Qwen Voice Design', type: 'audio', provider: 'bailian' },
    // Lipsync
    { modelId: 'fal-ai/kling-video/lipsync/audio-to-video', name: 'Kling Lip Sync', type: 'lipsync', provider: 'fal' },
    { modelId: 'vidu-lipsync', name: 'Vidu Lip Sync', type: 'lipsync', provider: 'vidu' },
    { modelId: 'videoretalk', name: 'VideoRetalk Lip Sync', type: 'lipsync', provider: 'bailian' },
  ];

  // Track enabled models per provider
  var enabledModels = {};
  models.forEach(function(m) {
    var key = m.provider + '::' + m.modelId;
    enabledModels[key] = false;
  });

  // Default model selections
  var defaultModels = {
    analysisModel: '',
    videoModel: '',
    characterModel: '',
    locationModel: '',
    storyboardModel: '',
    editModel: '',
    audioModel: '',
    lipSyncModel: '',
    voiceDesignModel: '',
  };

  // Workflow concurrency
  var workflowConcurrency = { analysis: 1, image: 1, video: 1 };

  // Active tab
  var activeTab = 'apiConfig';
  var saveStatus = 'idle'; // idle, saving, saved, failed
  var showAddProviderModal = false;
  var showHiddenProviders = false;
  var hiddenProviders = [];
  var showApiKey = {};

  // --- Helpers ---
  function getModelsByProvider(providerId) {
    return models.filter(function(m) { return m.provider === providerId; });
  }

  function getEnabledModelsByType(type) {
    return models.filter(function(m) {
      return enabledModels[m.provider + '::' + m.modelId] && m.type === type;
    });
  }

  function getModelLabel(m) {
    return m.name + ' (' + getProviderDisplayName(m.provider) + ')';
  }

  function getProviderDisplayName(id) {
    var p = providers.find(function(p) { return p.id === id; });
    return p ? p.name : id;
  }

  function getTypeLabel(type) {
    var labels = { llm: '文本', image: '图像', video: '视频', audio: '音频', lipsync: '口型同步' };
    return labels[type] || type;
  }

  // --- Render ---
  function render() {
    app.innerHTML = '';

    // Global sidebar layout
    var layoutData = renderAppLayout('settings');
    app.appendChild(layoutData.layout);
    var mainArea = layoutData.mainArea;

    var page = el('div', { className: 'glass-page', style: { minHeight: '100vh' } });
    var layout = el('div', { className: 'profile-layout' });

    // Content only (sidebar removed, content centered)
    layout.appendChild(renderContent());

    page.appendChild(layout);
    mainArea.appendChild(page);

    // Modal
    if (showAddProviderModal) {
      app.appendChild(renderAddProviderModal());
    }
  }

  function renderSidebar() {
    var sidebar = el('div', { className: 'profile-sidebar' });

    // User info
    var userInfo = el('div', { className: 'profile-user-info' });
    userInfo.innerHTML =
      '<div style="margin-bottom:16px;">' +
        '<div class="profile-user-name">用户</div>' +
        '<div class="profile-user-label">个人账号</div>' +
      '</div>' +
      '<div class="profile-balance-card">' +
        '<div class="profile-balance-label">可用余额</div>' +
        '<div class="profile-balance-value">开源版本，无需计费</div>' +
      '</div>';
    sidebar.appendChild(userInfo);

    // Nav
    var nav = el('nav', { className: 'profile-nav' });

    var apiConfigBtn = el('button', {
      className: 'profile-nav-item' + (activeTab === 'apiConfig' ? ' active' : ''),
      onclick: function() { activeTab = 'apiConfig'; render(); },
    });
    apiConfigBtn.innerHTML = icon('settingsHexAlt', 'icon-lg') + '<span>API 配置</span>';
    nav.appendChild(apiConfigBtn);

    var billingBtn = el('button', {
      className: 'profile-nav-item' + (activeTab === 'billing' ? ' active' : ''),
      onclick: function() { activeTab = 'billing'; render(); },
    });
    billingBtn.innerHTML = icon('receipt', 'icon-lg') + '<span>扣费记录</span>';
    nav.appendChild(billingBtn);

    sidebar.appendChild(nav);

    // Logout
    var logoutBtn = el('button', { className: 'profile-logout-btn' });
    logoutBtn.innerHTML = icon('logout', 'icon-lg') + '退出登录';
    sidebar.appendChild(logoutBtn);

    return sidebar;
  }

  function renderContent() {
    var content = el('div', { className: 'profile-content' });

    if (activeTab === 'billing') {
      content.innerHTML =
        '<div class="billing-empty">' +
          '<div class="billing-empty-icon">' + icon('receipt', 'icon-xl') + '</div>' +
          '<div class="billing-empty-text">开源版本，无需计费</div>' +
        '</div>';
      return content;
    }

    // API Config content
    // Header
    var header = el('div', { className: 'profile-content-header' });
    var saveStatusLabel = '';
    var saveStatusClass = '';
    if (saveStatus === 'saving') { saveStatusLabel = '保存中...'; saveStatusClass = 'saving'; }
    else if (saveStatus === 'saved') { saveStatusLabel = '已保存'; saveStatusClass = 'saved'; }
    else if (saveStatus === 'failed') { saveStatusLabel = '保存失败'; saveStatusClass = 'failed'; }
    header.innerHTML =
      '<div class="profile-content-title">API 配置</div>' +
      (saveStatusLabel ? '<div class="profile-save-status ' + saveStatusClass + '">' + saveStatusLabel + '</div>' : '');
    content.appendChild(header);

    // Body
    var body = el('div', { className: 'profile-content-body' });
    body.style.display = 'flex';
    body.style.flexDirection = 'column';
    body.style.gap = '24px';

    // Default models section
    body.appendChild(renderDefaultModels());

    // Provider pool section
    body.appendChild(renderProviderPool());

    content.appendChild(body);
    return content;
  }

  function renderDefaultModels() {
    var card = el('div', { className: 'default-models-card' });
    card.innerHTML =
      '<div class="dm-glow-blue"></div>' +
      '<div class="dm-glow-purple"></div>' +
      '<div class="dm-content">' +

      // Title
      '<div style="margin-bottom:32px;">' +
        '<div style="display:flex;align-items:center;gap:10px;margin-bottom:4px;">' +
          '<span class="glass-surface-soft" style="display:inline-flex;width:28px;height:28px;align-items:center;justify-content:center;border-radius:8px;color:var(--glass-text-secondary);">' + icon('settingsHex', 'icon-lg') + '</span>' +
          '<h2 style="font-size:20px;font-weight:700;color:var(--glass-text-primary);">默认模型配置</h2>' +
        '</div>' +
        '<p style="font-size:13px;color:var(--glass-text-secondary);margin-left:38px;">新建项目与资产库将使用此默认配置，也可在项目设置中为单独项目自定义模型</p>' +
      '</div>' +

      // Core Foundation
      '<h3 class="dm-section-title">' + icon('bolt', 'icon-lg') + '<span style="color:#3b82f6;">文本分析与视频能力</span></h3>' +
      '<div class="dm-core-grid">' +
        renderModelCard('coreTextTitle', '文本分析模型', '负责剧本解析、分镜构建等全流程文本分析能力。', 'analysisModel', 'llm', 'blue', 'fileText', 'workflowConcurrency.analysis', 'analysis') +
        renderModelCard('coreVideoTitle', '视频生成模型', '负责将图像与指令合成为最终视频片段。', 'videoModel', 'video', 'purple', 'clapperboard', 'workflowConcurrency.video', 'video') +
      '</div>' +

      // Creative Pipeline
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:20px;">' +
        '<h3 class="dm-section-title" style="margin-bottom:0;">' + icon('sparklesAlt', 'icon-lg') + '<span style="color:#6366f1;">全局图像模型配置</span></h3>' +
        '<div class="dm-concurrency">' +
          '<span class="dm-concurrency-label">图像流程并发</span>' +
          '<input type="number" min="1" step="1" value="' + workflowConcurrency.image + '" class="glass-input-base dm-concurrency-input" onchange="window.__updateConcurrency(\'image\', this.value)" />' +
        '</div>' +
      '</div>' +

      '<div class="glass-surface" style="padding:24px;border-radius:24px;border:1px solid rgba(99,102,241,0.2);background:rgba(99,102,241,0.02);margin-bottom:32px;">' +
        // Warning tip
        '<div class="dm-warning-tip">' +
          icon('alert', 'icon-lg') +
          '<span>推荐使用 Google Banana 系列模型，目前其他图像模型生成效果有限。</span>' +
        '</div>' +
        // Unified override
        '<div class="dm-unified-override">' +
          '<div>' +
            '<div style="font-size:14px;font-weight:600;color:var(--glass-text-primary);">批量配置图像模型</div>' +
            '<div style="font-size:12px;color:var(--glass-text-tertiary);margin-top:2px;">设置负责整个系统所有地方图像生成/编辑的模型</div>' +
          '</div>' +
          '<div style="width:280px;">' +
            renderModelSelect('', 'image', '批量应用到以下场景...', '') +
          '</div>' +
        '</div>' +
        // Pipeline cards
        '<div class="dm-pipeline-grid">' +
          renderPipelineCard('角色生成', 'characterModel', 'image', 'user', 'indigo') +
          renderPipelineCard('场景生成', 'locationModel', 'image', 'image', 'teal') +
          renderPipelineCard('镜头生成', 'storyboardModel', 'image', 'film', 'amber') +
          renderPipelineCard('编辑图片', 'editModel', 'image', 'edit', 'rose') +
        '</div>' +
      '</div>' +

      // Extensions
      '<h3 class="dm-section-title">' + icon('sparklesAlt', 'icon-lg') + '<span style="color:#6366f1;">扩展功能</span></h3>' +
      '<div class="dm-ext-grid">' +
        renderPipelineCard('口型同步', 'lipSyncModel', 'lipsync', 'video', 'emerald') +
        renderPipelineCard('语音合成', 'audioModel', 'audio', 'mic', 'blue') +
        renderPipelineCard('音色设计', 'voiceDesignModel', 'audio', 'wand', 'purple') +
      '</div>' +

      '</div>';

    return card;
  }

  function renderModelCard(title, displayName, desc, field, modelType, color, iconName, concurrencyLabel, concurrencyKey) {
    var options = getEnabledModelsByType(modelType);
    var currentVal = defaultModels[field] || '';
    return '<div class="dm-model-card ' + color + '">' +
      '<div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:8px;">' +
        '<div class="dm-model-icon ' + color + '">' + icon(iconName, 'icon-lg') + '</div>' +
        '<div class="dm-concurrency">' +
          '<span class="dm-concurrency-label">' + concurrencyLabel + '</span>' +
          '<input type="number" min="1" step="1" value="' + workflowConcurrency[concurrencyKey] + '" class="glass-input-base dm-concurrency-input" onchange="window.__updateConcurrency(\'' + concurrencyKey + '\', this.value)" />' +
        '</div>' +
      '</div>' +
      '<h4 class="dm-model-title">' + displayName + '</h4>' +
      '<p class="dm-model-desc">' + desc + '</p>' +
      renderModelSelect(field, modelType, '必选配置', currentVal) +
    '</div>';
  }

  function renderPipelineCard(title, field, modelType, iconName, color) {
    var options = getEnabledModelsByType(modelType);
    var currentVal = defaultModels[field] || '';
    var placeholder = options.length === 0 ? '暂不启用' : '请选择';
    return '<div class="dm-pipeline-card">' +
      '<div style="display:flex;align-items:center;gap:8px;">' +
        '<div class="dm-model-icon ' + color + '">' + icon(iconName, 'icon-lg') + '</div>' +
        '<span style="font-size:13px;font-weight:600;color:var(--glass-text-primary);">' + title + '</span>' +
      '</div>' +
      renderModelSelect(field, modelType, placeholder, currentVal) +
    '</div>';
  }

  function renderModelSelect(field, modelType, placeholder, currentVal) {
    var options = getEnabledModelsByType(modelType);
    var html = '<select class="glass-select-base dm-model-select" onchange="window.__updateDefaultModel(\'' + field + '\', this.value)">';
    html += '<option value="">' + placeholder + '</option>';
    options.forEach(function(m) {
      var key = m.provider + '::' + m.modelId;
      var selected = currentVal === key ? ' selected' : '';
      html += '<option value="' + key + '"' + selected + '>' + m.name + ' (' + getProviderDisplayName(m.provider) + ')</option>';
    });
    html += '</select>';
    return html;
  }

  function renderProviderPool() {
    var container = el('div', {});

    // Header
    var header = el('div', { className: 'provider-pool-header' });
    header.innerHTML =
      '<div>' +
        '<div style="display:flex;align-items:center;gap:10px;">' +
          '<span class="glass-surface-soft" style="display:inline-flex;width:28px;height:28px;align-items:center;justify-content:center;border-radius:8px;color:var(--glass-text-secondary);">' + icon('cube', 'icon-lg') + '</span>' +
          '<div>' +
            '<h2 class="provider-pool-title">厂商资源池</h2>' +
            '<p class="provider-pool-desc">在此使用来自全球丰富的模型配置</p>' +
            '<p class="provider-pool-hint">按住左上角拖拽手柄可调整厂商顺序</p>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<button class="glass-btn-base glass-btn-primary" onclick="window.__openAddProvider()" style="padding:6px 12px;font-size:14px;font-weight:600;">新增模型服务商</button>';
    container.appendChild(header);

    // Provider grid
    var grid = el('div', { className: 'provider-grid' });
    providers.filter(function(p) { return hiddenProviders.indexOf(p.id) === -1; }).forEach(function(p) {
      grid.appendChild(renderProviderCard(p));
    });
    container.appendChild(grid);

    // Hidden providers toggle
    if (hiddenProviders.length > 0) {
      var toggle = el('button', {
        className: 'hidden-providers-toggle',
        onclick: function() { showHiddenProviders = !showHiddenProviders; render(); },
      });
      toggle.innerHTML =
        '<div>' +
          '<span style="font-weight:600;color:var(--glass-text-primary);">已隐藏 ' + hiddenProviders.length + '</span>' +
          '<span style="color:var(--glass-text-tertiary);margin-left:8px;">' + hiddenProviders.map(function(id) { return getProviderDisplayName(id); }).join(' / ') + '</span>' +
        '</div>' +
        icon('chevronDown', 'icon-lg');
      container.appendChild(toggle);

      if (showHiddenProviders) {
        var hiddenGrid = el('div', { className: 'provider-grid', style: { marginTop: '12px' } });
        providers.filter(function(p) { return hiddenProviders.indexOf(p.id) !== -1; }).forEach(function(p) {
          hiddenGrid.appendChild(renderProviderCard(p));
        });
        container.appendChild(hiddenGrid);
      }
    }

    return container;
  }

  function renderProviderCard(p) {
    var card = el('div', { className: 'provider-card' });
    var providerModels = getModelsByProvider(p.id);
    var isHidden = hiddenProviders.indexOf(p.id) !== -1;

    var html = '';

    // Card header
    html += '<div class="provider-card-header">';
    html += '<span class="provider-drag-handle">' + icon('dragHandle') + '</span>';
    html += '<span class="provider-name">' + p.name + '</span>';
    if (p.hasApiKey) {
      html += '<span class="provider-status connected">' + icon('check', 'icon-sm') + ' 已连接</span>';
    } else {
      html += '<span class="provider-status not-configured">未配置 Key</span>';
    }
    html += '</div>';

    // Card body
    html += '<div class="provider-card-body">';

    // API Key row
    var keyVisible = showApiKey[p.id] || false;
    html += '<div class="provider-apikey-row">';
    html += '<span class="provider-apikey-label">API Key</span>';
    html += '<input type="' + (keyVisible ? 'text' : 'password') + '" class="glass-input-base provider-apikey-input" placeholder="API Key" value="' + (p.apiKey || '') + '" onchange="window.__updateApiKey(\'' + p.id + '\', this.value)" />';
    html += '<button class="glass-icon-btn-sm" onclick="window.__toggleApiKey(\'' + p.id + '\')" title="' + (keyVisible ? '隐藏' : '显示') + '">' + icon(keyVisible ? 'eyeOff' : 'eye', 'icon-sm') + '</button>';
    if (!p.hasApiKey) {
      html += '<button class="glass-btn-base glass-btn-primary" style="padding:6px 10px;font-size:12px;" onclick="window.__connectProvider(\'' + p.id + '\')">连接</button>';
    }
    html += '</div>';

    // Base URL (if applicable)
    if (p.baseUrl) {
      html += '<div class="provider-baseurl-row">';
      html += '<span class="provider-apikey-label">Base URL</span>';
      html += '<input type="text" class="glass-input-base provider-apikey-input" style="font-family:monospace;" value="' + p.baseUrl + '" onchange="window.__updateBaseUrl(\'' + p.id + '\', this.value)" />';
      html += '</div>';
    }

    // Models list
    if (providerModels.length > 0) {
      html += '<div class="provider-models-list">';
      // Group by type
      var types = ['llm', 'image', 'video', 'audio', 'lipsync'];
      types.forEach(function(type) {
        var typeModels = providerModels.filter(function(m) { return m.type === type; });
        if (typeModels.length === 0) return;

        typeModels.forEach(function(m) {
          var key = p.id + '::' + m.modelId;
          var isEnabled = enabledModels[key] || false;
          html += '<div class="provider-model-item">';
          html += '<div class="provider-model-info">';
          html += '<span class="provider-model-name">' + m.name + '</span>';
          html += '<span class="provider-model-type">' + getTypeLabel(type) + '</span>';
          html += '</div>';
          html += '<button class="provider-toggle ' + (isEnabled ? 'on' : '') + '" onclick="window.__toggleModel(\'' + p.id + '\', \'' + m.modelId + '\')"></button>';
          html += '</div>';
        });
      });
      html += '</div>';
    } else {
      html += '<div style="padding:12px 0;font-size:12px;color:var(--glass-text-tertiary);">该厂商暂无配置模型</div>';
    }

    // Actions
    html += '<div class="provider-actions">';
    html += '<button class="provider-action-btn">' + icon('plus', 'icon-sm') + ' 添加模型</button>';
    if (isHidden) {
      html += '<button class="provider-action-btn" onclick="window.__toggleHideProvider(\'' + p.id + '\')">显示提供商</button>';
    } else {
      html += '<button class="provider-action-btn" onclick="window.__toggleHideProvider(\'' + p.id + '\')">隐藏提供商</button>';
    }
    html += '</div>';

    html += '</div>'; // body

    card.innerHTML = html;
    return card;
  }

  function renderAddProviderModal() {
    var overlay = el('div', {
      className: 'modal-overlay',
      onclick: function(e) { if (e.target === overlay) { showAddProviderModal = false; render(); } },
    });
    var modal = el('div', { className: 'modal-container modal-md' });
    modal.innerHTML =
      '<div class="modal-header">' +
        '<h3 class="modal-title">新增模型服务商</h3>' +
        '<button class="modal-close" onclick="window.__closeAddProvider()">' + icon('x', 'icon-lg') + '</button>' +
      '</div>' +
      '<div class="modal-body">' +
        '<div class="add-provider-form">' +
          // Warning
          '<div class="dm-warning-tip">' +
            icon('alert', 'icon-lg') +
            '<span>项目目前为测试版，由于市场上各厂商自定义 API 格式差异较大，自定义 API 兼容性尚不完善，建议优先使用官方内置 API。后续版本将持续更新以兼容更多厂商。</span>' +
          '</div>' +
          // API Type
          '<div class="add-provider-field">' +
            '<label class="add-provider-label">API 类型</label>' +
            '<select class="glass-select-base add-provider-input">' +
              '<option value="gemini-compatible">Gemini 兼容</option>' +
              '<option value="openai-compatible">OpenAI 兼容</option>' +
            '</select>' +
          '</div>' +
          // Name
          '<div class="add-provider-field">' +
            '<label class="add-provider-label">名称</label>' +
            '<input type="text" class="glass-input-base add-provider-input" placeholder="名称" />' +
          '</div>' +
          // Base URL
          '<div class="add-provider-field">' +
            '<label class="add-provider-label">Base URL</label>' +
            '<input type="text" class="glass-input-base add-provider-input" placeholder="Base URL" style="font-family:monospace;" />' +
          '</div>' +
          // API Key
          '<div class="add-provider-field">' +
            '<label class="add-provider-label">API Key</label>' +
            '<input type="password" class="glass-input-base add-provider-input" placeholder="API Key" />' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="modal-footer">' +
        '<button class="glass-btn-base glass-btn-secondary" onclick="window.__closeAddProvider()">取消</button>' +
        '<button class="glass-btn-base glass-btn-primary" onclick="window.__testAndAddProvider()">测试连接</button>' +
      '</div>';
    overlay.appendChild(modal);
    return overlay;
  }

  // --- Actions ---
  window.__updateConcurrency = function(key, val) {
    var n = parseInt(val, 10);
    if (n > 0) { workflowConcurrency[key] = n; }
  };

  window.__updateDefaultModel = function(field, val) {
    defaultModels[field] = val;
  };

  window.__updateApiKey = function(providerId, val) {
    var p = providers.find(function(p) { return p.id === providerId; });
    if (p) { p.apiKey = val; }
  };

  window.__updateBaseUrl = function(providerId, val) {
    var p = providers.find(function(p) { return p.id === providerId; });
    if (p) { p.baseUrl = val; }
  };

  window.__toggleApiKey = function(providerId) {
    showApiKey[providerId] = !showApiKey[providerId];
    render();
  };

  window.__connectProvider = function(providerId) {
    var p = providers.find(function(p) { return p.id === providerId; });
    if (p && p.apiKey) {
      p.hasApiKey = true;
      // Auto-enable all models for this provider
      getModelsByProvider(providerId).forEach(function(m) {
        enabledModels[providerId + '::' + m.modelId] = true;
      });
      saveStatus = 'saving';
      render();
      setTimeout(function() {
        saveStatus = 'saved';
        render();
      }, 1000);
    }
  };

  window.__toggleModel = function(providerId, modelId) {
    var key = providerId + '::' + modelId;
    enabledModels[key] = !enabledModels[key];
    render();
  };

  window.__toggleHideProvider = function(providerId) {
    var idx = hiddenProviders.indexOf(providerId);
    if (idx === -1) {
      hiddenProviders.push(providerId);
    } else {
      hiddenProviders.splice(idx, 1);
    }
    render();
  };

  window.__openAddProvider = function() {
    showAddProviderModal = true;
    render();
  };

  window.__closeAddProvider = function() {
    showAddProviderModal = false;
    render();
  };

  window.__testAndAddProvider = function() {
    showAddProviderModal = false;
    render();
  };

  // --- Init ---
  render();
})();
