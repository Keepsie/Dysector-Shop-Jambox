/* DYSECTOR Shop Prototype - 2D Shop Map */

const ShopMap = {
    canvas: null,
    ctx: null,

    // Grid settings
    tileSize: 38,
    gridWidth: 20,
    gridHeight: 14,

    // Colors - cyberpunk bit style
    colors: {
        void: '#0a0a0a',           // Outside shop
        wall: '#1a1a2e',           // Walls
        floor: '#16213e',          // Walkable floor
        backfloor: '#0d1425',      // Darker floor for back room
        serviceCounter: '#3498db', // BLUE - service counter (repairs)
        posCounter: '#9b59b6',     // PURPLE - POS/sales counter
        serviceWait: '#1a3a5c',    // Dark blue tint - service waiting
        posWait: '#3d2a5c',        // Dark purple tint - POS waiting
        table: '#e94560',          // Magenta/pink - display tables
        workbench: '#f39c12',      // Orange - workbench area
        door: '#27ae60',           // Green - entrance
        shelf: '#d4ac0d',          // Light yellow/gold - shelves
        player: '#ffffff',         // White - you
        customer: '#b0b0b0',       // Medium gray - customers/NPCs
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

        // Initialize inventory system with shelves
        if (typeof InventorySystem !== 'undefined') {
            InventorySystem.initShelves(this.map);
            // Give starter inventory if none exists
            if (InventorySystem.backstock.length === 0) {
                InventorySystem.giveStarterInventory();
            }
        }

        this.bindEvents();
        this.startRenderLoop();
    },

    generateNewShop(seed = null) {
        this.shopSeed = seed || Date.now();
        this.map = ShopGenerator.generate(this.shopSeed, this.gridWidth, this.gridHeight);
        this.keyPositions = ShopGenerator.getKeyPositions(this.map, this.gridWidth, this.gridHeight);
    },

    positionPlayer() {
        // Put player behind service counter (towards back room - higher Y)
        const counterTiles = this.keyPositions.serviceCounter;
        if (counterTiles && counterTiles.length > 0) {
            const counterY = counterTiles[0].y;
            this.player.x = counterTiles[Math.floor(counterTiles.length / 2)].x;
            this.player.y = counterY + 1;  // Behind counter (towards back room)
            this.player.location = 'service';
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
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // If register is active, pass click to it
        if (typeof RegisterSystem !== 'undefined' && RegisterSystem.active) {
            RegisterSystem.handleClick(x, y);
            return;
        }

        // If service interface is active, pass click to it
        if (typeof ServiceInterface !== 'undefined' && ServiceInterface.active) {
            ServiceInterface.handleClick(x, y);
            return;
        }

        // If shelf interface is active, pass click to it
        if (typeof ShelfInterface !== 'undefined' && ShelfInterface.active) {
            ShelfInterface.handleClick(x, y);
            return;
        }

        // If display table interface is active, pass click to it
        if (typeof DisplayTableInterface !== 'undefined' && DisplayTableInterface.active) {
            DisplayTableInterface.handleClick(x, y);
            return;
        }

        // Check UI buttons
        if (this.pauseBtn && x >= this.pauseBtn.x && x <= this.pauseBtn.x + this.pauseBtn.width &&
            y >= this.pauseBtn.y && y <= this.pauseBtn.y + this.pauseBtn.height) {
            this.togglePause();
            return;
        }

        if (this.quickStockBtn && x >= this.quickStockBtn.x && x <= this.quickStockBtn.x + this.quickStockBtn.width &&
            y >= this.quickStockBtn.y && y <= this.quickStockBtn.y + this.quickStockBtn.height) {
            this.quickStock();
            return;
        }

        if (this.quickFillBtn && x >= this.quickFillBtn.x && x <= this.quickFillBtn.x + this.quickFillBtn.width &&
            y >= this.quickFillBtn.y && y <= this.quickFillBtn.y + this.quickFillBtn.height) {
            this.quickFillShop();
            return;
        }

        const tile = this.getTileAt(e);

        // Handle furniture placement mode
        if (typeof FurnitureSystem !== 'undefined' && FurnitureSystem.placementMode) {
            if (FurnitureSystem.placeAt(tile.x, tile.y)) {
                this.showTileInfo(this.map[tile.y][tile.x], tile.x, tile.y);
            }
            return;
        }

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
        const isLeaving = npc.state === NPCSystem.STATE.LEAVING;

        const statusText = {
            'entering': 'Entering shop...',
            'browsing': 'Browsing',
            'toCounter': 'Heading to counter...',
            'waiting': 'Waiting at counter!',
            'beingServed': 'Being served',
            'leaving': 'Exiting shop...'
        }[npc.state] || npc.state;

        const intentText = isLeaving ? 'Done shopping' : {
            'service': 'Needs repair service',
            'buy': 'Wants to buy something',
            'browse': 'Just browsing'
        }[npc.intent] || '';

        // Different button states
        let buttonText = 'BUSY';
        let buttonDisabled = true;
        if (isWaiting) {
            buttonText = 'SERVE';
            buttonDisabled = false;
        } else if (isLeaving) {
            buttonText = 'LEAVING';
        }

        panel.innerHTML = `
            <div class="map-info-customer">
                <div class="customer-info-left">
                    <div class="customer-info-name">${npc.data.name}</div>
                    <div class="customer-info-device">${intentText}</div>
                    <div class="customer-info-status">${statusText}</div>
                </div>
                <div class="customer-info-right">
                    <button class="interact-btn" ${buttonDisabled ? 'disabled' : ''} onclick="ShopMap.interactWithNPC('${npc.id}')">
                        ${buttonText}
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
                info = { name: 'SERVICE COUNTER', desc: 'Accept repair jobs here. (BLUE)', color: this.colors.serviceCounter };
                break;
            case T.POS_COUNTER:
                info = { name: 'SALES COUNTER', desc: 'Sell items to customers here. (PURPLE)', color: this.colors.posCounter };
                break;
            case T.SERVICE_WAIT:
                info = { name: 'SERVICE QUEUE', desc: 'Customers wait here for repairs.', color: this.colors.serviceWait };
                break;
            case T.POS_WAIT:
                info = { name: 'SALES QUEUE', desc: 'Customers wait here to buy.', color: this.colors.posWait };
                break;
            case T.TABLE:
                const tableKey = `${x},${y}`;
                const tableDisplay = typeof InventorySystem !== 'undefined' ?
                    InventorySystem.getDisplayTableDisplay(tableKey) : { empty: true };
                const tableDesc = tableDisplay.empty ?
                    'Empty display - click STOCK to showcase an item' :
                    `${tableDisplay.itemData?.name || 'Item'} x${tableDisplay.count} @ $${tableDisplay.item.price}`;
                info = {
                    name: 'DISPLAY TABLE',
                    desc: tableDesc,
                    color: this.colors.table,
                    isDisplayTable: true,
                    tableKey: tableKey
                };
                break;
            case T.WORKBENCH:
                info = { name: 'WORKBENCH', desc: 'Repair devices here. Employee only.', color: this.colors.workbench };
                break;
            case T.DOOR:
                info = { name: 'ENTRANCE', desc: 'Customers enter and exit here.', color: this.colors.door };
                break;
            case T.SHELF:
                const shelfKey = `${x},${y}`;
                const shelfDisplay = typeof InventorySystem !== 'undefined' ?
                    InventorySystem.getShelfDisplay(shelfKey) : { empty: true };
                const shelfDesc = shelfDisplay.empty ?
                    'Empty shelf - click STOCK to add items' :
                    `${shelfDisplay.count} items stocked`;
                info = {
                    name: 'SHELF',
                    desc: shelfDesc,
                    color: this.colors.shelf,
                    isShelf: true,
                    shelfKey: shelfKey
                };
                break;
            case T.WALL:
                info = { name: 'WALL', desc: '', color: this.colors.wall };
                break;
            case T.FLOOR:
                info = { name: 'FLOOR', desc: 'Customer area.', color: this.colors.floor };
                break;
            case T.BACKFLOOR:
                info = { name: 'BACK ROOM', desc: 'Employee only area.', color: this.colors.backfloor };
                break;
            default:
                this.clearInfoPanel();
                return;
        }

        // Add STOCK button for shelves and display tables
        let stockButton = '';
        if (info.isShelf) {
            stockButton = `<button class="interact-btn" onclick="ShopMap.openShelfInterface('${info.shelfKey}')">STOCK</button>`;
        } else if (info.isDisplayTable) {
            stockButton = `<button class="interact-btn" onclick="ShopMap.openDisplayTableInterface('${info.tableKey}')">STOCK</button>`;
        }

        panel.innerHTML = `
            <div class="map-info-tile">
                <div class="tile-icon" style="background:${info.color};"></div>
                <div class="tile-info-text">
                    <div class="tile-info-name">${info.name}</div>
                    <div class="tile-info-desc">${info.desc}</div>
                </div>
                ${stockButton}
            </div>
        `;
    },

    openShelfInterface(shelfKey) {
        if (typeof ShelfInterface !== 'undefined') {
            ShelfInterface.openShelf(shelfKey);
        }
    },

    openDisplayTableInterface(tableKey) {
        if (typeof DisplayTableInterface !== 'undefined') {
            DisplayTableInterface.openTable(tableKey);
        }
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
                } else if (npc.intent === NPCSystem.INTENT.PICKUP) {
                    Shop.triggerPickupDialogue(npc);
                }
            }
        }
    },

    handleHover(e) {
        this.hoveredTile = this.getTileAt(e);

        // Pass hover to service interface for calendar highlighting
        if (typeof ServiceInterface !== 'undefined' && ServiceInterface.active) {
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            ServiceInterface.handleMove(x, y);
        }
    },

    // Render
    render() {
        if (!this.ctx) return;

        // If register is active, render that instead
        if (typeof RegisterSystem !== 'undefined' && RegisterSystem.active) {
            RegisterSystem.render();
            return;
        }

        // If service interface is active, render that instead
        if (typeof ServiceInterface !== 'undefined' && ServiceInterface.active) {
            ServiceInterface.render();
            return;
        }

        // If shelf interface is active, render that instead
        if (typeof ShelfInterface !== 'undefined' && ShelfInterface.active) {
            ShelfInterface.render();
            return;
        }

        // If display table interface is active, render that instead
        if (typeof DisplayTableInterface !== 'undefined' && DisplayTableInterface.active) {
            DisplayTableInterface.render();
            return;
        }

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
                let label = null;

                switch (tile) {
                    case T.WALL:
                        color = this.colors.wall;
                        break;
                    case T.FLOOR:
                        color = this.colors.floor;
                        break;
                    case T.BACKFLOOR:
                        color = this.colors.backfloor;
                        break;
                    case T.SERVICE_COUNTER:
                        color = this.colors.serviceCounter;
                        break;
                    case T.POS_COUNTER:
                        color = this.colors.posCounter;
                        break;
                    case T.SERVICE_WAIT:
                        color = this.colors.serviceWait;
                        label = 'W';
                        break;
                    case T.POS_WAIT:
                        color = this.colors.posWait;
                        label = 'W';
                        break;
                    case T.TABLE:
                        color = this.colors.table;
                        // Show inventory status
                        if (typeof InventorySystem !== 'undefined') {
                            const tblKey = `${x},${y}`;
                            const tblDisplay = InventorySystem.getDisplayTableDisplay(tblKey);
                            label = tblDisplay.label;  // 'E' for empty or count
                        }
                        break;
                    case T.WORKBENCH:
                        color = this.colors.workbench;
                        break;
                    case T.DOOR:
                        color = this.colors.door;
                        break;
                    case T.SHELF:
                        color = this.colors.shelf;
                        // Show inventory status
                        if (typeof InventorySystem !== 'undefined') {
                            const shelfKey = `${x},${y}`;
                            const display = InventorySystem.getShelfDisplay(shelfKey);
                            label = display.label;  // 'E' for empty or count
                        }
                        break;
                }

                ctx.fillStyle = color;
                ctx.fillRect(
                    x * this.tileSize + 1,
                    y * this.tileSize + 1,
                    this.tileSize - 2,
                    this.tileSize - 2
                );

                // Draw label on tiles (shelves, tables, wait areas)
                if (label) {
                    // Use contrasting colors based on tile type
                    if (tile === T.SHELF) {
                        ctx.fillStyle = '#fff';  // White on gold shelf
                    } else if (tile === T.TABLE) {
                        ctx.fillStyle = '#fff';  // White on magenta table
                    } else {
                        ctx.fillStyle = 'rgba(255,255,255,0.5)';  // Dim for wait areas
                    }
                    ctx.font = 'bold 12px monospace';
                    ctx.textAlign = 'center';
                    ctx.fillText(label, x * this.tileSize + this.tileSize / 2, y * this.tileSize + this.tileSize / 2 + 4);
                }
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

        // Draw NPCs from NPC system - ALL CUSTOMERS ARE YELLOW
        for (const npc of NPCSystem.npcs) {
            const isWaiting = npc.state === NPCSystem.STATE.WAITING;
            const isBeingServed = npc.state === NPCSystem.STATE.BEING_SERVED;
            const isSelected = this.selectedNPC && this.selectedNPC.id === npc.id;

            // All customers are YELLOW
            ctx.fillStyle = this.colors.customer;
            ctx.fillRect(
                npc.x * this.tileSize + 3,
                npc.y * this.tileSize + 3,
                this.tileSize - 6,
                this.tileSize - 6
            );

            // Selection indicator (white border)
            if (isSelected || isBeingServed) {
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

            // Intent indicator (small letter inside block)
            // Only show S/B/P once intent is revealed (they head to counter)
            ctx.fillStyle = '#000';
            ctx.font = 'bold 9px monospace';
            ctx.textAlign = 'center';
            let intentLetter = '?';  // Unknown by default
            if (npc.intentRevealed) {
                intentLetter = npc.intent === NPCSystem.INTENT.SERVICE ? 'S' :
                               npc.intent === NPCSystem.INTENT.BUY ? 'B' :
                               npc.intent === NPCSystem.INTENT.PICKUP ? 'P' : '?';
            }
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

        // === UI BUTTONS (top right corner) ===
        const btnWidth = 60;
        const btnHeight = 22;
        const btnX = this.canvas.width - btnWidth - 5;

        // Pause button
        this.pauseBtn = { x: btnX, y: 5, width: btnWidth, height: btnHeight };
        const isPaused = typeof GameState !== 'undefined' && GameState.paused;
        ctx.fillStyle = isPaused ? '#e74c3c' : '#2ecc71';
        ctx.fillRect(this.pauseBtn.x, this.pauseBtn.y, this.pauseBtn.width, this.pauseBtn.height);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(isPaused ? 'PLAY' : 'PAUSE', this.pauseBtn.x + btnWidth/2, this.pauseBtn.y + 15);

        // Quick stock button
        this.quickStockBtn = { x: btnX, y: 32, width: btnWidth, height: btnHeight };
        ctx.fillStyle = '#9b59b6';
        ctx.fillRect(this.quickStockBtn.x, this.quickStockBtn.y, this.quickStockBtn.width, this.quickStockBtn.height);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 9px monospace';
        ctx.fillText('Q.STOCK', this.quickStockBtn.x + btnWidth/2, this.quickStockBtn.y + 15);

        // Quick fill shop button
        this.quickFillBtn = { x: btnX, y: 59, width: btnWidth, height: btnHeight };
        ctx.fillStyle = '#e67e22';
        ctx.fillRect(this.quickFillBtn.x, this.quickFillBtn.y, this.quickFillBtn.width, this.quickFillBtn.height);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 9px monospace';
        ctx.fillText('Q.FILL', this.quickFillBtn.x + btnWidth/2, this.quickFillBtn.y + 15);

        // Furniture placement mode indicator
        if (typeof FurnitureSystem !== 'undefined' && FurnitureSystem.placementMode) {
            ctx.fillStyle = 'rgba(230, 126, 34, 0.8)';
            ctx.fillRect(5, 5, 150, 25);
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 10px monospace';
            ctx.textAlign = 'left';
            ctx.fillText(`PLACING: ${FurnitureSystem.selectedFurniture.toUpperCase()}`, 10, 20);

            // Highlight valid placement tiles
            const T = this.TILES;
            for (let y = 0; y < this.gridHeight; y++) {
                for (let x = 0; x < this.gridWidth; x++) {
                    if (FurnitureSystem.canPlaceAt(x, y)) {
                        ctx.fillStyle = 'rgba(46, 204, 113, 0.3)';
                        ctx.fillRect(x * this.tileSize + 2, y * this.tileSize + 2, this.tileSize - 4, this.tileSize - 4);
                    }
                }
            }
        }

        // Paused overlay
        if (isPaused) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.fillRect(0, 60, this.canvas.width, 40);
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 20px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('PAUSED', this.canvas.width / 2, 88);
        }

    },

    togglePause() {
        if (typeof GameState !== 'undefined') {
            GameState.paused = !GameState.paused;
            GameState.timePaused = GameState.paused;  // Also pause game time
        }
    },

    quickStock() {
        if (typeof InventorySystem !== 'undefined') {
            InventorySystem.quickStockAll();
        }
    },

    quickFillShop() {
        if (typeof FurnitureSystem !== 'undefined') {
            FurnitureSystem.quickFillShop();
        }
    },

    lastTime: 0,

    startRenderLoop() {
        const loop = (time) => {
            const deltaTime = time - this.lastTime;
            this.lastTime = time;

            const isPaused = typeof GameState !== 'undefined' && GameState.paused;

            // Only update if not paused
            if (!isPaused) {
                const isShopOpen = typeof GameState !== 'undefined' && GameState.shopOpen;
                NPCSystem.update(deltaTime, isShopOpen);
            }

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
