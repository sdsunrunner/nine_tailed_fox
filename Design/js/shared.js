// ============================================
// Shared: state, helpers, i18n, top nav
// ============================================

// --- Shared State ---
const state = {
  workspaceStage: 'story',
  selectedEpisode: 1,
  projects: [
    { id: 'p1', name: '校园青春物语', description: '一段关于高中生活的浪漫故事', stats: { episodes: 5, images: 23, videos: 8 }, updatedAt: Date.now() - 3600000 * 2 },
    { id: 'p2', name: '星际迷航记', description: '太空冒险科幻短剧，讲述人类在星际间的探索故事', stats: { episodes: 3, images: 15, videos: 5 }, updatedAt: Date.now() - 86400000 * 2 },
    { id: 'p3', name: '古风仙侠录', description: '修仙世界的恩怨情仇', stats: { episodes: 8, images: 42, videos: 12 }, updatedAt: Date.now() - 86400000 * 5 },
    { id: 'p4', name: '都市奇缘', description: '现代都市中的奇妙遭遇', stats: { episodes: 2, images: 8, videos: 0 }, updatedAt: Date.now() - 60000 * 30 },
    { id: 'p5', name: '末日旅人', description: '后末日世界的生存之旅', stats: { episodes: 6, images: 31, videos: 10 }, updatedAt: Date.now() - 86400000 },
  ],
  assets: {
    characters: [
      { id: 'c1', name: '林晓', description: '17岁少女，黑色长发，总是穿着校服' },
      { id: 'c2', name: '陈宇', description: '18岁少年，棕色短发，阳光开朗' },
      { id: 'c3', name: '苏婉清', description: '古代仙子，白衣飘飘，手持玉笛' },
    ],
    locations: [
      { id: 'l1', name: '星辰高中', description: '现代化的高中校园，有樱花树和教学楼' },
      { id: 'l2', name: '仙灵山', description: '云雾缭绕的仙山，有瀑布和古松' },
    ],
    props: [
      { id: 'pr1', name: '时光怀表', description: '古铜色怀表，有复杂的花纹' },
    ],
    voices: [
      { id: 'v1', name: '温柔女声', description: '温柔甜美的年轻女性' },
    ],
  },
  assetHubTab: 'characters',
};

