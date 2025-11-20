// 从原脚本保留的最小功能：
// 1) 滚动宽度判断（基于头像 wrapper）
// 2) 本地文案库，根据宽度挑一句合适的标语
// 3) 把选出的标语写入 CSS 变量 --自定义文案

// ====================== 工具：选出“当前活动头像” ======================
function getActiveWrapper() {
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

// ====================== 工具：文本宽度 + 溢出判断 ======================
function measureTextWidth(text, pseudoStyle) {
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

function willSloganOverflow(text, wrapper, pseudoStyle) {
    if (!wrapper || !text) return false;
    const pseudo = pseudoStyle || getComputedStyle(wrapper, '::after');
    const textWidth = measureTextWidth(`| ${text}`, pseudo);
    const boxWidth = wrapper.getBoundingClientRect().width;
    return textWidth > boxWidth;
}

// ====================== 本地文案库：按宽度挑一句 ======================
const LocalSloganLibrary = {
    // ✦ 这里放你的本地语料库（可以直接改 / 扩充）
    QUOTES: [
        "Be yourself; everyone else is already taken.",
        "浅水是喧哗的，深水是沉默的。",
        "所谓成长，就是学会闭嘴，把情绪消化在肚子里。",
        "有些问题不必想明白，活过去比想明白更重要。",
    ],

    // 简单随机一条（不考虑宽度）
    pickRandom() {
        const list = this.QUOTES;
        if (!list || !list.length) return '';
        return list[Math.floor(Math.random() * list.length)];
    },

    // 按给定 wrapper 的宽度挑一句：优先“不溢出”，否则选最短
    pickForWrapper(wrapper) {
        const list = this.QUOTES;
        if (!list || !list.length) return '';

        if (!wrapper) {
            return this.pickRandom();
        }

        const pseudo = getComputedStyle(wrapper, '::after');

        // ① 优先找不会溢出的句子
        const safe = list.filter(q => !willSloganOverflow(q, wrapper, pseudo));
        if (safe.length) {
            return safe[Math.floor(Math.random() * safe.length)];
        }

        // ② 全都太长 → 退一步：选最短的
        let best = list[0];
        for (const q of list) {
            if (q.length < best.length) best = q;
        }
        return best;
    },

    // 直接用“当前视口里最靠下的那条消息头像”的宽度挑一句
    pickForActiveWrapper() {
        const wrapper = getActiveWrapper();
        return this.pickForWrapper(wrapper);
    },
};

// ====================== 写入 CSS 变量：--自定义文案 ======================
function applyLocalSloganToCssFromLibrary() {
    const text = LocalSloganLibrary.pickForActiveWrapper();
    if (!text) return;
    document.documentElement.style.setProperty('--自定义文案', `"${text.replace(/"/g, '\\"')}"`);
    console.log('[LocalSloganLibrary] 已写入本地标语:', text);
}

// ====================== 暴露到 window，方便其它脚本调用 ======================
window.getActiveWrapper = getActiveWrapper;
window.measureTextWidth = measureTextWidth;
window.willSloganOverflow = willSloganOverflow;
window.LocalSloganLibrary = LocalSloganLibrary;
window.applyLocalSloganToCssFromLibrary = applyLocalSloganToCssFromLibrary;
