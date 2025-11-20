import * as script from '../../../../script.js';
import { extension_settings } from '../../../extensions.js';

// ==========================================================
// 顶部标语宽度判断 + 本地文案库（与滚动模块解耦）
// ==========================================================

// 公共：计算文案宽度
function measureSloganWidth(text, pseudoStyle) {
    const span = document.createElement('span');
    span.textContent = text;
    span.style.position = 'absolute';
    span.style.visibility = 'hidden';
    span.style.whiteSpace = 'nowrap';

    if (pseudoStyle) {
        span.style.fontSize = pseudoStyle.fontSize;
        span.style.fontFamily = pseudoStyle.fontFamily;
        span.style.fontWeight = pseudoStyle.fontWeight;
        span.style.letterSpacing = pseudoStyle.letterSpacing;
    }

    document.body.appendChild(span);
    const w = span.offsetWidth;
    span.remove();
    return w;
}

// 公共：判断在指定 wrapper 上是否会溢出
function willSloganOverflow(text, wrapper, pseudoStyle) {
    if (!wrapper || !text) return false;
    const pseudo = pseudoStyle || getComputedStyle(wrapper, '::after');
    const textWidth = measureSloganWidth(`| ${text}`, pseudo);
    const boxWidth = wrapper.getBoundingClientRect().width;
    return textWidth > boxWidth;
}

// 公共：选取“当前视口里最靠下”的头像 wrapper
function getActiveWrapperForSlogan() {
    const chat = document.getElementById('chat');
    if (!chat) return null;

    const chatRect = chat.getBoundingClientRect();
    const wrappers = chat.querySelectorAll('.mes .mesAvatarWrapper');
    if (!wrappers.length) return null;

    let best = null;
    let bestBottom = -Infinity;

    wrappers.forEach(w => {
        const rect = w.getBoundingClientRect();
        if (rect.bottom <= chatRect.top || rect.top >= chatRect.bottom) return;
        if (rect.bottom > bestBottom) {
            bestBottom = rect.bottom;
            best = w;
        }
    });

    return best || null;
}

// 本地文案库：利用 willSloganOverflow 挑选合适宽度的句子
const LocalSloganLibrary = {
    // ✦ 这里是本地库的句子，你要扩就改这里 ✦
    QUOTES: [
    "Be yourself; everyone else is already taken.",
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
    ],

    pickRandom() {
        const list = this.QUOTES;
        if (!list || !list.length) return '';
        return list[Math.floor(Math.random() * list.length)];
    },

    // 根据给定 wrapper 宽度挑一句：
    // ① 优先“不溢出”
    // ② 全都溢出 → 选最短
    pickForWrapper(wrapper) {
        const list = this.QUOTES;
        if (!list || !list.length) return '';

        if (!wrapper) {
            return this.pickRandom();
        }

        const pseudo = getComputedStyle(wrapper, '::after');

        const safe = list.filter(q => !willSloganOverflow(q, wrapper, pseudo));
        if (safe.length) {
            return safe[Math.floor(Math.random() * safe.length)];
        }

        let best = list[0];
        for (const q of list) {
            if (q.length < best.length) best = q;
        }
        return best;
    },

    // 使用“当前视口内最靠下的一条消息”的头像宽度来挑句子
    pickForActiveWrapper() {
        const wrapper = getActiveWrapperForSlogan();
        return this.pickForWrapper(wrapper);
    },
};

// 小工具：如果你想手动强制用本地库覆盖一次 CSS 文案，可以在控制台调：applyLocalSloganToCssFromLibrary()
function applyLocalSloganToCssFromLibrary() {
    const text = LocalSloganLibrary.pickForActiveWrapper();
    if (!text) return;
    document.documentElement.style.setProperty('--自定义文案', `"${text.replace(/"/g, '\\"')}"`);
    console.log('[LocalSloganLibrary] 已写入本地标语:', text);
}

