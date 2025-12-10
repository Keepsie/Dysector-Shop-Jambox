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
            'supplier': { title: 'SYNC SUPPLIER', render: () => this.renderSupplier() },
            'licenses': { title: 'LICENSE MANAGER', render: () => this.renderLicenses() },
            'bills': { title: 'BILLS & EXPENSES', render: () => this.renderBills() },
            'bank': { title: 'SYNC BANK', render: () => this.renderBank() },
            'reviews': { title: 'SHOP REVIEWS', render: () => this.renderReviews() },
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

    // Supplier App
    renderSupplier() {
        this.windowContent.innerHTML = `
            <div class="supplier-section">
                <div class="supplier-header">LIQUIDATION PALLETS</div>
                <div class="supplier-item">
                    <div class="supplier-item-info">
                        <div class="supplier-item-name">Small Pallet</div>
                        <div class="supplier-item-desc">3-5 mystery devices, assorted condition</div>
                    </div>
                    <div class="supplier-item-price">$300</div>
                    <button class="supplier-buy-btn" data-item="pallet-small" data-cost="300">BUY</button>
                </div>
                <div class="supplier-item">
                    <div class="supplier-item-info">
                        <div class="supplier-item-name">Medium Pallet</div>
                        <div class="supplier-item-desc">6-10 mystery devices, better odds</div>
                    </div>
                    <div class="supplier-item-price">$600</div>
                    <button class="supplier-buy-btn" data-item="pallet-medium" data-cost="600">BUY</button>
                </div>
                <div class="supplier-item">
                    <div class="supplier-item-info">
                        <div class="supplier-item-name">Premium Pallet</div>
                        <div class="supplier-item-desc">8-12 devices, guaranteed B+ grades</div>
                    </div>
                    <div class="supplier-item-price">$1,200</div>
                    <button class="supplier-buy-btn" data-item="pallet-premium" data-cost="1200">BUY</button>
                </div>
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
                <div class="supplier-item">
                    <div class="supplier-item-info">
                        <div class="supplier-item-name">Stim Drink</div>
                        <div class="supplier-item-desc">Emergency dive charge (+1 dive)</div>
                    </div>
                    <div class="supplier-item-price">$75</div>
                    <button class="supplier-buy-btn" data-item="stim" data-cost="75">BUY</button>
                </div>
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
            { id: 'e', name: 'E-License', desc: 'Entry-level device certification', cashCost: 0, bitsCost: 0, owned: GameState.licenses.e },
            { id: 'c', name: 'C-License', desc: 'Common device certification', cashCost: 500, bitsCost: 100, owned: GameState.licenses.c },
            { id: 'b', name: 'B-License', desc: 'Business-grade device certification', cashCost: 1500, bitsCost: 250, owned: GameState.licenses.b },
            { id: 'a', name: 'A-License', desc: 'Premium device certification', cashCost: 5000, bitsCost: 500, owned: GameState.licenses.a }
        ];

        let html = '';
        licenses.forEach(lic => {
            const canBuy = !lic.owned && canAfford(lic.cashCost) && GameState.bits >= lic.bitsCost;
            const prevOwned = lic.id === 'e' || GameState.licenses[String.fromCharCode(lic.id.charCodeAt(0) + 1)] !== false;

            html += `
                <div class="license-card">
                    <div class="license-header">
                        <span class="license-name grade-${lic.id}">${lic.name}</span>
                        <span class="license-status ${lic.owned ? 'owned' : 'locked'}">${lic.owned ? 'OWNED' : 'LOCKED'}</span>
                    </div>
                    <div class="license-desc">${lic.desc}</div>
                    ${!lic.owned ? `
                        <div class="license-costs">
                            <div class="license-cost">
                                <span class="label">Cash: </span>
                                <span class="value cash">${formatMoney(lic.cashCost)}</span>
                            </div>
                            <div class="license-cost">
                                <span class="label">Test Fee: </span>
                                <span class="value bits">${lic.bitsCost} bits</span>
                            </div>
                        </div>
                        <button class="license-btn" data-license="${lic.id}" ${!canBuy ? 'disabled' : ''}>
                            ${canBuy ? 'TAKE TEST & PURCHASE' : 'INSUFFICIENT FUNDS'}
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
            'c': { cash: 500, bits: 100 },
            'b': { cash: 1500, bits: 250 },
            'a': { cash: 5000, bits: 500 }
        };

        const cost = costs[licenseId];
        if (!cost) return;

        if (spendCash(cost.cash) && spendBits(cost.bits)) {
            GameState.licenses[licenseId] = true;
            alert(`${licenseId.toUpperCase()}-License acquired! You can now repair ${licenseId.toUpperCase()}-grade devices.`);
            this.renderLicenses();
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
