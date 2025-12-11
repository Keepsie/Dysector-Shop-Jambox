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
        PICKUP: 'pickup',      // Picking up completed repair
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
            case this.INTENT.PICKUP: return '#9b59b6';    // Purple - picking up
            default: return '#ff6b35';
        }
    },

    setInitialTarget(npc) {
        // SERVICE customers go straight to counter - they have a broken device to fix
        // They know why they're here, no need to browse
        if (npc.intent === this.INTENT.SERVICE) {
            this.setCounterTarget(npc);
            npc.intentRevealed = true;  // They're obviously here for service
            return;
        }

        // PICKUP customers go straight to counter - they're here for their repaired device
        if (npc.intent === this.INTENT.PICKUP) {
            this.setCounterTarget(npc);
            npc.intentRevealed = true;
            return;
        }

        // BUY customers MUST go to shelves/tables first to pick items
        // They can't go to counter without something to buy
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
            } else {
                // No shelves/tables to browse - BUY customer leaves (nothing to buy)
                console.log(`[NPC] ${npc.data.name} (BUY) leaving - no browse spots available`);
                npc.state = this.STATE.LEAVING;
                npc.targetSpot = this.positions.door;
                npc.silent = true;  // Don't announce - they're leaving immediately
                return;
            }
        }

        // BROWSE customers (window shoppers) just look around at general browse spots
        if (npc.intent === this.INTENT.BROWSE) {
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
            // No browse spots - just leave
            npc.state = this.STATE.LEAVING;
            npc.targetSpot = this.positions.door;
            return;
        }

        // Fallback for SERVICE (shouldn't reach here, but just in case)
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
        } else if (npc.intent === this.INTENT.PICKUP) {
            // Pickup customers go to service counter (where they dropped off)
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

    // Spawn a pickup NPC for a specific completed job
    spawnPickupNPC(job) {
        if (this.npcs.length >= this.maxNPCs) return null;
        if (!this.positions?.door) return null;

        // Check if door is clear
        const doorBlocked = this.npcs.some(npc =>
            Math.abs(npc.x - this.positions.door.x) < 2 &&
            Math.abs(npc.y - this.positions.door.y) < 2
        );

        if (doorBlocked) return null;

        const npc = {
            id: Date.now() + Math.random(),
            data: {
                name: job.customer,
                device: job.device,
                urgency: { id: 'normal' },
            },
            intent: this.INTENT.PICKUP,
            intentRevealed: true,
            pickupJob: job,  // Reference to the job they're picking up
            state: this.STATE.ENTERING,

            // Position
            x: this.positions.door?.x || 10,
            y: this.positions.door?.y || 12,

            // Movement
            targetSpot: null,
            path: [],
            moveTimer: 0,
            moveSpeed: 250 + Math.random() * 150,
            lastX: -1,
            lastY: -1,
            stuckCount: 0,
            totalStuckTime: 0,

            // Behavior
            browseTime: 0,
            maxBrowseTime: 2000,
            patience: 100,
            patienceDecay: 0.3,  // Patient - they're happy their device is ready!

            // Visual
            color: this.getIntentColor(this.INTENT.PICKUP),
        };

        this.setInitialTarget(npc);
        this.npcs.push(npc);
        return npc;
    },

    // Update all NPCs
    update(deltaTime, isShopOpen) {
        // Spawning is now handled by Shop.js (spawnCustomerOnMap)
        // so we get the "door chimes" message synced with actual spawns

        // Update each NPC
        for (let i = this.npcs.length - 1; i >= 0; i--) {
            const npc = this.npcs[i];
            this.updateNPC(npc, deltaTime);

            // Remove if left (at door or past it - y <= 1)
            if (npc.state === this.STATE.LEAVING && npc.y <= 1) {
                // If NPC was holding an item they didn't buy, return it to inventory
                this.returnItemToInventory(npc);
                this.npcs.splice(i, 1);
            }
        }
    },

    // Return item to shelf/table if NPC leaves without buying
    returnItemToInventory(npc) {
        if (!npc.selectedItem || !npc.selectedItem.alreadyRemovedFromInventory) return;

        const item = npc.selectedItem;
        console.log(`[NPC] ${npc.data.name} left without buying - returning ${item.name} to inventory`);

        if (item.fromTable && item.tableKey) {
            // Return to display table
            const table = InventorySystem.displayTables[item.tableKey];
            if (table) {
                if (table.item && table.item.itemId === item.itemId) {
                    table.item.quantity++;
                } else if (!table.item) {
                    // Table is now empty, put item back
                    const itemData = InventorySystem.getItem(item.itemId);
                    table.item = { itemId: item.itemId, quantity: 1, price: item.price };
                }
            }
        } else if (item.shelfKey) {
            // Return to shelf
            const shelf = InventorySystem.shelves[item.shelfKey];
            if (shelf) {
                const existingSlot = shelf.items.find(i => i.itemId === item.itemId);
                if (existingSlot) {
                    existingSlot.quantity++;
                } else {
                    // Item slot was removed, add it back
                    shelf.items.push({ itemId: item.itemId, quantity: 1, price: item.price });
                }
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
            npc.sidestepDir = null;  // Reset sidestep when reaching target
            return;
        }

        // Track if we actually moved this tick
        let moved = false;
        const lastX = npc.x;
        const lastY = npc.y;

        // Try direct path first (NPCs can overlap each other - no NPC collision)
        if (Math.abs(dx) >= Math.abs(dy) && dx !== 0) {
            if (this.canWalk(npc.x + Math.sign(dx), npc.y)) {
                npc.x += Math.sign(dx);
                moved = true;
                npc.sidestepDir = null;  // Reset sidestep on successful direct move
            }
        }

        if (!moved && dy !== 0) {
            if (this.canWalk(npc.x, npc.y + Math.sign(dy))) {
                npc.y += Math.sign(dy);
                moved = true;
                npc.sidestepDir = null;
            }
        }

        // Try other axis if blocked
        if (!moved && dx !== 0) {
            if (this.canWalk(npc.x + Math.sign(dx), npc.y)) {
                npc.x += Math.sign(dx);
                moved = true;
                npc.sidestepDir = null;
            }
        }

        // If stuck on furniture, try going AROUND it
        // Use remembered sidestep direction to avoid oscillation
        if (!moved) {
            let perpDirs = [];
            if (Math.abs(dx) >= Math.abs(dy)) {
                // Blocked horizontally, try vertical to go around
                perpDirs = [[0, -1], [0, 1]];
            } else {
                // Blocked vertically, try horizontal to go around
                perpDirs = [[-1, 0], [1, 0]];
            }

            // If we have a remembered sidestep direction, try that first
            if (npc.sidestepDir) {
                const preferred = perpDirs.find(d => d[0] === npc.sidestepDir[0] && d[1] === npc.sidestepDir[1]);
                if (preferred) {
                    perpDirs = [preferred, ...perpDirs.filter(d => d !== preferred)];
                }
            }

            for (const [ddx, ddy] of perpDirs) {
                if (this.canWalk(npc.x + ddx, npc.y + ddy)) {
                    npc.x += ddx;
                    npc.y += ddy;
                    npc.sidestepDir = [ddx, ddy];  // Remember which way we sidestepped
                    moved = true;
                    break;
                }
            }
        }

        // Detect oscillation (moved back to where we just were)
        if (moved && npc.lastX === npc.x && npc.lastY === npc.y) {
            // We're oscillating - force a different direction or teleport
            npc.stuckCount += 3;  // Accelerate stuck counter
        }

        // Remember last position for oscillation detection
        npc.lastX = lastX;
        npc.lastY = lastY;

        // Track stuck status
        if (moved) {
            npc.stuckCount = Math.max(0, npc.stuckCount - 1);  // Slowly reduce stuck count
            npc.totalStuckTime = 0;
        } else {
            npc.stuckCount++;
            npc.totalStuckTime += npc.moveSpeed;
        }

        // Emergency escape after being stuck too long
        if (npc.stuckCount > 8 && npc.state !== this.STATE.WAITING) {
            // Teleport one step toward target, ignoring obstacles
            if (Math.abs(dx) > Math.abs(dy)) {
                npc.x += Math.sign(dx);
            } else if (dy !== 0) {
                npc.y += Math.sign(dy);
            } else if (dx !== 0) {
                npc.x += Math.sign(dx);
            }
            npc.stuckCount = 0;
            npc.sidestepDir = null;
            console.log(`[NPC] ${npc.data.name} emergency teleport to escape stuck`);
        }
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

        // Find first item with quantity > 0
        const availableItem = shelf?.items.find(i => i.quantity > 0);

        if (shelf && availableItem) {
            // Check prices - customer has a max they'll pay
            const item = InventorySystem.getItem(availableItem.itemId);
            const shelfPrice = availableItem.price;
            const marketPrice = item?.marketPrice || shelfPrice;

            // Customer tolerance: random 5-35% over market (varies per customer)
            const tolerance = 0.05 + Math.random() * 0.30;
            const maxWillPay = marketPrice * (1 + tolerance);

            if (shelfPrice <= maxWillPay) {
                // They'll buy it - IMMEDIATELY remove from shelf (they're holding it now)
                availableItem.quantity--;
                if (availableItem.quantity <= 0) {
                    shelf.items = shelf.items.filter(i => i.itemId !== availableItem.itemId);
                }

                // Store what they picked up
                npc.selectedItem = {
                    shelfKey: shelfKey,
                    itemId: availableItem.itemId,
                    price: shelfPrice,
                    name: item?.name || 'Item',
                    alreadyRemovedFromInventory: true  // Flag so checkout doesn't double-remove
                };
                npc.browsingShelf = false;
                npc.intentRevealed = true;
                this.setCounterTarget(npc);
                console.log(`[NPC] ${npc.data.name} picked up ${npc.selectedItem.name} at $${shelfPrice} (removed from shelf)`);
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
                // They'll buy it - IMMEDIATELY remove from table (they're holding it now)
                const pickedItemId = table.item.itemId;
                table.item.quantity--;
                if (table.item.quantity <= 0) {
                    table.item = null;
                }

                // Store what they picked up
                npc.selectedItem = {
                    tableKey: tableKey,
                    itemId: pickedItemId,
                    price: tablePrice,
                    name: item?.name || 'Item',
                    fromTable: true,
                    alreadyRemovedFromInventory: true  // Flag so checkout doesn't double-remove
                };
                npc.browsingTable = false;
                npc.intentRevealed = true;
                this.setCounterTarget(npc);
                console.log(`[NPC] ${npc.data.name} picked up ${npc.selectedItem.name} from display at $${tablePrice} (removed from table)`);
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

            // Track for daily stats
            GameState.dailyStats.servicesCompleted++;
            GameState.dailyStats.customersServed++;
            GameState.dailyStats.goodTransactions++;
        }
    },

    // NPC leaves unhappy
    dismissNPC(npcId) {
        const npc = this.npcs.find(n => n.id === npcId);
        if (npc) {
            npc.state = this.STATE.LEAVING;
            npc.targetSpot = this.positions.door;
            npc.color = '#e74c3c';  // Red - unhappy

            // Track for daily stats
            GameState.dailyStats.badTransactions++;
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
