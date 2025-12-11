/* DYSECTOR Shop Prototype - Probe Workbench Minigames */

const ProbeSystem = {
    canvas: null,
    ctx: null,
    currentGame: null,
    difficulty: 'easy',
    stats: { wins: 0, losses: 0, streak: 0 },

    // Colors matching CLI aesthetic
    colors: {
        bg: '#000000',
        border: '#2a2a30',
        cyan: '#4ecdc4',
        green: '#27ae60',
        purple: '#9b59b6',
        gold: '#d4a843',
        red: '#e74c3c',
        text: '#e8e8e8',
        dim: '#555555',
    },

    init() {
        this.canvas = document.getElementById('probe-canvas');
        if (!this.canvas) return;
        this.ctx = this.canvas.getContext('2d');

        this.bindEvents();
        this.drawIdleScreen();
    },

    bindEvents() {
        // Game selection buttons
        document.querySelectorAll('.probe-game-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.probe-game-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.startGame(btn.dataset.game);
            });
        });

        // Difficulty buttons
        document.querySelectorAll('.probe-diff-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.probe-diff-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.difficulty = btn.dataset.diff;
            });
        });

        // Canvas click
        this.canvas.addEventListener('click', (e) => this.handleClick(e));
    },

    handleClick(e) {
        if (!this.currentGame) return;

        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Dispatch to current game
        if (this.currentGame.handleClick) {
            this.currentGame.handleClick(x, y);
        }
    },

    setStatus(text) {
        const el = document.getElementById('probe-status');
        if (el) el.textContent = text;
    },

    updateStats() {
        document.getElementById('probe-wins').textContent = this.stats.wins;
        document.getElementById('probe-losses').textContent = this.stats.losses;
        document.getElementById('probe-streak').textContent = this.stats.streak;
    },

    gameWon() {
        this.stats.wins++;
        this.stats.streak++;
        this.updateStats();
        this.setStatus('SUCCESS! Click a game to play again.');
        this.currentGame = null;
    },

    gameLost() {
        this.stats.losses++;
        this.stats.streak = 0;
        this.updateStats();
        this.setStatus('FAILED. Click a game to try again.');
        this.currentGame = null;
    },

    drawIdleScreen() {
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;

        ctx.fillStyle = this.colors.bg;
        ctx.fillRect(0, 0, w, h);

        ctx.strokeStyle = this.colors.border;
        ctx.lineWidth = 2;
        ctx.strokeRect(10, 10, w - 20, h - 20);

        ctx.fillStyle = this.colors.cyan;
        ctx.font = '24px "Orbitron", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('PROBE WORKBENCH', w / 2, h / 2 - 30);

        ctx.fillStyle = this.colors.dim;
        ctx.font = '14px "Share Tech Mono", monospace';
        ctx.fillText('Select a minigame from the sidebar', w / 2, h / 2 + 10);
        ctx.fillText('to begin diagnostics', w / 2, h / 2 + 30);
    },

    startGame(gameType) {
        switch (gameType) {
            case 'memory':
                this.currentGame = new MemoryMatchGame(this);
                break;
            case 'launch':
                this.currentGame = new ProbeLaunchGame(this);
                break;
            case 'pipes':
                this.currentGame = new HexPipesGame(this);
                break;
            case 'packet':
                this.currentGame = new PacketHuntGame(this);
                break;
        }

        if (this.currentGame) {
            this.currentGame.init(this.difficulty);
        }
    }
};

// ============================================
// MEMORY MATCH GAME
// ============================================
class MemoryMatchGame {
    constructor(system) {
        this.system = system;
        this.ctx = system.ctx;
        this.canvas = system.canvas;
        this.colors = system.colors;

        this.grid = [];
        this.revealed = [];
        this.matched = [];
        this.firstPick = null;
        this.moves = 0;
        this.pairs = 0;
        this.totalPairs = 0;
        this.locked = false;

        // CLI symbols for matching
        this.symbols = ['@', '#', '$', '%', '&', '*', '+', '=', '!', '?', '^', '~'];
    }

