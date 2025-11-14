(function () {
  console.log("%c[SloganScroller] Loaded (active-message mode)", "color:#4CAF50;font-weight:bold");

  // 读取 CSS 里的 --自定义文案
  function getSloganFromCss() {
    const rootStyle = getComputedStyle(document.documentElement);
    let s = rootStyle.getPropertyValue('--自定义文案') || '';
    s = s.replace(/^["']|["']$/g, '').trim();
    return s;
  }

  // 量一下指定文本在当前伪元素字体下的宽度
  function measureTextWidth(text, pseudo) {
    const span = document.createElement('span');
    span.textContent = text;
    span.style.position = 'absolute';
    span.style.visibility = 'hidden';
    span.style.whiteSpace = 'nowrap';
    span.style.fontSize = pseudo.fontSize;
    span.style.fontFamily = pseudo.fontFamily;
    document.body.appendChild(span);
    const w = span.offsetWidth;
    span.remove();
    return w;
  }

  // 找“当前位置”的那条消息：视口内、离视口上方 1/3 最近的那个
  function getActiveWrapper() {
    const wrappers = document.querySelectorAll('#chat .mes .mesAvatarWrapper');
    if (!wrappers.length) return null;

    const vh = window.innerHeight || document.documentElement.clientHeight;
    const targetY = vh * 0.35; // 你可以自己调：视口上方 35% 作为参考线

    let best = null;
    let bestDist = Infinity;

    wrappers.forEach(w => {
      const rect = w.getBoundingClientRect();
      // 完全在屏幕外的直接跳过
      if (rect.bottom < 0 || rect.top > vh) return;
      const mid = (rect.top + rect.bottom) / 2;
      const d = Math.abs(mid - targetY);
      if (d < bestDist) {
        bestDist = d;
        best = w;
      }
    });

    // 如果都不在视口里（极端情况），就退回最后一条
    if (!best) best = wrappers[wrappers.length - 1];
    return best;
  }

  function updateSloganScroll() {
    const slogan = getSloganFromCss();
    if (!slogan) return;

    const wrapper = getActiveWrapper();
    if (!wrapper) return;

    // 保证全局只会有 1 个 .slogan-scroll
    document
      .querySelectorAll('#chat .mes .mesAvatarWrapper.slogan-scroll')
      .forEach(el => {
        if (el !== wrapper) el.classList.remove('slogan-scroll');
      });

    const pseudo = getComputedStyle(wrapper, '::after');
    const text = `| ${slogan}`;
    const textWidth = measureTextWidth(text, pseudo);
    const boxWidth = wrapper.getBoundingClientRect().width;

    if (textWidth > boxWidth) {
      wrapper.classList.add('slogan-scroll');
    } else {
      wrapper.classList.remove('slogan-scroll');
    }
  }

  function init() {
    // 先跑一遍（进入 chat 时）
    updateSloganScroll();

    // 聊天区新增消息（AI 回复 / 切换历史）时重算
    const chat = document.getElementById('chat');
    if (chat) {
      const observer = new MutationObserver(() => {
        updateSloganScroll();
      });
      observer.observe(chat, { childList: true });
    }

    // 滚动 & 窗口尺寸变化：当前消息会变，重算一次即可
    window.addEventListener('scroll', updateSloganScroll, { passive: true });
    window.addEventListener('resize', updateSloganScroll);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // 如果你想让别的脚本（比如你那段合并文案脚本）主动触发，也可以挂到全局：
  window.__sloganScrollerUpdate = updateSloganScroll;
})();
