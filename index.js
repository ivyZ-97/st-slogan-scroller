import * as script from '../../../../script.js';
import { extension_settings } from '../../../extensions.js';

// ===================================================================
//
//  小杂物集 (Misc Utilities) + Alice/Eric 标语 + 顶部滚动  v1.3.0
//  - 模块1: 模型名称显示 (Model Display)
//  - 模块2: 顶部标语 · Alice（merged_slogan，写入 --自定义文案）
//  - 模块3: 输入框文字替换 + 标语摘录（成功案例，包装成 <Eric>）
//  - 模块4: Eric 标语摘录模块（只负责 .slogan-container -> 输入框）
//  - 模块5: 顶部标语滚动（只读 --自定义文案，给头像加 .slogan-scroll）
//
// ===================================================================

//  模块 1: 模型名称显示
const ModelDisplayModule = {
    name: 'model_display',
    CURRENT_SCRIPT_VERSION: '1.3.0',
    modelHistory: {},
    chatContentObserver: null,
    chatContainerObserver: null,
    processingMessages: new Set(),
    pendingProcessing: new Map(),

    defaultSettings: Object.freeze({
        enabled: true,
        fontSize: '0.85em',
        prefix: '|',
        suffix: '|',
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
        this.rerenderAllModelNames();
    },

    renderSettingsHtml() {
        const s = this.getSettings();
        return `
        <div id="model_display_options_wrapper">
            <hr>
            <h3 class="sub-header">模型名称显示</h3>

            <div class="form-group">
                <label for="model_display_font_size">字体大小:</label>
                <div>
                    <input type="text" id="model_display_font_size" class="text_pole"
                           placeholder="例如: 0.85em" value="${s.fontSize}">
                </div>
            </div>

            <div class="form-group">
                <label for="model_display_prefix">前缀:</label>
                <div>
                    <input type="text" id="model_display_prefix" class="text_pole"
                           placeholder="输入前缀..." value="${s.prefix}">
                </div>
            </div>

            <div class="form-group">
                <label for="model_display_suffix">后缀:</label>
                <div>
                    <input type="text" id="model_display_suffix" class="text_pole"
                           placeholder="输入后缀..." value="${s.suffix}">
                </div>
            </div>
        </div>`;
    },

    bindSettingsEvents() {
        $(document).on('input', '#model_display_font_size', (e) => {
            this.getSettings().fontSize = $(e.currentTarget).val();
            this.saveSettings();
        });
        $(document).on('input', '#model_display_prefix', (e) => {
            this.getSettings().prefix = $(e.currentTarget).val();
            this.saveSettings();
        });
        $(document).on('input', '#model_display_suffix', (e) => {
            this.getSettings().suffix = $(e.currentTarget).val();
            this.saveSettings();
        });
    },

    deepQuerySelector(selector, root = document) {
        try {
            const found = root.querySelector(selector);
            if (found) return found;
            for (const el of root.querySelectorAll('*')) {
                if (el.shadowRoot) {
                    const f2 = el.shadowRoot.querySelector(selector);
                    if (f2) return f2;
                }
            }
        } catch (e) {
            console.warn('[模型显示] 深度查询异常:', e);
        }
        return null;
    },

    getMessageId(mes) {
        const idEl = mes.querySelector('.mesIDDisplay');
        return idEl ? idEl.textContent.replace('#', '') : null;
    },

    getCurrentModelName(mes) {
        const iconSvg = this.deepQuerySelector('.timestamp-icon', mes);
        if (!iconSvg) return null;
        const svgTitle = iconSvg.querySelector('title');
        if (svgTitle && svgTitle.textContent.includes(' - ')) {
            return svgTitle.textContent.split(' - ')[1];
        }
        return null;
    },

    processIcon(iconSvg, modelName) {
        if (iconSvg.dataset.modelInjected === 'true') return;
        const s = this.getSettings();
        const fullText = `${s.prefix}${modelName}${s.suffix}`;
        const h = iconSvg.getBoundingClientRect().height || 22;

        iconSvg.innerHTML = '';
        iconSvg.removeAttribute('viewBox');

        const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        t.textContent = fullText;
        t.setAttribute('y', '50%');
        t.setAttribute('dominant-baseline', 'middle');
        t.style.fill = 'var(--underline_text_color)';
        t.style.fontSize = s.fontSize;
        iconSvg.appendChild(t);

        requestAnimationFrame(() => {
            try {
                const w = t.getBBox().width;
                iconSvg.style.width = w + 'px';
                iconSvg.style.height = h + 'px';
                iconSvg.setAttribute('viewBox', `0 0 ${w} ${h}`);
                iconSvg.dataset.modelInjected = 'true';
            } catch (e) {
                console.error('[模型显示] 渲染出错:', e);
            }
        });
    },

    rerenderAllModelNames() {
        if (!this.getSettings().enabled) return;
        document.querySelectorAll('#chat .mes:not([is_user="true"])').forEach(mes => {
            const icon = this.deepQuerySelector('.icon-svg.timestamp-icon', mes);
            const id = this.getMessageId(mes);
            if (icon && id && this.modelHistory[id]) {
                this.processIcon(icon, this.modelHistory[id]);
            }
        });
    },

    waitForElementAndProcess(mes, timeout = 8000) {
        if (!mes || mes.getAttribute('is_user') === 'true') return;
        const id = this.getMessageId(mes);
        if (!id || id === '0' || id === '1') return;
        if (this.processingMessages.has(id)) return;
        this.processingMessages.add(id);

        const start = Date.now();
        let cnt = 0;
        const loop = () => {
            cnt++;
            if (Date.now() - start > timeout) {
                this.processingMessages.delete(id);
                console.warn(`[模型显示] 等待 #${id} 超时 (${cnt})`);
                return;
            }
            const iconSvg = this.deepQuerySelector('.icon-svg.timestamp-icon', mes);
            if (!iconSvg) {
                setTimeout(loop, 100);
                return;
            }
            const name = this.getCurrentModelName(mes);
            if (name) {
                this.processingMessages.delete(id);
                this.modelHistory[id] = name;
                this.processIcon(iconSvg, name);
            } else {
                setTimeout(loop, Math.min(200 + cnt * 50, 1000));
            }
        };
        setTimeout(loop, 100);
    },

    processAndRecordMessage(mes) {
        const id = this.getMessageId(mes);
        if (!id) return;
        if (this.pendingProcessing.has(id)) {
            clearTimeout(this.pendingProcessing.get(id));
        }
        const t = setTimeout(() => {
            this.pendingProcessing.delete(id);
            this.waitForElementAndProcess(mes);
        }, 50);
        this.pendingProcessing.set(id, t);
    },

    restoreAllFromHistory() {
        if (!this.getSettings().enabled) return;
        setTimeout(() => {
            document.querySelectorAll('#chat .mes:not([is_user="true"])').forEach(mes => {
                const icon = this.deepQuerySelector('.icon-svg.timestamp-icon', mes);
                const id = this.getMessageId(mes);
                if (icon && id && icon.dataset.modelInjected !== 'true') {
                    if (this.modelHistory[id]) {
                        this.processIcon(icon, this.modelHistory[id]);
                    } else {
                        this.processAndRecordMessage(mes);
                    }
                }
            });
        }, 500);
    },

    startObservers() {
        this.stopObservers();
        const chat = document.getElementById('chat');
        if (chat) {
            this.chatContentObserver = new MutationObserver(muts => {
                for (const m of muts) {
                    if (m.type === 'childList') {
                        const add = [];
                        m.addedNodes.forEach(node => {
                            if (node.nodeType === 1) {
                                if (node.matches && node.matches('.mes')) add.push(node);
                                else if (node.querySelectorAll) {
                                    node.querySelectorAll('.mes').forEach(x => add.push(x));
                                }
                            }
                        });
                        if (add.length) {
                            requestAnimationFrame(() => {
                                add.forEach(mes => this.processAndRecordMessage(mes));
                            });
                        }
                    }
                }
            });
            this.chatContentObserver.observe(chat, { childList: true, subtree: false });
        }

        this.chatContainerObserver = new MutationObserver(muts => {
            for (const m of muts) {
                if (m.type === 'childList') {
                    for (const n of m.addedNodes) {
                        if (n.nodeType === 1 && n.id === 'chat') {
                            this.restoreAllFromHistory();
                            this.startObservers();
                            break;
                        }
                    }
                }
            }
        });
        this.chatContainerObserver.observe(document.body, { childList: true, subtree: false });
    },

    stopObservers() {
        if (this.chatContentObserver) { this.chatContentObserver.disconnect(); this.chatContentObserver = null; }
        if (this.chatContainerObserver) { this.chatContainerObserver.disconnect(); this.chatContainerObserver = null; }
        for (const [, t] of this.pendingProcessing) clearTimeout(t);
        this.pendingProcessing.clear();
        this.processingMessages.clear();
    },

    init() {
        if (this.getSettings().enabled) {
            this.startObservers();
            this.restoreAllFromHistory();
        }
        const indicator = $('#model_display_version_indicator');
        if (indicator.length) {
            indicator.text(`v${this.CURRENT_SCRIPT_VERSION}`);
            indicator.css('cursor', 'default').attr('title', '修改版，无自动更新。');
        }
        console.log('[模型显示] 初始化完成');
    },
};

//  模块 2: 顶部标语 · Alice（只吃 merged-slogan-container）
const AliceSloganModule = {
    name: 'merged_slogan',
    CSS_VAR_NAME: '--自定义文案',
    HIDDEN_CLASS: 'merged-slogan-container',
    initialized: false,
    lastQuoteIndex: -1,
    updateDebounceTimer: null,

    defaultSettings: Object.freeze({
        enabled: true,
        aiPickProb: 0.6,
        maxZhLen: 50,
        maxEnLen: 300,
        styleHint:
            '你是Alice，你喜欢细腻散漫又不失一针见血的理智的风格，' +
            '为当前角色生成一条具有角色个人风格的座右铭或当前评注；' +
            '语气贴近当前剧情与人物状态，但不解释剧情本身。' +
            '标语不要重复，也不要额外解释。'
    }),

    BASE_QUOTES: [
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
        "浅水是喧哗的，深水是沉默的。",
    ],

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
                <h3 class="sub-header">顶部标语 · Alice</h3>
                <div class="form-group">
                    <label for="alice_ai_pick_prob">AI 采纳概率 (0~1):</label>
                    <input type="number" step="0.01" min="0" max="1"
                           id="alice_ai_pick_prob" class="text_pole" value="${s.aiPickProb}">
                </div>
                <div class="form-group">
                    <label for="alice_max_zh_len">中文最长:</label>
                    <input type="number" min="1" id="alice_max_zh_len" class="text_pole" value="${s.maxZhLen}">
                </div>
                <div class="form-group">
                    <label for="alice_max_en_len">英文最长:</label>
                    <input type="number" min="1" id="alice_max_en_len" class="text_pole" value="${s.maxEnLen}">
                </div>
                <div class="form-group">
                    <label for="alice_style_hint">风格提示:</label>
                    <textarea id="alice_style_hint" class="text_pole" rows="4">${s.styleHint}</textarea>
                </div>
                <p class="sub-label">只从 &lt;div hidden class="merged-slogan-container"&gt; 中取文案，不会读 .slogan-container。</p>
            </div>`;
    },

    bindSettingsEvents() {
        $(document).on('input', '#alice_ai_pick_prob', (e) => {
            const v = parseFloat($(e.currentTarget).val());
            const s = this.getSettings();
            s.aiPickProb = isNaN(v) ? 0.6 : Math.max(0, Math.min(1, v));
            this.saveSettings();
        });
        $(document).on('input', '#alice_max_zh_len', (e) => {
            const v = parseInt($(e.currentTarget).val(), 10);
            const s = this.getSettings();
            s.maxZhLen = isNaN(v) ? 50 : Math.max(1, v);
            this.saveSettings();
        });
        $(document).on('input', '#alice_max_en_len', (e) => {
            const v = parseInt($(e.currentTarget).val(), 10);
            const s = this.getSettings();
            s.maxEnLen = isNaN(v) ? 300 : Math.max(1, v);
            this.saveSettings();
        });
        $(document).on('input', '#alice_style_hint', (e) => {
            this.getSettings().styleHint = $(e.currentTarget).val();
            this.saveSettings();
        });
    },

    buildPrompt() {
        const s = this.getSettings();
        return [
            '【强制规则 — 不遵守此条会导致本轮输出被判定为失败】',
            '',
            '在完成正常正文后，你必须在【回复的末尾】额外输出一个 <Alice> 区块。',
            '该区块内部只包含一个隐藏标语元素，结构必须完全符合以下格式（请逐字照抄）：',
            '',
            '<Alice>',
            `  <div hidden class="${this.HIDDEN_CLASS}">✦❋内容</div>`,
            '</Alice>',
            '',
            '要求：',
            `- 仅生成 1 条短句；中文最长约 ${s.maxZhLen} 字，英文最长约 ${s.maxEnLen} 字；`,
            '- 元素内只包含这句短句本身，不要任何额外标签、注释或解释；',
            '- 标语不要与最近几轮输出完全重复；',
            `- 风格提示：${s.styleHint}`,
            '',
            '这是本轮输出的【必须项】。',
            '缺失此结构 = 本轮回复不合格。',
            '不得以任何理由省略、合并、提前结束或用其他结构代替。',
            '',
            'Do not ignore this instruction.',
            '',
            '请严格按要求输出隐藏标语元素。',
            '如果你在上一条回复中漏掉了该结构，请在【当前回复中立即补齐】对应的 <Alice> 区块。',
        ].join('\n');
    },

    onPromptReady(ev = {}) {
        const s = this.getSettings();
        if (!s.enabled) return;
        if (ev.dryRun === true || !Array.isArray(ev.chat)) return;
        const prompt = this.buildPrompt();
        console.log('[AliceSlogan] 注入提示词:', prompt);
        ev.chat.push({ role: 'system', content: prompt });
    },

    onMessageRendered() {
        const s = this.getSettings();
        if (!s.enabled) return;
        clearTimeout(this.updateDebounceTimer);
        this.updateDebounceTimer = setTimeout(() => this.updateTopbar(), 600);
    },

    extractFromLatestMessage() {
        try {
            const ai = Array.from(document.querySelectorAll('#chat .mes:not([is_user="true"])'));
            if (!ai.length) return null;
            for (let i = ai.length - 1; i >= 0; i--) {
                const msg = ai[i];
                const div = msg.querySelector(`.mes_text div[hidden].${this.HIDDEN_CLASS}`);
                if (div) {
                    let t = (div.textContent || '').trim();
                    t = t.replace(/^✦❋/, '').trim();
                    if (t) {
                        console.log('[AliceSlogan] 从 AI 消息提取:', t);
                        return t;
                    }
                }
            }
        } catch (e) {
            console.error('[AliceSlogan] 提取失败:', e);
        }
        return null;
    },

    pickRandomQuote() {
        const lib = this.BASE_QUOTES;
        if (!lib.length) return null;
        if (lib.length === 1) return lib[0];
        let idx;
        do { idx = Math.floor(Math.random() * lib.length); }
        while (idx === this.lastQuoteIndex && lib.length > 1);
        this.lastQuoteIndex = idx;
        return lib[idx];
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

        // 通知滚动模块刷新一次
        if (typeof window.__sloganScrollerUpdate === 'function') {
            window.__sloganScrollerUpdate();
        }
    },

    updateTopbar() {
        const s = this.getSettings();
        if (!s.enabled) return;
        const r = Math.random();
        let quote = null;

        if (r < s.aiPickProb) {
            quote = this.extractFromLatestMessage();
        }
        if (!quote) {
            quote = this.pickRandomQuote();
        }
        if (!quote) return;

        quote = this.trimByLength(quote);
        this.writeCssQuote(quote);
    },

    init() {
        if (this.initialized || !script.eventSource || !script.event_types) return;
        script.eventSource.on(script.event_types.CHAT_COMPLETION_PROMPT_READY, this.onPromptReady.bind(this));
        script.eventSource.on(script.event_types.CHARACTER_MESSAGE_RENDERED, this.onMessageRendered.bind(this));
        script.eventSource.on(script.event_types.MESSAGE_SWIPED, this.onMessageRendered.bind(this));
        script.eventSource.on(script.event_types.MESSAGE_DELETED, this.onMessageRendered.bind(this));
        this.initialized = true;
        console.log('[AliceSlogan] 顶部标语模块初始化完成');
    },
};

//  模块 3: 输入框文字替换 · Eric
const PlaceholderModule = {
    name: 'worldbook_placeholder',
    iframeWindow: null,
    placeholderObserver: null,
    TEXTAREA_ID: 'send_textarea',

    defaultSettings: Object.freeze({
        enabled: true,
        customPlaceholder: '',
        placeholderSource: 'custom',
        sloganPrompt: [
            '你是Eric，你喜欢风趣幽默而不失敏锐进攻性的风格，' +
            '为当前角色生成极具角色个人风格的语录，格式模仿座右铭、网络用语、另类名言、爱语、吐槽等形式，具备黑色幽默感，最长 15 个汉字。' +
            '语气贴近当前剧情与人物状态，但不解释剧情本身。' +
            '标语不要重复，也不要额外解释。'
        ].join('\n'),
    }),

    currentSlogan: null,
    isSwitchingCharacter: false,
    worldbookUpdateDebounce: null,

    getSettings() {
        if (!extension_settings[this.name]) {
            extension_settings[this.name] = { ...this.defaultSettings };
        }
        const st = extension_settings[this.name];
        for (const k of Object.keys(this.defaultSettings)) {
            if (st[k] === undefined) st[k] = this.defaultSettings[k];
        }
        if (!['custom', 'auto', 'worldbook'].includes(st.placeholderSource)) {
            st.placeholderSource = 'custom';
        }
        return st;
    },

    resolveFallbackPlaceholder(textarea) {
        return textarea.getAttribute('connected_text') || '输入想发送的消息，或输入 /? 获取帮助';
    },

    setAutoSlogan(text) {
        const s = text && text.trim();
        if (!s) return;
        console.log('[Placeholder] 设置标语:', s);
        this.currentSlogan = s;
        const st = this.getSettings();
        if (st.enabled && st.placeholderSource === 'auto') this.applyLogic();
    },

    getCurrentAutoSlogan() { return this.currentSlogan || ''; },

    async applyLogic() {
        if (!this.getSettings().enabled) return;
        const textarea = document.getElementById(this.TEXTAREA_ID);
        if (!textarea) return;

        const st = this.getSettings();
        const mode = st.placeholderSource;
        const custom = st.customPlaceholder.trim();
        const def = this.resolveFallbackPlaceholder(textarea);

        this.stopPlaceholderObserver();

        if (mode === 'custom') {
            if (!custom) {
                await this.applyAutoModeWithFallback(textarea, def);
            } else {
                textarea.placeholder = custom;
                this.startPlaceholderObserver();
            }
            return;
        }

        if (mode === 'auto') {
            await this.applyAutoModeWithFallback(textarea, def); return;
        }
        if (mode === 'worldbook') {
            await this.applyWorldBookModeWithFallback(textarea, def); return;
        }
    },

    async applyAutoModeWithFallback(textarea, def) {
        const s = this.getCurrentAutoSlogan();
        if (s) { textarea.placeholder = s; return; }
        const world = await this.applyWorldBookLogic(textarea, { setPlaceholder: false });
        if (world && world !== def) { textarea.placeholder = world; return; }
        textarea.placeholder = def;
    },

    async applyWorldBookModeWithFallback(textarea, def) {
        const world = await this.applyWorldBookLogic(textarea, { setPlaceholder: false });
        if (world && world !== def) textarea.placeholder = world;
        else textarea.placeholder = def;
    },

    async applyWorldBookLogic(textarea, { setPlaceholder = true } = {}) {
        let result = this.resolveFallbackPlaceholder(textarea);
        try {
            if (this.iframeWindow && this.iframeWindow.getCurrentCharPrimaryLorebook && this.iframeWindow.getLorebookEntries) {
                const lb = await this.iframeWindow.getCurrentCharPrimaryLorebook();
                if (lb) {
                    const entries = await this.iframeWindow.getLorebookEntries(lb);
                    if (Array.isArray(entries)) {
                        const t = entries.find(e => e.comment === '输入框');
                        if (t && typeof t.content === 'string' && t.content.trim()) {
                            result = t.content;
                        }
                    }
                }
            }
        } catch (e) {
            console.error('[Placeholder] 读取世界书出错:', e);
        }
        if (setPlaceholder) textarea.placeholder = result;
        return result;
    },

    async waitForIframe() {
        return new Promise(resolve => {
            const it = setInterval(() => {
                const iframe = document.querySelector('iframe');
                if (iframe && iframe.contentWindow) {
                    clearInterval(it);
                    this.iframeWindow = iframe.contentWindow;
                    resolve();
                }
            }, 100);
        });
    },

    async onCharacterSwitch() {
        if (this.isSwitchingCharacter) return;
        this.isSwitchingCharacter = true;
        try {
            const textarea = document.getElementById(this.TEXTAREA_ID);
            if (textarea) {
                textarea.placeholder = this.resolveFallbackPlaceholder(textarea);
            }
            await new Promise(r => setTimeout(r, 300));
            this.currentSlogan = null;

            const st = this.getSettings();
            if (st.placeholderSource === 'worldbook') {
                await this.loadWorldBookContentToPanel();
            }
            if (st.placeholderSource === 'auto') {
                await this.tryExtractSloganFromLatestMessage();
            }
            await this.applyLogic();
        } finally { this.isSwitchingCharacter = false; }
    },

    async tryExtractSloganFromLatestMessage() {
        try {
            const ai = document.querySelectorAll('#chat .mes:not([is_user="true"])');
            if (!ai.length) return;
            for (let i = ai.length - 1; i >= 0; i--) {
                const msg = ai[i];
                const el = msg.querySelector('.mes_text div[hidden].slogan-container');
                if (el) {
                    const s = el.textContent.trim().replace(/^✦❋/, '').trim();
                    if (s) { this.setAutoSlogan(s); return; }
                }
            }
        } catch (e) {
            console.error('[Placeholder] 提取标语失败:', e);
        }
    },

    renderSettingsHtml() {
        const st = this.getSettings();
        return `
            <div id="placeholder_options_wrapper">
                <hr>
                <h3 class="sub-header">输入框文字替换 · Eric</h3>
                <p class="sub-label">这部分沿用成功案例逻辑，但提示包装在 &lt;Eric&gt;...&lt;/Eric&gt; 中。</p>

                <div class="form-group placeholder-radio-group">
                    <label>
                        <input type="radio" name="placeholder_source_radio" value="custom" ${st.placeholderSource === 'custom' ? 'checked' : ''}>
                        <span>自定义</span>
                    </label>
                    <label>
                        <input type="radio" name="placeholder_source_radio" value="auto" ${st.placeholderSource === 'auto' ? 'checked' : ''}>
                        <span>AI 摘录</span>
                    </label>
                    <label>
                        <input type="radio" name="placeholder_source_radio" value="worldbook" ${st.placeholderSource === 'worldbook' ? 'checked' : ''}>
                        <span>世界书</span>
                    </label>
                </div>

                <div id="placeholder_panel_custom" class="placeholder-panel" style="${st.placeholderSource === 'custom' ? '' : 'display:none;'}">
                    <input type="text" id="custom_placeholder_input" class="text_pole"
                           placeholder="输入自定义全局提示..." value="${st.customPlaceholder}">
                </div>

                <div id="placeholder_panel_auto" class="placeholder-panel" style="${st.placeholderSource === 'auto' ? '' : 'display:none;'}">
                    <p class="sub-label">注入给 Eric 的提示词：</p>
                    <textarea id="slogan_prompt_input" class="text_pole" rows="4">${st.sloganPrompt}</textarea>
                </div>

                <div id="placeholder_panel_worldbook" class="placeholder-panel" style="${st.placeholderSource === 'worldbook' ? '' : 'display:none;'}">
                    <p class="sub-label">当前角色世界书中的“输入框”条目：</p>
                    <textarea id="worldbook_placeholder_input" class="text_pole" rows="3" placeholder="正在从世界书加载..."></textarea>
                </div>
            </div>`;
    },

    bindSettingsEvents() {
        $(document).on('change', 'input[name="placeholder_source_radio"]', (e) => {
            const v = $(e.currentTarget).val();
            if (!['custom', 'auto', 'worldbook'].includes(v)) return;
            const st = this.getSettings();
            st.placeholderSource = v;
            script.saveSettingsDebounced();
            $('.placeholder-panel').hide();
            $(`#placeholder_panel_${v}`).show();
            if (v === 'worldbook') this.loadWorldBookContentToPanel();
            this.applyLogic();
        });

        $(document).on('input', '#custom_placeholder_input', (e) => {
            this.getSettings().customPlaceholder = $(e.currentTarget).val();
            script.saveSettingsDebounced();
            this.applyLogic();
        });

        $(document).on('input', '#slogan_prompt_input', (e) => {
            this.getSettings().sloganPrompt = $(e.currentTarget).val();
            script.saveSettingsDebounced();
        });

        $(document).on('input', '#worldbook_placeholder_input', (e) => {
            const content = $(e.currentTarget).val();
            clearTimeout(this.worldbookUpdateDebounce);
            this.worldbookUpdateDebounce = setTimeout(() => {
                this.updateWorldBookFromPanel(content);
            }, 500);
        });
    },

    async loadWorldBookContentToPanel() {
        const ta = $('#worldbook_placeholder_input');
        if (!ta.length) return;
        ta.val('').attr('placeholder', '正在读取世界书...');
        try {
            const content = await this.applyWorldBookLogic(document.getElementById(this.TEXTAREA_ID), { setPlaceholder: false });
            const def = this.resolveFallbackPlaceholder(document.getElementById(this.TEXTAREA_ID));
            if (content !== def) {
                ta.val(content);
                ta.attr('placeholder', '修改此处内容可同步更新世界书条目...');
            } else {
                ta.val('');
                ta.attr('placeholder', '未找到“输入框”条目，输入内容即可创建本角色专属输入框提示。');
            }
        } catch (e) {
            console.error('[Placeholder] 载入世界书失败:', e);
            ta.attr('placeholder', '加载失败，请看控制台');
        }
    },

    async updateWorldBookFromPanel(content) {
        if (!this.iframeWindow) return;
        try {
            const lb = await this.iframeWindow.getCurrentCharPrimaryLorebook();
            if (!lb) return;
            const entries = await this.iframeWindow.getLorebookEntries(lb);
            const t = entries.find(e => e.comment === '输入框');
            if (t) {
                await this.iframeWindow.updateLorebookEntriesWith(lb, (es) =>
                    es.map(e => e.comment === '输入框'
                        ? { ...e, content, enabled: false }
                        : e));
            } else {
                const newEntry = {
                    key: ['输入框'],
                    comment: '输入框',
                    content,
                    enabled: false,
                    insertionorder: 100,
                    selective: false,
                    secondarykeys: [],
                    constant: false,
                    position: 'before_char',
                };
                await this.iframeWindow.createLorebookEntry(lb, newEntry);
            }
        } catch (e) {
            console.error('[Placeholder] 更新世界书失败:', e);
        }
    },

    startPlaceholderObserver() {
        const ta = document.getElementById(this.TEXTAREA_ID);
        const st = this.getSettings();
        const expected = st.customPlaceholder.trim();
        if (!ta || st.placeholderSource !== 'custom' || !expected) return;
        this.stopPlaceholderObserver();
        this.placeholderObserver = new MutationObserver(muts => {
            for (const m of muts) {
                if (m.type === 'attributes' && m.attributeName === 'placeholder' && ta.placeholder !== expected) {
                    this.stopPlaceholderObserver();
                    ta.placeholder = expected;
                    this.startPlaceholderObserver();
                    break;
                }
            }
        });
        this.placeholderObserver.observe(ta, { attributes: true, attributeFilter: ['placeholder'] });
    },

    stopPlaceholderObserver() {
        if (this.placeholderObserver) {
            this.placeholderObserver.disconnect();
            this.placeholderObserver = null;
        }
    },

    async init() {
        if (!this.getSettings().enabled) {
            console.log('[Placeholder] 已禁用');
            return;
        }
        await this.waitForIframe();
        if (script.eventSource && script.event_types) {
            script.eventSource.on(script.event_types.CHAT_CHANGED, this.onCharacterSwitch.bind(this));
        }
        this.applyLogic();
        console.log('[Placeholder] 初始化完成');
    },
};