    init(difficulty) {
        // Grid size based on difficulty
        const sizes = { easy: 4, medium: 5, hard: 6 };
        const size = sizes[difficulty] || 4;

        this.gridSize = size;
        this.totalPairs = (size * size) / 2;
        this.pairs = 0;
        this.moves = 0;
        this.firstPick = null;
        this.locked = false;

        // Generate pairs
        const symbols = this.symbols.slice(0, this.totalPairs);
        const cards = [...symbols, ...symbols];

        // Shuffle
        for (let i = cards.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [cards[i], cards[j]] = [cards[j], cards[i]];
        }

        // Create grid
        this.grid = [];
        this.revealed = [];
        this.matched = [];

        for (let y = 0; y < size; y++) {
            this.grid[y] = [];
            this.revealed[y] = [];
            this.matched[y] = [];
            for (let x = 0; x < size; x++) {
                this.grid[y][x] = cards[y * size + x];
                this.revealed[y][x] = false;
                this.matched[y][x] = false;
            }
        }

        this.system.setStatus(`MEMORY MATCH | Pairs: 0/${this.totalPairs} | Moves: 0`);
        this.draw();
    }

    draw() {
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;

        ctx.fillStyle = this.colors.bg;
        ctx.fillRect(0, 0, w, h);

        const padding = 40;
        const gridW = w - padding * 2;
        const gridH = h - padding * 2;
        const cellW = gridW / this.gridSize;
        const cellH = gridH / this.gridSize;
        const gap = 6;

        for (let y = 0; y < this.gridSize; y++) {
            for (let x = 0; x < this.gridSize; x++) {
                const cx = padding + x * cellW + gap / 2;
                const cy = padding + y * cellH + gap / 2;
                const cw = cellW - gap;
                const ch = cellH - gap;

                if (this.matched[y][x]) {
                    // Matched - green border, dim
                    ctx.fillStyle = '#0a1a0a';
                    ctx.fillRect(cx, cy, cw, ch);
                    ctx.strokeStyle = this.colors.green;
                    ctx.lineWidth = 2;
                    ctx.strokeRect(cx, cy, cw, ch);

                    ctx.fillStyle = this.colors.green;
                    ctx.font = `${Math.min(cw, ch) * 0.5}px "Share Tech Mono", monospace`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(this.grid[y][x], cx + cw / 2, cy + ch / 2);
                } else if (this.revealed[y][x]) {
                    // Revealed - cyan
                    ctx.fillStyle = '#0a1a1a';
                    ctx.fillRect(cx, cy, cw, ch);
                    ctx.strokeStyle = this.colors.cyan;
                    ctx.lineWidth = 2;
                    ctx.strokeRect(cx, cy, cw, ch);

                    ctx.fillStyle = this.colors.cyan;
                    ctx.font = `${Math.min(cw, ch) * 0.5}px "Share Tech Mono", monospace`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(this.grid[y][x], cx + cw / 2, cy + ch / 2);
                } else {
                    // Hidden
                    ctx.fillStyle = '#111';
                    ctx.fillRect(cx, cy, cw, ch);
                    ctx.strokeStyle = this.colors.border;
                    ctx.lineWidth = 2;
                    ctx.strokeRect(cx, cy, cw, ch);

                    ctx.fillStyle = this.colors.dim;
                    ctx.font = `${Math.min(cw, ch) * 0.4}px "Share Tech Mono", monospace`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText('?', cx + cw / 2, cy + ch / 2);
                }
            }
        }
    }

