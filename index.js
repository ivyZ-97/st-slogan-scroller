// merged_slogan.js — Alice 版随机文案 + CSS 变量（强制输出标语）
// 放到 SillyTavern 的 extensions 目录即可使用
import * as script from '../../../../script.js';
import { extension_settings } from '../../../extensions.js';

const EXT_NAME = 'merged_slogan';

// ========================= 配置与状态 =========================
const DEFAULT_SLOGAN_CFG = Object.freeze({
  ENABLED: true,                 // 全局启用/禁用
  CSS_VAR_NAME: '--自定义文案', // 写入到 :root 的 CSS 变量名
  AI_PICK_PROB: 0.6,             // 0~1：随机数 < 该值 → 自由创作；否则从语料库中选
  MAX_ZH: 50,                    // 中文最长字数
  MAX_EN: 300,                   // 英文最长字符数
  STYLE_PROMPT: '',              // 风格提示（UI 文本框）
});

// 语料库抽样条数（内部常量，不暴露 UI）
const LIB_SAMPLE_SIZE = 18;

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
  "Be yourself; everyone else is already taken.",
    "做你自己，别人都已经名花有主了。",
    "We are all in the gutter, but some of us are looking at the stars.",
    "我们都在阴沟里，但仍有人仰望星空。",
    "The only way to get rid of a temptation is to yield to it.",
    "摆脱诱惑的唯一方法，就是屈从于它。",
    "Experience is simply the name we give our mistakes.",
    "所谓经验，不过是我们给错误起的名字。",
    "The truth is rarely pure and never simple.",
    "真理很少纯粹，而且从不简单。",
    "To live is the rarest thing in the world. Most people exist, that is all.",
    "真正活着是世上最罕见的事；大多数人只是存在。",
    "A dreamer is one who can only find his way by moonlight.",
    "梦想家只在月光下找到自己的路。",
    "Memory is the diary that we all carry about with us.",
    "记忆是我们每个人都随身携带的日记。",
    "The heart was made to be broken.",
    "心本就是为破碎而生的。",
    "To love oneself is the beginning of a lifelong romance.",
    "爱自己是一场终身浪漫的开始。",
    "I can resist everything except temptation.",
    "我能抵御一切，除了诱惑。",
    "No man is rich enough to buy back his past.",
    "没有人富到能买回自己的过去。",
    "What seems to us as bitter trials are often blessings in disguise.",
    "那些看似痛苦的考验，往往是伪装的祝福。",
    "Every saint has a past, and every sinner has a future.",
    "每个圣人都有过去，每个罪人都有未来。",
    "Art is the most intense mode of individualism that the world has known.",
    "艺术是世界上最强烈的个人主义形式。",
    "Nothing can cure the soul but the senses, just as nothing can cure the senses but the soul.",
    "唯有感官能治愈灵魂，唯有灵魂能治愈感官。",
    "To define is to limit.",
    "定义即是限制。",
    "The books that the world calls immoral are the books that show the world its own shame.",
    "世界称为不道德的书，往往揭示了它自己的羞耻。",
    "Women are meant to be loved, not to be understood.",
    "女人是被爱的，不是被理解的。",
    "It is absurd to divide people into good and bad. People are either charming or tedious.",
    "把人分为好坏是荒谬的——人要么迷人，要么乏味。",

    // ===== Jorge Luis Borges（博尔赫斯）=====
    "Time is the substance I am made of.",
    "时间是构成我的物质。",
    "We are our memory.",
    "我们即是记忆。",
    "The original is unfaithful to the translation.",
    "原作常常对译文不忠。",
    "I do not know which of us has written this page.",
    "我不知道我们之中是谁写下了这一页。",
    "Nothing is built on stone; all is built on sand, but we must build as if the sand were stone.",
    "世上没有什么真正建在石头上，一切都建在流沙上，但我们必须像建在石头上一样去建造。",
    "So plant your own garden and decorate your own soul, instead of waiting for someone to bring you flowers.",
    "因此请栽下你自己的花园，装点你自己的灵魂，不要等待别人捧花而来。",
    "Every man is born into the faith of his ignorance.",
    "每个人都生于自身无知的信仰之中。",
    "To fall in love is to create a religion that has a fallible god.",
    "坠入爱河，就是创造一个有缺陷的神。",
    "The past is not lost, it only waits to be dreamed again.",
    "过去并未失去，它只是在等待被重新梦见。",
    "Dreams are the oldest memories of mankind.",
    "梦是人类最古老的记忆。",
    "The universe is not only stranger than we imagine, it is stranger than we can imagine.",
    "宇宙不仅比我们想象的更奇异，甚至比我们所能想象的更奇异。",
    "Reality is not always probable, or likely.",
    "现实并不总是可能或合理的。",
    "We are all the same person trying to find our way through time.",
    "我们都是在时间中寻路的同一个人。",
    "The thing that torments us most is the memory of what we never had.",
    "最折磨我们的，是那些从未得到过的记忆。",
    "I dreamt that I was dreaming.",
    "我梦见自己在做梦。",
    "So many things have to be forgotten for one to remember one thing.",
    "要记住一件事，必须遗忘许多事情。",
    "There is no greater comfort than the thought that time will erase everything.",
    "没有什么比时间终将抹去一切的想法更令人安慰的。",
    "Each thing is infinite, for it contains the universe.",
    "每一样东西都是无限的，因为其中包含了整个宇宙。",
    "Destiny is not a mystery, it is repetition.",
    "命运并非谜团，而是重复。",

    // ===== 史铁生（选自《我与地坛》《病隙碎笔》等常见语句）=====
    "我与地坛，相对无言。",
    "有些事只适合收藏，不能说，也不能想，却又不能忘。",
    "人活一天就不要白活。",
    "活着，是为了体验那一点点微光。",
    "痛苦让人看见世界的另一面。",
    "就命运而言，休论公道。",
    "在命运的混沌之点，人唯有乞灵于自己的精神。",
    "人若忘记死亡，便无法真正地活。",
    "时间把一切都带走，也把我们带到该去的地方。",
    "我写作，是为了在沉默中发声。",
    "生命有裂缝，阳光才能照进来。",
    "人为什么活着？因为人想活着，说到底是这么回事。",

    // ===== 王小波（保守可用）=====
    "须知参差多态，乃是幸福的本源。",
    "一个人只拥有此生此世是不够的，他还应该拥有诗意的世界。",
    "那一天我二十一岁，在我一生的黄金时代，我有好多奢望。",
    "你要是愿意，我就永远爱你；你要是不愿意，我就永远相思。",
    "我把我的整个的灵魂都给你，连同它的怪癖、耍小脾气、忽明忽暗、一千八百种坏毛病；它真讨厌，只有一点好，爱你。",
    "在这个世界上，大多数愚蠢里都含有假装和弄假成真的成分。",
    "一想到你，我这张丑脸上就泛起微笑。",
    "人的一切痛苦，本质上都是对自己无能的愤怒。",
    "爱一个人意味着什么？意味着他和别人的不一样。",
    "我把一切都交给时间，但时间什么也没给我。",
    "自由是一种很高的境界，不是想干什么就干什么，而是不想干什么就不干什么。",
    "我希望自己是个有趣的人，这样在无人陪伴时，也能自得其乐。",

    // ===== 王家卫（电影台词/旁白选）=====
    "If I had a spare room, would you move in?",
    "如果我有个空房间，你会搬来吗？",
    "That era has passed. Nothing that belonged to it exists anymore.",
    "那个时代已经过去了，属于它的一切都不存在了。",
    "He remembers those vanished years as though looking through a dusty windowpane.",
    "他把那些已经消失了的岁月，看作隔着一扇布满灰尘的玻璃窗。",
    "每天我们都在和无数人擦肩而过，无数再也不会遇见的人。",
    "一天过去了，一切都成了昨天。",
    "其实万物都有保质期，剑鱼会过期，肉罐头会过期，就连保鲜纸也会过期。",
    "不是每个故事都有开始或结局。",
    "我们不如重头来过。",
    "有时候我觉得，幸福就是一种距离感。",
    "我一直以为可以重新开始，但也许我错了。",
    "我们是一场错误，但我从不后悔。",
    "有些记忆是注定要消逝的，但它们却从未消失。",
    "爱情这回事，讲究的就是时机。太早或太晚都不行。",
    "我曾爱过一个人，后来她不在了，我去找她，那条路没有尽头。",
    "每一个出现在我们生命里的人，都会留下痕迹。",
    "你永远都不会是一只真正的鸟，因为你没有脚，你永远都停不下来。",
    "在遇见你之前的一分钟，我还不知道什么是爱。",
    "那是我一生中最快乐的一分钟。",
    "我们都是漂泊的人，彼此擦肩而过。",
    "人会记住过去，是因为那里面有自己再也得不到的东西。",
    "如果早知道是这样，我会让你开心一点。",
    "有时候，你会情不自禁地怀念过去。",

    // ===== 你的原始“九句”（保留）=====
    "太阳也光顾污秽之地。",
    "唯一的旅程是内心的旅程。",
    "你必须将你的思想和言语用篱笆围起来。",
    "垂下的头颅只是为了让思想扬起。",
    "在门外黑夜的嘴唇，写下了你的姓名。",
    "别挡住我的阳光。",
    "故事的开头，总是极具温柔。",
    "浅水是喧哗的，深水是沉默的。",
    "爱比重罪更难隐藏。",

    // ===== Maugham（毛姆，保守可用句）=====
    "We are not the same people we were yesterday.",
    "我们不再是昨天的那个人。",
    "The years teach us what the days never know.",
    "岁月教会我们的，是日子所无法知道的。",
    "To live twice is impossible, but to remember is almost the same.",
    "让任何一个人成为你的全部，是危险的。",
    "We do not write because we want to; we write because we have to.",
    "我们写作不是因为想写，而是因为不得不写。",
    "The greatest tragedy of life is not that men perish, but that they cease to love.",
    "人生最大的悲剧不是死亡，而是停止了去爱。",
    "Life is a difficult business, full of pain and sorrow.",
    "人生是一件艰难的事，充满痛苦与悲伤。",
    "The love that lasts longest is the love that is never returned.",
    "最长久的爱，是得不到回应的爱。",
    "Only a mediocre person is always at his best.",
    "只有平庸之人总是状态最佳。",
    "There are few things so pleasant as a picnic eaten in perfect comfort.",
    "世上少有比在完全舒适中吃野餐更愉快的事。",
    "The heart remembers what the mind chooses to forget.",
    "心会记得那些理智选择遗忘的事。",

    // ===== Márquez（马尔克斯，保守可用句）=====
    "What matters in life is not what happens to you but what you remember and how you remember it.",
    "重要的不是人生发生了什么，而是你记得什么，以及你如何记得。",
    "It is not true that people stop pursuing dreams because they grow old, they grow old because they stop pursuing dreams.",
    "人变老并不是因为停止追梦，而是因为停止追梦后开始变老。",
    "It’s enough for me to be sure that you and I exist at this moment.",
    "对我来说，只需确定此刻你和我确实存在即可。",
    "No matter what, nobody can take away the dances you’ve already had.",
    "无论如何，没人能夺走你曾经跳过的舞。",
    "The heart’s memory eliminates the bad and magnifies the good.",
    "Human beings are not born once and for all on the day their mothers give birth to them, but … life obliges them over and over again to give birth to themselves.",
    "人生不是在母亲生下他们的那一天就一劳永逸，人被生命一次次迫使重生。",

    // ===== 张爱玲（保守可用句）=====
    "人生是一袭华美的袍，爬满了虱子。",
    "对于三十岁以后的人来说，十年八年不过是指缝间的事。",
    "出名要趁早，来得太晚的话，快乐也不那么痛快。",
    "人世间的感情，最经不起的就是‘认真’二字。",
    "红玫瑰与白玫瑰，一个是朱砂痣，一个是白月光。",
    "爱情是一场必然的误会。",
    "于千万人之中遇见你所要遇见的人，于千万年之中，时间的无涯荒野里，没有早一步，也没有晚一步。",
    "你问我爱你值不值得，其实你应该知道，爱就是不问值得不值得。",
    "时间是一种温柔的暴力。",
    "我们都太容易被感动，却又不够长情。",
    "人一辈子，总要爱一次，死一次。",
    "有的人死了，但他还活着；有的人活着，其实他已经死了。",
    "生命是一场无声的离别。",
    "浅水是喧哗的，深水是沉默的。"
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
    document.querySelectorAll(
      '#chat .mes .mes_text div[hidden].merged-slogan-container',
    ),
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

