// app.js - AXP Vision Snake V6.2: Hyper-Responsive Touch Engine

// ==========================================
// 🛡️ 網域防護與 Supabase 初始化
// ==========================================
const allowedDomains = ["localhost", "127.0.0.1", "axp-vision.github.io", "rabbit-turtle-m792.squarespace.com", "www.fantastic-vision.com", "fantastic-vision.com", ""];
if (!allowedDomains.includes(window.location.hostname) && window.location.hostname !== "") {
    document.body.innerHTML = `<h2 style="color:#e74c3c; text-align:center; margin-top:20vh; font-family:Arial;">⚠️ 未經授權的使用</h2>`;
    throw new Error("Security Check Failed."); 
}

const SUPABASE_URL = 'https://wvholwcyrldixlsgoege.supabase.co'; 
// 👇 🚨 請在這裡貼上你的 anon_key
const SUPABASE_ANON_KEY = 'sb_publishable_BozJ84tPQF-jBHGKtXKqgw_ELodM54e'; 
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ==========================================
// ⚙️ 系統常數與全域變數
// ==========================================
let canvas, ctx, container;
const GAME_WIDTH = 600; 
const GAME_HEIGHT = 800; 

const MATRIX_SIZE = 600; 
const GRID_SIZE = 40; 
const COLS = MATRIX_SIZE / GRID_SIZE; 
const ROWS = MATRIX_SIZE / GRID_SIZE; 

const STATE = { START: 0, PLAYING: 1, PAUSED: 2, GAMEOVER: 3, LEADERBOARD: 4 };
let gameState = STATE.START;

let globalLeaderboardData = [];
let score = 0; let deathReason = "";

let isOknMoving = false; let oknDirection = 1; let oknSpeedLevel = 1; let currentOknOffset = 0;
let keys = {};
window.mobileAccelerating = false;

const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || ('ontouchstart' in window);

// ==========================================
// 🐍 遊戲實體 (Snake, Items, Particles)
// ==========================================
let snake = { body: [], dx: 1, dy: 0, nextDx: 1, nextDy: 0, wallTimer: 0, currentTickRate: 600 };
let items = []; let particles = []; let lastTickTime = 0;

// ==========================================
// 🎮 初始化與畫布設定
// ==========================================
function setupCanvas() {
    container = document.getElementById('canvas-container');
    container.innerHTML = ''; container.style.position = 'relative'; 

    canvas = document.createElement('canvas');
    ctx = canvas.getContext('2d');
    container.appendChild(canvas);

    canvas.width = GAME_WIDTH; canvas.height = GAME_HEIGHT;
    canvas.style.display = 'block'; canvas.style.margin = '0 auto'; canvas.style.backgroundColor = '#ffffff';
    
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();
}

function resizeCanvas() {
    if (!canvas) return;
    const scale = Math.min(window.innerWidth / GAME_WIDTH, window.innerHeight / GAME_HEIGHT);
    canvas.style.width = `${GAME_WIDTH * scale}px`; canvas.style.height = `${GAME_HEIGHT * scale}px`;
}

function enterFullscreen() {
    if (!isMobile) return; 
    const elem = document.documentElement; 
    if (elem.requestFullscreen) { elem.requestFullscreen().catch(()=>{}); }
    else if (elem.webkitRequestFullscreen) { elem.webkitRequestFullscreen(); }
    try { screen.orientation.lock('portrait').catch(()=>{}); } catch(e){}
}

function exitFullscreen() {
    if (!isMobile) return;
    if (document.fullscreenElement || document.webkitFullscreenElement) {
        if (document.exitFullscreen) document.exitFullscreen();
        else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
    }
}

