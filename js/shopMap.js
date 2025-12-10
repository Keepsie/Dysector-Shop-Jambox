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
        void: '#0a0a0a',        // Outside shop
        wall: '#1a1a2e',        // Walls
        floor: '#16213e',       // Walkable floor
        counter: '#00fff5',     // Cyan - service counter
        table: '#e94560',       // Magenta/pink - display tables
        workbench: '#f0c929',   // Yellow - workbench area
        door: '#27ae60',        // Green - entrance
        player: '#ffffff',      // White - you
        customer: '#ff6b35',    // Orange - customers
        customerWaiting: '#ff9f1c', // Brighter orange - customer at counter
    },

    // Tile types
    TILES: {
        VOID: 0,
        WALL: 1,
        FLOOR: 2,
        COUNTER: 3,
        TABLE: 4,
        WORKBENCH: 5,
        DOOR: 6,
        BACKFLOOR: 7  // Back room floor
    },

    // Shop layout map
    map: null,

    // Entities
    player: { x: 9, y: 5, atCounter: true },
    customers: [],
    maxCustomers: 4,

    // Interaction
    selectedCustomer: null,
    hoveredTile: null,

    // Spots where customers can go
    browsingSpots: [],
    counterSpots: [],

    init() {
        this.createCanvas();
        this.buildMap();
        this.findSpots();
        this.bindEvents();
        this.startRenderLoop();
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

    buildMap() {
        // Initialize with void
        this.map = Array(this.gridHeight).fill(null).map(() =>
            Array(this.gridWidth).fill(this.TILES.VOID)
        );

        const T = this.TILES;

        // Build shop outline (walls)
        // Front room: rows 1-8, cols 1-18
        // Back room: rows 9-12, cols 1-18

        // Outer walls
        for (let x = 0; x < this.gridWidth; x++) {
            this.map[0][x] = T.WALL;  // Top wall
            this.map[this.gridHeight - 1][x] = T.WALL;  // Bottom wall
        }
        for (let y = 0; y < this.gridHeight; y++) {
            this.map[y][0] = T.WALL;  // Left wall
            this.map[y][this.gridWidth - 1] = T.WALL;  // Right wall
        }

        // Floor - front room
        for (let y = 1; y <= 7; y++) {
            for (let x = 1; x < this.gridWidth - 1; x++) {
                this.map[y][x] = T.FLOOR;
            }
        }

        // Divider wall between front and back (with gap for door)
        for (let x = 1; x < this.gridWidth - 1; x++) {
            this.map[8][x] = T.WALL;
        }
        // Gap in divider
        this.map[8][9] = T.FLOOR;
        this.map[8][10] = T.FLOOR;

        // Floor - back room
        for (let y = 9; y <= 12; y++) {
            for (let x = 1; x < this.gridWidth - 1; x++) {
                this.map[y][x] = T.BACKFLOOR;
            }
        }

        // Door at bottom center
        this.map[this.gridHeight - 1][9] = T.DOOR;
        this.map[this.gridHeight - 1][10] = T.DOOR;

        // Counter (where player stands to serve)
        // Horizontal counter near back of front room
        for (let x = 7; x <= 12; x++) {
            this.map[6][x] = T.COUNTER;
        }

        // Display tables in front room
        // Table 1 - left side
        this.map[2][3] = T.TABLE;
        this.map[2][4] = T.TABLE;
        this.map[3][3] = T.TABLE;
        this.map[3][4] = T.TABLE;

        // Table 2 - right side
        this.map[2][15] = T.TABLE;
        this.map[2][16] = T.TABLE;
        this.map[3][15] = T.TABLE;
        this.map[3][16] = T.TABLE;

        // Table 3 - center left
        this.map[4][5] = T.TABLE;
        this.map[4][6] = T.TABLE;

        // Table 4 - center right
        this.map[4][13] = T.TABLE;
        this.map[4][14] = T.TABLE;

        // Workbenches in back room
        this.map[10][3] = T.WORKBENCH;
        this.map[10][4] = T.WORKBENCH;
        this.map[11][3] = T.WORKBENCH;
        this.map[11][4] = T.WORKBENCH;

        this.map[10][15] = T.WORKBENCH;
        this.map[10][16] = T.WORKBENCH;
        this.map[11][15] = T.WORKBENCH;
        this.map[11][16] = T.WORKBENCH;
    },

    findSpots() {
        const T = this.TILES;

        // Find spots adjacent to tables (browsing spots)
        this.browsingSpots = [];
        this.counterSpots = [];

        for (let y = 1; y < this.gridHeight - 1; y++) {
            for (let x = 1; x < this.gridWidth - 1; x++) {
                // Check if floor tile adjacent to table
                if (this.map[y][x] === T.FLOOR) {
                    const adjacent = this.getAdjacentTiles(x, y);
                    if (adjacent.some(t => t.type === T.TABLE)) {
                        this.browsingSpots.push({ x, y });
                    }
                    if (adjacent.some(t => t.type === T.COUNTER)) {
                        this.counterSpots.push({ x, y });
                    }
                }
            }
        }
    },

    getAdjacentTiles(x, y) {
        const tiles = [];
        const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
        for (const [dx, dy] of dirs) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx >= 0 && nx < this.gridWidth && ny >= 0 && ny < this.gridHeight) {
                tiles.push({ x: nx, y: ny, type: this.map[ny][nx] });
            }
        }
        return tiles;
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

        // Check if clicked on a customer
        const customer = this.customers.find(c => c.x === tile.x && c.y === tile.y);
        if (customer) {
            this.selectCustomer(customer);
            this.showCustomerInfo(customer);
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

    showCustomerInfo(customer) {
        const panel = document.getElementById('map-info-panel');
        if (!panel) return;

        const isWaiting = customer.state === 'waiting';
        const statusText = {
            'entering': 'Entering shop...',
            'browsing': 'Browsing',
            'toCounter': 'Heading to counter...',
            'waiting': 'Waiting at counter!',
            'leaving': 'Leaving...'
        }[customer.state] || customer.state;

        panel.innerHTML = `
            <div class="map-info-customer">
                <div class="customer-info-left">
                    <div class="customer-info-name">${customer.data.name}</div>
                    <div class="customer-info-device">${customer.data.device.fullName}</div>
                    <div class="customer-info-status">${statusText}</div>
                </div>
                <div class="customer-info-right">
                    <button class="interact-btn" ${isWaiting ? '' : 'disabled'} onclick="ShopMap.interactWithCustomer('${customer.id}')">
                        ${isWaiting ? 'TALK' : 'BUSY'}
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
            case T.COUNTER:
                info = { name: 'SERVICE COUNTER', desc: 'Where you serve customers.', color: this.colors.counter };
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

    interactWithCustomer(customerId) {
        const customer = this.customers.find(c => c.id == customerId);
        if (customer && customer.state === 'waiting') {
            this.selectCustomer(customer);
        }
    },

    handleHover(e) {
        this.hoveredTile = this.getTileAt(e);
    },

    selectCustomer(customer) {
        this.selectedCustomer = customer;

        // Trigger dialogue in Shop system
        if (typeof Shop !== 'undefined' && Shop.triggerCustomerDialogue) {
            Shop.triggerCustomerDialogue(customer);
        }
    },

    // Spawn a new customer
    spawnCustomer(customerData) {
        if (this.customers.length >= this.maxCustomers) return null;

        // Start at door
        const customer = {
            id: Date.now(),
            x: 9,
            y: this.gridHeight - 2,  // Just inside door
            data: customerData,
            state: 'entering',  // entering, browsing, waiting, leaving
            targetSpot: null,
            path: [],
            moveTimer: 0
        };

        // Pick a browsing spot
        const availableSpots = this.browsingSpots.filter(spot =>
            !this.customers.some(c => c.targetSpot && c.targetSpot.x === spot.x && c.targetSpot.y === spot.y)
        );

        if (availableSpots.length > 0) {
            customer.targetSpot = availableSpots[Math.floor(Math.random() * availableSpots.length)];
            customer.state = 'entering';
        }

        this.customers.push(customer);
        return customer;
    },

    // Remove customer
    removeCustomer(customerId) {
        const index = this.customers.findIndex(c => c.id === customerId);
        if (index !== -1) {
            this.customers.splice(index, 1);
        }
        if (this.selectedCustomer && this.selectedCustomer.id === customerId) {
            this.selectedCustomer = null;
        }
    },

    // Update customer positions
    update(deltaTime) {
        for (const customer of this.customers) {
            customer.moveTimer += deltaTime;

            if (customer.moveTimer < 300) continue;  // Move every 300ms
            customer.moveTimer = 0;

            if (customer.state === 'entering' || customer.state === 'browsing') {
                this.moveCustomerToward(customer, customer.targetSpot);

                // Check if reached target
                if (customer.x === customer.targetSpot.x && customer.y === customer.targetSpot.y) {
                    if (customer.state === 'entering') {
                        customer.state = 'browsing';
                        // After browsing, go to counter
                        setTimeout(() => {
                            if (customer.state === 'browsing') {
                                customer.state = 'toCounter';
                                const counterSpot = this.counterSpots[Math.floor(Math.random() * this.counterSpots.length)];
                                customer.targetSpot = counterSpot;
                            }
                        }, 2000 + Math.random() * 3000);
                    }
                }
            } else if (customer.state === 'toCounter') {
                this.moveCustomerToward(customer, customer.targetSpot);

                if (customer.x === customer.targetSpot.x && customer.y === customer.targetSpot.y) {
                    customer.state = 'waiting';
                    // Notify shop that customer is waiting
                    if (typeof Shop !== 'undefined' && Shop.customerReady) {
                        Shop.customerReady(customer);
                    }
                }
            } else if (customer.state === 'leaving') {
                // Move toward door
                const doorSpot = { x: 9, y: this.gridHeight - 2 };
                this.moveCustomerToward(customer, doorSpot);

                if (customer.y >= this.gridHeight - 2) {
                    this.removeCustomer(customer.id);
                }
            }
        }
    },

    moveCustomerToward(customer, target) {
        if (!target) return;

        const dx = target.x - customer.x;
        const dy = target.y - customer.y;

        // Simple movement - prefer X then Y
        if (dx !== 0) {
            const newX = customer.x + Math.sign(dx);
            if (this.isWalkable(newX, customer.y)) {
                customer.x = newX;
                return;
            }
        }
        if (dy !== 0) {
            const newY = customer.y + Math.sign(dy);
            if (this.isWalkable(customer.x, newY)) {
                customer.y = newY;
                return;
            }
        }

        // If blocked, try alternate direction
        if (dy !== 0) {
            const newY = customer.y + Math.sign(dy);
            if (this.isWalkable(customer.x, newY)) {
                customer.y = newY;
                return;
            }
        }
        if (dx !== 0) {
            const newX = customer.x + Math.sign(dx);
            if (this.isWalkable(newX, customer.y)) {
                customer.x = newX;
            }
        }
    },

    isWalkable(x, y) {
        if (x < 0 || x >= this.gridWidth || y < 0 || y >= this.gridHeight) return false;
        const tile = this.map[y][x];
        const T = this.TILES;
        return tile === T.FLOOR || tile === T.BACKFLOOR || tile === T.DOOR;
    },

    // Make customer leave
    customerLeave(customerId) {
        const customer = this.customers.find(c => c.id === customerId);
        if (customer) {
            customer.state = 'leaving';
        }
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
                    case T.COUNTER:
                        color = this.colors.counter;
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

        // Draw customers
        for (const customer of this.customers) {
            const isWaiting = customer.state === 'waiting';
            const isSelected = this.selectedCustomer && this.selectedCustomer.id === customer.id;

            ctx.fillStyle = isWaiting ? this.colors.customerWaiting : this.colors.customer;
            ctx.fillRect(
                customer.x * this.tileSize + 3,
                customer.y * this.tileSize + 3,
                this.tileSize - 6,
                this.tileSize - 6
            );

            // Selection indicator
            if (isSelected) {
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 2;
                ctx.strokeRect(
                    customer.x * this.tileSize + 2,
                    customer.y * this.tileSize + 2,
                    this.tileSize - 4,
                    this.tileSize - 4
                );
            }

            // Waiting indicator (!)
            if (isWaiting) {
                ctx.fillStyle = '#ffffff';
                ctx.font = 'bold 12px monospace';
                ctx.textAlign = 'center';
                ctx.fillText('!', customer.x * this.tileSize + this.tileSize / 2, customer.y * this.tileSize - 2);
            }
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
        ctx.fillStyle = this.colors.counter;
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('P', this.player.x * this.tileSize + this.tileSize / 2, this.player.y * this.tileSize + this.tileSize / 2 + 3);
    },

    lastTime: 0,

    startRenderLoop() {
        const loop = (time) => {
            const deltaTime = time - this.lastTime;
            this.lastTime = time;

            this.update(deltaTime);
            this.render();

            requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
    },

    // Get customer count for UI
    getCustomerCount() {
        return this.customers.length;
    },

    getWaitingCount() {
        return this.customers.filter(c => c.state === 'waiting').length;
    }
};

// Initialize when DOM ready
document.addEventListener('DOMContentLoaded', () => {
    ShopMap.init();
});
