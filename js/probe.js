/* DYSECTOR Shop Prototype - Probe Workbench Minigames */

const ProbeSystem = {
    canvas: null,
    ctx: null,
    currentGame: null,
    currentJob: null,  // Job being repaired from calendar
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
        this.renderJobList();
        this.drawIdleScreen();
    },

    renderJobList() {
        const list = document.getElementById('probe-job-list');
        if (!list) return;

        // Get workbench-fixable jobs (needsDive: false) that aren't complete
        const workbenchJobs = GameState.activeJobs.filter(job =>
            !job.problem?.needsDive && job.status !== 'complete'
        );

        if (workbenchJobs.length === 0) {
            list.innerHTML = '<div class="probe-empty">No pending workbench repairs.<br>Accept jobs from customers or check Calendar.</div>';
            return;
        }

        list.innerHTML = workbenchJobs.map((job, index) => {
            const daysLeft = job.deadline - GameState.currentDay;
            let deadlineClass = '';
            let deadlineText = '';

            if (daysLeft <= 0) {
                deadlineClass = 'urgent';
                deadlineText = 'OVERDUE';
            } else if (daysLeft === 1) {
                deadlineClass = 'soon';
                deadlineText = 'Tomorrow';
            } else {
                deadlineText = `${daysLeft} days`;
            }

            const isActive = this.currentJob && this.currentJob.id === job.id;

            return `
                <div class="probe-job-item ${isActive ? 'active' : ''}" data-job-index="${index}">
                    <div class="probe-job-device">${job.device?.fullName || 'Device'}</div>
                    <div class="probe-job-problem">${job.problem?.name || 'Unknown Issue'}</div>
                    <div class="probe-job-meta">
                        <span class="probe-job-deadline ${deadlineClass}">${deadlineText}</span>
                        <span class="probe-job-price">$${job.agreedPrice || job.repairPrice || 0}</span>
                    </div>
                </div>
            `;
        }).join('');

        // Bind click events
        list.querySelectorAll('.probe-job-item').forEach((item, index) => {
            item.addEventListener('click', () => {
                const job = workbenchJobs[index];
                if (job) {
                    this.selectJob(job);
                }
            });
        });
    },

    selectJob(job) {
        this.currentJob = job;
        this.renderJobList(); // Update active state

        // Pick difficulty based on device grade
        const gradeDifficulty = { 'e': 'easy', 'c': 'easy', 'b': 'medium', 'a': 'hard' };
        this.difficulty = gradeDifficulty[job.device?.grade] || 'easy';

        // Match minigame to problem type for thematic consistency
        // Based on CLI Minigames guide:
        // - Memory Match: Data Recovery (finding/matching files)
        // - Probe Launch: Diagnostic Scan (scanning system)
        // - Hex Pipes: Bypass/Routing (rerouting paths)
        // - Packet Hunt: Hacking/Access (finding anomalies)
        const problemToGame = {
            'slowdown': 'launch',    // Diagnostic scan to find bottleneck
            'cleanup': 'packet',     // Hunt for junk files/bloatware
            'dust': 'pipes',         // Reroute airflow/thermal paths
            'driver': 'memory',      // Find and match correct driver files
            'update': 'pipes',       // Route update packages through system
            'startup': 'launch',     // Scan boot sequence diagnostics
        };

        const problemId = job.problem?.id;
        let selectedGame = problemToGame[problemId];

        // Fallback to random if problem not mapped
        if (!selectedGame) {
            const games = ['memory', 'launch', 'pipes', 'packet'];
            selectedGame = games[Math.floor(Math.random() * games.length)];
        }

        this.setStatus(`REPAIRING: ${job.device?.fullName} | ${job.problem?.name}`);
        this.startGame(selectedGame);
    },

    bindEvents() {
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

        // If repairing a job, complete it
        if (this.currentJob) {
            this.completeJobRepair();
        } else {
            this.setStatus('SUCCESS! Click a game to play again.');
        }
        this.currentGame = null;
    },

    completeJobRepair() {
        const job = this.currentJob;
        if (!job) return;

        // Mark job as complete
        job.status = 'complete';
        if (job.device?.problems) {
            job.device.problems.forEach(p => p.fixed = true);
        }

        // Award some bits for workbench repair (less than dive)
        const deviceGrade = job.device?.grade || 'e';
        const bitsByGrade = { 'e': 30, 'c': 75, 'b': 150, 'a': 300 };
        const bitsEarned = bitsByGrade[deviceGrade] || 30;
        GameState.bits += bitsEarned;

        // Show completion popup
        this.showRepairComplete(job, bitsEarned);

        // Clear current job
        this.currentJob = null;
    },

    showRepairComplete(job, bitsEarned) {
        const popupHtml = `
            <div style="background: var(--bg-dark); border: 2px solid var(--green); padding: 20px; border-radius: 8px; max-width: 350px; margin: 20px auto; font-family: var(--font-mono);">
                <h2 style="color: var(--green); margin: 0 0 15px 0; text-align: center;">REPAIR COMPLETE</h2>

                <div style="text-align: center; margin-bottom: 15px;">
                    <div style="font-size: 48px; margin-bottom: 10px;">✓</div>
                    <div style="color: var(--text);">${job.device?.fullName || 'Device'}</div>
                    <div style="color: var(--text-dim); font-size: 12px;">Owner: ${job.customer}</div>
                </div>

                <div style="background: var(--bg-light); padding: 15px; border-radius: 4px; margin-bottom: 15px;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                        <span style="color: var(--text-dim);">Bits Earned:</span>
                        <span style="color: var(--cyan);">+${bitsEarned} bits</span>
                    </div>
                    <div style="display: flex; justify-content: space-between;">
                        <span style="color: var(--text-dim);">Status:</span>
                        <span style="color: var(--green);">Ready for pickup</span>
                    </div>
                </div>

                <div style="color: var(--text-dim); text-align: center; font-size: 11px; margin-bottom: 15px;">
                    Customer will collect on next open day
                </div>

                <button id="repair-done-btn" style="width: 100%; padding: 10px; background: var(--green); border: none; color: var(--bg-dark); font-weight: bold; cursor: pointer; border-radius: 4px;">
                    CONTINUE
                </button>
            </div>
        `;

        const overlay = document.createElement('div');
        overlay.id = 'repair-complete-overlay';
        overlay.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 9999;';
        overlay.innerHTML = popupHtml;
        document.body.appendChild(overlay);

        document.getElementById('repair-done-btn').addEventListener('click', () => {
            overlay.remove();
            this.setStatus('Select a job to repair');
            this.renderJobList();
            this.drawIdleScreen();

            // Update displays
            if (typeof updateDisplays === 'function') updateDisplays();
            if (typeof Calendar !== 'undefined') Calendar.render();
        });
    },

    gameLost() {
        this.stats.losses++;
        this.stats.streak = 0;
        this.updateStats();

        // If repairing a job, show failure message but keep job active
        if (this.currentJob) {
            this.setStatus(`FAILED - ${this.currentJob.device?.fullName || 'Device'} still needs repair. Try again!`);
        } else {
            this.setStatus('FAILED. Click a game to try again.');
        }
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
        ctx.fillText('PROBE WORKBENCH', w / 2, h / 2 - 40);

        // Check for pending workbench jobs
        const workbenchJobs = GameState.activeJobs.filter(job =>
            !job.problem?.needsDive && job.status !== 'complete'
        );

        if (workbenchJobs.length > 0) {
            ctx.fillStyle = this.colors.green;
            ctx.font = '16px "Share Tech Mono", monospace';
            ctx.fillText(`${workbenchJobs.length} repair${workbenchJobs.length > 1 ? 's' : ''} pending`, w / 2, h / 2 + 10);

            ctx.fillStyle = this.colors.text;
            ctx.font = '14px "Share Tech Mono", monospace';
            ctx.fillText('Select a job from the sidebar', w / 2, h / 2 + 40);
            ctx.fillText('to begin diagnostics', w / 2, h / 2 + 60);
        } else {
            ctx.fillStyle = this.colors.dim;
            ctx.font = '14px "Share Tech Mono", monospace';
            ctx.fillText('No pending repairs', w / 2, h / 2 + 10);

            ctx.fillStyle = this.colors.text;
            ctx.font = '12px "Share Tech Mono", monospace';
            ctx.fillText('Accept workbench jobs from customers', w / 2, h / 2 + 40);
            ctx.fillText('(Slowdown, Cleanup, Overheating, Drivers, Updates, Slow Boot)', w / 2, h / 2 + 60);
        }
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
        this.previewPhase = false;

        // CLI symbols for matching
        this.symbols = ['@', '#', '$', '%', '&', '*', '+', '=', '!', '?', '^', '~'];
    }

    init(difficulty) {
        // Grid size based on difficulty
        const sizes = { easy: 4, medium: 5, hard: 6 };
        const previewTimes = { easy: 3000, medium: 2500, hard: 2000 };
        const size = sizes[difficulty] || 4;

        this.gridSize = size;
        this.totalPairs = (size * size) / 2;
        this.pairs = 0;
        this.moves = 0;
        this.firstPick = null;
        this.locked = true; // Start locked during preview
        this.previewPhase = true;

        // Generate pairs
        const symbols = this.symbols.slice(0, this.totalPairs);
        const cards = [...symbols, ...symbols];

        // Shuffle
        for (let i = cards.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [cards[i], cards[j]] = [cards[j], cards[i]];
        }

        // Create grid - all revealed initially for preview
        this.grid = [];
        this.revealed = [];
        this.matched = [];

        for (let y = 0; y < size; y++) {
            this.grid[y] = [];
            this.revealed[y] = [];
            this.matched[y] = [];
            for (let x = 0; x < size; x++) {
                this.grid[y][x] = cards[y * size + x];
                this.revealed[y][x] = true; // Start revealed for preview
                this.matched[y][x] = false;
            }
        }

        this.system.setStatus(`MEMORY MATCH | MEMORIZE! Cards flip in ${previewTimes[difficulty] / 1000}s...`);
        this.draw();

        // After preview time, flip all cards and start game
        setTimeout(() => {
            for (let y = 0; y < size; y++) {
                for (let x = 0; x < size; x++) {
                    this.revealed[y][x] = false;
                }
            }
            this.previewPhase = false;
            this.locked = false;
            this.system.setStatus(`MEMORY MATCH | Pairs: 0/${this.totalPairs} | Moves: 0`);
            this.draw();
        }, previewTimes[difficulty]);
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
// PROBE LAUNCH GAME (Peggle-style with obstacles)
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
        this.breakableWalls = [];
        this.pegs = [];
        this.entryPoints = [];
        this.selectedEntry = 0;
        this.animating = false;
        this.aimAngle = 0;
        this.aiming = false;
    }

    init(difficulty) {
        const probeCount = { easy: 5, medium: 3, hard: 2 };
        const coreSize = { easy: 35, medium: 28, hard: 22 };

        this.probes = probeCount[difficulty];
        this.probe = null;
        this.animating = false;
        this.aiming = false;
        this.aimAngle = 0;

        // Core position (right side, random Y)
        this.core = {
            x: 420,
            y: 150 + Math.random() * 200,
            r: coreSize[difficulty]
        };

        // Entry points on left side
        this.entryPoints = [
            { x: 30, y: 80 },
            { x: 30, y: 250 },
            { x: 30, y: 420 }
        ];
        this.selectedEntry = 1;

        // Generate obstacles based on difficulty
        this.generateObstacles(difficulty);

        this.system.setStatus(`PROBE LAUNCH | Probes: ${this.probes} | Select entry, click to aim, click to fire`);
        this.draw();
    }

    generateObstacles(difficulty) {
        this.walls = [];
        this.breakableWalls = [];
        this.pegs = [];

        const w = this.canvas.width;
        const h = this.canvas.height;

        // Solid walls (bouncy, can't destroy)
        const solidWallCount = { easy: 2, medium: 4, hard: 6 };
        for (let i = 0; i < solidWallCount[difficulty]; i++) {
            const wall = {
                x: 80 + Math.random() * 280,
                y: 40 + Math.random() * 400,
                w: 20 + Math.random() * 50,
                h: 15 + Math.random() * 30,
                type: 'solid'
            };
            // Don't block core area
            if (Math.abs(wall.x - this.core.x) > 60 || Math.abs(wall.y - this.core.y) > 60) {
                this.walls.push(wall);
            }
        }

        // Breakable walls (take 1-3 hits based on difficulty)
        const breakableCount = { easy: 3, medium: 5, hard: 8 };
        for (let i = 0; i < breakableCount[difficulty]; i++) {
            const wall = {
                x: 100 + Math.random() * 260,
                y: 60 + Math.random() * 360,
                w: 25 + Math.random() * 40,
                h: 12 + Math.random() * 20,
                hp: difficulty === 'easy' ? 1 : difficulty === 'medium' ? 2 : 3,
                maxHp: difficulty === 'easy' ? 1 : difficulty === 'medium' ? 2 : 3
            };
            // Don't block core area or overlap too much
            if (Math.abs(wall.x - this.core.x) > 50 || Math.abs(wall.y - this.core.y) > 50) {
                this.breakableWalls.push(wall);
            }
        }

        // Pegs (circular bumpers, good for bouncing)
        const pegCount = { easy: 5, medium: 8, hard: 12 };
        for (let i = 0; i < pegCount[difficulty]; i++) {
            const peg = {
                x: 80 + Math.random() * 300,
                y: 60 + Math.random() * 380,
                r: 8 + Math.random() * 6
            };
            // Don't place too close to core or entry
            const distToCore = Math.sqrt((peg.x - this.core.x) ** 2 + (peg.y - this.core.y) ** 2);
            if (distToCore > 60 && peg.x > 60) {
                this.pegs.push(peg);
            }
        }

        // On hard, add some blocking walls near the core
        if (difficulty === 'hard') {
            // Create a partial shield around core
            const shieldAngles = [Math.PI * 0.7, Math.PI * 1.3];
            for (const angle of shieldAngles) {
                this.walls.push({
                    x: this.core.x + Math.cos(angle) * 60 - 20,
                    y: this.core.y + Math.sin(angle) * 60 - 10,
                    w: 40,
                    h: 20,
                    type: 'solid'
                });
            }
        }
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

        // Draw pegs
        for (const peg of this.pegs) {
            ctx.beginPath();
            ctx.arc(peg.x, peg.y, peg.r, 0, Math.PI * 2);
            ctx.fillStyle = '#1a1a1a';
            ctx.fill();
            ctx.strokeStyle = this.colors.dim;
            ctx.lineWidth = 2;
            ctx.stroke();
        }

        // Draw solid walls
        for (const wall of this.walls) {
            ctx.fillStyle = '#2a2a2a';
            ctx.fillRect(wall.x, wall.y, wall.w, wall.h);
            ctx.strokeStyle = this.colors.dim;
            ctx.lineWidth = 2;
            ctx.strokeRect(wall.x, wall.y, wall.w, wall.h);
        }

        // Draw breakable walls
        for (const wall of this.breakableWalls) {
            const hpRatio = wall.hp / wall.maxHp;
            const alpha = 0.3 + hpRatio * 0.7;
            ctx.fillStyle = `rgba(231, 76, 60, ${alpha})`;
            ctx.fillRect(wall.x, wall.y, wall.w, wall.h);
            ctx.strokeStyle = this.colors.red;
            ctx.lineWidth = 1;
            ctx.strokeRect(wall.x, wall.y, wall.w, wall.h);

            // HP indicator
            if (wall.maxHp > 1) {
                ctx.fillStyle = this.colors.text;
                ctx.font = '10px "Share Tech Mono", monospace';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(wall.hp.toString(), wall.x + wall.w / 2, wall.y + wall.h / 2);
            }
        }

        // Draw core
        ctx.beginPath();
        ctx.arc(this.core.x, this.core.y, this.core.r, 0, Math.PI * 2);
        ctx.fillStyle = '#1a0a1a';
        ctx.fill();
        ctx.strokeStyle = this.colors.purple;
        ctx.lineWidth = 3;
        ctx.stroke();

        // Core glow effect
        ctx.beginPath();
        ctx.arc(this.core.x, this.core.y, this.core.r + 5, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(155, 89, 182, 0.3)`;
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = this.colors.purple;
        ctx.font = '11px "Share Tech Mono", monospace';
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
            ctx.font = '12px "Share Tech Mono", monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('>', ep.x, ep.y);
        }

        // Draw aim line if aiming
        if (this.aiming && !this.animating) {
            const ep = this.entryPoints[this.selectedEntry];
            ctx.strokeStyle = `rgba(78, 205, 196, 0.5)`;
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.moveTo(ep.x, ep.y);
            ctx.lineTo(ep.x + Math.cos(this.aimAngle) * 100, ep.y + Math.sin(this.aimAngle) * 100);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        // Draw probe if active
        if (this.probe) {
            ctx.beginPath();
            ctx.arc(this.probe.x, this.probe.y, 8, 0, Math.PI * 2);
            ctx.fillStyle = this.colors.cyan;
            ctx.fill();

            // Trail effect
            ctx.beginPath();
            ctx.arc(this.probe.x - this.probe.vx * 2, this.probe.y - this.probe.vy * 2, 5, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(78, 205, 196, 0.3)`;
            ctx.fill();
        }

        // UI
        ctx.fillStyle = this.colors.text;
        ctx.font = '12px "Share Tech Mono", monospace';
        ctx.textAlign = 'left';
        ctx.fillText(`PROBES: ${this.probes}`, 20, 30);

        // Legend
        ctx.fillStyle = this.colors.dim;
        ctx.font = '10px "Share Tech Mono", monospace';
        ctx.textAlign = 'right';
        ctx.fillText('Gray=Solid  Red=Breakable', w - 20, 30);
    }

    handleClick(mx, my) {
        if (this.animating) return;

        // Check if clicked an entry point
        for (let i = 0; i < this.entryPoints.length; i++) {
            const ep = this.entryPoints[i];
            const dist = Math.sqrt((mx - ep.x) ** 2 + (my - ep.y) ** 2);
            if (dist < 20) {
                this.selectedEntry = i;
                this.aiming = false;
                this.draw();
                return;
            }
        }

        // If not aiming, start aiming
        if (!this.aiming && this.probes > 0) {
            this.aiming = true;
            const ep = this.entryPoints[this.selectedEntry];
            this.aimAngle = Math.atan2(my - ep.y, mx - ep.x);
            this.draw();
            return;
        }

        // If aiming, fire probe
        if (this.aiming && this.probes > 0 && !this.probe) {
            const ep = this.entryPoints[this.selectedEntry];
            this.aimAngle = Math.atan2(my - ep.y, mx - ep.x);

            this.probes--;
            this.probe = {
                x: ep.x,
                y: ep.y,
                vx: Math.cos(this.aimAngle) * 6,
                vy: Math.sin(this.aimAngle) * 6
            };
            this.aiming = false;
            this.animating = true;
            this.animate();
        }
    }

    animate() {
        if (!this.probe) return;

        // Move probe
        this.probe.x += this.probe.vx;
        this.probe.y += this.probe.vy;

        // Slight gravity
        this.probe.vy += 0.05;

        // Bounce off top/bottom/left walls
        if (this.probe.y < 20) {
            this.probe.vy = Math.abs(this.probe.vy) * 0.9;
            this.probe.y = 20;
        }
        if (this.probe.y > 480) {
            this.probe.vy = -Math.abs(this.probe.vy) * 0.9;
            this.probe.y = 480;
        }
        if (this.probe.x < 20) {
            this.probe.vx = Math.abs(this.probe.vx) * 0.9;
            this.probe.x = 20;
        }

        // Bounce off pegs
        for (const peg of this.pegs) {
            const dist = Math.sqrt((this.probe.x - peg.x) ** 2 + (this.probe.y - peg.y) ** 2);
            if (dist < peg.r + 8) {
                // Reflect velocity
                const nx = (this.probe.x - peg.x) / dist;
                const ny = (this.probe.y - peg.y) / dist;
                const dot = this.probe.vx * nx + this.probe.vy * ny;
                this.probe.vx = (this.probe.vx - 2 * dot * nx) * 0.95;
                this.probe.vy = (this.probe.vy - 2 * dot * ny) * 0.95;

                // Push out of peg
                this.probe.x = peg.x + nx * (peg.r + 9);
                this.probe.y = peg.y + ny * (peg.r + 9);
            }
        }

        // Bounce off solid walls
        for (const wall of this.walls) {
            if (this.probe.x > wall.x - 8 && this.probe.x < wall.x + wall.w + 8 &&
                this.probe.y > wall.y - 8 && this.probe.y < wall.y + wall.h + 8) {

                // Determine which side hit
                const overlapLeft = this.probe.x - (wall.x - 8);
                const overlapRight = (wall.x + wall.w + 8) - this.probe.x;
                const overlapTop = this.probe.y - (wall.y - 8);
                const overlapBottom = (wall.y + wall.h + 8) - this.probe.y;

                const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);

                if (minOverlap === overlapLeft || minOverlap === overlapRight) {
                    this.probe.vx *= -0.85;
                    this.probe.x += this.probe.vx > 0 ? 5 : -5;
                } else {
                    this.probe.vy *= -0.85;
                    this.probe.y += this.probe.vy > 0 ? 5 : -5;
                }
            }
        }

        // Hit breakable walls
        for (let i = this.breakableWalls.length - 1; i >= 0; i--) {
            const wall = this.breakableWalls[i];
            if (this.probe.x > wall.x - 8 && this.probe.x < wall.x + wall.w + 8 &&
                this.probe.y > wall.y - 8 && this.probe.y < wall.y + wall.h + 8) {

                wall.hp--;
                if (wall.hp <= 0) {
                    this.breakableWalls.splice(i, 1);
                }

                // Bounce (less energy loss than solid)
                const overlapLeft = this.probe.x - (wall.x - 8);
                const overlapRight = (wall.x + wall.w + 8) - this.probe.x;
                const overlapTop = this.probe.y - (wall.y - 8);
                const overlapBottom = (wall.y + wall.h + 8) - this.probe.y;

                const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);

                if (minOverlap === overlapLeft || minOverlap === overlapRight) {
                    this.probe.vx *= -0.9;
                    this.probe.x += this.probe.vx > 0 ? 5 : -5;
                } else {
                    this.probe.vy *= -0.9;
                    this.probe.y += this.probe.vy > 0 ? 5 : -5;
                }
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

        // Check out of bounds (right side only loses probe)
        if (this.probe.x > 500) {
            this.probe = null;
            this.animating = false;
            this.system.setStatus(`PROBE LAUNCH | Probes: ${this.probes} | Probe lost!`);

            if (this.probes === 0) {
                setTimeout(() => this.system.gameLost(), 500);
            }
            this.draw();
            return;
        }

        // If probe is moving very slowly, end turn
        const speed = Math.sqrt(this.probe.vx ** 2 + this.probe.vy ** 2);
        if (speed < 0.5) {
            this.probe = null;
            this.animating = false;
            this.system.setStatus(`PROBE LAUNCH | Probes: ${this.probes} | Probe stopped`);

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
        this.connectBtn = { x: 0, y: 0, w: 120, h: 40 };
        this.attempts = 0;
        this.maxAttempts = 3;
    }

    init(difficulty) {
        const sizes = { easy: { w: 4, h: 3 }, medium: { w: 5, h: 4 }, hard: { w: 6, h: 5 } };
        const attempts = { easy: 10, medium: 6, hard: 4 };
        const size = sizes[difficulty];

        this.gridW = size.w;
        this.gridH = size.h;
        this.attempts = 0;
        this.maxAttempts = attempts[difficulty];

        // Randomize start and end positions on opposite sides
        this.startPos = { x: 0, y: Math.floor(Math.random() * this.gridH) };
        this.endPos = { x: this.gridW - 1, y: Math.floor(Math.random() * this.gridH) };

        // Generate a solvable puzzle
        this.generateSolvablePuzzle();

        this.system.setStatus(`HEX PIPES | Click tiles to rotate | Connect I/O to END (${this.maxAttempts} attempts)`);
        this.draw();
    }

    generateSolvablePuzzle() {
        // Initialize empty grid
        this.grid = [];
        for (let y = 0; y < this.gridH; y++) {
            this.grid[y] = [];
            for (let x = 0; x < this.gridW; x++) {
                this.grid[y][x] = { type: 0, rotation: 0, onPath: false };
            }
        }

        // Generate path using proper pathfinding
        const path = this.generatePath();
        this.solutionPath = path;

        // Place correct pipes along the path
        for (let i = 0; i < path.length; i++) {
            const curr = path[i];
            const prev = path[i - 1];
            const next = path[i + 1];

            // Determine which directions this cell needs to connect
            const connections = [];

            if (i === 0) {
                // Start cell needs a left opening (entry from outside)
                connections.push('left');
            }
            if (i === path.length - 1) {
                // End cell needs a right opening (exit to outside)
                connections.push('right');
            }

            // Connection to previous cell
            if (prev) {
                if (prev.x < curr.x) connections.push('left');
                else if (prev.x > curr.x) connections.push('right');
                else if (prev.y < curr.y) connections.push('up');
                else if (prev.y > curr.y) connections.push('down');
            }

            // Connection to next cell
            if (next) {
                if (next.x < curr.x) connections.push('left');
                else if (next.x > curr.x) connections.push('right');
                else if (next.y < curr.y) connections.push('up');
                else if (next.y > curr.y) connections.push('down');
            }

            // Find pipe that matches these connections
            const { type, rotation } = this.findPipeFor(connections);
            this.grid[curr.y][curr.x] = {
                type: type,
                rotation: rotation,
                solutionRotation: rotation,
                onPath: true
            };
        }

        // Fill non-path cells with random pipes
        for (let y = 0; y < this.gridH; y++) {
            for (let x = 0; x < this.gridW; x++) {
                if (!this.grid[y][x].onPath) {
                    this.grid[y][x] = {
                        type: Math.floor(Math.random() * 3),
                        rotation: Math.floor(Math.random() * 4),
                        onPath: false
                    };
                }
            }
        }

        // Scramble all rotations
        for (let y = 0; y < this.gridH; y++) {
            for (let x = 0; x < this.gridW; x++) {
                const scramble = 1 + Math.floor(Math.random() * 3);
                this.grid[y][x].rotation = (this.grid[y][x].rotation + scramble) % 4;
            }
        }
    }

    generatePath() {
        // Use BFS to find a valid path, with some randomness for variety
        const start = this.startPos;
        const end = this.endPos;

        const queue = [[{ ...start }]];
        const visited = new Set();
        visited.add(`${start.x},${start.y}`);

        const directions = [
            { dx: 1, dy: 0 },  // right (preferred)
            { dx: 0, dy: -1 }, // up
            { dx: 0, dy: 1 },  // down
            { dx: -1, dy: 0 }  // left (less preferred)
        ];

        while (queue.length > 0) {
            const path = queue.shift();
            const current = path[path.length - 1];

            if (current.x === end.x && current.y === end.y) {
                return path;
            }

            // Shuffle directions for variety, but bias toward right
            const shuffled = [...directions].sort(() => Math.random() - 0.4);

            for (const { dx, dy } of shuffled) {
                const nx = current.x + dx;
                const ny = current.y + dy;
                const key = `${nx},${ny}`;

                if (nx >= 0 && nx < this.gridW && ny >= 0 && ny < this.gridH && !visited.has(key)) {
                    visited.add(key);
                    queue.push([...path, { x: nx, y: ny }]);
                }
            }
        }

        // Fallback: straight line if BFS fails
        const fallback = [];
        for (let x = start.x; x <= end.x; x++) {
            fallback.push({ x, y: start.y });
        }
        if (start.y !== end.y) {
            const dir = end.y > start.y ? 1 : -1;
            for (let y = start.y + dir; dir > 0 ? y <= end.y : y >= end.y; y += dir) {
                fallback.push({ x: end.x, y });
            }
        }
        return fallback;
    }

    findPipeFor(connections) {
        // Pipe types:
        // 0: straight - connects 2 opposite sides
        // 1: corner/elbow - connects 2 adjacent sides
        // 2: t-junction - connects 3 sides

        const pipeExits = {
            0: ['left', 'right'],      // straight horizontal
            1: ['left', 'up'],         // corner
            2: ['left', 'right', 'up'] // T-junction
        };

        const dirs = ['up', 'right', 'down', 'left'];

        // Try to find exact match first
        for (let type = 0; type < 3; type++) {
            for (let rot = 0; rot < 4; rot++) {
                const exits = pipeExits[type].map(dir => {
                    const idx = dirs.indexOf(dir);
                    return dirs[(idx + rot) % 4];
                });

                // Check exact match
                if (connections.length === exits.length &&
                    connections.every(c => exits.includes(c))) {
                    return { type, rotation: rot };
                }
            }
        }

        // Find pipe that has all needed connections (may have extras)
        for (let type = 2; type >= 0; type--) { // Prefer simpler pipes
            for (let rot = 0; rot < 4; rot++) {
                const exits = pipeExits[type].map(dir => {
                    const idx = dirs.indexOf(dir);
                    return dirs[(idx + rot) % 4];
                });

                if (connections.every(c => exits.includes(c))) {
                    return { type, rotation: rot };
                }
            }
        }

        // Emergency fallback
        return { type: 2, rotation: 0 };
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

        // Draw CONNECT button at bottom
        this.connectBtn.x = w / 2 - 60;
        this.connectBtn.y = h - 55;

        ctx.fillStyle = '#1a1a2a';
        ctx.fillRect(this.connectBtn.x, this.connectBtn.y, this.connectBtn.w, this.connectBtn.h);
        ctx.strokeStyle = this.colors.cyan;
        ctx.lineWidth = 2;
        ctx.strokeRect(this.connectBtn.x, this.connectBtn.y, this.connectBtn.w, this.connectBtn.h);

        ctx.fillStyle = this.colors.cyan;
        ctx.font = '14px "Orbitron", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('CONNECT', w / 2, this.connectBtn.y + 26);

        // Attempts remaining
        ctx.fillStyle = this.colors.dim;
        ctx.font = '11px "Share Tech Mono", monospace';
        ctx.fillText(`Attempts: ${this.maxAttempts - this.attempts}/${this.maxAttempts}`, w / 2, h - 10);
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

    // Check if there's a valid connection from start to end
    checkConnection() {
        const visited = new Set();
        this.connectedCells = new Set();  // Track which cells are part of the path
        const result = this.tracePath(this.startPos.x, this.startPos.y, 'left', visited);
        return result;
    }

    tracePath(x, y, entryDir, visited) {
        // entryDir = the direction we ENTERED this cell from (e.g., 'left' means we came from the left)

        if (x < 0 || x >= this.gridW || y < 0 || y >= this.gridH) return false;

        const key = `${x},${y}`;
        if (visited.has(key)) return false;

        const cell = this.grid[y][x];
        const exits = this.getExits(cell.type, cell.rotation);

        // Check if this cell has an opening facing the direction we came from
        // If we entered from 'left', the cell needs a 'left' exit to receive us
        if (!exits.includes(entryDir)) {
            return false;  // Cell doesn't have an opening where we're trying to enter
        }

        // We successfully entered this cell
        visited.add(key);
        this.connectedCells.add(key);

        // Check if we reached the end
        if (x === this.endPos.x && y === this.endPos.y) {
            // Make sure end cell has a 'right' exit (the exit point)
            return exits.includes('right');
        }

        // Try all other exits (not the one we came from)
        for (const exit of exits) {
            if (exit === entryDir) continue;  // Don't go back the way we came

            let nx = x, ny = y, nextEntry = '';
            if (exit === 'left') { nx--; nextEntry = 'right'; }  // Moving left means we enter next cell from right
            if (exit === 'right') { nx++; nextEntry = 'left'; }
            if (exit === 'up') { ny--; nextEntry = 'down'; }
            if (exit === 'down') { ny++; nextEntry = 'up'; }

            if (this.tracePath(nx, ny, nextEntry, visited)) return true;
        }

        // Dead end - remove from connected
        this.connectedCells.delete(key);
        return false;
    }

    getExits(type, rotation) {
        const baseExits = {
            0: ['left', 'right'],
            1: ['left', 'up'],
            2: ['left', 'right', 'up']
        };

        const exits = baseExits[type] || [];
        const dirs = ['up', 'right', 'down', 'left'];
        const rotated = exits.map(dir => {
            const idx = dirs.indexOf(dir);
            return dirs[(idx + rotation) % 4];
        });

        return rotated;
    }

    isOnPath(x, y) {
        return this.connectedCells && this.connectedCells.has(`${x},${y}`);
    }

    handleClick(mx, my) {
        const w = this.canvas.width;
        const h = this.canvas.height;

        // Check if clicked CONNECT button
        if (mx >= this.connectBtn.x && mx <= this.connectBtn.x + this.connectBtn.w &&
            my >= this.connectBtn.y && my <= this.connectBtn.y + this.connectBtn.h) {
            this.tryConnect();
            return;
        }

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
        }
    }

    tryConnect() {
        this.attempts++;

        if (this.checkConnection()) {
            this.system.setStatus('HEX PIPES | CONNECTION ESTABLISHED!');
            setTimeout(() => this.system.gameWon(), 500);
        } else {
            if (this.attempts >= this.maxAttempts) {
                this.system.setStatus('HEX PIPES | NO CONNECTION - OUT OF ATTEMPTS');
                setTimeout(() => this.system.gameLost(), 500);
            } else {
                this.system.setStatus(`HEX PIPES | No connection! ${this.maxAttempts - this.attempts} attempts left`);
                this.draw();
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
        this.lives = 3;
        this.maxLives = 3;
    }

    init(difficulty) {
        const configs = {
            easy: { size: 10, targets: 3, time: 30, lives: 5 },
            medium: { size: 12, targets: 5, time: 25, lives: 3 },
            hard: { size: 15, targets: 7, time: 20, lives: 2 }
        };

        const config = configs[difficulty];
        this.gridSize = config.size;
        this.targetCount = config.targets;
        this.timeLeft = config.time;
        this.lives = config.lives;
        this.maxLives = config.lives;
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
        const livesStr = '♥'.repeat(this.lives) + '♡'.repeat(this.maxLives - this.lives);
        if (this.phase === 'detect') {
            this.system.setStatus(`PACKET HUNT | DETECT | ${livesStr} | Time: ${this.timeLeft}s`);
        } else {
            this.system.setStatus(`PACKET HUNT | Found: ${this.found.length}/${this.targetCount} | ${livesStr} | Time: ${this.timeLeft}s`);
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

        // Lives display
        ctx.font = '16px "Share Tech Mono", monospace';
        ctx.textAlign = 'right';
        let livesX = w - 20;
        for (let i = this.maxLives - 1; i >= 0; i--) {
            ctx.fillStyle = i < this.lives ? this.colors.red : this.colors.dim;
            ctx.fillText('♥', livesX, 25);
            livesX -= 18;
        }
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
        const alreadyFound = this.found.some(p => p.x === x && p.y === y);

        if (this.phase === 'detect') {
            if (isTarget) {
                // Found the anomaly! Enter exploit phase
                this.phase = 'exploit';
                this.found.push({ x, y });
                this.updateStatus();
                this.draw();
            } else {
                // Wrong click in detect phase - lose a life
                this.lives--;
                this.updateStatus();
                this.draw();

                if (this.lives <= 0) {
                    clearInterval(this.timer);
                    this.system.setStatus('PACKET HUNT | OUT OF LIVES');
                    setTimeout(() => this.system.gameLost(), 500);
                }
            }
        } else {
            // Exploit phase - find all targets
            if (isTarget && !alreadyFound) {
                this.found.push({ x, y });
                this.draw();

                if (this.found.length === this.targetCount) {
                    clearInterval(this.timer);
                    setTimeout(() => this.system.gameWon(), 300);
                }
            } else if (!isTarget && !alreadyFound) {
                // Wrong click - lose a life
                this.lives--;
                this.updateStatus();
                this.draw();

                if (this.lives <= 0) {
                    clearInterval(this.timer);
                    this.system.setStatus('PACKET HUNT | OUT OF LIVES');
                    setTimeout(() => this.system.gameLost(), 500);
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