// ==========================================
// 邏輯核心：產生器與特效
// ==========================================
function spawnItem(typeStr) {
    let emptyCells = [];
    for (let x = 0; x < COLS; x++) {
        for (let y = 0; y < ROWS; y++) {
            if (!snake.body.some(segment => segment.x === x && segment.y === y) && !items.some(item => item.x === x && item.y === y)) emptyCells.push({x, y});
        }
    }
    if (emptyCells.length === 0) return;
    let pos = emptyCells[Math.floor(Math.random() * emptyCells.length)];
    
    if (typeStr === 'speed') items.push({ x: pos.x, y: pos.y, type: 'speed', emoji: '⚡', spawnTime: Date.now() });
    else if (typeStr === 'slow') items.push({ x: pos.x, y: pos.y, type: 'slow', emoji: '🐢', spawnTime: Date.now() });
    else if (typeStr === 'bomb') items.push({ x: pos.x, y: pos.y, type: 'bomb', emoji: '💣', spawnTime: Date.now() });
    else items.push({ x: pos.x, y: pos.y, type: 'fruit', emoji: '🍎', score: 10, spawnTime: Date.now() });
}

function createParticles(x, y, type) {
    const px = x * GRID_SIZE + GRID_SIZE/2; const py = y * GRID_SIZE + GRID_SIZE/2; const count = type === 'bomb' ? 30 : 15;
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2; const speed = Math.random() * (type === 'bomb' ? 8 : 4);
        let color = '#ef4444'; 
        if (type === 'bomb') color = Math.random() > 0.5 ? '#dc2626' : '#fbbf24';
        else if (type === 'speed') color = '#fbbf24'; else if (type === 'slow') color = '#34d399';
        particles.push({ x: px, y: py, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, color: color, life: 1.0, decay: Math.random() * 0.05 + 0.02, size: Math.random() * 6 + 2 });
    }
}

function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i]; p.x += p.vx; p.y += p.vy; p.life -= p.decay;
        if (p.life <= 0) particles.splice(i, 1);
    }
}

function setNextDirection(nx, ny) {
    if (gameState !== STATE.PLAYING) return;
    if (snake.dx === -nx && snake.dx !== 0) return;
    if (snake.dy === -ny && snake.dy !== 0) return;
    snake.nextDx = nx; snake.nextDy = ny;
}

// ==========================================
// 遊戲主循環更新
// ==========================================
function updateGame(timestamp) {
    if (gameState !== STATE.PLAYING) return;

    for (let i = items.length - 1; i >= 0; i--) { if (items[i].type !== 'fruit' && Date.now() - items[i].spawnTime > 15000) items.splice(i, 1); }

    let isSpeedingUp = keys['ArrowUp'] || keys['ArrowDown'] || keys['ArrowLeft'] || keys['ArrowRight'] || window.mobileAccelerating;
    let actualTickRate = isSpeedingUp ? Math.max(80, snake.currentTickRate / 2.5) : snake.currentTickRate;

    if (timestamp - lastTickTime > actualTickRate) {
        let head = snake.body[0]; let nextX = head.x + snake.nextDx; let nextY = head.y + snake.nextDy;

        if (nextX < 0 || nextX >= COLS || nextY < 0 || nextY >= ROWS) {
            snake.wallTimer += actualTickRate;
            if (snake.wallTimer >= 1000) { deathReason = "撞牆發呆？系統判定神經連結中斷。"; triggerGameOver(); } return;
        } else { snake.wallTimer = 0; }

        for (let i = 0; i < snake.body.length; i++) {
            if (nextX === snake.body[i].x && nextY === snake.body[i].y) { deathReason = "撞到自己的身體而亡"; triggerGameOver(); return; }
        }

        snake.dx = snake.nextDx; snake.dy = snake.nextDy; snake.body.unshift({ x: nextX, y: nextY });

        let ateFruit = false;
        for (let i = items.length - 1; i >= 0; i--) {
            let item = items[i];
            if (item.x === nextX && item.y === nextY) {
                if (item.type === 'fruit') {
                    score += item.score; ateFruit = true; createParticles(nextX, nextY, 'fruit'); items.splice(i, 1); spawnItem('fruit'); 
                    let rand = Math.random(); if (rand < 0.15) spawnItem('bomb'); else if (rand >= 0.15 && rand < 0.25) spawnItem('speed'); else if (rand >= 0.25 && rand < 0.35) spawnItem('slow');
                } else if (item.type === 'bomb') {
                    createParticles(nextX, nextY, 'bomb'); items.splice(i, 1);
                    if (snake.body.length <= 2) { deathReason = "單一節點引爆！邏輯抑制失敗。"; triggerGameOver(); return; } 
                    else { score = Math.max(0, score - 30); snake.body.pop(); snake.body.pop(); ateFruit = true; }
                } else if (item.type === 'speed') {
                    createParticles(nextX, nextY, 'speed'); items.splice(i, 1);
                    snake.currentTickRate = Math.max(150, Math.floor(snake.currentTickRate * 0.8)); ateFruit = true; snake.body.pop();
                } else if (item.type === 'slow') {
                    createParticles(nextX, nextY, 'slow'); items.splice(i, 1);
                    snake.currentTickRate = Math.min(1000, snake.currentTickRate + 150); ateFruit = true; snake.body.pop();
                }
            }
        }
        if (!ateFruit) { snake.body.pop(); }
        lastTickTime = timestamp;
    }
}

