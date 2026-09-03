// ============================================
// Editor Story Page (stage = config / 故事)
// ============================================

(function() {
  var EC = EditorCommon;
  var page = EC.init('config');
  var contentWrap = page.contentWrap;

  renderConfigStage();

  // ============================================
  // CONFIG STAGE — story input has been moved to episodes.html
  // This page now shows a redirect hint
  // ============================================
  function renderConfigStage() {
    contentWrap.innerHTML = '';
    var view = el('div', { className: 'config-stage' });

    var html = '<div class="config-stage-inner">';

    html += '<div class="config-episode-header">' +
      '<div class="config-episode-name">故事输入已移至剧集页面</div>' +
      '<div class="config-episode-tip">请在剧集列表页面选择剧集并输入故事内容</div>' +
    '</div>';

    html += '<div class="glass-surface" style="text-align:center;padding:40px 24px;border-radius:var(--glass-radius-lg);">' +
      '<div style="margin-bottom:16px;opacity:.5;">' + icon('fileText', 'icon-lg') + '</div>' +
      '<p style="font-size:14px;color:var(--glass-text-secondary);line-height:1.6;margin-bottom:20px;">' +
        '故事输入功能已整合到剧集列表页面，您可以在那里选择剧集并直接输入故事内容，' +
        '同时配置项目级别的画面比例和画面风格。' +
      '</p>' +
      '<a href="episodes.html" class="glass-btn-base glass-btn-primary" style="display:inline-flex;align-items:center;gap:6px;text-decoration:none;">' +
        icon('back') + '<span>返回剧集列表</span>' +
      '</a>' +
    '</div>';

    html += '</div>'; // config-stage-inner

    view.innerHTML = html;
    contentWrap.appendChild(view);
  }
})();
