(function () {
    console.log("%c[SloganScroller] Loaded (last-message mode)", "color:#4CAF50;font-weight:bold");

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

        // 获取最后一条消息
        const lastMes = document.querySelector("#chat .mes:last-of-type");
        if (!lastMes) return;

        const wrapper = lastMes.querySelector(".mesAvatarWrapper");
        if (!wrapper) return;

        const pseudo = getComputedStyle(wrapper, "::after");
        const text = "| " + slogan;

        const textWidth = measureTextWidth(text, pseudo);
        const boxWidth = wrapper.getBoundingClientRect().width;

        // 只处理最后一条：全部清除 → 最后一条单独判断
        document.querySelectorAll(".mesAvatarWrapper.slogan-scroll")
            .forEach(el => el.classList.remove("slogan-scroll"));

        if (textWidth > boxWidth) {
            wrapper.classList.add("slogan-scroll");
        }
    }

    function init() {
        updateSloganScroll();

        // 监听消息变化（AI 回复/用户发送）
        const chat = document.querySelector("#chat");
        if (chat) {
            const observer = new MutationObserver(updateSloganScroll);
            observer.observe(chat, { childList: true, subtree: false });
        }

        // 手机横竖屏 / 窗口变化
        window.addEventListener("resize", updateSloganScroll);
    }

    if (document.readyState === "complete" || document.readyState === "interactive") {
        init();
    } else {
        window.addEventListener("DOMContentLoaded", init);
    }
})();
