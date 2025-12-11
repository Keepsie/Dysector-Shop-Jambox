/* DYSECTOR Shop Prototype - Inventory & Shelf System */

const InventorySystem = {
    // Player's backstock (items not on shelves yet)
    backstock: [],

    // Shelf data - keyed by "x,y" position
    shelves: {},

    // Item catalog - what can be sold
    // costPrice = what you pay wholesale, marketPrice = what customers expect to pay
    // license = required license to buy ('e' = starter, 'c', 'b', 'a')
    ITEMS: [
        // E-License (starter) - Basic items
        { id: 'cable_usb', name: 'USB Cable', category: 'cables', costPrice: 5, marketPrice: 8, icon: 'C', license: 'e' },
        { id: 'cable_hdmi', name: 'HDMI Cable', category: 'cables', costPrice: 9, marketPrice: 15, icon: 'C', license: 'e' },
        { id: 'cable_power', name: 'Power Cable', category: 'cables', costPrice: 7, marketPrice: 12, icon: 'C', license: 'e' },
        { id: 'adapter_usbc', name: 'USB-C Adapter', category: 'adapters', costPrice: 12, marketPrice: 20, icon: 'A', license: 'e' },
        { id: 'mouse_basic', name: 'Basic Mouse', category: 'peripherals', costPrice: 8, marketPrice: 15, icon: 'M', license: 'e' },
        { id: 'keyboard_basic', name: 'Basic Keyboard', category: 'peripherals', costPrice: 14, marketPrice: 25, icon: 'K', license: 'e' },
        { id: 'flash_16gb', name: '16GB Flash Drive', category: 'storage', costPrice: 5, marketPrice: 10, icon: 'F', license: 'e' },
        { id: 'thermal_paste', name: 'Thermal Paste', category: 'supplies', costPrice: 4, marketPrice: 8, icon: 'T', license: 'e' },
        { id: 'cleaning_kit', name: 'Cleaning Kit', category: 'supplies', costPrice: 8, marketPrice: 15, icon: 'T', license: 'e' },

        // C-License - Mid-tier items
        { id: 'adapter_display', name: 'Display Adapter', category: 'adapters', costPrice: 15, marketPrice: 25, icon: 'A', license: 'c' },
        { id: 'headset_basic', name: 'Basic Headset', category: 'audio', costPrice: 18, marketPrice: 30, icon: 'H', license: 'c' },
        { id: 'flash_64gb', name: '64GB Flash Drive', category: 'storage', costPrice: 10, marketPrice: 18, icon: 'F', license: 'c' },
        { id: 'ram_8gb', name: '8GB RAM', category: 'components', costPrice: 20, marketPrice: 35, icon: 'R', license: 'c' },
        { id: 'cooler_fan', name: 'CPU Cooler', category: 'components', costPrice: 18, marketPrice: 30, icon: 'X', license: 'c' },

        // B-License - Higher tier items
        { id: 'mouse_gaming', name: 'Gaming Mouse', category: 'peripherals', costPrice: 28, marketPrice: 45, icon: 'M', license: 'b' },
        { id: 'keyboard_mech', name: 'Mechanical Keyboard', category: 'peripherals', costPrice: 50, marketPrice: 80, icon: 'K', license: 'b' },
        { id: 'headset_gaming', name: 'Gaming Headset', category: 'audio', costPrice: 40, marketPrice: 65, icon: 'H', license: 'b' },
        { id: 'ssd_256', name: '256GB SSD', category: 'storage', costPrice: 28, marketPrice: 45, icon: 'S', license: 'b' },
        { id: 'ram_16gb', name: '16GB RAM', category: 'components', costPrice: 35, marketPrice: 60, icon: 'R', license: 'b' },

        // A-License - Premium items
        { id: 'ssd_512', name: '512GB SSD', category: 'storage', costPrice: 42, marketPrice: 70, icon: 'S', license: 'a' },
    ],

    // Check if player has required license for item
    hasLicenseFor(itemId) {
        const item = this.getItem(itemId);
        if (!item) return false;

        const license = item.license || 'e';
        if (license === 'e') return true;
        if (license === 'c') return GameState.licenses.c || GameState.licenses.b || GameState.licenses.a;
        if (license === 'b') return GameState.licenses.b || GameState.licenses.a;
        if (license === 'a') return GameState.licenses.a;
        return false;
    },

    // Get item by ID
    getItem(itemId) {
        return this.ITEMS.find(i => i.id === itemId);
    },

    // Initialize shelves and display tables from map
    initShelves(map) {
        const T = ShopGenerator.TILES;
        this.shelves = {};
        this.displayTables = {};

        for (let y = 0; y < map.length; y++) {
            for (let x = 0; x < map[y].length; x++) {
                const key = `${x},${y}`;
                if (map[y][x] === T.SHELF) {
                    this.shelves[key] = {
                        x: x,
                        y: y,
                        items: [],      // Array of {itemId, quantity, price}
                        maxSlots: 3,    // How many different items can be on this shelf
                        maxPerSlot: 10, // Max quantity per item type
                    };
                } else if (map[y][x] === T.TABLE) {
                    this.displayTables[key] = {
                        x: x,
                        y: y,
                        item: null,     // Single item: {itemId, quantity, price}
                        maxQuantity: 5, // Max quantity for display table
                    };
                }
            }
        }

        console.log(`[INVENTORY] Initialized ${Object.keys(this.shelves).length} shelves, ${Object.keys(this.displayTables).length} display tables`);
    },

    // Add item to backstock
    addToBackstock(itemId, quantity = 1) {
        const existing = this.backstock.find(b => b.itemId === itemId);
        if (existing) {
            existing.quantity += quantity;
        } else {
            this.backstock.push({ itemId, quantity });
        }
    },

    // Remove from backstock
    removeFromBackstock(itemId, quantity = 1) {
        const existing = this.backstock.find(b => b.itemId === itemId);
        if (existing) {
            existing.quantity -= quantity;
            if (existing.quantity <= 0) {
                this.backstock = this.backstock.filter(b => b.itemId !== itemId);
            }
            return true;
        }
        return false;
    },

    // Get backstock quantity for item
    getBackstockQuantity(itemId) {
        const existing = this.backstock.find(b => b.itemId === itemId);
        return existing ? existing.quantity : 0;
    },

    // Stock item on shelf
    stockShelf(shelfKey, itemId, quantity, price) {
        const shelf = this.shelves[shelfKey];
        if (!shelf) return { success: false, error: 'Shelf not found' };

        const item = this.getItem(itemId);
        if (!item) return { success: false, error: 'Item not found' };

        // Check backstock
        const backstockQty = this.getBackstockQuantity(itemId);
        if (backstockQty < quantity) {
            return { success: false, error: 'Not enough in backstock' };
        }

        // Check if item already on shelf
        const existing = shelf.items.find(i => i.itemId === itemId);
        if (existing) {
            // Add to existing
            const canAdd = Math.min(quantity, shelf.maxPerSlot - existing.quantity);
            if (canAdd <= 0) return { success: false, error: 'Shelf slot full' };

            existing.quantity += canAdd;
            existing.price = price;  // Update price
            this.removeFromBackstock(itemId, canAdd);
            return { success: true, added: canAdd };
        }

        // New item slot
        if (shelf.items.length >= shelf.maxSlots) {
            return { success: false, error: 'No empty slots on shelf' };
        }

        const toAdd = Math.min(quantity, shelf.maxPerSlot);
        shelf.items.push({ itemId, quantity: toAdd, price });
        this.removeFromBackstock(itemId, toAdd);
        return { success: true, added: toAdd };
    },

    // Remove item from shelf back to backstock
    unstockShelf(shelfKey, itemId, quantity) {
        const shelf = this.shelves[shelfKey];
        if (!shelf) return false;

        const existing = shelf.items.find(i => i.itemId === itemId);
        if (!existing) return false;

        const toRemove = Math.min(quantity, existing.quantity);
        existing.quantity -= toRemove;
        this.addToBackstock(itemId, toRemove);

        if (existing.quantity <= 0) {
            shelf.items = shelf.items.filter(i => i.itemId !== itemId);
        }

        return true;
    },

    // Get shelf display info
    getShelfDisplay(shelfKey) {
        const shelf = this.shelves[shelfKey];
        if (!shelf) return { empty: true, label: 'E', count: 0 };

        const totalItems = shelf.items.reduce((sum, i) => sum + i.quantity, 0);
        if (totalItems === 0) {
            return { empty: true, label: 'E', count: 0 };
        }

        return {
            empty: false,
            label: totalItems > 9 ? '9+' : String(totalItems),
            count: totalItems,
            items: shelf.items
        };
    },

    // === DISPLAY TABLE METHODS ===

    // Stock display table (single item type)
    stockDisplayTable(tableKey, itemId, quantity, price) {
        const table = this.displayTables[tableKey];
        if (!table) return { success: false, error: 'Display table not found' };

        const item = this.getItem(itemId);
        if (!item) return { success: false, error: 'Item not found' };

        const backstockQty = this.getBackstockQuantity(itemId);
        if (backstockQty < quantity) {
            return { success: false, error: 'Not enough in backstock' };
        }

        const toAdd = Math.min(quantity, table.maxQuantity);

        if (table.item && table.item.itemId === itemId) {
            // Add to existing
            const canAdd = Math.min(toAdd, table.maxQuantity - table.item.quantity);
            if (canAdd <= 0) return { success: false, error: 'Display full' };
            table.item.quantity += canAdd;
            table.item.price = price;
            this.removeFromBackstock(itemId, canAdd);
            return { success: true, added: canAdd };
        } else if (table.item) {
            // Different item - can't mix on display table
            return { success: false, error: 'Remove current item first' };
        }

        // New item on empty table
        table.item = { itemId, quantity: toAdd, price };
        this.removeFromBackstock(itemId, toAdd);
        return { success: true, added: toAdd };
    },

    // Remove from display table
    unstockDisplayTable(tableKey, quantity = 1) {
        const table = this.displayTables[tableKey];
        if (!table || !table.item) return false;

        const toRemove = Math.min(quantity, table.item.quantity);
        table.item.quantity -= toRemove;
        this.addToBackstock(table.item.itemId, toRemove);

        if (table.item.quantity <= 0) {
            table.item = null;
        }

        return true;
    },

    // Get display table info
    getDisplayTableDisplay(tableKey) {
        const table = this.displayTables[tableKey];
        if (!table) return { empty: true, label: 'E', count: 0 };

        if (!table.item || table.item.quantity === 0) {
            return { empty: true, label: 'E', count: 0 };
        }

        const item = this.getItem(table.item.itemId);
        return {
            empty: false,
            label: String(table.item.quantity),
            count: table.item.quantity,
            item: table.item,
            itemData: item
        };
    },

    // Purchase from display table
    purchaseFromDisplayTable(tableKey) {
        const table = this.displayTables[tableKey];
        if (!table || !table.item || table.item.quantity <= 0) return null;

        const itemData = this.getItem(table.item.itemId);
        const result = {
            itemId: table.item.itemId,
            name: itemData?.name || table.item.itemId,
            price: table.item.price,
            marketPrice: itemData?.marketPrice || table.item.price
        };

        table.item.quantity--;
        if (table.item.quantity <= 0) {
            table.item = null;
        }

        return result;
    },

    // Get total items on all shelves for a specific item type
    getTotalOnShelves(itemId) {
        let total = 0;
        for (const shelf of Object.values(this.shelves)) {
            const item = shelf.items.find(i => i.itemId === itemId);
            if (item) total += item.quantity;
        }
        return total;
    },

    // Find cheapest shelf with item (for customer AI)
    findCheapestShelf(itemId) {
        let cheapest = null;
        let cheapestPrice = Infinity;

        for (const [key, shelf] of Object.entries(this.shelves)) {
            const item = shelf.items.find(i => i.itemId === itemId && i.quantity > 0);
            if (item && item.price < cheapestPrice) {
                cheapest = { shelf, key, item };
                cheapestPrice = item.price;
            }
        }

        return cheapest;
    },

    // Get random available item from shelves (for customer AI)
    getRandomAvailableItem() {
        const available = [];
        for (const [key, shelf] of Object.entries(this.shelves)) {
            for (const item of shelf.items) {
                if (item.quantity > 0) {
                    available.push({ shelfKey: key, shelf, ...item });
                }
            }
        }

        if (available.length === 0) return null;
        return available[Math.floor(Math.random() * available.length)];
    },

    // Purchase item from shelf (customer buys)
    purchaseFromShelf(shelfKey, itemId) {
        const shelf = this.shelves[shelfKey];
        if (!shelf) return null;

        const item = shelf.items.find(i => i.itemId === itemId && i.quantity > 0);
        if (!item) return null;

        item.quantity--;
        const itemData = this.getItem(itemId);

        if (item.quantity <= 0) {
            shelf.items = shelf.items.filter(i => i.itemId !== itemId);
        }

        // Track for daily stats
        GameState.dailyStats.itemsSold++;
        GameState.dailyStats.customersServed++;
        // Good transaction if price is fair (within 30% of market)
        const marketPrice = itemData?.marketPrice || item.price;
        if (item.price <= marketPrice * 1.3) {
            GameState.dailyStats.goodTransactions++;
        } else {
            GameState.dailyStats.badTransactions++;  // Overpriced
        }

        return {
            itemId,
            name: itemData?.name || itemId,
            price: item.price,
            marketPrice: itemData?.marketPrice || item.price
        };
    },

    // Save shelf data
    getSaveData() {
        return {
            backstock: this.backstock,
            shelves: this.shelves
        };
    },

    // Load shelf data
    loadSaveData(data) {
        if (data) {
            this.backstock = data.backstock || [];
            this.shelves = data.shelves || {};
        }
    },

    // Give starter inventory - now empty, player buys from wholesale
    giveStarterInventory() {
        // Start with nothing - player must buy from Supplier
        this.backstock = [];
        console.log('[INVENTORY] Starting with empty backstock - buy from Supplier!');
    },

    // Quick stock shelves - buys items if needed, then places them
    quickStockAll() {
        // Count how many shelf slots need filling
        let slotsToFill = 0;
        for (const shelf of Object.values(this.shelves)) {
            slotsToFill += shelf.maxSlots - shelf.items.length;
        }
        // Count empty display tables
        let tablesToFill = 0;
        for (const table of Object.values(this.displayTables)) {
            if (!table.item) tablesToFill++;
        }

        if (slotsToFill === 0 && tablesToFill === 0) {
            if (typeof Shop !== 'undefined') {
                Shop.addText('[SYSTEM] All shelves and tables already stocked!', 'system');
            }
            return;
        }

        // Calculate what we need to buy
        // Each shelf slot gets ~3 items, each table gets ~2
        const itemsNeeded = (slotsToFill * 3) + (tablesToFill * 2);

        // Check what's in backstock already
        const currentBackstock = this.backstock.reduce((sum, b) => sum + b.quantity, 0);
        const toBuy = Math.max(0, itemsNeeded - currentBackstock);

        let totalCost = 0;
        let itemsBought = 0;

        // Buy a variety of items if needed
        if (toBuy > 0) {
            // Pick random cheap items to buy
            const cheapItems = [...this.ITEMS].sort((a, b) => a.costPrice - b.costPrice);
            let remaining = toBuy;

            for (const item of cheapItems) {
                if (remaining <= 0) break;

                const buyQty = Math.min(remaining, 5); // Buy up to 5 of each
                const cost = item.costPrice * buyQty;

                if (canAfford(cost)) {
                    spendCash(cost);
                    this.addToBackstock(item.id, buyQty);
                    totalCost += cost;
                    itemsBought += buyQty;
                    remaining -= buyQty;
                }
            }

            if (itemsBought === 0 && currentBackstock === 0) {
                if (typeof Shop !== 'undefined') {
                    Shop.addText('[ERROR] Not enough cash to buy inventory!', 'error');
                }
                return;
            }
        }

        // Now place items from backstock
        let itemsPlaced = 0;

        // Stock shelves from backstock
        for (const [key, shelf] of Object.entries(this.shelves)) {
            if (shelf.items.length >= shelf.maxSlots) continue;

            for (const bs of this.backstock) {
                if (bs.quantity <= 0) continue;
                if (shelf.items.some(s => s.itemId === bs.itemId)) continue;
                if (shelf.items.length >= shelf.maxSlots) break;

                const itemData = this.getItem(bs.itemId);
                if (!itemData) continue;

                const toPlace = Math.min(bs.quantity, 3);
                const price = itemData.marketPrice;

                shelf.items.push({ itemId: bs.itemId, quantity: toPlace, price: price });
                bs.quantity -= toPlace;
                itemsPlaced += toPlace;
            }
        }

        // Stock display tables from backstock
        for (const [key, table] of Object.entries(this.displayTables)) {
            if (table.item) continue;

            for (const bs of this.backstock) {
                if (bs.quantity <= 0) continue;

                const itemData = this.getItem(bs.itemId);
                if (!itemData) continue;

                const toPlace = Math.min(bs.quantity, 2);
                const price = itemData.marketPrice;

                table.item = { itemId: bs.itemId, quantity: toPlace, price: price };
                bs.quantity -= toPlace;
                itemsPlaced += toPlace;
                break;
            }
        }

        // Clean up empty backstock entries
        this.backstock = this.backstock.filter(b => b.quantity > 0);

        // Report what happened
        if (typeof Shop !== 'undefined') {
            if (totalCost > 0) {
                Shop.addText(`[SYSTEM] Bought ${itemsBought} items for $${totalCost}, placed ${itemsPlaced} on shelves.`, 'system');
            } else if (itemsPlaced > 0) {
                Shop.addText(`[SYSTEM] Placed ${itemsPlaced} items from backstock.`, 'system');
            }
        }

        console.log(`[INVENTORY] Quick stock: bought ${itemsBought} ($${totalCost}), placed ${itemsPlaced}`);
    }
};
