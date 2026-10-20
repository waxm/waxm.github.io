(function () {
  'use strict';
  var splash = document.getElementById('CowSplash');
  if (!splash) return;
  var status = splash.querySelector('.cow-splash__status');
  var track = splash.querySelector('.cow-splash__track');
  var fill = splash.querySelector('.cow-splash__fill');
  var retry = splash.querySelector('.cow-splash__retry');
  var phase = 0;
  var finished = false;
  var fading = false;
  var slowTimer;
  var finishTimer;
  var removeTimer;
  var resizeObserver;

  function resize() {
    splash.classList.toggle('is-landscape', splash.clientWidth > splash.clientHeight);
  }

  function watchSlowLoad() {
    window.clearTimeout(slowTimer);
    slowTimer = window.setTimeout(function () { fail('连接有点慢，请检查网络后重试'); }, 20000);
  }
  function fail(message) {
    if (finished) return;
    window.clearTimeout(slowTimer);
    splash.classList.add('is-error');
    status.textContent = message;
    retry.hidden = false;
    track.setAttribute('aria-valuetext', message);
  }
  function cleanup() {
    window.clearTimeout(slowTimer);
    window.clearTimeout(finishTimer);
    window.clearTimeout(removeTimer);
    window.removeEventListener('cow-startup', update);
    window.removeEventListener('error', onError, true);
    window.removeEventListener('pagehide', cleanup);
    window.removeEventListener('resize', resize);
    if (resizeObserver) resizeObserver.disconnect();
    retry.removeEventListener('click', reload);
    fill.removeEventListener('transitionend', fade);
  }
  function fade(event) {
    if (event && (event.target !== fill || event.propertyName !== 'clip-path')) return;
    if (fading) return;
    fading = true;
    window.clearTimeout(finishTimer);
    fill.removeEventListener('transitionend', fade);
    splash.classList.add('is-hidden');
    removeTimer = window.setTimeout(function () { cleanup(); splash.remove(); }, 200);
  }
  function update(event) {
    if (finished || !event.detail) return;
    var stage = event.detail.stage;
    if (stage === 'failed') { fail('牧场暂时没打开，请重试'); return; }
    if (stage !== 'home-loading' && stage !== 'ready') return;
    splash.classList.remove('is-error');
    retry.hidden = true;
    phase = Math.max(phase, stage === 'ready' ? 3 : 2);
    splash.style.setProperty('--cow-progress', phase === 3 ? '100%' : '55%');
    status.textContent = phase === 3 ? '小牛准备好啦' : '正在准备牧场…';
    track.setAttribute('aria-valuenow', String(phase));
    track.setAttribute('aria-valuetext', status.textContent);
    if (phase !== 3) { watchSlowLoad(); return; }
    finished = true;
    window.clearTimeout(slowTimer);
    // 先完成条形填充，再淡出，避免从半条直接消失。
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) { fade(); return; }
    fill.addEventListener('transitionend', fade);
    // 后台页可能不派发过渡事件，仍需保证启动层可以退出。
    finishTimer = window.setTimeout(fade, 400);
  }
  function reload() {
    if (finished || retry.hidden) return;
    retry.hidden = true;
    splash.classList.remove('is-error');
    status.textContent = '正在重新打开牧场…';
    watchSlowLoad();
    // 已进入 GameScene 时重试主页；引擎尚未启动则重新加载当前页。
    if (window.dispatchEvent(new CustomEvent('cow-startup-retry', { cancelable: true }))) window.location.reload();
  }
  function onError(event) {
    if (event.message || (event.target && event.target.tagName === 'SCRIPT')) fail('启动遇到问题，请重新加载');
  }
  window.addEventListener('cow-startup', update);
  window.addEventListener('error', onError, true);
  window.addEventListener('pagehide', cleanup);
  window.addEventListener('resize', resize);
  if (window.ResizeObserver) {
    resizeObserver = new window.ResizeObserver(resize);
    resizeObserver.observe(splash);
  }
  retry.addEventListener('click', reload);
  resize();
  watchSlowLoad();
}());
