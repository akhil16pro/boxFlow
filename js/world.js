/* Box Flow — world state, entities, physics, save/load */
(function () {
  const G = (window.G = window.G || {});

  const W = (G.WORLD = {
    seg: 26,          // tube cell size
    beltCapW: 24,     // belt roller caps
    moduleW: 46,      // one belt module
    beltH: 20,
    boxR: 12,
    gravity: 1600,
    maxFall: 620,
    beltSpeed: 150,
    tubeSpeed: 260,
    eject: 0.95,      // fraction of tube speed boxes keep when ejected
    maxBoxes: 150,
    maxParts: 90,     // belts + tubes
    maxModules: 12,
  });

  const DIRS = { u: [0, -1], d: [0, 1], l: [-1, 0], r: [1, 0] };
  const OPP = { u: 'd', d: 'u', l: 'r', r: 'l' };
  G.DIRS = DIRS;
  G.OPP = OPP;
  G.DIR_LIST = ['u', 'r', 'd', 'l'];

  const S = (G.state = {
    w: 0, h: 0,
    boxes: [], belts: [], tubes: [],
    particles: [], motes: [],
    tool: 'select',
    selected: null,
    hover: null,
    moveMode: false,
    pointer: { x: 0, y: 0, inside: false },
    time: 0,
    nextId: 1,
    isDemo: false,
    seeding: false,
  });

  const uid = function () { return S.nextId++; };
  const clamp = G.clamp;
  const rand = G.rand;

  /* ---------------- particles ---------------- */

  function spawnP(p) {
    if (S.particles.length < 260) S.particles.push(p);
  }

  function puff(x, y, n, color) {
    n = n || 6;
    color = color || 'rgba(148,163,184,0.45)';
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2);
      const sp = rand(20, 90);
      spawnP({
        x, y,
        vx: Math.cos(a) * sp,
        vy: rand(-90, -20),
        r: rand(2, 5),
        life: 0, max: rand(0.3, 0.6),
        color, grav: 260,
      });
    }
  }

  function sparkle(x, y, color) {
    color = color || '#ffd166';
    for (let i = 0; i < 5; i++) {
      const a = rand(0, Math.PI * 2);
      const sp = rand(30, 120);
      spawnP({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        r: rand(1.5, 3),
        life: 0, max: rand(0.25, 0.5),
        color, grav: 0,
      });
    }
  }

  G.puff = puff;
  G.sparkle = sparkle;

  function updateParticles(dt) {
    for (let i = S.particles.length - 1; i >= 0; i--) {
      const p = S.particles[i];
      p.life += dt;
      if (p.life >= p.max) { S.particles.splice(i, 1); continue; }
      p.vy += p.grav * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  }

  /* ---------------- belts ---------------- */

  function beltWidth(belt) {
    return belt.modules * W.moduleW + W.beltCapW * 2;
  }
  G.beltWidth = beltWidth;

  /** Re-seat riders and pop stray boxes out of a belt's body. */
  function disturb(belt) {
    for (const b of S.boxes) {
      if (b.inTube || b.drag) continue;
      const w = beltWidth(belt);
      const overX = b.x > belt.x - b.r && b.x < belt.x + w + b.r;
      const surfaceY = belt.y + 2;
      const overY = b.y + b.r > surfaceY - 2 && b.y - b.r < belt.y + W.beltH;
      if (!overX || !overY) continue;
      if (b.support && b.support.kind === 'belt' && b.support.belt === belt) {
        b.y = surfaceY - b.r; // rider: re-seat on the (possibly moved) belt
      } else {
        b.y = Math.min(b.y, surfaceY - b.r - 1);
        b.landed = false;
        b.support = null;
        b.vy = Math.min(b.vy, 0);
      }
    }
  }
  G.disturb = disturb;

  G.addBelt = function (opts) {
    if (S.belts.length + S.tubes.length >= W.maxParts) {
      if (G.toast) G.toast('Part limit reached — delete something first');
      return null;
    }
    const o = opts || {};
    const belt = {
      id: uid(), type: 'belt',
      x: 0, y: 0,
      modules: clamp(Math.round(o.modules || 4), 1, W.maxModules),
      dir: o.dir < 0 ? -1 : 1,
      active: !!o.active,
    };
    const w = beltWidth(belt);
    belt.x = clamp((o.x || 0) - w / 2, 6, Math.max(6, S.w - w - 6));
    belt.y = clamp((o.y || 0) - W.beltH / 2, 8, Math.max(8, S.h - W.beltH - 8));
    S.belts.push(belt);
    disturb(belt);
    G.markDirty();
    return belt;
  };

  G.setBeltModules = function (belt, m) {
    const nm = clamp(m, 1, W.maxModules);
    if (nm === belt.modules) return;
    const oldW = beltWidth(belt);
    belt.modules = nm;
    const newW = beltWidth(belt);
    belt.x = clamp(belt.x - (newW - oldW) / 2, 6, Math.max(6, S.w - newW - 6));
    disturb(belt);
    G.markDirty();
  };

  /* ---------------- tubes ---------------- */

  function snapCell(v) {
    return Math.round(v / W.seg) * W.seg;
  }

  G.addTube = function (opts) {
    if (S.belts.length + S.tubes.length >= W.maxParts) {
      if (G.toast) G.toast('Part limit reached — delete something first');
      return null;
    }
    const o = opts || {};
    const maxX = Math.max(0, Math.floor(S.w / W.seg) * W.seg - W.seg);
    const maxY = Math.max(0, Math.floor(S.h / W.seg) * W.seg - W.seg);
    const gx = clamp(snapCell((o.x || 0) - W.seg / 2), 0, maxX);
    const gy = clamp(snapCell((o.y || 0) - W.seg / 2), 0, maxY);
    const group = {
      id: uid(), type: 'tube',
      segs: [{ x: gx, y: gy, from: null, to: 'u' }],
    };
    S.tubes.push(group);
    G.markDirty();
    return group;
  };

  function cellFree(x, y) {
    for (const g of S.tubes) {
      for (const s of g.segs) {
        if (s.x === x && s.y === y) return false;
      }
    }
    return true;
  }
  G.cellFreeExcept = function (ignoreGroup, x, y) {
    for (const g of S.tubes) {
      if (g === ignoreGroup) continue;
      for (const s of g.segs) {
        if (s.x === x && s.y === y) return false;
      }
    }
    return true;
  };

  function dirBetweenCells(a, b) {
    if (b.y < a.y) return 'u';
    if (b.y > a.y) return 'd';
    if (b.x < a.x) return 'l';
    return 'r';
  }

  /** Build a tube segment chain from grid cells: ports flow start -> end,
      and the last cell ejects straight through its far side. */
  G.tubeChainFromCells = function (cells) {
    return cells.map(function (c, i) {
      if (i === 0) {
        return {
          x: c.x, y: c.y, from: null,
          to: i < cells.length - 1 ? dirBetweenCells(c, cells[i + 1]) : 'u',
        };
      }
      const back = OPP[dirBetweenCells(cells[i - 1], c)];
      return {
        x: c.x, y: c.y,
        from: back,
        to: i < cells.length - 1 ? dirBetweenCells(c, cells[i + 1]) : dirBetweenCells(cells[i - 1], c),
      };
    });
  };

  G.extendTube = function (group, dir) {
    if (!DIRS[dir]) return false;
    const last = group.segs[group.segs.length - 1];
    const d = DIRS[dir];
    const nx = last.x + d[0] * W.seg;
    const ny = last.y + d[1] * W.seg;
    if (nx < 0 || ny < 0 || nx + W.seg > S.w || ny + W.seg > S.h) return false;
    if (!cellFree(nx, ny)) return false;
    last.to = dir;
    group.segs.push({ x: nx, y: ny, from: OPP[dir], to: dir });
    G.markDirty();
    return true;
  };

  G.trimTube = function (group) {
    if (!group || group.segs.length <= 1) {
      G.removeEntity(group);
      return;
    }
    const dropped = group.segs.pop();
    for (const b of S.boxes) {
      if (b.inTube === dropped) releaseBox(b);
    }
    if (S.selected === group && G.layoutChips) G.layoutChips(true);
    G.markDirty();
  };

  /* ---------------- boxes ---------------- */

  const COLORS = ['#ff6b6b', '#4ecdc4', '#ffd166', '#a78bfa', '#60a5fa', '#f8fafc'];
  G.COLORS = COLORS;

  function makeBox(x, y, color) {
    const r = W.boxR;
    return {
      id: uid(), type: 'box',
      x: clamp(x, r, Math.max(r, S.w - r)),
      y: clamp(y, r, Math.max(r, S.h - r)),
      vx: 0, vy: 0, r,
      color: color || G.pick(COLORS),
      landed: false, support: null, inTube: null,
      drag: false,
      squash: 0,
      blinkSeed: rand(0, 10),
      expression: 'surprise',
      noCapture: 0,
    };
  }

  G.spawnBox = function (opts) {
    const o = opts || {};
    if (S.boxes.length >= W.maxBoxes) {
      if (G.toast) G.toast('Box limit reached — delete a few first');
      return null;
    }
    const box = makeBox(o.x || 0, o.y || 0, o.color);
    S.boxes.push(box);
    sparkle(box.x, box.y, '#ffffff');
    G.markDirty();
    return box;
  };

  function detachBox(b) {
    b.support = null;
    b.landed = false;
  }

  function releaseBox(b) {
    b.inTube = null;
    b.support = null;
    b.landed = false;
    b.vx = 0;
    b.vy = 0;
    b.noCapture = 0.3;
  }

  /* ---------------- removal / selection ---------------- */

  G.removeEntity = function (ent) {
    if (!ent) return;
    if (ent.type === 'belt') {
      S.belts = S.belts.filter(function (b) { return b !== ent; });
      for (const b of S.boxes) {
        if (b.support && b.support.kind === 'belt' && b.support.belt === ent) detachBox(b);
      }
    } else if (ent.type === 'tube') {
      S.tubes = S.tubes.filter(function (g) { return g !== ent; });
      for (const b of S.boxes) {
        if (b.inTube && ent.segs.indexOf(b.inTube) !== -1) releaseBox(b);
      }
    } else if (ent.type === 'box') {
      S.boxes = S.boxes.filter(function (b) { return b !== ent; });
      for (const b of S.boxes) {
        if (b.support && b.support.kind === 'box' && b.support.box === ent) detachBox(b);
      }
    }
    if (S.selected === ent) G.select(null);
    G.markDirty();
  };

  /* ---------------- hit testing ---------------- */

  G.boxAt = function (x, y) {
    for (let i = S.boxes.length - 1; i >= 0; i--) {
      const b = S.boxes[i];
      if (G.dist(x, y, b.x, b.y) <= b.r + 5) return b;
    }
    return null;
  };

  G.beltAt = function (x, y) {
    for (let i = S.belts.length - 1; i >= 0; i--) {
      const b = S.belts[i];
      const w = beltWidth(b);
      if (x >= b.x - 4 && x <= b.x + w + 4 && y >= b.y - 6 && y <= b.y + W.beltH + 6) return b;
    }
    return null;
  };

  G.tubeAt = function (x, y) {
    for (let i = S.tubes.length - 1; i >= 0; i--) {
      const g = S.tubes[i];
      for (let j = g.segs.length - 1; j >= 0; j--) {
        const s = g.segs[j];
        if (x >= s.x - 2 && x <= s.x + W.seg + 2 && y >= s.y - 2 && y <= s.y + W.seg + 2) {
          return { group: g, seg: s, index: j };
        }
      }
    }
    return null;
  };

  /* ---------------- physics ---------------- */

  function validateSupport(b) {
    const sup = b.support;
    if (!sup) { b.landed = false; return; }
    if (sup.kind === 'belt') {
      if (S.belts.indexOf(sup.belt) === -1) return detachBox(b);
      const pad = b.r * 0.45;
      if (b.x < sup.belt.x - pad || b.x > sup.belt.x + beltWidth(sup.belt) + pad) return detachBox(b);
    } else {
      const o = sup.box;
      if (S.boxes.indexOf(o) === -1 || o.inTube) return detachBox(b);
      if (!o.landed) return detachBox(b);
      if (Math.abs(b.x - o.x) >= (b.r + o.r) * 0.9) return detachBox(b);
    }
  }

  function land(b, sup) {
    const impact = b.vy;
    b.landed = true;
    b.support = sup;
    b.vy = 0;
    b.squash = 1;
    if (impact > 300) {
      puff(b.x, b.y + b.r, Math.min(10, 3 + (impact / 120) | 0));
      if (G.SFX) G.SFX.thud(Math.min(1, impact / 700));
    } else if (impact > 80 && G.SFX) {
      G.SFX.thud(0.25);
    }
  }

  function tryLand(b, prevBottom) {
    const r = b.r;
    if (b.y + r >= S.h) {
      b.y = S.h - r;
      land(b, null);
      return;
    }
    // belts: land on the highest surface crossed
    let target = null;
    let top = Infinity;
    for (const belt of S.belts) {
      const sy = belt.y + 2;
      if (b.vy <= 0 || prevBottom > sy + 1 || b.y + r < sy) continue;
      const pad = r * 0.3;
      if (b.x < belt.x - pad || b.x > belt.x + beltWidth(belt) + pad) continue;
      if (sy < top) { top = sy; target = { kind: 'belt', belt: belt }; }
    }
    if (target) {
      b.y = top - r;
      land(b, target);
      return;
    }
    // other boxes
    for (const o of S.boxes) {
      if (o === b || o.inTube || o.drag) continue;
      const sy = o.y - o.r;
      if (b.vy <= 0 || prevBottom > sy + 1 || b.y + r < sy) continue;
      if (Math.abs(b.x - o.x) > (r + o.r) * 0.8) continue;
      b.y = sy - r;
      land(b, { kind: 'box', box: o });
      return;
    }
  }

  function moveRiders(src, dx, dy) {
    for (const b of S.boxes) {
      if (b.drag || b.inTube) continue;
      if (b.support && b.support.kind === 'box' && b.support.box === src) {
        b.x += dx;
        if (b.landed) b.y = src.y - src.r - b.r;
        moveRiders(b, dx, dy);
      }
    }
  }
  G.moveRiders = moveRiders;

  function grounded(b, dt) {
    const sup = b.support;
    if (sup && sup.kind === 'belt') {
      const belt = sup.belt;
      b.y = belt.y + 2 - b.r;
      if (belt.active) {
        const dx = belt.dir * W.beltSpeed * dt;
        b.x += dx;
        moveRiders(b, dx, 0);
      }
      b.vx *= Math.pow(0.001, dt);
      if (Math.abs(b.vx) >= 3) {
        const dx = b.vx * dt;
        b.x += dx;
        moveRiders(b, dx, 0);
      } else {
        b.vx = 0;
      }
    } else if (sup && sup.kind === 'box') {
      const o = sup.box;
      b.y = o.y - o.r - b.r;
      b.vx *= Math.pow(0.001, dt);
      if (Math.abs(b.vx) < 3) b.vx = 0;
    } else {
      b.y = S.h - b.r;
      b.vx *= Math.pow(0.001, dt);
      if (Math.abs(b.vx) < 3) b.vx = 0;
    }
  }

  function falling(b, dt) {
    b.vy = Math.min(b.vy + W.gravity * dt, W.maxFall);
    const prevBottom = b.y + b.r;
    b.y += b.vy * dt;
    b.x += b.vx * dt;
    b.vx *= Math.pow(0.35, dt);
    tryLand(b, prevBottom);
  }

  function clampWalls(b) {
    const r = b.r;
    if (b.x < r) { b.x = r; if (b.vx < 0) b.vx = 0; }
    else if (b.x > S.w - r) { b.x = S.w - r; if (b.vx > 0) b.vx = 0; }
    if (b.y < r) { b.y = r; if (b.vy < 0) b.vy = 0; }
    else if (b.y > S.h - r && !b.inTube && !b.landed && !b.drag) {
      b.y = S.h - r;
      land(b, null);
    }
  }

  function transfer(b, seg, exit) {
    let group = null;
    for (const g of S.tubes) {
      if (g.segs.indexOf(seg) !== -1) { group = g; break; }
    }
    const d = DIRS[exit];
    let next = null;
    if (group) {
      const nx = seg.x + d[0] * W.seg;
      const ny = seg.y + d[1] * W.seg;
      for (const s of group.segs) {
        if (s.x === nx && s.y === ny) { next = s; break; }
      }
    }
    if (next) {
      b.inTube = next;
      if (G.SFX) G.SFX.pipe();
    } else {
      releaseBox(b);
      b.x = seg.x + W.seg / 2 + d[0] * (W.seg / 2 + b.r + 2);
      b.y = seg.y + W.seg / 2 + d[1] * (W.seg / 2 + b.r + 2);
      b.vx = d[0] * W.tubeSpeed * W.eject;
      b.vy = d[1] * W.tubeSpeed * W.eject;
      sparkle(b.x, b.y, '#7dd3fc');
      if (G.SFX) G.SFX.eject();
    }
  }

  function tubeMove(b, dt) {
    const seg = b.inTube;
    let owner = false;
    for (const g of S.tubes) {
      if (g.segs.indexOf(seg) !== -1) { owner = true; break; }
    }
    if (!owner) { releaseBox(b); return; }
    const d = DIRS[seg.to] || DIRS.d;
    const sp = W.tubeSpeed;
    b.x += d[0] * sp * dt;
    b.y += d[1] * sp * dt;
    const cx = seg.x + W.seg / 2;
    const cy = seg.y + W.seg / 2;
    if (d[1] !== 0) b.x = cx; else b.y = cy; // stay on the pipe centerline
    const edge = W.seg / 2 - 6;
    if (d[1] > 0 && b.y >= cy + edge) transfer(b, seg, 'd');
    else if (d[1] < 0 && b.y <= cy - edge) transfer(b, seg, 'u');
    else if (d[0] > 0 && b.x >= cx + edge) transfer(b, seg, 'r');
    else if (d[0] < 0 && b.x <= cx - edge) transfer(b, seg, 'l');
  }

  function tryCapture(b) {
    if (b.noCapture > 0) return;
    for (const g of S.tubes) {
      for (const e of g.segs) {
        const cx = e.x + W.seg / 2;
        const cy = e.y + W.seg / 2;
        const zone = W.seg / 2 + 9;
        if (Math.abs(b.x - cx) <= zone && Math.abs(b.y - cy) <= zone) {
          b.inTube = e;
          b.landed = false;
          b.support = null;
          b.vx = 0;
          b.vy = 0;
          b.x = cx;
          b.y = cy;
          b.squash = 0.7;
          sparkle(cx, cy, '#7dd3fc');
          if (G.SFX) G.SFX.suck();
          return;
        }
      }
    }
  }

  function separate() {
    const minD = W.boxR * 2 - 2;
    const boxes = S.boxes;
    for (let iter = 0; iter < 2; iter++) {
      for (let i = 0; i < boxes.length; i++) {
        const a = boxes[i];
        if (a.drag) continue;
        for (let j = i + 1; j < boxes.length; j++) {
          const c = boxes[j];
          if (c.drag) continue;
          if (a.inTube && c.inTube) continue;
          let dx = c.x - a.x;
          let dy = c.y - a.y;
          let d = Math.sqrt(dx * dx + dy * dy);
          if (d >= minD) continue;
          if (d < 0.01) { dx = 0.01; dy = -0.01; d = 0.0141; }
          const nx = dx / d;
          const ny = dy / d;
          const push = minD - d;
          if (a.inTube) {
            c.x += nx * push;
            c.y += ny * push * 0.3;
          } else if (c.inTube) {
            a.x -= nx * push;
            a.y -= ny * push * 0.3;
          } else if (a.landed && !c.landed) {
            c.x += nx * push;
            c.y += ny * push;
          } else if (c.landed && !a.landed) {
            a.x -= nx * push;
            a.y -= ny * push;
          } else {
            const half = push / 2;
            a.x -= nx * half;
            a.y -= ny * half * 0.6;
            c.x += nx * half;
            c.y += ny * half * 0.6;
          }
          clampWalls(a);
          clampWalls(c);
        }
      }
    }
  }

  G.stepPhysics = function (dt) {
    S.time += dt;
    updateParticles(dt);

    for (const b of S.boxes) {
      if (b.noCapture > 0) b.noCapture = Math.max(0, b.noCapture - dt);
      b.squash = Math.max(0, b.squash - dt * 4);
    }
    for (const b of S.boxes) {
      if (!b.drag && !b.inTube && b.support) validateSupport(b);
    }
    for (const b of S.boxes) {
      if (!b.drag && !b.inTube) tryCapture(b);
    }
    // bottom-up so stacked boxes follow their supports within the same tick
    const order = S.boxes.slice().sort(function (a, c) { return a.y - c.y; });
    for (const b of order) {
      if (b.drag) continue;
      if (b.inTube) tubeMove(b, dt);
      else if (b.landed) grounded(b, dt);
      else falling(b, dt);
      clampWalls(b);
    }
    separate();

    for (const b of S.boxes) {
      b.expression = b.inTube
        ? 'joy'
        : !b.landed
          ? 'surprise'
          : (b.support && b.support.kind === 'belt' && b.support.belt.active)
            ? 'neutral'
            : 'sleepy';
    }
  };

  /* ---------------- persistence ---------------- */

  G.serialize = function () {
    return {
      v: 1,
      demo: S.isDemo === true,
      belts: S.belts.map(function (b) {
        return { x: Math.round(b.x), y: Math.round(b.y), modules: b.modules, dir: b.dir, active: !!b.active };
      }),
      tubes: S.tubes.map(function (g) {
        return {
          segs: g.segs.map(function (s) {
            return { x: Math.round(s.x), y: Math.round(s.y), from: s.from, to: s.to };
          }),
        };
      }),
      boxes: S.boxes.map(function (b) {
        return { x: Math.round(b.x), y: Math.round(b.y), color: b.color };
      }),
    };
  };

  const num = function (v) { return typeof v === 'number' && isFinite(v); };

  G.deserialize = function (data) {
    if (!data || typeof data !== 'object') throw new Error('bad save');
    const belts = [];
    const tubes = [];
    const boxes = [];
    const beltSrc = Array.isArray(data.belts) ? data.belts : [];
    for (const b of beltSrc) {
      if (belts.length >= W.maxParts) break;
      if (!b || !num(b.x) || !num(b.y)) continue;
      belts.push({
        id: uid(), type: 'belt',
        x: clamp(b.x, 0, Math.max(0, S.w)), y: clamp(b.y, 0, Math.max(0, S.h)),
        modules: clamp(Math.round(b.modules || 4), 1, W.maxModules),
        dir: b.dir < 0 ? -1 : 1,
        active: !!b.active,
      });
    }
    const tubeSrc = Array.isArray(data.tubes) ? data.tubes : [];
    for (const t of tubeSrc) {
      if (tubes.length >= W.maxParts) break;
      if (!t || !Array.isArray(t.segs) || !t.segs.length) continue;
      const segs = [];
      for (const s of t.segs) {
        if (!s || !num(s.x) || !num(s.y)) continue;
        segs.push({
          x: clamp(Math.round(s.x), 0, Math.max(0, S.w - W.seg)),
          y: clamp(Math.round(s.y), 0, Math.max(0, S.h - W.seg)),
          from: OPP[s.from] ? s.from : null,
          to: OPP[s.to] ? s.to : 'd',
        });
      }
      if (segs.length) tubes.push({ id: uid(), type: 'tube', segs: segs });
    }
    const boxSrc = Array.isArray(data.boxes) ? data.boxes : [];
    for (const b of boxSrc) {
      if (boxes.length >= W.maxBoxes) break;
      if (!b || !num(b.x) || !num(b.y)) continue;
      const box = makeBox(b.x, b.y, typeof b.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(b.color) ? b.color : null);
      boxes.push(box);
    }
    S.belts = belts;
    S.tubes = tubes;
    S.boxes = boxes;
    S.particles.length = 0;
    if (G.select) G.select(null);
    G.markDirty();
  };

  G.clearAll = function () {
    S.belts = [];
    S.tubes = [];
    S.boxes = [];
    S.particles.length = 0;
    if (G.select) G.select(null);
    G.markDirty();
  };

  let saveTimer = null;
  G.markDirty = function () {
    if (!S.seeding) S.isDemo = false;
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      saveTimer = null;
      try { localStorage.setItem('boxflow.autosave.v1', JSON.stringify(G.serialize())); } catch (e) { /* storage unavailable */ }
    }, 350);
  };

  /* ---------------- first-run demo scene ---------------- */

  G.seedScene = function () {
    // Ship the converted ma5a layout as the sample factory players start with.
    // It reloads on refresh until the player edits the scene (see markDirty).
    S.seeding = true;
    S.isDemo = true;
    if (G.DEMO_LAYOUT) {
      G.deserialize(G.DEMO_LAYOUT);
    } else {
      // fallback if the demo file is missing
      G.addBelt({ x: S.w * 0.3, y: S.h * 0.6, modules: 6, dir: 1, active: true });
      for (let i = 0; i < 3; i++) G.spawnBox({ x: S.w * 0.25 + i * 50, y: S.h * 0.3 });
    }
    // one starter box hovering above each tube mouth so every geyser fires
    for (const g of S.tubes) {
      const e = g.segs[0];
      G.spawnBox({ x: e.x + W.seg / 2, y: Math.max(W.boxR + 2, e.y - 46) });
    }
    S.seeding = false;
  };

  /* ---------------- ma5a config converter ---------------- */

  /** Convert the original "box flow system" config array into our layout format. */
  G.convertLegacyConfig = function (arr) {
    const belts = [];
    const tubes = [];
    const boxes = [];
    const src = Array.isArray(arr) ? arr : [];
    for (const item of src) {
      if (!item || !item.type || !item.props) continue;
      const p = item.props;
      if (item.type === 'conveyorBelt' && p.pos) {
        belts.push({
          x: clamp(Math.round(p.pos.x), 0, Math.max(0, S.w)),
          y: clamp(Math.round(p.pos.y - 2), 0, Math.max(0, S.h)),
          modules: clamp(Math.round(p.moduleNo || 4), 1, W.maxModules),
          dir: p.moveDirection < 0 ? 1 : -1,
          active: !!p.isActive,
        });
      } else if (item.type === 'pneumaticTube' && p.tubeConfig && p.pos) {
        const chars = String(p.tubeConfig).split('').filter(function (c) { return OPP[c]; });
        if (!chars.length) continue;
        const sx = clamp(Math.floor(p.pos.x / W.seg) * W.seg, 0, Math.max(0, S.w - W.seg));
        const sy = clamp(Math.floor(p.pos.y / W.seg) * W.seg, 0, Math.max(0, S.h - W.seg));
        const cells = [{ x: sx, y: sy }];
        for (const ch of chars) {
          const last = cells[cells.length - 1];
          const nx = last.x + DIRS[ch][0] * W.seg;
          const ny = last.y + DIRS[ch][1] * W.seg;
          if (nx < 0 || ny < 0 || nx + W.seg > S.w || ny + W.seg > S.h) break;
          if (cells.length >= 2) {
            const prev = cells[cells.length - 2];
            if (nx === prev.x && ny === prev.y) continue; // visual U-turn in the source
          }
          if (cells.some(function (c) { return c.x === nx && c.y === ny; })) continue;
          cells.push({ x: nx, y: ny });
        }
        if (cells.length) tubes.push({ segs: cells });
      } else if (item.type === 'box' && p.pos) {
        boxes.push({
          x: clamp(Math.round(p.pos.x), W.boxR, Math.max(W.boxR, S.w - W.boxR)),
          y: clamp(Math.round(p.pos.y), W.boxR, Math.max(W.boxR, S.h - W.boxR)),
          color: typeof p.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(p.color) ? p.color : null,
        });
      }
    }
    return { v: 1, belts: belts, tubes: tubes, boxes: boxes };
  };
})();
