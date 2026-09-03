// ============================================
// Home Page — replicates /zh/home
// ============================================

(function() {
  var app = document.getElementById('app');
  app.innerHTML = '';

  function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // Sidebar layout (global, shown on all pages)
  var layoutData = renderAppLayout();
  var mainArea = layoutData.mainArea;
  app.appendChild(layoutData.layout);

  // --- State ---
  var storyText = '';
  var isCreating = false;
  var createError = null;

  // Episode count
  var episodeCount = 30;
  try {
    var savedEpCount = localStorage.getItem('homeEpisodeCount');
    if (savedEpCount) episodeCount = parseInt(savedEpCount, 10) || 30;
  } catch (e) {}
  var customEpisodeCount = '';
  var episodeDropdownOpen = false;

  // Toolbar selectors
  var selectedStyle = '高品质动画渲染风格';
  var styleDropdownOpen = false;
  var STYLE_OPTIONS = ['高品质动画渲染风格', '写实风格', '二次元风格', '3D卡通风格', '水墨风格'];

  var selectedRatio = '16:9';
  var ratioDropdownOpen = false;
  var RATIO_OPTIONS = ['16:9', '9:16', '1:1', '4:3'];

  // --- Page container ---
  var page = el('div', { className: 'glass-page home-page-root' });

  // Inject keyframe styles (same as original inline <style>)
  var styleEl = document.createElement('style');
  styleEl.textContent = [
    '@keyframes twh-focus-pull {',
    '  0%, 70%, 100% { filter: blur(0px); opacity: 1; }',
    '  75% { filter: blur(3px); opacity: 0.85; }',
    '  80% { filter: blur(1.5px); opacity: 0.9; }',
    '  85% { filter: blur(0.5px); opacity: 0.95; }',
    '  88% { filter: blur(1px); opacity: 0.92; }',
    '  92% { filter: blur(0px); opacity: 1; }',
    '}',
    '@keyframes twh-charIn {',
    '  0% { opacity: 0; transform: translateY(6px) scale(0.8); }',
    '  60% { opacity: 1; transform: translateY(-1px) scale(1.05); }',
    '  100% { opacity: 1; transform: translateY(0) scale(1); }',
    '}',
    '@keyframes twh-hover {',
    '  0%, 100% { transform: translateY(0); }',
    '  50% { transform: translateY(-1.5px); }',
    '}',
    '@keyframes twh-blink {',
    '  0%, 100% { opacity: 1; }',
    '  50% { opacity: 0; }',
    '}',
    '@keyframes breathe-drift-1 {',
    '  0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.5; }',
    '  25% { transform: translate(30px, -20px) scale(1.15); opacity: 0.7; }',
    '  50% { transform: translate(-20px, 15px) scale(0.95); opacity: 0.4; }',
    '  75% { transform: translate(15px, 25px) scale(1.1); opacity: 0.65; }',
    '}',
    '@keyframes breathe-drift-2 {',
    '  0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.45; }',
    '  30% { transform: translate(-25px, 20px) scale(1.2); opacity: 0.7; }',
    '  60% { transform: translate(20px, -15px) scale(0.9); opacity: 0.35; }',
    '  80% { transform: translate(-10px, -25px) scale(1.05); opacity: 0.6; }',
    '}',
    '@keyframes breathe-drift-3 {',
    '  0%, 100% { transform: translate(0, 0) scale(1.05); opacity: 0.4; }',
    '  20% { transform: translate(20px, 15px) scale(0.9); opacity: 0.55; }',
    '  45% { transform: translate(-15px, -20px) scale(1.15); opacity: 0.7; }',
    '  70% { transform: translate(10px, -10px) scale(1); opacity: 0.35; }',
    '}',
    '@keyframes bracket-breathe {',
    '  0%, 70%, 100% { opacity: 0.2; }',
    '  75%, 90% { opacity: 0.6; }',
    '}',
  ].join('\n');
  page.appendChild(styleEl);

  // --- Main hero section ---
  var mainEl = el('main', { className: 'home-main' });

  var heroWrap = el('div', { className: 'home-hero-section' });

  // Corner brackets
  ['tl', 'tr', 'bl', 'br'].forEach(function(pos) {
    heroWrap.appendChild(el('span', { className: 'home-corner ' + pos }));
  });

  // REC indicator
  var rec = el('span', { className: 'home-rec-indicator' });
  rec.innerHTML =
    '<span class="home-rec-dot"></span>' +
    '<span class="home-rec-text">REC</span>';
  heroWrap.appendChild(rec);

  // Typewriter title
  var titleWrap = el('div', { className: 'home-title-wrap' });
  var h1 = el('h1', { className: 'home-title-h1' });
  h1.textContent = t.home.title;
  titleWrap.appendChild(h1);

  var subtitleP = el('p', { className: 'home-subtitle' });
  var prefix = el('span', { className: 'home-subtitle-prefix' });
  prefix.textContent = '>_';
  subtitleP.appendChild(prefix);

  var textContainer = el('span', { className: 'home-subtitle-text' });
  subtitleP.appendChild(textContainer);

  var cursor = el('span', { className: 'home-subtitle-cursor' });
  subtitleP.appendChild(cursor);
  titleWrap.appendChild(subtitleP);
  heroWrap.appendChild(titleWrap);

  // --- Input area ---
  var inputGroup = el('div', { className: 'home-input-group' });

  // Glow divs
  var glow1 = el('div', { className: 'home-glow home-glow-1' });
  var glow2 = el('div', { className: 'home-glow home-glow-2' });
  var glow3 = el('div', { className: 'home-glow home-glow-3' });
  inputGroup.appendChild(glow1);
  inputGroup.appendChild(glow2);
  inputGroup.appendChild(glow3);

  // Input card
  var inputCard = el('div', { className: 'home-input-card' });

  // Textarea
  var textarea = el('textarea', {
    className: 'home-textarea',
    placeholder: t.home.inputPlaceholder,
    id: 'story-input',
  });
  textarea.addEventListener('input', function(e) {
    storyText = e.target.value;
    if (createError) { createError = null; renderToolbar(); renderError(); }
  });
  inputCard.appendChild(textarea);

  // Toolbar row (style / ratio / episode count + start creation button)
  var toolbarRow = el('div', { className: 'home-input-toolbar', id: 'home-toolbar' });
  inputCard.appendChild(toolbarRow);

  // Error area
  var errorArea = el('div', { id: 'home-error-area' });
  inputCard.appendChild(errorArea);

  inputGroup.appendChild(inputCard);
  heroWrap.appendChild(inputGroup);
  mainEl.appendChild(heroWrap);
  page.appendChild(mainEl);

  // --- Recent projects section ---
  var recentSection = el('section', { className: 'recent-section' });
  page.appendChild(recentSection);

  mainArea.appendChild(page);

  // --- Render functions ---

  function renderError() {
    errorArea.innerHTML = '';
    if (createError) {
      var errBox = el('p', { className: 'home-error-box' });
      errBox.textContent = createError;
      errorArea.appendChild(errBox);
    }
  }

  function renderToolbar() {
    toolbarRow.innerHTML = '';

    // Left group: selectors
    var selectorsGroup = el('div', { className: 'home-toolbar-selectors' });

    // Style dropdown
    selectorsGroup.appendChild(renderSelectorDropdown({
      key: 'style',
      icon: icon('sparkles', 'icon-sm'),
      value: selectedStyle,
      open: styleDropdownOpen,
      options: STYLE_OPTIONS,
      onToggle: function() { styleDropdownOpen = !styleDropdownOpen; renderToolbar(); },
      onSelect: function(v) { selectedStyle = v; styleDropdownOpen = false; renderToolbar(); }
    }));

    // Ratio dropdown
    selectorsGroup.appendChild(renderSelectorDropdown({
      key: 'ratio',
      icon: icon('maximize', 'icon-sm'),
      value: selectedRatio,
      open: ratioDropdownOpen,
      options: RATIO_OPTIONS,
      onToggle: function() { ratioDropdownOpen = !ratioDropdownOpen; renderToolbar(); },
      onSelect: function(v) { selectedRatio = v; ratioDropdownOpen = false; renderToolbar(); }
    }));

    // Episode count dropdown
    selectorsGroup.appendChild(renderEpisodeDropdown());

    toolbarRow.appendChild(selectorsGroup);

    // Spacer
    toolbarRow.appendChild(el('div', { className: 'home-toolbar-spacer' }));

    // Start creation button
    var startBtn = el('button', {
      className: 'glass-btn-base glass-btn-primary home-start-btn',
      type: 'button',
      onclick: function() { handleStartCreation(); },
    });
    startBtn.disabled = !storyText.trim() || isCreating;
    startBtn.innerHTML = isCreating
      ? '<span class="loading-spinner"></span><span>' + t.home.loading + '</span>'
      : '<span>' + t.home.startCreation + '</span>';
    toolbarRow.appendChild(startBtn);

    // Close any open dropdown when clicking outside
    var anyOpen = styleDropdownOpen || ratioDropdownOpen || episodeDropdownOpen;
    if (anyOpen) {
      setTimeout(function() {
        var closeHandler = function(e) {
          if (!e.target.closest('.home-toolbar-dropdown')) {
            styleDropdownOpen = false;
            ratioDropdownOpen = false;
            episodeDropdownOpen = false;
            renderToolbar();
            document.removeEventListener('click', closeHandler);
          }
        };
        document.addEventListener('click', closeHandler);
      }, 0);
    }
  }

  function renderSelectorDropdown(opts) {
    var wrap = el('div', { className: 'home-toolbar-dropdown' + (opts.open ? ' open' : '') + ' home-toolbar-dropdown-' + opts.key });
    var toggle = el('button', {
      className: 'home-toolbar-btn home-toolbar-dropdown-toggle',
      type: 'button',
      onclick: function(e) {
        e.stopPropagation();
        styleDropdownOpen = false;
        ratioDropdownOpen = false;
        episodeDropdownOpen = false;
        if (opts.key === 'style') styleDropdownOpen = !opts.open;
        if (opts.key === 'ratio') ratioDropdownOpen = !opts.open;
        renderToolbar();
      }
    });
    toggle.innerHTML = opts.icon + '<span class="home-toolbar-value">' + escapeHtml(opts.value) + '</span>' + icon('chevronDown', 'icon-xs');
    wrap.appendChild(toggle);

    var menu = el('div', { className: 'home-toolbar-dropdown-menu' });
    opts.options.forEach(function(opt) {
      var item = el('button', {
        className: 'home-toolbar-dropdown-item' + (opts.value === opt ? ' active' : ''),
        type: 'button',
        onclick: function(e) {
          e.stopPropagation();
          opts.onSelect(opt);
        }
      });
      item.innerHTML = (opts.value === opt ? icon('check', 'icon-sm') : '<span class="home-toolbar-check-placeholder"></span>') + '<span>' + escapeHtml(opt) + '</span>';
      menu.appendChild(item);
    });
    wrap.appendChild(menu);
    return wrap;
  }

  function renderEpisodeDropdown() {
    var wrap = el('div', { className: 'home-toolbar-dropdown' + (episodeDropdownOpen ? ' open' : '') + ' home-toolbar-dropdown-episode' });
    var toggle = el('button', {
      className: 'home-toolbar-btn home-toolbar-dropdown-toggle',
      type: 'button',
      onclick: function(e) {
        e.stopPropagation();
        styleDropdownOpen = false;
        ratioDropdownOpen = false;
        episodeDropdownOpen = !episodeDropdownOpen;
        renderToolbar();
      }
    });
    toggle.innerHTML = '<span class="home-toolbar-value">' + episodeCount + ' 集</span>' + icon('chevronDown', 'icon-xs');
    wrap.appendChild(toggle);

    var menu = el('div', { className: 'home-toolbar-dropdown-menu' });
    var EPISODE_OPTIONS = [5, 10, 30, 60, 80, 100];
    EPISODE_OPTIONS.forEach(function(n) {
      var item = el('button', {
        className: 'home-toolbar-dropdown-item' + (episodeCount === n ? ' active' : ''),
        type: 'button',
        onclick: function(e) {
          e.stopPropagation();
          episodeCount = n;
          customEpisodeCount = '';
          episodeDropdownOpen = false;
          try { localStorage.setItem('homeEpisodeCount', episodeCount); } catch (err) {}
          renderToolbar();
        }
      });
      item.innerHTML = (episodeCount === n ? icon('check', 'icon-sm') : '<span class="home-toolbar-check-placeholder"></span>') + '<span>' + n + ' 集</span>';
      menu.appendChild(item);
    });

    // Custom option
    var customItem = el('div', { className: 'home-toolbar-dropdown-item home-toolbar-dropdown-custom' + (EPISODE_OPTIONS.indexOf(episodeCount) === -1 ? ' active' : '') });
    customItem.innerHTML = (EPISODE_OPTIONS.indexOf(episodeCount) === -1 ? icon('check', 'icon-sm') : '<span class="home-toolbar-check-placeholder"></span>') + '<span>自定义</span>' +
      '<input type="number" class="home-toolbar-custom-input" placeholder="集" value="' + (EPISODE_OPTIONS.indexOf(episodeCount) === -1 ? episodeCount : customEpisodeCount) + '" min="1" max="999" />';
    var customInput = customItem.querySelector('.home-toolbar-custom-input');
    customInput.addEventListener('click', function(e) { e.stopPropagation(); });
    customInput.addEventListener('input', function(e) {
      var val = parseInt(e.target.value, 10);
      if (val && val > 0) {
        episodeCount = val;
        customEpisodeCount = val;
        try { localStorage.setItem('homeEpisodeCount', episodeCount); } catch (err) {}
        renderToolbar();
      }
    });
    customInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        episodeDropdownOpen = false;
        renderToolbar();
      }
    });
    menu.appendChild(customItem);

    wrap.appendChild(menu);
    return wrap;
  }

  function renderRecentProjects() {
    recentSection.innerHTML = '';

    // Header
    var header = el('div', { className: 'recent-header' });
    var h2 = el('h2');
    h2.textContent = t.home.recentProjects;
    header.appendChild(h2);
    var viewAll = el('a', { className: 'recent-view-all', href: 'workspace.html' });
    viewAll.textContent = t.home.viewAll;
    header.appendChild(viewAll);
    recentSection.appendChild(header);

    // Grid
    var grid = el('div', { className: 'projects-grid' });

    if (state.projects.length === 0) {
      // Empty state
      var empty = el('div', { className: 'home-empty-state' });
      empty.innerHTML =
        '<div class="home-empty-icon">' + icon('folderCards') + '</div>' +
        '<p class="home-empty-text">' + t.home.noProjects + '</p>';
      recentSection.appendChild(empty);
      return;
    }

    state.projects.forEach(function(p) {
      var card = el('a', {
        className: 'project-card glass-surface',
        href: 'episodes.html',
      });

      var stats = p.stats || {};
      var hasStats = stats.episodes > 0 || stats.images > 0 || stats.videos > 0;

      card.innerHTML =
        '<div class="card-overlay"></div>' +
        '<div class="card-content">' +
          '<h3>' + p.name + '</h3>' +
          (p.description ? (
            '<div class="card-desc">' +
              icon('fileText', 'icon-xs') +
              '<p>' + p.description + '</p>' +
            '</div>'
          ) : '') +
          (hasStats ? (
            '<div class="card-stats">' +
              icon('statsBar', 'icon-sm') +
              '<div class="stat-gradient">' +
                (stats.episodes > 0 ? '<span class="stat-item">' + icon('episode', 'icon-xs') + ' ' + stats.episodes + '</span>' : '') +
                (stats.images > 0 ? '<span class="stat-item">' + icon('imageIcon', 'icon-xs') + ' ' + stats.images + '</span>' : '') +
                (stats.videos > 0 ? '<span class="stat-item">' + icon('videoIcon', 'icon-xs') + ' ' + stats.videos + '</span>' : '') +
              '</div>' +
            '</div>'
          ) : '') +
          '<div class="card-time">' +
            icon('clock', 'icon-xs') +
            timeAgo(p.updatedAt) +
          '</div>' +
        '</div>';

      grid.appendChild(card);
    });

    recentSection.appendChild(grid);
  }

  function handleStartCreation() {
    var text = storyText.trim();
    if (!text || isCreating) return;
    isCreating = true;
    createError = null;
    renderToolbar();
    renderError();
    // Persist settings and navigate
    try {
      localStorage.setItem('homeEpisodeCount', episodeCount);
      localStorage.setItem('projectEpisodeCount', episodeCount);
      localStorage.setItem('projectStyle', selectedStyle);
      localStorage.setItem('projectRatio', selectedRatio);
    } catch (e) {}
    setTimeout(function() {
      isCreating = false;
      window.location.href = 'episodes.html';
    }, 800);
  }

  // --- Typewriter with per-character animation ---
  var twState = { text: '', deleting: false, prevLen: 0 };
  var subtitleText = t.home.subtitle;

  function typewriterStep() {
    var s = twState;
    s.prevLen = s.text.length;

    if (s.deleting || s.text.length !== subtitleText.length) {
      if (s.deleting && s.text.length === 0) {
        setTimeout(function() { s.deleting = false; typewriterStep(); }, 500);
        return;
      }
      s.text = subtitleText.slice(0, s.text.length + (s.deleting ? -1 : 1));
      renderTypewriter();
      setTimeout(typewriterStep, s.deleting ? 20 : 55);
    } else {
      setTimeout(function() { s.deleting = true; typewriterStep(); }, 3200);
    }
  }

  function renderTypewriter() {
    textContainer.innerHTML = '';
    var s = twState;
    var chars = s.text.split('');

    chars.forEach(function(ch, i) {
      var isNewChar = !s.deleting && i === s.text.length - 1 && s.text.length > s.prevLen;
      var span = el('span', { className: 'home-tw-char' });

      if (isNewChar) {
        span.style.animationName = 'twh-charIn';
        span.style.animationDuration = '0.25s';
        span.style.animationTimingFunction = 'ease-out';
        span.style.animationIterationCount = '1';
        span.style.animationFillMode = 'forwards';
        span.style.animationDelay = '0s';
      } else {
        span.style.animationName = 'twh-hover';
        span.style.animationDuration = '3s';
        span.style.animationTimingFunction = 'ease-in-out';
        span.style.animationIterationCount = 'infinite';
        span.style.animationFillMode = 'none';
        span.style.animationDelay = (0.08 * i) + 's';
      }

      span.textContent = ch === ' ' ? '\u00a0' : ch;
      textContainer.appendChild(span);
    });
  }

  // --- Initial render ---
  renderToolbar();
  renderError();
  renderRecentProjects();

  // Start typewriter
  setTimeout(typewriterStep, 300);
})();
