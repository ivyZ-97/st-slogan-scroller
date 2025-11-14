(function () {
    console.log("%c[SloganScroller] Loaded", "color:#4CAF50;font-weight:bold");

    function measureTextWidth(text, pseudo) {
        const span = document.createElement("span");
        span.textContent = text;
        span.style.position = "absolute";
        span.style.visibility = "hidden";
        span.style.whiteSpace = "nowrap";
        span.style.fontSize = pseudo.fontSize;
        span.style.fontFamily = pseudo.fontFamily;
        document.body.appendChild(span);
        const width = span.offsetWidth;
        span.remove();
        return width;
    }

    function updateSloganScroll() {
        const rootStyle = getComputedStyle(document.documentElement);
        let slogan = rootStyle.getPropertyValue('--自定义文案') || '';
        slogan = slogan.replace(/^["']|["']$/g, '').trim();
        if (!slogan) return;

        const wrappers = document.querySelectorAll('.mes .mesAvatarWrapper');
        if (!wrappers.length) return;

        wrappers.forEach(wrapper => {
            const pseudo = getComputedStyle(wrapper, '::after');
            const text = "| " + slogan;

            const textWidth = measureTextWidth(text, pseudo);

            // wrapper 实际可用宽度
            const boxWidth = wrapper.getBoundingClientRect().width;

            // 控制台输出（调试用）
            // console.log("textWidth:", textWidth, "boxWidth:", boxWidth);

            if (textWidth > boxWidth) {
                wrapper.classList.add('slogan-scroll');
            } else {
                wrapper.classList.remove('slogan-scroll');
            }
        });
    }

    // 界面加载时启动
    function init() {
        updateSloganScroll();

        // 监听聊天内容变化（AI 或用户消息出现时）
        const chat = document.querySelector("#chat");
        if (chat) {
            const observer = new MutationObserver(() => updateSloganScroll());
            observer.observe(chat, { childList: true, subtree: true });
        }

        // 监听窗口尺寸变化（手机横竖屏变化）
        window.addEventListener("resize", updateSloganScroll);

        // 兜底：每 3 秒跑一次（极端情况下保证不失效）
        setInterval(updateSloganScroll, 3000);
    }

    if (document.readyState === "complete" || document.readyState === "interactive") {
        init();
    } else {
        window.addEventListener("DOMContentLoaded", init);
    }
})();
