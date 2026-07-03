// Carte en direct : positions des joueurs (API REST location_x/y), marqueurs voyage rapide et
// tours de boss, zoom/pan, regroupement des joueurs proches. Fond : public/map.png si présent
// (image couvrant les coordonnées carte -1000..1000), sinon grille de secours.
(function () {
  const canvas = document.getElementById('mapCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const MAP_EXTENT = 1000; // coordonnées carte du jeu : -1000..1000 sur les deux axes

  // Vue : centre (coordonnées carte) + zoom (pixels CSS par unité carte)
  const view = { x: 0, y: 0, scale: 0.28 };
  let players = [];
  let markers = { transform: { offsetX: 123888, offsetY: -158000, scale: 459.617 }, bossTowers: [], fastTravel: [] };

  // Image de fond optionnelle
  const mapImage = new Image();
  let mapImageReady = false;
  mapImage.onload = () => { mapImageReady = true; draw(); };
  mapImage.onerror = () => { mapImageReady = false; }; // pas d'image fournie : on garde la grille
  mapImage.src = '/map.png';

  fetch('/map-markers.json')
    .then(r => (r.ok ? r.json() : null))
    .then(data => { if (data) { markers = { ...markers, ...data }; draw(); } })
    .catch(() => {});

  // Coordonnées monde (API REST) -> coordonnées carte du jeu
  function worldToMap(wx, wy) {
    const t = markers.transform || {};
    const scale = t.scale || 459.617;
    return { x: (wx + (t.offsetX ?? 123888)) / scale, y: (wy + (t.offsetY ?? -158000)) / scale };
  }

  // Coordonnées carte -> pixels CSS du canvas (nord en haut : y carte croissant vers le haut)
  function toScreen(mx, my) {
    return {
      x: canvas.clientWidth / 2 + (mx - view.x) * view.scale,
      y: canvas.clientHeight / 2 - (my - view.y) * view.scale
    };
  }

  function fromScreen(sx, sy) {
    return {
      x: view.x + (sx - canvas.clientWidth / 2) / view.scale,
      y: view.y - (sy - canvas.clientHeight / 2) / view.scale
    };
  }

  // ---------- Rendu ----------
  function resize() {
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function drawBackground() {
    ctx.fillStyle = '#0b0e13';
    ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);

    const tl = toScreen(-MAP_EXTENT, MAP_EXTENT);
    const br = toScreen(MAP_EXTENT, -MAP_EXTENT);

    if (mapImageReady) {
      ctx.drawImage(mapImage, tl.x, tl.y, br.x - tl.x, br.y - tl.y);
      return;
    }
    // Grille de secours (pas de 100 unités carte) + cadre
    ctx.strokeStyle = 'rgba(139, 150, 165, 0.12)';
    ctx.lineWidth = 1;
    for (let v = -MAP_EXTENT; v <= MAP_EXTENT; v += 100) {
      const a = toScreen(v, -MAP_EXTENT); const b = toScreen(v, MAP_EXTENT);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      const c = toScreen(-MAP_EXTENT, v); const d = toScreen(MAP_EXTENT, v);
      ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(139, 150, 165, 0.35)';
    ctx.strokeRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
    // Axes centraux + libellés de coordonnées
    ctx.strokeStyle = 'rgba(226, 152, 74, 0.25)';
    const ax = toScreen(0, MAP_EXTENT); const ax2 = toScreen(0, -MAP_EXTENT);
    ctx.beginPath(); ctx.moveTo(ax.x, ax.y); ctx.lineTo(ax2.x, ax2.y); ctx.stroke();
    const ay = toScreen(-MAP_EXTENT, 0); const ay2 = toScreen(MAP_EXTENT, 0);
    ctx.beginPath(); ctx.moveTo(ay.x, ay.y); ctx.lineTo(ay2.x, ay2.y); ctx.stroke();
    ctx.fillStyle = 'rgba(139, 150, 165, 0.5)';
    ctx.font = '11px monospace';
    [-1000, -500, 0, 500, 1000].forEach(v => {
      const p = toScreen(v, 0);
      ctx.fillText(String(v), p.x + 3, p.y - 4);
    });
  }

  function drawMarker(m, color, symbol) {
    const p = toScreen(m.x, m.y);
    if (p.x < -20 || p.y < -20 || p.x > canvas.clientWidth + 20 || p.y > canvas.clientHeight + 20) return;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(231, 235, 240, 0.85)';
    ctx.font = '10px sans-serif';
    if (view.scale > 0.22) ctx.fillText(`${symbol} ${m.name}`, p.x + 8, p.y + 3);
    else ctx.fillText(symbol, p.x + 7, p.y + 3);
  }

  // Regroupe les joueurs dont les positions écran sont à moins de `radius` px (glouton, suffisant
  // pour quelques dizaines de joueurs).
  function clusterPlayers(list, radius = 26) {
    const clusters = [];
    list.forEach(pl => {
      const m = worldToMap(pl.location_x || 0, pl.location_y || 0);
      const s = toScreen(m.x, m.y);
      const near = clusters.find(c => Math.hypot(c.x - s.x, c.y - s.y) < radius);
      if (near) near.players.push(pl);
      else clusters.push({ x: s.x, y: s.y, players: [pl] });
    });
    return clusters;
  }

  function drawPlayers() {
    const withPos = players.filter(p => p.location_x != null && p.location_y != null);
    clusterPlayers(withPos).forEach(c => {
      if (c.players.length === 1) {
        ctx.fillStyle = '#e2984a';
        ctx.strokeStyle = '#14181f';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(c.x, c.y, 7, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#e7ebf0';
        ctx.font = 'bold 11px sans-serif';
        ctx.fillText(c.players[0].name || '?', c.x + 10, c.y + 4);
      } else {
        ctx.fillStyle = '#e2984a';
        ctx.strokeStyle = '#14181f';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(c.x, c.y, 12, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#14181f';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(String(c.players.length), c.x, c.y + 4);
        ctx.textAlign = 'start';
        ctx.fillStyle = '#e7ebf0';
        ctx.font = '10px sans-serif';
        ctx.fillText(c.players.map(p => p.name).join(', ').slice(0, 40), c.x + 15, c.y + 4);
      }
    });
  }

  function draw() {
    resize();
    drawBackground();
    if (document.getElementById('mapShowTravel').checked) {
      (markers.fastTravel || []).forEach(m => drawMarker(m, '#5fb87a', '◈'));
    }
    if (document.getElementById('mapShowTowers').checked) {
      (markers.bossTowers || []).forEach(m => drawMarker(m, '#d9634f', '♜'));
    }
    drawPlayers();
  }

  // ---------- Interactions ----------
  let dragging = null;
  canvas.addEventListener('mousedown', e => {
    dragging = { startX: e.clientX, startY: e.clientY, viewX: view.x, viewY: view.y };
    canvas.style.cursor = 'grabbing';
  });
  window.addEventListener('mousemove', e => {
    if (!dragging) return;
    view.x = dragging.viewX - (e.clientX - dragging.startX) / view.scale;
    view.y = dragging.viewY + (e.clientY - dragging.startY) / view.scale;
    draw();
  });
  window.addEventListener('mouseup', () => { dragging = null; canvas.style.cursor = 'grab'; });

  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const before = fromScreen(e.clientX - rect.left, e.clientY - rect.top);
    const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    view.scale = Math.max(0.08, Math.min(4, view.scale * factor));
    const after = fromScreen(e.clientX - rect.left, e.clientY - rect.top);
    view.x += before.x - after.x;
    view.y += before.y - after.y;
    draw();
  }, { passive: false });

  document.getElementById('mapShowTravel').addEventListener('change', draw);
  document.getElementById('mapShowTowers').addEventListener('change', draw);
  window.addEventListener('resize', draw);

  // app.js pousse la liste des joueurs à chaque rafraîchissement du statut
  window.updateMapPlayers = list => { players = list || []; draw(); };

  draw();
})();