// ==========================================
// 繪圖與面板渲染
// ==========================================
function drawEverything() {
    ctx.fillStyle = '#f8fafc'; ctx.fillRect(0, 0, GAME_WIDTH, MATRIX_SIZE);
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, GAME_WIDTH, MATRIX_SIZE); ctx.clip();
    
    if (isOknMoving && gameState === STATE.PLAYING) {
        currentOknOffset += (oknSpeedLevel * 1.0) * oknDirection;
        if (currentOknOffset >= 80) currentOknOffset -= 80; if (currentOknOffset <= -80) currentOknOffset += 80;
        ctx.fillStyle = '#e2e8f0'; for (let i = -80; i < GAME_WIDTH + 80; i += 80) { ctx.fillRect(i + currentOknOffset, 0, 40, MATRIX_SIZE); }
    } else {
        ctx.strokeStyle = '#f1f5f9'; ctx.lineWidth = 1;
        for(let i=0; i<GAME_WIDTH; i+=GRID_SIZE) { ctx.beginPath(); ctx.moveTo(i,0); ctx.lineTo(i,MATRIX_SIZE); ctx.stroke(); }
        for(let i=0; i<MATRIX_SIZE; i+=GRID_SIZE) { ctx.beginPath(); ctx.moveTo(0,i); ctx.lineTo(GAME_WIDTH,i); ctx.stroke(); }
    }
    ctx.restore();

    ctx.fillStyle = '#cbd5e1'; ctx.fillRect(0, MATRIX_SIZE, GAME_WIDTH, 4);
    ctx.fillStyle = '#f1f5f9'; ctx.fillRect(0, MATRIX_SIZE + 4, GAME_WIDTH, GAME_HEIGHT - MATRIX_SIZE - 4);

    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `${GRID_SIZE * 0.8}px Arial`;
    items.forEach(item => {
        if (item.type !== 'fruit' && Date.now() - item.spawnTime > 12000 && Date.now() % 400 < 200) return; 
        ctx.fillText(item.emoji, item.x * GRID_SIZE + GRID_SIZE/2, item.y * GRID_SIZE + GRID_SIZE/2 + 4);
    });

    snake.body.forEach((segment, index) => {
        const px = segment.x * GRID_SIZE; const py = segment.y * GRID_SIZE;
        if (index === 0) {
            ctx.fillStyle = '#10b981'; ctx.beginPath(); ctx.roundRect(px, py, GRID_SIZE, GRID_SIZE, 8); ctx.fill();
            ctx.fillStyle = 'white'; ctx.beginPath(); let ex1, ey1, ex2, ey2;
            if (snake.dx === 1) { ex1 = px+28; ey1 = py+10; ex2 = px+28; ey2 = py+30; } else if (snake.dx === -1) { ex1 = px+12; ey1 = py+10; ex2 = px+12; ey2 = py+30; }
            else if (snake.dy === 1) { ex1 = px+10; ey1 = py+28; ex2 = px+30; ey2 = py+28; } else { ex1 = px+10; ey1 = py+12; ex2 = px+30; ey2 = py+12; }
            ctx.arc(ex1, ey1, 3, 0, Math.PI*2); ctx.arc(ex2, ey2, 3, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = '#0f172a'; ctx.beginPath(); ctx.arc(ex1+snake.dx*2, ey1+snake.dy*2, 1.5, 0, Math.PI*2); ctx.arc(ex2+snake.dx*2, ey2+snake.dy*2, 1.5, 0, Math.PI*2); ctx.fill();
        } else {
            ctx.fillStyle = '#34d399'; ctx.strokeStyle = '#059669'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.roundRect(px+2, py+2, GRID_SIZE-4, GRID_SIZE-4, 6); ctx.fill(); ctx.stroke();
        }
    });

    particles.forEach(p => { ctx.fillStyle = p.color; ctx.globalAlpha = p.life; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI*2); ctx.fill(); }); ctx.globalAlpha = 1.0;

    drawHUDPanel(); drawGameState(); drawOknButton();
}

