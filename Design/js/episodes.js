// ============================================
// Episodes Page — Episode list for a project
// ============================================

(function() {
  var app = document.getElementById('app');
  app.innerHTML = '';

  // --- Options (project-level config; mirror of editor-common.js) ---
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

  // --- State ---
  var projectName = state.projects[0] ? state.projects[0].name : '校园青春物语';
  var activeTab = 'story'; // 'story' | 'script' | 'assets' | 'videos'

  // Project-wide config (applies to all episodes in this project)
  var projectConfig = {
    videoRatio: '9:16',
    artStyle: 'american-comic',
  };

  var episodes = [
    {
      id: 'ep1',
      num: 1,
      name: '旧物与新痕',
      status: 'storyboard',
      statusLabel: '分镜已生成',
      wordCount: 1280,
      sceneCount: 3,
      shotCount: 8,
      updatedAt: Date.now() - 3600000 * 2,
    },
    {
      id: 'ep2',
      num: 2,
      name: '重逢与暗刺',
      status: 'script',
      statusLabel: '剧本已分析',
      wordCount: 2150,
      sceneCount: 4,
      shotCount: 0,
      updatedAt: Date.now() - 86400000,
    },
    {
      id: 'ep3',
      num: 3,
      name: '碎片与拼图',
      status: 'config',
      statusLabel: '故事已输入',
      wordCount: 980,
      sceneCount: 0,
      shotCount: 0,
      updatedAt: Date.now() - 86400000 * 3,
    },
    {
      id: 'ep4',
      num: 4,
      name: '迟到和解',
      status: 'draft',
      statusLabel: '草稿',
      wordCount: 0,
      sceneCount: 0,
      shotCount: 0,
      updatedAt: Date.now() - 86400000 * 5,
    },
  ];

  var searchQuery = '';
  var modalOpen = false;
  var editingEpisode = null;
  var deleteTarget = null;
  var savedToastTimer = null;

  // --- Script outline data (mock, per-episode) ---
  var selectedEpisode = episodes[0];
  var enableNarration = false;
  var isSubmitting = false;

  // Accordion state for story tab script outline
  var outlineAccordionState = {
    summaryExpanded: true,
    episodesExpanded: true,
    expandedEps: {}
  };

  var outlineData = {
    ep1: {
      synopsis: '高中生林晓在祖宅阁楼发现一块神秘怀表，转动指针后竟回到十年前。她试图改变父母离婚的命运，却发现每一次修改历史都会引发意想不到的蝴蝶效应。在同桌苏然的帮助下，她逐渐学会接受不完美，最终选择用另一种方式守护家人。',
      storySynopsis: '2024年，南方县城一所90年代老中学即将整体改造，小学老师林微回母校整理旧物，在自己当年的书桌里发现被撕碎又粘好的纸条和一封未寄出的信，由此重新打开十七年前那场让她记恨至今的"告密事件"。她表面理性克制，实则多年来一直把"被背叛"当作情感防火墙，不敢相信亲密关系。负责母校改造的建筑设计师陈屹恰好是当年的当事人，两人重逢后表面客气、暗里带刺。随着旧广播录音、同学证词和老师的回避逐渐拼出真相，林微发现当年陈屹并非为了自保交出纸条，而是为了把更大的危机压在学生层面，替她和她父亲挡下更严重的后果。时间压力、集体沉默和她自身的回避不断制造阻碍，直到她终于在旧同学聚会上主动替陈屹澄清当年的事，完成与过去、与自己、与陈屹的迟到和解。旧教室被拆除，但那段被误解的青春终于被重新命名。',
      characterProfiles: [
        {
          name: '张曼', role: '配角', color: '#f9a8d4',
          visualImage: '女，38岁，县城文具店老板娘，嘴碎、热心、带着生活气，一看就是会传播消息也会被情绪裹挟的人',
          coreTags: ['嘴碎热心', '集体沉默', '愧疚型配角'],
          background: '林微当年的同桌，如今在县城经营文具店，是旧流言的传播者之一，也是最容易被集体情绪推着走的人。她知道部分真相，却一直不敢说。',
          growth: '十七岁时，她既是林微的同桌，也是流言扩散链中的一环。她并非纯恶，而是害怕得罪老师、害怕承认自己参与过伤害，所以选择沉默。多年后面对林微的追问，她的愧疚和自保不断拉扯。',
          personality: '外向、感性、软弱但不坏，她不是主动作恶的人，却代表了那个时代里最常见的"不敢说"。',
          relationships: '与林微是旧同桌，关系从旧日亲近到成年后的试探疏离；在林微追查真相时，她从回避到被迫说出部分事实，推动真相拼图进一步完整。她的存在让误会不再只是两个人的事，而是一个集体沉默的缩影。',
        },
        {
          name: '王老师', role: '配角', color: '#c4b5fd',
          visualImage: '女，62岁，退休班主任，仍住在学校家属院，气质严厉、体面，带着那个年代老师特有的权威感',
          coreTags: ['权威秩序', '"为你好"式伤害', '时代性错误'],
          background: '当年的班主任，信奉纪律高于情绪，相信牺牲一个学生的名声可以保住更大的秩序。她不是纯反派，而是那个时代"为你好"式权威的代表。',
          growth: '当年她知道陈屹是在替林微挡事，却默认他背锅，因为在她的价值体系里，男生更该承担，纪律和秩序比个人情绪更重要。多年后她仍坚持自己是在"止损"，直到林微当面追问，她才被迫承认自己的错误逻辑。',
          personality: '强势、理性、固执，她并非恶意害人，而是把错误的秩序当成正确的选择；她的冷酷来自制度，而非纯粹的恶。',
          relationships: '与林微是旧日师生，关系从学生对老师的恐惧与怨恨，到成年后带着情绪的对峙；与陈屹则是"被牺牲的学生"与"默认牺牲的老师"之间的沉默关系。她的存在让真相更复杂：不是简单的恶人作恶，而是错误秩序如何压垮年轻人。',
        },
      ],
      characters: [
        { name: '林微', role: '女主角', desc: '38岁，县城小学老师，表面理性克制，实则用"被背叛"筑起情感防火墙', color: '#f472b6' },
        { name: '陈屹', role: '男主角', desc: '建筑设计师，负责母校改造，当年的当事人', color: '#60a5fa' },
        { name: '张曼', role: '配角', desc: '38岁，文具店老板娘，林微旧同桌，嘴碎热心', color: '#f9a8d4' },
        { name: '王老师', role: '配角', desc: '62岁，退休班主任，严厉权威', color: '#c4b5fd' },
      ],
      scenes: [
        {
          num: '1-1', location: '旧教室', time: '日 内', chars: ['林微'],
          duration: '约 3 分钟',
          desc: '2024年，南方县城老中学即将拆除。林微回母校整理旧物，在书桌抽屉铁盒中发现被粘好的碎纸条和泛黄信封，闪回十七年前王老师将撕碎纸条砸在她脸上的屈辱场景。林微决心不再逃避，要查清当年的真相。',
          scriptLines: [
            { type: 'subtitle', text: '2024年，南方县城老中学，即将拆除' },
            { type: 'action', text: '阳光透过布满灰尘的窗户，墙上一个刺眼的红色"拆"字随风晃动。' },
            { type: 'subtitle', text: '林微，38岁，县城小学老师' },
            { type: 'action', text: '林微穿着素雅的衬衫，正蹲在地上整理旧物。手机免提里传出同事的声音。' },
            { type: 'dialogue', who: '同事（vo）', text: '微姐，那男的条件真不错，你就去见一面呗？你总不能一辈子单着啊。' },
            { type: 'dialogue', who: '林微', direction: '语气温和却不容置疑', text: '我习惯一个人了，这样挺好，不麻烦别人，也不指望谁。' },
            { type: 'action', text: '林微挂断电话，熟练地竖起一道无形的情感防火墙。' },
            { type: 'action', text: '她起身拉开发霉的书桌抽屉，摸到一个生锈的铁盒。' },
            { type: 'action', text: '打开铁盒，里面静静地躺着一张用透明胶带仔细粘好的碎纸条，旁边还有一个泛黄的空白信封。' },
            { type: 'action', text: '林微瞳孔骤缩，呼吸瞬间停滞。' },
            { type: 'flashback', text: '闪回' },
            { type: 'action', text: '十七年前的教室，班主任王老师将一沓撕碎的纸条狠狠砸在林微脸上。' },
            { type: 'dialogue', who: '王老师', direction: '严厉', text: '小小年纪写这种下流东西！谁干的站出来！' },
            { type: 'action', text: '周围同学指指点点，林微满脸通红，屈辱地低下头。' },
            { type: 'flashback_end', text: '闪回结束' },
            { type: 'action', text: '林微紧紧攥住那个信封，指关节泛白。她没有逃避，眼神反而变得异常坚定。' },
            { type: 'dialogue', who: '林微（os）', text: '教室拆了，这过去也不能是一笔糊涂账。' },
          ]
        },
        {
          num: '1-2', location: '校园操场', time: '日 外', chars: ['林微', '陈屹'],
          duration: '约 2 分钟',
          desc: '林微在操场遇到负责改造项目的建筑设计师陈屹，两人竟是旧识。表面客气寒暄，暗里带刺，旧日恩怨隐约浮现。',
          scriptLines: [
            { type: 'action', text: '林微抱着旧物走出教学楼，差点撞上一个正在看图纸的男人。' },
            { type: 'dialogue', who: '陈屹', text: '小心——' },
            { type: 'action', text: '两人对视，空气瞬间凝固。陈屹认出了林微，表情复杂。' },
            { type: 'dialogue', who: '林微', direction: '语气淡淡的', text: '是你。负责拆这所学校的设计师。' },
            { type: 'dialogue', who: '陈屹', direction: '克制', text: '好久不见，林老师。' },
            { type: 'action', text: '林微没接话，目光扫过他手中的改造图纸，嘴角微微一沉。' },
            { type: 'dialogue', who: '林微', text: '图纸画得不错。希望拆得也干净。' },
            { type: 'action', text: '她径直走过，陈屹望着她的背影，欲言又止。' },
          ]
        },
        {
          num: '1-3', location: '旧广播室', time: '日 内', chars: ['林微'],
          duration: '约 2 分钟',
          desc: '林微在废弃的广播室翻找旧物，意外发现一盘标注着十七年前日期的磁带。她将磁带收入包中，这是拼图的第一块碎片。',
          scriptLines: [
            { type: 'action', text: '林微推开广播室积灰的门，老旧设备上蒙着厚厚的布。' },
            { type: 'action', text: '她翻找抽屉，手指触到一个塑料袋，里面装着一盘老式录音磁带。' },
            { type: 'action', text: '磁带标签上写着日期——十七年前。林微的手微微发抖。' },
            { type: 'dialogue', who: '林微（os）', text: '十七年前……那天放学后，广播室明明锁着门。谁在里面录了东西？' },
            { type: 'action', text: '她将磁带仔细收入包中，环顾这间布满灰尘的小屋，眼神锐利。' },
            { type: 'dialogue', who: '林微', direction: '低声', text: '当年的事，总有人知道。' },
          ]
        },
      ]
    },
    ep2: {
      synopsis: '林微与陈屹重逢后表面客气暗里带刺。张曼被找上门时闪烁其词，王老师则坚持当年的处理是"止损"。林微在旧广播录音中听到关键片段，真相拼图逐渐成形。',
      characters: [
        { name: '林微', role: '女主角', desc: '追查真相的过程中，情感防火墙开始松动', color: '#f472b6' },
        { name: '陈屹', role: '男主角', desc: '表面冷淡，实则暗藏当年的秘密', color: '#60a5fa' },
        { name: '张曼', role: '配角', desc: '面对林微追问，愧疚与自保不断拉扯', color: '#f9a8d4' },
      ],
      scenes: [
        {
          num: '2-1', location: '文具店', time: '日 内', chars: ['林微', '张曼'],
          duration: '约 3 分钟',
          desc: '林微找到张曼的文具店，试探性地提起旧事。张曼笑容僵硬，不断转移话题，但在林微的追问下终于松口，透露当年有人替她挡了更大的事。',
          scriptLines: [
            { type: 'action', text: '逼仄的文具店，货架挤得满满当当。张曼正在理货，看到林微进门，笑容瞬间僵了一瞬。' },
            { type: 'dialogue', who: '张曼', direction: '热情过头', text: '哎呀林微！什么风把你吹来了？快坐快坐！' },
            { type: 'dialogue', who: '林微', direction: '平静', text: '张曼，我问你一件事。当年那张纸条，到底是怎么到王老师手里的？' },
            { type: 'action', text: '张曼手中的笔停住，避开了林微的目光。' },
            { type: 'dialogue', who: '张曼', direction: '支吾', text: '都这么多年了……我哪记得啊。那时候乱糟糟的……' },
            { type: 'dialogue', who: '林微', text: '你记得。你只是不敢说。' },
            { type: 'action', text: '沉默良久。张曼放下笔，叹了口气。' },
            { type: 'dialogue', who: '张曼', direction: '低声', text: '微姐……有件事我一直不敢讲。当年……有人替你挡了更大的事。' },
            { type: 'action', text: '林微瞳孔微缩。' },
            { type: 'dialogue', who: '林微', text: '谁？' },
            { type: 'action', text: '张曼看了看门口，欲言又止。' },
          ]
        },
        {
          num: '2-2', location: '学校家属院', time: '日 外', chars: ['林微', '王老师'],
          duration: '约 3 分钟',
          desc: '林微找到退休后仍住在家属院的王老师。王老师态度强硬，坚称当年是在"止损"，直到林微提起录音磁带，她的表情才第一次出现裂痕。',
          scriptLines: [
            { type: 'action', text: '老旧的家属院楼道，林微敲开王老师的门。王老师穿着整洁，腰板挺直。' },
            { type: 'dialogue', who: '王老师', direction: '不咸不淡', text: '林微？你回来做什么？' },
            { type: 'dialogue', who: '林微', text: '王老师，当年的事，我想听您说一次实话。' },
            { type: 'dialogue', who: '王老师', direction: '正色', text: '我说的每一句都是实话。当年那个处理，是为了你好，为了整个班好。一个人犯了错，不能让全班跟着乱。' },
            { type: 'dialogue', who: '林微', text: '那张纸条不是我写的。您知道。' },
            { type: 'action', text: '王老师沉默了几秒，表情不变。' },
            { type: 'dialogue', who: '王老师', text: '过去的事就过去了。学校都要拆了，你翻这些做什么？' },
            { type: 'dialogue', who: '林微', direction: '盯着她', text: '我在旧广播室找到一盘磁带。十七年前那天的。' },
            { type: 'action', text: '王老师的手微微一颤，随即恢复镇定。但那一瞬间的裂痕，林微看得清清楚楚。' },
          ]
        },
      ]
    },
    ep3: {
      synopsis: '（暂未生成）请先输入故事内容，AI 将自动分析并生成剧本大纲。',
      characters: [],
      scenes: []
    },
    ep4: {
      synopsis: '（暂未生成）请先输入故事内容，AI 将自动分析并生成剧本大纲。',
      characters: [],
      scenes: []
    },
  };

  // --- Helpers ---
  function escapeHtml(text) {
    var div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
  }

  function countWords(text) {
    if (!text || !text.trim()) return 0;
    return text.trim().replace(/\s+/g, ' ').length;
  }

  // --- Aurora background ---
  var bg = el('div', { className: 'editor-aurora-bg' });
  bg.innerHTML =
    '<div class="aurora-blobs">' +
      '<div class="aurora-blob blob-1"></div>' +
      '<div class="aurora-blob blob-2"></div>' +
      '<div class="aurora-blob blob-3"></div>' +
    '</div>' +
    '<div class="aurora-overlay"></div>';
  app.appendChild(bg);

  // --- Global sidebar layout ---
  var layoutData = renderAppLayout();
  app.appendChild(layoutData.layout);
  var mainArea = layoutData.mainArea;
  // Episodes page manages its own internal scroll areas
  mainArea.style.overflow = 'hidden';
  mainArea.style.display = 'flex';
  mainArea.style.flexDirection = 'column';

  // --- Dashboard header (compact) ---
  var dashHeader = el('div', { className: 'dash-header' });
  dashHeader.innerHTML =
    '<div class="dash-header-left">' +
      '<a class="stage-back-btn" href="workspace.html">' + icon('back') + '</a>' +
      '<h1 class="dash-project-name">' + projectName + '</h1>' +
    '</div>' +
    '<div class="dash-header-right">' +
      '<span class="dash-ep-count">' + episodes.length + ' 集</span>' +
    '</div>';
  mainArea.appendChild(dashHeader);

  // --- Tab navigation ---
  var tabNav = el('div', { className: 'dash-tab-nav' });
  var tabsPill = el('div', { className: 'stage-tabs-pill dash-tabs-pill' });

  var TABS = [
    { id: 'story',  label: '剧本大纲', icon: 'book' },
    { id: 'script', label: '项目设置', icon: 'fileText' },
    { id: 'assets', label: '资产库',   icon: 'folderCards' },
    { id: 'videos', label: '分集视频', icon: 'video' },
  ];

  TABS.forEach(function(tab) {
    var tabEl = el('div', { className: 'stage-tab' + (activeTab === tab.id ? ' active' : ''), 'data-tab': tab.id });
    tabEl.innerHTML = icon(tab.icon, 'icon-sm') + '<span>' + tab.label + '</span>';
    tabEl.addEventListener('click', function() { switchTab(tab.id); });
    tabsPill.appendChild(tabEl);
  });

  tabNav.appendChild(tabsPill);
  mainArea.appendChild(tabNav);

  // --- Content container (tab content goes here) ---
  var contentArea = el('div', { className: 'dash-content app-scrollbar' });
  mainArea.appendChild(contentArea);

  // --- Modal container ---
  var modalContainer = el('div', { id: 'modal-container' });
  mainArea.appendChild(modalContainer);

  // --- Saved toast ---
  var savedToast = el('div', { className: 'episodes-toast' });
  savedToast.innerHTML = icon('check', 'icon-sm') + '<span>项目配置已保存</span>';
  mainArea.appendChild(savedToast);

  // --- Tab switching ---
  function switchTab(tabId) {
    activeTab = tabId;
    tabNav.querySelectorAll('.stage-tab').forEach(function(t) {
      t.classList.toggle('active', t.getAttribute('data-tab') === tabId);
    });
    renderTabContent();
  }

  function renderTabContent() {
    contentArea.innerHTML = '';
    if (activeTab === 'story') {
      renderStoryTab();
    } else if (activeTab === 'script') {
      renderScriptTab();
    } else if (activeTab === 'assets') {
      renderAssetTab();
    } else if (activeTab === 'videos') {
      renderVideoTab();
    }
  }

  renderTabContent();

  // ============================================
  // TAB: 故事大纲 (Story) — script outline only
  // ============================================
  function renderStoryTab() {
    renderScriptOutline();
  }

  // ============================================
  // TAB: 剧本 (Script) — project config only
  // ============================================
  function renderScriptTab() {
    renderProjectConfig();
  }

  // ============================================
  // TAB: 资产库 (Assets)
  // ============================================
  function renderAssetTab() {
    var data = outlineData[selectedEpisode.id] || { synopsis: '', characters: [], scenes: [] };
    var section = el('div', { className: 'dash-tab-section asset-tab-section' });

    var html = '<div class="asset-tab-inner">';

    // --- Characters ---
    html += '<div class="glass-surface asset-group-card">' +
      '<div class="asset-group-header">' +
        '<div class="asset-group-icon">' + icon('users', 'icon-sm') + '</div>' +
        '<span class="asset-group-title">角色资产</span>' +
        '<span class="asset-group-count">' + data.characters.length + '</span>' +
      '</div>';

    if (data.characters.length > 0) {
      html += '<div class="asset-grid">';
      data.characters.forEach(function(ch) {
        var initial = ch.name.charAt(0);
        html += '<div class="asset-card asset-char-card">' +
          '<div class="asset-card-thumb" style="background:' + ch.color + '22;border-color:' + ch.color + '44;color:' + ch.color + ';">' +
            '<span class="asset-card-initial">' + initial + '</span>' +
          '</div>' +
          '<div class="asset-card-body">' +
            '<div class="asset-card-name">' + ch.name + '</div>' +
            '<div class="asset-card-tag">' + ch.role + '</div>' +
            '<p class="asset-card-desc">' + escapeHtml(ch.desc) + '</p>' +
          '</div>' +
        '</div>';
      });
      html += '</div>';
    } else {
      html += '<div class="asset-empty">' +
        '<div class="asset-empty-icon">' + icon('users', 'icon-lg') + '</div>' +
        '<p class="asset-empty-text">暂无角色资产</p>' +
        '<p class="asset-empty-hint">生成剧本大纲后将自动提取角色</p>' +
      '</div>';
    }
    html += '</div>';

    // --- Scenes ---
    html += '<div class="glass-surface asset-group-card">' +
      '<div class="asset-group-header">' +
        '<div class="asset-group-icon">' + icon('mapPin', 'icon-sm') + '</div>' +
        '<span class="asset-group-title">场景资产</span>' +
        '<span class="asset-group-count">' + data.scenes.length + '</span>' +
      '</div>';

    if (data.scenes.length > 0) {
      html += '<div class="asset-grid asset-grid-scenes">';
      data.scenes.forEach(function(sc) {
        html += '<div class="asset-card asset-scene-card">' +
          '<div class="asset-card-thumb scene-thumb">' +
            icon('mapPin', 'icon-lg') +
          '</div>' +
          '<div class="asset-card-body">' +
            '<div class="asset-card-name">场景 ' + sc.num + '</div>' +
            '<div class="asset-card-location">' + escapeHtml(sc.location) + '</div>' +
            '<div class="asset-card-tags">' +
              '<span class="asset-card-tag">' + icon('clock', 'icon-xs') + ' ' + sc.time + '</span>' +
            '</div>' +
          '</div>' +
        '</div>';
      });
      html += '</div>';
    } else {
      html += '<div class="asset-empty">' +
        '<div class="asset-empty-icon">' + icon('mapPin', 'icon-lg') + '</div>' +
        '<p class="asset-empty-text">暂无场景资产</p>' +
        '<p class="asset-empty-hint">生成剧本大纲后将自动提取场景</p>' +
      '</div>';
    }
    html += '</div>';

    // --- Props ---
    html += '<div class="glass-surface asset-group-card">' +
      '<div class="asset-group-header">' +
        '<div class="asset-group-icon">' + icon('package', 'icon-sm') + '</div>' +
        '<span class="asset-group-title">道具资产</span>' +
        '<span class="asset-group-count">0</span>' +
      '</div>' +
      '<div class="asset-empty">' +
        '<div class="asset-empty-icon">' + icon('package', 'icon-lg') + '</div>' +
        '<p class="asset-empty-text">暂无道具资产</p>' +
        '<p class="asset-empty-hint">道具将在剧本分析后自动提取</p>' +
      '</div>' +
    '</div>';

    html += '</div>';
    section.innerHTML = html;
    contentArea.appendChild(section);
  }

  // ============================================
  // TAB: 分集视频 (Episode Videos) — with detailed script
  // ============================================
  var videoExpandedEps = {}; // track which episodes are expanded

  function renderVideoTab() {
    var section = el('div', { className: 'dash-tab-section video-tab-section' });

    var html = '<div class="video-tab-inner">';

    html += '<div class="video-tab-header">' +
      '<h2 class="video-tab-title">' + icon('video', 'icon-sm') + ' 分集视频</h2>' +
      '<p class="video-tab-subtitle">共 ' + episodes.length + ' 集 · 点击剧集查看分镜详情或进入编辑器</p>' +
    '</div>';

    html += '<div class="video-ep-list">';

    episodes.forEach(function(ep) {
      var statusClass = 'ep-status-' + ep.status;
      var hasVideo = ep.status === 'storyboard' || ep.status === 'script';
      var epData = outlineData[ep.id] || { scenes: [] };
      var hasScript = epData.scenes && epData.scenes.length > 0;
      var isExpanded = !!videoExpandedEps[ep.id];

      html += '<div class="video-ep-card' + (isExpanded ? ' expanded' : '') + '" data-ep-id="' + ep.id + '">' +
        '<div class="video-ep-main">' +
          '<div class="video-ep-thumb' + (hasVideo ? '' : ' empty') + '">' +
            (hasVideo
              ? icon('play', 'icon-lg')
              : '<div class="video-ep-thumb-placeholder">' + icon('film', 'icon-lg') + '</div>'
            ) +
            '<span class="video-ep-num">第 ' + ep.num + ' 集</span>' +
          '</div>' +
          '<div class="video-ep-body">' +
            '<div class="video-ep-name">' + ep.name + '</div>' +
            '<span class="episode-card-status ' + statusClass + '">' + ep.statusLabel + '</span>' +
            '<div class="video-ep-meta">' +
              (ep.wordCount > 0 ? '<span>' + ep.wordCount + ' 字</span>' : '') +
              (ep.sceneCount > 0 ? '<span class="dot">·</span><span>' + ep.sceneCount + ' 场景</span>' : '') +
              (ep.shotCount > 0 ? '<span class="dot">·</span><span>' + ep.shotCount + ' 镜头</span>' : '') +
              (ep.wordCount === 0 && ep.sceneCount === 0 && ep.shotCount === 0 ? '<span class="empty-meta">暂无内容</span>' : '') +
            '</div>' +
          '</div>' +
          '<div class="video-ep-action">' +
            (hasScript
              ? '<button class="glass-btn-base glass-btn-ghost video-ep-toggle-btn" data-ep-id="' + ep.id + '">' +
                  (isExpanded ? icon('chevronUp', 'icon-sm') + '<span>收起</span>' : icon('chevronDown', 'icon-sm') + '<span>分镜详情</span>') +
                '</button>'
              : ''
            ) +
            '<a class="glass-btn-base glass-btn-primary video-ep-enter-btn" href="editor-script.html">' +
              icon('editSquare', 'icon-sm') + '<span>编辑</span>' +
            '</a>' +
          '</div>' +
        '</div>';

      // Expanded: detailed script
      if (isExpanded && hasScript) {
        html += '<div class="video-ep-script">';

        epData.scenes.forEach(function(sc) {
          var charsHtml = sc.chars.map(function(c) {
            return '<span class="outline-scene-char-tag">' + escapeHtml(c) + '</span>';
          }).join('');

          html += '<div class="glass-surface outline-scene-card">' +
            '<div class="outline-scene-top">' +
              '<div class="outline-scene-num">场' + sc.num + '</div>' +
              '<div class="outline-scene-meta">' +
                '<div class="outline-scene-title">' + escapeHtml(sc.location) + '</div>' +
                '<div class="outline-scene-tags">' +
                  '<span class="outline-scene-tag">' + icon('clock', 'icon-xs') + ' ' + escapeHtml(sc.time) + '</span>' +
                  '<span class="outline-scene-tag">' + icon('film', 'icon-xs') + ' ' + escapeHtml(sc.duration || '约 2 分钟') + '</span>' +
                  charsHtml +
                '</div>' +
              '</div>' +
            '</div>';

          // 剧情概述
          html += '<div class="outline-scene-section">' +
            '<span class="outline-scene-section-label">剧情概述</span>' +
            '<p class="outline-scene-desc">' + escapeHtml(sc.desc) + '</p>' +
          '</div>';

          // 剧本详情
          if (sc.scriptLines && sc.scriptLines.length > 0) {
            html += '<div class="outline-scene-section">' +
              '<span class="outline-scene-section-label">分镜剧本</span>' +
              '<div class="outline-script-body">';

            sc.scriptLines.forEach(function(ln) {
              if (ln.type === 'action') {
                html += '<p class="outline-script-action">△ ' + escapeHtml(ln.text) + '</p>';
              } else if (ln.type === 'subtitle') {
                html += '<div class="outline-script-subtitle">【字幕：' + escapeHtml(ln.text) + '】</div>';
              } else if (ln.type === 'dialogue') {
                html += '<div class="outline-script-dialogue">' +
                  '<span class="outline-script-speaker">' + escapeHtml(ln.who) + '</span>' +
                  (ln.direction ? '<span class="outline-script-direction">（' + escapeHtml(ln.direction) + '）</span>' : '') +
                  '<p class="outline-script-text">' + escapeHtml(ln.text) + '</p>' +
                '</div>';
              } else if (ln.type === 'flashback') {
                html += '<div class="outline-script-flashback">' + escapeHtml(ln.text) + '</div>';
              } else if (ln.type === 'flashback_end') {
                html += '<div class="outline-script-flashback end">' + escapeHtml(ln.text) + '</div>';
              }
            });

            html += '</div></div>';
          }

          html += '</div>';
        });

        html += '</div>';
      }

      html += '</div>';
    });

    html += '</div></div>';
    section.innerHTML = html;
    contentArea.appendChild(section);

    // Wire up toggle buttons
    setTimeout(function() {
      section.querySelectorAll('.video-ep-toggle-btn').forEach(function(btn) {
        btn.addEventListener('click', function(e) {
          e.stopPropagation();
          var epId = btn.getAttribute('data-ep-id');
          videoExpandedEps[epId] = !videoExpandedEps[epId];
          renderVideoTab();
        });
      });

      // Card click (non-button) still navigates to editor
      section.querySelectorAll('.video-ep-card').forEach(function(card) {
        card.addEventListener('click', function(e) {
          if (e.target.closest('.video-ep-toggle-btn') || e.target.closest('.video-ep-enter-btn')) return;
          // If has script, toggle expansion; otherwise navigate
          var epId = card.getAttribute('data-ep-id');
          var epData = outlineData[epId];
          if (epData && epData.scenes && epData.scenes.length > 0) {
            videoExpandedEps[epId] = !videoExpandedEps[epId];
            renderVideoTab();
          } else {
            window.location.href = 'editor-script.html';
          }
        });
      });
    }, 0);
  }
  // Expose accordion toggle globally so inline onclick always works
  window.toggleOutlineAccordion = function(key, epId) {
    var accordion = document.querySelector('.outline-accordion[data-accordion="' + key + '"]' + (epId ? '[data-ep-id="' + epId + '"]' : ''));
    if (!accordion) return;
    var isExpanded = accordion.classList.contains('expanded');

    if (key === 'summary') {
      outlineAccordionState.summaryExpanded = !isExpanded;
    } else if (key === 'episodes') {
      outlineAccordionState.episodesExpanded = !isExpanded;
    } else if (epId) {
      outlineAccordionState.expandedEps[epId] = !isExpanded;
    }

    renderScriptOutline();
  };

  // ============================================
  // SCRIPT OUTLINE (剧本大纲) — used by 故事 tab
  // ============================================
  function renderScriptOutline() {
    contentArea.querySelectorAll('.script-outline-section').forEach(function(existing) {
      existing.remove();
    });

    var section = el('div', { className: 'script-outline-section dash-tab-section' });

    // Collect all episodes that have outline content
    var epsWithContent = episodes.filter(function(ep) {
      var d = outlineData[ep.id];
      return d && d.scenes && d.scenes.length > 0;
    });
    var hasAnyContent = epsWithContent.length > 0;

    // Use first episode's synopsis as script summary
    var summaryData = outlineData[episodes[0].id] || { synopsis: '', characters: [], scenes: [] };
    var hasSummary = summaryData.synopsis && summaryData.synopsis.trim().length > 0;

    var html = '<div class="outline-inner">';

    // --- Header ---
    html += '<div class="outline-header">' +
      '<div class="outline-header-left">' +
        '<h2 class="outline-ep-title">剧本大纲</h2>' +
      '</div>' +
      '<div class="outline-header-right">' +
        (hasAnyContent ?
          '<button class="glass-btn-base glass-btn-ghost outline-action-btn" id="outline-edit-btn">' + icon('editSquare', 'icon-sm') + '<span>编辑大纲</span></button>' +
          '<button class="glass-btn-base glass-btn-primary outline-action-btn" id="outline-generate-btn">' + icon('sparkles', 'icon-sm') + '<span>AI 优化</span></button>'
        :
          '<button class="glass-btn-base glass-btn-primary outline-action-btn" id="outline-generate-btn">' + icon('sparkles', 'icon-sm') + '<span>生成剧本大纲</span></button>'
        ) +
      '</div>' +
    '</div>';

    if (!hasAnyContent && !hasSummary) {
      // Empty state
      html += '<div class="glass-surface outline-empty-card">' +
        '<div class="outline-empty-icon">' + icon('fileText', 'icon-lg') + '</div>' +
        '<h3 class="outline-empty-title">暂无剧本大纲</h3>' +
        '<p class="outline-empty-desc">点击上方"生成剧本大纲"按钮，AI 将根据故事内容自动分析并生成结构化的剧本大纲</p>' +
        '<button class="glass-btn-base glass-btn-primary" id="outline-generate-btn-2">' + icon('sparkles', 'icon-sm') + '<span>生成剧本大纲</span></button>' +
      '</div>';
    } else {
      // --- 剧本摘要 (collapsible) ---
      var summaryBody = '';

      // 故事梗概
      if (summaryData.storySynopsis) {
        summaryBody += '<div class="outline-summary-subsection">' +
          '<h4 class="outline-summary-subtitle">' + icon('book', 'icon-xs') + ' 故事梗概</h4>' +
          '<p class="outline-synopsis-text">' + escapeHtml(summaryData.storySynopsis) + '</p>' +
        '</div>';
      } else if (summaryData.synopsis) {
        summaryBody += '<div class="outline-summary-subsection">' +
          '<h4 class="outline-summary-subtitle">' + icon('book', 'icon-xs') + ' 故事梗概</h4>' +
          '<p class="outline-synopsis-text">' + escapeHtml(summaryData.synopsis) + '</p>' +
        '</div>';
      }

      // 人物小传
      if (summaryData.characterProfiles && summaryData.characterProfiles.length > 0) {
        summaryBody += '<div class="outline-summary-subsection">' +
          '<h4 class="outline-summary-subtitle">' + icon('users', 'icon-xs') + ' 人物小传</h4>' +
          '<div class="outline-profile-grid">';

        summaryData.characterProfiles.forEach(function(cp) {
          var tagsHtml = cp.coreTags.map(function(tag) {
            return '<span class="outline-profile-tag">' + escapeHtml(tag) + '</span>';
          }).join('');

          summaryBody += '<div class="glass-surface outline-profile-card">' +
            '<div class="outline-profile-header">' +
              '<div class="outline-profile-avatar" style="background:' + cp.color + '22;border-color:' + cp.color + '44;color:' + cp.color + ';">' +
                escapeHtml(cp.name.charAt(0)) +
              '</div>' +
              '<div class="outline-profile-head-info">' +
                '<div class="outline-profile-name">' + escapeHtml(cp.name) + '</div>' +
                '<span class="outline-profile-role-badge">' + escapeHtml(cp.role) + '</span>' +
              '</div>' +
            '</div>' +
            '<div class="outline-profile-tags">' + tagsHtml + '</div>' +
            '<div class="outline-profile-fields">' +
              '<div class="outline-profile-field">' +
                '<span class="outline-profile-field-label">视觉形象</span>' +
                '<p class="outline-profile-field-text">' + escapeHtml(cp.visualImage) + '</p>' +
              '</div>' +
              '<div class="outline-profile-field">' +
                '<span class="outline-profile-field-label">身份背景</span>' +
                '<p class="outline-profile-field-text">' + escapeHtml(cp.background) + '</p>' +
              '</div>' +
              '<div class="outline-profile-field">' +
                '<span class="outline-profile-field-label">成长经历</span>' +
                '<p class="outline-profile-field-text">' + escapeHtml(cp.growth) + '</p>' +
              '</div>' +
              '<div class="outline-profile-field">' +
                '<span class="outline-profile-field-label">性格特点</span>' +
                '<p class="outline-profile-field-text">' + escapeHtml(cp.personality) + '</p>' +
              '</div>' +
              '<div class="outline-profile-field">' +
                '<span class="outline-profile-field-label">角色关系</span>' +
                '<p class="outline-profile-field-text">' + escapeHtml(cp.relationships) + '</p>' +
              '</div>' +
            '</div>' +
          '</div>';
        });

        summaryBody += '</div></div>';
      }

      html += renderAccordion('summary', '剧本摘要', outlineAccordionState.summaryExpanded, false,
        '<div class="outline-summary-body">' + summaryBody + '</div>'
      );

      // --- 分集剧本 (collapsible) ---
      var episodesHtml = '';
      episodes.forEach(function(ep, idx) {
        var epData = outlineData[ep.id] || { synopsis: '', characters: [], scenes: [] };
        var epHasContent = epData.scenes.length > 0;
        var isExpanded = !!outlineAccordionState.expandedEps[ep.id];

        var epBody = '';
        if (!epHasContent) {
          epBody += '<div class="outline-empty">' +
            '<p>该集暂无剧本内容</p>' +
          '</div>';
        } else {
          // Aggregate scene data into one episode summary card
          var allChars = [];
          var sceneInfoList = [];
          var totalMinutes = 0;
          var synopsisParts = [];

          epData.scenes.forEach(function(sc) {
            // Unique characters
            sc.chars.forEach(function(c) {
              if (allChars.indexOf(c) === -1) allChars.push(c);
            });
            // Scene info: location (time)
            sceneInfoList.push(escapeHtml(sc.location) + '（' + escapeHtml(sc.time) + '）');
            // Duration sum
            var minMatch = String(sc.duration || '约 2 分钟').match(/(\d+(?:\.\d+)?)/);
            if (minMatch) totalMinutes += parseFloat(minMatch[1]);
            // Synopsis parts
            synopsisParts.push(escapeHtml(sc.desc));
          });

          var charsHtml = allChars.map(function(c) {
            return '<span class="outline-scene-char-tag">' + escapeHtml(c) + '</span>';
          }).join('');

          var totalDurationText = totalMinutes > 0 ? '约 ' + totalMinutes + ' 分钟' : '约 2 分钟';

          epBody += '<div class="glass-surface outline-scene-card outline-episode-summary-card">' +
            '<div class="outline-scene-top">' +
              '<div class="outline-scene-meta">' +
                '<div class="outline-scene-title">该集概览</div>' +
                '<div class="outline-scene-tags">' +
                  '<span class="outline-scene-tag">' + icon('clock', 'icon-xs') + ' ' + totalDurationText + '</span>' +
                  charsHtml +
                '</div>' +
              '</div>' +
            '</div>';

          // 场景信息
          epBody += '<div class="outline-scene-section">' +
            '<span class="outline-scene-section-label">场景信息</span>' +
            '<div class="outline-episode-scene-list">' + sceneInfoList.join('<span class="outline-scene-sep">·</span>') + '</div>' +
          '</div>';

          // 剧情梗概
          epBody += '<div class="outline-scene-section">' +
            '<span class="outline-scene-section-label">剧情梗概</span>' +
            '<p class="outline-scene-desc">' + synopsisParts.join(' ') + '</p>' +
          '</div>';

          epBody += '</div>';
        }

        episodesHtml += renderAccordion('ep-' + ep.id, '第一季 第' + (idx + 1) + '集', isExpanded, true, epBody, ep.id);
      });

      var expandAllLabel = getExpandAllLabel();
      html += renderAccordion('episodes', '分集剧本', outlineAccordionState.episodesExpanded, false,
        '<div class="outline-episodes-toolbar">' +
          '<button class="outline-expand-all-btn" id="outline-expand-all-btn">' + expandAllLabel + '</button>' +
        '</div>' +
        '<div class="outline-episodes-list">' + episodesHtml + '</div>',
        null,
        '',
        '<button class="outline-expand-all-btn" id="outline-expand-all-btn-header">' + expandAllLabel + '</button>'
      );
    }

    html += '</div>'; // outline-inner

    section.innerHTML = html;
    contentArea.appendChild(section);

    wireOutlineEvents(section);
  }

  function getExpandAllLabel() {
    var epsWithScenes = episodes.filter(function(ep) {
      var d = outlineData[ep.id];
      return d && d.scenes && d.scenes.length > 0;
    });
    if (epsWithScenes.length === 0) return '展开全部';
    var allExpanded = epsWithScenes.every(function(ep) { return outlineAccordionState.expandedEps[ep.id]; });
    return allExpanded ? '全部折叠' : '展开全部';
  }

  function renderAccordion(key, title, expanded, isNested, bodyHtml, epId, extraHtml, headerActions) {
    var cls = 'outline-accordion' + (isNested ? ' outline-accordion-nested' : '') + (expanded ? ' expanded' : '');
    var dataAttr = epId ? ' data-ep-id="' + epId + '"' : '';
    var dataKey = ' data-accordion="' + key + '"';
    var onclickAttr = ' onclick="toggleOutlineAccordion(\'' + key + '\',' + (epId ? '\'' + epId + '\'' : 'null') + ')"';
    return '<div class="' + cls + '"' + dataAttr + dataKey + '>' +
      '<div class="outline-accordion-header-row">' +
        '<div class="outline-accordion-header" role="button" tabindex="0"' + onclickAttr + '>' +
          '<span class="outline-accordion-arrow">' + (expanded ? icon('chevronDown', 'icon-xs') : icon('chevronRight', 'icon-xs')) + '</span>' +
          '<span class="outline-accordion-title">' + title + '</span>' +
          (extraHtml || '') +
        '</div>' +
        (headerActions || '') +
      '</div>' +
      '<div class="outline-accordion-body">' + bodyHtml + '</div>' +
    '</div>';
  }

  function wireOutlineEvents(section) {
    // Accordion toggles are handled via inline onclick on each header
    // (kept here only for keyboard accessibility on div[role=button])
    section.querySelectorAll('.outline-accordion-header').forEach(function(header) {
      header.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          header.click();
        }
      });
    });

    // Expand all / collapse all
    section.querySelectorAll('#outline-expand-all-btn, #outline-expand-all-btn-header').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();

        var epsWithScenes = episodes.filter(function(ep) {
          var d = outlineData[ep.id];
          return d && d.scenes && d.scenes.length > 0;
        });
        var allExpanded = epsWithScenes.every(function(ep) { return outlineAccordionState.expandedEps[ep.id]; });
        epsWithScenes.forEach(function(ep) {
          outlineAccordionState.expandedEps[ep.id] = !allExpanded;
        });
        renderScriptOutline();
      });
    });

    // Generate / edit buttons
    var genBtn = section.querySelector('#outline-generate-btn') || section.querySelector('#outline-generate-btn-2');
    if (genBtn) {
      genBtn.addEventListener('click', function() {
        genBtn.disabled = true;
        genBtn.innerHTML = '<span class="loading-spinner"></span> <span>AI 生成中...</span>';
        setTimeout(function() {
          window.location.href = 'editor-script.html';
        }, 1500);
      });
    }

    var editBtn = section.querySelector('#outline-edit-btn');
    if (editBtn) {
      editBtn.addEventListener('click', function() {
        window.location.href = 'editor-script.html';
      });
    }
  }

  // ============================================
  // PROJECT CONFIG (ratio + style, project-wide)
  // ============================================
  function renderProjectConfig() {
    var existing = contentArea.querySelector('.project-config-wrap');
    if (existing) existing.remove();

    var ratioObj = RATIO_OPTIONS.find(function(r) { return r.value === projectConfig.videoRatio; }) || RATIO_OPTIONS[0];
    var styleObj = STYLE_OPTIONS.find(function(s) { return s.value === projectConfig.artStyle; }) || STYLE_OPTIONS[0];
    var ratioTag = (t.storyInput.ratioUsageTag && t.storyInput.ratioUsageTag[projectConfig.videoRatio.replace(/:/g, '_')]) || '';

    var wrap = el('div', { className: 'dash-tab-section project-config-wrap' });
    var card = el('div', { className: 'project-config-card glass-surface' });
    card.innerHTML =
      '<div class="project-config-header">' +
        '<div class="project-config-icon">' + icon('settings', 'icon-sm') + '</div>' +
        '<div class="project-config-titles">' +
          '<div class="project-config-title">项目配置</div>' +
          '<div class="project-config-subtitle">应用于该项目下所有剧集，创作新剧集时自动继承</div>' +
        '</div>' +
        '<span class="project-config-badge">统一配置</span>' +
      '</div>' +
      '<div class="project-config-body">' +
        // Ratio
        '<div class="project-config-field">' +
          '<div class="project-config-field-header">' +
            '<label class="project-config-label">' + t.storyInput.videoRatio + '</label>' +
            '<span class="project-config-tag">' + ratioTag + '</span>' +
          '</div>' +
          '<select class="config-option-select" id="project-ratio-select">' +
            RATIO_OPTIONS.map(function(r) {
              return '<option value="' + r.value + '"' + (projectConfig.videoRatio === r.value ? ' selected' : '') + '>' +
                r.label + (r.recommended ? ' (推荐)' : '') +
              '</option>';
            }).join('') +
          '</select>' +
          '<p class="project-config-hint">' + t.storyInput.videoRatioHint + '</p>' +
        '</div>' +
        // Art style
        '<div class="project-config-field">' +
          '<div class="project-config-field-header">' +
            '<label class="project-config-label">' + t.storyInput.visualStyle + '</label>' +
          '</div>' +
          '<select class="config-option-select" id="project-style-select">' +
            STYLE_OPTIONS.map(function(s) {
              return '<option value="' + s.value + '"' + (projectConfig.artStyle === s.value ? ' selected' : '') + '>' +
                s.label + (s.recommended ? ' (推荐)' : '') +
              '</option>';
            }).join('') +
          '</select>' +
          '<p class="project-config-hint">' + t.storyInput.visualStyleHint + '</p>' +
        '</div>' +
      '</div>' +
      '<div class="project-config-summary">' +
        '<span class="project-config-summary-dot"></span>' +
        '<span>当前配置：</span>' +
        '<strong>' + ratioObj.label + '</strong>' +
        '<span class="dim">·</span>' +
        '<strong>' + styleObj.label + '</strong>' +
        '<span class="dim"> — 保存后将应用于全部 ' + episodes.length + ' 集</span>' +
      '</div>' +
      '<div class="project-config-footer">' +
        '<button class="glass-btn-base glass-btn-primary project-config-save-btn" id="project-config-save">' +
          icon('check', 'icon-sm') + '<span>保存配置</span>' +
        '</button>' +
      '</div>';

    wrap.appendChild(card);
    contentArea.appendChild(wrap);

    setTimeout(function() {
      var rs = card.querySelector('#project-ratio-select');
      if (rs) rs.addEventListener('change', function() { projectConfig.videoRatio = rs.value; renderProjectConfig(); });

      var ss = card.querySelector('#project-style-select');
      if (ss) ss.addEventListener('change', function() { projectConfig.artStyle = ss.value; renderProjectConfig(); });

      var saveBtn = card.querySelector('#project-config-save');
      if (saveBtn) saveBtn.addEventListener('click', function() {
        showSavedToast();
        // Persist to localStorage so other editor pages can read it later
        try {
          localStorage.setItem('projectConfig', JSON.stringify(projectConfig));
        } catch (e) {}
      });
    }, 0);
  }

  function showSavedToast() {
    savedToast.classList.add('show');
    if (savedToastTimer) clearTimeout(savedToastTimer);
    savedToastTimer = setTimeout(function() { savedToast.classList.remove('show'); }, 2200);
  }

  // ============================================
  // RENDER EPISODES
  // ============================================
  function renderEpisodes() {
    listContainer.querySelectorAll('.ep-row, .episodes-empty-state').forEach(function(n) { n.remove(); });

    // Also refresh sidebar search if needed
    var existingSearch = sidebar.querySelector('#ep-search');
    if (existingSearch) {
      existingSearch.value = searchQuery;
    }
    var existingClear = sidebar.querySelector('#ep-search-clear');
    if (existingClear && !searchQuery) existingClear.remove();
    if (!existingClear && searchQuery) {
      var searchBox = sidebar.querySelector('.episodes-search-box');
      if (searchBox) {
        var clearBtn = el('button', { className: 'episodes-search-clear', id: 'ep-search-clear' });
        clearBtn.innerHTML = icon('x', 'icon-xs');
        searchBox.appendChild(clearBtn);
        clearBtn.addEventListener('click', function() {
          searchQuery = '';
          renderEpisodes();
          var newInput = sidebar.querySelector('#ep-search');
          if (newInput) newInput.focus();
        });
      }
    }

    // Filter episodes
    var filtered = episodes.filter(function(ep) {
      if (!searchQuery) return true;
      return ep.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
             ('第' + ep.num + '集').includes(searchQuery);
    });

    if (filtered.length === 0) {
      var empty = el('div', { className: 'episodes-empty-state' });
      empty.innerHTML =
        '<div class="episodes-empty-icon">' + icon('inbox', 'icon-lg') + '</div>' +
        '<p class="episodes-empty-text">' + (searchQuery ? '没有找到匹配的剧集' : '还没有剧集，点击上方创建第一集') + '</p>';
      listContainer.appendChild(empty);
    } else {
      filtered.forEach(function(ep) {
        var statusClass = 'ep-status-' + ep.status;
        var isSelected = selectedEpisode && selectedEpisode.id === ep.id;
        var item = el('div', { className: 'ep-row' + (isSelected ? ' selected' : '') });

        item.innerHTML =
          '<div class="ep-row-num">' + ep.num + '</div>' +
          '<div class="ep-row-body">' +
            '<div class="ep-row-top">' +
              '<span class="ep-row-name">' + ep.name + '</span>' +
              '<span class="episode-card-status ' + statusClass + '">' + ep.statusLabel + '</span>' +
            '</div>' +
            '<div class="ep-row-meta">' +
              (ep.wordCount > 0 ? '<span>' + ep.wordCount + ' 字</span>' : '') +
              (ep.sceneCount > 0 ? '<span class="ep-row-dot">·</span><span>' + ep.sceneCount + ' 场景</span>' : '') +
              (ep.shotCount > 0 ? '<span class="ep-row-dot">·</span><span>' + ep.shotCount + ' 镜头</span>' : '') +
              (ep.wordCount === 0 && ep.sceneCount === 0 && ep.shotCount === 0 ? '<span class="ep-row-empty">暂无内容</span>' : '') +
            '</div>' +
          '</div>' +
          '<div class="ep-row-actions">' +
            '<button class="ep-edit-btn" data-ep-id="' + ep.id + '">' + icon('editSquare', 'icon-xs') + '</button>' +
            '<button class="ep-delete-btn" data-ep-id="' + ep.id + '">' + icon('trash', 'icon-xs') + '</button>' +
          '</div>';

        // Click to select episode and show its script outline (but not when clicking action buttons)
        item.addEventListener('click', function(e) {
          if (e.target.closest('.ep-row-actions')) return;
          selectedEpisode = ep;
          renderEpisodes();
          renderScriptOutline();
        });

        listContainer.appendChild(item);
      });
    }

    // Wire up events
    setTimeout(function() {
      var searchInput = sidebar.querySelector('#ep-search');
      if (searchInput) {
        searchInput.addEventListener('input', function(e) {
          searchQuery = e.target.value;
          renderEpisodes();
          var newInput = sidebar.querySelector('#ep-search');
          if (newInput) {
            newInput.focus();
            newInput.setSelectionRange(searchQuery.length, searchQuery.length);
          }
        });
      }

      var clearBtn = sidebar.querySelector('#ep-search-clear');
      if (clearBtn) {
        clearBtn.addEventListener('click', function() {
          searchQuery = '';
          renderEpisodes();
          var newInput = sidebar.querySelector('#ep-search');
          if (newInput) newInput.focus();
        });
      }

      // Edit buttons
      var editBtns = listContainer.querySelectorAll('.ep-edit-btn');
      editBtns.forEach(function(btn) {
        btn.addEventListener('click', function(e) {
          e.preventDefault();
          e.stopPropagation();
          var epId = btn.getAttribute('data-ep-id');
          editingEpisode = episodes.find(function(ep) { return ep.id === epId; });
          modalOpen = true;
          renderModal();
        });
      });

      // Delete buttons
      var delBtns = listContainer.querySelectorAll('.ep-delete-btn');
      delBtns.forEach(function(btn) {
        btn.addEventListener('click', function(e) {
          e.preventDefault();
          e.stopPropagation();
          var epId = btn.getAttribute('data-ep-id');
          deleteTarget = episodes.find(function(ep) { return ep.id === epId; });
          renderDeleteModal();
        });
      });
    }, 0);
  }

  // ============================================
  // NEW / EDIT EPISODE MODAL
  // ============================================
  function renderModal() {
    modalContainer.innerHTML = '';
    if (!modalOpen) return;

    var isEdit = !!editingEpisode;
    var epName = isEdit ? editingEpisode.name : '';
    var epNum = isEdit ? editingEpisode.num : episodes.length + 1;

    var overlay = el('div', { className: 'modal-overlay glass-overlay', onclick: function(e) { if (e.target === overlay) { modalOpen = false; renderModal(); } } });
    var container = el('div', { className: 'modal-container glass-surface-modal' });
    container.style.maxWidth = '440px';

    container.innerHTML =
      '<div class="modal-header">' +
        '<div class="modal-title">' + (isEdit ? '编辑剧集' : '新建剧集') + '</div>' +
        '<button class="modal-close" id="ep-modal-close">' + icon('x', 'icon-sm') + '</button>' +
      '</div>' +
      '<div class="modal-body">' +
        '<div class="modal-label">集数</div>' +
        '<input type="number" class="glass-input-base" id="ep-num-input" value="' + epNum + '" min="1" style="margin-bottom:16px;" />' +
        '<div class="modal-label">剧集名称</div>' +
        '<input type="text" class="glass-input-base" id="ep-name-input" value="' + epName.replace(/"/g, '&quot;') + '" placeholder="输入剧集名称..." />' +
        '<div class="modal-hint">为这一集起一个有吸引力的标题</div>' +
      '</div>' +
      '<div class="modal-footer">' +
        '<button class="glass-btn-base glass-btn-ghost" id="ep-cancel">' + t.common.cancel + '</button>' +
        '<button class="glass-btn-base glass-btn-primary" id="ep-confirm">' +
          icon('check', 'icon-sm') + ' ' + (isEdit ? '保存' : '创建') +
        '</button>' +
      '</div>';

    overlay.appendChild(container);
    modalContainer.appendChild(overlay);

    setTimeout(function() {
      var closeBtn = container.querySelector('#ep-modal-close');
      if (closeBtn) closeBtn.addEventListener('click', function() { modalOpen = false; renderModal(); });
      var cancelBtn = container.querySelector('#ep-cancel');
      if (cancelBtn) cancelBtn.addEventListener('click', function() { modalOpen = false; renderModal(); });
      var confirmBtn = container.querySelector('#ep-confirm');
      if (confirmBtn) confirmBtn.addEventListener('click', function() {
        var nameInput = container.querySelector('#ep-name-input');
        var numInput = container.querySelector('#ep-num-input');
        var name = nameInput.value.trim();
        var num = parseInt(numInput.value) || (episodes.length + 1);
        if (!name) {
          nameInput.style.borderColor = 'var(--glass-tone-danger-fg)';
          return;
        }
        if (isEdit) {
          editingEpisode.name = name;
          editingEpisode.num = num;
        } else {
          episodes.push({
            id: 'ep' + Date.now(),
            num: num,
            name: name,
            status: 'draft',
            statusLabel: '草稿',
            wordCount: 0,
            sceneCount: 0,
            shotCount: 0,
            updatedAt: Date.now(),
          });
        }
        modalOpen = false;
        editingEpisode = null;
        renderModal();
        renderEpisodes();
        // Refresh project config (episode count changed)
        renderProjectConfig();
      });

      var nameInput = container.querySelector('#ep-name-input');
      if (nameInput) nameInput.focus();
    }, 0);
  }

  // ============================================
  // DELETE CONFIRM MODAL
  // ============================================
  function renderDeleteModal() {
    modalContainer.innerHTML = '';
    if (!deleteTarget) return;

    var overlay = el('div', { className: 'modal-overlay glass-overlay', onclick: function(e) { if (e.target === overlay) { deleteTarget = null; renderDeleteModal(); } } });
    var container = el('div', { className: 'modal-container glass-surface-modal' });
    container.style.maxWidth = '400px';

    container.innerHTML =
      '<div class="modal-header">' +
        '<div class="modal-title">删除剧集</div>' +
      '</div>' +
      '<div class="modal-body">' +
        '<div style="padding:14px 16px;border-radius:12px;background:var(--glass-tone-danger-bg);border:1px solid var(--glass-tone-danger-border);margin-bottom:8px;">' +
          '<p style="font-size:13px;color:var(--glass-tone-danger-fg);line-height:1.6;">' +
            '确定要删除 <strong>第 ' + deleteTarget.num + ' 集 · ' + deleteTarget.name + '</strong> 吗？' +
          '</p>' +
          '<p style="font-size:12px;color:var(--glass-tone-danger-fg);opacity:.8;margin-top:8px;">删除后无法恢复，该集的所有剧本、分镜和视频数据将一并清除。</p>' +
        '</div>' +
      '</div>' +
      '<div class="modal-footer">' +
        '<button class="glass-btn-base glass-btn-ghost" id="del-cancel">' + t.common.cancel + '</button>' +
        '<button class="glass-btn-base glass-btn-primary" id="del-confirm" style="background:var(--glass-tone-danger-fg);">' +
          icon('trash', 'icon-sm') + ' 删除' +
        '</button>' +
      '</div>';

    overlay.appendChild(container);
    modalContainer.appendChild(overlay);

    setTimeout(function() {
      var cancelBtn = container.querySelector('#del-cancel');
      if (cancelBtn) cancelBtn.addEventListener('click', function() { deleteTarget = null; renderDeleteModal(); });
      var confirmBtn = container.querySelector('#del-confirm');
      if (confirmBtn) confirmBtn.addEventListener('click', function() {
        var idx = episodes.indexOf(deleteTarget);
        if (idx >= 0) episodes.splice(idx, 1);
        deleteTarget = null;
        renderDeleteModal();
        renderEpisodes();
        renderProjectConfig();
      });
    }, 0);
  }
})();