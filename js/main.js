/* Box Flow — bootstrap, resize, game loop */
(function () {
  const G = (window.G = window.G || {});
  const S = G.state;
  const W = G.WORLD;

  const canvas = document.getElementById('stage');
  const ctx = canvas.getContext('2d');

  function clampAll() {
    for (const b of S.belts) {
      const w = G.beltWidth(b);
      b.x = G.clamp(b.x, 6, Math.max(6, S.w - w - 6));
      b.y = G.clamp(b.y, 8, Math.max(8, S.h - W.beltH - 8));
    }
    const maxX = Math.max(0, Math.floor(S.w / W.seg) * W.seg - W.seg);
    const maxY = Math.max(0, Math.floor(S.h / W.seg) * W.seg - W.seg);
    for (const g of S.tubes) {
      for (const s of g.segs) {
        s.x = G.clamp(Math.round(s.x / W.seg) * W.seg, 0, maxX);
        s.y = G.clamp(Math.round(s.y / W.seg) * W.seg, 0, maxY);
      }
    }
    const r = W.boxR;
    for (const b of S.boxes) {
      b.x = G.clamp(b.x, r, Math.max(r, S.w - r));
      b.y = G.clamp(b.y, r, Math.max(r, S.h - r));
    }
  }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = Math.max(1, Math.round(w * dpr));
    canvas.height = Math.max(1, Math.round(h * dpr));
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    S.w = w;
    S.h = h;
    G.makeMotes();
    clampAll();
  }
  window.addEventListener('resize', resize);

  /* fixed-timestep loop: physics never depends on frame rate */
  let last = performance.now();
  let acc = 0;
  const STEP = 1 / 60;

  function frame(now) {
    requestAnimationFrame(frame);
    let dt = (now - last) / 1000;
    last = now;
    if (!(dt > 0)) dt = STEP;
    if (dt > 0.25) dt = 0.25; // tab was hidden — don't fast-forward
    acc += dt;
    let steps = 0;
    while (acc >= STEP && steps < 5) {
      G.stepPhysics(STEP);
      acc -= STEP;
      steps++;
    }
    if (steps === 5) acc = 0;
    G.render(ctx);
    G.layoutChips(false);
  }

  /* boot */
  resize();

  async function boot() {
    try {
      const res = await fetch('js/template-layout.json');
      if (res.ok) {
        G.DEMO_LAYOUT = await res.json();
      }
    } catch (e) { /* fall back to the built-in demo layout */ }

    let loaded = false;
    try {
      const raw = localStorage.getItem('boxflow.autosave.v1');
      if (raw) {
        const data = JSON.parse(raw);
        if (data && data.demo === true) {
          G.seedScene(); // fresh sample layout on refresh until the player edits
        } else {
          G.deserialize(data);
        }
        loaded = true;
      }
    } catch (e) { /* corrupt or unavailable save */ }
    if (!loaded) G.seedScene();
    G.initUI();
    requestAnimationFrame(frame);
  }

  boot();
})();
