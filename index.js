// slogan-scroller 扩展版：只滚动“当前消息”，带前端设置 UI
// - 可开关滚动
// - 可设置开始滚动延迟（秒）
// - 可设置滚动一圈用时（速度，秒）

(function () {
  const STORAGE_KEY = 'slogan_scroller_cfg_v1';
  const DEFAULT_CFG = {
    enabled: true,      // 是否启用滚动
    delayMs: 0,         // 开始滚动前延迟（毫秒）
    speedSec: 26,       // 滚完一整圈需要的秒数
    debounceMs: 500     // 滚动/窗口变化防抖时间（毫秒）
  };

  // === 配置读写 ===
  let CFG = loadConfig();

  function loadConfig() {
    let cfg = { ...DEFAULT_CFG };
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const saved = JSON.parse(raw);
          Object.assign(cfg, saved || {});
        }
      }
    } catch (e) {
      console.warn('[SloganScroller] loadConfig error', e);
    }
    return cfg;
  }

  function saveConfig() {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(CFG));
      }
    } catch (e) {
      console.warn('[SloganScroller] saveConfig error', e);
    }
  }

  // === 工具函数 ===
  function getSloganFromCss() {
    const rootStyle = getComputedStyle(document.documentElement);
    let s = rootStyle.getPropertyValue('--自定义文案') || '';
    s = s.replace(/^["']|["']$/g, '').trim();
    return s;
  }

  function measureTextWidth(text, pseudoStyle) {
    const span = document.createElement('span');
    span.textContent = text;
    span.style.position = 'absolute';
    span.style.visibility = 'hidden';
    span.style.whiteSpace = 'nowrap';
    span.style.fontSize = pseudoStyle.fontSize;
    span.style.fontFamily = pseudoStyle.fontFamily;
    document.body.appendChild(span);
    const w = span.offsetWidth;
    span.remove();
    return w;
  }

  // 视口内、接近视口 35% 高度的那条消息，视为“当前消息”
  function getActiveWrapper() {
    const wrappers = document.querySelectorAll('#chat .mes .mesAvatarWrapper');
    if (!wrappers.length) return null;

    const vh = window.innerHeight || document.documentElement.clientHeight;
    const targetY = vh * 0.35;

    let best = null;
    let bestDist = Infinity;

    wrappers.forEach(w => {
      const rect = w.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > vh) return;

      const mid = (rect.top + rect.bottom) / 2;
      const d = Math.abs(mid - targetY);
      if (d < bestDist) {
        bestDist = d;
        best = w;
      }
    });

    if (!best) best = wrappers[wrappers.length - 1];
    return best;
  }

  function clearAllScrollExcept(keep) {
    document
      .querySelectorAll('#chat .mes .mesAvatarWrapper.slogan-scroll')
      .forEach(el => {
        if (el !== keep) {
          el.classList.remove('slogan-scroll');
          el.style.animationDuration = '';
        }
      });
  }

  let applyTimer = null;

  // 主逻辑：根据当前配置 + 当前消息，决定要不要滚动
  function updateSloganScrollImmediate() {
    const slogan = getSloganFromCss();
    if (!slogan) {
      clearTimeout(applyTimer);
      applyTimer = null;
      clearAllScrollExcept(null);
      return;
    }

    const wrapper = getActiveWrapper();
    if (!wrapper) return;

    clearAllScrollExcept(wrapper);

    // 先取消尚未执行的延迟任务
    if (applyTimer) {
      clearTimeout(applyTimer);
      applyTimer = null;
    }

    const runCheckAndApply = () => {
      const currentSlogan = getSloganFromCss();
      if (!currentSlogan) {
        wrapper.classList.remove('slogan-scroll');
        wrapper.style.animationDuration = '';
        return;
      }

      const pseudo = getComputedStyle(wrapper, '::after');
      const textWidth = measureTextWidth(`| ${currentSlogan}`, pseudo);
      const boxWidth = wrapper.getBoundingClientRect().width;
      const needScroll = CFG.enabled && textWidth > boxWidth;

      if (needScroll) {
        wrapper.classList.add('slogan-scroll');
        // 用动画时长控制滚动速度
        wrapper.style.animationDuration = `${CFG.speedSec}s`;
      } else {
        wrapper.classList.remove('slogan-scroll');
        wrapper.style.animationDuration = '';
      }
    };

    if (CFG.enabled) {
      if (CFG.delayMs > 0) {
        applyTimer = setTimeout(runCheckAndApply, CFG.delayMs);
      } else {
        runCheckAndApply();
      }
    } else {
      wrapper.classList.remove('slogan-scroll');
      wrapper.style.animationDuration = '';
    }
  }

  // 对外暴露一个手动更新钩子，方便“轮换句子脚本”在换文案后调用
  window.__sloganScrollerUpdate = updateSloganScrollImmediate;

  // === 滚动/窗口变化防抖 ===
  let scrollTimer = null;
  let resizeTimer = null;

  function debounceScroll() {
    if (scrollTimer) clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => {
      updateSloganScrollImmediate();
      scrollTimer = null;
    }, CFG.debounceMs);
  }

  function debounceResize() {
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      updateSloganScrollImmediate();
      resizeTimer = null;
    }, CFG.debounceMs);
  }

  // === 把 UI 并进「随机文案定制」面板 ===
  function injectScrollerUI() {
    if (typeof $ === 'undefined') return;
    const panel = $('#merged_slogan_panel .inline-drawer-content');
    if (!panel.length) return;
    if ($('#slogan_scroller_settings').length) return;

    const html = `
      <hr>
      <div id="slogan_scroller_settings">
        <div class="form-group">
          <label>
            <input type="checkbox" id="scroller_enable">
            标语过长时水平滚动
          </label>
        </div>
        <div class="form-group">
          <label>
            开始滚动延迟（秒）：
            <input type="number" step="0.5" min="0" max="30"
                   id="scroller_delay"
                   class="text_pole" style="width:80px;">
          </label>
        </div>
        <div class="form-group">
          <label>
            滚动一圈用时（秒）：
            <input type="number" step="1" min="5" max="120"
                   id="scroller_speed"
                   class="text_pole" style="width:80px;">
          </label>
        </div>
      </div>
    `;

    panel.append(html);

    // 初始化数值
    $('#scroller_enable').prop('checked', CFG.enabled);
    $('#scroller_delay').val((CFG.delayMs / 1000).toFixed( (CFG.delayMs % 1000) ? 1 : 0));
    $('#scroller_speed').val(CFG.speedSec);

    // 绑定事件
    $(document).on('change', '#scroller_enable', (e) => {
      CFG.enabled = e.currentTarget.checked;
      saveConfig();
      updateSloganScrollImmediate();
    });

    $(document).on('input change', '#scroller_delay', (e) => {
      const v = parseFloat(e.currentTarget.value);
      if (!isNaN(v) && v >= 0) {
        CFG.delayMs = v * 1000;
        saveConfig();
      }
    });

    $(document).on('input change', '#scroller_speed', (e) => {
      const v = parseFloat(e.currentTarget.value);
      if (!isNaN(v) && v > 0) {
        CFG.speedSec = v;
        saveConfig();
        updateSloganScrollImmediate();
      }
    });
  }

  // === 初始化 ===
  function init() {
    console.log('%c[SloganScroller] Init (UI + debounced)', 'color:#4CAF50;font-weight:bold');

    // 先跑一次（进入 chat）
    updateSloganScrollImmediate();

    // 监听聊天新增节点（AI 回复 / 切换记录）
    const chat = document.getElementById('chat');
    if (chat) {
      const observer = new MutationObserver(() => {
        updateSloganScrollImmediate();
      });
      observer.observe(chat, { childList: true });
    }

    // 滚动 & resize：防抖
    window.addEventListener('scroll', debounceScroll, { passive: true });
    window.addEventListener('resize', debounceResize);

    // 等待「随机文案定制」面板出现，再注入 UI
    const uiTimer = setInterval(() => {
      if (typeof $ !== 'undefined' && $('#merged_slogan_panel .inline-drawer-content').length) {
        clearInterval(uiTimer);
        injectScrollerUI();
      }
    }, 500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
