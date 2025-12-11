/* DYSECTOR Shop Prototype - Shop OS Tab Logic */

const ShopOS = {
    windowElement: null,
    windowTitle: null,
    windowContent: null,
    currentApp: null,

    init() {
        this.windowElement = document.getElementById('os-window');
        this.windowTitle = document.querySelector('.window-title');
        this.windowContent = document.getElementById('window-content');

        this.bindEvents();
        this.updateSecretApps();
    },

    // Show/hide secret apps based on license level
    updateSecretApps() {
        const nullsecIcon = document.getElementById('nullsec-icon');
        if (nullsecIcon) {
            // Show Null_Sector when player has C license or higher
            const hasAccess = GameState.licenses.c || GameState.licenses.b || GameState.licenses.a;
            nullsecIcon.style.display = hasAccess ? '' : 'none';
        }
    },

    bindEvents() {
        // Desktop icons
        document.querySelectorAll('.os-icon').forEach(icon => {
            icon.addEventListener('click', () => {
                const app = icon.dataset.app;
                this.openApp(app);
            });
        });

        // Window close button
        document.querySelector('.window-close')?.addEventListener('click', () => {
            this.closeWindow();
        });
    },

    openApp(appName) {
        this.currentApp = appName;

        const apps = {
            'furniture': { title: 'FURNITURE SHOP', render: () => this.renderFurniture() },
            'supplier': { title: 'WHOLESALE SUPPLIER', render: () => this.renderSupplier() },
            'liquidation': { title: 'LIQUIDATION PALLETS', render: () => this.renderLiquidation() },
            'licenses': { title: 'LICENSE MANAGER', render: () => this.renderLicenses() },
            'bills': { title: 'BILLS & EXPENSES', render: () => this.renderBills() },
            'bank': { title: 'SYNC BANK', render: () => this.renderBank() },
            'reviews': { title: 'SHOP REVIEWS', render: () => this.renderReviews() },
            'hire': { title: 'HIRE STAFF', render: () => this.renderHire() },
            'null-sector': { title: '???_CONNECTION', render: () => this.renderNullSector() }
        };

        const app = apps[appName];
        if (!app) return;

        this.windowTitle.textContent = app.title;
        app.render();
        this.windowElement.style.display = 'flex';
    },

    closeWindow() {
        this.windowElement.style.display = 'none';
        this.currentApp = null;
    },

    // Supplier App - Wholesale inventory purchasing
    renderSupplier() {
        // Get items from InventorySystem, grouped by category
        const items = typeof InventorySystem !== 'undefined' ? InventorySystem.ITEMS : [];
        const categories = {};

        for (const item of items) {
            if (!categories[item.category]) {
                categories[item.category] = [];
            }
            categories[item.category].push(item);
        }

        // Category display names
        const categoryNames = {
            'cables': 'CABLES',
            'adapters': 'ADAPTERS',
            'peripherals': 'PERIPHERALS',
            'audio': 'AUDIO',
            'storage': 'STORAGE',
            'components': 'COMPONENTS',
            'supplies': 'SUPPLIES'
        };

        let html = `
            <div class="supplier-section">
                <div class="supplier-header">YOUR BACKSTOCK</div>
                <div class="backstock-summary" style="padding: 8px; color: var(--text-dim); font-size: 11px;">
                    ${this.getBackstockSummary()}
                </div>
            </div>
        `;

        // License display names
        const licenseNames = { 'e': 'E', 'c': 'C', 'b': 'B', 'a': 'A' };

        // Render each category
        for (const [catId, catItems] of Object.entries(categories)) {
            html += `<div class="supplier-section">
                <div class="supplier-header">${categoryNames[catId] || catId.toUpperCase()}</div>`;

            for (const item of catItems) {
                const inStock = typeof InventorySystem !== 'undefined'
                    ? InventorySystem.getBackstockQuantity(item.id)
                    : 0;

                const hasLicense = typeof InventorySystem !== 'undefined'
                    ? InventorySystem.hasLicenseFor(item.id)
                    : true;

                const licReq = item.license || 'e';
                const licBadge = licReq !== 'e' ? `<span style="color: ${hasLicense ? 'var(--green)' : 'var(--red)'}; font-size: 10px;">[${licenseNames[licReq]}-LIC]</span> ` : '';

                if (hasLicense) {
                    html += `
                        <div class="supplier-item">
                            <div class="supplier-item-info">
                                <div class="supplier-item-name">${licBadge}${item.name}</div>
                                <div class="supplier-item-desc">Sell for ~$${item.marketPrice} | In stock: ${inStock}</div>
                            </div>
                            <div class="supplier-item-price">$${item.costPrice}</div>
                            <button class="supplier-buy-btn" data-item-id="${item.id}" data-cost="${item.costPrice}">BUY</button>
                            <button class="supplier-buy-btn" data-item-id="${item.id}" data-cost="${item.costPrice * 5}" data-qty="5">x5</button>
                        </div>
                    `;
                } else {
                    html += `
                        <div class="supplier-item" style="opacity: 0.5;">
                            <div class="supplier-item-info">
                                <div class="supplier-item-name">${licBadge}${item.name}</div>
                                <div class="supplier-item-desc" style="color: var(--red);">Requires ${licenseNames[licReq]}-License to purchase</div>
                            </div>
                            <div class="supplier-item-price">$${item.costPrice}</div>
                            <button class="supplier-buy-btn" disabled style="opacity: 0.3;">LOCKED</button>
                        </div>
                    `;
                }
            }

            html += `</div>`;
        }

        this.windowContent.innerHTML = html;

        // Bind buy buttons
        this.windowContent.querySelectorAll('.supplier-buy-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const itemId = btn.dataset.itemId;
                const cost = parseInt(btn.dataset.cost);
                const qty = parseInt(btn.dataset.qty) || 1;
                this.buyWholesaleItem(itemId, cost, qty);
            });
        });
    },

    getBackstockSummary() {
        if (typeof InventorySystem === 'undefined') return 'No inventory system';

        const backstock = InventorySystem.backstock;
        if (!backstock || backstock.length === 0) {
            return 'Backstock empty - buy items to stock your shelves!';
        }

        const totalItems = backstock.reduce((sum, b) => sum + b.quantity, 0);
        const totalTypes = backstock.length;
        return `${totalItems} items (${totalTypes} types) in backstock`;
    },

    buyWholesaleItem(itemId, cost, qty) {
        if (!canAfford(cost)) {
            alert('Not enough cash!');
            return;
        }

        spendCash(cost);

        if (typeof InventorySystem !== 'undefined') {
            InventorySystem.addToBackstock(itemId, qty);
        }

        // Refresh the view
        this.renderSupplier();
    },

    // Liquidation Pallets App - mystery device boxes
    renderLiquidation() {
        const hasCLicense = GameState.licenses.c || GameState.licenses.b || GameState.licenses.a;
        const hasBLicense = GameState.licenses.b || GameState.licenses.a;
        const hasALicense = GameState.licenses.a;

        // Small Pallet - requires C license
        let smallPalletHtml;
        if (hasCLicense) {
            smallPalletHtml = `
                <div class="supplier-item">
                    <div class="supplier-item-info">
                        <div class="supplier-item-name"><span style="color: var(--green); font-size: 10px;">[C-LIC]</span> Small Pallet</div>
                        <div class="supplier-item-desc">3-5 mystery devices, assorted condition</div>
                    </div>
                    <div class="supplier-item-price">$1,000</div>
                    <button class="supplier-buy-btn" data-item="pallet-small" data-cost="1000">BUY</button>
                </div>
            `;
        } else {
            smallPalletHtml = `
                <div class="supplier-item" style="opacity: 0.5;">
                    <div class="supplier-item-info">
                        <div class="supplier-item-name"><span style="color: var(--red); font-size: 10px;">[C-LIC]</span> Small Pallet</div>
                        <div class="supplier-item-desc" style="color: var(--red);">Requires C-License to purchase</div>
                    </div>
                    <div class="supplier-item-price">$1,000</div>
                    <button class="supplier-buy-btn" disabled style="opacity: 0.3;">LOCKED</button>
                </div>
            `;
        }

        // Medium Pallet - requires B license
        let mediumPalletHtml;
        if (hasBLicense) {
            mediumPalletHtml = `
                <div class="supplier-item">
                    <div class="supplier-item-info">
                        <div class="supplier-item-name"><span style="color: var(--green); font-size: 10px;">[B-LIC]</span> Medium Pallet</div>
                        <div class="supplier-item-desc">6-10 mystery devices, better odds</div>
                    </div>
                    <div class="supplier-item-price">$2,000</div>
                    <button class="supplier-buy-btn" data-item="pallet-medium" data-cost="2000">BUY</button>
                </div>
            `;
        } else {
            mediumPalletHtml = `
                <div class="supplier-item" style="opacity: 0.5;">
                    <div class="supplier-item-info">
                        <div class="supplier-item-name"><span style="color: var(--red); font-size: 10px;">[B-LIC]</span> Medium Pallet</div>
                        <div class="supplier-item-desc" style="color: var(--red);">Requires B-License to purchase</div>
                    </div>
                    <div class="supplier-item-price">$2,000</div>
                    <button class="supplier-buy-btn" disabled style="opacity: 0.3;">LOCKED</button>
                </div>
            `;
        }

        // Premium Pallet - requires A license
        let premiumPalletHtml;
        if (hasALicense) {
            premiumPalletHtml = `
                <div class="supplier-item">
                    <div class="supplier-item-info">
                        <div class="supplier-item-name"><span style="color: var(--green); font-size: 10px;">[A-LIC]</span> Premium Pallet</div>
                        <div class="supplier-item-desc">8-12 devices, guaranteed B+ grades</div>
                    </div>
                    <div class="supplier-item-price">$5,000</div>
                    <button class="supplier-buy-btn" data-item="pallet-premium" data-cost="5000">BUY</button>
                </div>
            `;
        } else {
            premiumPalletHtml = `
                <div class="supplier-item" style="opacity: 0.5;">
                    <div class="supplier-item-info">
                        <div class="supplier-item-name"><span style="color: var(--red); font-size: 10px;">[A-LIC]</span> Premium Pallet</div>
                        <div class="supplier-item-desc" style="color: var(--red);">Requires A-License to purchase</div>
                    </div>
                    <div class="supplier-item-price">$5,000</div>
                    <button class="supplier-buy-btn" disabled style="opacity: 0.3;">LOCKED</button>
                </div>
            `;
        }

        this.windowContent.innerHTML = `
            <div class="supplier-section">
                <div class="supplier-header">MYSTERY PALLETS</div>
                <div style="padding: 8px; color: var(--text-dim); font-size: 11px; margin-bottom: 10px;">
                    Buy pallets of mystery devices. Fix them up and resell, or use for parts!
                </div>
                ${smallPalletHtml}
                ${mediumPalletHtml}
                ${premiumPalletHtml}
            </div>

            <div class="supplier-section">
                <div class="supplier-header">SUPPLIES</div>
                <div class="supplier-item">
                    <div class="supplier-item-info">
                        <div class="supplier-item-name">Empty Case (x5)</div>
                        <div class="supplier-item-desc">For packaging software to sell</div>
                    </div>
                    <div class="supplier-item-price">$50</div>
                    <button class="supplier-buy-btn" data-item="cases" data-cost="50">BUY</button>
                </div>
                ${hasCLicense ? `
                <div class="supplier-item">
                    <div class="supplier-item-info">
                        <div class="supplier-item-name"><span style="color: var(--green); font-size: 10px;">[C-LIC]</span> Stim Drink</div>
                        <div class="supplier-item-desc">Emergency dive charge (+1 dive)</div>
                    </div>
                    <div class="supplier-item-price">$250</div>
                    <button class="supplier-buy-btn" data-item="stim" data-cost="250">BUY</button>
                </div>
                ` : `
                <div class="supplier-item" style="opacity: 0.5;">
                    <div class="supplier-item-info">
                        <div class="supplier-item-name"><span style="color: var(--red); font-size: 10px;">[C-LIC]</span> Stim Drink</div>
                        <div class="supplier-item-desc" style="color: var(--red);">Requires C-License to purchase</div>
                    </div>
                    <div class="supplier-item-price">$250</div>
                    <button class="supplier-buy-btn" disabled style="opacity: 0.3;">LOCKED</button>
                </div>
                `}
            </div>
        `;

        // Bind buy buttons
        this.windowContent.querySelectorAll('.supplier-buy-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const item = btn.dataset.item;
                const cost = parseInt(btn.dataset.cost);
                this.buyItem(item, cost);
            });
        });
    },

    buyItem(item, cost) {
        if (!canAfford(cost)) {
            alert('Not enough cash!');
            return;
        }

        spendCash(cost);

        switch (item) {
            case 'pallet-small':
                this.openPallet(3 + Math.floor(Math.random() * 3)); // 3-5
                break;
            case 'pallet-medium':
                this.openPallet(6 + Math.floor(Math.random() * 5)); // 6-10
                break;
            case 'pallet-premium':
                this.openPallet(8 + Math.floor(Math.random() * 5), 'b'); // 8-12, min B grade
                break;
            case 'cases':
                GameState.inventory.cases += 5;
                alert('Added 5 empty cases to inventory!');
                break;
            case 'stim':
                GameState.inventory.stims += 1;
                alert('Added 1 Stim Drink to inventory!');
                break;
        }
    },

    openPallet(count, minGrade = null) {
        const devices = [];
        for (let i = 0; i < count; i++) {
            let grade = null;
            if (minGrade === 'b') {
                grade = Math.random() < 0.7 ? 'b' : 'a';
            }
            devices.push(generateDevice(grade));
        }

        GameState.inventory.devices.push(...devices);

        // Show pallet contents
        let html = '<div class="supplier-section"><div class="supplier-header">PALLET CONTENTS</div>';
        devices.forEach(d => {
            const gradeColor = d.grade === 'a' ? 'gold' : d.grade === 'b' ? 'blue' : d.grade === 'c' ? 'green' : 'text-secondary';
            html += `
                <div class="supplier-item">
                    <div class="supplier-item-info">
                        <div class="supplier-item-name">${d.fullName}</div>
                        <div class="supplier-item-desc">Health: ${d.health}%</div>
                    </div>
                    <div class="supplier-item-price" style="color: var(--${gradeColor})">${d.grade.toUpperCase()}-GRADE</div>
                </div>
            `;
        });
        html += '</div>';

        this.windowContent.innerHTML = html;
    },

    // Licenses App
    renderLicenses() {
        const licenses = [
            { id: 'e', name: 'E-License', desc: 'Entry-level device certification', cashCost: 0, owned: GameState.licenses.e },
            { id: 'c', name: 'C-License', desc: 'Common device certification', cashCost: 1500, owned: GameState.licenses.c },
            { id: 'b', name: 'B-License', desc: 'Business-grade device certification', cashCost: 4000, owned: GameState.licenses.b },
            { id: 'a', name: 'A-License', desc: 'Premium device certification', cashCost: 10000, owned: GameState.licenses.a }
        ];

        let html = `
            <div style="padding: 10px; margin-bottom: 15px; background: var(--bg-light); border: 1px solid var(--border); font-size: 11px; color: var(--text-dim);">
                <strong style="color: var(--cyan);">How Licenses Work:</strong><br>
                1. Pass the skill test at Dive OS (costs bits)<br>
                2. Purchase the license here (costs cash)
            </div>
        `;

        licenses.forEach(lic => {
            const testPassed = lic.id === 'e' || GameState.testsPassed[lic.id];
            const canBuy = !lic.owned && testPassed && canAfford(lic.cashCost);

            let statusText = 'OWNED';
            let statusClass = 'owned';
            if (!lic.owned) {
                if (testPassed) {
                    statusText = 'TEST PASSED';
                    statusClass = 'passed';
                } else {
                    statusText = 'NEED TEST';
                    statusClass = 'locked';
                }
            }

            html += `
                <div class="license-card">
                    <div class="license-header">
                        <span class="license-name grade-${lic.id}">${lic.name}</span>
                        <span class="license-status ${statusClass}">${statusText}</span>
                    </div>
                    <div class="license-desc">${lic.desc}</div>
                    ${!lic.owned ? `
                        <div class="license-costs">
                            <div class="license-cost">
                                <span class="label">Cash: </span>
                                <span class="value cash">${formatMoney(lic.cashCost)}</span>
                            </div>
                            ${!testPassed ? `
                            <div class="license-cost">
                                <span class="label" style="color: var(--gold);">⚠ Pass test at Dive OS first</span>
                            </div>
                            ` : ''}
                        </div>
                        <button class="license-btn" data-license="${lic.id}" ${!canBuy ? 'disabled' : ''}>
                            ${lic.owned ? 'OWNED' : !testPassed ? 'NEED TEST (Dive OS)' : canBuy ? 'PURCHASE LICENSE' : 'NOT ENOUGH CASH'}
                        </button>
                    ` : ''}
                </div>
            `;
        });

        this.windowContent.innerHTML = html;

        // Bind license buttons
        this.windowContent.querySelectorAll('.license-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.purchaseLicense(btn.dataset.license);
            });
        });
    },

    purchaseLicense(licenseId) {
        const costs = {
            'c': 1500,
            'b': 4000,
            'a': 10000
        };

        const cost = costs[licenseId];
        if (!cost) return;

        // Must have passed the test at Dive OS first
        if (!GameState.testsPassed[licenseId]) {
            alert(`You need to pass the ${licenseId.toUpperCase()}-License test first!\n\nGo to Dive OS > Tests to take the skill test.`);
            return;
        }

        if (!canAfford(cost)) {
            alert(`Not enough cash!\n\nNeed: ${formatMoney(cost)}\nHave: ${formatMoney(GameState.cash)}`);
            return;
        }

        spendCash(cost);
        GameState.licenses[licenseId] = true;
        alert(`${licenseId.toUpperCase()}-License acquired!\n\nYou can now repair ${licenseId.toUpperCase()}-grade devices and access new inventory.`);
        this.renderLicenses();
        this.updateSecretApps();

        // Update Dive OS test cards if it exists
        if (typeof DiveOS !== 'undefined') {
            DiveOS.updateTestCards();
        }
    },

    // Bills App
    renderBills() {
        const totalDue = GameState.bills.filter(b => !b.paid).reduce((sum, b) => sum + b.amount, 0);

        let html = `
            <div class="bills-summary">
                <span class="bills-summary-label">TOTAL DUE THIS WEEK</span>
                <span class="bills-summary-total">${formatMoney(totalDue)}</span>
            </div>
        `;

        GameState.bills.forEach((bill, index) => {
            html += `
                <div class="bill-row">
                    <div class="bill-info">
                        <div class="bill-name">${bill.name}</div>
                        <div class="bill-due">Due: Day ${bill.dueDay}</div>
                    </div>
                    <div class="bill-amount">${formatMoney(bill.amount)}</div>
                    ${!bill.paid ? `
                        <button class="bill-pay-btn" data-bill="${index}">PAY</button>
                    ` : '<span style="color: var(--green)">PAID</span>'}
                </div>
            `;
        });

        this.windowContent.innerHTML = html;

        // Bind pay buttons
        this.windowContent.querySelectorAll('.bill-pay-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.payBill(parseInt(btn.dataset.bill));
            });
        });
    },

    payBill(index) {
        const bill = GameState.bills[index];
        if (!bill || bill.paid) return;

        if (spendCash(bill.amount)) {
            bill.paid = true;
            this.renderBills();
        } else {
            alert('Not enough cash!');
        }
    },

    // Bank App
    renderBank() {
        this.windowContent.innerHTML = `
            <div class="bills-summary">
                <span class="bills-summary-label">CURRENT BALANCE</span>
                <span class="bills-summary-total" style="color: var(--gold)">${formatMoney(GameState.cash)}</span>
            </div>

            <div style="padding: 20px; text-align: center; color: var(--text-dim);">
                <p style="margin-bottom: 20px;">Transaction history coming soon.</p>
                <p>SYNC Bank - "Your credits are safe with us."</p>
            </div>
        `;
    },

    // Reviews App
    renderReviews() {
        const rating = GameState.reputation.toFixed(1);
        const stars = '★'.repeat(Math.floor(GameState.reputation)) + '☆'.repeat(5 - Math.floor(GameState.reputation));

        let html = `
            <div class="reviews-score">
                <div class="score-value">${rating}</div>
                <div class="score-label">${stars}</div>
            </div>
        `;

        if (GameState.reviews.length === 0) {
            html += '<div class="empty-state">No reviews yet. Complete jobs to earn reviews!</div>';
        } else {
            GameState.reviews.forEach(review => {
                html += `
                    <div class="review-item">
                        <div class="review-header">
                            <span class="review-customer">${review.customer}</span>
                            <span class="review-stars">${'★'.repeat(review.rating)}</span>
                        </div>
                        <div class="review-text">"${review.text}"</div>
                    </div>
                `;
            });
        }

        this.windowContent.innerHTML = html;
    },

    // Furniture App
    renderFurniture() {
        const inv = GameState.furnitureInventory;
        const prices = GameState.furniturePrices;

        let html = `
            <div class="supplier-section">
                <div class="supplier-header">YOUR FURNITURE INVENTORY</div>
                <div class="furniture-inventory">
        `;

        // Show owned furniture with place buttons
        if (inv.shelf > 0) {
            html += `
                <div class="supplier-item">
                    <div class="supplier-item-info">
                        <div class="supplier-item-name">Shelf</div>
                        <div class="supplier-item-desc">You own: ${inv.shelf}</div>
                    </div>
                    <button class="supplier-buy-btn" data-furniture="shelf">PLACE</button>
                </div>
            `;
        }
        if (inv.displayTable > 0) {
            html += `
                <div class="supplier-item">
                    <div class="supplier-item-info">
                        <div class="supplier-item-name">Display Table</div>
                        <div class="supplier-item-desc">You own: ${inv.displayTable}</div>
                    </div>
                    <button class="supplier-buy-btn" data-furniture="displayTable">PLACE</button>
                </div>
            `;
        }
        if (inv.shelf === 0 && inv.displayTable === 0) {
            html += `<div class="empty-state">No furniture in inventory. Buy some below!</div>`;
        }

        html += `
                </div>
            </div>

            <div class="supplier-section">
                <div class="supplier-header">BUY FURNITURE</div>
                <div class="supplier-item">
                    <div class="supplier-item-info">
                        <div class="supplier-item-name">Shelf</div>
                        <div class="supplier-item-desc">Display and sell items to customers</div>
                    </div>
                    <div class="supplier-item-price">$${prices.shelf}</div>
                    <button class="supplier-buy-btn" data-buy="shelf" data-cost="${prices.shelf}">BUY</button>
                </div>
                <div class="supplier-item">
                    <div class="supplier-item-info">
                        <div class="supplier-item-name">Display Table</div>
                        <div class="supplier-item-desc">Showcase featured items (2x2 size)</div>
                    </div>
                    <div class="supplier-item-price">$${prices.displayTable}</div>
                    <button class="supplier-buy-btn" data-buy="displayTable" data-cost="${prices.displayTable}">BUY</button>
                </div>
            </div>

            <div style="padding: 12px; border-top: 1px solid var(--border); color: var(--text-dim); font-size: 11px;">
                Tip: Click PLACE then click on an empty floor tile in your shop to place furniture.
            </div>
        `;

        this.windowContent.innerHTML = html;

        // Bind place buttons
        this.windowContent.querySelectorAll('[data-furniture]').forEach(btn => {
            btn.addEventListener('click', () => {
                const furnitureType = btn.dataset.furniture;
                if (typeof FurnitureSystem !== 'undefined') {
                    FurnitureSystem.startPlacement(furnitureType);
                    this.closeWindow();
                    // Switch to shop tab to see placement
                    document.querySelector('[data-tab="shop"]')?.click();
                }
            });
        });

        // Bind buy buttons
        this.windowContent.querySelectorAll('[data-buy]').forEach(btn => {
            btn.addEventListener('click', () => {
                const furnitureType = btn.dataset.buy;
                if (typeof FurnitureSystem !== 'undefined') {
                    if (FurnitureSystem.buyFurniture(furnitureType)) {
                        this.renderFurniture(); // Refresh
                    } else {
                        alert('Not enough cash!');
                    }
                }
            });
        });
    },

    // Hire Staff App (placeholder)
    renderHire() {
        this.windowContent.innerHTML = `
            <div style="padding: 20px; text-align: center;">
                <div style="font-size: 48px; margin-bottom: 20px;">👤</div>
                <div style="color: var(--cyan); font-family: var(--font-display); font-size: 18px; margin-bottom: 15px;">
                    STAFF HIRING
                </div>
                <div style="color: var(--text-dim); font-size: 13px; margin-bottom: 20px; line-height: 1.6;">
                    Hire employees to help run your shop.<br>
                    Staff can handle repairs, man the counter, or dive for you.
                </div>

                <div style="background: var(--bg-light); border: 1px solid var(--border); padding: 15px; margin-bottom: 15px; text-align: left;">
                    <div style="color: var(--gold); font-size: 12px; margin-bottom: 10px;">COMING SOON</div>
                    <div style="color: var(--text-dim); font-size: 11px; line-height: 1.5;">
                        • <strong>Counter Staff</strong> - Handle sales while you repair<br>
                        • <strong>Repair Tech</strong> - Work on workbench jobs<br>
                        • <strong>Diver</strong> - Send them into devices (success varies by skill)
                    </div>
                </div>

                <div style="background: var(--bg-light); border: 1px solid var(--border); padding: 15px; text-align: left;">
                    <div style="color: var(--text-dim); font-size: 11px; line-height: 1.5;">
                        <strong style="color: var(--cyan);">Hire Divers:</strong><br>
                        When you can't dive yourself, send hired staff.<br>
                        Their success rate depends on gear and experience.<br>
                        Lower than your own skill, but frees up your time.
                    </div>
                </div>
            </div>
        `;
    },

    // Null Sector App (secret/grey market)
    renderNullSector() {
        this.windowContent.innerHTML = `
            <div class="null-sector-content">
                <div class="null-warning">
                    ⚠ UNAUTHORIZED CONNECTION DETECTED<br>
                    SYNC monitoring may be active. Proceed with caution.
                </div>

                <div class="null-item">
                    <div>
                        <div class="null-item-name">Jailbreak Tool</div>
                        <div class="null-item-desc">Bypass SYNC license restrictions (risky)</div>
                    </div>
                    <div class="null-item-price">500 bits</div>
                </div>

                <div class="null-item">
                    <div>
                        <div class="null-item-name">Ghost Protocol</div>
                        <div class="null-item-desc">Hide dive activity from SYNC logs</div>
                    </div>
                    <div class="null-item-price">300 bits</div>
                </div>

                <div class="null-item">
                    <div>
                        <div class="null-item-name">Data Siphon</div>
                        <div class="null-item-desc">Extract extra resources during dives</div>
                    </div>
                    <div class="null-item-price">400 bits</div>
                </div>

                <div style="margin-top: 20px; padding: 12px; border: 1px dashed var(--purple-dim); color: var(--text-dim); font-size: 11px;">
                    "SYNC says we're criminals. We say we're liberators.<br>
                    The truth? We're just trying to survive their system."<br>
                    <span style="color: var(--purple)">— Null_Sector</span>
                </div>
            </div>
        `;
    }
};

// Initialize when DOM ready
document.addEventListener('DOMContentLoaded', () => {
    ShopOS.init();
});
