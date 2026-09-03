// ============================================
// Asset Hub Page
// ============================================

(function() {
  var app = document.getElementById('app');
  app.innerHTML = '';

  // Global sidebar layout
  var layoutData = renderAppLayout();
  app.appendChild(layoutData.layout);
  var mainArea = layoutData.mainArea;

  // Page
  var page = el('div', { className: 'glass-page', style: { minHeight: '100vh' } });
  var layout = el('div', { className: 'asset-hub-layout' });

  // Sidebar
  var sidebar = el('div', { className: 'asset-hub-sidebar app-scrollbar' });
  layout.appendChild(sidebar);

  // Main
  var main = el('div', { className: 'asset-hub-main app-scrollbar' });
  layout.appendChild(main);

  page.appendChild(layout);
  mainArea.appendChild(page);

  function rerender() {
    renderSidebar();
    renderMain();
  }

  function renderSidebar() {
    sidebar.innerHTML =
      '<div class="sidebar-section">' +
        '<div class="sidebar-title">资产类型</div>' +
        '<div class="sidebar-item ' + (state.assetHubTab === 'characters' ? 'active' : '') + '" data-tab="characters">' +
          icon('user', 'icon-sm') + ' 角色' +
          '<span class="glass-chip glass-chip-neutral" style="font-size:10px;margin-left:auto;">' + state.assets.characters.length + '</span>' +
        '</div>' +
        '<div class="sidebar-item ' + (state.assetHubTab === 'locations' ? 'active' : '') + '" data-tab="locations">' +
          icon('mapPin', 'icon-sm') + ' 场景' +
          '<span class="glass-chip glass-chip-neutral" style="font-size:10px;margin-left:auto;">' + state.assets.locations.length + '</span>' +
        '</div>' +
        '<div class="sidebar-item ' + (state.assetHubTab === 'props' ? 'active' : '') + '" data-tab="props">' +
          icon('package', 'icon-sm') + ' 道具' +
          '<span class="glass-chip glass-chip-neutral" style="font-size:10px;margin-left:auto;">' + state.assets.props.length + '</span>' +
        '</div>' +
        '<div class="sidebar-item ' + (state.assetHubTab === 'voices' ? 'active' : '') + '" data-tab="voices">' +
          icon('mic', 'icon-sm') + ' 音色' +
          '<span class="glass-chip glass-chip-neutral" style="font-size:10px;margin-left:auto;">' + state.assets.voices.length + '</span>' +
        '</div>' +
      '</div>' +
      '<div class="sidebar-section">' +
        '<div class="sidebar-title">文件夹</div>' +
        '<div class="sidebar-item">' + icon('folder', 'icon-sm') + ' 所有资产</div>' +
        '<div class="sidebar-item">' + icon('folder', 'icon-sm') + ' 未分类</div>' +
        '<button class="glass-btn-base glass-btn-soft w-full mt-2" style="padding: 8px; font-size: 12px;">' +
          icon('folderPlus', 'icon-sm') + ' 新建文件夹' +
        '</button>' +
      '</div>';

    // Wire up sidebar tabs
    sidebar.querySelectorAll('[data-tab]').forEach(function(item) {
      item.addEventListener('click', function() {
        state.assetHubTab = this.getAttribute('data-tab');
        rerender();
      });
    });
  }

  function renderMain() {
    var titles = { characters: '角色', locations: '场景', props: '道具', voices: '音色' };
    var descs = {
      characters: '管理您的全局角色资产',
      locations: '管理您的全局场景资产',
      props: '管理您的全局道具资产',
      voices: '管理您的全局音色资产',
    };
    var addLabels = {
      characters: '新建角色',
      locations: '新建场景',
      props: '新建道具',
      voices: '新建音色',
    };

    var header = el('div', { className: 'flex items-center justify-between mb-6' });
    header.innerHTML =
      '<div>' +
        '<div class="text-lg font-bold">' + titles[state.assetHubTab] + '</div>' +
        '<div class="text-sm text-tertiary mt-2">' + descs[state.assetHubTab] + '</div>' +
      '</div>' +
      '<div class="flex gap-2">' +
        '<button class="glass-btn-base glass-btn-secondary" style="padding: 8px 14px; font-size: 12px;">' +
          icon('download', 'icon-sm') + ' 打包下载' +
        '</button>' +
        '<button class="glass-btn-base glass-btn-primary" style="padding: 8px 14px; font-size: 12px;" id="btn-add-asset">' +
          icon('plus', 'icon-sm') + ' ' + addLabels[state.assetHubTab] +
        '</button>' +
      '</div>';
    main.innerHTML = '';
    main.appendChild(header);

    // Search bar
    var search = el('div', { className: 'glass-surface-soft', style: { padding: '8px 16px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' } });
    search.innerHTML =
      icon('search', 'icon-sm text-tertiary') +
      '<input type="text" placeholder="搜索资产名称或文件夹..." style="border:none;outline:none;background:transparent;flex:1;font-size:13px;color:var(--glass-text-primary);" />';
    main.appendChild(search);

    // Grid
    var grid = el('div', { className: 'asset-grid' });
    var assets = state.assets[state.assetHubTab] || [];
    var iconMap = { characters: 'user', locations: 'mapPin', props: 'package', voices: 'mic' };

    assets.forEach(function(a) {
      var tile = el('div', { className: 'asset-tile glass-surface' });
      tile.innerHTML =
        '<div class="asset-tile-image">' +
          '<div class="text-center text-tertiary">' + icon(iconMap[state.assetHubTab] || 'image', 'icon-xl') + '</div>' +
        '</div>' +
        '<div class="asset-tile-body">' +
          '<div class="asset-tile-name">' + a.name + '</div>' +
          '<div class="asset-tile-desc">' + a.description + '</div>' +
        '</div>';
      grid.appendChild(tile);
    });

    // Add tile
    var addTile = el('div', { className: 'asset-tile glass-surface', style: { borderStyle: 'dashed', cursor: 'pointer' } });
    addTile.innerHTML =
      '<div class="asset-tile-image" style="border:2px dashed var(--glass-stroke-base);">' +
        '<div class="text-center text-tertiary">' + icon('plus', 'icon-xl') + '</div>' +
      '</div>' +
      '<div class="asset-tile-body">' +
        '<div class="asset-tile-name text-center" style="color:var(--glass-text-tertiary);">' + addLabels[state.assetHubTab] + '</div>' +
      '</div>';
    addTile.addEventListener('click', function() { showAssetCreateModal(state.assetHubTab); });
    grid.appendChild(addTile);

    main.appendChild(grid);

    // Wire up add button
    var addBtn = main.querySelector('#btn-add-asset');
    if (addBtn) {
      addBtn.addEventListener('click', function() { showAssetCreateModal(state.assetHubTab); });
    }
  }

  // --- Asset Create Modal ---
  function showAssetCreateModal(type) {
    var titles = { characters: '新建角色', locations: '新建场景', props: '新建道具', voices: '新建音色' };
    var nameLabels = { characters: '角色名称', locations: '场景名称', props: '道具名称', voices: '音色名称' };
    var descLabels = { characters: '角色描述', locations: '场景描述', props: '图片描述', voices: '音色描述' };
    var placeholders = {
      characters: '请描述角色的外形特征、服装、发型等...',
      locations: '请描述场景的环境、氛围、特征等...',
      props: '只写道具本体的材质、颜色、结构和装饰细节...',
      voices: '描述声音特征：年龄、性别、音色、语调...',
    };

    var overlay = el('div', { className: 'modal-overlay glass-overlay' });
    var container = el('div', { className: 'modal-container glass-surface-modal' });
    container.style.maxWidth = '480px';

    var aiSection = (type === 'characters' || type === 'locations')
      ? '<div class="glass-surface-soft mb-4" style="padding: 12px 16px;">' +
          '<div class="flex items-center gap-2 text-sm" style="color: var(--glass-tone-info-fg);">' +
            icon('sparkles', 'icon-sm') +
            '<span style="font-weight: 600;">AI 设计</span>' +
          '</div>' +
          '<p class="text-xs text-tertiary mt-2">输入简单描述，AI 帮你生成详细设定</p>' +
          '<button class="glass-btn-base glass-btn-secondary mt-2 w-full" style="padding: 8px; font-size: 12px;">' +
            icon('wand', 'icon-sm') + ' AI 生成描述' +
          '</button>' +
        '</div>'
      : '';

    var tabSection = (type === 'characters')
      ? '<div class="mb-4"><div class="tab-bar mb-4"><div class="tab-item active">描述模式</div><div class="tab-item">参考图模式</div></div></div>'
      : '';

    container.innerHTML =
      '<div class="modal-header">' +
        '<div class="modal-title">' + titles[type] + '</div>' +
      '</div>' +
      tabSection +
      '<div class="mb-4">' +
        '<label class="glass-field-label mb-2" style="display:block;">' + nameLabels[type] + '</label>' +
        '<input type="text" class="glass-input-base" placeholder="请输入' + nameLabels[type] + '..." />' +
      '</div>' +
      '<div class="mb-4">' +
        '<label class="glass-field-label mb-2" style="display:block;">' + descLabels[type] + '</label>' +
        '<textarea class="glass-textarea-base" rows="4" placeholder="' + placeholders[type] + '"></textarea>' +
      '</div>' +
      aiSection +
      '<div class="modal-footer">' +
        '<button class="glass-btn-base glass-btn-ghost" onclick="this.closest(\'.modal-overlay\').remove()">' + t.common.cancel + '</button>' +
        '<button class="glass-btn-base glass-btn-primary" onclick="this.closest(\'.modal-overlay\').remove()">' +
          icon('plus', 'icon-sm') + ' ' + t.common.create +
        '</button>' +
      '</div>';

    overlay.appendChild(container);
    overlay.addEventListener('click', function(e) { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);
  }

  rerender();
})();