// ==========================================================
// 模块 2: 顶部标语 · Alice（不再走 AI，只用本地文案库）
// ==========================================================
const AliceSloganModule = {
    name: 'merged_slogan',
    CSS_VAR_NAME: '--自定义文案',
    initialized: false,
    updateDebounceTimer: null,

    defaultSettings: Object.freeze({
        enabled: true,
        maxZhLen: 50,
        maxEnLen: 300,
    }),

    getSettings() {
        if (!extension_settings[this.name]) {
            extension_settings[this.name] = { ...this.defaultSettings };
        }
        const st = extension_settings[this.name];
        for (const k of Object.keys(this.defaultSettings)) {
            if (st[k] === undefined) st[k] = this.defaultSettings[k];
        }
        return st;
    },

    saveSettings() { script.saveSettingsDebounced(); },

    renderSettingsHtml() {
        const s = this.getSettings();
        return `
            <div id="alice_slogan_options_wrapper">
                <hr>
                <h3 class="sub-header">顶部标语 · Alice（本地文案库）</h3>
                <div class="form-group">
                    <label for="alice_max_zh_len">中文最长:</label>
                    <input type="number" min="1" id="alice_max_zh_len" class="text_pole" value="${s.maxZhLen}">
                </div>
                <div class="form-group">
                    <label for="alice_max_en_len">英文最长:</label>
                    <input type="number" min="1" id="alice_max_en_len" class="text_pole" value="${s.maxEnLen}">
                </div>
                <p class="sub-label">标语完全来自本地文案库 LocalSloganLibrary，不再从 AI 输出中解析 &lt;Alice&gt; 块。</p>
            </div>`;
    },

    bindSettingsEvents() {
        $(document).on('input', '#alice_max_zh_len', (e) => {
            const v = parseInt($(e.currentTarget).val(), 10);
            const s = this.getSettings();
            s.maxZhLen = isNaN(v) ? 50 : Math.max(1, v);
            this.saveSettings();
            this.updateTopbar();
        });
        $(document).on('input', '#alice_max_en_len', (e) => {
            const v = parseInt($(e.currentTarget).val(), 10);
            const s = this.getSettings();
            s.maxEnLen = isNaN(v) ? 300 : Math.max(1, v);
            this.saveSettings();
            this.updateTopbar();
        });
    },

    trimByLength(text) {
        const s = this.getSettings();
        const { maxZhLen, maxEnLen } = s;
        let zh = 0, en = 0, out = '';
        for (const ch of text) {
            if (/[\u4e00-\u9fff]/.test(ch)) {
                zh++; if (zh > maxZhLen) break;
            } else {
                en++; if (en > maxEnLen) break;
            }
            out += ch;
        }
        return out.trim();
    },

    writeCssQuote(text) {
        if (!text) return;
        const root = document.documentElement;
        root.style.setProperty(this.CSS_VAR_NAME, `"${text.replace(/"/g, '\\"')}"`);
        console.log('[AliceSlogan] 写入 CSS 变量 --自定义文案:', text);

        // 通知滚动模块刷新一次（沿用你的原逻辑）
        if (typeof window.__sloganScrollerUpdate === 'function') {
            window.__sloganScrollerUpdate();
        }
    },

    // ⭐ 核心：完全不看 AI，只用本地文案库
    updateTopbar() {
        const s = this.getSettings();
        if (!s.enabled) return;

        let quote = '';
        try {
            if (typeof LocalSloganLibrary !== 'undefined' &&
                LocalSloganLibrary &&
                typeof LocalSloganLibrary.pickForActiveWrapper === 'function') {
                quote = LocalSloganLibrary.pickForActiveWrapper();
            }
        } catch (e) {
            console.error('[AliceSlogan] 本地文案库挑选失败:', e);
        }

        if (!quote) {
            return;
        }

        quote = this.trimByLength(quote);
        this.writeCssQuote(quote);
    },

    // 不再注入任何 AI 提示，只在消息渲染后刷新一次顶部文案
    onMessageRendered() {
        const s = this.getSettings();
        if (!s.enabled) return;
        clearTimeout(this.updateDebounceTimer);
        this.updateDebounceTimer = setTimeout(() => this.updateTopbar(), 600);
    },

    init() {
        if (this.initialized || !script.eventSource || !script.event_types) return;
        script.eventSource.on(script.event_types.CHARACTER_MESSAGE_RENDERED, this.onMessageRendered.bind(this));
        script.eventSource.on(script.event_types.MESSAGE_SWIPED, this.onMessageRendered.bind(this));
        script.eventSource.on(script.event_types.MESSAGE_DELETED, this.onMessageRendered.bind(this));
        this.initialized = true;
        console.log('[AliceSlogan] 顶部标语模块初始化完成（仅本地文案库）');
    },
};