    handleClick(mx, my) {
        if (this.locked) return;

        const padding = 40;
        const gridW = this.canvas.width - padding * 2;
        const gridH = this.canvas.height - padding * 2;
        const cellW = gridW / this.gridSize;
        const cellH = gridH / this.gridSize;

        const x = Math.floor((mx - padding) / cellW);
        const y = Math.floor((my - padding) / cellH);

        if (x < 0 || x >= this.gridSize || y < 0 || y >= this.gridSize) return;
        if (this.revealed[y][x] || this.matched[y][x]) return;

        this.revealed[y][x] = true;
        this.draw();

        if (!this.firstPick) {
            this.firstPick = { x, y };
        } else {
            this.moves++;
            this.locked = true;

            const first = this.firstPick;
            const second = { x, y };

            if (this.grid[first.y][first.x] === this.grid[second.y][second.x]) {
                // Match!
                this.matched[first.y][first.x] = true;
                this.matched[second.y][second.x] = true;
                this.pairs++;

                this.system.setStatus(`MEMORY MATCH | Pairs: ${this.pairs}/${this.totalPairs} | Moves: ${this.moves}`);

                if (this.pairs === this.totalPairs) {
                    setTimeout(() => this.system.gameWon(), 500);
                }

                this.firstPick = null;
                this.locked = false;
                this.draw();
            } else {
                // No match - hide after delay
                setTimeout(() => {
                    this.revealed[first.y][first.x] = false;
                    this.revealed[second.y][second.x] = false;
                    this.firstPick = null;
                    this.locked = false;
                    this.draw();
                    this.system.setStatus(`MEMORY MATCH | Pairs: ${this.pairs}/${this.totalPairs} | Moves: ${this.moves}`);
                }, 800);
            }
        }
    }
}

// ============================================
// PROBE LAUNCH GAME (Billiards/Peggle style)
// ============================================
class ProbeLaunchGame {
    constructor(system) {
        this.system = system;
        this.ctx = system.ctx;
        this.canvas = system.canvas;
        this.colors = system.colors;

        this.probes = 0;
        this.probe = null;
        this.core = null;
        this.walls = [];
        this.entryPoints = [];
        this.selectedEntry = 0;
        this.animating = false;
    }

    init(difficulty) {
        const probeCount = { easy: 5, medium: 3, hard: 2 };
        const wallCount = { easy: 3, medium: 6, hard: 10 };
        const coreSize = { easy: 40, medium: 30, hard: 20 };

        this.probes = probeCount[difficulty];
        this.probe = null;
        this.animating = false;

        // Core position (right side)
        this.core = {
            x: 380,
            y: 200 + Math.random() * 100,
            r: coreSize[difficulty]
        };

        // Entry points on left side
        this.entryPoints = [
            { x: 30, y: 100 },
            { x: 30, y: 250 },
            { x: 30, y: 400 }
        ];
        this.selectedEntry = 1;

        // Generate walls
        this.walls = [];
        for (let i = 0; i < wallCount[difficulty]; i++) {
            this.walls.push({
                x: 100 + Math.random() * 280,
                y: 50 + Math.random() * 400,
                w: 30 + Math.random() * 60,
                h: 20 + Math.random() * 40
            });
        }

        this.system.setStatus(`PROBE LAUNCH | Probes: ${this.probes} | Click entry point, then click to fire`);
        this.draw();
    }