// --- i18n ---
const t = {
  home: {
    title: '从灵感到银幕',
    subtitle: '描述你想要创作的故事，AI 为你智能生成影视短剧',
    inputPlaceholder: '输入你想要的剧本内容或上传参考文件进行改编...',
    startCreation: '开始创作',
    recentProjects: '最近项目',
    viewAll: '查看全部项目',
    noProjects: '还没有项目，从上方开始你的第一个创作吧',
    aiWriteTrigger: 'AI 帮我写',
    aiWriteTitle: 'AI 创作助手',
    aiWriteSubtitle: '输入你的创意，让 AI 帮你生成完整故事',
    aiWriteLabel: '输入你的创意内容',
    aiWritePlaceholder: '输入关键词、故事大纲或简短创意...\n\n例如：\n\u2022 古代宫廷 复仇 悬疑 女主角\n\u2022 第一幕：女主回到京城，暗访旧宅；第二幕：宫廷宴会偶遇仇人之子',
    aiWriteHint: '可以输入关键词、故事大纲、创意描述，AI 会根据你的输入扩展生成完整的故事内容',
    aiWriteStart: '开始 AI 创作',
    cancel: '取消',
    loading: '加载中...',
  },
  common: {
    loading: '加载中...',
    episode: '剧集',
    confirm: '确认',
    cancel: '取消',
    delete: '删除',
    save: '保存',
    create: '创建',
    search: '搜索',
  },
  stages: {
    story: '故事',
    script: '剧本',
    storyboard: '分镜',
    video: '成片',
    editor: 'AI剪辑',
    editorComingSoon: '开发中，关注我们获取最新消息',
  },
  novelPromotion: {
    assetLibrary: '资产库',
    settings: '项目配置',
    refreshData: '刷新项目数据',
    enterVideoGeneration: '进入视频生成 \u2192',
  },
  storyInput: {
    currentEditing: '当前正在编辑：{name}',
    editingTip: '以下制作流程仅针对本集,如有其他剧集请在左上角切换',
    wordCount: '字数：',
    assetLibraryTip: {
      title: '需要自定义角色和场景？',
      description: '点击右上角的「资产库」按钮，可以上传资产设定文档或手动添加角色/场景。AI 将优先使用资产库中的设定进行分析。',
    },
    videoRatio: '画面比例',
    videoRatioHint: '选择合适的画面比例，可以更好适配投放平台和素材形态',
    ratioUsageTag: {
      '1_1': '方形 \u00b7 头像/封面',
      '9_16': '竖屏 \u00b7 短视频',
      '16_9': '横屏 \u00b7 长视频',
      '4_3': '横屏 \u00b7 传统电视',
      '3_4': '竖屏 \u00b7 图文混排',
      '2_3': '竖屏 \u00b7 海报/立绘',
      '3_2': '横屏 \u00b7 风景/剧情',
      '4_5': '竖屏 \u00b7 信息流图',
      '5_4': '横屏 \u00b7 Banner',
      '21_9': '超宽 \u00b7 电影感',
    },
    visualStyle: '画面风格',
    visualStyleHint: '选择画面风格，不同风格适合不同类型的作品',
    currentConfigSummary: '当前配置：{ratio} \u00b7 {style}，后续生成都会使用此组合',
    moreConfig: '更多配置请点击右上角「 配置」按钮',
    narration: {
      title: '启用旁白配音',
      description: '生成 TTS 语音旁白，为视频添加解说',
    },
    creating: 'AI 创作中...',
    ready: '\u2713 配置完成，可以进入下一步',
    pleaseInput: '请先输入剧本内容',
    longTextDetection: {
      title: '\ud83d\ude80 建议使用智能分集',
      description: '检测到文本约 {count} 字，长文本直接作为单集处理可能导致生成效果不佳。',
      strongRecommend: '强烈建议使用智能分集，AI 将自动识别章节结构，拆分为多集并行处理，显著提升生成质量和效率。',
      continueAnyway: '仍然单集创作',
      smartSplit: '智能分集',
      smartSplitRecommend: '推荐',
      singleEpisodeWarning: '单集模式下，所有内容将作为一集处理',
    },
  },
  smartImport: {
    title: '开启你的创作之旅',
    subtitle: '首先，选择你的创作方式',
    manualCreate: {
      title: '从第一集开始创作',
      description: '从第一集开始，适合边写边播或单集短视频制作',
      button: '开始创作',
    },
    smartImport: {
      title: '智能文本分集',
      description: '上传整本小说或剧本，AI 引擎自动识别章节结构，一键完成智能分集。',
      button: '立即导入',
      recommended: '推荐',
    },
  },
  aiWrite: {
    trigger: 'AI 帮我写',
    modalTitle: 'AI 创作助手',
    modalSubtitle: '输入你的创意，让 AI 帮你生成完整故事',
    inputLabel: '输入你的创意内容',
    placeholder: '输入关键词、故事大纲或简短创意...\n\n例如：\n\u2022 古代宫廷 复仇 悬疑 女主角\n\u2022 第一幕：女主回到京城，暗访旧宅；第二幕：宫廷宴会偶遇仇人之子',
    hint: '\ud83d\udca1 可以输入关键词、故事大纲、创意描述，AI 会根据你的输入扩展生成完整的故事内容',
    startAiWrite: '开始 AI 创作',
    cancel: '取消',
  },
};

// --- Helpers ---
function timeAgo(ts) {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  const hr = Math.floor(diff / 3600000);
  const day = Math.floor(diff / 86400000);
  if (min < 1) return '刚刚';
  if (min < 60) return min + '分钟前';
  if (hr < 24) return hr + '小时前';
  return day + '天前';
}

