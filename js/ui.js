/* Box Flow — toolbar, modals, toast, import/export */
(function () {
  const G = (window.G = window.G || {});
  const S = G.state;

  const toolbar = document.getElementById('toolbar');
  const helpModal = document.getElementById('helpModal');
  const confirmModal = document.getElementById('confirmModal');
  const toastEl = document.getElementById('toast');
  const importFile = document.getElementById('importFile');
  const soundBtn = toolbar.querySelector('[data-action="sound"]');

  /* ---------------- tools ---------------- */

  const TOOL_NAMES = {
    select: 'Select', belt: 'Belt', tube: 'Tube', box: 'Box', delete: 'Delete',
  };

  G.setTool = function (tool) {
    if (!TOOL_NAMES[tool]) tool = 'select';
    S.tool = tool;
    document.body.dataset.tool = tool;
    toolbar.querySelectorAll('[data-tool]').forEach(function (btn) {
      btn.classList.toggle('active', btn.dataset.tool === tool);
    });
    if (tool !== 'select') G.select(null);
    G.updateHover();
  };

  G.select = function (ent) {
    S.selected = ent || null;
    if (G.layoutChips) G.layoutChips(true);
  };

  toolbar.addEventListener('click', function (e) {
    const btn = e.target.closest('button');
    if (!btn) return;
    G.audio.unlock();
    if (btn.dataset.tool) {
      G.setTool(btn.dataset.tool);
      G.SFX.click();
      return;
    }
    const action = btn.dataset.action;
    if (action === 'export') G.exportSave();
    else if (action === 'import') importFile.click();
    else if (action === 'clear') confirmModal.hidden = false;
    else if (action === 'help') helpModal.hidden = false;
    else if (action === 'sound') G.toggleSound();
  });

  /* ---------------- sound toggle ---------------- */

  function syncSoundIcon() {
    const on = soundBtn.querySelector('.snd-on');
    const off = soundBtn.querySelector('.snd-off');
    on.hidden = G.audio.isMuted();
    off.hidden = !G.audio.isMuted();
  }

  G.toggleSound = function () {
    G.audio.toggle();
    syncSoundIcon();
    G.toast(G.audio.isMuted() ? 'Sound off' : 'Sound on');
  };

  /* ---------------- toast ---------------- */

  let toastTimer = null;
  G.toast = function (msg) {
    toastEl.textContent = msg;
    toastEl.hidden = false;
    requestAnimationFrame(function () { toastEl.classList.add('show'); });
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toastEl.classList.remove('show');
      toastTimer = setTimeout(function () { toastEl.hidden = true; }, 220);
    }, 1900);
  };

  /* ---------------- modals ---------------- */

  G.modalOpen = function () {
    return !helpModal.hidden || !confirmModal.hidden;
  };

  G.closeModals = function () {
    helpModal.hidden = true;
    confirmModal.hidden = true;
  };

  G.toggleHelp = function () {
    helpModal.hidden = !helpModal.hidden;
  };

  for (const modal of [helpModal, confirmModal]) {
    modal.addEventListener('click', function (e) {
      if (e.target === modal || e.target.closest('[data-close]')) {
        modal.hidden = true;
        try { localStorage.setItem('boxflow.seenHelp', '1'); } catch (err) {}
      }
    });
  }

  document.getElementById('confirmClear').addEventListener('click', function () {
    G.clearAll();
    confirmModal.hidden = true;
    G.toast('Factory cleared');
    G.SFX.trash();
  });

  /* ---------------- export / import ---------------- */

  G.exportSave = function () {
    try {
      const data = JSON.stringify(G.serialize(), null, 2);
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'box-flow-save.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      G.toast('Layout exported');
    } catch (e) {
      G.toast('Export failed');
    }
  };

  importFile.addEventListener('change', function (e) {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!f) return;
    const reader = new FileReader();
    reader.onload = function () {
      try {
        const parsed = JSON.parse(String(reader.result));
        G.deserialize(Array.isArray(parsed) ? G.convertLegacyConfig(parsed) : parsed);
        G.toast('Layout imported');
        G.SFX.place();
      } catch (err) {
        G.toast('Could not read that file');
      }
    };
    reader.onerror = function () { G.toast('Could not read that file'); };
    try { reader.readAsText(f); } catch (err) { G.toast('Could not read that file'); }
  });

  /* ---------------- boot flags ---------------- */

  G.initUI = function () {
    G.setTool('select');
    syncSoundIcon();
    let seen = false;
    try { seen = localStorage.getItem('boxflow.seenHelp') === '1'; } catch (e) {}
    if (!seen) helpModal.hidden = false;
  };
})();
