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
    CHANGE_ON_AI_REPLY: true,      // AI 回复后是否自动换一句
    AI_PICK_PROB: 0.6,             // 非 AI-only 模式下，优先采用 AI 的概率
    REQUIRE_AI_VERBATIM: true,     // 只吃 data-verbatim="1"
    AI_ONLY: false,                // ✅ 新增：仅使用 AI 生成（禁用语料库）
    CONTEXT_AWARE: true,           // 是否向模型注入“生成标语”的提示
    LIB_SAMPLE_SIZE: 18,           // 候选语料库抽样条数（非 AI-only 时）
    MAX_ZH: 15,                    // 中文长度限制
    MAX_EN: 80,                    // 英文长度限制
    STYLE_PROMPT: '',              // ✅ 外部注入风格提示（UI 文本框）
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

  console.log('[MergedSlogan] config loaded:', ROOT_CFG);

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

  // 使用 SillyTavern 传入的 eventData.chat 构建上下文（不再自己截断）
  function buildContextFromChat(chatArr) {
    if (!Array.isArray(chatArr)) return '';
    const lines = [];
    for (const msg of chatArr) {
      if (!msg || typeof msg.content === 'undefined') continue;
      let text = '';
      if (typeof msg.content === 'string') {
        text = msg.content;
      } else if (Array.isArray(msg.content)) {
        text = msg.content.map((c) => (c && c.text) || '').join('\n');
      }
      text = String(text || '').trim();
      if (!text) continue;
      const role = msg.role || 'unknown';
      lines.push(`[${role}] ${text}`);
    }
    return lines.join('\n');
  }

  // ========================= 系统提示（原句隐藏标语） =========================
  function makePrompt(contextText, sampledLib, recent, stylePrompt) {
    const hasLib = Array.isArray(sampledLib) && sampledLib.length > 0;
    const styleBlock = (stylePrompt && stylePrompt.trim())
      ? stylePrompt.trim()
      : '请根据当前对话与角色人设，自行决定一句最贴合情绪与语境的短句。';

    return [
      '你需要在本次回复正文的末尾额外输出一个隐藏HTML元素，格式必须为：',
      '<div hidden class="slogan-container" data-verbatim="1">✦❋原句</div>',
      '',
      '【标语风格和要求（可选，由用户外部注入）】',
      styleBlock,
      '',
      '【对话上下文（已由前端裁剪）】',
      contextText || '(无)',
      '',
      '【候选语料库（可参考）】',
      hasLib ? JSON.stringify(sampledLib, null, 0) : '(本次不提供候选语料，完全依靠上下文与人设)',
      '',
      '【最近已用标语（需避免重复或近义复述）】',
      JSON.stringify(recent || [], null, 0),
      '',
      `【长度限制】中文 ≤ ${CONFIG.MAX_ZH} 字；英文 ≤ ${CONFIG.MAX_EN} 字符。`,
    ].join('\n');
  }

  function tryRegisterPromptGuard() {
    try {
      if (!window.tavern_events || !window.eventOn) {
        console.warn('[MergedSlogan] 未检测到 SillyTavern 事件，已做降级初始化（不注入提示）。');
        return;
      }
      const EV = window.tavern_events;
      if (!EV.CHAT_COMPLETION_PROMPT_READY) {
        console.warn('[MergedSlogan] tavern_events 中无 CHAT_COMPLETION_PROMPT_READY。');
        return;
      }

      window.eventOn(EV.CHAT_COMPLETION_PROMPT_READY, (eventData) => {
        if (!CONFIG.CONTEXT_AWARE) return;
        if (!eventData || !Array.isArray(eventData.chat)) return;

        const ctx = buildContextFromChat(eventData.chat);
        const recent = collectRecentSlogans(6);
        const lib = CONFIG.AI_ONLY ? [] : buildLibrarySample(CONFIG.LIB_SAMPLE_SIZE);
        const prompt = makePrompt(ctx, lib, recent, CONFIG.STYLE_PROMPT || '');

        eventData.chat.push({ role: 'system', content: prompt });
        console.log('[MergedSlogan] 已向本轮对话注入“标语生成”提示（AI_ONLY =', CONFIG.AI_ONLY, '）。');
      });
    } catch (e) {
      console.error('[MergedSlogan] 注册 CHAT_COMPLETION_PROMPT_READY 失败：', e);
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
      console.error('[MergedSlogan] getLatestAISloganVerbatim 出错：', e);
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
    if (CONFIG.AI_ONLY) {
      console.log('[MergedSlogan] AI-only 模式：初始化阶段不从语料库抽取文案，等待模型首次标语。');
      return;
    }
    const lib = getQuoteLibraryFlat();
    writeCssQuote(pickRandomAvoidRepeat(lib));
  }

  function setQuoteFromAIOrLibrary() {
    let chosen = '';

    // ① AI-only 模式：只依赖 AI，失败则保持原样
    if (CONFIG.AI_ONLY) {
      const ai = getLatestAISloganVerbatim();
      if (ai) {
        chosen = ai;
      } else {
        console.warn('[MergedSlogan] AI-only 模式下本轮未提取到标语，保持现有顶部文案不变。');
        return;
      }
      writeCssQuote(chosen);
      return;
    }

    // ② 普通模式：按概率优先使用 AI，否则用库
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
            <label><input type="checkbox" id="cfg_context_aware" ${CONFIG.CONTEXT_AWARE ? 'checked' : ''}> 注入上下文（让模型顺便想一句标语）</label>
          </div>
          <div class="form-group">
            <label><input type="checkbox" id="cfg_require_verbatim" ${CONFIG.REQUIRE_AI_VERBATIM ? 'checked' : ''}> 仅接受 data-verbatim="1"（真实摘录）</label>
          </div>
          <div class="form-group">
            <label><input type="checkbox" id="cfg_ai_only" ${CONFIG.AI_ONLY ? 'checked' : ''}> 仅使用 AI 生成（禁用语料库）</label>
          </div>
          <div class="form-group">
            <label>AI 采纳概率 (0~1)：<input type="number" step="0.05" min="0" max="1" id="cfg_ai_prob" value="${CONFIG.AI_PICK_PROB}" class="text_pole" style="width:80px;"></label>
          </div>
          <div class="form-group">
            <label>库抽样条数：<input type="number" min="1" max="60" id="cfg_lib_sample" value="${CONFIG.LIB_SAMPLE_SIZE}" class="text_pole" style="width:80px;"></label>
          </div>
          <div class="form-group">
            <label>中文最长：<input type="number" min="4" max="50" id="cfg_max_zh" value="${CONFIG.MAX_ZH}" class="text_pole" style="width:80px;"></label>
            <label>英文最长：<input type="number" min="10" max="300" id="cfg_max_en" value="${CONFIG.MAX_EN}" class="text_pole" style="width:80px; margin-left:6px;"></label>
          </div>
          <div class="form-group">
            <label>标语风格提示（可选，将直接注入给模型）</label>
            <textarea id="cfg_style_prompt" class="text_pole" rows="4" placeholder="例如：文艺忧郁、贴合当前章节情绪，不要玩梗或搞笑……">${CONFIG.STYLE_PROMPT || ''}</textarea>
          </div>
        </div>
      </div>
      <style>
        #merged_slogan_panel .form-group{margin:6px 0;}
        #merged_slogan_panel input.text_pole{padding:2px 6px;}
        #merged_slogan_panel textarea.text_pole{width:100%; padding:4px 6px;}
      </style>
      `;
      $('#extensions_settings').append(html);

      // 顶部文案配置事件
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
      $(document).on('change', '#merged_slogan_panel #cfg_ai_only', (e) => {
        CONFIG.AI_ONLY = e.currentTarget.checked;
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
    if (!wrapper) return;

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
    // 1. 注入 UI（文案 + 滚动）
    const uiTimer = setInterval(() => {
      if (typeof $ !== 'undefined' && $('#extensions_settings').length) {
        clearInterval(uiTimer);
        injectSettingsUI();
        injectScrollerUI();
      }
    }, 500);

    // 2. SillyTavern 事件：文案部分
    if (typeof window.tavern_events !== 'undefined' && typeof window.eventOn === 'function') {
      const EV = window.tavern_events;

      tryRegisterPromptGuard();

      setQuoteFromLibraryOnly();

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
      setQuoteFromLibraryOnly();
      console.warn('[MergedSlogan] 未检测到 SillyTavern 事件，已做降级初始化。');
    }

    // 3. 标语滚动核心
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
