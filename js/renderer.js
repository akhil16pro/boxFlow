/* Box Flow — canvas renderer */
(function () {
  const G = (window.G = window.G || {});
  const S = G.state;
  const W = G.WORLD;

  let bgGrad = null;
  let bgW = 0;
  let bgH = 0;
  let vig = null;
  let vigW = 0;
  let vigH = 0;

  const roundRect = G.roundRect;
  const shade = G.shade;

  G.makeMotes = function () {
    const n = Math.min(50, Math.round((S.w * S.h) / 36000));
    S.motes = [];
    for (let i = 0; i < n; i++) {
      S.motes.push({
        x: Math.random() * S.w,
        y: Math.random() * S.h,
        r: 1 + Math.random() * 1.8,
        sp: 4 + Math.random() * 10,
        ph: Math.random() * Math.PI * 2,
      });
    }
  };

  /* ---------------- background ---------------- */

  function drawBackground(c, w, h) {
    if (!bgGrad || bgH !== h || bgW !== w) {
      bgGrad = c.createLinearGradient(0, 0, 0, h);
      bgGrad.addColorStop(0, '#141b30');
      bgGrad.addColorStop(0.55, '#101527');
      bgGrad.addColorStop(1, '#0b0f1d');
      bgH = h;
      bgW = w;
    }
    c.fillStyle = bgGrad;
    c.fillRect(0, 0, w, h);

    // dot grid
    c.fillStyle = 'rgba(148,163,184,0.055)';
    const step = 38;
    for (let y = step / 2; y < h; y += step) {
      for (let x = step / 2; x < w; x += step) {
        c.fillRect(x, y, 1.5, 1.5);
      }
    }

    // floating motes
    for (const m of S.motes) {
      const yy = ((m.y - S.time * m.sp) % h + h) % h;
      const tw = 0.5 + 0.5 * Math.sin(S.time * 1.3 + m.ph);
      c.globalAlpha = 0.04 + 0.09 * tw;
      c.fillStyle = '#9db4ff';
      c.beginPath();
      c.arc(m.x, yy, m.r, 0, Math.PI * 2);
      c.fill();
    }
    c.globalAlpha = 1;
  }

  function drawVignette(c, w, h) {
    if (!vig || vigW !== w || vigH !== h) {
      vig = c.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
      vig.addColorStop(0, 'rgba(0,0,0,0)');
      vig.addColorStop(1, 'rgba(3,6,15,0.55)');
      vigW = w;
      vigH = h;
    }
    c.fillStyle = vig;
    c.fillRect(0, 0, w, h);
  }

  /* ---------------- belts ---------------- */

  function drawBelt(c, belt) {
    const w = G.beltWidth(belt);
    const x = belt.x;
    const y = belt.y;
    const h = W.beltH;
    const active = belt.active;

    roundRect(c, x, y, w, h, 9);
    const g = c.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, active ? '#3d476b' : '#333b58');
    g.addColorStop(1, active ? '#252c47' : '#222840');
    c.fillStyle = g;
    c.fill();
    c.lineWidth = 2;
    c.strokeStyle = 'rgba(8,10,20,0.8)';
    c.stroke();

    // end rollers with rotating spokes
    for (const rx of [x + 12, x + w - 12]) {
      c.beginPath();
      c.arc(rx, y + h / 2, 7, 0, Math.PI * 2);
      c.fillStyle = '#1a2036';
      c.fill();
      c.lineWidth = 1.5;
      c.strokeStyle = '#4a5578';
      c.stroke();
      c.save();
      c.translate(rx, y + h / 2);
      c.rotate(S.time * 4 * belt.dir * (active ? 1 : 0));
      c.strokeStyle = 'rgba(148,163,184,0.5)';
      c.lineWidth = 1.4;
      c.beginPath();
      c.moveTo(-4, 0);
      c.lineTo(4, 0);
      c.moveTo(0, -4);
      c.lineTo(0, 4);
      c.stroke();
      c.restore();
    }

    // scrolling tread
    const tx = x + 18;
    const tw = w - 36;
    if (tw > 4) {
      c.save();
      roundRect(c, tx, y + 4, tw, h - 8, 5);
      c.clip();
      c.fillStyle = active ? '#151a2e' : '#141827';
      c.fillRect(tx, y + 4, tw, h - 8);
      const period = 16;
      const off = active ? ((S.time * W.beltSpeed * belt.dir) % period + period) % period : 0;
      c.strokeStyle = active ? 'rgba(125,211,252,0.38)' : 'rgba(148,163,184,0.14)';
      c.lineWidth = 3;
      c.beginPath();
      for (let o = -period; o < tw + period; o += period) {
        const cx = tx + o + off;
        c.moveTo(cx, y + 4);
        c.lineTo(cx + 6, y + h - 4);
      }
      c.stroke();
      c.restore();
    }

    // status LED
    c.beginPath();
    c.arc(x + w / 2, y - 4, 2.5, 0, Math.PI * 2);
    if (active) {
      c.shadowColor = '#4ade80';
      c.shadowBlur = 8;
      c.fillStyle = '#4ade80';
    } else {
      c.fillStyle = '#44507a';
    }
    c.fill();
    c.shadowBlur = 0;
  }

  /* ---------------- tubes ---------------- */

  function chevron(c, x, y, dir, alpha) {
    c.globalAlpha = alpha;
    c.strokeStyle = 'rgba(255,255,255,0.85)';
    c.lineWidth = 1.6;
    c.beginPath();
    if (dir === 'u') { c.moveTo(x - 4, y + 3); c.lineTo(x, y - 2); c.lineTo(x + 4, y + 3); }
    else if (dir === 'd') { c.moveTo(x - 4, y - 3); c.lineTo(x, y + 2); c.lineTo(x + 4, y - 3); }
    else if (dir === 'l') { c.moveTo(x + 3, y - 4); c.lineTo(x - 2, y); c.lineTo(x + 3, y + 4); }
    else { c.moveTo(x - 3, y - 4); c.lineTo(x + 2, y); c.lineTo(x - 3, y + 4); }
    c.stroke();
    c.globalAlpha = 1;
  }

  function drawTubePipes(c, group) {
    for (let i = 0; i < group.segs.length; i++) {
      const s = group.segs[i];
      const sz = W.seg;
      const cx = s.x + sz / 2;
      const cy = s.y + sz / 2;

      // intake funnel on the entrance
      if (i === 0 && !s.from) {
        c.beginPath();
        c.moveTo(s.x + 3, s.y + sz + 2);
        c.lineTo(s.x + sz - 3, s.y + sz + 2);
        c.lineTo(s.x + sz + 5, s.y + sz + 16);
        c.lineTo(s.x - 5, s.y + sz + 16);
        c.closePath();
        c.fillStyle = '#39415f';
        c.fill();
        c.lineWidth = 1.5;
        c.strokeStyle = 'rgba(8,10,20,0.7)';
        c.stroke();
        // suction pulse below the mouth
        const pulse = (S.time * 40) % 18;
        chevron(c, cx, s.y + sz + 14 - pulse, 'u', 0.25 + 0.2 * Math.sin(S.time * 4));
      }

      // pipe body
      roundRect(c, s.x - 3, s.y - 3, sz + 6, sz + 6, 10);
      const g = c.createLinearGradient(0, s.y - 3, 0, s.y + sz + 3);
      g.addColorStop(0, '#66739a');
      g.addColorStop(0.5, '#4b5578');
      g.addColorStop(1, '#39415f');
      c.fillStyle = g;
      c.fill();
      c.lineWidth = 2;
      c.strokeStyle = 'rgba(8,10,20,0.8)';
      c.stroke();

      // port openings
      c.fillStyle = '#141a2c';
      const ports = [s.from, s.to].filter(Boolean);
      for (const p of ports) {
        if (p === 'u') c.fillRect(cx - 6, s.y - 4, 12, 8);
        else if (p === 'd') c.fillRect(cx - 6, s.y + sz - 4, 12, 8);
        else if (p === 'l') c.fillRect(s.x - 4, cy - 6, 8, 12);
        else c.fillRect(s.x + sz - 4, cy - 6, 8, 12);
      }

      // flow chevrons
      const flow = G.DIRS[s.to] || [0, 1];
      for (let k = 0; k < 3; k++) {
        const t = ((S.time * 1.6 + k / 3) % 1);
        const alpha = 0.12 + 0.22 * Math.sin(t * Math.PI);
        const off = -10 + t * 20;
        chevron(c, cx + flow[0] * off, cy + flow[1] * off, s.to || 'd', alpha);
      }
    }
  }

  function drawTubeGlass(c, group) {
    for (let i = 0; i < group.segs.length; i++) {
      const s = group.segs[i];
      const sz = W.seg;
      roundRect(c, s.x - 1, s.y - 1, sz + 2, sz + 2, 8);
      c.strokeStyle = 'rgba(255,255,255,0.1)';
      c.lineWidth = 1.5;
      c.stroke();
      c.strokeStyle = 'rgba(255,255,255,0.16)';
      c.beginPath();
      c.moveTo(s.x + 4, s.y + 8);
      c.lineTo(s.x + 8, s.y + 4);
      c.stroke();
    }
  }

  /* ---------------- boxes ---------------- */

  function drawFace(c, b) {
    const mood = b.expression;
    const ex = 4.6;
    const ey = -2.5;
    const blink = ((S.time + b.blinkSeed) % 3.4) < 0.12;
    c.fillStyle = '#1f2937';
    c.strokeStyle = '#1f2937';

    for (const side of [-1, 1]) {
      c.save();
      c.translate(side * ex, ey);
      if (mood === 'sleepy') {
        c.lineWidth = 1.8;
        c.beginPath();
        c.arc(0, 0.8, 2.6, Math.PI * 0.15, Math.PI * 0.85);
        c.stroke();
      } else if (mood === 'joy') {
        c.lineWidth = 1.8;
        c.beginPath();
        c.arc(0, 1.2, 2.6, Math.PI * 1.15, Math.PI * 1.85);
        c.stroke();
      } else if (blink) {
        c.fillRect(-2.4, -0.9, 4.8, 1.8);
      } else {
        c.beginPath();
        c.arc(0, 0, mood === 'surprise' ? 2.7 : 2.1, 0, Math.PI * 2);
        c.fill();
      }
      c.restore();
    }

    // mouth
    c.lineWidth = 1.8;
    c.beginPath();
    if (mood === 'joy') {
      c.arc(0, 3, 3.4, Math.PI * 0.15, Math.PI * 0.85);
      c.stroke();
    } else if (mood === 'surprise') {
      c.arc(0, 4.5, 2.2, 0, Math.PI * 2);
      c.fill();
    } else if (mood === 'neutral') {
      c.arc(0, 2.2, 2.6, Math.PI * 0.2, Math.PI * 0.8);
      c.stroke();
    } else {
      c.moveTo(-2, 4.5);
      c.lineTo(2, 4.5);
      c.stroke();
    }

    // sleepy zzz
    if (mood === 'sleepy' && !b.inTube) {
      const frac = (S.time * 0.5 + b.blinkSeed) % 1;
      c.globalAlpha = 0.4 * Math.sin(frac * Math.PI);
      c.fillStyle = '#8b98b8';
      c.font = 'bold 9px ui-rounded, system-ui, sans-serif';
      c.fillText('z', b.r * 0.55, -b.r - 4 - frac * 6);
      c.globalAlpha = 1;
    }
  }

  function drawBoxBody(c, b, scale) {
    const r = b.r;
    const squash = b.squash || 0;
    const sx = (1 + squash * 0.16) * (scale || 1);
    const sy = (1 - squash * 0.2) * (scale || 1);
    const falling = !b.landed && !b.inTube;
    const rot = falling ? Math.sin(S.time * 5 + b.id) * 0.06 : 0;

    c.save();
    c.translate(b.x, b.y);
    c.rotate(rot);
    c.scale(sx, sy);

    roundRect(c, -r, -r, r * 2, r * 2, 7);
    const g = c.createLinearGradient(0, -r, 0, r);
    g.addColorStop(0, shade(b.color, 0.35));
    g.addColorStop(1, b.color);
    c.fillStyle = g;
    c.fill();
    c.lineWidth = 2;
    c.strokeStyle = shade(b.color, -0.4);
    c.stroke();

    roundRect(c, -r + 3, -r + 3, r * 2 - 6, 5, 3);
    c.fillStyle = 'rgba(255,255,255,0.28)';
    c.fill();

    drawFace(c, b);
    c.restore();
  }

  function drawFreeBoxes(c) {
    for (const b of S.boxes) {
      if (b.inTube) continue;
      // contact shadow
      c.globalAlpha = b.landed ? 0.2 : 0.08;
      c.fillStyle = '#000';
      c.beginPath();
      c.ellipse(b.x, b.y + b.r + 3, b.r * 0.85, 3, 0, 0, Math.PI * 2);
      c.fill();
      c.globalAlpha = 1;
      drawBoxBody(c, b, 1);
    }
  }

  function drawTubeContents(c) {
    for (const g of S.tubes) {
      // occupants clipped inside their cell
      for (const s of g.segs) {
        for (const b of S.boxes) {
          if (b.inTube !== s) continue;
          c.save();
          roundRect(c, s.x + 3, s.y + 3, W.seg - 6, W.seg - 6, 7);
          c.clip();
          drawBoxBody(c, b, 0.82);
          c.restore();
        }
      }
      // glass pass
      drawTubeGlass(c, g);
    }
  }

  /* ---------------- particles ---------------- */

  function drawParticles(c) {
    for (const p of S.particles) {
      const t = p.life / p.max;
      c.globalAlpha = 1 - t;
      c.fillStyle = p.color;
      c.beginPath();
      c.arc(p.x, p.y, p.r * (1 - t * 0.5), 0, Math.PI * 2);
      c.fill();
    }
    c.globalAlpha = 1;
  }

  /* ---------------- selection / hover / ghost ---------------- */

  function outlineBelt(c, belt, color) {
    const w = G.beltWidth(belt);
    roundRect(c, belt.x - 5, belt.y - 5, w + 10, W.beltH + 10, 12);
    c.strokeStyle = color;
    c.lineWidth = 2;
    c.setLineDash([6, 5]);
    c.lineDashOffset = -S.time * 30;
    c.stroke();
    c.setLineDash([]);
  }

  function outlineBox(c, box, color) {
    c.beginPath();
    c.arc(box.x, box.y, box.r + 6, 0, Math.PI * 2);
    c.strokeStyle = color;
    c.lineWidth = 2;
    c.setLineDash([5, 5]);
    c.lineDashOffset = -S.time * 30;
    c.stroke();
    c.setLineDash([]);
  }

  function drawSelection(c) {
    const ent = S.selected;
    if (ent && ent.type === 'belt') {
      outlineBelt(c, ent, 'rgba(255,209,102,0.9)');
    } else if (ent && ent.type === 'tube') {
      for (const s of ent.segs) {
        roundRect(c, s.x - 5, s.y - 5, W.seg + 10, W.seg + 10, 11);
        c.strokeStyle = 'rgba(255,209,102,0.35)';
        c.lineWidth = 1.5;
        c.stroke();
      }
      const last = ent.segs[ent.segs.length - 1];
      roundRect(c, last.x - 6, last.y - 6, W.seg + 12, W.seg + 12, 12);
      c.strokeStyle = 'rgba(255,209,102,0.85)';
      c.lineWidth = 2;
      c.setLineDash([6, 5]);
      c.lineDashOffset = -S.time * 30;
      c.stroke();
      c.setLineDash([]);
    }
    if (S.hover && S.tool === 'delete' && S.hover !== ent) {
      if (S.hover.type === 'belt') outlineBelt(c, S.hover, 'rgba(255,107,107,0.9)');
      else if (S.hover.type === 'box') outlineBox(c, S.hover, 'rgba(255,107,107,0.9)');
      else if (S.hover.type === 'tube') {
        for (const s of S.hover.segs) {
          roundRect(c, s.x - 4, s.y - 4, W.seg + 8, W.seg + 8, 10);
          c.strokeStyle = 'rgba(255,107,107,0.8)';
          c.lineWidth = 1.5;
          c.stroke();
        }
      }
    }
  }

  function drawGhost(c) {
    if (!S.pointer.inside) return;
    const p = S.pointer;
    const tool = S.tool;
    c.save();
    c.globalAlpha = 0.75;
    if (tool === 'box') {
      c.beginPath();
      c.arc(p.x, p.y, W.boxR, 0, Math.PI * 2);
      c.setLineDash([5, 4]);
      c.strokeStyle = 'rgba(226,232,240,0.7)';
      c.lineWidth = 1.6;
      c.stroke();
      c.setLineDash([]);
    } else if (tool === 'belt') {
      const w = 4 * W.moduleW + W.beltCapW * 2;
      const gx = G.clamp(p.x - w / 2, 6, Math.max(6, S.w - w - 6));
      const gy = G.clamp(p.y - W.beltH / 2, 8, Math.max(8, S.h - W.beltH - 8));
      const ok = gx === p.x - w / 2 && gy === p.y - W.beltH / 2;
      roundRect(c, gx, gy, w, W.beltH, 9);
      c.strokeStyle = ok ? 'rgba(255,209,102,0.8)' : 'rgba(255,107,107,0.8)';
      c.lineWidth = 1.8;
      c.setLineDash([7, 5]);
      c.stroke();
      c.setLineDash([]);
    } else if (tool === 'tube') {
      const maxX = Math.max(0, Math.floor(S.w / W.seg) * W.seg - W.seg);
      const maxY = Math.max(0, Math.floor(S.h / W.seg) * W.seg - W.seg);
      const gx = G.clamp(Math.round((p.x - W.seg / 2) / W.seg) * W.seg, 0, maxX);
      const gy = G.clamp(Math.round((p.y - W.seg / 2) / W.seg) * W.seg, 0, maxY);
      roundRect(c, gx - 3, gy - 3, W.seg + 6, W.seg + 6, 10);
      c.strokeStyle = 'rgba(125,211,252,0.8)';
      c.lineWidth = 1.8;
      c.setLineDash([7, 5]);
      c.stroke();
      c.setLineDash([]);
      chevron(c, gx + W.seg / 2, gy + W.seg / 2 + 4, 'u', 0.7);
    }
    c.restore();
  }

  /* ---------------- main entry ---------------- */

  G.render = function (c) {
    const w = S.w;
    const h = S.h;
    if (w <= 0 || h <= 0) return;

    drawBackground(c, w, h);
    for (const g of S.tubes) drawTubePipes(c, g);
    drawTubeContents(c);
    if (G.tubeDraft && G.tubeDraft.length > 1) {
      c.save();
      c.strokeStyle = 'rgba(255,209,102,0.9)';
      c.lineWidth = 2;
      c.setLineDash([8, 6]);
      c.lineDashOffset = -S.time * 40;
      c.beginPath();
      for (let i = 0; i < G.tubeDraft.length; i++) {
        const cell = G.tubeDraft[i];
        const cx = cell.x + W.seg / 2;
        const cy = cell.y + W.seg / 2;
        if (i === 0) c.moveTo(cx, cy);
        else c.lineTo(cx, cy);
      }
      c.stroke();
      const tail = G.tubeDraft[G.tubeDraft.length - 1];
      const head = G.tubeDraft[G.tubeDraft.length - 2];
      const dx = tail.x - head.x;
      const dy = tail.y - head.y;
      const dir = dy < 0 ? 'u' : dy > 0 ? 'd' : dx < 0 ? 'l' : 'r';
      chevron(c, tail.x + W.seg / 2, tail.y + W.seg / 2, dir, 0.9);
      c.restore();
    }
    for (const belt of S.belts) drawBelt(c, belt);
    drawFreeBoxes(c);
    drawParticles(c);
    drawSelection(c);
    drawGhost(c);
    drawVignette(c, w, h);
  };
})();