    draw() {
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;

        ctx.fillStyle = this.colors.bg;
        ctx.fillRect(0, 0, w, h);

        // Border
        ctx.strokeStyle = this.colors.border;
        ctx.lineWidth = 2;
        ctx.strokeRect(10, 10, w - 20, h - 20);

        // Draw walls
        ctx.fillStyle = '#222';
        ctx.strokeStyle = this.colors.dim;
        for (const wall of this.walls) {
            ctx.fillRect(wall.x, wall.y, wall.w, wall.h);
            ctx.strokeRect(wall.x, wall.y, wall.w, wall.h);
        }

        // Draw core
        ctx.beginPath();
        ctx.arc(this.core.x, this.core.y, this.core.r, 0, Math.PI * 2);
        ctx.fillStyle = '#1a0a1a';
        ctx.fill();
        ctx.strokeStyle = this.colors.purple;
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.fillStyle = this.colors.purple;
        ctx.font = '12px "Share Tech Mono", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('CORE', this.core.x, this.core.y);

        // Draw entry points
        for (let i = 0; i < this.entryPoints.length; i++) {
            const ep = this.entryPoints[i];
            const selected = i === this.selectedEntry;

            ctx.fillStyle = selected ? this.colors.cyan : '#111';
            ctx.beginPath();
            ctx.arc(ep.x, ep.y, 15, 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = selected ? this.colors.cyan : this.colors.dim;
            ctx.lineWidth = 2;
            ctx.stroke();

            ctx.fillStyle = selected ? this.colors.bg : this.colors.dim;
            ctx.font = '10px "Share Tech Mono", monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('>', ep.x, ep.y);
        }

        // Draw probe if active
        if (this.probe) {
            ctx.beginPath();
            ctx.arc(this.probe.x, this.probe.y, 8, 0, Math.PI * 2);
            ctx.fillStyle = this.colors.cyan;
            ctx.fill();
        }

        // Probes remaining
        ctx.fillStyle = this.colors.text;
        ctx.font = '12px "Share Tech Mono", monospace';
        ctx.textAlign = 'left';
        ctx.fillText(`PROBES: ${this.probes}`, 20, 30);
    }

    handleClick(mx, my) {
        if (this.animating) return;

        // Check if clicked an entry point
        for (let i = 0; i < this.entryPoints.length; i++) {
            const ep = this.entryPoints[i];
            const dist = Math.sqrt((mx - ep.x) ** 2 + (my - ep.y) ** 2);
            if (dist < 20) {
                this.selectedEntry = i;
                this.draw();
                return;
            }
        }

        // Fire probe
        if (this.probes > 0 && !this.probe) {
            this.probes--;
            const ep = this.entryPoints[this.selectedEntry];
            this.probe = {
                x: ep.x,
                y: ep.y,
                vx: 5,
                vy: (my - ep.y) * 0.02
            };
            this.animating = true;
            this.animate();
        }
    }

    animate() {
        if (!this.probe) return;

        // Move probe
        this.probe.x += this.probe.vx;
        this.probe.y += this.probe.vy;

        // Bounce off top/bottom
        if (this.probe.y < 20 || this.probe.y > 480) {
            this.probe.vy *= -1;
            this.probe.y = Math.max(20, Math.min(480, this.probe.y));
        }

        // Bounce off walls
        for (const wall of this.walls) {
            if (this.probe.x > wall.x && this.probe.x < wall.x + wall.w &&
                this.probe.y > wall.y && this.probe.y < wall.y + wall.h) {
                // Simple bounce
                this.probe.vx *= -0.8;
                this.probe.x += this.probe.vx * 2;
                this.probe.vy += (Math.random() - 0.5) * 2;
            }
        }

        // Check core hit
        const dist = Math.sqrt((this.probe.x - this.core.x) ** 2 + (this.probe.y - this.core.y) ** 2);
        if (dist < this.core.r + 8) {
            this.probe = null;
            this.animating = false;
            this.draw();
            setTimeout(() => this.system.gameWon(), 300);
            return;
        }

        // Check out of bounds
        if (this.probe.x > 500 || this.probe.x < 0) {
            this.probe = null;
            this.animating = false;
            this.system.setStatus(`PROBE LAUNCH | Probes: ${this.probes} | Probe lost!`);

            if (this.probes === 0) {
                setTimeout(() => this.system.gameLost(), 500);
            }
            this.draw();
            return;
        }

        this.draw();
        requestAnimationFrame(() => this.animate());
    }
}

// ============================================
// HEX PIPES GAME
// ============================================
class HexPipesGame {
    constructor(system) {
        this.system = system;
        this.ctx = system.ctx;
        this.canvas = system.canvas;
        this.colors = system.colors;

        this.grid = [];
        this.gridW = 0;
        this.gridH = 0;
        this.startPos = null;
        this.endPos = null;
    }