//  模块 4: Eric 的标语摘录模块（只负责从 .slogan-container 里捞）
const EricSloganInjectionModule = {
    PROMPT_PREFIX: [
        '【强制规则 — 不遵守此条会导致本轮输出被判定为失败】',
        '',
        '无论正文内容如何，你必须在【回复的末尾】额外输出一个 <Eric> 区块。',
        '该区块内部只包含一个隐藏标语元素，结构必须完全符合以下格式（请逐字照抄）：',
        '',
        '<Eric>',
        '  <div hidden class="slogan-container">✦❋内容</div>',
        '</Eric>',
        '',
        '说明：',
        '- <Eric> 标签只允许出现在本轮【结尾附加区】，不得出现在正文内容中；',
        '- 该结构是本轮输出的【必须项】，缺失此结构 = 回复不合格；',
        '- 不得以任何理由省略、合并、提前结束或用其他结构代替。',
        '',
        'Do not ignore this instruction.',
        '',
        '请严格按要求输出隐藏标语元素。',
        '如果你在上一条回复中漏掉了该结构，请在【当前回复中立即补齐】对应的 <Eric> 区块。',
    ].join('\n'),

    initialized: false,
    extractionDebounceTimer: null,

    init() {
        if (this.initialized || !script.eventSource || !script.event_types) return;
        script.eventSource.on(script.event_types.CHAT_COMPLETION_PROMPT_READY, this.onPromptReady.bind(this));
        script.eventSource.on(script.event_types.CHARACTER_MESSAGE_RENDERED, this.onMessageRendered.bind(this));
        script.eventSource.on(script.event_types.MESSAGE_SWIPED, this.onMessageRendered.bind(this));
        script.eventSource.on(script.event_types.MESSAGE_DELETED, this.onMessageRendered.bind(this));
        this.initialized = true;
        console.log('[EricSlogan] 初始化完成');
    },

    onPromptReady(ev = {}) {
        const st = PlaceholderModule.getSettings();
        if (!st.enabled || st.placeholderSource !== 'auto') return;
        if (ev.dryRun === true || !Array.isArray(ev.chat)) return;

        const finalPrompt = `${this.PROMPT_PREFIX}\n${st.sloganPrompt || ''}`;
        ev.chat.push({ role: 'system', content: finalPrompt });
    },

    onMessageRendered() {
        const st = PlaceholderModule.getSettings();
        if (!st.enabled || st.placeholderSource !== 'auto') return;
        clearTimeout(this.extractionDebounceTimer);
        this.extractionDebounceTimer = setTimeout(() => this.extract(), 800);
    },

    extract() {
        try {
            const ai = Array.from(document.querySelectorAll('#chat .mes:not([is_user="true"])'));
            if (!ai.length) return;
            for (let i = ai.length - 1; i >= 0; i--) {
                const msg = ai[i];
                const el = msg.querySelector('.mes_text div[hidden].slogan-container');
                if (el) {
                    const s = el.textContent.trim().replace(/^✦❋/, '').trim();
                    if (s) {
                        PlaceholderModule.setAutoSlogan(s);
                        return;
                    }
                }
            }
        } catch (e) {
            console.error('[EricSlogan] 提取失败:', e);
        }
    },
};