function drawHUDPanel() {
    if (gameState === STATE.START) return;
    
    ctx.fillStyle = '#f59e0b'; ctx.font = 'bold 28px "Orbitron", monospace'; ctx.textAlign = 'center';
    ctx.fillText(`SCORE: ${score}`, GAME_WIDTH / 2, MATRIX_SIZE + 45);
    
    let isSpeedingUp = keys['ArrowUp'] || keys['ArrowDown'] || keys['ArrowLeft'] || keys['ArrowRight'] || window.mobileAccelerating;
    if (isSpeedingUp) {
        ctx.fillStyle = '#ef4444'; ctx.font = 'bold 16px Arial'; ctx.fillText(`⚡ 衝刺模式啟動中...`, GAME_WIDTH / 2, MATRIX_SIZE + 85);
    } else {
        let speedLevel = (600 / snake.currentTickRate).toFixed(1);
        ctx.fillStyle = '#64748b'; ctx.font = 'bold 16px Arial'; ctx.fillText(`當前基準速度: x${speedLevel}`, GAME_WIDTH / 2, MATRIX_SIZE + 85);
    }

    ctx.fillStyle = gameState === STATE.PAUSED ? '#ef4444' : '#334155';
    ctx.beginPath(); ctx.roundRect(240, 720, 120, 45, 8); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 18px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(gameState === STATE.PAUSED ? '▶ 繼 續' : '|| 暫 停', 300, 742);
    ctx.textBaseline = 'alphabetic';
}

function drawOknButton() {
    ctx.save();
    ctx.fillStyle = isOknMoving ? '#dcfce7' : '#e2e8f0'; ctx.strokeStyle = isOknMoving ? '#10b981' : '#cbd5e1'; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(20, MATRIX_SIZE + 25, 95, 38, 8); ctx.fill(); ctx.stroke();
    ctx.textBaseline = 'middle'; ctx.fillStyle = isOknMoving ? '#10b981' : '#64748b'; ctx.font = 'bold 13px Arial'; ctx.textAlign = 'center'; ctx.fillText(isOknMoving ? 'OKN: ON' : 'OKN: OFF', 67, MATRIX_SIZE + 44);

    ctx.fillStyle = '#e0f2fe'; ctx.strokeStyle = '#7dd3fc'; ctx.beginPath(); ctx.roundRect(485, MATRIX_SIZE + 25, 95, 38, 8); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#0284c7'; ctx.fillText(oknDirection === 1 ? '➡ 向右' : '⬅ 向左', 532, MATRIX_SIZE + 44);
    ctx.restore();
}

