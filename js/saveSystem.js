/* DYSECTOR Shop Prototype - Save System */

const SaveSystem = {
    SAVE_KEY: 'dysector_shop_save',
    VERSION: 5,  // Bumped for path-safe shelf placement

    // Default new game state
    getDefaultState() {
        return {
            version: this.VERSION,
            created: Date.now(),
            lastPlayed: Date.now(),

            // Player
            player: {
                name: 'Tech',
                cash: 2500,
                bits: 150,
                reputation: 50,  // 0-100
                licenses: ['d'],  // d, c, b, a, s
            },

            // Time
            time: {
                day: 1,
                hour: 8,
                minute: 0,
                phase: 'morning',  // morning, open, closed
            },

            // Shop layout (will be proc-gen)
            shop: {
                seed: null,  // For regenerating same layout
                width: 20,
                height: 14,
                layout: null,  // 2D array of tile types
            },

            // Resources
            fatigue: 0,
            divesRemaining: 2,
            maxDives: 2,

            // Jobs
            activeJobs: [],
            completedJobs: [],

            // Inventory
            inventory: {
                devices: [],
                software: [],
                cases: [],
                consumables: {
                    ammo: 60,
                    healthPacks: 3,
                    shieldCells: 2,
                },
            },

            // Workbench
            workbench: [null, null, null],  // 3 slots

            // Stats
            stats: {
                totalCustomers: 0,
                totalEarnings: 0,
                jobsCompleted: 0,
                jobsFailed: 0,
                daysPlayed: 0,
            },

            // Bills
            bills: [
                { id: 'rent', name: 'Rent', amount: 500, dueDay: 7, paid: false },
                { id: 'utilities', name: 'Utilities', amount: 100, dueDay: 7, paid: false },
            ],
        };
    },

    // Check if save exists
    hasSave() {
        return localStorage.getItem(this.SAVE_KEY) !== null;
    },

    // Save current game state
    save(gameState) {
        const saveData = {
            ...gameState,
            lastPlayed: Date.now(),
        };

        try {
            localStorage.setItem(this.SAVE_KEY, JSON.stringify(saveData));
            console.log('[SAVE] Game saved');
            return true;
        } catch (e) {
            console.error('[SAVE] Failed to save:', e);
            return false;
        }
    },

    // Load saved game
    load() {
        try {
            const data = localStorage.getItem(this.SAVE_KEY);
            if (!data) return null;

            const saveData = JSON.parse(data);

            // Version migration if needed
            if (saveData.version < this.VERSION) {
                return this.migrate(saveData);
            }

            console.log('[SAVE] Game loaded');
            return saveData;
        } catch (e) {
            console.error('[SAVE] Failed to load:', e);
            return null;
        }
    },

    // Migrate old saves to new version
    migrate(oldSave) {
        console.log('[SAVE] Migrating save from version', oldSave.version, 'to', this.VERSION);

        // Version 2: New shop layout (door at top, workbenches at bottom)
        // Force regenerate layout but keep other game state
        if (oldSave.version < 2) {
            console.log('[SAVE] Regenerating shop layout for v2');
            oldSave.shop.layout = null;  // Clear old layout, will regenerate
        }

        // Version 3: Guaranteed counter placement
        if (oldSave.version < 3) {
            console.log('[SAVE] Regenerating shop layout for v3 (guaranteed counters)');
            oldSave.shop.layout = null;  // Clear old layout, will regenerate
        }

        // Version 4: Varied shelf placement
        if (oldSave.version < 4) {
            console.log('[SAVE] Regenerating shop layout for v4 (varied shelves)');
            oldSave.shop.layout = null;
        }

        // Version 5: Path-safe shelf placement
        if (oldSave.version < 5) {
            console.log('[SAVE] Regenerating shop layout for v5 (path-safe shelves)');
            oldSave.shop.layout = null;
        }

        oldSave.version = this.VERSION;
        return oldSave;
    },

    // Delete save
    deleteSave() {
        localStorage.removeItem(this.SAVE_KEY);
        console.log('[SAVE] Save deleted');
    },

    // Start new game
    newGame(seed = null) {
        const state = this.getDefaultState();
        state.shop.seed = seed || Date.now();
        state.created = Date.now();

        // Generate shop layout with seed
        state.shop.layout = ShopGenerator.generate(state.shop.seed, state.shop.width, state.shop.height);

        this.save(state);
        return state;
    },

    // Auto-save (call periodically or on important events)
    autoSave() {
        if (typeof GameState !== 'undefined') {
            const state = this.serializeGameState();
            this.save(state);
        }
    },

    // Convert current GameState to save format
    serializeGameState() {
        return {
            version: this.VERSION,
            created: GameState.created || Date.now(),
            lastPlayed: Date.now(),

            player: {
                name: GameState.playerName || 'Tech',
                cash: GameState.cash,
                bits: GameState.bits,
                reputation: GameState.reputation || 50,
                licenses: GameState.licenses || ['d'],
            },

            time: {
                day: GameState.currentDay,
                hour: GameState.currentHour,
                minute: GameState.currentMinute,
                phase: GameState.dayPhase,
            },

            shop: {
                seed: GameState.shopSeed,
                width: GameState.shopWidth || 20,
                height: GameState.shopHeight || 14,
                layout: GameState.shopLayout,
            },

            fatigue: GameState.fatigue,
            divesRemaining: GameState.divesRemaining,
            maxDives: GameState.maxDives,

            activeJobs: GameState.activeJobs,
            completedJobs: GameState.completedJobs || [],

            inventory: GameState.inventory || {},
            workbench: GameState.workbenchSlots,

            stats: GameState.stats || {},
            bills: GameState.bills,
        };
    },

    // Load save data into GameState
    deserializeToGameState(saveData) {
        GameState.created = saveData.created;
        GameState.cash = saveData.player.cash;
        GameState.bits = saveData.player.bits;
        GameState.reputation = saveData.player.reputation;
        GameState.licenses = saveData.player.licenses;

        GameState.currentDay = saveData.time.day;
        GameState.currentHour = saveData.time.hour;
        GameState.currentMinute = saveData.time.minute;
        GameState.dayPhase = saveData.time.phase;

        GameState.shopSeed = saveData.shop.seed;
        GameState.shopWidth = saveData.shop.width;
        GameState.shopHeight = saveData.shop.height;
        GameState.shopLayout = saveData.shop.layout;

        GameState.fatigue = saveData.fatigue;
        GameState.divesRemaining = saveData.divesRemaining;
        GameState.maxDives = saveData.maxDives;

        GameState.activeJobs = saveData.activeJobs;
        GameState.completedJobs = saveData.completedJobs;

        GameState.inventory = saveData.inventory;
        GameState.workbenchSlots = saveData.workbench;

        GameState.stats = saveData.stats;
        GameState.bills = saveData.bills;
    },
};

// Auto-save every 30 seconds during gameplay
setInterval(() => {
    if (typeof GameState !== 'undefined' && GameState.dayPhase !== 'menu') {
        SaveSystem.autoSave();
    }
}, 30000);
