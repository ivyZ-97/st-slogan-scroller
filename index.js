// 随机文案 + 顶部 CSS 变量（可选 AI/语料库）
// 直接放到 SillyTavern 的扩展目录即可使用
import * as script from '../../../../script.js';
import { extension_settings } from '../../../extensions.js';

const EXT_NAME = 'merged_slogan';

// ========================= 配置与状态 =========================
const DEFAULT_SLOGAN_CFG = Object.freeze({
  CSS_VAR_NAME: '--自定义文案',
  CHANGE_ON_AI_REPLY: true,      // AI 回复后是否自动换一句
  AI_PICK_PROB: 0.6,             // 0~1：使用 AI 标语的概率
  REQUIRE_AI_VERBATIM: true,     // 只吃 data-verbatim="1"
  AI_ONLY: false,                // true: 仅使用 AI（不用语料库）
  LIB_SAMPLE_SIZE: 18,           // 候选语料库抽样条数
  MAX_ZH: 15,                    // 中文长度限制
  MAX_EN: 80,                    // 英文长度限制
  STYLE_PROMPT: '',              // 外部注入风格提示（UI 文本框）
});

function getRootConfig() {
  if (!extension_settings[EXT_NAME]) {
    extension_settings[EXT_NAME] = {};
  }
  const root = extension_settings[EXT_NAME];
  if (!root.slogan) root.slogan = { ...DEFAULT_SLOGAN_CFG };

  const cfg = root.slogan;
  for (const [k, v] of Object.entries(DEFAULT_SLOGAN_CFG)) {
    if (cfg[k] === undefined) cfg[k] = v;
  }
  return root;
}

const ROOT_CFG = getRootConfig();
const CONFIG = ROOT_CFG.slogan;

function saveConfig() {
  script.saveSettingsDebounced();
  console.log('[MergedSlogan] config saved:', ROOT_CFG);
}

// ========================= 内置语料库 =========================
const BASE_QUOTES = [
  'Be yourself; everyone else is already taken.',
  '做你自己，别人都已经名花有主了。',
  '浅水是喧哗的，深水是沉默的。',
];

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
  const cleaned = Array.from(
    new Set(
      base
        .map((s) => String(s || '').trim())
        .filter(Boolean),
    ),
  );
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