function drawGameState() {
    if (gameState === STATE.START) {
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
        ctx.strokeStyle = '#f8fafc'; ctx.lineWidth = 1;
        for(let i=0; i<GAME_WIDTH; i+=30) { ctx.beginPath(); ctx.moveTo(i,0); ctx.lineTo(i,GAME_HEIGHT); ctx.stroke(); }
        for(let i=0; i<GAME_HEIGHT; i+=30) { ctx.beginPath(); ctx.moveTo(0,i); ctx.lineTo(GAME_WIDTH,i); ctx.stroke(); }

        ctx.fillStyle = '#1e293b'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.font = 'bold 56px Arial'; ctx.fillText('經典貪食蛇', GAME_WIDTH / 2, 170);
        ctx.fillStyle = '#64748b'; ctx.font = 'bold 24px "Orbitron", sans-serif'; ctx.fillText('AXP Vision Snake', GAME_WIDTH / 2, 220);

        ctx.fillStyle = '#f8fafc'; ctx.strokeStyle = '#cbd5e1'; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(70, 280, 460, 160, 12); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#334155'; ctx.font = '18px Arial'; ctx.fillText('🍎 經典紅蘋果：激活周邊視野與平滑追視', GAME_WIDTH / 2, 330); ctx.fillText('💣 避開炸彈、⚡ 加速、🐢 減速：Go/No-Go 抑制', GAME_WIDTH / 2, 380);
        
        let hintMsg = isMobile ? '💡 螢幕長按可啟動衝刺 / 下方可點擊暫停' : '💡 長按方向鍵可衝刺 / 空白鍵可暫停';
        ctx.fillStyle = '#d97706'; ctx.font = 'bold 16px Arial'; ctx.fillText(hintMsg, GAME_WIDTH / 2, 420);

        ctx.fillStyle = '#2980b9'; ctx.beginPath(); ctx.roundRect(150, 500, 300, 60, 8); ctx.fill();
        ctx.fillStyle = '#ffffff'; ctx.font = 'bold 24px Arial'; ctx.textBaseline = 'middle'; ctx.fillText('啟 動', 300, 530); ctx.textBaseline = 'alphabetic'; 
    }
    else if (gameState === STATE.PAUSED) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)'; ctx.fillRect(0, 0, GAME_WIDTH, MATRIX_SIZE); 
        ctx.fillStyle = '#1e293b'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = 'bold 40px Arial'; ctx.fillText('遊戲暫停', GAME_WIDTH / 2, MATRIX_SIZE / 2); ctx.textBaseline = 'alphabetic';
    }
    else if (gameState === STATE.GAMEOVER) {
        ctx.fillStyle = 'rgba(248, 250, 252, 0.9)'; ctx.fillRect(0, 0, GAME_WIDTH, MATRIX_SIZE); 
        ctx.fillStyle = '#ef4444'; ctx.textAlign = 'center'; ctx.font = 'bold 56px Arial'; ctx.fillText('GAME OVER', GAME_WIDTH / 2, MATRIX_SIZE / 2 - 30);
        ctx.fillStyle = '#475569'; ctx.font = 'bold 18px Arial'; ctx.fillText(deathReason, GAME_WIDTH / 2, MATRIX_SIZE / 2 + 30);
    }
    else if (gameState === STATE.LEADERBOARD) {
        ctx.fillStyle = '#f8fafc'; ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT); 
        ctx.fillStyle = '#0284c7'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.font = 'bold 40px Arial'; ctx.fillText('🏆 全球排行榜', GAME_WIDTH / 2, 80);
        ctx.fillStyle = '#64748b'; ctx.font = 'bold 18px Arial'; ctx.textAlign = 'left'; ctx.fillText('排名', 60, 140); ctx.fillText('代號', 130, 140); ctx.fillText('分數', 320, 140); ctx.fillText('時間', 420, 140); ctx.strokeStyle = '#cbd5e1'; ctx.beginPath(); ctx.moveTo(50, 150); ctx.lineTo(550, 150); ctx.stroke(); 
        globalLeaderboardData.forEach((entry, i) => { 
            const y = 190 + i * 40; ctx.fillStyle = i < 3 ? '#d97706' : '#94a3b8'; ctx.fillText(`# ${i+1}`, 60, y); ctx.fillStyle = '#1e293b'; ctx.fillText(entry.name.substring(0,8), 130, y); ctx.fillStyle = '#ef4444'; ctx.fillText(`${entry.score} 分`, 320, y); ctx.fillStyle = '#94a3b8'; ctx.font = '14px Arial'; ctx.fillText(entry.date, 420, y); ctx.font = '18px Arial'; 
        });
        ctx.fillStyle = '#2980b9'; ctx.beginPath(); ctx.roundRect(GAME_WIDTH/2 - 120, 700, 240, 50, 8); ctx.fill(); 
        ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = 'bold 20px Arial'; ctx.fillText('返回', GAME_WIDTH/2, 725); ctx.textBaseline = 'alphabetic';
    }
}

