// ============================================
// Editor Page (Stage-based workspace)
// Replicates /zh/workspace/:projectId?episode=:episodeId&stage=config
// ============================================

(function() {
  var app = document.getElementById('app');
  app.innerHTML = '';

  // --- Page state ---
  var STAGES = [
    { id: 'config',     icon: 'S', label: t.stages.story,      status: 'active' },
    { id: 'script',     icon: 'A', label: t.stages.script,     status: 'empty' },
    { id: 'storyboard', icon: 'B', label: t.stages.storyboard, status: 'empty' },
    { id: 'videos',     icon: 'V', label: t.stages.video,      status: 'empty' },
    { id: 'editor',     icon: 'E', label: t.stages.editor,     status: 'empty', disabled: true, disabledLabel: t.stages.editorComingSoon },
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
    { value: 'american-comic',   label: '漫画风',     preview: '漫', recommended: false },
    { value: 'chinese-comic',    label: '精致国漫',   preview: '国', recommended: false },
    { value: 'japanese-anime',   label: '日系动漫风', preview: '日', recommended: false },
    { value: 'realistic',        label: '真人风格',   preview: '实', recommended: true },
  ];

  var STYLE_PRESETS = [
    { value: 'auto', label: '自动' },
    { value: 'manual', label: '手动' },
  ];

  var EPISODES = [
    { id: 'ep1', name: '第一集 \u00b7 命运的怀表' },
    { id: 'ep2', name: '第二集 \u00b7 时空的裂缝' },
    { id: 'ep3', name: '第三集 \u00b7 迷失的世界' },
  ];

  var currentStage = 'config';
  var currentEpisode = EPISODES[0];
  var novelText = '';
  var videoRatio = '9:16';
  var artStyle = 'american-comic';
  var stylePreset = 'auto';
  var enableNarration = false;
  var isSubmitting = false;
  var isTransitioning = false;
  var showAiModal = false;
  var aiInputText = '';

  // --- Background aurora ---
  var bg = el('div', { className: 'editor-aurora-bg' });
  bg.innerHTML =
    '<div class="aurora-blobs">' +
      '<div class="aurora-blob blob-1"></div>' +
      '<div class="aurora-blob blob-2"></div>' +
      '<div class="aurora-blob blob-3"></div>' +
    '</div>' +
    '<div class="aurora-overlay"></div>';
  app.appendChild(bg);

  // --- Top nav ---
  var miniNav = renderTopNav('workspace');
  app.appendChild(miniNav);

  // --- Stage nav bar ---
  var stageNav = el('div', { className: 'stage-nav-bar' });

  // Left: back + episode selector
  var navLeft = el('div', { className: 'stage-nav-left' });

  var backBtn = el('a', { className: 'stage-back-btn', href: 'workspace.html' });
  backBtn.innerHTML = icon('back');
  navLeft.appendChild(backBtn);

  var epWrap = el('div', { className: 'episode-selector-wrap' });
  epWrap.innerHTML =
    '<select class="episode-selector" id="episode-select">' +
      EPISODES.map(function(ep) { return '<option value="' + ep.id + '">' + ep.name + '</option>'; }).join('') +
    '</select>';
  navLeft.appendChild(epWrap);

  // Center: stage tabs pill
  var stageTabs = el('div', { className: 'stage-tabs-pill' });
  STAGES.forEach(function(s) {
    var tab = el('div', {
      className: 'stage-tab' + (currentStage === s.id ? ' active' : '') + (s.disabled ? ' disabled' : '') + (s.status === 'ready' ? ' ready' : ''),
      onclick: function() {
        if (s.disabled) return;
        currentStage = s.id;
        rerender();
      },
    });
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

  var settingsBtn = el('button', { className: 'stage-toolbar-btn icon-only', onclick: function() { showSettingsModal(); } });
  settingsBtn.innerHTML = icon('settings', 'icon-sm');
  navRight.appendChild(settingsBtn);

  stageNav.appendChild(navLeft);
  stageNav.appendChild(stageTabs);
  stageNav.appendChild(navRight);
  app.appendChild(stageNav);

  // --- Content container ---
  var contentWrap = el('div', { className: 'editor-content-wrap app-scrollbar', id: 'editor-content' });
  app.appendChild(contentWrap);

  // --- AI Write Modal container ---
  var modalContainer = el('div', { id: 'modal-container' });
  app.appendChild(modalContainer);

  function rerender() {
    contentWrap.innerHTML = '';
    switch (currentStage) {
      case 'config': contentWrap.appendChild(renderConfigStage()); break;
      case 'script': contentWrap.appendChild(renderScriptStage()); break;
      case 'storyboard': contentWrap.appendChild(renderStoryboardStage()); break;
      case 'videos': contentWrap.appendChild(renderVideosStage()); break;
      case 'editor': contentWrap.appendChild(renderEditorStage()); break;
    }
  }

  rerender();

  // Episode selector change
  setTimeout(function() {
    var sel = document.getElementById('episode-select');
    if (sel) {
      sel.addEventListener('change', function() {
        var found = EPISODES.find(function(ep) { return ep.id === sel.value; });
        if (found) currentEpisode = found;
      });
    }
  }, 0);

  // ============================================
  // CONFIG STAGE (stage=config)
  // ============================================
  function renderConfigStage() {
    var view = el('div', { className: 'config-stage' });

    var html = '<div class="config-stage-inner">';

    // Episode name display
    html += '<div class="config-episode-header">' +
      '<div class="config-episode-name">' +
        t.storyInput.currentEditing.replace('{name}', currentEpisode.name) +
      '</div>' +
      '<div class="config-episode-tip">' + t.storyInput.editingTip + '</div>' +
    '</div>';

    // Main input card
    html += '<div class="config-input-card glass-surface">' +
      '<div class="config-input-card-inner">';

    // Textarea
    html += '<textarea class="config-textarea" id="novel-text" placeholder="' +
      '请输入您的剧本或小说内容...\n\nAI 将根据您的文本智能分析：\n\u2022 自动识别场景切换\n\u2022 提取角色对话和动作\n\u2022 生成分镜脚本\n\n例如：\n清晨，阳光透过窗帘洒进房间。小明揉着惺忪的睡眼从床上坐起，看了一眼床头的闹钟——已经八点了！他猛地跳下床，手忙脚乱地开始穿衣服...' +
    '">' + escapeHtml(novelText) + '</textarea>';

    // Options bar
    html += '<div class="config-options-bar">';

    // Ratio selector
    html += '<div class="config-option-group">' +
      '<label class="config-option-label">' + t.storyInput.videoRatio + '</label>' +
      '<select class="config-option-select" id="ratio-select">' +
        RATIO_OPTIONS.map(function(r) {
          return '<option value="' + r.value + '"' + (videoRatio === r.value ? ' selected' : '') + '>' +
            r.label + (r.recommended ? ' (推荐)' : '') +
          '</option>';
        }).join('') +
      '</select>';
    var ratioTag = t.storyInput.ratioUsageTag[videoRatio.replace(/:/g, '_')] || '';
    if (ratioTag) {
      html += '<span class="config-option-tag">' + ratioTag + '</span>';
    }
    html += '</div>';

    // Art style selector
    html += '<div class="config-option-group">' +
      '<label class="config-option-label">' + t.storyInput.visualStyle + '</label>' +
      '<select class="config-option-select" id="style-select">' +
        STYLE_OPTIONS.map(function(s) {
          return '<option value="' + s.value + '"' + (artStyle === s.value ? ' selected' : '') + '>' +
            s.label + (s.recommended ? ' (推荐)' : '') +
          '</option>';
        }).join('') +
      '</select>';
    html += '</div>';

    // Word count
    var wc = countWords(novelText);
    html += '<span class="config-word-count">' + t.storyInput.wordCount + wc + '</span>';

    html += '</div>'; // config-options-bar

    // Actions
    var canSubmit = novelText.trim().length > 0 && !isSubmitting && !isTransitioning;
    html += '<div class="config-actions">' +
      '<button class="glass-btn-base glass-btn-primary config-start-btn" id="start-create-btn"' + (!canSubmit ? ' disabled' : '') + '>' +
        (isTransitioning ?
          '<span class="loading-spinner"></span> ' + t.storyInput.creating :
          '<span>' + t.smartImport.manualCreate.button + '</span>' + icon('arrowRight', 'icon-sm')) +
      '</button>' +
      '<button class="config-ai-btn" id="ai-write-btn"' + (isSubmitting ? ' disabled' : '') + '>' +
        icon('sparkles', 'icon-sm') +
        '<span class="ai-write-text">' + t.aiWrite.trigger + '</span>' +
      '</button>' +
    '</div>';

    html += '</div>'; // config-input-card-inner
    html += '</div>'; // config-input-card

    // Asset library tip
    html += '<div class="glass-surface config-tip-card">' +
      '<div class="config-tip-inner">' +
        '<div class="config-tip-icon">' + icon('folderCards', 'icon-lg') + '</div>' +
        '<div class="config-tip-content">' +
          '<div class="config-tip-title">' + t.storyInput.assetLibraryTip.title + '</div>' +
          '<p class="config-tip-desc">' + t.storyInput.assetLibraryTip.description + '</p>' +
        '</div>' +
      '</div>' +
    '</div>';

    // Narration toggle
    html += '<div class="glass-surface config-narration-card">' +
      '<div class="config-narration-inner">' +
        '<div class="config-narration-left">' +
          '<span class="config-narration-badge">VO</span>' +
          '<div>' +
            '<div class="config-narration-title">' + t.storyInput.narration.title + '</div>' +
            '<div class="config-narration-desc">' + t.storyInput.narration.description + '</div>' +
          '</div>' +
        '</div>' +
        '<button class="config-toggle ' + (enableNarration ? 'on' : '') + '" id="narration-toggle">' +
          '<span class="config-toggle-thumb"></span>' +
        '</button>' +
      '</div>' +
    '</div>';

    html += '</div>'; // config-stage-inner

    view.innerHTML = html;

    // Wire up events
    setTimeout(function() {
      // Textarea
      var ta = view.querySelector('#novel-text');
      if (ta) {
        ta.addEventListener('input', function() {
          novelText = ta.value;
          var wcEl = view.querySelector('.config-word-count');
          if (wcEl) wcEl.textContent = t.storyInput.wordCount + countWords(novelText);
          var btn = view.querySelector('#start-create-btn');
          if (btn) {
            var can = novelText.trim().length > 0 && !isSubmitting && !isTransitioning;
            btn.disabled = !can;
          }
        });
      }

      // Ratio select
      var rs = view.querySelector('#ratio-select');
      if (rs) {
        rs.addEventListener('change', function() {
          videoRatio = rs.value;
          rerender();
        });
      }

      // Style select
      var ss = view.querySelector('#style-select');
      if (ss) {
        ss.addEventListener('change', function() {
          artStyle = ss.value;
        });
      }

      // Start button
      var sb = view.querySelector('#start-create-btn');
      if (sb) {
        sb.addEventListener('click', function() {
          if (novelText.trim().length > 1000) {
            showLongTextModal();
          } else {
            isTransitioning = true;
            rerender();
            setTimeout(function() {
              isTransitioning = false;
              currentStage = 'script';
              STAGES[0].status = 'ready';
              STAGES[1].status = 'active';
              rerender();
            }, 2000);
          }
        });
      }

      // AI write button
      var ab = view.querySelector('#ai-write-btn');
      if (ab) {
        ab.addEventListener('click', function() {
          showAiModal = true;
          renderAiModal();
        });
      }

      // Narration toggle
      var nt = view.querySelector('#narration-toggle');
      if (nt) {
        nt.addEventListener('click', function() {
          enableNarration = !enableNarration;
          nt.classList.toggle('on');
        });
      }
    }, 0);

    return view;
  }

  // ============================================
  // AI Write Modal
  // ============================================
  function renderAiModal() {
    modalContainer.innerHTML = '';
    if (!showAiModal) return;

    var overlay = el('div', { className: 'modal-overlay glass-overlay', onclick: function(e) { if (e.target === overlay) { showAiModal = false; renderAiModal(); } } });
    var container = el('div', { className: 'modal-container glass-surface-modal' });
    container.style.maxWidth = '520px';

    container.innerHTML =
      '<div class="modal-header">' +
        '<div>' +
          '<div class="modal-title">' + t.aiWrite.modalTitle + '</div>' +
          '<div class="modal-subtitle">' + t.aiWrite.modalSubtitle + '</div>' +
        '</div>' +
        '<button class="modal-close" id="ai-modal-close">' + icon('x', 'icon-sm') + '</button>' +
      '</div>' +
      '<div class="modal-body">' +
        '<div class="modal-label">' + t.aiWrite.inputLabel + '</div>' +
        '<textarea class="glass-textarea-base" id="ai-input" style="min-height:100px;" placeholder="' + t.aiWrite.placeholder.replace(/"/g, '&quot;') + '">' + escapeHtml(aiInputText) + '</textarea>' +
        '<div class="modal-hint">' + t.aiWrite.hint + '</div>' +
      '</div>' +
      '<div class="modal-footer">' +
        '<button class="glass-btn-base glass-btn-ghost" id="ai-cancel">' + t.aiWrite.cancel + '</button>' +
        '<button class="glass-btn-base glass-btn-primary" id="ai-start"' + (isSubmitting ? ' disabled' : '') + '>' +
          (isSubmitting ? '<span class="loading-spinner"></span> ' : '') + t.aiWrite.startAiWrite +
        '</button>' +
      '</div>';

    overlay.appendChild(container);
    modalContainer.appendChild(overlay);

    setTimeout(function() {
      var closeBtn = container.querySelector('#ai-modal-close');
      if (closeBtn) closeBtn.addEventListener('click', function() { showAiModal = false; renderAiModal(); });

      var cancelBtn = container.querySelector('#ai-cancel');
      if (cancelBtn) cancelBtn.addEventListener('click', function() { showAiModal = false; renderAiModal(); });

      var inp = container.querySelector('#ai-input');
      if (inp) inp.addEventListener('input', function() { aiInputText = inp.value; });

      var startBtn = container.querySelector('#ai-start');
      if (startBtn) startBtn.addEventListener('click', function() {
        if (!aiInputText.trim()) return;
        isSubmitting = true;
        startBtn.disabled = true;
        startBtn.innerHTML = '<span class="loading-spinner"></span> ' + t.aiWrite.startAiWrite;
        setTimeout(function() {
          novelText = '清晨，阳光透过窗帘洒进房间。小明揉着惺忪的睡眼从床上坐起，看了一眼床头的闹钟——已经八点了！他猛地跳下床，手忙脚乱地开始穿衣服。\n\n"小明，快来吃早餐！"妈妈在楼下喊道。\n\n"来了来了！"小明抓起书包，冲下楼梯。今天的早餐是妈妈做的鸡蛋面，小明三口两口吃完，便飞奔出门。\n\n街道上，樱花瓣随风飘落。小明走在熟悉的上学路上，突然，一个神秘的老人挡住了他的去路...';
          isSubmitting = false;
          showAiModal = false;
          renderAiModal();
          rerender();
        }, 2500);
      });
    }, 0);
  }

  // ============================================
  // Long Text Detection Modal
  // ============================================
  function showLongTextModal() {
    modalContainer.innerHTML = '';
    var overlay = el('div', { className: 'modal-overlay glass-overlay', onclick: function(e) { if (e.target === overlay) { modalContainer.innerHTML = ''; } } });
    var container = el('div', { className: 'modal-container glass-surface-modal' });
    container.style.maxWidth = '480px';

    var count = countWords(novelText).toLocaleString();

    container.innerHTML =
      '<div class="modal-header">' +
        '<div class="modal-title">' + t.storyInput.longTextDetection.title + '</div>' +
      '</div>' +
      '<div class="modal-body">' +
        '<p style="font-size:14px;color:var(--glass-text-secondary);line-height:1.6;margin-bottom:12px;">' +
          t.storyInput.longTextDetection.description.replace('{count}', count) +
        '</p>' +
        '<div style="padding:12px 14px;border-radius:12px;background:var(--glass-tone-info-bg);border:1px solid var(--glass-tone-info-border);margin-bottom:16px;">' +
          '<p style="font-size:13px;color:var(--glass-tone-info-fg);line-height:1.6;">' +
            t.storyInput.longTextDetection.strongRecommend +
          '</p>' +
        '</div>' +
      '</div>' +
      '<div class="modal-footer" style="flex-direction:column;gap:8px;align-items:stretch;">' +
        '<button class="glass-btn-base glass-btn-primary w-full" id="smart-split-btn" style="justify-content:center;padding:12px;">' +
          t.storyInput.longTextDetection.smartSplit +
          ' <span class="glass-chip glass-chip-success" style="margin-left:6px;font-size:10px;">' + t.storyInput.longTextDetection.smartSplitRecommend + '</span>' +
        '</button>' +
        '<button class="glass-btn-base glass-btn-ghost w-full" id="continue-btn" style="justify-content:center;padding:10px;">' +
          t.storyInput.longTextDetection.continueAnyway +
          ' <span style="font-size:11px;opacity:.6;margin-left:4px;">- ' + t.storyInput.longTextDetection.singleEpisodeWarning + '</span>' +
        '</button>' +
      '</div>';

    overlay.appendChild(container);
    modalContainer.appendChild(overlay);

    setTimeout(function() {
      var ssBtn = container.querySelector('#smart-split-btn');
      if (ssBtn) ssBtn.addEventListener('click', function() {
        modalContainer.innerHTML = '';
        isTransitioning = true;
        rerender();
        setTimeout(function() {
          isTransitioning = false;
          currentStage = 'script';
          STAGES[0].status = 'ready';
          STAGES[1].status = 'active';
          rerender();
        }, 2000);
      });

      var cBtn = container.querySelector('#continue-btn');
      if (cBtn) cBtn.addEventListener('click', function() {
        modalContainer.innerHTML = '';
        isTransitioning = true;
        rerender();
        setTimeout(function() {
          isTransitioning = false;
          currentStage = 'script';
          STAGES[0].status = 'ready';
          STAGES[1].status = 'active';
          rerender();
        }, 2000);
      });
    }, 0);
  }

  // ============================================
  // SCRIPT STAGE (placeholder)
  // ============================================
  function renderScriptStage() {
    var view = el('div', { className: 'config-stage' });
    view.innerHTML = '<div class="config-stage-inner">' +
      '<div class="config-episode-header">' +
        '<div class="config-episode-name">剧本分析</div>' +
        '<div class="config-episode-tip">AI 正在分析剧本内容，提取角色、场景和分镜...</div>' +
      '</div>' +
      '<div class="glass-surface" style="padding:48px;text-align:center;">' +
        '<div class="loading-spinner" style="width:32px;height:32px;margin:0 auto 16px;"></div>' +
        '<div style="font-size:14px;color:var(--glass-text-tertiary);">正在分析剧本...</div>' +
      '</div>' +
    '</div>';
    return view;
  }

  // ============================================
  // STORYBOARD STAGE (placeholder)
  // ============================================
  function renderStoryboardStage() {
    var view = el('div', { className: 'config-stage' });
    view.innerHTML = '<div class="config-stage-inner">' +
      '<div class="config-episode-header">' +
        '<div class="config-episode-name">分镜编辑</div>' +
        '<div class="config-episode-tip">管理分镜面板、镜头描述和画面设置</div>' +
      '</div>' +
      '<div class="glass-surface" style="padding:48px;text-align:center;">' +
        '<div style="width:64px;height:64px;background:var(--glass-bg-muted);border-radius:16px;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;">' +
          icon('layers', 'icon-xl text-tertiary') +
        '</div>' +
        '<div style="font-size:14px;color:var(--glass-text-tertiary);">请先完成剧本分析阶段</div>' +
      '</div>' +
    '</div>';
    return view;
  }

  // ============================================
  // VIDEOS STAGE (placeholder)
  // ============================================
  function renderVideosStage() {
    var view = el('div', { className: 'config-stage' });
    view.innerHTML = '<div class="config-stage-inner">' +
      '<div class="config-episode-header">' +
        '<div class="config-episode-name">视频生成</div>' +
        '<div class="config-episode-tip">为每个分镜生成视频片段</div>' +
      '</div>' +
      '<div class="glass-surface" style="padding:48px;text-align:center;">' +
        '<div style="width:64px;height:64px;background:var(--glass-bg-muted);border-radius:16px;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;">' +
          icon('video', 'icon-xl text-tertiary') +
        '</div>' +
        '<div style="font-size:14px;color:var(--glass-text-tertiary);">请先完成分镜编辑阶段</div>' +
      '</div>' +
    '</div>';
    return view;
  }

  // ============================================
  // EDITOR STAGE (placeholder)
  // ============================================
  function renderEditorStage() {
    var view = el('div', { className: 'config-stage' });
    view.innerHTML = '<div class="config-stage-inner">' +
      '<div class="glass-surface" style="padding:80px 20px;text-align:center;">' +
        '<div style="width:64px;height:64px;background:var(--glass-bg-muted);border-radius:16px;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;">' +
          icon('scissors', 'icon-xl text-tertiary') +
        '</div>' +
        '<div style="font-size:18px;font-weight:700;margin-bottom:8px;">' + t.stages.editor + '</div>' +
        '<p style="font-size:14px;color:var(--glass-text-tertiary);">' + t.stages.editorComingSoon + '</p>' +
      '</div>' +
    '</div>';
    return view;
  }

  // ============================================
  // Settings Modal
  // ============================================
  function showSettingsModal() {
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

  // ============================================
  // Helpers
  // ============================================
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
})();
