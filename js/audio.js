/* Box Flow — tiny WebAudio synth (no assets, gesture-safe) */
(function () {
  const G = (window.G = window.G || {});

  let ac = null;
  let master = null;
  let muted = false;
  try { muted = localStorage.getItem('boxflow.muted') === '1'; } catch (e) { /* private mode */ }

  function ensure() {
    if (!ac) {
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        ac = new AC();
        master = ac.createGain();
        master.gain.value = 0.5;
        master.connect(ac.destination);
      } catch (e) {
        ac = null;
        return null;
      }
    }
    if (ac.state === 'suspended') ac.resume().catch(function () {});
    return ac;
  }

  function env(vol, dur) {
    const g = ac.createGain();
    const t = ac.currentTime;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    g.connect(master);
    return g;
  }

  function blip(freq, dur, type, vol) {
    if (muted) return;
    const c = ensure();
    if (!c) return;
    try {
      const o = c.createOscillator();
      o.type = type;
      o.frequency.value = freq;
      o.connect(env(vol, dur));
      o.start();
      o.stop(c.currentTime + dur + 0.03);
    } catch (e) { /* audio is never critical */ }
  }

  function sweep(f0, f1, dur, type, vol) {
    if (muted) return;
    const c = ensure();
    if (!c) return;
    try {
      const o = c.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(f0, c.currentTime);
      o.frequency.exponentialRampToValueAtTime(Math.max(40, f1), c.currentTime + dur);
      o.connect(env(vol, dur));
      o.start();
      o.stop(c.currentTime + dur + 0.03);
    } catch (e) { /* audio is never critical */ }
  }

  G.audio = {
    unlock: function () { ensure(); },
    isMuted: function () { return muted; },
    toggle: function () {
      muted = !muted;
      try { localStorage.setItem('boxflow.muted', muted ? '1' : '0'); } catch (e) {}
      if (!muted) blip(660, 0.06, 'sine', 0.12);
      return muted;
    },
  };

  G.SFX = {
    place: function () { blip(540, 0.07, 'triangle', 0.16); },
    click: function () { blip(760, 0.045, 'square', 0.07); },
    suck:  function () { sweep(640, 170, 0.2, 'sine', 0.15); },
    eject: function () { sweep(200, 720, 0.18, 'triangle', 0.13); },
    pipe:  function () { blip(900, 0.03, 'sine', 0.05); },
    thud:  function (v) { blip(110 + 70 * v, 0.09, 'triangle', 0.08 + 0.14 * v); },
    trash: function () { sweep(420, 110, 0.14, 'sawtooth', 0.09); },
  };
})();