// ==========================================
// 🌟 核心升級：極速觸控引擎 (Touchmove)
// ==========================================
function handleUIClick(clientX, clientY) {
    const rect = canvas.getBoundingClientRect(); 
    const mx = (clientX - rect.left) * (GAME_WIDTH / rect.width); const my = (clientY - rect.top) * (GAME_HEIGHT / rect.height);
    
    if (mx > 10 && mx < 130 && my > MATRIX_SIZE + 10 && my < MATRIX_SIZE + 75) { isOknMoving = !isOknMoving; return; }
    if (mx > 470 && mx < 590 && my > MATRIX_SIZE + 10 && my < MATRIX_SIZE + 75) { oknDirection *= -1; return; }
    
    if (gameState === STATE.PLAYING || gameState === STATE.PAUSED) {
        if (mx > 240 && mx < 360 && my > 720 && my < 765) { gameState = gameState === STATE.PLAYING ? STATE.PAUSED : STATE.PLAYING; return; }
    }
    
    if (gameState === STATE.LEADERBOARD && mx > 150 && mx < 450 && my > 680 && my < 770) { gameState = STATE.START; return; }
    if (gameState === STATE.START && mx > 120 && mx < 480 && my > 480 && my < 580) { startGame(); enterFullscreen(); }
}

function bindMouseEvents() { 
    canvas.addEventListener('mousedown', (e) => { handleUIClick(e.clientX, e.clientY); }); 

    let touchStartX = 0; let touchStartY = 0;

    canvas.addEventListener('touchstart', e => { 
        if (gameState === STATE.PLAYING) { e.preventDefault(); window.mobileAccelerating = true; }
        touchStartX = e.touches[0].clientX; 
        touchStartY = e.touches[0].clientY; 
    }, {passive: false});

    // 🌟 關鍵升級：滑動途中就瞬間判定轉向！
    canvas.addEventListener('touchmove', e => {
        if (gameState !== STATE.PLAYING) return;
        e.preventDefault(); 
        
        let currentX = e.touches[0].clientX;
        let currentY = e.touches[0].clientY;
        let dx = currentX - touchStartX;
        let dy = currentY - touchStartY;
        
        // 降低門檻至 20px，只要稍微滑動就轉向，大幅提升手感
        if (Math.abs(dx) > 20 || Math.abs(dy) > 20) {
            if (Math.abs(dx) > Math.abs(dy)) { setNextDirection(dx > 0 ? 1 : -1, 0); } 
            else { setNextDirection(0, dy > 0 ? 1 : -1); }
            
            // 轉向後重置圓心，允許玩家在手指不放開的情況下連續轉彎！
            touchStartX = currentX;
            touchStartY = currentY;
        }
    }, {passive: false});

    canvas.addEventListener('touchend', e => {
        window.mobileAccelerating = false;
        if (gameState !== STATE.PLAYING) {
            let dx = e.changedTouches[0].clientX - touchStartX; let dy = e.changedTouches[0].clientY - touchStartY;
            if (Math.abs(dx) < 15 && Math.abs(dy) < 15) { handleUIClick(e.changedTouches[0].clientX, e.changedTouches[0].clientY); } 
        } else {
            // 遊玩中點擊暫停按鈕
            let dx = e.changedTouches[0].clientX - touchStartX; let dy = e.changedTouches[0].clientY - touchStartY;
            if (Math.abs(dx) < 15 && Math.abs(dy) < 15) { handleUIClick(e.changedTouches[0].clientX, e.changedTouches[0].clientY); }
        }
    }, {passive: false});

    canvas.addEventListener('touchcancel', () => window.mobileAccelerating = false);
}

// 全域鍵盤事件
window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return; 
    if(["Space","ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].indexOf(e.code) > -1) e.preventDefault();
    keys[e.code] = true;
    if (e.code === 'Space') { if (gameState === STATE.PLAYING) gameState = STATE.PAUSED; else if (gameState === STATE.PAUSED) gameState = STATE.PLAYING; }
    else if (e.code === 'ArrowUp') setNextDirection(0, -1);
    else if (e.code === 'ArrowDown') setNextDirection(0, 1);
    else if (e.code === 'ArrowLeft') setNextDirection(-1, 0);
    else if (e.code === 'ArrowRight') setNextDirection(1, 0);
    else if (e.code === 'Enter') { if (gameState === STATE.START) { startGame(); enterFullscreen(); } else if (gameState === STATE.LEADERBOARD) gameState = STATE.START; }
}, { passive: false });

