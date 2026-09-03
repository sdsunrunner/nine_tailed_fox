// ============================================
// Workspace Page — 我的项目 (Projects Listing)
// Matches http://localhost:13000/zh/workspace
// ============================================

(function() {
  var app = document.getElementById('app');
  app.innerHTML = '';

  // Global sidebar layout
  var layoutData = renderAppLayout();
  app.appendChild(layoutData.layout);
  var mainArea = layoutData.mainArea;

  // --- i18n ---
  var T = {
    title: '我的项目',
    subtitle: '管理您的AI动漫制作项目',
    newProject: '新建项目',
    searchPlaceholder: '搜索项目名称或描述...',
    searchButton: '搜索',
    clearButton: '清除',
    updatedAt: '更新于',
    noProjects: '还没有项目',
    noProjectsDesc: '创建您的第一个AI动漫制作项目',
    noResults: '没有找到匹配的项目',
    noResultsDesc: '尝试使用不同的搜索词',
    createProject: '新建项目',
    editProject: '编辑项目',
    deleteProject: '删除项目',
    deleteConfirm: '确定要删除项目"{name}"吗？此操作无法撤销。',
    projectName: '项目名称',
    projectNamePlaceholder: '输入项目名称',
    projectDescription: '项目描述（可选）',
    projectDescriptionPlaceholder: '输入项目描述',
    creating: '创建中...',
    saving: '保存中...',
    createFailed: '创建项目失败',
    analysisModelRequiredAfterCreate: '项目已创建。请先前往个人设置配置默认模型（至少设置分析模型），否则无法使用。',
    updateFailed: '更新项目失败',
    deleteFailed: '删除项目失败',
    totalProjects: '共 {count} 个项目',
    statsEpisodes: '章节数',
    statsImages: '图片数',
    statsVideos: '视频数',
    noContent: '暂无内容',
    modelNotConfiguredBefore: '检测到尚未配置模型，请先前往',
    modelNotConfiguredLink: '设置中心',
    modelNotConfiguredAfter: '配置模型，或在创建项目后于项目配置中自定义。',
    loading: '加载中...',
    cancel: '取消',
    save: '保存',
    delete: '删除',
    confirm: '确认',
  };

  // --- State ---
  var projects = [
    { id: 'p1', name: '雨夜便利店', description: '一个雨夜的便利店，三个陌生人因一场意外被困于此，揭开各自隐藏的秘密', stats: { episodes: 1, images: 0, videos: 0 }, updatedAt: Date.now() - 3600000 * 2 },
    { id: 'p2', name: '校园青春物语', description: '一段关于高中生活的浪漫故事，讲述少年少女们在校园中的成长与心动', stats: { episodes: 5, images: 23, videos: 8 }, updatedAt: Date.now() - 86400000 * 2 },
    { id: 'p3', name: '星际迷航记', description: '太空冒险科幻短剧，讲述人类在星际间的探索故事', stats: { episodes: 3, images: 15, videos: 5 }, updatedAt: Date.now() - 86400000 * 4 },
    { id: 'p4', name: '古风仙侠录', description: '修仙世界的恩怨情仇，少年剑客踏入仙途，历经磨难终成大道', stats: { episodes: 8, images: 42, videos: 12 }, updatedAt: Date.now() - 86400000 * 7 },
    { id: 'p5', name: '都市奇缘', description: '现代都市中的奇妙遭遇，平凡女孩意外获得超能力后的生活', stats: { episodes: 2, images: 8, videos: 0 }, updatedAt: Date.now() - 60000 * 30 },
    { id: 'p6', name: '末日旅人', description: '后末日世界的生存之旅，独行者在废墟中寻找希望的微光', stats: { episodes: 6, images: 31, videos: 10 }, updatedAt: Date.now() - 86400000 },
  ];

  var searchValue = '';
  var activeSearch = '';
  var isLoading = false;
  var showCreateModal = false;
  var showEditModal = false;
  var editingProject = null;
  var showDeleteConfirm = false;
  var deletingProject = null;
  var createForm = { name: '', description: '' };
  var editForm = { name: '', description: '' };
  var createError = null;
  var editError = null;
  var isSaving = false;
  var modelConfigured = false; // Set to true to hide the warning
  var pagination = { page: 1, pageSize: 7, total: projects.length, totalPages: Math.ceil(projects.length / 7) };

  // --- Page container ---
  var page = el('div', { className: 'glass-page ws-page' });
  var main = el('main', { className: 'ws-main' });
  page.appendChild(main);
  mainArea.appendChild(page);

  // --- Render header ---
  function renderHeader() {
    var header = el('div', { className: 'ws-header' });

    var left = el('div', { className: 'ws-header-left' });
    left.appendChild(el('h1', { textContent: T.title }));
    left.appendChild(el('p', { textContent: T.subtitle }));
    header.appendChild(left);

    var right = el('div', { className: 'ws-header-right' });
    var searchInput = el('input', {
      type: 'text',
      className: 'glass-input-base ws-search-input',
      placeholder: T.searchPlaceholder,
      value: searchValue,
      oninput: function(e) { searchValue = e.target.value; },
      onkeydown: function(e) { if (e.key === 'Enter') doSearch(); },
    });
    right.appendChild(searchInput);

    var searchBtn = el('button', {
      className: 'glass-btn-base glass-btn-primary',
      style: { padding: '8px 16px', fontSize: '13px' },
      onclick: doSearch,
    });
    searchBtn.textContent = T.searchButton;
    right.appendChild(searchBtn);

    if (activeSearch) {
      var clearBtn = el('button', {
        className: 'glass-btn-base glass-btn-secondary ws-clear-btn visible',
        style: { padding: '8px 16px', fontSize: '13px' },
        onclick: function() {
          searchValue = '';
          activeSearch = '';
          pagination.page = 1;
          render();
        },
      });
      clearBtn.textContent = T.clearButton;
      right.appendChild(clearBtn);
    }

    header.appendChild(right);
    return header;
  }

  function doSearch() {
    activeSearch = searchValue;
    pagination.page = 1;
    render();
  }

  // --- Render grid ---
  function renderGrid() {
    var grid = el('div', { className: 'ws-grid' });

    // New project card
    var newCard = el('div', {
      className: 'glass-surface ws-card-new',
      onclick: function() {
        showCreateModal = true;
        createForm = { name: '', description: '' };
        createError = null;
        render();
      },
    });
    newCard.innerHTML =
      '<div class="ws-card-new-inner">' +
        '<div class="ws-card-new-icon">' + icon('plus') + '</div>' +
        '<span class="ws-card-new-text">' + T.newProject + '</span>' +
      '</div>';
    grid.appendChild(newCard);

    // Loading skeletons
    if (isLoading) {
      for (var i = 0; i < 3; i++) {
        var skel = el('div', { className: 'glass-surface ws-skeleton' });
        skel.innerHTML =
          '<div class="ws-skeleton-line"></div>' +
          '<div class="ws-skeleton-line mid"></div>' +
          '<div class="ws-skeleton-line short"></div>';
        grid.appendChild(skel);
      }
      return grid;
    }

    // Filter projects
    var filtered = projects;
    if (activeSearch) {
      var q = activeSearch.toLowerCase();
      filtered = projects.filter(function(p) {
        return (p.name && p.name.toLowerCase().indexOf(q) >= 0) ||
               (p.description && p.description.toLowerCase().indexOf(q) >= 0);
      });
    }

    // Pagination
    var start = (pagination.page - 1) * pagination.pageSize;
    var pageItems = filtered.slice(start, start + pagination.pageSize);
    pagination.total = filtered.length;
    pagination.totalPages = Math.max(1, Math.ceil(filtered.length / pagination.pageSize));

    // Empty states
    if (filtered.length === 0) {
      var empty = el('div', { className: 'ws-empty', style: { gridColumn: '1 / -1' } });
      if (activeSearch) {
        empty.innerHTML =
          '<div class="ws-empty-icon">' + icon('search') + '</div>' +
          '<h3>' + T.noResults + '</h3>' +
          '<p>' + T.noResultsDesc + '</p>';
      } else {
        empty.innerHTML =
          '<div class="ws-empty-icon">' + icon('inbox') + '</div>' +
          '<h3>' + T.noProjects + '</h3>' +
          '<p>' + T.noProjectsDesc + '</p>';
      }
      grid.appendChild(empty);
      return grid;
    }

    // Project cards
    pageItems.forEach(function(p) {
      var card = el('a', {
        className: 'glass-surface ws-card',
        href: 'episodes.html',
      });

      var hasStats = p.stats && (p.stats.episodes > 0 || p.stats.images > 0 || p.stats.videos > 0);

      var statsHtml = '';
      if (hasStats) {
        statsHtml = '<div class="ws-card-stats">';
        var statParts = [];
        if (p.stats.episodes > 0) {
          statParts.push('<span class="ws-card-stat-item">' + icon('layers', 'icon-xs') + p.stats.episodes + ' ' + T.statsEpisodes + '</span>');
        }
        if (p.stats.images > 0) {
          statParts.push('<span class="ws-card-stat-item">' + icon('imageIcon', 'icon-xs') + p.stats.images + ' ' + T.statsImages + '</span>');
        }
        if (p.stats.videos > 0) {
          statParts.push('<span class="ws-card-stat-item">' + icon('videoIcon', 'icon-xs') + p.stats.videos + ' ' + T.statsVideos + '</span>');
        }
        statsHtml += statParts.join('') + '</div>';
      } else {
        statsHtml = '<div class="ws-card-no-content">' + T.noContent + '</div>';
      }

      card.innerHTML =
        // Action buttons (hover)
        '<div class="ws-card-actions">' +
          '<button class="ws-card-action-btn edit" title="' + T.editProject + '" data-action="edit">' + icon('editSquare') + '</button>' +
          '<button class="ws-card-action-btn delete" title="' + T.deleteProject + '" data-action="delete">' + icon('trash') + '</button>' +
        '</div>' +
        // Body
        '<div class="ws-card-body">' +
          '<h3 class="ws-card-name">' + escapeHtml(p.name) + '</h3>' +
          '<div class="ws-card-desc">' +
            icon('fileText') +
            '<p>' + escapeHtml(p.description || '') + '</p>' +
          '</div>' +
          statsHtml +
          '<div class="ws-card-footer">' +
            icon('clock') +
            '<span class="ws-card-time">' + T.updatedAt + ' ' + formatDate(p.updatedAt) + '</span>' +
          '</div>' +
          '<div class="ws-card-bottom">' +
            '<span class="ws-card-bottom-left">' + icon('film', 'icon-xs') + '<span>' + p.id + '</span></span>' +
          '</div>' +
        '</div>';

      // Handle action button clicks
      card.querySelector('[data-action="edit"]').addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        editingProject = p;
        editForm = { name: p.name, description: p.description || '' };
        editError = null;
        showEditModal = true;
        render();
      });

      card.querySelector('[data-action="delete"]').addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        deletingProject = p;
        showDeleteConfirm = true;
        render();
      });

      grid.appendChild(card);
    });

    return grid;
  }

  // --- Render pagination ---
  function renderPagination() {
    if (pagination.totalPages <= 1) return null;

    var pag = el('div', { className: 'ws-pagination' });

    var prevBtn = el('button', {
      className: 'ws-page-btn',
      disabled: pagination.page <= 1,
      onclick: function() {
        if (pagination.page > 1) { pagination.page--; render(); }
      },
    });
    prevBtn.innerHTML = icon('chevronLeft') + T.loading;
    prevBtn.lastChild.remove(); // remove "加载中..."
    prevBtn.innerHTML = icon('chevronLeft');
    pag.appendChild(prevBtn);

    var info = el('span', { className: 'ws-page-info' });
    info.textContent = pagination.page + ' / ' + pagination.totalPages;
    pag.appendChild(info);

    var nextBtn = el('button', {
      className: 'ws-page-btn',
      disabled: pagination.page >= pagination.totalPages,
      onclick: function() {
        if (pagination.page < pagination.totalPages) { pagination.page++; render(); }
      },
    });
    nextBtn.innerHTML = icon('chevronRight');
    pag.appendChild(nextBtn);

    var count = el('span', { className: 'ws-page-count' });
    count.textContent = T.totalProjects.replace('{count}', pagination.total);
    pag.appendChild(count);

    return pag;
  }

  // --- Create modal ---
  function renderCreateModal() {
    var overlay = el('div', { className: 'ws-modal-overlay' });
    var modal = el('div', { className: 'glass-surface ws-modal' });
    modal.innerHTML = '';

    var title = el('h2', { className: 'ws-modal-title', textContent: T.createProject });
    modal.appendChild(title);

    // Model not configured warning
    if (!modelConfigured) {
      var warn = el('div', { className: 'ws-modal-warn' });
      warn.innerHTML =
        icon('alertTriangle') +
        '<span>' + T.modelNotConfiguredBefore +
        ' <a href="settings.html">' + T.modelNotConfiguredLink + '</a> ' +
        T.modelNotConfiguredAfter + '</span>';
      modal.appendChild(warn);
    }

    // Name field
    var nameLabel = el('label', { className: 'ws-field-label', textContent: T.projectName });
    modal.appendChild(nameLabel);
    var nameInput = el('input', {
      type: 'text',
      className: 'glass-input-base ws-modal-input',
      placeholder: T.projectNamePlaceholder,
      value: createForm.name,
      oninput: function(e) { createForm.name = e.target.value; },
    });
    modal.appendChild(nameInput);

    // Description field
    var descLabel = el('label', { className: 'ws-field-label', textContent: T.projectDescription });
    modal.appendChild(descLabel);
    var descTextarea = el('textarea', {
      className: 'glass-textarea-base ws-modal-textarea',
      placeholder: T.projectDescriptionPlaceholder,
      oninput: function(e) { createForm.description = e.target.value; },
    });
    descTextarea.value = createForm.description;
    modal.appendChild(descTextarea);

    // Error
    if (createError) {
      var err = el('div', { className: 'ws-modal-error', textContent: createError });
      modal.appendChild(err);
    }

    // Actions
    var actions = el('div', { className: 'ws-modal-actions' });
    var cancelBtn = el('button', {
      className: 'glass-btn-base glass-btn-secondary',
      style: { padding: '8px 16px', fontSize: '13px' },
      onclick: function() {
        showCreateModal = false;
        createForm = { name: '', description: '' };
        createError = null;
        render();
      },
    });
    cancelBtn.textContent = T.cancel;
    actions.appendChild(cancelBtn);

    var saveBtn = el('button', {
      className: 'glass-btn-base glass-btn-primary',
      style: { padding: '8px 16px', fontSize: '13px', opacity: isSaving ? '0.5' : '1' },
      disabled: isSaving,
      onclick: function() {
        if (!createForm.name.trim()) {
          createError = '项目名称不能为空。';
          render();
          return;
        }
        if (createForm.name.length > 100) {
          createError = '项目名称不能超过 100 个字符。';
          render();
          return;
        }
        // Create project
        isSaving = true;
        render();
        setTimeout(function() {
          var newProject = {
            id: 'p' + (projects.length + 1),
            name: createForm.name.trim(),
            description: createForm.description.trim() || '',
            stats: { episodes: 0, images: 0, videos: 0 },
            updatedAt: Date.now(),
          };
          projects.unshift(newProject);
          isSaving = false;
          showCreateModal = false;
          createForm = { name: '', description: '' };
          createError = null;
          pagination.page = 1;
          render();
        }, 600);
      },
    });
    saveBtn.textContent = isSaving ? T.creating : T.save;
    actions.appendChild(saveBtn);
    modal.appendChild(actions);

    overlay.appendChild(modal);
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) {
        showCreateModal = false;
        createForm = { name: '', description: '' };
        createError = null;
        render();
      }
    });
    return overlay;
  }

  // --- Edit modal ---
  function renderEditModal() {
    var overlay = el('div', { className: 'ws-modal-overlay' });
    var modal = el('div', { className: 'glass-surface ws-modal' });

    var title = el('h2', { className: 'ws-modal-title', textContent: T.editProject });
    modal.appendChild(title);

    var nameLabel = el('label', { className: 'ws-field-label', textContent: T.projectName });
    modal.appendChild(nameLabel);
    var nameInput = el('input', {
      type: 'text',
      className: 'glass-input-base ws-modal-input',
      placeholder: T.projectNamePlaceholder,
      value: editForm.name,
      oninput: function(e) { editForm.name = e.target.value; },
    });
    modal.appendChild(nameInput);

    var descLabel = el('label', { className: 'ws-field-label', textContent: T.projectDescription });
    modal.appendChild(descLabel);
    var descTextarea = el('textarea', {
      className: 'glass-textarea-base ws-modal-textarea',
      placeholder: T.projectDescriptionPlaceholder,
      oninput: function(e) { editForm.description = e.target.value; },
    });
    descTextarea.value = editForm.description;
    modal.appendChild(descTextarea);

    if (editError) {
      var err = el('div', { className: 'ws-modal-error', textContent: editError });
      modal.appendChild(err);
    }

    var actions = el('div', { className: 'ws-modal-actions' });
    var cancelBtn = el('button', {
      className: 'glass-btn-base glass-btn-secondary',
      style: { padding: '8px 16px', fontSize: '13px' },
      onclick: function() {
        showEditModal = false;
        editingProject = null;
        editError = null;
        render();
      },
    });
    cancelBtn.textContent = T.cancel;
    actions.appendChild(cancelBtn);

    var saveBtn = el('button', {
      className: 'glass-btn-base glass-btn-primary',
      style: { padding: '8px 16px', fontSize: '13px', opacity: isSaving ? '0.5' : '1' },
      disabled: isSaving,
      onclick: function() {
        if (!editForm.name.trim()) {
          editError = '项目名称不能为空。';
          render();
          return;
        }
        isSaving = true;
        render();
        setTimeout(function() {
          var idx = projects.findIndex(function(p) { return p.id === editingProject.id; });
          if (idx >= 0) {
            projects[idx].name = editForm.name.trim();
            projects[idx].description = editForm.description.trim() || '';
            projects[idx].updatedAt = Date.now();
          }
          isSaving = false;
          showEditModal = false;
          editingProject = null;
          editError = null;
          render();
        }, 600);
      },
    });
    saveBtn.textContent = isSaving ? T.saving : T.save;
    actions.appendChild(saveBtn);
    modal.appendChild(actions);

    overlay.appendChild(modal);
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) {
        showEditModal = false;
        editingProject = null;
        editError = null;
        render();
      }
    });
    return overlay;
  }

  // --- Delete confirm ---
  function renderDeleteConfirm() {
    var overlay = el('div', { className: 'ws-modal-overlay' });
    var modal = el('div', { className: 'glass-surface ws-modal' });
    modal.style.maxWidth = '400px';

    var title = el('h2', { className: 'ws-modal-title', textContent: T.deleteProject });
    modal.appendChild(title);

    var msg = el('p', {
      style: { fontSize: '14px', color: 'var(--glass-text-secondary)', marginBottom: '16px', lineHeight: '1.5' },
      textContent: T.deleteConfirm.replace('{name}', deletingProject ? deletingProject.name : ''),
    });
    modal.appendChild(msg);

    var actions = el('div', { className: 'ws-modal-actions' });
    var cancelBtn = el('button', {
      className: 'glass-btn-base glass-btn-secondary',
      style: { padding: '8px 16px', fontSize: '13px' },
      onclick: function() {
        showDeleteConfirm = false;
        deletingProject = null;
        render();
      },
    });
    cancelBtn.textContent = T.cancel;
    actions.appendChild(cancelBtn);

    var delBtn = el('button', {
      className: 'glass-btn-base',
      style: { padding: '8px 16px', fontSize: '13px', background: 'var(--glass-tone-danger-fg)', color: '#fff' },
      onclick: function() {
        var idx = projects.findIndex(function(p) { return p.id === deletingProject.id; });
        if (idx >= 0) projects.splice(idx, 1);
        showDeleteConfirm = false;
        deletingProject = null;
        render();
      },
    });
    delBtn.textContent = T.delete;
    actions.appendChild(delBtn);
    modal.appendChild(actions);

    overlay.appendChild(modal);
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) {
        showDeleteConfirm = false;
        deletingProject = null;
        render();
      }
    });
    return overlay;
  }

  // --- Helpers ---
  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function formatDate(ts) {
    var d = new Date(ts);
    var Y = d.getFullYear();
    var M = String(d.getMonth() + 1).padStart(2, '0');
    var D = String(d.getDate()).padStart(2, '0');
    var h = String(d.getHours()).padStart(2, '0');
    var m = String(d.getMinutes()).padStart(2, '0');
    return Y + '年' + M + '月' + D + '日 ' + h + ':' + m;
  }

  // --- Main render ---
  function render() {
    main.innerHTML = '';
    main.appendChild(renderHeader());
    main.appendChild(renderGrid());

    var pag = renderPagination();
    if (pag) main.appendChild(pag);

    // Remove old modals
    var oldModals = app.querySelectorAll('.ws-modal-overlay');
    oldModals.forEach(function(m) { m.remove(); });

    // Add current modals
    if (showCreateModal) app.appendChild(renderCreateModal());
    if (showEditModal) app.appendChild(renderEditModal());
    if (showDeleteConfirm) app.appendChild(renderDeleteConfirm());
  }

  // Initial render
  isLoading = false;
  render();
})();
