/* ============================================
   CAR RACER — Pure JS Canvas Game Engine
   ============================================ */

(function () {
    'use strict';

    // ── Constants ──────────────────────────────────
    const CANVAS_W = 420;
    const CANVAS_H = 640;
    const PLAYER_SPEED = 320;
    const ROAD_SCROLL_BASE = 360;
    const LANE_LEFT = 50;
    const LANE_RIGHT = 370;
    const SPAWN_DELAY_INITIAL = 1400;
    const SPAWN_DELAY_MIN = 450;
    const ENEMY_SPEED_MIN = 220;
    const ENEMY_SPEED_MAX = 400;

    // Target car width on canvas (scales images proportionally)
    // Original Phaser used 0.15 scale on ~370-740px images → ~55-111px
    // We target 55px width for a good fit on the 420px canvas
    const TARGET_CAR_W = 55;
    const FALLBACK_CAR_W = 55;
    const FALLBACK_CAR_H = 93;

    // ── State ──────────────────────────────────────
    let canvas, ctx;
    let state = 'start'; // start | playing | gameover
    let score = 0;
    let topScore = parseInt(localStorage.getItem('topScore')) || 0;
    let lastTime = 0;
    let spawnTimer = 0;
    let currentSpawnDelay = SPAWN_DELAY_INITIAL;
    let roadScrollY = 0;

    // ── Assets ─────────────────────────────────────
    const images = {};
    const assetList = [
        { key: 'road', src: 'assets/road.jpg' },
        { key: 'player', src: 'assets/white-car.avif' },
        { key: 'enemy-red', src: 'assets/red-car.avif' },
        { key: 'enemy-blue', src: 'assets/blue-car.avif' },
        { key: 'enemy-yellow', src: 'assets/yellow-car.avif' },
    ];

    // ── Input ──────────────────────────────────────
    const keys = {};
    let touchTargetX = null;
    let touchTargetY = null;

    // ── Entities ───────────────────────────────────
    let player = null;
    let enemies = [];
    const enemyTypes = ['enemy-red', 'enemy-blue', 'enemy-yellow'];

    // ── Particles ──────────────────────────────────
    let particles = [];

    // ── DOM refs ───────────────────────────────────
    const $ = (id) => document.getElementById(id);
    const startScreen = $('start-screen');
    const gameUI = $('game-ui');
    const gameContainer = $('game-container');
    const gameOverModal = $('game-over-modal');
    const scoreEl = $('score');
    const topScoreEl = $('top-score');
    const speedEl = $('speed');
    const finalScoreEl = $('final-score');
    const finalBestEl = $('final-best');
    const startBtn = $('start-btn');
    const restartBtn = $('restart-btn');

    // ============================================
    //  HELPERS
    // ============================================

    /**
     * Get car draw dimensions — scales image proportionally so width = TARGET_CAR_W.
     * Actual image sizes:
     *   white-car  369×626 → 55×93
     *   red-car    740×740 → 55×55
     *   blue-car   740×740 → 55×55
     *   yellow-car 626×626 → 55×55
     */
    function getCarSize(imageKey) {
        const img = images[imageKey];
        if (img) {
            const aspect = img.naturalHeight / img.naturalWidth;
            const w = TARGET_CAR_W;
            const h = Math.round(TARGET_CAR_W * aspect);
            return { w, h };
        }
        return { w: FALLBACK_CAR_W, h: FALLBACK_CAR_H };
    }

    /** Convert a touch/mouse clientX,Y to canvas-internal coordinates */
    function clientToCanvas(clientX, clientY) {
        const rect = canvas.getBoundingClientRect();
        const scaleX = CANVAS_W / rect.width;
        const scaleY = CANVAS_H / rect.height;
        return {
            x: (clientX - rect.left) * scaleX,
            y: (clientY - rect.top) * scaleY,
        };
    }

    // ============================================
    //  ASSET LOADER
    // ============================================
    function loadAssets(callback) {
        if (assetList.length === 0) { callback(); return; }
        let loaded = 0;
        assetList.forEach(({ key, src }) => {
            const img = new Image();
            img.onload = () => {
                images[key] = img;
                loaded++;
                if (loaded === assetList.length) callback();
            };
            img.onerror = () => {
                console.warn('Failed to load asset:', src);
                loaded++;
                if (loaded === assetList.length) callback();
            };
            img.src = src;
        });
    }

    // ============================================
    //  INIT
    // ============================================
    function init() {
        canvas = $('game-canvas');
        ctx = canvas.getContext('2d');
        canvas.width = CANVAS_W;
        canvas.height = CANVAS_H;

        topScoreEl.textContent = topScore;

        // ── Keyboard ──
        window.addEventListener('keydown', (e) => {
            keys[e.code] = true;
            if (e.code === 'Enter' || e.code === 'NumpadEnter') {
                if (state === 'start') startGame();
                else if (state === 'gameover') restartGame();
            }
        });
        window.addEventListener('keyup', (e) => { keys[e.code] = false; });

        // ── Touch input (mobile) ──
        canvas.addEventListener('touchstart', onTouch, { passive: false });
        canvas.addEventListener('touchmove', onTouch, { passive: false });
        canvas.addEventListener('touchend', onTouchEnd, { passive: false });
        canvas.addEventListener('touchcancel', onTouchEnd, { passive: false });

        // ── Buttons ──
        startBtn.addEventListener('click', startGame);
        restartBtn.addEventListener('click', restartGame);

        // ── Responsive canvas sizing ──
        handleResize();
        window.addEventListener('resize', handleResize);

        // Debug
        console.log('Assets loaded:', Object.keys(images));
        Object.entries(images).forEach(([key, img]) => {
            console.log(`  ${key}: ${img.naturalWidth}x${img.naturalHeight}`);
        });
    }

    // ── Touch handlers ──
    function onTouch(e) {
        e.preventDefault();
        if (state === 'start') { startGame(); return; }
        if (state === 'gameover') { restartGame(); return; }
        const touch = e.touches[0];
        if (!touch) return;
        const pos = clientToCanvas(touch.clientX, touch.clientY);
        touchTargetX = pos.x;
        touchTargetY = pos.y;
    }

    function onTouchEnd(e) {
        e.preventDefault();
        touchTargetX = null;
        touchTargetY = null;
    }

    // ── Responsive resize ──
    function handleResize() {
        const container = gameContainer;
        // The CSS handles the scaling via object-fit, but we also
        // need to make sure the container fills the viewport correctly.
        // Canvas internal resolution stays fixed (CANVAS_W x CANVAS_H).
    }

    // ============================================
    //  GAME START / RESTART
    // ============================================
    function startGame() {
        state = 'playing';
        score = 0;
        enemies = [];
        particles = [];
        spawnTimer = 0;
        currentSpawnDelay = SPAWN_DELAY_INITIAL;
        roadScrollY = 0;

        // Clear all key states
        Object.keys(keys).forEach(k => keys[k] = false);
        touchTargetX = null;
        touchTargetY = null;

        // Player setup — use natural image size, NO shrinking
        const size = getCarSize('player');
        player = {
            x: CANVAS_W / 2 - size.w / 2,
            y: CANVAS_H * 0.90 - size.h,  // 10% above bottom
            w: size.w,
            h: size.h,
        };

        // UI transitions
        startScreen.classList.add('hidden');
        gameOverModal.classList.add('hidden');
        gameContainer.classList.remove('hidden');
        gameUI.classList.remove('hidden');

        updateScoreUI();
        lastTime = performance.now();
        requestAnimationFrame(gameLoop);
    }

    function restartGame() {
        startGame();
    }

    // ============================================
    //  GAME LOOP
    // ============================================
    function gameLoop(timestamp) {
        if (state !== 'playing') return;

        const dt = Math.min((timestamp - lastTime) / 1000, 0.05);
        lastTime = timestamp;

        update(dt);
        render();

        requestAnimationFrame(gameLoop);
    }

    // ============================================
    //  UPDATE
    // ============================================
    function update(dt) {
        // ── Road scroll ──
        const roadSpeed = ROAD_SCROLL_BASE + score * 6;
        roadScrollY += roadSpeed * dt;

        // ── Player movement (keyboard) ──
        let vx = 0, vy = 0;
        if (keys['KeyA'] || keys['ArrowLeft']) vx = -PLAYER_SPEED;
        else if (keys['KeyD'] || keys['ArrowRight']) vx = PLAYER_SPEED;
        if (keys['KeyW'] || keys['ArrowUp']) vy = -PLAYER_SPEED;
        else if (keys['KeyS'] || keys['ArrowDown']) vy = PLAYER_SPEED;

        // ── Player movement (touch — car moves toward finger) ──
        if (touchTargetX !== null && touchTargetY !== null) {
            const dx = touchTargetX - (player.x + player.w / 2);
            const dy = touchTargetY - (player.y + player.h / 2);
            const dist = Math.sqrt(dx * dx + dy * dy);
            const deadzone = 8;
            if (dist > deadzone) {
                vx = (dx / dist) * PLAYER_SPEED;
                vy = (dy / dist) * PLAYER_SPEED;
                // Snap to target if very close
                if (dist < PLAYER_SPEED * dt) {
                    player.x = touchTargetX - player.w / 2;
                    player.y = touchTargetY - player.h / 2;
                    vx = 0;
                    vy = 0;
                }
            }
        }

        player.x += vx * dt;
        player.y += vy * dt;

        // ── Clamp player strictly inside canvas (cannot leave screen) ──
        player.x = Math.max(0, Math.min(CANVAS_W - player.w, player.x));
        player.y = Math.max(0, Math.min(CANVAS_H - player.h, player.y));

        // ── Spawn enemies ──
        spawnTimer += dt * 1000;
        if (spawnTimer >= currentSpawnDelay) {
            spawnTimer -= currentSpawnDelay;
            spawnEnemy();
            currentSpawnDelay = Math.max(SPAWN_DELAY_MIN, SPAWN_DELAY_INITIAL - score * 18);
        }

        // ── Update enemies ──
        for (let i = enemies.length - 1; i >= 0; i--) {
            const e = enemies[i];
            e.y += e.speed * dt;

            // Scored — enemy passed the player
            if (!e.scored && e.y > player.y + player.h) {
                e.scored = true;
                score++;
                updateScoreUI();
            }

            // NPC cars CAN go off-screen (they spawn above and exit below)
            if (e.y > CANVAS_H + 150) {
                enemies.splice(i, 1);
                continue;
            }

            // ── Collision (AABB with fairness shrink) ──
            const sx = 10;
            const sy = 8;
            if (
                player.x + sx < e.x + e.w - sx &&
                player.x + player.w - sx > e.x + sx &&
                player.y + sy < e.y + e.h - sy &&
                player.y + player.h - sy > e.y + sy
            ) {
                triggerCrash(player.x + player.w / 2, player.y + player.h / 2);
                gameOver();
                return;
            }
        }

        // ── Update particles ──
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.life -= dt;
            if (p.life <= 0) particles.splice(i, 1);
        }

        // ── Speed display ──
        const displaySpeed = Math.round(60 + (roadSpeed / 360) * 80 + Math.random() * 2);
        speedEl.textContent = displaySpeed;
    }

    function spawnEnemy() {
        const typeKey = enemyTypes[Math.floor(Math.random() * enemyTypes.length)];
        // Use natural image size — no shrinking
        const size = getCarSize(typeKey);

        const x = LANE_LEFT + Math.random() * (LANE_RIGHT - LANE_LEFT - size.w);
        const speed = ENEMY_SPEED_MIN + Math.random() * (ENEMY_SPEED_MAX - ENEMY_SPEED_MIN) + score * 2.5;

        enemies.push({
            x,
            y: -size.h - 30,    // spawn above screen (NPCs can be off-screen)
            w: size.w,
            h: size.h,
            speed,
            type: typeKey,
            scored: false,
        });
    }

    function triggerCrash(cx, cy) {
        for (let i = 0; i < 20; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 80 + Math.random() * 200;
            particles.push({
                x: cx,
                y: cy,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 0.4 + Math.random() * 0.5,
                maxLife: 0.9,
                color: ['#ff4444', '#ff8800', '#ffcc00', '#ffffff'][Math.floor(Math.random() * 4)],
                size: 3 + Math.random() * 5,
            });
        }
    }

    // ============================================
    //  RENDER
    // ============================================
    function render() {
        ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

        drawRoad();
        drawEnemies();
        drawPlayer();
        drawParticles();
    }

    // ── Road ──
    function drawRoad() {
        const roadImg = images['road'];

        if (roadImg) {
            const scale = CANVAS_W / roadImg.width;
            const scaledH = roadImg.height * scale;
            const offset = roadScrollY % scaledH;

            for (let y = offset - scaledH; y < CANVAS_H; y += scaledH) {
                ctx.drawImage(roadImg, 0, y, CANVAS_W, scaledH);
            }
        } else {
            drawProceduralRoad();
        }
    }

    function drawProceduralRoad() {
        ctx.fillStyle = '#333333';
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

        ctx.fillStyle = '#1a5e1a';
        ctx.fillRect(0, 0, 28, CANVAS_H);
        ctx.fillRect(CANVAS_W - 28, 0, 28, CANVAS_H);

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(30, 0); ctx.lineTo(30, CANVAS_H);
        ctx.moveTo(CANVAS_W - 30, 0); ctx.lineTo(CANVAS_W - 30, CANVAS_H);
        ctx.stroke();

        const stripeH = 50;
        const gapH = 40;
        const offset = roadScrollY % (stripeH + gapH);

        ctx.fillStyle = '#ffcc00';
        for (let y = offset - stripeH - gapH; y < CANVAS_H; y += stripeH + gapH) {
            ctx.fillRect(CANVAS_W / 2 - 3, y, 6, stripeH);
        }

        ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
        [CANVAS_W * 0.30, CANVAS_W * 0.70].forEach(lx => {
            for (let y = offset - 30 - 50; y < CANVAS_H; y += 80) {
                ctx.fillRect(lx - 1.5, y, 3, 30);
            }
        });
    }

    // ── Player ──
    function drawPlayer() {
        const pImg = images['player'];
        if (pImg) {
            ctx.drawImage(pImg, player.x, player.y, player.w, player.h);
        } else {
            drawCarShape(player.x, player.y, player.w, player.h, '#e0e0e0', '#aaaaaa');
        }
    }

    // ── Enemies ──
    function drawEnemies() {
        enemies.forEach(e => {
            const eImg = images[e.type];
            if (eImg) {
                ctx.drawImage(eImg, e.x, e.y, e.w, e.h);
            } else {
                const colorMap = {
                    'enemy-red': ['#ff3333', '#cc0000'],
                    'enemy-blue': ['#3399ff', '#0055cc'],
                    'enemy-yellow': ['#ffcc00', '#cc9900'],
                };
                const [fill, accent] = colorMap[e.type] || ['#ff3333', '#cc0000'];
                drawCarShape(e.x, e.y, e.w, e.h, fill, accent);
            }
        });
    }

    // ── Car shape fallback ──
    function drawCarShape(x, y, w, h, bodyColor, accentColor) {
        const r = 8;

        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        roundRect(ctx, x + 3, y + 5, w, h, r);
        ctx.fill();

        ctx.fillStyle = bodyColor;
        roundRect(ctx, x, y, w, h, r);
        ctx.fill();

        ctx.fillStyle = accentColor;
        roundRect(ctx, x + 6, y + h * 0.25, w - 12, h * 0.35, 4);
        ctx.fill();

        ctx.fillStyle = 'rgba(150, 220, 255, 0.6)';
        ctx.fillRect(x + 7, y + h * 0.22, w - 14, h * 0.12);

        ctx.fillStyle = 'rgba(150, 220, 255, 0.4)';
        ctx.fillRect(x + 8, y + h * 0.52, w - 16, h * 0.08);

        ctx.fillStyle = '#ffffaa';
        ctx.shadowColor = '#ffffaa';
        ctx.shadowBlur = 6;
        roundRect(ctx, x + 4, y + 2, 8, 5, 2);
        ctx.fill();
        roundRect(ctx, x + w - 12, y + 2, 8, 5, 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        ctx.fillStyle = '#ff0000';
        ctx.shadowColor = '#ff0000';
        ctx.shadowBlur = 4;
        roundRect(ctx, x + 3, y + h - 7, 7, 5, 2);
        ctx.fill();
        roundRect(ctx, x + w - 10, y + h - 7, 7, 5, 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        ctx.fillStyle = bodyColor;
        ctx.fillRect(x - 3, y + h * 0.3, 4, 6);
        ctx.fillRect(x + w - 1, y + h * 0.3, 4, 6);
    }

    function roundRect(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
    }

    // ── Particles ──
    function drawParticles() {
        particles.forEach(p => {
            const alpha = Math.max(0, p.life / p.maxLife);
            ctx.globalAlpha = alpha;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.globalAlpha = 1;
    }

    // ============================================
    //  GAME OVER
    // ============================================
    function gameOver() {
        state = 'gameover';

        if (score > topScore) {
            topScore = score;
            localStorage.setItem('topScore', topScore);
        }

        ctx.fillStyle = 'rgba(255, 40, 40, 0.35)';
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

        finalScoreEl.textContent = score;
        finalBestEl.textContent = topScore;
        topScoreEl.textContent = topScore;

        setTimeout(() => {
            gameOverModal.classList.remove('hidden');
        }, 200);
    }

    // ============================================
    //  UI HELPERS
    // ============================================
    function updateScoreUI() {
        scoreEl.textContent = score;
        topScoreEl.textContent = topScore;

        scoreEl.classList.remove('pop');
        void scoreEl.offsetWidth;
        scoreEl.classList.add('pop');
    }

    // ============================================
    //  BOOT
    // ============================================
    loadAssets(() => {
        init();
        console.log('🏎️ Car Racer ready!');
    });

})();