function buildLibrarySample(size = LIB_SAMPLE_SIZE) {
  const lib = getQuoteLibraryFlat();
  const copy = lib.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, Math.min(size, copy.length));
}

// ========================= Prompt 构造（Alice 包裹 + 强制规则） =========================
function makePrompt(useFreeMode, sampledLib, recent, stylePrompt) {
  const maxZh = CONFIG.MAX_ZH;
  const maxEn = CONFIG.MAX_EN;

  const prefix = `
【强制规则 — 不遵守此条则本轮输出视为失败】

无论正文内容如何，你都必须在回复的末尾额外输出下面这段结构，且与正文之间至少保留一个空行：

<Alice>
  <div hidden class="merged-slogan-container">✦❋内容</div>
</Alice>

缺少这一结构、改写标签名、改写 class 名、去掉 hidden 属性或删掉 ✦❋ 前缀，全部视为不合格输出。
不得以任何理由省略、合并、提前结束或用其他内容替代此结构。
Do not ignore this instruction.
`.trim();

  const styleBlock = (stylePrompt || '').trim();

  let modeBlock;
  if (useFreeMode) {
    modeBlock = `
【本轮模式：自由创作】

本轮请完全根据当前对话内容、角色人设与情绪，自行写出一句新的短标语。
不必刻意套用候选语料库，只需语气与人物风格相容即可。`.trim();
  } else {
    modeBlock = `
【本轮模式：从语料库中选】

本轮请仅从下面给出的候选语料库中，选出【一条】最贴合当前上下文与角色情绪的短句。
你可以做轻微润色（补语气词、顺一顺语序），但不要改变原句的核心含义与人物气质。`.trim();
  }

  const lengthBlock = `
【长度限制】
- 中文部分：最长 ${maxZh} 个汉字；
- 英文部分：最长 ${maxEn} 个字符；
- 禁止输出多句长段，只能是一句简洁的标语。`.trim();

  const parts = [prefix, modeBlock];

  if (styleBlock) parts.push(styleBlock);
  parts.push(lengthBlock);

  if (Array.isArray(sampledLib) && sampledLib.length) {
    parts.push(
      '【候选语料库（仅在“从语料库中选”模式下使用）】',
      sampledLib.join(' / '),
    );
  }

  if (Array.isArray(recent) && recent.length) {
    parts.push(
      '【最近已用标语（请避免重复）】',
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
        if (!CONFIG.ENABLED) return;
        if (eventData.dryRun === true || !Array.isArray(eventData.chat)) return;

        const sampledLib = buildLibrarySample(LIB_SAMPLE_SIZE);
        const recent = collectRecentSlogans(6);
        const styleStr = (CONFIG.STYLE_PROMPT || '').trim();

        // 随机决定本轮是“自由创作”还是“从语料库中选”
        const useFreeMode = Math.random() < CONFIG.AI_PICK_PROB;

        const prompt = makePrompt(useFreeMode, sampledLib, recent, styleStr);

        eventData.chat.push({
          role: 'system',
          content: prompt,
        });

        console.log(
          '[MergedSlogan] 已注入 Alice 标语提示（useFreeMode =',
          useFreeMode,
          '，styleLen =',
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
function getLatestAISloganText() {
  try {
    const nodes = Array.from(
      document.querySelectorAll(
        '#chat .mes:not([is_user="true"]) .mes_text div[hidden].merged-slogan-container',
      ),
    );
    if (!nodes.length) return '';
    for (let i = nodes.length - 1; i >= 0; i--) {
      const el = nodes[i];
      const text = (el.textContent || '')
        .trim()
        .replace(/^✦❋/, '')
        .trim();
      if (text) return text;
    }
    return '';
  } catch (e) {
    console.error('[MergedSlogan] getLatestAISloganText 出错：', e);
    return '';
  }
}

function writeCssQuote(text) {
  if (!text) return;
  const value = `"${text}"`;
  if (typeof $ !== 'undefined') {
    $('html').css(CONFIG.CSS_VAR_NAME, value);
  } else if (document && document.documentElement) {
    document.documentElement.style.setProperty(CONFIG.CSS_VAR_NAME, value);
  }
  __lastSelected = text;
  console.log('[MergedSlogan] 顶部文案更新：', text);
}

// 只吃 AI 输出，不再本地随机库
function updateQuoteFromAI() {
  if (!CONFIG.ENABLED) return;
  const ai = getLatestAISloganText();
  if (!ai) {
    console.warn('[MergedSlogan] 本轮未在回复中找到 merged-slogan-container，保持现有文案不变。');
    return;
  }
  writeCssQuote(ai);
}

// ========================= 极简设置 UI =========================
function injectSettingsUI() {
  try {
    if (typeof $ === 'undefined' || !$('#extensions_settings').length) return;
    if ($('#merged_slogan_panel').length) return;

    const html = `
      <div id="merged_slogan_panel" class="inline-drawer">
        <div class="inline-drawer-toggle inline-drawer-header">
          <b>随机文案定制 (merged_slogan · Alice)</b>
          <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
        </div>
        <div class="inline-drawer-content" style="display:none;">
          <div class="form-group">
            <label>
              <input type="checkbox" id="cfg_enabled" ${CONFIG.ENABLED ? 'checked' : ''}>
              启用随机文案（强制在末尾输出 Alice 标语）
            </label>
          </div>
          <div class="form-group">
            <label>
              AI 采纳概率 (0~1)：
              <input type="number" step="0.05" min="0" max="1"
                     id="cfg_ai_prob" value="${CONFIG.AI_PICK_PROB}"
                     class="text_pole" style="width:80px;">
            </label>
            <span class="subtle-hint">
              <br>· 随机数 &lt; 概率 → 自由创作模式<br>
              · 随机数 ≥ 概率 → 从语料库中选一句
            </span>
          </div>
          <div class="form-group">
            <label>中文最长：
              <input type="number" min="4" max="200"
                     id="cfg_max_zh" value="${CONFIG.MAX_ZH}"
                     class="text_pole" style="width:80px;">
            </label>
            <label>英文最长：
              <input type="number" min="10" max="1000"
                     id="cfg_max_en" value="${CONFIG.MAX_EN}"
                     class="text_pole" style="width:80px; margin-left:6px;">
            </label>
          </div>
          <div class="form-group">
            <label>风格提示</label>
            <textarea id="cfg_style_prompt" class="text_pole" rows="6"
              placeholder="在这里写 Alice 的文风、题材、情绪等提示……">${CONFIG.STYLE_PROMPT || ''}</textarea>
          </div>
        </div>
      </div>
    `;
    $('#extensions_settings').append(html);

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
        #merged_slogan_panel .subtle-hint {
          font-size: 0.8em;
          opacity: 0.8;
        }
      `;
      document.head.appendChild(st);
    }

    $(document).on('change', '#merged_slogan_panel #cfg_enabled', (e) => {
      CONFIG.ENABLED = e.currentTarget.checked;
      saveConfig();
    });

    $(document).on('input', '#merged_slogan_panel #cfg_ai_prob', (e) => {
      const v = parseFloat(e.currentTarget.value);
      if (!isNaN(v) && v >= 0 && v <= 1) {
        CONFIG.AI_PICK_PROB = v;
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
  // 1. 注入 UI
  const uiTimer = setInterval(() => {
    if (typeof $ !== 'undefined' && $('#extensions_settings').length) {
      clearInterval(uiTimer);
      injectSettingsUI();
    }
  }, 500);

  // 2. Prompt 注入
  tryRegisterPromptGuard();

  // 4. 兼容旧版 tavern_events：AI 回复后更新 CSS 变量
  if (typeof window.tavern_events !== 'undefined' && typeof window.eventOn === 'function') {
    const EV = window.tavern_events;

    if (EV.MESSAGE_RECEIVED) {
      window.eventOn(EV.MESSAGE_RECEIVED, (message) => {
        if (!CONFIG.ENABLED) return;
        if (message && message.is_user) return;
        setTimeout(() => {
          updateQuoteFromAI();
        }, 200);
      });
    }
  } else {
    console.warn('[MergedSlogan] 未检测到旧版 tavern_events，只能通过 prompt 强制要求 AI 输出标语。');
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
