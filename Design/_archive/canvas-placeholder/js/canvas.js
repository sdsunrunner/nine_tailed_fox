// ============================================
// Infinite Canvas (无限画布占位页)
// 规划中:正式版基于 tldraw 实现
// 本页为交互示意:相机缩放/平移、节点模型、连线关系、属性面板
// ============================================

(function() {

  // ---------- 节点类型定义 ----------
  var NODE_TYPES = {
    script:     { label: '剧本',     color: '#2f7bff', icon: 'fileText' },
    storyboard: { label: '分镜',     color: '#06b6d4', icon: 'clapperboard' },
    image:      { label: '图片',     color: '#8b5cf6', icon: 'image' },
    video:      { label: '视频',     color: '#ec4899', icon: 'video' },
    character:  { label: '角色卡',   color: '#f59e0b', icon: 'user' },
    prompt:     { label: '提示词',   color: '#10b981', icon: 'wand' },
  };

  var STATUS_MAP = { done: '已完成', generating: '生成中', queued: '排队中' };

  // ---------- 数据模型(世界坐标,画布 2600x1600) ----------
  var GROUPS = [
    { id: 'g1', title: '场景一 · 清晨卧室', x: 160, y: 140, w: 700, h: 420 },
    { id: 'g2', title: '场景二 · 阳光厨房', x: 980, y: 140, w: 700, h: 420 },
  ];

  var NODES = [
    { id: 'script',  type: 'script',     x: 200,  y: 210, w: 200, title: '第一幕 · 命运的开始', sub: '第 1 集 · 清晨卧室',        status: 'done',       meta: '剧本片段', desc: '少年从床上惊醒，床头的古铜怀表指针开始倒转。窗外晨光微亮，新的一天却与昨天不同……(前 400 字摘要)' },
    { id: 'sb1',     type: 'storyboard', x: 470,  y: 210, w: 210, title: '分镜 001 · 阳光洒进房间', sub: '3s · 9:16 · 特写',       status: 'done',       meta: '3s · 9:16', desc: '清晨阳光透过薄纱窗帘洒进卧室，金色光线中浮尘飘舞。床上被子凌乱，闹钟指向 8:00。' },
    { id: 'img1',    type: 'image',      x: 300,  y: 400, w: 210, title: '场景概念图 · 卧室', sub: 'flux · 9:16 · 清晨',          status: 'generating', meta: '68%',     desc: '基于分镜 001 生成场景概念图，引用角色卡「林晓」保持画风与形象一致。' },
    { id: 'img2',    type: 'image',      x: 1020, y: 210, w: 210, title: '场景概念图 · 厨房', sub: 'flux · 9:16 · 暖光',          status: 'done',       meta: '已生成',   desc: '厨房暖光氛围，妈妈背对镜头煎鸡蛋，热气升腾，阳光从窗户照入。' },
    { id: 'prompt',  type: 'prompt',     x: 1100, y: 410, w: 280, title: '提示词 · 厨房晨光', sub: '镜头运动：缓慢推进 · 光线：暖色侧光', status: 'done', meta: 'v1', desc: '妈妈背对镜头煎鸡蛋，热气升腾，阳光从窗户照入。温馨氛围，慢推镜头，暖色侧光。' },
    { id: 'video1',  type: 'video',      x: 1300, y: 210, w: 230, title: '镜头 003 · 妈妈做早餐', sub: 'kling-v2 · 4s · 9:16',    status: 'queued',     meta: '4s · 9:16', desc: '由厨房概念图 + 提示词驱动生成，引用角色卡保证形象一致性。' },
    { id: 'char1',   type: 'character',  x: 1780, y: 200, w: 200, title: '角色卡 · 林晓', sub: '17 岁 · 校服 · 黑长直',            status: 'done',       meta: '主角',     desc: '少女立绘 + 多角度参考图，用于所有涉及林晓的画面生成，保证角色一致性。' },
    { id: 'char2',   type: 'character',  x: 1780, y: 450, w: 200, title: '角色卡 · 陈宇', sub: '18 岁 · 阳光开朗',                  status: 'done',       meta: '主角',     desc: '少年立绘 + 表情集，用于所有涉及陈宇的画面生成，保证角色一致性。' },
    { id: 'sb2',     type: 'storyboard', x: 520,  y: 650, w: 220, title: '分镜 004 · 妈妈做早餐', sub: '4s · 9:16 · 中景',         status: 'queued',     meta: '4s · 9:16', desc: '厨房中景，妈妈在灶台前忙碌，暖色调，漫画风格。' },
    { id: 'video2',  type: 'video',      x: 1000, y: 660, w: 250, title: '第一集 · 粗剪成片', sub: '汇总全部镜头 · 9:16',            status: 'queued',     meta: '待合成',   desc: '按时间轴汇总所有已生成镜头，输出第一集成片。' },
  ];

  // kind: gen = 生成关系(蓝实线) / ref = 引用参考(紫虚线)
  var EDGES = [
    { from: 'script', to: 'sb1',    kind: 'gen', label: '剧本 → 分镜' },
    { from: 'sb1',    to: 'img1',   kind: 'gen', label: '分镜 → 概念图' },
    { from: 'char1',  to: 'img1',   kind: 'ref', label: '角色参考' },
    { from: 'img2',   to: 'video1', kind: 'gen', label: '概念图 → 镜头' },
    { from: 'prompt', to: 'video1', kind: 'gen', label: '提示词 → 镜头' },
    { from: 'char1',  to: 'video1', kind: 'ref', label: '一致性参考' },
    { from: 'video1', to: 'video2', kind: 'gen', label: '镜头 → 成片' },
  ];

  // ---------- 布局 ----------
  var layout = renderAppLayout();
  document.getElementById('app').appendChild(layout.layout);
  var mainArea = layout.mainArea;
  mainArea.style.overflow = 'hidden';
  mainArea.style.display = 'flex';
  mainArea.style.flexDirection = 'column';

  var container = el('div', { className: 'canvas-container', id: 'canvas-container' });

  var worldEl = el('div', { className: 'canvas-world', id: 'canvas-world' });
  var gridMinor = el('div', { className: 'canvas-grid' });
  var gridMajor = el('div', { className: 'canvas-grid major' });
  var svgEl = el('svg', { className: 'canvas-svg', id: 'canvas-svg', viewBox: '0 0 2600 1600' });
  svgEl.setAttribute('width', '2600');
  svgEl.setAttribute('height', '1600');
  worldEl.appendChild(gridMinor);
  worldEl.appendChild(gridMajor);
  worldEl.appendChild(svgEl);

  var nodeById = {};
  NODES.forEach(function(n) { nodeById[n.id] = n; });

  // ---------- 顶栏 ----------
  var topbar = el('div', { className: 'canvas-topbar' });

  var backBtn = el('a', { className: 'stage-toolbar-btn icon-only', href: 'episodes.html', style: { marginRight: '2px' } });
  backBtn.innerHTML = icon('back');
  topbar.appendChild(backBtn);

  var crumb = el('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--glass-text-secondary)' } });
  crumb.innerHTML = '<a href="episodes.html" style="color:var(--glass-text-tertiary);text-decoration:none;">校园青春物语</a>' +
    '<span class="canvas-breadcrumb-sep">/</span>' +
    '<span style="font-weight:600;color:var(--glass-text-primary);">第一集 · 命运的怀表</span>';
  topbar.appendChild(crumb);

  var topTitle = el('div', { className: 'canvas-topbar-title', style: { marginLeft: '16px' } });
  topTitle.innerHTML = icon('layers') + '<span>无限画布</span>';
  topbar.appendChild(topTitle);

  var badge = el('span', { className: 'canvas-topbar-badge' });
  badge.textContent = '规划中';
  topbar.appendChild(badge);

  topbar.appendChild(el('div', { className: 'canvas-topbar-spacer' }));

  var topRight = el('div', { className: 'canvas-topbar-right' });
  var refreshBtn = el('button', { className: 'stage-toolbar-btn icon-only', onclick: function() { resetView(); toast('视图已重置'); } });
  refreshBtn.innerHTML = icon('refresh');
  topRight.appendChild(refreshBtn);

  var assetBtn = el('a', { className: 'stage-toolbar-btn secondary', href: 'asset-hub.html' });
  assetBtn.innerHTML = icon('library', 'icon-sm') + '<span>资产库</span>';
  topRight.appendChild(assetBtn);

  var settingsBtn = el('button', { className: 'stage-toolbar-btn icon-only', onclick: function() { toast('画布设置将在正式版本开放'); } });
  settingsBtn.innerHTML = icon('settings');
  topRight.appendChild(settingsBtn);

  topbar.appendChild(topRight);
  mainArea.appendChild(topbar);

  // ---------- 浮层:soon 标识 / 图例 / hint / 缩放控件 / inspector ----------
  var soonFloat = el('div', { className: 'canvas-soon-float' });
  soonFloat.innerHTML = '<span class="dot"></span>无限画布 · 基于 tldraw 实现 · 交互示意';
  container.appendChild(soonFloat);

  var legend = el('div', { className: 'canvas-legend' });
  var legendHtml = '<div class="canvas-legend-title">节点类型</div>';
  Object.keys(NODE_TYPES).forEach(function(k) {
    var nt = NODE_TYPES[k];
    legendHtml += '<div class="canvas-legend-item"><span class="canvas-legend-swatch" style="background:' + nt.color + ';"></span>' + nt.label + '</div>';
  });
  legendHtml += '<div class="canvas-legend-title" style="margin-top:6px;">连线关系</div>' +
    '<div class="canvas-legend-item"><span class="canvas-legend-line"><span class="l"></span></span>生成关系</div>' +
    '<div class="canvas-legend-item"><span class="canvas-legend-line"><span class="l ref"></span></span>引用参考</div>';
  legend.innerHTML = legendHtml;
  container.appendChild(legend);

  var hint = el('div', { className: 'canvas-hint' });
  hint.innerHTML = '<span><kbd>滚轮</kbd> 缩放</span><span><kbd>拖拽</kbd> 平移画布</span><span><kbd>双击</kbd> 重置视图</span><span><kbd>点击节点</kbd> 查看属性</span>';
  container.appendChild(hint);

  var zoomControls = el('div', { className: 'canvas-zoom-controls' });
  var zoomOutBtn = el('button', { className: 'canvas-zoom-btn', onclick: function() { zoomAtCenter(1 / 1.25); } });
  zoomOutBtn.textContent = '\u2212';
  var zoomLabel = el('span', { className: 'canvas-zoom-label', id: 'canvas-zoom-label' });
  var zoomInBtn = el('button', { className: 'canvas-zoom-btn', onclick: function() { zoomAtCenter(1.25); } });
  zoomInBtn.textContent = '+';
  var fitBtn = el('button', { className: 'canvas-zoom-btn', onclick: fitView, style: { color: 'var(--glass-tone-info-fg)' } });
  fitBtn.innerHTML = icon('maximize', 'icon-sm');
  zoomControls.appendChild(zoomOutBtn);
  zoomControls.appendChild(zoomLabel);
  zoomControls.appendChild(zoomInBtn);
  zoomControls.appendChild(fitBtn);
  container.appendChild(zoomControls);

  var inspector = el('div', { className: 'canvas-inspector', id: 'canvas-inspector' });
  container.appendChild(inspector);

  mainArea.appendChild(container);

  // ---------- 渲染节点 ----------
  function renderNode(n) {
    var nt = NODE_TYPES[n.type];
    var div = el('div', {
      className: 'canvas-node' + (n.selected ? ' selected' : ''),
      id: 'node-' + n.id,
      style: { left: n.x + 'px', top: n.y + 'px', width: n.w + 'px' },
    });

    var previewHtml = '';
    if (n.type === 'image') {
      previewHtml = '<div class="canvas-node-preview" style="background:linear-gradient(135deg,#a78bfa,#6d28d9);">' +
        (n.status === 'generating' ? '<div class="preview-spinner"></div><span class="preview-label">生成中 ' + n.meta + '</span>' : icon('image')) + '</div>';
    } else if (n.type === 'video') {
      previewHtml = '<div class="canvas-node-preview" style="background:linear-gradient(135deg,#1e293b,#0b1220);">' +
        (n.status === 'done' ? '<span class="preview-play">' + icon('play') + '</span>' : (n.status === 'generating' ? '<div class="preview-spinner"></div>' : icon('clock', 'icon-sm'))) +
        '<span class="preview-label">' + n.meta + '</span></div>';
    } else if (n.type === 'storyboard') {
      previewHtml = '<div class="canvas-node-preview" style="background:linear-gradient(135deg,#22d3ee,#0891b2);">' + icon('clapperboard') + '</div>';
    } else if (n.type === 'character') {
      previewHtml = '<div class="canvas-node-preview" style="background:linear-gradient(135deg,#fbbf24,#d97706);">' + icon('user') + '</div>';
    }

    div.innerHTML =
      '<div class="canvas-node-head">' +
        '<span class="canvas-node-type" style="background:' + nt.color + ';">' + icon(nt.icon) + '</span>' +
        '<div class="canvas-node-titles">' +
          '<div class="canvas-node-title">' + n.title + '</div>' +
          '<div class="canvas-node-sub">' + n.sub + '</div>' +
        '</div>' +
      '</div>' +
      previewHtml +
      '<div class="canvas-node-footer">' +
        '<span class="canvas-node-meta">' + n.meta + '</span>' +
        '<span class="canvas-node-status ' + n.status + '"><span class="dot"></span>' + STATUS_MAP[n.status] + '</span>' +
      '</div>';

    // 连线端口:有出边显示底部端口,有入边显示顶部端口
    var hasOut = false, hasRefIn = false, hasGenIn = false;
    EDGES.forEach(function(e) {
      if (e.from === n.id) hasOut = true;
      if (e.to === n.id) { if (e.kind === 'ref') hasRefIn = true; else hasGenIn = true; }
    });
    if (hasOut) div.appendChild(el('span', { className: 'canvas-node-port out' }));
    if (hasRefIn || hasGenIn) {
      div.appendChild(el('span', { className: 'canvas-node-port in' + (hasRefIn && !hasGenIn ? ' ref' : '') }));
    }

    div.addEventListener('click', function(e) {
      e.stopPropagation();
      selectNode(n.id);
    });
    div.addEventListener('dblclick', function(e) { e.stopPropagation(); });
    worldEl.appendChild(div);
  }

  NODES.forEach(renderNode);

  // ---------- 渲染分组 ----------
  GROUPS.forEach(function(g) {
    var gEl = el('div', { className: 'canvas-group', style: { left: g.x + 'px', top: g.y + 'px', width: g.w + 'px', height: g.h + 'px' } });
    gEl.innerHTML = '<div class="canvas-group-title">' + icon('folder') + '<span>' + g.title + '</span>' +
      '<span class="count">' + NODES.filter(function(n) { return n.x >= g.x && n.x <= g.x + g.w && n.y >= g.y && n.y <= g.y + g.h; }).length + ' 个节点</span></div>';
    worldEl.appendChild(gEl);
  });

  // ---------- 渲染连线 ----------
  function edgePath(n1, n2) {
    var ax = n1.x + n1.w / 2, ay = n1.y + n1.h;
    var bx = n2.x + n2.w / 2, by = n2.y;
    var midY = (ay + by) / 2;
    return { d: 'M' + ax + ',' + ay + ' C' + ax + ',' + midY + ' ' + bx + ',' + midY + ' ' + bx + ',' + by, cx: (ax + bx) / 2, cy: midY };
  }

  EDGES.forEach(function(e) {
    var n1 = nodeById[e.from], n2 = nodeById[e.to];
    if (!n1 || !n2) return;
    var p = edgePath(n1, n2);
    var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', p.d);
    path.setAttribute('class', e.kind === 'ref' ? 'canvas-edge-ref' : 'canvas-edge');
    svgEl.appendChild(path);

    var dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    dot.setAttribute('cx', n2.x + n2.w / 2);
    dot.setAttribute('cy', n2.y);
    dot.setAttribute('r', '4');
    dot.setAttribute('class', 'canvas-edge-dot' + (e.kind === 'ref' ? ' ref' : ''));
    svgEl.appendChild(dot);

    var lbl = el('div', { className: 'canvas-edge-label', style: { left: (p.cx - 34) + 'px', top: (p.cy - 11) + 'px' } });
    lbl.textContent = e.label;
    worldEl.appendChild(lbl);
  });

  container.appendChild(worldEl);

  // ---------- 相机 ----------
  var camera = { x: 0, y: 0, scale: 1 };
  var MIN_SCALE = 0.2, MAX_SCALE = 2.5;

  function applyTransform() {
    worldEl.style.transform = 'translate(' + camera.x + 'px, ' + camera.y + 'px) scale(' + camera.scale + ')';
    var pct = Math.round(camera.scale * 100);
    zoomLabel.textContent = pct + '%';
  }

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  function zoomAt(sx, sy, factor) {
    var wx = (sx - camera.x) / camera.scale;
    var wy = (sy - camera.y) / camera.scale;
    camera.scale = clamp(camera.scale * factor, MIN_SCALE, MAX_SCALE);
    camera.x = sx - wx * camera.scale;
    camera.y = sy - wy * camera.scale;
    applyTransform();
  }

  function zoomAtCenter(factor) {
    var rect = container.getBoundingClientRect();
    zoomAt(rect.width / 2, rect.height / 2, factor);
  }

  function fitView() {
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    GROUPS.forEach(function(g) {
      minX = Math.min(minX, g.x); minY = Math.min(minY, g.y);
      maxX = Math.max(maxX, g.x + g.w); maxY = Math.max(maxY, g.y + g.h);
    });
    NODES.forEach(function(n) {
      minX = Math.min(minX, n.x); minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x + n.w); maxY = Math.max(maxY, n.y + n.h);
    });
    var pad = 80;
    var bw = (maxX - minX) + pad * 2, bh = (maxY - minY) + pad * 2;
    var rect = container.getBoundingClientRect();
    camera.scale = clamp(Math.min(rect.width / bw, rect.height / bh) * 0.92, MIN_SCALE, MAX_SCALE);
    camera.x = (rect.width - (maxX + minX) * camera.scale) / 2;
    camera.y = (rect.height - (maxY + minY) * camera.scale) / 2;
    applyTransform();
  }

  function resetView() {
    var rect = container.getBoundingClientRect();
    camera.scale = 0.7;
    camera.x = rect.width / 2 - 560 * camera.scale;
    camera.y = rect.height / 2 - 360 * camera.scale;
    applyTransform();
  }

  // 滚轮缩放(以鼠标为锚点)
  container.addEventListener('wheel', function(e) {
    e.preventDefault();
    var rect = container.getBoundingClientRect();
    var factor = e.deltaY > 0 ? 0.88 : 1.14;
    zoomAt(e.clientX - rect.left, e.clientY - rect.top, factor);
  }, { passive: false });

  // 拖拽平移
  var dragging = null;
  container.addEventListener('mousedown', function(e) {
    if (e.button !== 0) return;
    if (e.target.closest('.canvas-node')) return;
    dragging = { x: e.clientX, y: e.clientY, ox: camera.x, oy: camera.y };
    container.classList.add('dragging');
  });
  window.addEventListener('mousemove', function(e) {
    if (!dragging) return;
    camera.x = dragging.ox + (e.clientX - dragging.x);
    camera.y = dragging.oy + (e.clientY - dragging.y);
    applyTransform();
  });
  window.addEventListener('mouseup', function() {
    if (dragging) { dragging = null; container.classList.remove('dragging'); }
  });

  // 双击空白重置
  container.addEventListener('dblclick', function(e) {
    if (e.target.closest('.canvas-node')) return;
    resetView();
    toast('视图已重置');
  });

  // ---------- 属性面板 ----------
  function selectNode(id) {
    var prev = NODES.filter(function(n) { return n.selected; });
    prev.forEach(function(n) { n.selected = false; });
    var node = nodeById[id];
    node.selected = true;
    document.querySelectorAll('.canvas-node.selected').forEach(function(d) { d.classList.remove('selected'); });
    var dom = document.getElementById('node-' + id);
    if (dom) dom.classList.add('selected');
    renderInspector(node);
  }

  function renderInspector(n) {
    var nt = NODE_TYPES[n.type];
    var html = '';
    if (n) {
      html +=
        '<div class="canvas-inspector-head">' +
          '<div class="canvas-inspector-title"><span class="canvas-node-type" style="width:22px;height:22px;border-radius:6px;display:inline-flex;align-items:center;justify-content:center;background:' + nt.color + ';color:#fff;">' + icon(nt.icon, 'icon-sm') + '</span>' + n.title + '</div>' +
          '<button class="canvas-inspector-close" id="inspector-close">' + icon('x', 'icon-sm') + '</button>' +
        '</div>' +
        '<div class="canvas-inspector-row"><span class="k">类型</span><span class="v">' + nt.label + '</span></div>' +
        '<div class="canvas-inspector-row"><span class="k">状态</span><span class="v"><span class="canvas-node-status ' + n.status + '"><span class="dot"></span>' + STATUS_MAP[n.status] + '</span></span></div>' +
        '<div class="canvas-inspector-row"><span class="k">尺寸</span><span class="v">' + n.w + ' × ' + n.h + '</span></div>' +
        '<div class="canvas-inspector-row"><span class="k">坐标</span><span class="v">x=' + n.x + ' y=' + n.y + '</span></div>' +
        '<div class="canvas-inspector-row"><span class="k">元数据</span><span class="v">' + n.meta + '</span></div>' +
        '<div class="canvas-inspector-desc">' + n.desc + '</div>' +
        '<div class="canvas-inspector-note">' + icon('alertTriangle') + '<span>该节点为交互示意。正式版本将支持拖动、编辑、缩放裁剪与连线重组。</span></div>';
    } else {
      var total = NODES.length;
      var done = NODES.filter(function(x) { return x.status === 'done'; }).length;
      var generating = NODES.filter(function(x) { return x.status === 'generating'; }).length;
      var queued = NODES.filter(function(x) { return x.status === 'queued'; }).length;
      html +=
        '<div class="canvas-inspector-head">' +
          '<div class="canvas-inspector-title">' + icon('layers', 'icon-sm') + '画布概览</div>' +
          '<button class="canvas-inspector-close" id="inspector-close">' + icon('x', 'icon-sm') + '</button>' +
        '</div>' +
        '<div class="canvas-inspector-row"><span class="k">节点</span><span class="v">' + total + '</span></div>' +
        '<div class="canvas-inspector-row"><span class="k">连线</span><span class="v">' + EDGES.length + '</span></div>' +
        '<div class="canvas-inspector-row"><span class="k">已完成</span><span class="v">' + done + '</span></div>' +
        '<div class="canvas-inspector-row"><span class="k">生成中</span><span class="v">' + generating + '</span></div>' +
        '<div class="canvas-inspector-row"><span class="k">排队中</span><span class="v">' + queued + '</span></div>' +
        '<div class="canvas-inspector-desc">自由摆放剧本、分镜、图片、视频等 AI 资产，用连线表达「引用 / 生成」关系。节点作为异步任务，带生成中 / 已完成 / 排队中状态。</div>' +
        '<div class="canvas-inspector-note">' + icon('alertTriangle') + '<span>规划基于 tldraw 实现：自定义资产卡片形状 + 引用箭头 + 异步状态机；AI 对话可序列化画布节点与连线作为上下文。</span></div>';
    }
    inspector.innerHTML = html;
    setTimeout(function() {
      var close = document.getElementById('inspector-close');
      if (close) close.addEventListener('click', function() {
        NODES.forEach(function(x) { x.selected = false; });
        document.querySelectorAll('.canvas-node.selected').forEach(function(d) { d.classList.remove('selected'); });
        renderInspector(null);
      });
    }, 0);
  }

  renderInspector(null);

  // ---------- Toast ----------
  var toastEl = null;
  function toast(msg) {
    if (!toastEl) {
      toastEl = el('div', { className: 'canvas-hint', style: { bottom: '64px', opacity: '0', transition: 'opacity .25s' } });
      container.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.style.opacity = '1';
    clearTimeout(toast._t);
    toast._t = setTimeout(function() { toastEl.style.opacity = '0'; }, 1600);
  }

  // 初始视角
  resetView();
})();
