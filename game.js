/* ============================================
   CAR RACER — Pure JS Canvas Game Engine
   ============================================ */

(function () {
    'use strict';

    // ── Constants ──────────────────────────────────
    const CANVAS_W = 420;
    const CANVAS_H = 640;
    const PLAYER_SCALE = 0.15;
    const ENEMY_SCALE = 0.15;
    const ROAD_SPEED_BASE = 6;
    const PLAYER_SPEED = 320;
    const LANE_LEFT = 70;
    const LANE_RIGHT = 350;
    const SPAWN_DELAY_INITIAL = 1400; // ms
    const SPAWN_DELAY_MIN = 450;
    const ENEMY_SPEED_MIN = 220;
    const ENEMY_SPEED_MAX = 400;
    const ROAD_STRIPE_HEIGHT = 50;
    const ROAD_STRIPE_GAP = 40;
    const ROAD_STRIPE_WIDTH = 6;

    // ── State ──────────────────────────────────────
    let canvas, ctx;
    let state = 'start'; // start | playing | gameover
    let score = 0;
    let topScore = parseInt(localStorage.getItem('topScore')) || 0;
    let lastTime = 0;
    let spawnTimer = 0;
    let currentSpawnDelay = SPAWN_DELAY_INITIAL;
    let roadOffset = 0;
    let roadSpeed = ROAD_SPEED_BASE;

    // ── Assets ─────────────────────────────────────
    const images = {};
    const assetList = [
        { key: 'road', src: 'assets/road.jpg' },
        { key: 'player', src: 'assets/white-car.avif' },
        { key: 'enemy-red', src: 'assets/red-car.avif' },
        { key: 'enemy-blue', src: 'assets/blue-car.avif' },
        { key: 'enemy-yellow', src: 'assets/yellow-car.avif' },
    ];
    let assetsLoaded = 0;

    // ── Input ──────────────────────────────────────
    const keys = {};

    // ── Entities ───────────────────────────────────
    let player = null;
    let enemies = [];
    const enemyTypes = ['enemy-red', 'enemy-blue', 'enemy-yellow'];

    // ── DOM refs ───────────────────────────────────
    const startScreen = document.getElementById('start-screen');
    const gameUI = document.getElementById('game-ui');
    const gameContainer = document.getElementById('game-container');
    const gameOverModal = document.getElementById('game-over-modal');
    const scoreEl = document.getElementById('score');
    const topScoreEl = document.getElementById('top-score');
    const speedEl = document.getElementById('speed');
    const finalScoreEl = document.getElementById('final-score');
    const finalBestEl = document.getElementById('final-best');
    const startBtn = document.getElementById('start-btn');
    const restartBtn = document.getElementById('restart-btn');

    // ============================================
    //  ASSET LOADER
    // ============================================
    function loadAssets(callback) {
        if (assetList.length === 0) { callback(); return; }
        assetList.forEach(({ key, src }) => {
            const img = new Image();
            img.onload = () => {
                images[key] = img;
                assetsLoaded++;
                if (assetsLoaded === assetList.length) callback();
            };
            img.onerror = () => {
                console.warn(`Failed to load asset: ${src}`);
                assetsLoaded++;
                if (assetsLoaded === assetList.length) callback();
            };
            img.src = src;
        });
    }

    // ============================================
    //  INIT
    // ============================================
    function init() {
        canvas = document.getElementById('game-canvas');
        ctx = canvas.getContext('2d');
        canvas.width = CANVAS_W;
        canvas.height = CANVAS_H;

        // Show top score on start
        topScoreEl.textContent = topScore;

        // Input listeners
        window.addEventListener('keydown', (e) => {
            keys[e.code] = true;
            // Enter to start / restart
            if (e.code === 'Enter' || e.code === 'NumpadEnter') {
                if (state === 'start') startGame();
                else if (state === 'gameover') restartGame();
            }
        });
        window.addEventListener('keyup', (e) => { keys[e.code] = false; });

        startBtn.addEventListener('click', startGame);
        restartBtn.addEventListener('click', restartGame);

        // Pre-render the start screen's canvas preview
        drawStartPreview();
    }

    function drawStartPreview() {
        // Draw a dark road preview behind the start screen (optional, canvas is hidden)
    }

    // ============================================
    //  GAME START / RESTART
    // ============================================
    function startGame() {
        state = 'playing';
        score = 0;
        enemies = [];
        spawnTimer = 0;
        currentSpawnDelay = SPAWN_DELAY_INITIAL;
        roadOffset = 0;
        roadSpeed = ROAD_SPEED_BASE;

        // Player setup
        const pImg = images['player'];
        const pw = pImg ? pImg.width * PLAYER_SCALE : 40;
        const ph = pImg ? pImg.height * PLAYER_SCALE : 70;
        player = {
            x: CANVAS_W / 2 - pw / 2,
            y: CANVAS_H - ph - 30,
            w: pw,
            h: ph,
            vx: 0,
            vy: 0,
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

        const dt = Math.min((timestamp - lastTime) / 1000, 0.05); // cap at 50ms
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
        roadSpeed = ROAD_SPEED_BASE + score * 0.12;
        roadOffset = (roadOffset + roadSpeed) % (ROAD_STRIPE_HEIGHT + ROAD_STRIPE_GAP);

        // ── Player movement ──
        let vx = 0, vy = 0;
        if (keys['KeyA'] || keys['ArrowLeft']) vx = -PLAYER_SPEED;
        else if (keys['KeyD'] || keys['ArrowRight']) vx = PLAYER_SPEED;
        if (keys['KeyW'] || keys['ArrowUp']) vy = -PLAYER_SPEED;
        else if (keys['KeyS'] || keys['ArrowDown']) vy = PLAYER_SPEED;

        player.x += vx * dt;
        player.y += vy * dt;

        // Clamp to road bounds (leave a small shoulder)
        const marginX = 12;
        const marginYTop = 8;
        const marginYBot = 8;
        player.x = Math.max(marginX, Math.min(CANVAS_W - player.w - marginX, player.x));
        player.y = Math.max(marginYTop, Math.min(CANVAS_H - player.h - marginYBot, player.y));

        // ── Spawn enemies ──
        spawnTimer += dt * 1000;
        if (spawnTimer >= currentSpawnDelay) {
            spawnTimer = 0;
            spawnEnemy();
            // Increase difficulty
            currentSpawnDelay = Math.max(SPAWN_DELAY_MIN, SPAWN_DELAY_INITIAL - score * 18);
        }

        // ── Update enemies ──
        for (let i = enemies.length - 1; i >= 0; i--) {
            const e = enemies[i];
            e.y += e.speed * dt;

            // Passed the player — score!
            if (!e.scored && e.y > player.y + player.h) {
                e.scored = true;
                score++;
                updateScoreUI();
            }

            // Off-screen — remove
            if (e.y > CANVAS_H + 100) {
                enemies.splice(i, 1);
                continue;
            }

            // ── Collision (AABB with shrink for fairness) ──
            const shrink = 8;
            if (
                player.x + shrink < e.x + e.w - shrink &&
                player.x + player.w - shrink > e.x + shrink &&
                player.y + shrink < e.y + e.h - shrink &&
                player.y + player.h - shrink > e.y + shrink
            ) {
                gameOver();
                return;
            }
        }

        // Update speed display (visual flair)
        const displaySpeed = Math.round(80 + roadSpeed * 12 + Math.random() * 3);
        speedEl.textContent = displaySpeed;
    }

    // ── Enemy spawning ──
    function spawnEnemy() {
        const typeKey = enemyTypes[Math.floor(Math.random() * enemyTypes.length)];
        const eImg = images[typeKey];
        const ew = eImg ? eImg.width * ENEMY_SCALE : 40;
        const eh = eImg ? eImg.height * ENEMY_SCALE : 70;

        // Random X within lane bounds
        const x = LANE_LEFT + Math.random() * (LANE_RIGHT - LANE_LEFT - ew);
        const speed = ENEMY_SPEED_MIN + Math.random() * (ENEMY_SPEED_MAX - ENEMY_SPEED_MIN) + score * 2;

        enemies.push({
            x,
            y: -eh - 20,
            w: ew,
            h: eh,
            speed,
            type: typeKey,
            scored: false,
        });
    }

    // ============================================
    //  RENDER
    // ============================================
    function render() {
        ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

        drawRoad();
        drawEnemies();
        drawPlayer();
    }

    // ── Road ──
    function drawRoad() {
        const roadImg = images['road'];
        if (roadImg) {
            // Tile the road image vertically with scrolling
            const imgH = roadImg.height;
            const scale = CANVAS_W / roadImg.width;
            const scaledH = imgH * scale;
            const offset = roadOffset * (scaledH / (ROAD_STRIPE_HEIGHT + ROAD_STRIPE_GAP));

            for (let y = -scaledH + (offset % scaledH); y < CANVAS_H; y += scaledH) {
                ctx.drawImage(roadImg, 0, y, CANVAS_W, scaledH);
            }
        } else {
            // Fallback: procedural road
            drawProceduralRoad();
        }
    }

    function drawProceduralRoad() {
        // Asphalt
        ctx.fillStyle = '#2a2a2a';
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

        // Shoulders
        ctx.fillStyle = '#1a6e1a';
        ctx.fillRect(0, 0, 30, CANVAS_H);
        ctx.fillRect(CANVAS_W - 30, 0, 30, CANVAS_H);

        // Shoulder lines
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(32, 0); ctx.lineTo(32, CANVAS_H);
        ctx.moveTo(CANVAS_W - 32, 0); ctx.lineTo(CANVAS_W - 32, CANVAS_H);
        ctx.stroke();

        // Center dashed line
        ctx.strokeStyle = '#ffcc00';
        ctx.lineWidth = ROAD_STRIPE_WIDTH;
        ctx.setLineDash([ROAD_STRIPE_HEIGHT, ROAD_STRIPE_GAP]);
        ctx.lineDashOffset = -roadOffset * 6;
        ctx.beginPath();
        ctx.moveTo(CANVAS_W / 2, 0);
        ctx.lineTo(CANVAS_W / 2, CANVAS_H);
        ctx.stroke();
        ctx.setLineDash([]);

        // Lane dividers
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 2;
        ctx.setLineDash([30, 50]);
        ctx.lineDashOffset = -roadOffset * 6;
        [CANVAS_W * 0.3, CANVAS_W * 0.7].forEach(lx => {
            ctx.beginPath();
            ctx.moveTo(lx, 0);
            ctx.lineTo(lx, CANVAS_H);
            ctx.stroke();
        });
        ctx.setLineDash([]);
    }

    // ── Player ──
    function drawPlayer() {
        const pImg = images['player'];
        if (pImg) {
            ctx.drawImage(pImg, player.x, player.y, player.w, player.h);
        } else {
            // Fallback: draw rectangle car
            drawCarRect(player.x, player.y, player.w, player.h, '#ffffff');
        }
    }

    // ── Enemies ──
    function drawEnemies() {
        enemies.forEach(e => {
            const eImg = images[e.type];
            if (eImg) {
                ctx.drawImage(eImg, e.x, e.y, e.w, e.h);
            } else {
                const colors = { 'enemy-red': '#ff3333', 'enemy-blue': '#3399ff', 'enemy-yellow': '#ffcc00' };
                drawCarRect(e.x, e.y, e.w, e.h, colors[e.type] || '#ff3333');
            }
        });
    }

    // ── Fallback car drawing ──
    function drawCarRect(x, y, w, h, color) {
        ctx.fillStyle = color;
        // Body
        const r = 6;
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
        ctx.fill();

        // Windshield
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fillRect(x + 4, y + h * 0.2, w - 8, h * 0.2);

        // Headlights
        ctx.fillStyle = '#ffee88';
        ctx.fillRect(x + 3, y + 2, 6, 4);
        ctx.fillRect(x + w - 9, y + 2, 6, 4);

        // Tail lights
        ctx.fillStyle = '#ff2222';
        ctx.fillRect(x + 2, y + h - 6, 5, 4);
        ctx.fillRect(x + w - 7, y + h - 6, 5, 4);
    }

    // ============================================
    //  GAME OVER
    // ============================================
    function gameOver() {
        state = 'gameover';

        // Update top score
        if (score > topScore) {
            topScore = score;
            localStorage.setItem('topScore', topScore);
        }

        // Render one final flash frame
        ctx.fillStyle = 'rgba(255, 60, 60, 0.3)';
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

        // Update UI
        finalScoreEl.textContent = score;
        finalBestEl.textContent = topScore;
        topScoreEl.textContent = topScore;

        // Show modal
        gameOverModal.classList.remove('hidden');
    }

    // ============================================
    //  UI HELPERS
    // ============================================
    function updateScoreUI() {
        scoreEl.textContent = score;
        topScoreEl.textContent = topScore;

        // Trigger pop animation
        scoreEl.classList.remove('pop');
        void scoreEl.offsetWidth; // reflow to restart animation
        scoreEl.classList.add('pop');
    }

    // ============================================
    //  BOOT
    // ============================================
    loadAssets(() => {
        init();
    });

})();
