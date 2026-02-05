window.UI = {
  toast(message){
    const el = document.createElement('div');
    el.textContent = message;
    el.style.cssText = 'position:fixed;right:16px;bottom:16px;background:#111;padding:10px 14px;border:1px solid #333;border-radius:8px;z-index:9999';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2600);
  },
  show(el){el.classList.remove('hidden')},
  hide(el){el.classList.add('hidden')}
};
