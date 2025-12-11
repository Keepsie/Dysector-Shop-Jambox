/* DYSECTOR Shop Prototype - Furniture Placement System */

const FurnitureSystem = {
    // Currently selected furniture to place
    selectedFurniture: null,

    // Placement mode active
    placementMode: false,

    // Furniture definitions
    furnitureTypes: {
        shelf: {
            name: 'Shelf',
            tile: 9, // ShopGenerator.TILES.SHELF
            price: 150,
            description: 'Display and sell items',
            size: { width: 1, height: 1 }
        },
        displayTable: {
            name: 'Display Table',
            tile: 5, // ShopGenerator.TILES.TABLE
            price: 250,
            description: 'Showcase featured items',
            size: { width: 2, height: 2 }
        }
    },

    init() {
        // Nothing needed yet
    },

    // Start placement mode for a furniture type
    startPlacement(furnitureType) {
        if (!GameState.furnitureInventory[furnitureType] ||
            GameState.furnitureInventory[furnitureType] <= 0) {
            console.log('[FURNITURE] No', furnitureType, 'in inventory');
            return false;
        }

        this.selectedFurniture = furnitureType;
        this.placementMode = true;
        console.log('[FURNITURE] Placement mode started for:', furnitureType);
        return true;
    },

    // Cancel placement mode
    cancelPlacement() {
        this.selectedFurniture = null;
        this.placementMode = false;
    },

    // Check if a tile is valid for placement
    canPlaceAt(x, y) {
        if (!ShopMap.map) return false;

        const tile = ShopMap.map[y]?.[x];
        const T = ShopGenerator.TILES;

        // Can only place on regular floor tiles (not backfloor, not wait areas)
        if (tile !== T.FLOOR) return false;

        // Check if it's too close to door (keep path clear)
        const doorPos = ShopMap.keyPositions?.door;
        if (doorPos) {
            const distToDoor = Math.abs(x - doorPos.x) + Math.abs(y - doorPos.y);
            if (distToDoor < 2) return false;
        }

        // Check if it blocks the main aisle (rough center column)
        const centerX = Math.floor(ShopMap.gridWidth / 2);
        if (x >= centerX - 1 && x <= centerX + 1 && y <= 4) {
            return false; // Keep entrance clear
        }

        return true;
    },

    // Place furniture at position
    placeAt(x, y) {
        if (!this.placementMode || !this.selectedFurniture) return false;

        const furnitureType = this.selectedFurniture;
        const furnitureDef = this.furnitureTypes[furnitureType];

        if (!furnitureDef) return false;

        // Check all tiles for multi-tile furniture
        const { width, height } = furnitureDef.size;
        for (let dy = 0; dy < height; dy++) {
            for (let dx = 0; dx < width; dx++) {
                if (!this.canPlaceAt(x + dx, y + dy)) {
                    console.log('[FURNITURE] Cannot place at', x + dx, y + dy);
                    return false;
                }
            }
        }

        // Place the furniture
        for (let dy = 0; dy < height; dy++) {
            for (let dx = 0; dx < width; dx++) {
                ShopMap.map[y + dy][x + dx] = furnitureDef.tile;
            }
        }

        // Remove from inventory
        GameState.furnitureInventory[furnitureType]--;

        // Update key positions
        ShopMap.keyPositions = ShopGenerator.getKeyPositions(
            ShopMap.map, ShopMap.gridWidth, ShopMap.gridHeight
        );

        // Initialize shelf/table in inventory system
        if (furnitureType === 'shelf' && typeof InventorySystem !== 'undefined') {
            InventorySystem.initShelves(ShopMap.map);
        }
        if (furnitureType === 'displayTable' && typeof InventorySystem !== 'undefined') {
            InventorySystem.initDisplayTables(ShopMap.map);
        }

        console.log('[FURNITURE] Placed', furnitureType, 'at', x, y);

        // Exit placement mode if no more of this furniture
        if (GameState.furnitureInventory[furnitureType] <= 0) {
            this.cancelPlacement();
        }

        // Save the game
        if (typeof SaveSystem !== 'undefined') {
            SaveSystem.save();
        }

        return true;
    },

    // Remove furniture at position (refund 50%)
    removeAt(x, y) {
        if (!ShopMap.map) return false;

        const tile = ShopMap.map[y]?.[x];
        const T = ShopGenerator.TILES;

        let furnitureType = null;
        if (tile === T.SHELF) furnitureType = 'shelf';
        else if (tile === T.TABLE) furnitureType = 'displayTable';

        if (!furnitureType) return false;

        // For tables, find all connected table tiles
        if (furnitureType === 'displayTable') {
            // Find top-left corner of table
            let startX = x, startY = y;
            while (startX > 0 && ShopMap.map[startY][startX - 1] === T.TABLE) startX--;
            while (startY > 0 && ShopMap.map[startY - 1][startX] === T.TABLE) startY--;

            // Remove 2x2 table
            for (let dy = 0; dy < 2; dy++) {
                for (let dx = 0; dx < 2; dx++) {
                    if (ShopMap.map[startY + dy]?.[startX + dx] === T.TABLE) {
                        ShopMap.map[startY + dy][startX + dx] = T.FLOOR;
                    }
                }
            }
        } else {
            // Remove single tile shelf
            ShopMap.map[y][x] = T.FLOOR;
        }

        // Add back to inventory
        GameState.furnitureInventory[furnitureType]++;

        // Update key positions
        ShopMap.keyPositions = ShopGenerator.getKeyPositions(
            ShopMap.map, ShopMap.gridWidth, ShopMap.gridHeight
        );

        console.log('[FURNITURE] Removed', furnitureType, 'at', x, y);

        return true;
    },

    // Buy furniture
    buyFurniture(furnitureType) {
        const def = this.furnitureTypes[furnitureType];
        if (!def) return false;

        if (!canAfford(def.price)) {
            console.log('[FURNITURE] Cannot afford', furnitureType);
            return false;
        }

        spendCash(def.price);
        GameState.furnitureInventory[furnitureType]++;

        console.log('[FURNITURE] Bought', furnitureType, 'for $' + def.price);
        return true;
    },

    // Quick fill shop with reasonable layout
    quickFillShop() {
        const T = ShopGenerator.TILES;
        const width = ShopMap.gridWidth;
        const height = ShopMap.gridHeight;
        const dividerY = Math.floor(height * 0.6);

        // Calculate cost
        const shelvesToPlace = 4;
        const tablesToPlace = 2;
        const shelfCost = this.furnitureTypes.shelf.price;
        const tableCost = this.furnitureTypes.displayTable.price;

        // Count what we already have in inventory
        const shelvesOwned = GameState.furnitureInventory.shelf;
        const tablesOwned = GameState.furnitureInventory.displayTable;

        const shelvesToBuy = Math.max(0, shelvesToPlace - shelvesOwned);
        const tablesToBuy = Math.max(0, tablesToPlace - tablesOwned);

        const totalCost = (shelvesToBuy * shelfCost) + (tablesToBuy * tableCost);

        if (!canAfford(totalCost)) {
            if (typeof Shop !== 'undefined') {
                Shop.addText(`[ERROR] Need $${totalCost} to quick-fill shop.`, 'error');
            }
            return false;
        }

        // Spend the money
        if (totalCost > 0) {
            spendCash(totalCost);
        }

        // Add furniture to inventory
        GameState.furnitureInventory.shelf += shelvesToBuy;
        GameState.furnitureInventory.displayTable += tablesToBuy;

        // Clear existing shelves and tables (start fresh)
        for (let y = 1; y < dividerY; y++) {
            for (let x = 1; x < width - 1; x++) {
                const tile = ShopMap.map[y][x];
                if (tile === T.SHELF || tile === T.TABLE) {
                    ShopMap.map[y][x] = T.FLOOR;
                }
            }
        }

        // Place shelves along walls
        const shelfPositions = [
            { x: 1, y: 3 }, { x: 1, y: 4 },  // Left wall
            { x: width - 2, y: 3 }, { x: width - 2, y: 4 }  // Right wall
        ];

        let shelvesPlaced = 0;
        for (const pos of shelfPositions) {
            if (shelvesPlaced >= shelvesToPlace) break;
            if (ShopMap.map[pos.y][pos.x] === T.FLOOR) {
                ShopMap.map[pos.y][pos.x] = T.SHELF;
                GameState.furnitureInventory.shelf--;
                shelvesPlaced++;
            }
        }

        // Place display tables
        const tablePositions = [
            { x: 3, y: 2 },      // Left side
            { x: width - 5, y: 2 }  // Right side
        ];

        let tablesPlaced = 0;
        for (const pos of tablePositions) {
            if (tablesPlaced >= tablesToPlace) break;
            // Check 2x2 area is clear
            let canPlace = true;
            for (let dy = 0; dy < 2; dy++) {
                for (let dx = 0; dx < 2; dx++) {
                    if (ShopMap.map[pos.y + dy]?.[pos.x + dx] !== T.FLOOR) {
                        canPlace = false;
                    }
                }
            }
            if (canPlace) {
                for (let dy = 0; dy < 2; dy++) {
                    for (let dx = 0; dx < 2; dx++) {
                        ShopMap.map[pos.y + dy][pos.x + dx] = T.TABLE;
                    }
                }
                GameState.furnitureInventory.displayTable--;
                tablesPlaced++;
            }
        }

        // Update key positions and inventory system
        ShopMap.keyPositions = ShopGenerator.getKeyPositions(
            ShopMap.map, ShopMap.gridWidth, ShopMap.gridHeight
        );

        if (typeof InventorySystem !== 'undefined') {
            InventorySystem.initShelves(ShopMap.map);
            InventorySystem.initDisplayTables(ShopMap.map);
        }

        if (typeof Shop !== 'undefined') {
            const msg = totalCost > 0
                ? `[SYSTEM] Shop furnished! Spent $${totalCost}.`
                : '[SYSTEM] Shop furnished using inventory.';
            Shop.addText(msg, 'system');
        }

        // Save
        if (typeof SaveSystem !== 'undefined') {
            SaveSystem.save();
        }

        return true;
    },

    // Get inventory counts for UI
    getInventoryCounts() {
        return { ...GameState.furnitureInventory };
    }
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    FurnitureSystem.init();
});
