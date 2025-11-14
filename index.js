// 随机文案 + 顶部 CSS 变量 + 标语滚动（共用 extension_settings 持久化）
import * as script from '../../../../script.js';
import { extension_settings } from '../../../extensions.js';

const EXT_NAME = 'merged_slogan';

let lastWrapper = null;
let lastText = '';
let lastNeedScroll = null;
let lastSpeed = null;

(function () {
  // ========================= 配置根对象 =========================
  const DEFAULT_SLOGAN_CFG = Object.freeze({
    CSS_VAR_NAME: '--自定义文案',
    CHANGE_ON_AI_REPLY: true,
    AI_PICK_PROB: 0.6,
    REQUIRE_AI_VERBATIM: true, // true: 只要原句；false: 允许按风格编造
    CONTEXT_AWARE: true,
    CONTEXT_WINDOW: 6,
    LIB_SAMPLE_SIZE: 18,
    MAX_ZH: 15,
    MAX_EN: 80,
    STYLE_HINT: '', // 外部注入的风格 / 语气要求
  });

  const DEFAULT_SCROLLER_CFG = Object.freeze({
    enabled: true,
    delayMs: 0,
    speedSec: 26,
    debounceMs: 500,
  });

  function getRootConfig() {
    if (!extension_settings[EXT_NAME]) {
      extension_settings[EXT_NAME] = {};
    }
    const root = extension_settings[EXT_NAME];

    if (!root.slogan) root.slogan = { ...DEFAULT_SLOGAN_CFG };
    if (!root.scroller) root.scroller = { ...DEFAULT_SCROLLER_CFG };

    for (const [cfg, def] of [[root.slogan, DEFAULT_SLOGAN_CFG], [root.scroller, DEFAULT_SCROLLER_CFG]]) {
      for (const k of Object.keys(def)) {
        if (cfg[k] === undefined) cfg[k] = def[k];
      }
    }
    return root;
  }

  const ROOT_CFG = getRootConfig();
  const CONFIG = ROOT_CFG.slogan;     // 顶部文案配置
  const SCFG = ROOT_CFG.scroller;     // 滚动配置

  function saveConfig() {
    script.saveSettingsDebounced();
    console.log('[MergedSlogan] config saved:', ROOT_CFG);
  }

  // ========================= 文案语料库 =========================
  const BASE_QUOTES = [
    '浅水是喧哗的，深水是沉默的。',
  ];

  console.log('[MergedSlogan] config loaded:', ROOT_CFG);

  // ========================= 通用工具 =========================
  function flattenLib(obj) {
    return Object.values(obj).flat();
  }

  function getExternalQuotes() {
    if (typeof window !== 'undefined' && window.customQuotes) {
      if (Array.isArray(window.customQuotes)) return window.customQuotes.slice();
      if (typeof window.customQuotes === 'object' && window.customQuotes !== null) {
        try {
          return flattenLib(window.customQuotes);
        } catch {
          const out = [];
          for (const k in window.customQuotes) {
            if (Array.isArray(window.customQuotes[k])) out.push(...window.customQuotes[k]);
          }
          return out;
        }
      }
    }
    return null;
  }

  function getQuoteLibraryFlat() {
    const external = getExternalQuotes();
    const base = external && external.length ? external : BASE_QUOTES;
    const cleaned = Array.from(new Set(base.map(s => String(s || '').trim()).filter(Boolean)));
    return cleaned.length ? cleaned : ['故事的开头，总是极具温柔。'];
  }

  function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  let __lastSelected = null;
  function pickRandomAvoidRepeat(arr) {
    if (!arr.length) return '';
    if (arr.length === 1) return arr[0];
    let c = pickRandom(arr);
    for (let i = 0; i < 6 && c === __lastSelected; i++) c = pickRandom(arr);
    return c;
  }

  function collectContext(n = CONFIG.CONTEXT_WINDOW, maxChars = 1200) {
    try {
      const nodes = Array.from(document.querySelectorAll('#chat .mes .mes_text'));
      const lines = [];
      for (let i = Math.max(0, nodes.length - n); i < nodes.length; i++) {
        const el = nodes[i];
        const raw = el ? el.innerText || el.textContent || '' : '';
        const text = raw.replace(/\s+/g, ' ').trim();
        if (text) lines.push(text);
      }
      let joined = lines.join('\n');
      if (joined.length > maxChars) joined = joined.slice(-maxChars);
      return joined;
    } catch {
      return '';
    }
  }

  function collectRecentSlogans(m = 6) {
    const nodes = Array.from(
      document.querySelectorAll('#chat .mes .mes_text div[hidden].slogan-container')
    );
    const res = [];
    for (let i = nodes.length - 1; i >= 0 && res.length < m; i--) {
      const t = (nodes[i].textContent || '').trim().replace(/^✦❋/, '').trim();
      if (t) res.push(t);
    }
    return res;
  }

  function buildLibrarySample(size = CONFIG.LIB_SAMPLE_SIZE) {
    const lib = getQuoteLibraryFlat();
    const copy = lib.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy.slice(0, Math.min(size, copy.length));
  }

  // ========================= 系统提示（隐藏标语） =========================
  function makePrompt(contextText, sampledLib, recent) {
    const template = CONFIG.REQUIRE_AI_VERBATIM
      ? '<div hidden class="slogan-container" data-verbatim="1">✦❋内容</div>'
      : '<div hidden class="slogan-container">✦❋内容</div>';

    const parts = [];

    parts.push(
      '请在本次回复正文的末尾，额外输出且仅输出一个隐藏的HTML元素，格式为：',
      template
    );

    if (CONFIG.REQUIRE_AI_VERBATIM) {
      parts.push(
        '要求：',
        '1) 仅在你确信“内容”为真实存在的原句（可来自文学作品、台词、语录等）时才输出该元素；',
        '2) 若无法100%确认其真实性，请完全省略该隐藏元素（不要输出任何 <div>）；',
        '3) 不要在该元素前后添加其他文本或标签。'
      );
    } else {
      parts.push(
        '要求：',
        '1) 内容可以是你根据当前剧情与风格自由创作的短句；',
        '2) 语气需自然贴合上下文；',
        '3) 不要在该元素前后添加其他文本或标签。'
      );
    }

    parts.push(
      '',
      '【上下文（截断）】',
      contextText || '(无)',
      '',
      '【候选语料库（可择优，也可不用）】',
      JSON.stringify(sampledLib || [], null, 0),
      '',
      '【最近已用（需去重/避免近义复述）】',
      JSON.stringify(recent || [], null, 0),
      '',
      `【长度限制】中文 ≤ ${CONFIG.MAX_ZH} 字；英文 ≤ ${CONFIG.MAX_EN} 字符。`
    );

    const styleHint = (CONFIG.STYLE_HINT || '').trim();
    if (styleHint) {
      parts.push('', '【风格 / 语气要求】', styleHint);
    }

    return parts.join('\n');
  }

  function tryRegisterPromptGuard() {
    try {
      if (!window.tavern_events || !window.eventOn) return;
      const EV = window.tavern_events;
      if (!EV.CHAT_COMPLETION_PROMPT_READY) return;

      window.eventOn(EV.CHAT_COMPLETION_PROMPT_READY, (eventData) => {
        if (!CONFIG.CONTEXT_AWARE) return;
        if (!eventData || !Array.isArray(eventData.chat)) return;

        const ctx = collectContext(CONFIG.CONTEXT_WINDOW);
        const lib = buildLibrarySample(CONFIG.LIB_SAMPLE_SIZE);
        const recent = collectRecentSlogans(6);
        const prompt = makePrompt(ctx, lib, recent);

        eventData.chat.push({ role: 'system', content: prompt });
        console.log('[MergedSlogan] 已注入上下文标语提示（若模型支持）。');
      });
    } catch (e) {
      console.error('[MergedSlogan] 注册 Prompt Guard 出错：', e);
    }
  }

  // ========================= 读取 AI 隐藏标语 =========================
  function getLatestAISloganVerbatim() {
    try {
      const nodes = Array.from(
        document.querySelectorAll('#chat .mes:not([is_user="true"]) .mes_text div[hidden].slogan-container')
      );
      if (!nodes.length) return '';
      for (let i = nodes.length - 1; i >= 0; i--) {
        const el = nodes[i];
        const isVerbatim = el.getAttribute('data-verbatim');
        if (CONFIG.REQUIRE_AI_VERBATIM && String(isVerbatim) !== '1') continue;
        const text = (el.textContent || '').trim().replace(/^✦❋/, '').trim();
        if (text) return text;
      }
      return '';
    } catch (e) {
      console.error('[MergedSlogan] 提取 AI 标语失败：', e);
      return '';
    }
  }

  // ========================= 写 CSS 变量 =========================
  function writeCssQuote(text) {
    if (!text) return;
    if (typeof $ !== 'undefined') {
      $('html').css(CONFIG.CSS_VAR_NAME, `"${text}"`);
    } else if (document && document.documentElement) {
      document.documentElement.style.setProperty(CONFIG.CSS_VAR_NAME, `"${text}"`);
    }
    __lastSelected = text;
    console.log('[MergedSlogan] 顶部文案更新：', text);

    if (typeof window.__sloganScrollerUpdate === 'function') {
      window.__sloganScrollerUpdate();
    }
  }

  function setQuoteFromLibraryOnly() {
    const lib = getQuoteLibraryFlat();
    writeCssQuote(pickRandomAvoidRepeat(lib));
  }

  function setQuoteFromAIOrLibrary() {
    const tryAI = Math.random() < CONFIG.AI_PICK_PROB;
    let chosen = '';
    if (tryAI) {
      const ai = getLatestAISloganVerbatim();
      if (ai) chosen = ai;
    }
    if (!chosen) {
      const lib = getQuoteLibraryFlat();
      chosen = pickRandomAvoidRepeat(lib);
    }
    writeCssQuote(chosen);
  }

  // ========================= 顶部文案 UI =========================
  function injectSettingsUI() {
    try {
      if (typeof $ === 'undefined' || !$('#extensions_settings').length) return;
      if ($('#merged_slogan_panel').length) return;

      const html = `
      <div id="merged_slogan_panel" class="inline-drawer">
        <div class="inline-drawer-toggle inline-drawer-header">
          <b>随机文案定制</b>
          <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
        </div>
        <div class="inline-drawer-content" style="display:none;">
          <div class="form-group">
            <label><input type="checkbox" id="cfg_change_on_ai" ${CONFIG.CHANGE_ON_AI_REPLY ? 'checked' : ''}> AI 回复后更换</label>
          </div>
          <div class="form-group">
            <label><input type="checkbox" id="cfg_context_aware" ${CONFIG.CONTEXT_AWARE ? 'checked' : ''}> 注入上下文</label>
          </div>
          <div class="form-group">
            <label><input type="checkbox" id="cfg_require_verbatim" ${CONFIG.REQUIRE_AI_VERBATIM ? 'checked' : ''}> 真实摘录（只要原句）</label>
          </div>
          <div class="form-group">
            <label>AI 采纳率（0~1）：<input type="number" step="0.05" min="0" max="1" id="cfg_ai_prob" value="${CONFIG.AI_PICK_PROB}" class="text_pole" style="width:80px;"></label>
          </div>
          <div class="form-group">
            <label>上下文窗口（条）：<input type="number" min="1" max="20" id="cfg_ctx_window" value="${CONFIG.CONTEXT_WINDOW}" class="text_pole" style="width:80px;"></label>
          </div>
          <div class="form-group">
            <label>库抽样（条）：<input type="number" min="6" max="60" id="cfg_lib_sample" value="${CONFIG.LIB_SAMPLE_SIZE}" class="text_pole" style="width:80px;"></label>
          </div>
          <div class="form-group">
            <label>中文最长：<input type="number" min="4" max="30" id="cfg_max_zh" value="${CONFIG.MAX_ZH}" class="text_pole" style="width:80px;"></label>
            <label>英文最长：<input type="number" min="10" max="160" id="cfg_max_en" value="${CONFIG.MAX_EN}" class="text_pole" style="width:80px; margin-left:8px;"></label>
          </div>
          <div class="form-group">
            <label>AI 风格 / 语气要求：</label>
            <textarea id="cfg_style_hint" rows="3" class="text_pole" style="width:100%;">${CONFIG.STYLE_HINT || ''}</textarea>
          </div>
        </div>
      </div>
      <style>
        #merged_slogan_panel .form-group{margin:6px 0;}
        #merged_slogan_panel input.text_pole{padding:2px 6px;}
        #merged_slogan_panel textarea.text_pole{padding:4px 6px; resize: vertical;}
      </style>
      `;
      $('#extensions_settings').append(html);

      $(document).on('change', '#merged_slogan_panel #cfg_change_on_ai', (e) => {
        CONFIG.CHANGE_ON_AI_REPLY = e.currentTarget.checked;
        saveConfig();
      });
      $(document).on('change', '#merged_slogan_panel #cfg_context_aware', (e) => {
        CONFIG.CONTEXT_AWARE = e.currentTarget.checked;
        saveConfig();
      });
      $(document).on('change', '#merged_slogan_panel #cfg_require_verbatim', (e) => {
        CONFIG.REQUIRE_AI_VERBATIM = e.currentTarget.checked;
        saveConfig();
      });
      $(document).on('input', '#merged_slogan_panel #cfg_ai_prob', (e) => {
        const v = parseFloat(e.currentTarget.value);
        if (!isNaN(v) && v >= 0 && v <= 1) {
          CONFIG.AI_PICK_PROB = v;
          saveConfig();
        }
      });
      $(document).on('input', '#merged_slogan_panel #cfg_ctx_window', (e) => {
        const v = parseInt(e.currentTarget.value, 10);
        if (!isNaN(v) && v >= 1) {
          CONFIG.CONTEXT_WINDOW = v;
          saveConfig();
        }
      });
      $(document).on('input', '#merged_slogan_panel #cfg_lib_sample', (e) => {
        const v = parseInt(e.currentTarget.value, 10);
        if (!isNaN(v) && v >= 6) {
          CONFIG.LIB_SAMPLE_SIZE = v;
          saveConfig();
        }
      });
      $(document).on('input', '#merged_slogan_panel #cfg_max_zh', (e) => {
        const v = parseInt(e.currentTarget.value, 10);
        if (!isNaN(v) && v >= 4) {
          CONFIG.MAX_ZH = v;
          saveConfig();
        }
      });
      $(document).on('input', '#merged_slogan_panel #cfg_max_en', (e) => {
        const v = parseInt(e.currentTarget.value, 10);
        if (!isNaN(v) && v >= 10) {
          CONFIG.MAX_EN = v;
          saveConfig();
        }
      });
      $(document).on('input', '#merged_slogan_panel #cfg_style_hint', (e) => {
        CONFIG.STYLE_HINT = e.currentTarget.value;
        saveConfig();
      });
    } catch (e) {
      console.error('[MergedSlogan] 注入设置 UI 出错：', e);
    }
  }

  // ========================= 标语滚动逻辑 =========================
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

  // 视窗内有头像时，取「最下面那条」作为滚动目标；视窗内没有就不滚
  function getActiveWrapper() {
    const wrappers = document.querySelectorAll('#chat .mes .mesAvatarWrapper');
    if (!wrappers.length) return null;

    const vh = window.innerHeight || document.documentElement.clientHeight;

    let best = null;
    let bestBottom = -Infinity;

    wrappers.forEach(w => {
      const rect = w.getBoundingClientRect();
      if (rect.bottom <= 0 || rect.top >= vh) return;
      if (rect.bottom > bestBottom) {
        bestBottom = rect.bottom;
        best = w;
      }
    });

    return best || null;
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

  function updateSloganScrollImmediate() {
    const slogan = getSloganFromCss();
    if (!slogan) {
      clearTimeout(applyTimer);
      applyTimer = null;
      clearAllScrollExcept(null);
      return;
    }

    const wrapper = getActiveWrapper();
    if (!wrapper) {
      clearAllScrollExcept(null);
      return;
    }

    clearAllScrollExcept(wrapper);

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
      const needScroll = SCFG.enabled && textWidth > boxWidth;

      const changed =
        wrapper !== lastWrapper ||
        currentSlogan !== lastText ||
        SCFG.speedSec !== lastSpeed ||
        needScroll !== lastNeedScroll;

      lastWrapper = wrapper;
      lastText = currentSlogan;
      lastSpeed = SCFG.speedSec;
      lastNeedScroll = needScroll;

      if (!needScroll) {
        wrapper.classList.remove('slogan-scroll');
        wrapper.style.animationDuration = '';
        return;
      }

      if (!changed && wrapper.classList.contains('slogan-scroll')) {
        return;
      }

      wrapper.classList.remove('slogan-scroll');
      void wrapper.offsetWidth;
      wrapper.style.animationDuration = `${SCFG.speedSec}s`;
      wrapper.classList.add('slogan-scroll');
    };

    if (SCFG.enabled) {
      if (SCFG.delayMs > 0) {
        applyTimer = setTimeout(runCheckAndApply, SCFG.delayMs);
      } else {
        runCheckAndApply();
      }
    } else {
      wrapper.classList.remove('slogan-scroll');
      wrapper.style.animationDuration = '';
    }
  }

  window.__sloganScrollerUpdate = updateSloganScrollImmediate;

  let scrollTimer = null;
  let resizeTimer = null;

  function debounceScroll() {
    if (scrollTimer) clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => {
      updateSloganScrollImmediate();
      scrollTimer = null;
    }, SCFG.debounceMs);
  }

  function debounceResize() {
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      updateSloganScrollImmediate();
      resizeTimer = null;
    }, SCFG.debounceMs);
  }

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

    $('#scroller_enable').prop('checked', SCFG.enabled);
    $('#scroller_delay').val((SCFG.delayMs / 1000).toFixed(SCFG.delayMs % 1000 ? 1 : 0));
    $('#scroller_speed').val(SCFG.speedSec);

    $(document).on('change', '#scroller_enable', (e) => {
      SCFG.enabled = e.currentTarget.checked;
      saveConfig();
      updateSloganScrollImmediate();
    });

    $(document).on('input change', '#scroller_delay', (e) => {
      const v = parseFloat(e.currentTarget.value);
      if (!isNaN(v) && v >= 0) {
        SCFG.delayMs = v * 1000;
        saveConfig();
      }
    });

    $(document).on('input change', '#scroller_speed', (e) => {
      const v = parseFloat(e.currentTarget.value);
      if (!isNaN(v) && v > 0) {
        SCFG.speedSec = v;
        saveConfig();
        updateSloganScrollImmediate();
      }
    });
  }

  function initScrollerCore() {
    console.log('%c[SloganScroller] Init (UI + debounced)', 'color:#4CAF50;font-weight:bold');

    const chat = document.getElementById('chat');
    if (chat) {
      const observer = new MutationObserver(() => {
        updateSloganScrollImmediate();
      });
      observer.observe(chat, { childList: true });
    }

    window.addEventListener('scroll', debounceScroll, { passive: true });
    window.addEventListener('resize', debounceResize);
  }

  // ========================= 总初始化 =========================
  function bootstrap() {
    const uiTimer = setInterval(() => {
      if (typeof $ !== 'undefined' && $('#extensions_settings').length) {
        clearInterval(uiTimer);
        injectSettingsUI();
        injectScrollerUI();
      }
    }, 500);

    if (typeof window.tavern_events !== 'undefined' && typeof window.eventOn === 'function') {
      const EV = window.tavern_events;

      tryRegisterPromptGuard();

      setQuoteFromLibraryOnly();

      window.eventOn(EV.CHAT_CHANGED, () => {
        console.log('[MergedSlogan] CHAT_CHANGED → 库抽取');
        setQuoteFromLibraryOnly();
      });

      if (EV.MESSAGE_RECEIVED) {
        window.eventOn(EV.MESSAGE_RECEIVED, (message) => {
          if (message && message.is_user) return;
          setTimeout(() => {
            if (CONFIG.CHANGE_ON_AI_REPLY) setQuoteFromAIOrLibrary();
          }, 200);
        });
      }
    } else {
      setQuoteFromLibraryOnly();
      console.warn('[MergedSlogan] 未检测到 SillyTavern 事件，已做降级初始化。');
    }

    initScrollerCore();
  }

  if (typeof $ !== 'undefined') {
    $(() => bootstrap());
  } else {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', bootstrap);
    } else {
      bootstrap();
    }
  }
})();