window.addEventListener('keyup', (e) => keys[e.code] = false);

// ==========================================
// 雲端儲存與生命週期
// ==========================================
function triggerGameOver() {
    gameState = STATE.GAMEOVER; exitFullscreen(); 
    setTimeout(async () => {
        await fetchLeaderboardData();
        let lowestScore = globalLeaderboardData.length === 10 ? globalLeaderboardData[9].score : 0;
        if (globalLeaderboardData.length < 10 || score > lowestScore) { showNameInputModal(); } else { gameState = STATE.LEADERBOARD; }
    }, 1500);
}

function showNameInputModal() {
    let modal = document.getElementById('axp-name-modal');
    if (!modal) {
        modal = document.createElement('div'); modal.id = 'axp-name-modal';
        modal.style.cssText = 'position:absolute; top:40%; left:50%; transform:translate(-50%, -50%); background:rgba(255, 255, 255, 0.98); padding:30px; border:1px solid #cbd5e1; border-radius:12px; box-shadow:0 10px 30px rgba(0,0,0,0.15); text-align:center; z-index:100; width:80%; max-width:320px; font-family:Arial;';
        modal.innerHTML = `
            <h3 style="margin:0 0 10px 0; color:#0ea5e9; font-size:24px;">🎉 破紀錄啦！</h3>
            <p style="color:#64748b; margin-bottom:15px; font-size:14px;">請輸入你的名字：</p>
            <input type="text" id="axp-agent-name" value="特工" maxlength="8" style="width:80%; padding:12px; font-size:18px; border:2px solid #cbd5e1; border-radius:6px; margin-bottom:20px; text-align:center; outline:none; font-weight:bold; color:#1e293b; background:#f8fafc; user-select:auto; -webkit-user-select:auto;">
            <button id="axp-submit-score" style="background:#2980b9; color:white; border:none; padding:12px 25px; font-size:18px; border-radius:6px; cursor:pointer; font-weight:bold; width:100%; user-select:auto; -webkit-user-select:auto;">送出成績</button>`;
        container.appendChild(modal);
        
        document.getElementById('axp-agent-name').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); document.getElementById('axp-submit-score').click(); } });
        document.getElementById('axp-submit-score').addEventListener('click', async () => {
            const btn = document.getElementById('axp-submit-score'); btn.innerText = '上傳中...'; btn.disabled = true;
            const name = document.getElementById('axp-agent-name').value || '特工';
            const now = new Date(); const dateStr = `${now.getFullYear()}/${(now.getMonth()+1).toString().padStart(2,'0')}/${now.getDate().toString().padStart(2,'0')} ${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}`;
            try {
                const { error } = await supabaseClient.from('snake_leaderboard').insert([{ name: name, score: score, date: dateStr }]);
                if (error) throw error; 
                await fetchLeaderboardData(); modal.remove(); gameState = STATE.LEADERBOARD;
            } catch (err) { alert("上傳失敗：" + err.message); btn.innerText = '重新送出'; btn.disabled = false; }
        });
    }
    document.getElementById('axp-agent-name').focus();
}

async function fetchLeaderboardData() {
    try { const { data, error } = await supabaseClient.from('snake_leaderboard').select('*').order('score', { ascending: false }).limit(10); if (data) globalLeaderboardData = data; } catch (err) {}
}

function startGame() {
    snake.body = [{ x: 7, y: 7 }]; snake.dx = 1; snake.dy = 0; snake.nextDx = 1; snake.nextDy = 0;
    snake.wallTimer = 0; snake.currentTickRate = 600; 
    score = 0; items = []; particles = []; deathReason = "";
    spawnItem('fruit'); gameState = STATE.PLAYING; lastTickTime = performance.now();
}

function gameLoop(timestamp) { updateGame(timestamp); updateParticles(); drawEverything(); requestAnimationFrame(gameLoop); }

function bootGame() { setupCanvas(); bindMouseEvents(); fetchLeaderboardData().finally(() => { requestAnimationFrame(gameLoop); }); }

if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', bootGame); } else { bootGame(); }