function el(tag, attrs, children) {
  attrs = attrs || {};
  children = children || [];
  var e = document.createElement(tag);
  for (var k in attrs) {
    if (!attrs.hasOwnProperty(k)) continue;
    var v = attrs[k];
    if (k === 'className') e.className = v;
    else if (k === 'innerHTML') e.innerHTML = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
    else e.setAttribute(k, v);
  }
  if (typeof children === 'string') e.innerHTML = children;
  else if (Array.isArray(children)) children.forEach(function(c) { if (c) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
  return e;
}

// --- App Sidebar Layout (global, shown on all pages) ---
function renderAppLayout(activeItem) {
  var layout = el('div', { className: 'home-layout' });

  // --- Left Sidebar ---
  var sidebar = el('aside', { className: 'home-sidebar' });

  // Logo
  var logo = el('a', { className: 'home-sidebar-logo', href: 'index.html' });
  logo.innerHTML =
    '<span class="nav-logo-text">WOOO</span>' +
    '<span class="nav-logo-badge">Beta</span>';
  sidebar.appendChild(logo);

  // Nav items
  var nav = el('nav', { className: 'home-sidebar-nav' });

  // API 配置
  var settingsLink = el('a', { className: 'home-sidebar-item' + (activeItem === 'settings' ? ' active' : ''), href: 'settings.html' });
  settingsLink.innerHTML = icon('settingsHex', 'icon-sm') + '<span>API 配置</span>';
  nav.appendChild(settingsLink);

  // 语言设置
  var langBtn = el('button', { className: 'home-sidebar-item' + (activeItem === 'language' ? ' active' : ''), type: 'button' });
  langBtn.innerHTML = icon('globe', 'icon-sm') + '<span>语言设置</span>' + icon('chevronDown', 'icon-xs');
  nav.appendChild(langBtn);

  // 下载日志
  var logLink = el('a', { className: 'home-sidebar-item' + (activeItem === 'download' ? ' active' : ''), href: '#' });
  logLink.innerHTML = icon('download', 'icon-sm') + '<span>下载日志</span>';
  nav.appendChild(logLink);

  sidebar.appendChild(nav);

  // Sidebar footer (version)
  var footer = el('div', { className: 'home-sidebar-footer' });
  footer.innerHTML = '<span class="home-sidebar-version">v0.4.1</span>';
  sidebar.appendChild(footer);

  layout.appendChild(sidebar);

  // --- Main Area ---
  var mainArea = el('div', { className: 'home-main-area app-scrollbar' });
  layout.appendChild(mainArea);

  return { layout: layout, mainArea: mainArea };
}

// --- Top Navigation ---
function renderTopNav(activeRoute) {
  var nav = el('nav', { className: 'top-nav glass-surface-nav' });

  var left = el('div', { className: 'nav-left' });
  var logo = el('a', { className: 'nav-logo', href: 'index.html' });
  logo.innerHTML =
    '<span class="nav-logo-text">WOOO</span>' +
    '<span class="nav-logo-badge">Beta v0.4.1</span>';
  left.appendChild(logo);
  nav.appendChild(left);

  var center = el('div', { className: 'nav-center' });
  var navItems = [
    { route: 'workspace', label: '工作区', href: 'workspace.html' },
    { route: 'asset-hub', label: '资产中心', href: 'asset-hub.html' },
    { route: 'settings', label: 'API 配置', href: 'settings.html' },
  ];
  navItems.forEach(function(item) {
    var link = el('a', {
      className: 'nav-link ' + (activeRoute === item.route ? 'active' : ''),
      href: item.href,
    });
    link.textContent = item.label;
    center.appendChild(link);
  });
  nav.appendChild(center);

  var right = el('div', { className: 'nav-right' });

  var langBtn = el('button', { className: 'nav-lang-btn' });
  langBtn.innerHTML = '简体中文 ' + icon('chevronDown', 'icon-xs');
  right.appendChild(langBtn);

  var logBtn = el('a', { className: 'nav-link', href: '#' });
  logBtn.textContent = '下载日志';
  right.appendChild(logBtn);

  nav.appendChild(right);

  return nav;
}
