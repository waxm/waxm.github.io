(() => {
    const root = document.getElementById('game-web-splash');
    const message = root.querySelector('span');
    const retry = root.querySelector('button');
    const failed = () => { message.textContent = '启动暂时未完成，请检查网络后重试'; retry.hidden = false; };
    const ready = () => {
        window.removeEventListener('error', failed);
        window.removeEventListener('unhandledrejection', failed);
        window.removeEventListener('game-startup-error', failed);
        root.remove();
    };
    retry.addEventListener('click', () => window.location.reload());
    window.addEventListener('game-startup-ready', ready, { once: true });
    window.addEventListener('game-startup-error', failed);
    window.addEventListener('error', failed);
    window.addEventListener('unhandledrejection', failed);
})();