    init(difficulty) {
        const sizes = { easy: { w: 4, h: 4 }, medium: { w: 5, h: 5 }, hard: { w: 6, h: 6 } };
        const size = sizes[difficulty];

        this.gridW = size.w;
        this.gridH = size.h;

        // Pipe types: 0=straight, 1=corner, 2=t-junction, 3=cross
        // Each has rotation 0-3 (90 degree increments)
        this.grid = [];
        for (let y = 0; y < this.gridH; y++) {
            this.grid[y] = [];
            for (let x = 0; x < this.gridW; x++) {
                this.grid[y][x] = {
                    type: Math.floor(Math.random() * 3), // 0-2
                    rotation: Math.floor(Math.random() * 4)
                };
            }
        }

        // Start and end
        this.startPos = { x: 0, y: Math.floor(this.gridH / 2) };
        this.endPos = { x: this.gridW - 1, y: Math.floor(this.gridH / 2) };

        // Force start/end to be connectable
        this.grid[this.startPos.y][this.startPos.x] = { type: 0, rotation: 0 };
        this.grid[this.endPos.y][this.endPos.x] = { type: 0, rotation: 0 };

        this.system.setStatus('HEX PIPES | Click tiles to rotate | Connect I/O to END');
        this.draw();
    }

    draw() {
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;

        ctx.fillStyle = this.colors.bg;
        ctx.fillRect(0, 0, w, h);

        const padding = 50;
        const cellW = (w - padding * 2) / this.gridW;
        const cellH = (h - padding * 2) / this.gridH;
        const cellSize = Math.min(cellW, cellH);

        const offsetX = (w - cellSize * this.gridW) / 2;
        const offsetY = (h - cellSize * this.gridH) / 2;

        // Check if connected
        const connected = this.checkConnection();

        for (let y = 0; y < this.gridH; y++) {
            for (let x = 0; x < this.gridW; x++) {
                const cx = offsetX + x * cellSize;
                const cy = offsetY + y * cellSize;
                const cell = this.grid[y][x];

                // Background
                ctx.fillStyle = '#111';
                ctx.fillRect(cx + 2, cy + 2, cellSize - 4, cellSize - 4);

                // Border
                const isStart = x === this.startPos.x && y === this.startPos.y;
                const isEnd = x === this.endPos.x && y === this.endPos.y;

                ctx.strokeStyle = isStart ? this.colors.cyan : isEnd ? this.colors.green : this.colors.border;
                ctx.lineWidth = isStart || isEnd ? 3 : 1;
                ctx.strokeRect(cx + 2, cy + 2, cellSize - 4, cellSize - 4);

                // Draw pipe
                this.drawPipe(ctx, cx + cellSize / 2, cy + cellSize / 2, cellSize * 0.4, cell.type, cell.rotation, connected && this.isOnPath(x, y));
            }
        }

        // Labels
        ctx.fillStyle = this.colors.cyan;
        ctx.font = '14px "Share Tech Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('I/O', offsetX + this.startPos.x * cellSize + cellSize / 2, offsetY - 15);

        ctx.fillStyle = this.colors.green;
        ctx.fillText('END', offsetX + this.endPos.x * cellSize + cellSize / 2, offsetY - 15);

        if (connected) {
            ctx.fillStyle = this.colors.green;
            ctx.font = '18px "Orbitron", monospace';
            ctx.fillText('CONNECTED!', w / 2, h - 20);
        }
    }

    drawPipe(ctx, cx, cy, r, type, rotation, highlight) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(rotation * Math.PI / 2);

        ctx.strokeStyle = highlight ? this.colors.green : this.colors.cyan;
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';

        ctx.beginPath();
        if (type === 0) {
            // Straight
            ctx.moveTo(-r, 0);
            ctx.lineTo(r, 0);
        } else if (type === 1) {
            // Corner
            ctx.moveTo(-r, 0);
            ctx.lineTo(0, 0);
            ctx.lineTo(0, -r);
        } else if (type === 2) {
            // T-junction
            ctx.moveTo(-r, 0);
            ctx.lineTo(r, 0);
            ctx.moveTo(0, 0);
            ctx.lineTo(0, -r);
        }
        ctx.stroke();

        ctx.restore();
    }

    // Simple connection check (just checks if there's a path)
    checkConnection() {
        // Simplified - just check if rotations align
        // Real implementation would trace the path
        const visited = new Set();
        return this.tracePath(this.startPos.x, this.startPos.y, 'right', visited);
    }

