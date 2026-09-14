/* Box Flow — pointer, keyboard, drag & placement */
(function () {
  const G = (window.G = window.G || {});
  const S = G.state;
  const W = G.WORLD;

  let dragEnt = null;
  let dragOff = { x: 0, y: 0 };
  let dragMoved = false;
  let drawingTube = null;
  let drawingTubeFromTail = false;
  let drawLastCount = 0;

  const stage = document.getElementById('stage');

  function toLocal(e) {
    const rect = stage.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function hitTest(x, y) {
    const b = G.boxAt(x, y);
    if (b) return { kind: 'box', ent: b };
    const belt = G.beltAt(x, y);
    if (belt) return { kind: 'belt', ent: belt };
    const t = G.tubeAt(x, y);
    if (t) return { kind: 'tube', ent: t.group, seg: t.seg };
    return null;
  }
  G.hitTest = hitTest;

  G.updateHover = function () {
    if (S.tool === 'select' || S.tool === 'delete') {
      const hit = hitTest(S.pointer.x, S.pointer.y);
      S.hover = hit ? hit.ent : null;
    } else {
      S.hover = null;
    }
  };

  stage.addEventListener('pointerdown', function (e) {
    G.audio.unlock();
    if (e.button !== 0) return; // right-click handled via contextmenu
    const p = toLocal(e);
    S.pointer.x = p.x;
    S.pointer.y = p.y;
    S.pointer.inside = true;

    if (S.tool === 'box') {
      const b = G.spawnBox({ x: p.x, y: Math.min(p.y, S.h - W.boxR) });
      if (b) G.SFX.place();
      return;
    }
    if (S.tool === 'belt') {
      const belt = G.addBelt({ x: p.x, y: p.y, modules: 4, dir: 1, active: false });
      if (belt) {
        G.SFX.place();
        G.select(belt);
        G.setTool('select');
      }
      return;
    }
    if (S.tool === 'tube') {
      const hit = hitTest(p.x, p.y);
      if (hit && hit.kind === 'tube' && hit.seg === hit.ent.segs[hit.ent.segs.length - 1]) {
        drawingTube = hit.ent;
        drawingTubeFromTail = true;
        drawLastCount = hit.ent.segs.length;
        G.tubeDraft = hit.ent.segs.map(function (s) { return { x: s.x, y: s.y }; });
        G.select(hit.ent);
      } else {
        const g = G.addTube({ x: p.x, y: p.y });
        if (g) {
          G.SFX.place();
          drawingTube = g;
          drawingTubeFromTail = false;
          drawLastCount = 1;
          G.tubeDraft = g.segs.map(function (s) { return { x: s.x, y: s.y }; });
          G.select(null);
        }
      }
      return;
    }
    if (S.tool === 'delete') {
      const hit = hitTest(p.x, p.y);
      if (hit) {
        G.removeEntity(hit.ent);
        G.SFX.trash();
      }
      return;
    }

    // select tool
    const hit = hitTest(p.x, p.y);
    if (!hit) {
      G.select(null);
      return;
    }
    G.select(hit.ent);
    dragEnt = hit.kind === 'tube' && !S.moveMode ? null : hit.ent;
    dragOff = { x: p.x, y: p.y };
    if (hit.kind === 'box') {
      const b = hit.ent;
      b.drag = true;
      b.support = null;
      b.landed = false;
      b.inTube = null;
      b.vx = 0;
      b.vy = 0;
    }
    document.body.classList.add('dragging');
    try { stage.setPointerCapture(e.pointerId); } catch (err) { /* pointer already gone */ }
  });

  window.addEventListener('pointermove', function (e) {
    const p = toLocal(e);
    S.pointer.x = p.x;
    S.pointer.y = p.y;
    S.pointer.inside = true;

    if (drawingTube) {
      if (drawingTubeFromTail) updateTubeExtend();
      else updateTubeDraft();
      return;
    }

    if (!dragEnt) {
      G.updateHover();
      return;
    }

    if (dragEnt.type === 'box') {
      const b = dragEnt;
      b.x = G.clamp(p.x, b.r, Math.max(b.r, S.w - b.r));
      b.y = G.clamp(p.y, b.r, Math.max(b.r, S.h - b.r));
    } else if (dragEnt.type === 'belt') {
      const belt = dragEnt;
      const w = G.beltWidth(belt);
      const dx = p.x - dragOff.x;
      const dy = p.y - dragOff.y;
      dragOff = p;
      const nx = G.clamp(belt.x + dx, 6, Math.max(6, S.w - w - 6));
      const ny = G.clamp(belt.y + dy, 8, Math.max(8, S.h - W.beltH - 8));
      const ddx = nx - belt.x;
      belt.x = nx;
      belt.y = ny;
      for (const b of S.boxes) {
        if (b.inTube || b.drag) continue;
        if (b.support && b.support.kind === 'belt' && b.support.belt === belt) {
          b.x = G.clamp(b.x + ddx, b.r, Math.max(b.r, S.w - b.r));
          G.moveRiders(b, ddx, 0);
        }
      }
      G.disturb(belt);
    } else if (dragEnt.type === 'tube' && S.moveMode) {
      const g = dragEnt;
      const dx = p.x - dragOff.x;
      const dy = p.y - dragOff.y;
      dragOff = p;
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (const s of g.segs) {
        minX = Math.min(minX, s.x);
        maxX = Math.max(maxX, s.x + W.seg);
        minY = Math.min(minY, s.y);
        maxY = Math.max(maxY, s.y + W.seg);
      }
      const ddx = G.clamp(dx, 4 - minX, S.w - 4 - maxX);
      const ddy = G.clamp(dy, 4 - minY, S.h - 4 - maxY);
      if (ddx || ddy) {
        for (const s of g.segs) {
          s.x += ddx;
          s.y += ddy;
        }
        for (const b of S.boxes) {
          if (b.inTube && g.segs.indexOf(b.inTube) !== -1) {
            b.x += ddx;
            b.y += ddy;
          }
        }
      }
    }
  });

  function endDrag() {
    if (drawingTube) {
      const done = drawingTube;
      drawingTube = null;
      drawingTubeFromTail = false;
      G.tubeDraft = null;
      G.select(done);
      G.setTool('select');
      G.SFX.place();
      return;
    }
    if (!dragEnt) return;
    if (dragEnt.type === 'box') {
      dragEnt.drag = false;
      dragEnt.noCapture = 0.3;
    }
    dragEnt = null;
    document.body.classList.remove('dragging');
    G.markDirty();
  }
  window.addEventListener('pointerup', endDrag);
  window.addEventListener('pointercancel', endDrag);

  /* ---------------- tube drag-drawing ---------------- */

  function dirBetween(a, b) {
    if (b.y < a.y) return 'u';
    if (b.y > a.y) return 'd';
    if (b.x < a.x) return 'l';
    return 'r';
  }

  function updateTubeDraft() {
    const g = drawingTube;
    if (!g) return;
    const start = g.segs[0];
    const maxX = Math.max(0, Math.floor(S.w / W.seg) * W.seg - W.seg);
    const maxY = Math.max(0, Math.floor(S.h / W.seg) * W.seg - W.seg);
    const tx = G.clamp(Math.round((S.pointer.x - W.seg / 2) / W.seg) * W.seg, 0, maxX);
    const ty = G.clamp(Math.round((S.pointer.y - W.seg / 2) / W.seg) * W.seg, 0, maxY);

    // L-shaped route toward the pointer, axis by axis
    const cells = [{ x: start.x, y: start.y }];
    let cx = start.x;
    let cy = start.y;
    let guard = 0;
    while (cx !== tx && cells.length < 24 && guard++ < 40) {
      cx += tx > cx ? W.seg : -W.seg;
      cells.push({ x: cx, y: cy });
    }
    while (cy !== ty && cells.length < 24 && guard++ < 40) {
      cy += ty > cy ? W.seg : -W.seg;
      cells.push({ x: cx, y: cy });
    }

    // unchanged draft? skip rebuild
    if (cells.length === g.segs.length && cells.every(function (c, i) {
      return g.segs[i].x === c.x && g.segs[i].y === c.y;
    })) return;

    // every new cell must be inside the stage and unoccupied
    for (let i = 1; i < cells.length; i++) {
      const c = cells[i];
      if (c.x < 0 || c.y < 0 || c.x + W.seg > S.w || c.y + W.seg > S.h) return;
      if (!G.cellFreeExcept(g, c.x, c.y)) return;
    }

    // rebuild the segment chain with correct port directions
    g.segs = cells.map(function (c, i) {
      if (i === 0) {
        return { x: c.x, y: c.y, from: null, to: i < cells.length - 1 ? dirBetween(c, cells[i + 1]) : 'u' };
      }
      const back = G.OPP[dirBetween(cells[i - 1], c)];
      return {
        x: c.x, y: c.y,
        from: back,
        to: i < cells.length - 1 ? dirBetween(c, cells[i + 1]) : dirBetween(cells[i - 1], c),
      };
    });
    G.tubeDraft = cells.slice();
    if (g.segs.length !== drawLastCount) {
      drawLastCount = g.segs.length;
      G.SFX.pipe();
      G.markDirty();
    }
  }

  function updateTubeExtend() {
    const g = drawingTube;
    if (!g || !g.segs.length) return;
    const last = g.segs[g.segs.length - 1];
    const cx = last.x + W.seg / 2;
    const cy = last.y + W.seg / 2;
    const dx = S.pointer.x - cx;
    const dy = S.pointer.y - cy;
    if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
    const dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'r' : 'l') : (dy > 0 ? 'd' : 'u');
    if (G.extendTube(g, dir)) {
      drawLastCount = g.segs.length;
      G.tubeDraft = g.segs.map(function (s) { return { x: s.x, y: s.y }; });
      G.SFX.pipe();
      G.markDirty();
      if (G.layoutChips) G.layoutChips(false);
    }
  }

  G.cancelTubeDraw = function () {
    if (!drawingTube) return false;
    G.removeEntity(drawingTube);
    drawingTube = null;
    G.tubeDraft = null;
    drawingTubeFromTail = false;
    return true;
  };

  stage.addEventListener('pointerleave', function () {
    S.pointer.inside = false;
    S.hover = null;
  });

  // right-click deletes
  stage.addEventListener('contextmenu', function (e) {
    e.preventDefault();
    const p = toLocal(e);
    const hit = hitTest(p.x, p.y);
    if (hit) {
      G.removeEntity(hit.ent);
      G.SFX.trash();
    }
  });

  // double-click a belt to toggle it
  stage.addEventListener('dblclick', function (e) {
    const p = toLocal(e);
    const belt = G.beltAt(p.x, p.y);
    if (belt) {
      belt.active = !belt.active;
      G.SFX.click();
      G.markDirty();
      if (S.selected === belt && G.layoutChips) G.layoutChips(true);
    }
  });

  window.addEventListener('keydown', function (e) {
    const tag = e.target && e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    const k = e.key.toLowerCase();
    if (G.modalOpen && G.modalOpen()) {
      if (k === 'escape') G.closeModals();
      return;
    }
    switch (k) {
      case 'escape':
        if (G.cancelTubeDraw()) {
          G.setTool('select');
          break;
        }
        G.setTool('select');
        G.select(null);
        break;
      case 'v': G.setTool('select'); break;
      case 'b': G.setTool('belt'); break;
      case 't': G.setTool('tube'); break;
      case 'x': G.setTool('box'); break;
      case 'd': G.setTool('delete'); break;
      case 'delete':
      case 'backspace':
        if (S.selected) {
          G.removeEntity(S.selected);
          G.SFX.trash();
        }
        break;
      case 'h':
      case '?':
        G.toggleHelp();
        break;
      case 'm':
        G.toggleSound();
        break;
      case 's':
        if (e.metaKey || e.ctrlKey) {
          e.preventDefault();
          G.exportSave();
        }
        break;
    }
  });

  /* ---------------- floating chips ---------------- */

  const chipsEl = document.getElementById('chips');

  function chipButton(label, cls, title) {
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.title = title || '';
    if (cls) btn.className = cls;
    return btn;
  }

  function bindHoldExtend(btn, ent, dir) {
    let delayTimer = null;
    let repeatTimer = null;

    function stopHold() {
      if (delayTimer) clearTimeout(delayTimer);
      if (repeatTimer) clearInterval(repeatTimer);
      delayTimer = null;
      repeatTimer = null;
      if (G.layoutChips) G.layoutChips(false);
    }

    btn.addEventListener('pointerdown', function () {
      G.audio.unlock();
      if (G.extendTube(ent, dir)) G.SFX.click();
      delayTimer = setTimeout(function () {
        repeatTimer = setInterval(function () {
          if (!G.extendTube(ent, dir)) {
            stopHold();
            return;
          }
          G.SFX.pipe();
          /* Keep the floating controls anchored while holding, so the tooltip does not chase the new segment. */
        }, 240);
      }, 220);
      window.addEventListener('pointerup', stopHold, { once: true });
      window.addEventListener('pointercancel', stopHold, { once: true });
    });
    btn.addEventListener('pointerleave', stopHold);
    btn.addEventListener('pointercancel', stopHold);
    btn.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (G.extendTube(ent, dir)) G.SFX.click();
      }
    });
  }

  function buildBeltChips(ent) {
    const set = document.createElement('div');
    set.className = 'chip-set';
    const minus = chipButton('−', 'shrink', 'Shorter (min 1)');
    const left = chipButton('◀', ent.dir === -1 && ent.active ? 'on' : '', 'Run left');
    const right = chipButton('▶', ent.dir === 1 && ent.active ? 'on' : '', 'Run right');
    const plus = chipButton('＋', 'grow', 'Longer');
    minus.addEventListener('click', function () {
      G.setBeltModules(ent, ent.modules - 1);
      G.SFX.click();
      G.layoutChips(true);
    });
    left.addEventListener('click', function () {
      const was = ent.active && ent.dir === -1;
      ent.dir = -1;
      ent.active = !was;
      G.SFX.click();
      G.markDirty();
      G.layoutChips(true);
    });
    right.addEventListener('click', function () {
      const was = ent.active && ent.dir === 1;
      ent.dir = 1;
      ent.active = !was;
      G.SFX.click();
      G.markDirty();
      G.layoutChips(true);
    });
    plus.addEventListener('click', function () {
      G.setBeltModules(ent, ent.modules + 1);
      G.SFX.click();
      G.layoutChips(true);
    });
    set.appendChild(minus);
    set.appendChild(left);
    set.appendChild(right);
    set.appendChild(plus);
    chipsEl.appendChild(set);
  }

  function buildTubeChips(ent) {
    const set = document.createElement('div');
    set.className = 'chip-set';
    const last = ent.segs[ent.segs.length - 1];
    const arrows = { u: '▲', r: '▶', d: '▼', l: '◀' };
    const names = { u: 'Up', r: 'Right', d: 'Down', l: 'Left' };
    const blocked = last.from || null;
    for (const dir of G.DIR_LIST) {
      const btn = chipButton(arrows[dir], dir === blocked ? '' : '', names[dir] + ' — hold to extend tube');
      if (dir === blocked) btn.disabled = true;
      bindHoldExtend(btn, ent, dir);
      set.appendChild(btn);
    }
    const trim = chipButton('−', 'shrink', ent.segs.length <= 1 ? 'Remove tube' : 'Remove last segment');
    trim.addEventListener('click', function () {
      G.trimTube(ent);
      G.SFX.trash();
    });
    set.appendChild(trim);
    const move = chipButton('', S.moveMode ? 'on' : '', S.moveMode ? 'Move mode on' : 'Enable move mode');
    move.setAttribute('aria-label', 'Move');
    move.setAttribute('aria-pressed', S.moveMode ? 'true' : 'false');
    move.innerHTML = [
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">',
      '<path d="M12 4v16M4 12h16"/>',
      '<path d="M8 8l4-4 4 4"/>',
      '<path d="M8 16l4 4 4-4"/>',
      '<path d="M8 8L4 12l4 4"/>',
      '<path d="M16 8l4 4-4 4"/>',
      '</svg>',
    ].join('');
    move.addEventListener('click', function () {
      S.moveMode = !S.moveMode;
      move.classList.toggle('on', S.moveMode);
      move.title = S.moveMode ? 'Move mode on' : 'Enable move mode';
      move.setAttribute('aria-pressed', S.moveMode ? 'true' : 'false');
      G.SFX.click();
    });
    set.appendChild(move);
    chipsEl.appendChild(set);
  }

  G.layoutChips = function (rebuild) {
    const ent = S.selected;
    if (!ent || (ent.type !== 'belt' && ent.type !== 'tube')) {
      chipsEl.style.display = 'none';
      chipsEl.innerHTML = '';
      chipsEl.dataset.for = '';
      return;
    }
    if (rebuild || chipsEl.dataset.for !== String(ent.id)) {
      chipsEl.innerHTML = '';
      if (ent.type === 'belt') buildBeltChips(ent);
      else buildTubeChips(ent);
      chipsEl.dataset.for = String(ent.id);
    }
    chipsEl.style.display = 'block';
    let px, py;
    if (ent.type === 'belt') {
      px = ent.x + G.beltWidth(ent) / 2;
      py = ent.y - 52;
    } else {
      const last = ent.segs[ent.segs.length - 1];
      px = last.x + W.seg / 2;
      py = last.y - 42;
    }
    chipsEl.style.transform = 'translate(' + px + 'px, ' + py + 'px) translateX(-50%)';
  };
})();