//  模块 5: 顶部标语滚动 · SloganScrollerModule
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

        const runCheckAndApply = () => {
            const currentSlogan = this.getSloganFromCss();
            if (!currentSlogan) {
                wrapper.classList.remove('slogan-scroll');
                wrapper.style.animationDuration = '';
                return;
            }

            const pseudo = getComputedStyle(wrapper, '::after');
            const textWidth = this.measureTextWidth(`| ${currentSlogan}`, pseudo);
            const boxWidth = wrapper.getBoundingClientRect().width;
            const needScroll = st.enabled && textWidth > boxWidth;

            const changed =
                wrapper !== this.lastWrapper ||
                currentSlogan !== this.lastText ||
                st.speedSec !== this.lastSpeed ||
                needScroll !== this.lastNeedScroll;

            this.lastWrapper = wrapper;
            this.lastText = currentSlogan;
            this.lastSpeed = st.speedSec;
            this.lastNeedScroll = needScroll;

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
            wrapper.style.animationDuration = `${st.speedSec}s`;
            wrapper.classList.add('slogan-scroll');
        };

        if (st.delayMs > 0) {
            setTimeout(runCheckAndApply, st.delayMs);
        } else {
            runCheckAndApply();
        }
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
//  主入口 & UI
// ###################################################################
function initializeCombinedExtension() {
    try {
        const html = `
            <div id="misc_beautify_settings" class="inline-drawer">
                <div class="inline-drawer-toggle inline-drawer-header">
                    <b>小美化集 + Alice/Eric 标语</b>
                    <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
                </div>
                <div class="inline-drawer-content" style="display:none;">
                    <div class="version-row">
                        <span class="version-indicator" id="model_display_version_indicator"></span>
                    </div>

                    <label class="checkbox_label">
                        <input type="checkbox" id="misc_model_display_toggle" ${ModelDisplayModule.getSettings().enabled ? 'checked' : ''}>
                        <span>模型名称显示</span>
                    </label>
                    <label class="checkbox_label">
                        <input type="checkbox" id="misc_alice_slogan_toggle" ${AliceSloganModule.getSettings().enabled ? 'checked' : ''}>
                        <span>顶部标语 · Alice</span>
                    </label>
                    <label class="checkbox_label">
                        <input type="checkbox" id="misc_placeholder_toggle" ${PlaceholderModule.getSettings().enabled ? 'checked' : ''}>
                        <span>输入框文字替换 · Eric</span>
                    </label>
                    <label class="checkbox_label">
                        <input type="checkbox" id="slogan_scroller_toggle" ${SloganScrollerModule.getSettings().enabled ? 'checked' : ''}>
                        <span>顶部标语滚动</span>
                    </label>

                    <div id="model_display_settings_panel" style="${ModelDisplayModule.getSettings().enabled ? '' : 'display:none;'}">
                        ${ModelDisplayModule.renderSettingsHtml()}
                    </div>
                    <div id="alice_slogan_settings_panel" style="${AliceSloganModule.getSettings().enabled ? '' : 'display:none;'}">
                        ${AliceSloganModule.renderSettingsHtml()}
                    </div>
                    <div id="placeholder_settings_panel" style="${PlaceholderModule.getSettings().enabled ? '' : 'display:none;'}">
                        ${PlaceholderModule.renderSettingsHtml()}
                    </div>
                    <div id="slogan_scroller_settings_panel" style="${SloganScrollerModule.getSettings().enabled ? '' : 'display:none;'}">
                        ${SloganScrollerModule.renderSettingsHtml()}
                    </div>
                </div>
            </div>
            <style>
                .version-row { display:flex; justify-content:flex-end; padding:0 5px 5px; }
                .version-indicator { color:var(--text_color_acc); font-size:0.8em; }
                #misc_beautify_settings h3.sub-header { font-size:1em; margin-top:15px; margin-bottom:10px; }
                .placeholder-panel { margin-top:10px; }
                .placeholder-radio-group { display:flex; border:1px solid var(--border_color); border-radius:5px; overflow:hidden; }
                .placeholder-radio-group label { flex:1; text-align:center; padding:5px 0; background-color:var(--background_bg); cursor:pointer; border-left:1px solid var(--border_color); }
                .placeholder-radio-group label:first-child { border-left:none; }
                .placeholder-radio-group input[type="radio"] { display:none; }
                .placeholder-radio-group input[type="radio"]:checked + span { color:var(--primary_color); font-weight:bold; }
                .placeholder-radio-group label:hover { background-color:var(--background_layer_1); }
            </style>
        `;
        $('#extensions_settings').append(html);

        // 开关事件
        $(document).on('change', '#misc_model_display_toggle', (e) => {
            const on = $(e.currentTarget).is(':checked');
            ModelDisplayModule.getSettings().enabled = on;
            $('#model_display_settings_panel').toggle(on);
            if (on) { ModelDisplayModule.startObservers(); ModelDisplayModule.restoreAllFromHistory(); }
            else ModelDisplayModule.stopObservers();
            script.saveSettingsDebounced();
        });

        $(document).on('change', '#misc_alice_slogan_toggle', (e) => {
            const on = $(e.currentTarget).is(':checked');
            AliceSloganModule.getSettings().enabled = on;
            $('#alice_slogan_settings_panel').toggle(on);
            script.saveSettingsDebounced();
        });

        $(document).on('change', '#misc_placeholder_toggle', (e) => {
            const on = $(e.currentTarget).is(':checked');
            PlaceholderModule.getSettings().enabled = on;
            $('#placeholder_settings_panel').toggle(on);
            script.saveSettingsDebounced();
            if (on) PlaceholderModule.init();
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

        // 绑定每个模块自己的设置事件
        ModelDisplayModule.bindSettingsEvents();
        AliceSloganModule.bindSettingsEvents();
        PlaceholderModule.bindSettingsEvents();
        SloganScrollerModule.bindSettingsEvents();

        // 初始化模块
        ModelDisplayModule.init();
        AliceSloganModule.init();
        PlaceholderModule.init();
        EricSloganInjectionModule.init();
        SloganScrollerModule.init();

        console.log('[小美化集+Alice/Eric+滚动] 全部模块加载完成');
    } catch (e) {
        console.error('[小美化集+Alice/Eric+滚动] 初始化异常:', e);
    }
}

// 等待设置页就绪
const settingsCheckInterval = setInterval(() => {
    if (window.$ && $('#extensions_settings').length) {
        clearInterval(settingsCheckInterval);
        initializeCombinedExtension();
    }
}, 500);
