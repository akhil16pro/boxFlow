/* Box Flow — shared helpers */
(function () {
  const G = (window.G = window.G || {});

  G.clamp = function (v, min, max) {
    return v < min ? min : v > max ? max : v;
  };

  G.rand = function (min, max) {
    return min + Math.random() * (max - min);
  };

  G.pick = function (arr) {
    return arr[(Math.random() * arr.length) | 0];
  };

  G.dist = function (ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay;
    return Math.sqrt(dx * dx + dy * dy);
  };

  G.lerp = function (a, b, t) {
    return a + (b - a) * t;
  };

  G.roundRect = function (c, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  };

  /** amount in [-1, 1]: negative darkens, positive lightens. */
  G.shade = function (hex, amount) {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    if (amount >= 0) {
      r += (255 - r) * amount;
      g += (255 - g) * amount;
      b += (255 - b) * amount;
    } else {
      r *= 1 + amount;
      g *= 1 + amount;
      b *= 1 + amount;
    }
    return 'rgb(' + (r | 0) + ',' + (g | 0) + ',' + (b | 0) + ')';
  };
})();
