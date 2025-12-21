/* DYSECTOR Shop Prototype - Dev/Playtest Settings */

const DevSettings = {
    // Default settings (stored in GameState.devSettings)
    defaults: {
        walkinFrequency: 5,        // seconds between spawn checks (was 2.5 - too fast)
        customerChance: 12,        // base % chance per check (was 20 - too overwhelming early)
        diveRequiredPct: 40,       // % of jobs that need dive
        desperatePct: 15,          // % of customers that are desperate (was 20 - less pressure early)
        bitMultiplier: 1.5,        // 50% more bits (was 1.0 - 5000 bits took too long)
        cashMultiplier: 1.0,
        billPct: 100,
        startingCash: 1500,
        dailyDiveCharges: 2,
        deadlineBuffer: 1,         // +1 day buffer on all deadlines (was 0 - too tight)
        diveSuccessRate: 80,       // was 70 - more forgiving early game
        infiniteMoney: false,
        infiniteDives: false,
        noFatigue: false
    },

    init() {
        console.log('[DEV] DevSettings.init() starting...');

        // Initialize settings in GameState if not present or incomplete
        if (!GameState.devSettings || typeof GameState.devSettings !== 'object') {
            console.log('[DEV] Creating new devSettings from defaults');
            GameState.devSettings = { ...this.defaults };
        } else {
            // Merge with defaults in case save is missing new keys
            console.log('[DEV] Merging existing devSettings with defaults');
            GameState.devSettings = { ...this.defaults, ...GameState.devSettings };
        }

        this.bindSliders();
        this.bindButtons();
        this.bindToggles();
        this.updateStateDisplay();

        // Update state display periodically
        setInterval(() => this.updateStateDisplay(), 1000);

        console.log('[DEV] DevSettings.init() complete. Settings:', GameState.devSettings);
    },

    bindSliders() {
        const sliders = [
            { id: 'dev-walkin-freq', key: 'walkinFrequency', suffix: 's', decimals: 1 },
            { id: 'dev-customer-chance', key: 'customerChance', suffix: '%', decimals: 0 },
            { id: 'dev-dive-pct', key: 'diveRequiredPct', suffix: '%', decimals: 0 },
            { id: 'dev-desperate-pct', key: 'desperatePct', suffix: '%', decimals: 0 },
            { id: 'dev-bit-mult', key: 'bitMultiplier', suffix: 'x', decimals: 1 },
            { id: 'dev-cash-mult', key: 'cashMultiplier', suffix: 'x', decimals: 1 },
            { id: 'dev-bill-pct', key: 'billPct', suffix: '%', decimals: 0 },
            { id: 'dev-start-cash', key: 'startingCash', prefix: '$', decimals: 0 },
            { id: 'dev-dive-charges', key: 'dailyDiveCharges', suffix: '', decimals: 0 },
            { id: 'dev-deadline-buffer', key: 'deadlineBuffer', prefix: '+', suffix: '', decimals: 0 },
            { id: 'dev-dive-success', key: 'diveSuccessRate', suffix: '%', decimals: 0 }
        ];

        sliders.forEach(slider => {
            const input = document.getElementById(slider.id);
            const display = document.getElementById(slider.id + '-val');

            if (!input || !display) return;

            // Set initial value from GameState (with fallback to defaults)
            const initialValue = GameState.devSettings[slider.key] ?? this.defaults[slider.key] ?? 0;
            input.value = initialValue;
            this.updateSliderDisplay(slider, initialValue, display);

            // Bind change event
            input.addEventListener('input', () => {
                // Ensure devSettings exists
                if (!GameState.devSettings) {
                    GameState.devSettings = { ...this.defaults };
                }
                const value = parseFloat(input.value);
                GameState.devSettings[slider.key] = value;
                this.updateSliderDisplay(slider, value, display);
                this.applySettings();
            });
        });
    },

    updateSliderDisplay(slider, value, display) {
        const prefix = slider.prefix || '';
        const suffix = slider.suffix || '';
        const numValue = parseFloat(value) || 0;
        const formatted = slider.decimals > 0 ? numValue.toFixed(slider.decimals) : Math.round(numValue);
        display.textContent = prefix + formatted + suffix;
    },

    bindButtons() {
        console.log('[DEV] Binding buttons...');

        // Add Cash
        const addCashBtn = document.getElementById('dev-add-cash');
        console.log('[DEV] dev-add-cash button:', addCashBtn ? 'found' : 'NOT FOUND');
        addCashBtn?.addEventListener('click', () => {
            console.log('[DEV] +$500 clicked, current cash:', GameState.cash);
            GameState.cash += 500;
            updateDisplays();
            if (typeof Shop !== 'undefined') {
                Shop.addText('[DEV] +$500 cash', 'success');
            }
        });

        // Add Bits
        document.getElementById('dev-add-bits')?.addEventListener('click', () => {
            GameState.bits += 500;
            updateDisplays();
            if (typeof Shop !== 'undefined') {
                Shop.addText('[DEV] +500 bits', 'success');
            }
        });

        // Add Dive
        document.getElementById('dev-add-dive')?.addEventListener('click', () => {
            GameState.divesRemaining++;
            if (GameState.divesRemaining > GameState.divesMax) {
                GameState.divesMax = GameState.divesRemaining;
            }
            updateDisplays();
            if (typeof Shop !== 'undefined') {
                Shop.addText('[DEV] +1 dive charge', 'success');
            }
        });

        // Skip Day
        document.getElementById('dev-skip-day')?.addEventListener('click', () => {
            if (typeof FatigueSystem !== 'undefined') {
                FatigueSystem.sleep();
            } else {
                advanceDay();
            }
            if (typeof Shop !== 'undefined') {
                Shop.addText('[DEV] Skipped to next day', 'system');
            }
        });

        // Spawn Customer
        document.getElementById('dev-spawn-customer')?.addEventListener('click', () => {
            if (typeof NPCSystem !== 'undefined') {
                const npc = NPCSystem.trySpawn();
                if (npc) {
                    if (typeof Shop !== 'undefined') {
                        Shop.addText('[DEV] Spawned customer', 'system');
                    }
                } else {
                    alert('Could not spawn - shop may be full or closed');
                }
            }
        });

        // Complete All Jobs
        document.getElementById('dev-complete-jobs')?.addEventListener('click', () => {
            let count = 0;
            GameState.activeJobs.forEach(job => {
                if (job.status !== 'complete') {
                    job.status = 'complete';
                    count++;
                }
            });
            if (typeof Shop !== 'undefined') {
                Shop.addText(`[DEV] Completed ${count} jobs`, 'success');
                Shop.updateJobsDisplay();
            }
        });

        // Reset Game
        document.getElementById('dev-reset-game')?.addEventListener('click', () => {
            if (confirm('Reset all game data? This cannot be undone.')) {
                localStorage.removeItem('dysector_save');
                location.reload();
            }
        });
    },

    bindToggles() {
        // Ensure devSettings exists for all toggles
        const ensureSettings = () => {
            if (!GameState.devSettings) {
                GameState.devSettings = { ...this.defaults };
            }
        };

        // Infinite Money
        const infiniteMoneyToggle = document.getElementById('dev-infinite-money');
        if (infiniteMoneyToggle) {
            infiniteMoneyToggle.checked = GameState.devSettings?.infiniteMoney || false;
            infiniteMoneyToggle.addEventListener('change', (e) => {
                ensureSettings();
                GameState.devSettings.infiniteMoney = e.target.checked;
                if (e.target.checked) {
                    GameState.cash = 999999;
                    updateDisplays();
                }
            });
        }

        // Infinite Dives
        const infiniteDivesToggle = document.getElementById('dev-infinite-dives');
        if (infiniteDivesToggle) {
            infiniteDivesToggle.checked = GameState.devSettings?.infiniteDives || false;
            infiniteDivesToggle.addEventListener('change', (e) => {
                ensureSettings();
                GameState.devSettings.infiniteDives = e.target.checked;
                if (e.target.checked) {
                    GameState.divesRemaining = 99;
                    GameState.divesMax = 99;
                    updateDisplays();
                }
            });
        }

        // No Fatigue
        const noFatigueToggle = document.getElementById('dev-no-fatigue');
        if (noFatigueToggle) {
            noFatigueToggle.checked = GameState.devSettings?.noFatigue || false;
            noFatigueToggle.addEventListener('change', (e) => {
                ensureSettings();
                GameState.devSettings.noFatigue = e.target.checked;
                if (e.target.checked) {
                    GameState.fatigue = 0;
                    updateDisplays();
                }
            });
        }
    },

    applySettings() {
        if (!GameState.devSettings) {
            GameState.devSettings = { ...this.defaults };
        }
        const s = GameState.devSettings;

        // Apply dive charges setting
        GameState.divesMax = s.dailyDiveCharges;
        if (GameState.divesRemaining > GameState.divesMax) {
            GameState.divesRemaining = GameState.divesMax;
        }

        // Apply bill percentage
        const baseBills = [
            { name: 'Rent', baseAmount: 500 },
            { name: 'Utilities', baseAmount: 100 }
        ];
        GameState.bills.forEach((bill, i) => {
            if (baseBills[i]) {
                bill.amount = Math.round(baseBills[i].baseAmount * (s.billPct / 100));
            }
        });

        updateDisplays();
    },

    updateStateDisplay() {
        const display = document.getElementById('dev-state-display');
        if (!display) return;

        const items = [
            { label: 'Day', value: `${GameState.currentDayName} ${GameState.currentDay}` },
            { label: 'Cash', value: formatMoney(GameState.cash) },
            { label: 'Bits', value: GameState.bits },
            { label: 'Dives', value: `${GameState.divesRemaining}/${GameState.divesMax}` },
            { label: 'Fatigue', value: `${GameState.fatigue}%` },
            { label: 'Reputation', value: GameState.reputation.toFixed(2) },
            { label: 'Active Jobs', value: GameState.activeJobs.length },
            { label: 'Phase', value: GameState.dayPhase.toUpperCase() },
            { label: 'Shop Open', value: GameState.shopOpen ? 'YES' : 'NO' },
            { label: 'NPCs', value: typeof NPCSystem !== 'undefined' ? NPCSystem.npcs.length : 0 }
        ];

        display.innerHTML = items.map(item => `
            <div class="dev-state-item">
                <span class="label">${item.label}</span>
                <span class="value">${item.value}</span>
            </div>
        `).join('');
    },

    // Get setting value (used by other systems)
    get(key) {
        return GameState.devSettings?.[key] ?? this.defaults[key];
    }
};

// Note: DevSettings.init() is called by main.js after save loading
// to ensure correct initialization order
