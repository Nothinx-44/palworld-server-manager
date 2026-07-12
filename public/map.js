// Carte en direct : positions et pseudos des joueurs (API REST location_x/y), zoom/pan,
// regroupement des joueurs proches. Fond : public/map-world.jpg ou public/map-tree.jpg
// (bascule via #mapLayerSelect), sinon grille de secours si le fichier est absent.
(function () {
  const canvas = document.getElementById('mapCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const MAP_EXTENT = 1000; // coordonnées carte du jeu : -1000..1000 sur les deux axes
  // Conversion coordonnées monde (API REST) -> coordonnées carte : les axes X/Y de l'API REST
  // sont ÉCHANGÉS par rapport aux axes de la carte (location_y alimente l'axe X carte, location_x
  // alimente l'axe Y carte) — ce n'était pas un simple signe inversé comme supposé précédemment.
  const TRANSFORM = { offsetX: 123467.1611767, offsetY: -157664.55791065, scale: 462.962962963 };

  // Vue : centre (coordonnées carte) + zoom (pixels CSS par unité carte)
  const view = { x: 0, y: 0, scale: 0.28 };
  let players = [];

  // Île de l'Arbre (Sakurajima) : coordonnées séparées de l'île principale, les joueurs qui n'y
  // sont pas ne s'affichent donc que sur la carte "world".
  const MAP_LAYERS = { world: '/map-world.jpg', tree: '/map-tree.jpg' };
  let currentLayer = 'world';

  // Image de fond optionnelle
  const mapImage = new Image();
  let mapImageReady = false;
  mapImage.onload = () => { mapImageReady = true; draw(); };
  mapImage.onerror = () => { mapImageReady = false; }; // pas d'image fournie : on garde la grille
  mapImage.src = MAP_LAYERS[currentLayer];

  window.setMapLayer = layer => {
    if (!MAP_LAYERS[layer] || layer === currentLayer) return;
    currentLayer = layer;
    mapImageReady = false;
    mapImage.src = MAP_LAYERS[currentLayer];
    draw();
  };

  // Coordonnées monde (API REST) -> coordonnées carte du jeu (wx=location_x, wy=location_y ;
  // axes échangés, voir commentaire sur TRANSFORM ci-dessus).
  function worldToMap(wx, wy) {
    return { x: (wy + TRANSFORM.offsetY) / TRANSFORM.scale, y: (wx + TRANSFORM.offsetX) / TRANSFORM.scale };
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

  window.addEventListener('resize', draw);

  // app.js pousse la liste des joueurs à chaque rafraîchissement du statut
  window.updateMapPlayers = list => { players = list || []; draw(); };

  draw();
})();
