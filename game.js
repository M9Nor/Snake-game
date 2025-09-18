(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

  const CELL = 24;
  let GRID = Math.floor(canvas.width / CELL);

  let snake, dir, nextDir, food, score, high, loopId, speedMs, isRunning, isGameOver;
  let elapsedMs, lastRunStart, timerId;
  let pyodide = null, pyEnabled = false;

  const scoreEl = document.getElementById('score');
  const highEl = document.getElementById('high');
  const timeEl = document.getElementById('time');
  const lenEl = document.getElementById('length');

  function randInt(max) { return Math.floor(Math.random() * max); }
  function pointEq(a, b) { return a.x === b.x && a.y === b.y; }

  function spawnFood() {
    while (true) {
      const p = { x: randInt(GRID), y: randInt(GRID) };
      if (!snake.some(s => pointEq(s, p))) return p;
    }
  }

  function reset() {
    snake = [ {x: 8, y: 10}, {x: 7, y: 10}, {x: 6, y: 10} ];
    dir = { x: 1, y: 0 };
    nextDir = { ...dir };
    food = spawnFood();
    score = 0;
    isRunning = false;
    isGameOver = false;
    speedMs = 140;
    elapsedMs = 0; lastRunStart = null; stopTimer(); updateTimeHUD();
    updateHUD();
    draw();
  }

  function updateHUD() {
    scoreEl.textContent = score;
    highEl.textContent = high;
    lenEl.textContent = snake.length;
  }

  function drawCell(x, y, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x * CELL + 1, y * CELL + 1, CELL - 2, CELL - 2);
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawCell(food.x, food.y, getFoodColor());
    snake.forEach((s, i) => {
      drawCell(s.x, s.y, i === 0 ? getHeadColor() : getBodyColor());
    });
    lenEl.textContent = snake.length;
  }

  function tick() {
    if (!isRunning || isGameOver) return;

    // Python autopilot
    if (pyEnabled && pyodide) {
      try {
        const head = snake[0];
        const hint = pyodide.runPython(`next_dir(${head.x}, ${head.y}, ${food.x}, ${food.y}, ${dir.x}, ${dir.y})`);
        if (hint && Array.isArray(hint) && hint.length === 2) {
          const nd = { x: Math.sign(hint[0]|0), y: Math.sign(hint[1]|0) };
          if (!isOpposite(nd, dir) && (nd.x !== 0 || nd.y !== 0)) nextDir = nd;
        }
      } catch (e) { /* ignore */ }
    }

    if (!isOpposite(nextDir, dir)) dir = nextDir;

    const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };

    if (head.x < 0 || head.y < 0 || head.x >= GRID || head.y >= GRID || snake.some(s => s.x === head.x && s.y === head.y)) {
      gameOver();
      return;
    }

    snake.unshift(head);
    if (pointEq(head, food)) {
      score += 1;
      if (score % 5 === 0) speedUp(6);
      if (score > high) { high = score; localStorage.setItem('snake_high', String(high)); }
      food = spawnFood();
      updateHUD();
    } else {
      snake.pop();
    }
    draw();
  }

  function gameOver() {
    isGameOver = true;
    isRunning = false;
    stopLoop();
    draw();
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 28px ui-sans-serif, system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('Game Over', canvas.width/2, canvas.height/2 - 10);
    ctx.font = '600 16px ui-sans-serif, system-ui';
    ctx.fillText('Press Reset to try again', canvas.width/2, canvas.height/2 + 16);
  }

  function startLoop() { stopLoop(); loopId = setInterval(tick, speedMs); isRunning = true; startTimer(); }
  function stopLoop() { if (loopId) clearInterval(loopId); loopId = null; }
  function speedUp(delta = 8) { speedMs = Math.max(60, speedMs - delta); if (isRunning) startLoop(); }
  function slowDown(delta = 8) { speedMs = Math.min(260, speedMs + delta); if (isRunning) startLoop(); }
  function isOpposite(a, b) { return a.x === -b.x && a.y === -b.y; }

  function getBodyColor() { return getComputedStyle(document.documentElement).getPropertyValue('--snake').trim(); }
  function getHeadColor() { return getComputedStyle(document.documentElement).getPropertyValue('--snake-head').trim(); }
  function getFoodColor() { return getComputedStyle(document.documentElement).getPropertyValue('--food').trim(); }

  // Keyboard
  window.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (k === ' ') { togglePause(); return; }
    const nd = keyToDir(k);
    if (nd) setDir(nd);
  });
  function keyToDir(k){
    if (k === 'arrowup' || k === 'w') return {x:0,y:-1};
    if (k === 'arrowdown' || k === 's') return {x:0,y:1};
    if (k === 'arrowleft' || k === 'a') return {x:-1,y:0};
    if (k === 'arrowright' || k === 'd') return {x:1,y:0};
    return null;
  }
  function setDir(nd){
    if (!isOpposite(nd, dir)) {
      nextDir = nd;
      if (navigator.vibrate) navigator.vibrate(10);
    }
  }

  // Touch swipe
  let touchStart = null;
  canvas.addEventListener('touchstart', (e) => {
    const t = e.changedTouches[0];
    touchStart = { x: t.clientX, y: t.clientY, time: Date.now() };
  }, { passive: true });
  canvas.addEventListener('touchend', (e) => {
    if (!touchStart) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStart.x;
    const dy = t.clientY - touchStart.y;
    const adx = Math.abs(dx), ady = Math.abs(dy);
    if (Math.max(adx, ady) < 24) return;
    if (adx > ady) setDir({ x: Math.sign(dx), y: 0 }); else setDir({ x: 0, y: Math.sign(dy) });
    touchStart = null;
  }, { passive: true });

  // Tap board = pause/resume
  canvas.addEventListener('click', () => togglePause());

  // On-screen buttons
  const btnUp = document.getElementById('btn-up');
  const btnDown = document.getElementById('btn-down');
  const btnLeft = document.getElementById('btn-left');
  const btnRight = document.getElementById('btn-right');
  const btnCenter = document.getElementById('btn-center');
  [ [btnUp,{x:0,y:-1}], [btnDown,{x:0,y:1}], [btnLeft,{x:-1,y:0}], [btnRight,{x:1,y:0}] ].forEach(([el, d]) => {
    if (!el) return;
    const handler = (ev) => { ev.preventDefault(); setDir(d); };
    el.addEventListener('touchstart', handler, { passive: false });
    el.addEventListener('click', handler);
  });
  if (btnCenter) {
    const handler = (ev) => { ev.preventDefault(); togglePause(); };
    btnCenter.addEventListener('touchstart', handler, { passive: false });
    btnCenter.addEventListener('click', handler);
  }

  // Top buttons
  document.getElementById('start').onclick = () => { if (!isGameOver) startLoop(); };
  document.getElementById('pause').onclick = togglePause;
  document.getElementById('reset').onclick = () => { reset(); };
  document.getElementById('faster').onclick = () => speedUp(12);
  document.getElementById('slower').onclick = () => slowDown(12);

  function togglePause() { if (isGameOver) return; if (isRunning) { stopLoop(); isRunning = false; stopTimer(); } else { startLoop(); } }

  // Responsive canvas
  function fitCanvas(){
    const parent = canvas.parentElement;
    const size = Math.min(parent.clientWidth - 32, 560);
    const cells = Math.floor(size / CELL);
    const px = cells * CELL;
    canvas.width = px; canvas.height = px;
    GRID = Math.floor(canvas.width / CELL);
  }
  window.addEventListener('resize', fitCanvas);

  // Timer helpers
  function startTimer(){ if (!lastRunStart) { lastRunStart = Date.now(); if (!timerId) timerId = setInterval(updateTimeHUD, 250); } }
  function stopTimer(){ if (lastRunStart) { elapsedMs += Date.now() - lastRunStart; lastRunStart = null; } if (timerId) { clearInterval(timerId); timerId = null; } updateTimeHUD(); }
  function updateTimeHUD(){ const total = elapsedMs + (lastRunStart ? (Date.now() - lastRunStart) : 0); const m = Math.floor(total/60000); const s = Math.floor((total%60000)/1000); document.getElementById('time').textContent = String(m).padStart(2,'0')+':'+String(s).padStart(2,'0'); }

  // Python loading & toggle (Pyodide from CDN)
  const pyLoadBtn = document.getElementById('py-load');
  const pyToggle = document.getElementById('py-toggle');
  if (pyLoadBtn) {
    pyLoadBtn.addEventListener('click', async () => {
      try {
        pyLoadBtn.disabled = true; pyLoadBtn.textContent = 'Loading...';
        if (!window.loadPyodide) {
          const s = document.createElement('script');
          s.src = 'https://cdn.jsdelivr.net/pyodide/v0.24.1/full/pyodide.js';
          document.head.appendChild(s);
          await new Promise(res => { s.onload = res; });
        }
        pyodide = await window.loadPyodide({ indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.24.1/full/' });
        // load external python file (ai.py) from same folder
        const code = await fetch('ai.py').then(r => r.text());
        await pyodide.runPythonAsync(code);
        pyLoadBtn.textContent = 'Python Ready';
        pyToggle.checked = true; pyEnabled = true;
      } catch (e) {
        pyLoadBtn.textContent = 'Load Failed – Retry'; pyLoadBtn.disabled = false; console.error(e);
      }
    });
  }
  if (pyToggle) { pyToggle.addEventListener('change', (e) => { pyEnabled = !!e.target.checked && !!pyodide; }); }

  // Boot
  high = Number(localStorage.getItem('snake_high') || '0');
  reset();
  fitCanvas();
})();
