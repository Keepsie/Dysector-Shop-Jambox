/* DYSECTOR Shop Prototype - NPC System */

const NPCSystem = {
    npcs: [],
    maxNPCs: 4,           // Reduced - less overwhelming
    spawnTimer: 0,
    spawnInterval: 5000,  // ms between spawn checks - slower spawns

    // NPC intent types
    INTENT: {
        BROWSE: 'browse',      // Just looking
        BUY: 'buy',            // Wants to buy something
        SERVICE: 'service',    // Needs device repaired
    },

    // NPC states
    STATE: {
        ENTERING: 'entering',
        BROWSING: 'browsing',
        TO_COUNTER: 'toCounter',
        WAITING: 'waiting',
        BEING_SERVED: 'beingServed',
        LEAVING: 'leaving',
    },

    // Key positions from shop layout
    positions: null,

    init(shopMap, shopPositions) {
        this.positions = shopPositions;
        this.npcs = [];
    },

    // Generate a new NPC
    generateNPC() {
        // Decide intent based on probabilities
        const roll = Math.random();
        let intent;
        if (roll < 0.4) {
            intent = this.INTENT.SERVICE;  // 40% need repairs
        } else if (roll < 0.75) {
            intent = this.INTENT.BUY;      // 35% want to buy
        } else {
            intent = this.INTENT.BROWSE;   // 25% just browsing
        }

        // Generate customer data
        const customerData = typeof generateCustomer !== 'undefined'
            ? generateCustomer()
            : this.generateBasicCustomer();

        const npc = {
            id: Date.now() + Math.random(),
            data: customerData,
            intent: intent,
            intentRevealed: false,  // True once they head to counter
            state: this.STATE.ENTERING,

            // Position
            x: this.positions.door?.x || 10,
            y: this.positions.door?.y || 12,

            // Movement
            targetSpot: null,
            path: [],
            moveTimer: 0,
            moveSpeed: 250 + Math.random() * 150,  // ms per tile
            lastX: -1,
            lastY: -1,
            stuckCount: 0,
            totalStuckTime: 0,  // Track total time stuck

            // Behavior
            browseTime: 0,
            maxBrowseTime: 2000 + Math.random() * 4000,
            patience: 100,  // Decreases while waiting
            patienceDecay: 0.5 + Math.random() * 0.5,

            // Visual
            color: this.getIntentColor(intent),
        };

        // Set initial target based on intent
        this.setInitialTarget(npc);

        return npc;
    },

    generateBasicCustomer() {
        const names = ['Alex', 'Jordan', 'Sam', 'Riley', 'Morgan', 'Casey', 'Taylor', 'Quinn'];
        return {
            name: names[Math.floor(Math.random() * names.length)],
            device: { fullName: 'Generic Device', typeName: 'Device' },
            urgency: { id: 'normal' },
        };
    },

    getIntentColor(intent) {
        switch (intent) {
            case this.INTENT.SERVICE: return '#ff6b35';   // Orange - needs help
            case this.INTENT.BUY: return '#4ecdc4';       // Teal - buying
            case this.INTENT.BROWSE: return '#95a5a6';    // Gray - browsing
            default: return '#ff6b35';
        }
    },

    setInitialTarget(npc) {
        // BUY customers go to shelves OR display tables to browse and pick items
        if (npc.intent === this.INTENT.BUY && typeof InventorySystem !== 'undefined') {
            // Combine shelf and display table spots
            const shelfSpots = this.getShelfBrowseSpots();
            const tableSpots = this.getDisplayTableBrowseSpots();
            const allBrowseSpots = [...shelfSpots, ...tableSpots];

            if (allBrowseSpots.length > 0) {
                npc.targetSpot = allBrowseSpots[Math.floor(Math.random() * allBrowseSpots.length)];
                npc.browsingShelf = npc.targetSpot.type === 'shelf';
                npc.browsingTable = npc.targetSpot.type === 'table';
                return;
            }
        }

        // SERVICE or fallback: go browse at tables then to counter
        if (this.positions.browseSpots && this.positions.browseSpots.length > 0) {
            const availableSpots = this.positions.browseSpots.filter(spot =>
                !this.npcs.some(other =>
                    other.id !== npc.id &&
                    other.targetSpot &&
                    other.targetSpot.x === spot.x &&
                    other.targetSpot.y === spot.y
                )
            );

            if (availableSpots.length > 0) {
                npc.targetSpot = availableSpots[Math.floor(Math.random() * availableSpots.length)];
                return;
            }
        }

        // Fallback: go directly to counter
        this.setCounterTarget(npc);
    },

    // Get spots adjacent to shelves where NPCs can stand and browse
    getShelfBrowseSpots() {
        const spots = [];
        if (!ShopMap.map) return spots;

        const T = ShopGenerator.TILES;
        const width = ShopMap.gridWidth;
        const height = ShopMap.gridHeight;

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                if (ShopMap.map[y][x] === T.SHELF) {
                    // Check adjacent floor tiles
                    const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
                    for (const [dx, dy] of dirs) {
                        const nx = x + dx;
                        const ny = y + dy;
                        if (nx > 0 && nx < width - 1 && ny > 0 && ny < height - 1) {
                            const adjTile = ShopMap.map[ny][nx];
                            if (adjTile === T.FLOOR) {
                                spots.push({ x: nx, y: ny, shelfX: x, shelfY: y, type: 'shelf' });
                            }
                        }
                    }
                }
            }
        }

        return spots;
    },

    // Get spots adjacent to display tables where NPCs can stand and browse
    getDisplayTableBrowseSpots() {
        const spots = [];
        if (!ShopMap.map) return spots;

        const T = ShopGenerator.TILES;
        const width = ShopMap.gridWidth;
        const height = ShopMap.gridHeight;

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                if (ShopMap.map[y][x] === T.TABLE) {
                    // Check adjacent floor tiles
                    const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
                    for (const [dx, dy] of dirs) {
                        const nx = x + dx;
                        const ny = y + dy;
                        if (nx > 0 && nx < width - 1 && ny > 0 && ny < height - 1) {
                            const adjTile = ShopMap.map[ny][nx];
                            if (adjTile === T.FLOOR) {
                                spots.push({ x: nx, y: ny, tableX: x, tableY: y, type: 'table' });
                            }
                        }
                    }
                }
            }
        }

        return spots;
    },

    setCounterTarget(npc) {
        let spots;

        if (npc.intent === this.INTENT.SERVICE) {
            spots = this.positions.serviceWaitSpots;
        } else if (npc.intent === this.INTENT.BUY) {
            spots = this.positions.posWaitSpots;
        } else {
            // Browsers might buy or leave
            if (Math.random() < 0.3) {
                spots = this.positions.posWaitSpots;
                npc.intent = this.INTENT.BUY;
            } else {
                npc.state = this.STATE.LEAVING;
                npc.targetSpot = this.positions.door;
                return;
            }
        }

        if (spots && spots.length > 0) {
            const availableSpots = spots.filter(spot =>
                !this.npcs.some(other =>
                    other.id !== npc.id &&
                    other.state === this.STATE.WAITING &&
                    other.targetSpot?.x === spot.x &&
                    other.targetSpot?.y === spot.y
                )
            );

            if (availableSpots.length > 0) {
                npc.targetSpot = availableSpots[Math.floor(Math.random() * availableSpots.length)];
                npc.state = this.STATE.TO_COUNTER;
                npc.intentRevealed = true;  // Now we know what they want
            } else {
                // No space, wait or leave
                if (npc.patience < 50) {
                    npc.state = this.STATE.LEAVING;
                    npc.targetSpot = this.positions.door;
                }
            }
        }
    },

    // Spawn new NPC
    trySpawn() {
        if (this.npcs.length >= this.maxNPCs) return null;
        if (!this.positions?.door) return null;

        // Check if door is clear
        const doorBlocked = this.npcs.some(npc =>
            Math.abs(npc.x - this.positions.door.x) < 2 &&
            Math.abs(npc.y - this.positions.door.y) < 2
        );

        if (doorBlocked) return null;

        const npc = this.generateNPC();
        this.npcs.push(npc);
        return npc;
    },

    // Update all NPCs
    update(deltaTime, isShopOpen) {
        // Spawn check
        if (isShopOpen) {
            this.spawnTimer += deltaTime;
            if (this.spawnTimer >= this.spawnInterval) {
                this.spawnTimer = 0;
                if (Math.random() < 0.4) {  // 40% chance each interval (but interval is longer)
                    this.trySpawn();
                }
            }
        }

        // Update each NPC
        for (let i = this.npcs.length - 1; i >= 0; i--) {
            const npc = this.npcs[i];
            this.updateNPC(npc, deltaTime);

            // Remove if left (at door or past it - y <= 1)
            if (npc.state === this.STATE.LEAVING && npc.y <= 1) {
                this.npcs.splice(i, 1);
            }
        }
    },

    updateNPC(npc, deltaTime) {
        npc.moveTimer += deltaTime;

        switch (npc.state) {
            case this.STATE.ENTERING:
            case this.STATE.TO_COUNTER:
                if (npc.moveTimer >= npc.moveSpeed) {
                    npc.moveTimer = 0;
                    this.moveToward(npc);

                    if (this.atTarget(npc)) {
                        if (npc.state === this.STATE.ENTERING) {
                            npc.state = this.STATE.BROWSING;
                            npc.browseTime = 0;
                        } else {
                            npc.state = this.STATE.WAITING;
                        }
                    }
                }
                break;

            case this.STATE.BROWSING:
                npc.browseTime += deltaTime;
                if (npc.browseTime >= npc.maxBrowseTime) {
                    // If browsing shelf, try to pick an item
                    if (npc.browsingShelf && npc.targetSpot?.shelfX !== undefined) {
                        this.pickItemFromShelf(npc);
                    } else if (npc.browsingTable && npc.targetSpot?.tableX !== undefined) {
                        this.pickItemFromDisplayTable(npc);
                    } else {
                        this.setCounterTarget(npc);
                    }
                }
                break;

            case this.STATE.WAITING:
                npc.patience -= npc.patienceDecay * (deltaTime / 1000);
                if (npc.patience <= 0) {
                    npc.state = this.STATE.LEAVING;
                    npc.targetSpot = this.positions.door;
                    // TODO: Negative reputation impact
                }
                break;

            case this.STATE.LEAVING:
                if (npc.moveTimer >= npc.moveSpeed) {
                    npc.moveTimer = 0;
                    this.moveToward(npc);
                }
                break;
        }
    },

    moveToward(npc) {
        if (!npc.targetSpot) return;

        const dx = npc.targetSpot.x - npc.x;
        const dy = npc.targetSpot.y - npc.y;

        // At destination?
        if (dx === 0 && dy === 0) {
            npc.stuckCount = 0;
            npc.totalStuckTime = 0;
            return;
        }

        // Remember position before moving
        const prevX = npc.x;
        const prevY = npc.y;

        // Check what tiles are around us for debugging
        const T = ShopGenerator.TILES;
        const getTileName = (tx, ty) => {
            const tile = ShopMap.map?.[ty]?.[tx];
            const names = {
                [T.VOID]: 'VOID', [T.WALL]: 'WALL', [T.FLOOR]: 'FLOOR',
                [T.SERVICE_COUNTER]: 'SVC_CTR', [T.POS_COUNTER]: 'POS_CTR',
                [T.TABLE]: 'TABLE', [T.WORKBENCH]: 'BENCH', [T.DOOR]: 'DOOR',
                [T.BACKFLOOR]: 'BACK', [T.SHELF]: 'SHELF',
                [T.SERVICE_WAIT]: 'SVC_WAIT', [T.POS_WAIT]: 'POS_WAIT'
            };
            return names[tile] || `?${tile}`;
        };

        // Track if we actually moved this tick
        let moved = false;

        // NPCs can pass through each other - only tiles block movement
        // Prioritize larger distance
        if (Math.abs(dx) >= Math.abs(dy) && dx !== 0) {
            const newX = npc.x + Math.sign(dx);
            if (this.canWalk(newX, npc.y)) {
                npc.x = newX;
                moved = true;
            }
        }

        if (!moved && dy !== 0) {
            const newY = npc.y + Math.sign(dy);
            if (this.canWalk(npc.x, newY)) {
                npc.y = newY;
                moved = true;
            }
        }

        // If blocked, try alternate horizontal
        if (!moved && dx !== 0) {
            const newX = npc.x + Math.sign(dx);
            if (this.canWalk(newX, npc.y)) {
                npc.x = newX;
                moved = true;
            }
        }

        // Still blocked - try perpendicular moves to go around obstacle
        if (!moved) {
            // Try all 4 directions randomly to escape
            const dirs = [[0,-1], [0,1], [-1,0], [1,0]];
            for (let i = dirs.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [dirs[i], dirs[j]] = [dirs[j], dirs[i]];
            }
            for (const [ddx, ddy] of dirs) {
                if (this.canWalk(npc.x + ddx, npc.y + ddy)) {
                    npc.x += ddx;
                    npc.y += ddy;
                    moved = true;
                    break;
                }
            }
        }

        // Track stuck status
        if (moved) {
            npc.stuckCount = 0;
            npc.totalStuckTime = 0;
        } else {
            npc.stuckCount++;
            npc.totalStuckTime += npc.moveSpeed;

            // Log if stuck for more than 3 seconds and not waiting
            if (npc.totalStuckTime > 3000 && npc.state !== this.STATE.WAITING) {
                console.warn(`[NPC STUCK] ${npc.data.name} at (${npc.x},${npc.y}) state=${npc.state} target=(${npc.targetSpot?.x},${npc.targetSpot?.y})`);
                console.warn(`  Surroundings: UP=${getTileName(npc.x, npc.y-1)} DOWN=${getTileName(npc.x, npc.y+1)} LEFT=${getTileName(npc.x-1, npc.y)} RIGHT=${getTileName(npc.x+1, npc.y)}`);
                console.warn(`  Standing on: ${getTileName(npc.x, npc.y)}`);
                npc.totalStuckTime = 0;  // Reset so we don't spam

                // If stuck too long, just teleport closer to target
                if (npc.stuckCount > 20) {
                    console.warn(`  TELEPORTING ${npc.data.name} toward target`);
                    // Move 1 step closer to target ignoring walls (emergency)
                    if (Math.abs(dx) > Math.abs(dy)) {
                        npc.x += Math.sign(dx);
                    } else if (dy !== 0) {
                        npc.y += Math.sign(dy);
                    }
                    npc.stuckCount = 0;
                }
            }
        }

        npc.lastX = prevX;
        npc.lastY = prevY;
    },

    canWalk(x, y) {
        // Check against shop map
        if (typeof ShopMap !== 'undefined' && ShopMap.map) {
            const tile = ShopMap.map[y]?.[x];
            if (tile === undefined) return false;

            const T = ShopGenerator.TILES;
            // Include wait areas as walkable - NPCs need to reach them!
            const walkable = [T.FLOOR, T.BACKFLOOR, T.DOOR, T.SERVICE_WAIT, T.POS_WAIT];
            return walkable.includes(tile);
        }
        return true;
    },

    atTarget(npc) {
        if (!npc.targetSpot) return true;
        return npc.x === npc.targetSpot.x && npc.y === npc.targetSpot.y;
    },

    // Get NPC at position
    getNPCAt(x, y) {
        return this.npcs.find(npc => npc.x === x && npc.y === y);
    },

    // Get waiting NPCs by counter type
    getWaitingAtService() {
        return this.npcs.filter(npc =>
            npc.state === this.STATE.WAITING &&
            npc.intent === this.INTENT.SERVICE
        );
    },

    getWaitingAtPOS() {
        return this.npcs.filter(npc =>
            npc.state === this.STATE.WAITING &&
            npc.intent === this.INTENT.BUY
        );
    },

    // Pick item from shelf after browsing
    pickItemFromShelf(npc) {
        const shelfKey = `${npc.targetSpot.shelfX},${npc.targetSpot.shelfY}`;
        const shelf = InventorySystem.shelves[shelfKey];

        if (shelf && shelf.items.length > 0) {
            // Check prices - customer has a max they'll pay
            const item = InventorySystem.getItem(shelf.items[0].itemId);
            const shelfPrice = shelf.items[0].price;
            const marketPrice = item?.marketPrice || shelfPrice;

            // Customer tolerance: random 5-35% over market (varies per customer)
            const tolerance = 0.05 + Math.random() * 0.30;
            const maxWillPay = marketPrice * (1 + tolerance);

            if (shelfPrice <= maxWillPay) {
                // They'll buy it - store selected item and go to POS
                npc.selectedItem = {
                    shelfKey: shelfKey,
                    itemId: shelf.items[0].itemId,
                    price: shelfPrice,
                    name: item?.name || 'Item'
                };
                npc.browsingShelf = false;
                npc.intentRevealed = true;
                this.setCounterTarget(npc);
                console.log(`[NPC] ${npc.data.name} picked ${npc.selectedItem.name} at $${shelfPrice}`);
            } else {
                // Too expensive - leave annoyed or browse elsewhere
                console.log(`[NPC] ${npc.data.name} thinks $${shelfPrice} is too expensive for ${item?.name}`);
                if (Math.random() < 0.5) {
                    // Try another shelf
                    const otherSpots = this.getShelfBrowseSpots().filter(s =>
                        s.shelfX !== npc.targetSpot.shelfX || s.shelfY !== npc.targetSpot.shelfY
                    );
                    if (otherSpots.length > 0) {
                        npc.targetSpot = otherSpots[Math.floor(Math.random() * otherSpots.length)];
                        npc.browseTime = 0;
                        npc.state = this.STATE.ENTERING;  // Go to new spot
                        return;
                    }
                }
                // Leave without buying
                npc.state = this.STATE.LEAVING;
                npc.targetSpot = this.positions.door;
            }
        } else {
            // Empty shelf - try another or leave
            const otherSpots = this.getShelfBrowseSpots().filter(s =>
                s.shelfX !== npc.targetSpot.shelfX || s.shelfY !== npc.targetSpot.shelfY
            );
            if (otherSpots.length > 0 && Math.random() < 0.7) {
                npc.targetSpot = otherSpots[Math.floor(Math.random() * otherSpots.length)];
                npc.browseTime = 0;
                npc.state = this.STATE.ENTERING;
            } else {
                // Leave - nothing to buy
                npc.state = this.STATE.LEAVING;
                npc.targetSpot = this.positions.door;
                console.log(`[NPC] ${npc.data.name} leaving - shelves empty`);
            }
        }
    },

    // Pick item from display table after browsing
    pickItemFromDisplayTable(npc) {
        const tableKey = `${npc.targetSpot.tableX},${npc.targetSpot.tableY}`;
        const table = InventorySystem.displayTables[tableKey];

        if (table && table.item && table.item.quantity > 0) {
            const item = InventorySystem.getItem(table.item.itemId);
            const tablePrice = table.item.price;
            const marketPrice = item?.marketPrice || tablePrice;

            // Customer tolerance: random 5-35% over market (varies per customer)
            const tolerance = 0.05 + Math.random() * 0.30;
            const maxWillPay = marketPrice * (1 + tolerance);

            if (tablePrice <= maxWillPay) {
                // They'll buy it
                npc.selectedItem = {
                    tableKey: tableKey,
                    itemId: table.item.itemId,
                    price: tablePrice,
                    name: item?.name || 'Item',
                    fromTable: true
                };
                npc.browsingTable = false;
                npc.intentRevealed = true;
                this.setCounterTarget(npc);
                console.log(`[NPC] ${npc.data.name} picked ${npc.selectedItem.name} from display at $${tablePrice}`);
            } else {
                // Too expensive
                console.log(`[NPC] ${npc.data.name} thinks $${tablePrice} is too expensive for ${item?.name}`);
                this.tryOtherBrowseSpot(npc);
            }
        } else {
            // Empty table - try elsewhere
            this.tryOtherBrowseSpot(npc);
        }
    },

    // Try to find another browse spot (shelf or table)
    tryOtherBrowseSpot(npc) {
        const shelfSpots = this.getShelfBrowseSpots();
        const tableSpots = this.getDisplayTableBrowseSpots();
        const currentX = npc.targetSpot?.shelfX ?? npc.targetSpot?.tableX;
        const currentY = npc.targetSpot?.shelfY ?? npc.targetSpot?.tableY;

        const otherSpots = [...shelfSpots, ...tableSpots].filter(s => {
            const sx = s.shelfX ?? s.tableX;
            const sy = s.shelfY ?? s.tableY;
            return sx !== currentX || sy !== currentY;
        });

        if (otherSpots.length > 0 && Math.random() < 0.6) {
            npc.targetSpot = otherSpots[Math.floor(Math.random() * otherSpots.length)];
            npc.browsingShelf = npc.targetSpot.type === 'shelf';
            npc.browsingTable = npc.targetSpot.type === 'table';
            npc.browseTime = 0;
            npc.state = this.STATE.ENTERING;
        } else {
            // Leave without buying
            npc.state = this.STATE.LEAVING;
            npc.targetSpot = this.positions.door;
            console.log(`[NPC] ${npc.data.name} leaving - nothing interesting`);
        }
    },

    // Serve an NPC (called when player interacts)
    serveNPC(npcId) {
        const npc = this.npcs.find(n => n.id === npcId);
        if (npc && npc.state === this.STATE.WAITING) {
            npc.state = this.STATE.BEING_SERVED;
            return npc;
        }
        return null;
    },

    // Complete service (NPC leaves happy)
    completeService(npcId) {
        const npc = this.npcs.find(n => n.id === npcId);
        if (npc) {
            npc.state = this.STATE.LEAVING;
            npc.targetSpot = this.positions.door;
            npc.color = '#27ae60';  // Green - satisfied
        }
    },

    // NPC leaves unhappy
    dismissNPC(npcId) {
        const npc = this.npcs.find(n => n.id === npcId);
        if (npc) {
            npc.state = this.STATE.LEAVING;
            npc.targetSpot = this.positions.door;
            npc.color = '#e74c3c';  // Red - unhappy
        }
    },

    // Stats
    getCount() {
        return this.npcs.length;
    },

    getWaitingCount() {
        return this.npcs.filter(npc => npc.state === this.STATE.WAITING).length;
    },
};