    tracePath(x, y, fromDir, visited) {
        const key = `${x},${y}`;
        if (visited.has(key)) return false;
        visited.add(key);

        if (x === this.endPos.x && y === this.endPos.y) return true;
        if (x < 0 || x >= this.gridW || y < 0 || y >= this.gridH) return false;

        const cell = this.grid[y][x];
        const exits = this.getExits(cell.type, cell.rotation);

        // Check each exit
        for (const exit of exits) {
            if (exit === 'left' && fromDir !== 'right') continue;
            if (exit === 'right' && fromDir !== 'left') continue;
            if (exit === 'up' && fromDir !== 'down') continue;
            if (exit === 'down' && fromDir !== 'up') continue;

            let nx = x, ny = y, nextFrom = '';
            if (exit === 'left') { nx--; nextFrom = 'right'; }
            if (exit === 'right') { nx++; nextFrom = 'left'; }
            if (exit === 'up') { ny--; nextFrom = 'down'; }
            if (exit === 'down') { ny++; nextFrom = 'up'; }

            if (this.tracePath(nx, ny, nextFrom, visited)) return true;
        }

        return false;
    }

    getExits(type, rotation) {
        const baseExits = {
            0: ['left', 'right'],
            1: ['left', 'up'],
            2: ['left', 'right', 'up']
        };

        const exits = baseExits[type] || [];
        const rotated = exits.map(dir => {
            const dirs = ['up', 'right', 'down', 'left'];
            const idx = dirs.indexOf(dir);
            return dirs[(idx + rotation) % 4];
        });

        return rotated;
    }

    isOnPath(x, y) {
        // Simplified
        return false;
    }

    handleClick(mx, my) {
        const w = this.canvas.width;
        const h = this.canvas.height;

        const padding = 50;
        const cellW = (w - padding * 2) / this.gridW;
        const cellH = (h - padding * 2) / this.gridH;
        const cellSize = Math.min(cellW, cellH);

        const offsetX = (w - cellSize * this.gridW) / 2;
        const offsetY = (h - cellSize * this.gridH) / 2;

        const x = Math.floor((mx - offsetX) / cellSize);
        const y = Math.floor((my - offsetY) / cellSize);

        if (x >= 0 && x < this.gridW && y >= 0 && y < this.gridH) {
            this.grid[y][x].rotation = (this.grid[y][x].rotation + 1) % 4;
            this.draw();

            if (this.checkConnection()) {
                setTimeout(() => this.system.gameWon(), 500);
            }
        }
    }
}

// ============================================
// PACKET HUNT GAME
// ============================================
class PacketHuntGame {
    constructor(system) {
        this.system = system;
        this.ctx = system.ctx;
        this.canvas = system.canvas;
        this.colors = system.colors;

        this.phase = 'detect'; // detect or exploit
        this.grid = [];
        this.targetSymbol = null;
        this.normalSymbol = null;
        this.targetPositions = [];
        this.found = [];
        this.timeLeft = 0;
        this.timer = null;
    }

    init(difficulty) {
        const configs = {
            easy: { size: 10, targets: 3, time: 30 },
            medium: { size: 12, targets: 5, time: 25 },
            hard: { size: 15, targets: 7, time: 20 }
        };

        const config = configs[difficulty];
        this.gridSize = config.size;
        this.targetCount = config.targets;
        this.timeLeft = config.time;
        this.phase = 'detect';
        this.found = [];

        // Generate symbols
        const symbolPairs = [
            ['o', '0'],
            ['l', '1'],
            ['.', ':'],
            ['[', '{'],
            ['-', '~'],
            ['|', '!']
        ];

        const pair = symbolPairs[Math.floor(Math.random() * symbolPairs.length)];
        this.normalSymbol = pair[0];
        this.targetSymbol = pair[1];

        // Generate grid
        this.grid = [];
        this.targetPositions = [];

        for (let y = 0; y < this.gridSize; y++) {
            this.grid[y] = [];
            for (let x = 0; x < this.gridSize; x++) {
                this.grid[y][x] = this.normalSymbol;
            }
        }

        // Place targets
        while (this.targetPositions.length < this.targetCount) {
            const x = Math.floor(Math.random() * this.gridSize);
            const y = Math.floor(Math.random() * this.gridSize);
            if (!this.targetPositions.some(p => p.x === x && p.y === y)) {
                this.targetPositions.push({ x, y });
                this.grid[y][x] = this.targetSymbol;
            }
        }

        this.system.setStatus(`PACKET HUNT | Phase: DETECT | Find the anomaly!`);
        this.draw();

        // Start timer
        if (this.timer) clearInterval(this.timer);
        this.timer = setInterval(() => {
            this.timeLeft--;
            this.updateStatus();
            if (this.timeLeft <= 0) {
                clearInterval(this.timer);
                this.system.gameLost();
            }
        }, 1000);
    }

