// SillyTavern Slogan Scroller
// 作用：根据 --自定义文案 长度，为所有 .mesAvatarWrapper 添加/移除 slogan-scroll

(function () {
  console.log("[SloganScroller] loaded");

  function updateSloganScroll() {
    try {
      const rootStyle = getComputedStyle(document.documentElement);
      let slogan = rootStyle.getPropertyValue('--自定义文案') || '';
      slogan = slogan.replace(/^["']|["']$/g, '').trim();

      // 没有文案就直接退出
      if (!slogan) return;

      // 简单长度：中文≈1，英文≈0.7
      const logicalLen = Array.from(slogan).reduce((sum, ch) => {
        const code = ch.charCodeAt(0);
        return sum + (code < 128 ? 0.7 : 1);
      }, 0);

      const wrappers = document.querySelectorAll('.mesAvatarWrapper');

      wrappers.forEach(wrapper => {
        if (logicalLen > 10) {
          // 文案比较长 → 开启滚动
          wrapper.classList.add('slogan-scroll');
        } else {
          // 文案比较短 → 不滚动，保持静止
          wrapper.classList.remove('slogan-scroll');
        }
      });
    } catch (e) {
      console.warn("[SloganScroller] error:", e);
    }
  }

  // 定时器方式最稳：手机 / 桌面统一
  setInterval(updateSloganScroll, 2000);
})();
