// ============================================
// Editor Storyboard Page (stage = storyboard / 分镜)
// ============================================

(function() {
  var EC = EditorCommon;
  var page = EC.init('storyboard');
  var contentWrap = page.contentWrap;
  var modalContainer = page.modalContainer;

  var EPISODES = EC.EPISODES;
  var currentEpisode = EPISODES[0];

  // Sample storyboard shots
  var SHOTS = [
    {
      id: 'shot1',
      scene: '场景一',
      title: '阳光洒进房间',
      prompt: '清晨，阳光透过薄纱窗帘洒进卧室，金色光线中浮尘飘舞。床上被子凌乱，闹钟指向8:00。',
      duration: '3s',
      ratio: '9:16',
      status: 'generated',
    },
    {
      id: 'shot2',
      scene: '场景一',
      title: '小明惊醒',
      prompt: '少年从床上猛然坐起，头发凌乱，表情惊讶。特写镜头，聚焦面部表情和闹钟。',
      duration: '2s',
      ratio: '9:16',
      status: 'generated',
    },
    {
      id: 'shot3',
      scene: '场景一',
      title: '手忙脚乱穿衣',
      prompt: '小明快速穿衣服，动作慌张，衬衫扣子扣错。中景，暖色调，漫画风格。',
      duration: '4s',
      ratio: '9:16',
      status: 'generated',
    },
    {
      id: 'shot4',
      scene: '场景二',
      title: '妈妈做早餐',
      prompt: '厨房中，妈妈背对镜头煎鸡蛋，热气升腾，阳光从窗户照入。温馨氛围。',
      duration: '3s',
      ratio: '9:16',
      status: 'pending',
    },
    {
      id: 'shot5',
      scene: '场景二',
      title: '小明冲下楼',
      prompt: '小明背着书包从楼梯飞奔而下，表情着急。动态构图，速度线效果。',
      duration: '2s',
      ratio: '9:16',
      status: 'pending',
    },
    {
      id: 'shot6',
      scene: '场景三',
      title: '樱花飘落的街道',
      prompt: '街道远景，樱花瓣随风飘落，阳光透过树叶形成斑驳光影。少年从画面左侧走入。',
      duration: '4s',
      ratio: '9:16',
      status: 'pending',
    },
    {
      id: 'shot7',
      scene: '场景三',
      title: '神秘老人现身',
      prompt: '一位白发老人突然出现在小明面前，身着深色长袍，手持怀表。逆光剪影效果，神秘氛围。',
      duration: '3s',
      ratio: '9:16',
      status: 'pending',
    },
    {
      id: 'shot8',
      scene: '场景四',
      title: '命运怀表特写',
      prompt: '怀表特写，表盘指针逆时针旋转，发出幽蓝色光芒。背景虚化，光影梦幻。',
      duration: '2s',
      ratio: '9:16',
      status: 'pending',
    },
  ];

  var selectedShot = null;

  renderStoryboardStage();

  // ============================================
  // STORYBOARD STAGE
  // ============================================
  function renderStoryboardStage() {
    contentWrap.innerHTML = '';
    var view = el('div', { className: 'storyboard-stage' });

    var html = '<div class="storyboard-stage-inner">';

    // Header
    var generatedCount = SHOTS.filter(function(s) { return s.status === 'generated'; }).length;
    html += '<div class="storyboard-stage-header">' +
      '<div class="storyboard-stage-title">分镜编辑</div>' +
      '<div class="storyboard-stage-tip">共 ' + SHOTS.length + ' 个镜头，已生成 ' + generatedCount + ' 个画面</div>' +
    '</div>';

    // Stats bar
    html += '<div class="storyboard-stats-bar glass-surface">' +
      '<div class="storyboard-stat">' +
        '<div class="storyboard-stat-num">' + SHOTS.length + '</div>' +
        '<div class="storyboard-stat-label">总镜头</div>' +
      '</div>' +
      '<div class="storyboard-stat">' +
        '<div class="storyboard-stat-num" style="color:var(--glass-tone-success-fg);">' + generatedCount + '</div>' +
        '<div class="storyboard-stat-label">已生成</div>' +
      '</div>' +
      '<div class="storyboard-stat">' +
        '<div class="storyboard-stat-num" style="color:var(--glass-text-tertiary);">' + (SHOTS.length - generatedCount) + '</div>' +
        '<div class="storyboard-stat-label">待生成</div>' +
      '</div>' +
      '<div class="storyboard-stat">' +
        '<div class="storyboard-stat-num">' + SHOTS.reduce(function(a, s) { return a + parseFloat(s.duration); }, 0).toFixed(0) + 's</div>' +
        '<div class="storyboard-stat-label">总时长</div>' +
      '</div>' +
    '</div>';

    // Storyboard grid
    html += '<div class="storyboard-grid">';
    SHOTS.forEach(function(shot, i) {
      html += '<div class="storyboard-card glass-surface" data-shot-id="' + shot.id + '">' +
        '<div class="storyboard-card-header">' +
          '<span class="storyboard-shot-num">#' + String(i + 1).padStart(2, '0') + '</span>' +
          '<span class="storyboard-shot-scene">' + shot.scene + '</span>' +
          '<span class="storyboard-shot-status status-' + shot.status + '">' +
            (shot.status === 'generated' ? icon('check', 'icon-xs') + ' 已生成' : icon('clock', 'icon-xs') + ' 待生成') +
          '</span>' +
        '</div>' +
        '<div class="storyboard-card-thumb' + (shot.status === 'generated' ? '' : ' placeholder') + '">' +
          (shot.status === 'generated'
            ? '<div class="storyboard-thumb-generated">' + icon('image', 'icon-lg') + '</div>'
            : '<div class="storyboard-thumb-placeholder">' + icon('image', 'icon-lg') + '</div>') +
          '<div class="storyboard-thumb-overlay">' +
            '<span class="storyboard-duration">' + icon('clock', 'icon-xs') + ' ' + shot.duration + '</span>' +
            '<span class="storyboard-ratio">' + shot.ratio + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="storyboard-card-body">' +
          '<div class="storyboard-card-title">' + shot.title + '</div>' +
          '<p class="storyboard-card-prompt">' + shot.prompt + '</p>' +
        '</div>' +
        '<div class="storyboard-card-actions">' +
          '<button class="storyboard-card-btn"' + (shot.status === 'generated' ? '' : ' disabled') + '>' +
            icon('refresh', 'icon-xs') + ' 重新生成' +
          '</button>' +
          '<button class="storyboard-card-btn">' +
            icon('editSquare', 'icon-xs') + ' 编辑' +
          '</button>' +
        '</div>' +
      '</div>';
    });
    html += '</div>';

    // Action bar
    html += '<div class="storyboard-action-bar">' +
      '<a class="glass-btn-base glass-btn-ghost" href="editor-script.html">' +
        icon('back', 'icon-sm') + '<span>返回剧本</span>' +
      '</a>' +
      '<button class="glass-btn-base glass-btn-primary" id="gen-all-btn">' +
        icon('sparkles', 'icon-sm') + '<span>批量生成画面</span>' +
      '</button>' +
    '</div>';

    html += '</div>'; // storyboard-stage-inner

    view.innerHTML = html;
    contentWrap.appendChild(view);

    // Wire up events
    setTimeout(function() {
      // Card click
      var cards = view.querySelectorAll('.storyboard-card');
      cards.forEach(function(card) {
        card.addEventListener('click', function(e) {
          if (e.target.closest('.storyboard-card-btn')) return;
          var sid = card.getAttribute('data-shot-id');
          var found = SHOTS.find(function(s) { return s.id === sid; });
          if (found) {
            selectedShot = found;
            card.classList.toggle('expanded');
          }
        });
      });

      // Generate all button
      var gaBtn = view.querySelector('#gen-all-btn');
      if (gaBtn) {
        gaBtn.addEventListener('click', function() {
          gaBtn.innerHTML = '<span class="loading-spinner"></span> <span>生成中...</span>';
          gaBtn.disabled = true;
          setTimeout(function() {
            SHOTS.forEach(function(s) { s.status = 'generated'; });
            renderStoryboardStage();
          }, 2500);
        });
      }
    }, 0);
  }
})();