// ==========================================================
// 模块 5: 顶部标语滚动 · SloganScrollerModule（按你原始逻辑保留）
// ==========================================================
const SloganScrollerModule = {
    name: 'slogan_scroller',
    initialized: false,
    observer: null,
    _scrollTimer: null,
    _resizeTimer: null,

    lastWrapper: null,
    lastText: '',
    lastNeedScroll: null,
    lastSpeed: null,

    defaultSettings: Object.freeze({
        enabled: true,
        delayMs: 0,
        speedSec: 26,
        debounceMs: 500,
    }),

    getSettings() {
        if (!extension_settings[this.name]) {
            extension_settings[this.name] = { ...this.defaultSettings };
        }
        const st = extension_settings[this.name];
        for (const k of Object.keys(this.defaultSettings)) {
            if (st[k] === undefined) st[k] = this.defaultSettings[k];
        }
        return st;
    },

    saveSettings() {
        script.saveSettingsDebounced();
    },

    renderSettingsHtml() {
        const st = this.getSettings();
        return `
            <div id="slogan_scroller_options_wrapper">
                <hr>
                <h3 class="sub-header">顶部标语滚动</h3>
                <div class="form-group">
                    <label>
                        <input type="checkbox" id="slogan_scroller_enable" ${st.enabled ? 'checked' : ''}>
                        启用标语滚动（文案过长时自动横向滚动）
                    </label>
                </div>
                <div class="form-group">
                    <label for="slogan_scroller_delay">开始滚动延迟（秒）:</label>
                    <input type="number" step="0.5" min="0" max="30"
                           id="slogan_scroller_delay"
                           class="text_pole" style="width:80px;"
                           value="${(st.delayMs / 1000).toFixed(st.delayMs % 1000 ? 1 : 0)}">
                </div>
                <div class="form-group">
                    <label for="slogan_scroller_speed">滚动一圈用时（秒）:</label>
                    <input type="number" step="1" min="5" max="120"
                           id="slogan_scroller_speed"
                           class="text_pole" style="width:80px;"
                           value="${st.speedSec}">
                </div>
                <p class="sub-label">需要配合你已有的 CSS：.mes .mesAvatarWrapper.slogan-scroll::after 做无缝跑马灯。</p>
            </div>
        `;
    },

    bindSettingsEvents() {
        $(document).on('change', '#slogan_scroller_enable', (e) => {
            const st = this.getSettings();
            st.enabled = e.currentTarget.checked;
            this.saveSettings();
            if (st.enabled) {
                this.ensureCoreListeners();
                this.updateSloganScrollImmediate();
            } else {
                this.clearAllScroll();
            }
        });

        $(document).on('input change', '#slogan_scroller_delay', (e) => {
            const st = this.getSettings();
            const v = parseFloat(e.currentTarget.value);
            if (!isNaN(v) && v >= 0) {
                st.delayMs = v * 1000;
                this.saveSettings();
            }
        });

        $(document).on('input change', '#slogan_scroller_speed', (e) => {
            const st = this.getSettings();
            const v = parseFloat(e.currentTarget.value);
            if (!isNaN(v) && v > 0) {
                st.speedSec = v;
                this.saveSettings();
                this.updateSloganScrollImmediate();
            }
        });
    },

    getSloganFromCss() {
        const rootStyle = getComputedStyle(document.documentElement);
        let s = rootStyle.getPropertyValue('--自定义文案') || '';
        s = s.replace(/^["']|["']$/g, '').trim();
        return s;
    },

    measureTextWidth(text, pseudoStyle) {
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
    },

    getActiveWrapper() {
        const chat = document.getElementById('chat');
        if (!chat) return null;

        const chatRect = chat.getBoundingClientRect();
        const wrappers = chat.querySelectorAll('.mes .mesAvatarWrapper');
        if (!wrappers.length) return null;

        let best = null;
        let bestBottom = -Infinity;

        wrappers.forEach(w => {
            const rect = w.getBoundingClientRect();
            if (rect.bottom <= chatRect.top || rect.top >= chatRect.bottom) return;
            if (rect.bottom > bestBottom) {
                bestBottom = rect.bottom;
                best = w;
            }
        });

        return best || null;
    },

    clearAllScroll() {
        document
            .querySelectorAll('#chat .mes .mesAvatarWrapper.slogan-scroll')
            .forEach(el => {
                el.classList.remove('slogan-scroll');
                el.style.animationDuration = '';
            });
        this.lastWrapper = null;
        this.lastText = '';
        this.lastNeedScroll = null;
        this.lastSpeed = null;
    },

    updateSloganScrollImmediate() {
        const st = this.getSettings();
        if (!st.enabled) {
            this.clearAllScroll();
            return;
        }

        const wrapper = this.getActiveWrapper();
        if (!wrapper) {
            this.clearAllScroll();
            return;
        }

        document
            .querySelectorAll('#chat .mes .mesAvatarWrapper.slogan-scroll')
            .forEach(el => {
                if (el !== wrapper) {
                    el.classList.remove('slogan-scroll');
                    el.style.animationDuration = '';
                }
            });

        const currentSlogan = this.getSloganFromCss();
        if (!currentSlogan) {
            wrapper.classList.remove('slogan-scroll');
            wrapper.style.animationDuration = '';
            this.lastWrapper = wrapper;
            this.lastText = '';
            this.lastSpeed = st.speedSec;
            this.lastNeedScroll = false;
            return;
        }

        const pseudo = getComputedStyle(wrapper, '::after');
        const textWidth = this.measureTextWidth(`| ${currentSlogan}`, pseudo);
        const boxWidth = wrapper.getBoundingClientRect().width;
        const needScroll = textWidth > boxWidth;

        if (!needScroll) {
            wrapper.classList.remove('slogan-scroll');
            wrapper.style.animationDuration = '';
            this.lastWrapper = wrapper;
            this.lastText = currentSlogan;
            this.lastSpeed = st.speedSec;
            this.lastNeedScroll = false;
            return;
        }

        const sameTarget  = wrapper === this.lastWrapper;
        const sameText    = currentSlogan === this.lastText;
        const sameSpeed   = st.speedSec === this.lastSpeed;
        const wasScrolling = wrapper.classList.contains('slogan-scroll');

        this.lastWrapper = wrapper;
        this.lastText = currentSlogan;
        this.lastSpeed = st.speedSec;
        this.lastNeedScroll = true;

        if (sameTarget && sameText && sameSpeed && wasScrolling) {
            return;
        }

        wrapper.classList.remove('slogan-scroll');
        void wrapper.offsetWidth;
        wrapper.style.animationDuration = `${st.speedSec}s`;
        wrapper.classList.add('slogan-scroll');
    },
    
    ensureCoreListeners() {
        if (this.initialized) return;

        const st = this.getSettings();
        const chat = document.getElementById('chat');

        window.__sloganScrollerUpdate = this.updateSloganScrollImmediate.bind(this);

        if (chat) {
            this.observer = new MutationObserver(() => {
                this.updateSloganScrollImmediate();
            });
            this.observer.observe(chat, { childList: true, subtree: false });

            const scrollHandler = () => {
                if (this._scrollTimer) clearTimeout(this._scrollTimer);
                this._scrollTimer = setTimeout(() => {
                    this.updateSloganScrollImmediate();
                }, st.debounceMs);
            };
            chat.addEventListener('scroll', scrollHandler, { passive: true });
            this._scrollHandler = scrollHandler;
        }

        const resizeHandler = () => {
            if (this._resizeTimer) clearTimeout(this._resizeTimer);
            this._resizeTimer = setTimeout(() => {
                this.updateSloganScrollImmediate();
            }, st.debounceMs);
        };
        window.addEventListener('scroll', resizeHandler, { passive: true });
        window.addEventListener('resize', resizeHandler);
        this._resizeHandler = resizeHandler;

        this.initialized = true;
        console.log('[SloganScroller] 核心监听已安装');
    },

    destroy() {
        this.clearAllScroll();

        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }

        const chat = document.getElementById('chat');
        if (chat && this._scrollHandler) {
            chat.removeEventListener('scroll', this._scrollHandler);
        }
        if (this._resizeHandler) {
            window.removeEventListener('scroll', this._resizeHandler);
            window.removeEventListener('resize', this._resizeHandler);
        }

        this.initialized = false;
        window.__sloganScrollerUpdate = null;
        console.log('[SloganScroller] 已销毁监听');
    },

    init() {
        const st = this.getSettings();
        if (!st.enabled) {
            console.log('[SloganScroller] 已禁用，跳过初始化');
            return;
        }
        this.ensureCoreListeners();
        this.updateSloganScrollImmediate();
        console.log('[SloganScroller] 顶部标语滚动模块初始化完成');
    },
};

// ###################################################################
//  主入口 & UI（只包含 Alice + 滚动）
// ###################################################################
function initializeSloganExtension() {
    try {
        const html = `
            <div id="slogan_settings" class="inline-drawer">
                <div class="inline-drawer-toggle inline-drawer-header">
                    <b>顶部标语 · Alice + 滚动</b>
                    <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
                </div>
                <div class="inline-drawer-content" style="display:none;">
                    <label class="checkbox_label">
                        <input type="checkbox" id="misc_alice_slogan_toggle" ${AliceSloganModule.getSettings().enabled ? 'checked' : ''}>
                        <span>顶部标语 · Alice（本地文案库）</span>
                    </label>
                    <label class="checkbox_label">
                        <input type="checkbox" id="slogan_scroller_toggle" ${SloganScrollerModule.getSettings().enabled ? 'checked' : ''}>
                        <span>顶部标语滚动</span>
                    </label>

                    <div id="alice_slogan_settings_panel" style="${AliceSloganModule.getSettings().enabled ? '' : 'display:none;'}">
                        ${AliceSloganModule.renderSettingsHtml()}
                    </div>
                    <div id="slogan_scroller_settings_panel" style="${SloganScrollerModule.getSettings().enabled ? '' : 'display:none;'}">
                        ${SloganScrollerModule.renderSettingsHtml()}
                    </div>
                </div>
            </div>
            <style>
                #slogan_settings h3.sub-header { font-size:1em; margin-top:15px; margin-bottom:10px; }
            </style>
        `;
        $('#extensions_settings').append(html);

        // 开关事件
        $(document).on('change', '#misc_alice_slogan_toggle', (e) => {
            const on = $(e.currentTarget).is(':checked');
            AliceSloganModule.getSettings().enabled = on;
            $('#alice_slogan_settings_panel').toggle(on);
            script.saveSettingsDebounced();
            if (on) {
                AliceSloganModule.updateTopbar();
            }
        });

        $(document).on('change', '#slogan_scroller_toggle', (e) => {
            const on = $(e.currentTarget).is(':checked');
            SloganScrollerModule.getSettings().enabled = on;
            $('#slogan_scroller_settings_panel').toggle(on);
            script.saveSettingsDebounced();
            if (on) {
                SloganScrollerModule.init();
            } else {
                SloganScrollerModule.destroy();
            }
        });

        // 绑定设置事件
        AliceSloganModule.bindSettingsEvents();
        SloganScrollerModule.bindSettingsEvents();

        // 初始化模块
        AliceSloganModule.init();
        SloganScrollerModule.init();

        console.log('[Alice+SloganScroller] 顶部标语 + 滚动扩展加载完成');
    } catch (e) {
        console.error('[Alice+SloganScroller] 初始化异常:', e);
    }
}

// 等待设置页就绪
const settingsCheckInterval = setInterval(() => {
    if (window.$ && $('#extensions_settings').length) {
        clearInterval(settingsCheckInterval);
        initializeSloganExtension();
    }
}, 500);
