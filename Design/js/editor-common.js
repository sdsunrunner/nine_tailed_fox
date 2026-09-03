// ============================================
// Editor Common - Shared layout for all editor stage pages
// Provides: aurora bg, top nav, stage nav bar, content/modal containers, helpers
// ============================================

var EditorCommon = (function() {

  // --- Constants ---
  var STAGES = [
    { id: 'config',     label: t.stages.story,      href: 'editor.html',            status: 'ready' },
    { id: 'script',     label: t.stages.script,     href: 'editor-script.html',     status: 'empty' },
    { id: 'storyboard', label: t.stages.storyboard, href: 'editor-storyboard.html', status: 'empty' },
    { id: 'videos',     label: t.stages.video,      disabled: true, disabledLabel: '即将开放' },
    { id: 'editor',     label: t.stages.editor,     disabled: true, disabledLabel: t.stages.editorComingSoon },
  ];

  var RATIO_OPTIONS = [
    { value: '9:16',  label: '9:16',  recommended: true },
    { value: '16:9',  label: '16:9' },
    { value: '1:1',   label: '1:1' },
    { value: '4:3',   label: '4:3' },
    { value: '3:4',   label: '3:4' },
    { value: '2:3',   label: '2:3' },
    { value: '3:2',   label: '3:2' },
    { value: '4:5',   label: '4:5' },
    { value: '5:4',   label: '5:4' },
    { value: '21:9',  label: '21:9' },
  ];

  var STYLE_OPTIONS = [
    { value: 'american-comic',   label: '漫画风',     preview: '漫' },
    { value: 'chinese-comic',    label: '精致国漫',   preview: '国' },
    { value: 'japanese-anime',   label: '日系动漫风', preview: '日' },
    { value: 'realistic',        label: '真人风格',   preview: '实', recommended: true },
  ];

  var EPISODES = [
    { id: 'ep1', name: '第一集 \u00b7 命运的怀表' },
    { id: 'ep2', name: '第二集 \u00b7 时空的裂缝' },
    { id: 'ep3', name: '第三集 \u00b7 迷失的世界' },
  ];

  // --- Init page layout ---
  function init(activeStage) {
    var app = document.getElementById('app');
    app.innerHTML = '';

    // Aurora background (fixed, at app level)
    var bg = el('div', { className: 'editor-aurora-bg' });
    bg.innerHTML =
      '<div class="aurora-blobs">' +
        '<div class="aurora-blob blob-1"></div>' +
        '<div class="aurora-blob blob-2"></div>' +
        '<div class="aurora-blob blob-3"></div>' +
      '</div>' +
      '<div class="aurora-overlay"></div>';
    app.appendChild(bg);

    // Global sidebar layout
    var layoutData = renderAppLayout();
    app.appendChild(layoutData.layout);
    var mainArea = layoutData.mainArea;
    // Editor pages manage their own internal scroll areas
    mainArea.style.overflow = 'hidden';
    mainArea.style.display = 'flex';
    mainArea.style.flexDirection = 'column';

    // Stage nav bar
    var stageNav = el('div', { className: 'stage-nav-bar' });

    // Left: back + episode name breadcrumb
    var navLeft = el('div', { className: 'stage-nav-left' });

    var backBtn = el('a', { className: 'stage-back-btn', href: 'episodes.html' });
    backBtn.innerHTML = icon('back');
    navLeft.appendChild(backBtn);

    var epName = el('a', { className: 'episode-breadcrumb', href: 'episodes.html' });
    epName.textContent = EPISODES[0].name;
    navLeft.appendChild(epName);

    // Center: stage tabs pill (as <a> links)
    var stageTabs = el('div', { className: 'stage-tabs-pill' });
    STAGES.forEach(function(s) {
      var tab;
      if (s.href) {
        tab = el('a', {
          className: 'stage-tab' + (activeStage === s.id ? ' active' : '') + (s.status === 'ready' ? ' ready' : ''),
          href: s.href,
        });
      } else {
        tab = el('div', {
          className: 'stage-tab' + (activeStage === s.id ? ' active' : '') + (s.disabled ? ' disabled' : ''),
        });
      }
      tab.innerHTML =
        '<span class="stage-tab-label">' + s.label + '</span>' +
        (s.disabled ? '<span class="stage-tab-badge">' + s.disabledLabel + '</span>' : '');
      stageTabs.appendChild(tab);
    });

    // Right: toolbar buttons
    var navRight = el('div', { className: 'stage-nav-right' });

    var refreshBtn = el('button', { className: 'stage-toolbar-btn', onclick: function() {} });
    refreshBtn.innerHTML = icon('refresh', 'icon-sm') + '<span>刷新</span>';
    navRight.appendChild(refreshBtn);

    var assetBtn = el('a', { className: 'stage-toolbar-btn secondary', href: 'asset-hub.html' });
    assetBtn.innerHTML = icon('library', 'icon-sm') + '<span>' + t.novelPromotion.assetLibrary + '</span>';
    navRight.appendChild(assetBtn);

    var settingsBtn = el('button', { className: 'stage-toolbar-btn icon-only', onclick: function() { showSettingsModal(modalContainer); } });
    settingsBtn.innerHTML = icon('settings', 'icon-sm');
    navRight.appendChild(settingsBtn);

    stageNav.appendChild(navLeft);
    stageNav.appendChild(stageTabs);
    stageNav.appendChild(navRight);
    mainArea.appendChild(stageNav);

    // Content container
    var contentWrap = el('div', { className: 'editor-content-wrap app-scrollbar', id: 'editor-content' });
    mainArea.appendChild(contentWrap);

    // Modal container
    var modalContainer = el('div', { id: 'modal-container' });
    mainArea.appendChild(modalContainer);

    return { contentWrap: contentWrap, modalContainer: modalContainer, STAGES: STAGES };
  }

  // --- Settings Modal (shared) ---
  function showSettingsModal(modalContainer) {
    modalContainer.innerHTML = '';
    var overlay = el('div', { className: 'modal-overlay glass-overlay', onclick: function(e) { if (e.target === overlay) { modalContainer.innerHTML = ''; } } });
    var container = el('div', { className: 'modal-container glass-surface-modal' });
    container.style.maxWidth = '640px';
    container.style.maxHeight = '80vh';
    container.style.overflow = 'auto';

    container.innerHTML =
      '<div class="modal-header">' +
        '<div>' +
          '<div class="modal-title">' + t.novelPromotion.settings + '</div>' +
          '<div class="modal-subtitle">默认沿用设置中心的全局配置，也可为当前项目单独自定义</div>' +
        '</div>' +
        '<button class="modal-close" id="settings-close">' + icon('x', 'icon-sm') + '</button>' +
      '</div>' +
      '<div class="modal-body">' +
        '<div class="modal-label" style="margin-bottom:8px;">画面设置</div>' +
        '<div style="display:flex;gap:12px;margin-bottom:16px;">' +
          '<select class="glass-select-base" style="flex:1;">' +
            STYLE_OPTIONS.map(function(s) { return '<option>' + s.label + '</option>'; }).join('') +
          '</select>' +
          '<select class="glass-select-base" style="flex:1;">' +
            RATIO_OPTIONS.map(function(r) { return '<option>' + r.label + '</option>'; }).join('') +
          '</select>' +
        '</div>' +
        '<div class="modal-label" style="margin-bottom:8px;">模型参数</div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px;">' +
          '<div><div style="font-size:12px;color:var(--glass-text-tertiary);margin-bottom:4px;">分析模型</div><select class="glass-select-base"><option>doubao-1.5-pro</option></select></div>' +
          '<div><div style="font-size:12px;color:var(--glass-text-tertiary);margin-bottom:4px;">人物模型</div><select class="glass-select-base"><option>flux-dev</option></select></div>' +
          '<div><div style="font-size:12px;color:var(--glass-text-tertiary);margin-bottom:4px;">场景模型</div><select class="glass-select-base"><option>flux-dev</option></select></div>' +
          '<div><div style="font-size:12px;color:var(--glass-text-tertiary);margin-bottom:4px;">视频模型</div><select class="glass-select-base"><option>kling-v2</option></select></div>' +
        '</div>' +
        '<div class="modal-label" style="margin-bottom:8px;">旁白配置</div>' +
        '<div style="display:flex;gap:12px;">' +
          '<select class="glass-select-base" style="flex:1;"><option>温柔女声</option><option>沉稳男声</option></select>' +
          '<select class="glass-select-base" style="flex:1;"><option>语速 1.0x</option><option>语速 0.8x</option><option>语速 1.2x</option></select>' +
        '</div>' +
      '</div>' +
      '<div class="modal-footer">' +
        '<button class="glass-btn-base glass-btn-ghost" id="settings-cancel">' + t.common.cancel + '</button>' +
        '<button class="glass-btn-base glass-btn-primary" id="settings-ok">' + icon('check', 'icon-sm') + ' ' + t.common.confirm + '</button>' +
      '</div>';

    overlay.appendChild(container);
    modalContainer.appendChild(overlay);

    setTimeout(function() {
      var closeBtn = container.querySelector('#settings-close');
      if (closeBtn) closeBtn.addEventListener('click', function() { modalContainer.innerHTML = ''; });
      var cancelBtn = container.querySelector('#settings-cancel');
      if (cancelBtn) cancelBtn.addEventListener('click', function() { modalContainer.innerHTML = ''; });
      var okBtn = container.querySelector('#settings-ok');
      if (okBtn) okBtn.addEventListener('click', function() { modalContainer.innerHTML = ''; });
    }, 0);
  }

  // --- Helpers ---
  function escapeHtml(text) {
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function countWords(text) {
    if (!text) return 0;
    var enCount = 0;
    var stripped = text.replace(/[a-zA-Z0-9]+/g, function() { enCount++; return ''; });
    var cjkMatch = stripped.match(/[\u4e00-\u9fa5\u3400-\u4dbf]/g);
    var cjkCount = cjkMatch ? cjkMatch.length : 0;
    return enCount + cjkCount;
  }

  return {
    STAGES: STAGES,
    RATIO_OPTIONS: RATIO_OPTIONS,
    STYLE_OPTIONS: STYLE_OPTIONS,
    EPISODES: EPISODES,
    init: init,
    showSettingsModal: showSettingsModal,
    escapeHtml: escapeHtml,
    countWords: countWords,
  };
})();
