(function () {
    console.log("SloganScroller extension loaded");

    function applySloganScroll() {
        const rootStyle = getComputedStyle(document.documentElement);
        let slogan = rootStyle.getPropertyValue('--自定义文案') || '';
        slogan = slogan.replace(/^["']|["']$/g, '').trim();

        if (!slogan) {
            return;
        }

        const wrappers = document.querySelectorAll('.mes .mesAvatarWrapper');
        wrappers.forEach(wrapper => {
            if (slogan.length > 5) {
                wrapper.classList.add('slogan-scroll');
            } else {
                wrapper.classList.remove('slogan-scroll');
            }
        });
    }

    // 直接定时跑一遍 + 事件兜底
    function init() {
        applySloganScroll();
        setInterval(applySloganScroll, 3000);

        if (window.SillyTavern && typeof SillyTavern.getContext === 'function') {
            const { eventSource, event_types } = SillyTavern.getContext();
            if (eventSource && event_types) {
                eventSource.on(event_types.APP_READY, applySloganScroll);
                eventSource.on(event_types.CHAT_CHANGED, applySloganScroll);
                eventSource.on(event_types.CHARACTER_MESSAGE_RENDERED, applySloganScroll);
                eventSource.on(event_types.USER_MESSAGE_RENDERED, applySloganScroll);
            }
        }
    }

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        init();
    } else {
        window.addEventListener('DOMContentLoaded', init);
    }
})();
