/* DYSECTOR Shop Prototype - 2D Shop Map */

const ShopMap = {
    canvas: null,
    ctx: null,

    // Grid settings
    tileSize: 24,
    gridWidth: 20,
    gridHeight: 14,

    // Colors - cyberpunk bit style
    colors: {
        void: '#0a0a0a',           // Outside shop
        wall: '#1a1a2e',           // Walls
        floor: '#16213e',          // Walkable floor
        serviceCounter: '#00fff5', // Cyan - service counter
        posCounter: '#9b59b6',     // Purple - POS/sales counter
        table: '#e94560',          // Magenta/pink - display tables
        workbench: '#f0c929',      // Yellow - workbench area
        door: '#27ae60',           // Green - entrance
        shelf: '#3498db',          // Blue - shelves
        player: '#ffffff',         // White - you
    },

    // Use ShopGenerator tile types
    get TILES() {
        return ShopGenerator.TILES;
    },

    // Shop layout map
    map: null,
    shopSeed: null,
    keyPositions: null,

    // Entities
    player: { x: 9, y: 5, location: 'service' },  // 'service' or 'pos'

    // Interaction
    selectedNPC: null,
    hoveredTile: null,

    init() {
        this.createCanvas();

        // Check for saved game or generate new
        if (SaveSystem.hasSave()) {
            const save = SaveSystem.load();
            if (save && save.shop.layout) {
                this.map = save.shop.layout;
                this.shopSeed = save.shop.seed;
                this.gridWidth = save.shop.width;
                this.gridHeight = save.shop.height;
            } else {
                this.generateNewShop();
            }
        } else {
            this.generateNewShop();
        }

        this.keyPositions = ShopGenerator.getKeyPositions(this.map, this.gridWidth, this.gridHeight);
        this.positionPlayer();

        // Initialize NPC system
        NPCSystem.init(this, this.keyPositions);

        this.bindEvents();
        this.startRenderLoop();
    },

    generateNewShop(seed = null) {
        this.shopSeed = seed || Date.now();
        this.map = ShopGenerator.generate(this.shopSeed, this.gridWidth, this.gridHeight);
        this.keyPositions = ShopGenerator.getKeyPositions(this.map, this.gridWidth, this.gridHeight);
    },

    positionPlayer() {
        // Put player at service counter by default
        if (this.keyPositions.serviceWaitSpots && this.keyPositions.serviceWaitSpots.length > 0) {
            // Find a spot behind the counter
            const counterTiles = this.keyPositions.serviceCounter;
            if (counterTiles.length > 0) {
                const counterY = counterTiles[0].y;
                this.player.x = counterTiles[Math.floor(counterTiles.length / 2)].x;
                this.player.y = counterY - 1;  // Behind counter
                this.player.location = 'service';
            }
        }
    },

    createCanvas() {
        const container = document.getElementById('shop-map-container');
        if (!container) return;

        this.canvas = document.createElement('canvas');
        this.canvas.id = 'shop-map';
        this.canvas.width = this.gridWidth * this.tileSize;
        this.canvas.height = this.gridHeight * this.tileSize;
        container.appendChild(this.canvas);

        this.ctx = this.canvas.getContext('2d');
    },

    bindEvents() {
        if (!this.canvas) return;

        this.canvas.addEventListener('click', (e) => this.handleClick(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleHover(e));
        this.canvas.addEventListener('mouseleave', () => {
            this.hoveredTile = null;
        });
    },

    getTileAt(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = Math.floor((e.clientX - rect.left) / this.tileSize);
        const y = Math.floor((e.clientY - rect.top) / this.tileSize);
        return { x, y };
    },

    handleClick(e) {
        const tile = this.getTileAt(e);

        // Check if clicked on an NPC
        const npc = NPCSystem.getNPCAt(tile.x, tile.y);
        if (npc) {
            this.selectedNPC = npc;
            this.showNPCInfo(npc);
            return;
        }

        // Check if clicked on player
        if (tile.x === this.player.x && tile.y === this.player.y) {
            this.showPlayerInfo();
            return;
        }

        // Check tile type
        const tileType = this.map[tile.y]?.[tile.x];
        if (tileType !== undefined) {
            this.showTileInfo(tileType, tile.x, tile.y);
        }
    },

    showNPCInfo(npc) {
        const panel = document.getElementById('map-info-panel');
        if (!panel) return;

        const isWaiting = npc.state === NPCSystem.STATE.WAITING;
        const statusText = {
            'entering': 'Entering shop...',
            'browsing': 'Browsing',
            'toCounter': 'Heading to counter...',
            'waiting': 'Waiting at counter!',
            'beingServed': 'Being served',
            'leaving': 'Leaving...'
        }[npc.state] || npc.state;

        const intentText = {
            'service': 'Needs repair service',
            'buy': 'Wants to buy something',
            'browse': 'Just browsing'
        }[npc.intent] || '';

        panel.innerHTML = `
            <div class="map-info-customer">
                <div class="customer-info-left">
                    <div class="customer-info-name">${npc.data.name}</div>
                    <div class="customer-info-device">${intentText}</div>
                    <div class="customer-info-status">${statusText}</div>
                </div>
                <div class="customer-info-right">
                    <button class="interact-btn" ${isWaiting ? '' : 'disabled'} onclick="ShopMap.interactWithNPC('${npc.id}')">
                        ${isWaiting ? 'SERVE' : 'BUSY'}
                    </button>
                </div>
            </div>
        `;
    },

    showPlayerInfo() {
        const panel = document.getElementById('map-info-panel');
        if (!panel) return;

        panel.innerHTML = `
            <div class="map-info-tile">
                <div class="tile-icon" style="background:#ffffff;color:#000;">P</div>
                <div class="tile-info-text">
                    <div class="tile-info-name">YOU</div>
                    <div class="tile-info-desc">Standing at the counter, ready to serve.</div>
                </div>
            </div>
        `;
    },

    showTileInfo(tileType, x, y) {
        const panel = document.getElementById('map-info-panel');
        if (!panel) return;

        const T = this.TILES;
        let info = { name: '', desc: '', color: '#333' };

        switch (tileType) {
            case T.SERVICE_COUNTER:
                info = { name: 'SERVICE COUNTER', desc: 'Accept repair jobs here.', color: this.colors.serviceCounter };
                break;
            case T.POS_COUNTER:
                info = { name: 'SALES COUNTER', desc: 'Sell items to customers here.', color: this.colors.posCounter };
                break;
            case T.TABLE:
                info = { name: 'DISPLAY TABLE', desc: 'Customers browse here before approaching.', color: this.colors.table };
                break;
            case T.WORKBENCH:
                info = { name: 'WORKBENCH', desc: 'Repair devices here. Requires diving.', color: this.colors.workbench };
                break;
            case T.DOOR:
                info = { name: 'ENTRANCE', desc: 'Customers enter and exit here.', color: this.colors.door };
                break;
            case T.SHELF:
                info = { name: 'SHELF', desc: 'Display items for sale.', color: this.colors.shelf };
                break;
            case T.WALL:
                info = { name: 'WALL', desc: '', color: this.colors.wall };
                break;
            case T.FLOOR:
            case T.BACKFLOOR:
                info = { name: 'FLOOR', desc: 'Walkable area.', color: this.colors.floor };
                break;
            default:
                this.clearInfoPanel();
                return;
        }

        panel.innerHTML = `
            <div class="map-info-tile">
                <div class="tile-icon" style="background:${info.color};"></div>
                <div class="tile-info-text">
                    <div class="tile-info-name">${info.name}</div>
                    <div class="tile-info-desc">${info.desc}</div>
                </div>
            </div>
        `;
    },

    clearInfoPanel() {
        const panel = document.getElementById('map-info-panel');
        if (!panel) return;
        panel.innerHTML = `
            <div class="map-info-default">
                <span class="info-hint">Click on map elements for details</span>
            </div>
        `;
    },

    interactWithNPC(npcId) {
        const npc = NPCSystem.npcs.find(n => n.id == npcId);
        if (npc && npc.state === NPCSystem.STATE.WAITING) {
            this.selectedNPC = npc;
            NPCSystem.serveNPC(npcId);

            // Trigger dialogue based on intent
            if (typeof Shop !== 'undefined') {
                if (npc.intent === NPCSystem.INTENT.SERVICE) {
                    Shop.triggerServiceDialogue(npc);
                } else if (npc.intent === NPCSystem.INTENT.BUY) {
                    Shop.triggerSaleDialogue(npc);
                }
            }
        }
    },

    handleHover(e) {
        this.hoveredTile = this.getTileAt(e);
    },

    // Render
    render() {
        if (!this.ctx) return;

        const ctx = this.ctx;
        const T = this.TILES;

        // Clear
        ctx.fillStyle = this.colors.void;
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw tiles
        for (let y = 0; y < this.gridHeight; y++) {
            for (let x = 0; x < this.gridWidth; x++) {
                const tile = this.map[y][x];
                let color = this.colors.void;

                switch (tile) {
                    case T.WALL:
                        color = this.colors.wall;
                        break;
                    case T.FLOOR:
                    case T.BACKFLOOR:
                        color = this.colors.floor;
                        break;
                    case T.SERVICE_COUNTER:
                        color = this.colors.serviceCounter;
                        break;
                    case T.POS_COUNTER:
                        color = this.colors.posCounter;
                        break;
                    case T.TABLE:
                        color = this.colors.table;
                        break;
                    case T.WORKBENCH:
                        color = this.colors.workbench;
                        break;
                    case T.DOOR:
                        color = this.colors.door;
                        break;
                    case T.SHELF:
                        color = this.colors.shelf;
                        break;
                }

                ctx.fillStyle = color;
                ctx.fillRect(
                    x * this.tileSize + 1,
                    y * this.tileSize + 1,
                    this.tileSize - 2,
                    this.tileSize - 2
                );
            }
        }

        // Draw hover highlight
        if (this.hoveredTile) {
            const { x, y } = this.hoveredTile;
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.lineWidth = 2;
            ctx.strokeRect(
                x * this.tileSize,
                y * this.tileSize,
                this.tileSize,
                this.tileSize
            );
        }

        // Draw NPCs from NPC system
        for (const npc of NPCSystem.npcs) {
            const isWaiting = npc.state === NPCSystem.STATE.WAITING;
            const isSelected = this.selectedNPC && this.selectedNPC.id === npc.id;

            // NPC color based on intent/state
            ctx.fillStyle = npc.color;
            ctx.fillRect(
                npc.x * this.tileSize + 3,
                npc.y * this.tileSize + 3,
                this.tileSize - 6,
                this.tileSize - 6
            );

            // Selection indicator
            if (isSelected) {
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 2;
                ctx.strokeRect(
                    npc.x * this.tileSize + 2,
                    npc.y * this.tileSize + 2,
                    this.tileSize - 4,
                    this.tileSize - 4
                );
            }

            // Waiting indicator (!)
            if (isWaiting) {
                ctx.fillStyle = '#ffffff';
                ctx.font = 'bold 12px monospace';
                ctx.textAlign = 'center';
                ctx.fillText('!', npc.x * this.tileSize + this.tileSize / 2, npc.y * this.tileSize - 2);
            }

            // Intent indicator (small letter)
            ctx.fillStyle = '#000';
            ctx.font = 'bold 9px monospace';
            ctx.textAlign = 'center';
            const intentLetter = npc.intent === NPCSystem.INTENT.SERVICE ? 'S' :
                                 npc.intent === NPCSystem.INTENT.BUY ? 'B' : '?';
            ctx.fillText(intentLetter, npc.x * this.tileSize + this.tileSize / 2, npc.y * this.tileSize + this.tileSize / 2 + 3);
        }

        // Draw player
        ctx.fillStyle = this.colors.player;
        ctx.fillRect(
            this.player.x * this.tileSize + 2,
            this.player.y * this.tileSize + 2,
            this.tileSize - 4,
            this.tileSize - 4
        );

        // Player marker
        ctx.fillStyle = '#000';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('P', this.player.x * this.tileSize + this.tileSize / 2, this.player.y * this.tileSize + this.tileSize / 2 + 3);
    },

    lastTime: 0,

    startRenderLoop() {
        const loop = (time) => {
            const deltaTime = time - this.lastTime;
            this.lastTime = time;

            // Update NPC system
            const isShopOpen = typeof GameState !== 'undefined' && GameState.shopOpen;
            NPCSystem.update(deltaTime, isShopOpen);

            this.render();

            requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
    },

    // Get customer count for UI - now uses NPCSystem
    getCustomerCount() {
        return NPCSystem.getCount();
    },

    getWaitingCount() {
        return NPCSystem.getWaitingCount();
    },

    // Get NPC at tile
    getNPCAt(x, y) {
        return NPCSystem.getNPCAt(x, y);
    },
};

// Initialize when DOM ready
document.addEventListener('DOMContentLoaded', () => {
    ShopMap.init();
});
