// ============================================
// Editor Script Page (stage = script / 剧本)
// ============================================

(function() {
  var EC = EditorCommon;
  var page = EC.init('script');
  var contentWrap = page.contentWrap;
  var modalContainer = page.modalContainer;

  var EPISODES = EC.EPISODES;
  var currentEpisode = EPISODES[0];

  // Sample script scenes
  var SCENES = [
    {
      id: 's1',
      title: '场景一 · 清晨的房间',
      location: '小明家卧室',
      characters: ['小明'],
      content: '【场景】清晨，阳光透过窗帘洒进房间。\n\n【动作】小明揉着惺忪的睡眼从床上坐起，看了一眼床头的闹钟——已经八点了！\n\n【动作】他猛地跳下床，手忙脚乱地开始穿衣服。',
      status: 'analyzed',
    },
    {
      id: 's2',
      title: '场景二 · 早餐时光',
      location: '小明家餐厅',
      characters: ['小明', '妈妈'],
      content: '【场景】妈妈在厨房准备早餐，香气弥漫。\n\n【对话】妈妈："小明，快来吃早餐！"\n\n【对话】小明："来了来了！"\n\n【动作】小明抓起书包，冲下楼梯。今天的早餐是妈妈做的鸡蛋面，小明三口两口吃完，便飞奔出门。',
      status: 'analyzed',
    },
    {
      id: 's3',
      title: '场景三 · 上学路上',
      location: '街道',
      characters: ['小明', '神秘老人'],
      content: '【场景】街道上，樱花瓣随风飘落。\n\n【动作】小明走在熟悉的上学路上，脚步轻快。\n\n【动作】突然，一个神秘的老人挡住了他的去路...\n\n【对话】老人："少年，你愿意接受一个考验吗？"\n\n【动作】小明愣在原地，目光被老人手中闪烁的怀表吸引。',
      status: 'analyzed',
    },
    {
      id: 's4',
      title: '场景四 · 命运的怀表',
      location: '街道',
      characters: ['小明', '神秘老人'],
      content: '【动作】老人将怀表递到小明面前，表盘上的指针逆向旋转。\n\n【对话】老人："这是命运之表，拥有改变时间的力量。但每次使用都会付出代价。"\n\n【对话】小明："改变时间？这不是开玩笑吧？"\n\n【动作】小明接过怀表，指尖触碰到冰凉的金属表面，一瞬间周围的时间仿佛静止了。',
      status: 'analyzed',
    },
  ];

  var selectedScene = SCENES[0];
  var isAnalyzing = false;

  renderScriptStage();

  // ============================================
  // SCRIPT STAGE
  // ============================================
  function renderScriptStage() {
    contentWrap.innerHTML = '';
    var view = el('div', { className: 'script-stage' });

    var html = '<div class="script-stage-inner">';

    // Header
    html += '<div class="script-stage-header">' +
      '<div class="script-stage-title">剧本分析</div>' +
      '<div class="script-stage-tip">AI 已将故事拆分为 ' + SCENES.length + ' 个场景，点击左侧场景查看剧本详情</div>' +
    '</div>';

    // Split layout
    html += '<div class="script-layout">';

    // Left: scene list
    html += '<div class="script-sidebar glass-surface app-scrollbar">';
    html += '<div class="script-sidebar-header">' +
      '<span class="script-sidebar-title">场景列表</span>' +
      '<span class="script-sidebar-count">' + SCENES.length + ' 场景</span>' +
    '</div>';
    html += '<div class="script-scene-list">';
    SCENES.forEach(function(scene, i) {
      html += '<div class="script-scene-item' + (selectedScene.id === scene.id ? ' active' : '') + '" data-scene-id="' + scene.id + '">' +
        '<div class="script-scene-num">' + (i + 1) + '</div>' +
        '<div class="script-scene-info">' +
          '<div class="script-scene-name">' + scene.title + '</div>' +
          '<div class="script-scene-meta">' +
            '<span>' + icon('mapPin', 'icon-xs') + ' ' + scene.location + '</span>' +
            '<span>' + scene.characters.length + ' 角色</span>' +
          '</div>' +
        '</div>' +
        '<span class="script-scene-status status-' + scene.status + '">' + icon('check', 'icon-xs') + '</span>' +
      '</div>';
    });
    html += '</div>';
    html += '</div>'; // script-sidebar

    // Right: script content
    html += '<div class="script-main glass-surface">';
    html += '<div class="script-main-header">' +
      '<div>' +
        '<div class="script-main-title">' + selectedScene.title + '</div>' +
        '<div class="script-main-meta">' +
          '<span>' + icon('mapPin', 'icon-sm') + ' ' + selectedScene.location + '</span>' +
          '<span style="margin-left:12px;">' + icon('users', 'icon-sm') + ' ' + selectedScene.characters.join('、') + '</span>' +
        '</div>' +
      '</div>' +
      '<button class="glass-btn-base glass-btn-ghost script-edit-btn" id="edit-scene-btn">' +
        icon('editSquare', 'icon-sm') + '<span>编辑</span>' +
      '</button>' +
    '</div>';

    html += '<div class="script-content app-scrollbar">' +
      selectedScene.content.split('\n').map(function(line) {
        if (line.startsWith('【场景】')) {
          return '<div class="script-line script-line-scene">' + line + '</div>';
        } else if (line.startsWith('【动作】')) {
          return '<div class="script-line script-line-action">' + line + '</div>';
        } else if (line.startsWith('【对话】')) {
          return '<div class="script-line script-line-dialogue">' + line + '</div>';
        } else if (line.trim() === '') {
          return '<div class="script-line script-line-empty"></div>';
        }
        return '<div class="script-line">' + line + '</div>';
      }).join('') +
    '</div>';

    // Characters in scene
    html += '<div class="script-characters">' +
      '<div class="script-char-label">出场角色</div>' +
      '<div class="script-char-list">' +
        selectedScene.characters.map(function(c) {
          return '<span class="script-char-chip">' + icon('user', 'icon-xs') + ' ' + c + '</span>';
        }).join('') +
      '</div>' +
    '</div>';

    html += '</div>'; // script-main

    html += '</div>'; // script-layout

    // Action bar
    html += '<div class="script-action-bar">' +
      '<button class="glass-btn-base glass-btn-ghost" id="reanalyze-btn">' +
        icon('refresh', 'icon-sm') + '<span>AI 重新分析</span>' +
      '</button>' +
      '<button class="glass-btn-base glass-btn-primary" id="to-storyboard-btn">' +
        '<span>生成分镜</span>' + icon('arrowRight', 'icon-sm') +
      '</button>' +
    '</div>';

    html += '</div>'; // script-stage-inner

    view.innerHTML = html;
    contentWrap.appendChild(view);

    // Wire up events
    setTimeout(function() {
      // Scene list clicks
      var items = view.querySelectorAll('.script-scene-item');
      items.forEach(function(item) {
        item.addEventListener('click', function() {
          var sid = item.getAttribute('data-scene-id');
          var found = SCENES.find(function(s) { return s.id === sid; });
          if (found) {
            selectedScene = found;
            renderScriptStage();
          }
        });
      });

      // Edit button
      var editBtn = view.querySelector('#edit-scene-btn');
      if (editBtn) {
        editBtn.addEventListener('click', function() {
          // Toggle content editable
          var content = view.querySelector('.script-content');
          if (content) {
            content.setAttribute('contenteditable', 'true');
            content.focus();
          }
        });
      }

      // Re-analyze button
      var reBtn = view.querySelector('#reanalyze-btn');
      if (reBtn) {
        reBtn.addEventListener('click', function() {
          if (isAnalyzing) return;
          isAnalyzing = true;
          reBtn.innerHTML = '<span class="loading-spinner"></span> <span>分析中...</span>';
          reBtn.disabled = true;
          setTimeout(function() {
            isAnalyzing = false;
            renderScriptStage();
          }, 2000);
        });
      }

      // To storyboard button
      var tbBtn = view.querySelector('#to-storyboard-btn');
      if (tbBtn) {
        tbBtn.addEventListener('click', function() {
          window.location.href = 'editor-storyboard.html';
        });
      }
    }, 0);
  }
})();