    updateStatus() {
        if (this.phase === 'detect') {
            this.system.setStatus(`PACKET HUNT | Phase: DETECT | Time: ${this.timeLeft}s`);
        } else {
            this.system.setStatus(`PACKET HUNT | Found: ${this.found.length}/${this.targetCount} | Time: ${this.timeLeft}s`);
        }
    }

    draw() {
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;

        ctx.fillStyle = this.colors.bg;
        ctx.fillRect(0, 0, w, h);

        const padding = 30;
        const cellSize = Math.min((w - padding * 2) / this.gridSize, (h - padding * 2) / this.gridSize);
        const offsetX = (w - cellSize * this.gridSize) / 2;
        const offsetY = (h - cellSize * this.gridSize) / 2;

        ctx.font = `${cellSize * 0.7}px "Share Tech Mono", monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        for (let y = 0; y < this.gridSize; y++) {
            for (let x = 0; x < this.gridSize; x++) {
                const cx = offsetX + x * cellSize + cellSize / 2;
                const cy = offsetY + y * cellSize + cellSize / 2;
                const isTarget = this.grid[y][x] === this.targetSymbol;
                const isFound = this.found.some(p => p.x === x && p.y === y);

                if (isFound) {
                    ctx.fillStyle = this.colors.green;
                } else if (this.phase === 'detect' && isTarget) {
                    // In detect phase, targets are visible but not highlighted
                    ctx.fillStyle = this.colors.text;
                } else {
                    ctx.fillStyle = this.colors.dim;
                }

                ctx.fillText(this.grid[y][x], cx, cy);
            }
        }

        // Phase indicator
        ctx.fillStyle = this.phase === 'detect' ? this.colors.gold : this.colors.cyan;
        ctx.font = '14px "Orbitron", monospace';
        ctx.textAlign = 'left';
        ctx.fillText(this.phase === 'detect' ? 'DETECT PHASE' : 'EXPLOIT PHASE', 20, 25);
    }

    handleClick(mx, my) {
        const w = this.canvas.width;
        const h = this.canvas.height;

        const padding = 30;
        const cellSize = Math.min((w - padding * 2) / this.gridSize, (h - padding * 2) / this.gridSize);
        const offsetX = (w - cellSize * this.gridSize) / 2;
        const offsetY = (h - cellSize * this.gridSize) / 2;

        const x = Math.floor((mx - offsetX) / cellSize);
        const y = Math.floor((my - offsetY) / cellSize);

        if (x < 0 || x >= this.gridSize || y < 0 || y >= this.gridSize) return;

        const isTarget = this.grid[y][x] === this.targetSymbol;

        if (this.phase === 'detect') {
            if (isTarget) {
                // Found the anomaly! Enter exploit phase
                this.phase = 'exploit';
                this.found.push({ x, y });
                this.updateStatus();
                this.draw();
            }
        } else {
            // Exploit phase - find all targets
            if (isTarget && !this.found.some(p => p.x === x && p.y === y)) {
                this.found.push({ x, y });
                this.draw();

                if (this.found.length === this.targetCount) {
                    clearInterval(this.timer);
                    setTimeout(() => this.system.gameWon(), 300);
                }
            }
            this.updateStatus();
        }
    }
}

// Initialize when DOM ready
document.addEventListener('DOMContentLoaded', () => {
    ProbeSystem.init();
});