function collectRecentSlogans(m = 6) {
  const nodes = Array.from(
    document.querySelectorAll('#chat .mes .mes_text div[hidden].slogan-container'),
  );
  const res = [];
  for (let i = nodes.length - 1; i >= 0 && res.length < m; i--) {
    const t = (nodes[i].textContent || '')
      .trim()
      .replace(/^✦❋/, '')
      .trim();
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

// ========================= Prompt 构造 =========================
function makePrompt(sampledLib, recent, stylePrompt) {
  const maxZh = CONFIG.MAX_ZH;
  const maxEn = CONFIG.MAX_EN;

  const prefix =
    '请在每次正文的末尾额外输出一个隐藏的HTML元素，格式为 `<div hidden class="slogan-container" data-verbatim="1">✦❋内容</div>`。';

  let body = (stylePrompt || '').trim();
  if (!body) {
    body =
      `元素内仅包含当前角色极具个人风格的一句短句，` +
      `可以是座右铭、网络用语、另类名言、爱语或吐槽等形式。` +
      `中文最长 ${maxZh} 个字；英文最长 ${maxEn} 个字符。` +
      `标语不要重复，也不要额外解释。`;
  }

  const parts = [`${prefix}\n${body}`];

  parts.push(`【长度限制】中文 ≤ ${maxZh} 字；英文 ≤ ${maxEn} 字符。`);

  if (Array.isArray(sampledLib) && sampledLib.length) {
    parts.push(
      '【候选语料库（可自由改写，不要逐字照搬）】',
      sampledLib.join(' / '),
    );
  }

  if (Array.isArray(recent) && recent.length) {
    parts.push(
      '【最近已用标语（请避免重复或近义复述）】',
      recent.join(' / '),
    );
  }

  return parts.join('\n\n');
}

function tryRegisterPromptGuard() {
  try {
    if (
      !script.eventSource ||
      !script.event_types ||
      !script.event_types.CHAT_COMPLETION_PROMPT_READY
    ) {
      console.warn('[MergedSlogan] script.eventSource 未就绪，暂不注入提示。');
      return;
    }

    script.eventSource.on(
      script.event_types.CHAT_COMPLETION_PROMPT_READY,
      (eventData = {}) => {
        if (eventData.dryRun === true || !Array.isArray(eventData.chat)) return;

        // 不注入对话上下文，只提供：风格说明 + 语料库 + 最近标语
        const sampledLib = CONFIG.AI_ONLY
          ? []
          : buildLibrarySample(CONFIG.LIB_SAMPLE_SIZE);
        const recent = collectRecentSlogans(6);
        const styleStr = (CONFIG.STYLE_PROMPT || '').trim();

        const prompt = makePrompt(sampledLib, recent, styleStr);

        eventData.chat.push({
          role: 'system',
          content: prompt,
        });

        console.log(
          '[MergedSlogan] 已注入标语提示（无上下文，styleLen =',
          styleStr.length,
          '）。',
        );
      },
    );
  } catch (e) {
    console.error('[MergedSlogan] 注册 CHAT_COMPLETION_PROMPT_READY 失败：', e);
  }
}

// ========================= 读取 AI 标语 & 写 CSS 变量 =========================
function getLatestAISloganVerbatim() {
  try {
    const nodes = Array.from(
      document.querySelectorAll(
        '#chat .mes:not([is_user="true"]) .mes_text div[hidden].slogan-container',
      ),
    );
    if (!nodes.length) return '';
    for (let i = nodes.length - 1; i >= 0; i--) {
      const el = nodes[i];
      const isVerbatim = el.getAttribute('data-verbatim');
      if (CONFIG.REQUIRE_AI_VERBATIM && String(isVerbatim) !== '1') continue;
      const text = (el.textContent || '')
        .trim()
        .replace(/^✦❋/, '')
        .trim();
      if (text) return text;
    }
    return '';
  } catch (e) {
    console.error('[MergedSlogan] getLatestAISloganVerbatim 出错：', e);
    return '';
  }
}

function writeCssQuote(text) {
  if (!text) return;
  if (typeof $ !== 'undefined') {
    $('html').css(CONFIG.CSS_VAR_NAME, `"${text}"`);
  } else if (document && document.documentElement) {
    document.documentElement.style.setProperty(CONFIG.CSS_VAR_NAME, `"${text}"`);
  }
  __lastSelected = text;
  console.log('[MergedSlogan] 顶部文案更新：', text);
}

function setQuoteFromLibraryOnly() {
  if (CONFIG.AI_ONLY) {
    console.log(
      '[MergedSlogan] AI-only 模式：初始化阶段不从语料库抽取文案，等待模型首次标语。',
    );
    return;
  }
  const lib = getQuoteLibraryFlat();
  writeCssQuote(pickRandomAvoidRepeat(lib));
}

function setQuoteFromAIOrLibrary() {
  let chosen = '';

  if (CONFIG.AI_ONLY) {
    const ai = getLatestAISloganVerbatim();
    if (ai) {
      chosen = ai;
    } else {
      console.warn(
        '[MergedSlogan] AI-only 模式下本轮未提取到标语，保持现有顶部文案不变。',
      );
      return;
    }
    writeCssQuote(chosen);
    return;
  }

  const tryAI = Math.random() < CONFIG.AI_PICK_PROB;
  if (tryAI) {
    const ai = getLatestAISloganVerbatim();
    if (ai) chosen = ai;
  }

  if (!chosen) {
    const lib = getQuoteLibraryFlat();
    chosen = pickRandomAvoidRepeat(lib);
  }

  if (!chosen) {
    console.warn('[MergedSlogan] 普通模式下也未获得标语，保持现有文案。');
    return;
  }
  writeCssQuote(chosen);
}

// ========================= 简单设置 UI =========================
function injectSettingsUI() {
  try {
    if (typeof $ === 'undefined' || !$('#extensions_settings').length) return;
    if ($('#merged_slogan_panel').length) return;

    const html = `
      <div id="merged_slogan_panel" class="inline-drawer">
        <div class="inline-drawer-toggle inline-drawer-header">
          <b>随机文案定制 (merged_slogan)</b>
          <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
        </div>
        <div class="inline-drawer-content" style="display:none;">
          <div class="form-group">
            <label><input type="checkbox" id="cfg_change_on_ai" ${
              CONFIG.CHANGE_ON_AI_REPLY ? 'checked' : ''
            }> AI 回复后更换</label>
          </div>
          <div class="form-group">
            <label><input type="checkbox" id="cfg_ai_only" ${
              CONFIG.AI_ONLY ? 'checked' : ''
            }> 仅 AI 生成（禁用语料库）</label>
          </div>
          <div class="form-group">
            <label><input type="checkbox" id="cfg_require_verbatim" ${
              CONFIG.REQUIRE_AI_VERBATIM ? 'checked' : ''
            }> 仅接受 data-verbatim="1"</label>
          </div>
          <div class="form-group">
            <label>AI 采纳概率 (0~1)：<input type="number" step="0.05" min="0" max="1" id="cfg_ai_prob" value="${
              CONFIG.AI_PICK_PROB
            }" class="text_pole" style="width:80px;"></label>
          </div>
          <div class="form-group">
            <label>库抽样条数：<input type="number" min="1" max="60" id="cfg_lib_sample" value="${
              CONFIG.LIB_SAMPLE_SIZE
            }" class="text_pole" style="width:80px;"></label>
          </div>
          <div class="form-group">
            <label>中文最长：<input type="number" min="4" max="50" id="cfg_max_zh" value="${
              CONFIG.MAX_ZH
            }" class="text_pole" style="width:80px;"></label>
            <label>英文最长：<input type="number" min="10" max="300" id="cfg_max_en" value="${
              CONFIG.MAX_EN
            }" class="text_pole" style="width:80px; margin-left:6px;"></label>
          </div>
          <div class="form-group">
            <label>风格提示</label>
            <textarea id="cfg_style_prompt" class="text_pole" rows="4" placeholder="例如：文艺忧郁、贴合当前章节情绪……">${
              CONFIG.STYLE_PROMPT || ''
            }</textarea>
          </div>
        </div>
      </div>
    `;
    $('#extensions_settings').append(html);

    // 勾选框紧挨文字，不影响其他扩展
    if (!document.getElementById('merged_slogan_checkbox_fix')) {
      const st = document.createElement('style');
      st.id = 'merged_slogan_checkbox_fix';
      st.textContent = `
        #merged_slogan_panel .form-group label {
          display: inline-flex;
          flex-direction: row;
          align-items: center;
          gap: 4px;
        }
        #merged_slogan_panel .form-group label input[type="checkbox"] {
          margin: 0;
        }
      `;
      document.head.appendChild(st);
    }

    $(document).on('change', '#merged_slogan_panel #cfg_change_on_ai', (e) => {
      CONFIG.CHANGE_ON_AI_REPLY = e.currentTarget.checked;
      saveConfig();
    });
    $(document).on('change', '#merged_slogan_panel #cfg_ai_only', (e) => {
      CONFIG.AI_ONLY = e.currentTarget.checked;
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
    $(document).on('input', '#merged_slogan_panel #cfg_lib_sample', (e) => {
      const v = parseInt(e.currentTarget.value, 10);
      if (!isNaN(v) && v >= 1) {
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
    $(document).on('input', '#merged_slogan_panel #cfg_style_prompt', (e) => {
      CONFIG.STYLE_PROMPT = e.currentTarget.value;
      saveConfig();
    });
  } catch (e) {
    console.error('[MergedSlogan] 注入设置UI失败：', e);
  }
}

// ========================= 初始化 =========================
function bootstrap() {
  // 1. 注入设置 UI
  const uiTimer = setInterval(() => {
    if (typeof $ !== 'undefined' && $('#extensions_settings').length) {
      clearInterval(uiTimer);
      injectSettingsUI();
    }
  }, 500);

  // 2. Prompt 注入（通过新事件总线）
  tryRegisterPromptGuard();

  // 3. 初始化时先给一个库里的句子
  setQuoteFromLibraryOnly();

  // 4. 兼容旧版 tavern_events：在 AI 回复后更新 CSS 变量
  if (typeof window.tavern_events !== 'undefined' && typeof window.eventOn === 'function') {
    const EV = window.tavern_events;

    window.eventOn(EV.CHAT_CHANGED, () => {
      console.log('[MergedSlogan] CHAT_CHANGED → 重新初始化文案');
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
    console.warn('[MergedSlogan] 未检测到旧版 tavern_events，只能通过 CSS 变量查看效果。');
  }
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
