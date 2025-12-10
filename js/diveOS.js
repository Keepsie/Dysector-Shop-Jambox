/* DYSECTOR Shop Prototype - Dive OS Tab Logic */
/* Avatar Loadout & Bits Shop */

const DiveOS = {
    currentShopTab: 'buy',

    // Avatar state
    avatar: {
        shield: 100,
        shieldMax: 100,
        health: 100,
        healthMax: 100,
        mods: [null, null, null], // 3 avatar mod slots
    },

    // Weapons
    weapons: {
        owned: ['pistol'],
        equipped: ['pistol', null], // 2 weapon slots
        weaponMods: {
            'pistol': [null, null],
        }
    },

    // Consumables
    consumables: {
        ammo: 60,
        ammoMax: 60,
        healthPacks: 3,
        software: []
    },

    // Inventory of owned mods
    ownedMods: [],

    init() {
        this.bindEvents();
        this.updateDisplays();
    },

    bindEvents() {
        // Shop tab switching
        document.querySelectorAll('.shop-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                this.switchShopTab(tab.dataset.shop);
            });
        });

        // Buy buttons
        document.querySelectorAll('.shop-item .buy-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const item = e.target.closest('.shop-item');
                if (item) {
                    this.buyConsumable(item.dataset.item);
                }
            });
        });

        // Weapon buy buttons
        document.querySelectorAll('.weapon-buy').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const card = e.target.closest('.weapon-card');
                if (card) {
                    this.buyWeapon(card.dataset.weapon);
                }
            });
        });

        // Mod buy buttons
        document.querySelectorAll('.mod-card .buy-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const card = e.target.closest('.mod-card');
                if (card) {
                    this.buyMod(card.dataset.mod);
                }
            });
        });

        // Test buttons
        document.querySelectorAll('.test-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const card = e.target.closest('.test-card');
                if (card && !btn.disabled) {
                    this.takeTest(card.dataset.test);
                }
            });
        });
    },

    switchShopTab(tabName) {
        this.currentShopTab = tabName;

        // Update tab buttons
        document.querySelectorAll('.shop-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.shop === tabName);
        });

        // Update panels
        document.querySelectorAll('.shop-panel').forEach(panel => {
            panel.classList.toggle('active', panel.id === `shop-${tabName}`);
        });
    },

    buyConsumable(itemType) {
        const prices = {
            'ammo': 20,
            'health': 35,
            'shield': 25,
            'firewall': 50,
            'decrypt': 40
        };

        const price = prices[itemType];
        if (!price) return;

        if (GameState.bits < price) {
            alert('Not enough bits!');
            return;
        }

        spendBits(price);

        switch (itemType) {
            case 'ammo':
                this.consumables.ammo = Math.min(this.consumables.ammoMax, this.consumables.ammo + 30);
                break;
            case 'health':
                this.consumables.healthPacks++;
                break;
            case 'shield':
                // Shield cells - could be separate consumable
                this.consumables.healthPacks++; // For now, treat as health pack variant
                break;
            case 'firewall':
            case 'decrypt':
                this.consumables.software.push(itemType);
                break;
        }

        this.updateDisplays();
    },

    buyWeapon(weaponId) {
        const prices = {
            'smg': 150,
            'rifle': 200,
            'shotgun': 180,
            'sniper': 250
        };

        const price = prices[weaponId];
        if (!price) return;

        if (this.weapons.owned.includes(weaponId)) {
            alert('Already owned!');
            return;
        }

        if (GameState.bits < price) {
            alert('Not enough bits!');
            return;
        }

        spendBits(price);
        this.weapons.owned.push(weaponId);
        this.weapons.weaponMods[weaponId] = [null, null];

        // Auto-equip to empty slot if available
        const emptySlot = this.weapons.equipped.indexOf(null);
        if (emptySlot !== -1) {
            this.weapons.equipped[emptySlot] = weaponId;
        }

        this.updateDisplays();
        this.renderArmory();
        this.renderLoadout();
    },

    buyMod(modId) {
        const prices = {
            'shield-boost': 80,
            'quick-regen': 100,
            'extended-mag': 60,
            'damage-amp': 90
        };

        const price = prices[modId];
        if (!price) return;

        if (GameState.bits < price) {
            alert('Not enough bits!');
            return;
        }

        spendBits(price);
        this.ownedMods.push(modId);

        alert(`Purchased ${modId}! Go to loadout to equip.`);
        this.updateDisplays();
    },

    takeTest(testLevel) {
        const costs = {
            'c': 100,
            'b': 250,
            'a': 500
        };

        const cost = costs[testLevel];
        if (!cost) return;

        // Check prerequisites
        if (testLevel === 'b' && !GameState.licenses.c) {
            alert('You need C-License first!');
            return;
        }
        if (testLevel === 'a' && !GameState.licenses.b) {
            alert('You need B-License first!');
            return;
        }

        if (GameState.bits < cost) {
            alert('Not enough bits for test fee!');
            return;
        }

        // Simulate test (in real game, this would launch a probe challenge)
        const passed = confirm(`Take ${testLevel.toUpperCase()}-License test for ${cost} bits?\n\n[This would be a skill challenge in the real game]\n\nClick OK to simulate passing.`);

        if (passed) {
            spendBits(cost);

            // Mark as ready for license purchase (still need cash at Shop OS)
            alert(`Test PASSED! You've proven your skill.\n\nNow visit Shop OS > Licenses to purchase your ${testLevel.toUpperCase()}-License with cash.`);
        }

        this.updateDisplays();
    },

    updateDisplays() {
        // Update bits display
        const bitsDisplay = document.getElementById('dive-bits');
        if (bitsDisplay) bitsDisplay.textContent = GameState.bits;

        // Update consumables
        const ammoCount = document.getElementById('ammo-count');
        if (ammoCount) ammoCount.textContent = `${this.consumables.ammo}/${this.consumables.ammoMax}`;

        const healthPackCount = document.getElementById('health-pack-count');
        if (healthPackCount) healthPackCount.textContent = this.consumables.healthPacks;

        const softwareCount = document.getElementById('software-count');
        if (softwareCount) softwareCount.textContent = this.consumables.software.length;
    },

    renderArmory() {
        // Update weapon cards to show owned status
        document.querySelectorAll('.weapon-card').forEach(card => {
            const weaponId = card.dataset.weapon;
            const isOwned = this.weapons.owned.includes(weaponId);

            if (isOwned) {
                card.classList.remove('locked');
                const buyBtn = card.querySelector('.weapon-buy');
                if (buyBtn) {
                    buyBtn.outerHTML = '<span class="weapon-owned">OWNED</span>';
                }
            }
        });
    },

    renderLoadout() {
        // Update weapon slots in loadout
        const weaponSlots = document.querySelectorAll('.weapon-slot');
        weaponSlots.forEach((slot, index) => {
            const weaponId = this.weapons.equipped[index];
            if (weaponId) {
                slot.classList.remove('empty');
                slot.classList.add('equipped');
                // Update slot content based on equipped weapon
            } else {
                slot.classList.remove('equipped');
                slot.classList.add('empty');
            }
        });
    }
};

// Initialize when DOM ready
document.addEventListener('DOMContentLoaded', () => {
    DiveOS.init();
});
