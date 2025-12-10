/* DYSECTOR Shop Prototype - POS Register System */

const RegisterSystem = {
    active: false,
    canvas: null,
    ctx: null,

    // Current transaction
    transaction: {
        item: null,
        price: 0,
        customerPaid: 0,
        changeGiven: 0,
        changeDue: 0,
    },

    // Cash denominations
    BILLS: [
        { name: '$20', value: 2000, color: '#85bb65', width: 70, height: 30 },
        { name: '$10', value: 1000, color: '#85bb65', width: 70, height: 30 },
        { name: '$5', value: 500, color: '#85bb65', width: 70, height: 30 },
        { name: '$1', value: 100, color: '#85bb65', width: 70, height: 30 },
    ],

    COINS: [
        { name: '25¢', value: 25, color: '#c0c0c0', radius: 12 },
        { name: '10¢', value: 10, color: '#c0c0c0', radius: 10 },
        { name: '5¢', value: 5, color: '#cd7f32', radius: 11 },
        { name: '1¢', value: 1, color: '#cd7f32', radius: 9 },
    ],

    // UI positions (will be calculated on init)
    layout: {
        display: { x: 10, y: 10, width: 200, height: 60 },
        customerCash: { x: 220, y: 10, width: 250, height: 80 },
        billTray: { x: 10, y: 180, width: 300, height: 50 },
        coinTray: { x: 10, y: 240, width: 300, height: 50 },
        changeArea: { x: 320, y: 100, width: 150, height: 180 },
        doneBtn: { x: 320, y: 290, width: 150, height: 40 },
    },

    // Change being given (what player has clicked)
    changeStack: [],

    // Callback when transaction completes
    onComplete: null,

    init() {
        // Will use ShopMap's canvas when active
    },

    // Start a new transaction
    startTransaction(item, price, onComplete) {
        this.active = true;
        this.onComplete = onComplete;

        this.transaction = {
            item: item,
            price: price,  // in cents
            customerPaid: this.generatePayment(price),
            changeGiven: 0,
            changeDue: 0,
        };

        this.transaction.changeDue = this.transaction.customerPaid - price;
        this.changeStack = [];

        // Take over the shop map canvas
        if (typeof ShopMap !== 'undefined' && ShopMap.canvas) {
            this.canvas = ShopMap.canvas;
            this.ctx = ShopMap.ctx;
            this.calculateLayout();
        }

        console.log('[REGISTER] Transaction started:', this.transaction);
    },

    // Generate realistic payment from customer
    generatePayment(price) {
        // Customer pays with bills that cover the price
        // Varied payment patterns for different change scenarios
        const priceInDollars = price / 100;
        const roll = Math.random();

        // Sometimes exact change (10% chance) - no change needed
        if (roll < 0.1) {
            return price;
        }

        // Sometimes they pay with odd amounts (coins included) - 15% chance
        if (roll < 0.25) {
            // Round up to next dollar + some extra cents
            const roundedUp = Math.ceil(priceInDollars) * 100;
            const extraCents = [0, 25, 50, 75, 100][Math.floor(Math.random() * 5)];
            return Math.max(price, roundedUp + extraCents);
        }

        // Common bill payment patterns - varied
        const paymentOptions = [];

        if (priceInDollars <= 5) {
            paymentOptions.push(500, 1000, 2000);  // $5, $10, or $20
        } else if (priceInDollars <= 10) {
            paymentOptions.push(1000, 1500, 2000);  // $10, $15, $20
        } else if (priceInDollars <= 20) {
            paymentOptions.push(2000, 2500, 3000, 4000);  // $20, $25, $30, $40
        } else if (priceInDollars <= 50) {
            paymentOptions.push(5000, 4000, 6000);  // $50, $40, $60
        } else {
            // Larger amounts - round up variably
            const base = Math.ceil(priceInDollars / 20) * 2000;
            paymentOptions.push(base, base + 1000, base + 2000);
        }

        // Filter to only valid payments (must be >= price)
        const validPayments = paymentOptions.filter(p => p >= price);
        if (validPayments.length === 0) {
            // Fallback: just round up to nearest $10
            return Math.ceil(price / 1000) * 1000;
        }

        // Pick a random valid payment
        return validPayments[Math.floor(Math.random() * validPayments.length)];
    },

    calculateLayout() {
        const w = this.canvas.width;
        const h = this.canvas.height;

        this.layout = {
            display: { x: 10, y: 10, width: 180, height: 70 },
            customerCash: { x: 200, y: 10, width: w - 210, height: 70 },
            billTray: { x: 10, y: 90, width: w - 20, height: 50 },
            coinTray: { x: 10, y: 150, width: w - 20, height: 50 },
            changeArea: { x: 10, y: 210, width: w - 120, height: 70 },
            doneBtn: { x: w - 100, y: 210, width: 90, height: 70 },
        };
    },

    // Add denomination to change stack
    addChange(denom) {
        this.changeStack.push(denom);
        this.transaction.changeGiven += denom.value;
    },

    // Remove last item from change stack
    undoChange() {
        if (this.changeStack.length > 0) {
            const removed = this.changeStack.pop();
            this.transaction.changeGiven -= removed.value;
        }
    },

    // Complete the transaction
    complete() {
        const correct = this.transaction.changeGiven === this.transaction.changeDue;
        const difference = this.transaction.changeGiven - this.transaction.changeDue;

        this.active = false;

        if (this.onComplete) {
            this.onComplete({
                correct: correct,
                difference: difference,  // positive = gave too much, negative = gave too little
                changeGiven: this.transaction.changeGiven,
                changeDue: this.transaction.changeDue,
            });
        }
    },

    // Format cents to dollars
    formatMoney(cents) {
        return '$' + (cents / 100).toFixed(2);
    },

    // Render the register UI
    render() {
        if (!this.active || !this.ctx) return;

        const ctx = this.ctx;
        const L = this.layout;

        // Background
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // === DISPLAY (shows price and change due) ===
        ctx.fillStyle = '#0d0d1a';
        ctx.fillRect(L.display.x, L.display.y, L.display.width, L.display.height);
        ctx.strokeStyle = '#00ff88';
        ctx.lineWidth = 2;
        ctx.strokeRect(L.display.x, L.display.y, L.display.width, L.display.height);

        // Display text
        ctx.fillStyle = '#00ff88';
        ctx.font = 'bold 14px monospace';
        ctx.textAlign = 'left';
        ctx.fillText('TOTAL:', L.display.x + 10, L.display.y + 20);
        ctx.fillText(this.formatMoney(this.transaction.price), L.display.x + 10, L.display.y + 38);

        ctx.fillStyle = '#ffcc00';
        ctx.fillText('DUE:', L.display.x + 100, L.display.y + 20);
        ctx.fillText(this.formatMoney(this.transaction.changeDue), L.display.x + 100, L.display.y + 38);

        ctx.fillStyle = '#ff6b6b';
        ctx.font = '12px monospace';
        ctx.fillText('Given: ' + this.formatMoney(this.transaction.changeGiven), L.display.x + 10, L.display.y + 58);

        // === CUSTOMER CASH (what they paid with) ===
        ctx.fillStyle = '#2a2a4e';
        ctx.fillRect(L.customerCash.x, L.customerCash.y, L.customerCash.width, L.customerCash.height);

        ctx.fillStyle = '#888';
        ctx.font = '11px monospace';
        ctx.textAlign = 'left';
        ctx.fillText('CUSTOMER PAID:', L.customerCash.x + 5, L.customerCash.y + 15);

        ctx.fillStyle = '#fff';
        ctx.font = 'bold 24px monospace';
        ctx.fillText(this.formatMoney(this.transaction.customerPaid), L.customerCash.x + 10, L.customerCash.y + 50);

        // === BILL TRAY (clickable bills to give as change) ===
        ctx.fillStyle = '#1e3d2f';
        ctx.fillRect(L.billTray.x, L.billTray.y, L.billTray.width, L.billTray.height);

        ctx.fillStyle = '#666';
        ctx.font = '10px monospace';
        ctx.textAlign = 'left';
        ctx.fillText('BILLS', L.billTray.x + 5, L.billTray.y + 12);

        // Draw bills
        const billStartX = L.billTray.x + 10;
        const billY = L.billTray.y + 20;
        this.BILLS.forEach((bill, i) => {
            const bx = billStartX + i * 80;
            bill._x = bx;
            bill._y = billY;

            // Bill background
            ctx.fillStyle = bill.color;
            ctx.fillRect(bx, billY, bill.width, bill.height);

            // Bill border
            ctx.strokeStyle = '#2d5a3d';
            ctx.lineWidth = 1;
            ctx.strokeRect(bx, billY, bill.width, bill.height);

            // Bill text
            ctx.fillStyle = '#1a3d2a';
            ctx.font = 'bold 14px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(bill.name, bx + bill.width / 2, billY + 20);
        });

        // === COIN TRAY (clickable coins) ===
        ctx.fillStyle = '#3d3d1e';
        ctx.fillRect(L.coinTray.x, L.coinTray.y, L.coinTray.width, L.coinTray.height);

        ctx.fillStyle = '#666';
        ctx.font = '10px monospace';
        ctx.textAlign = 'left';
        ctx.fillText('COINS', L.coinTray.x + 5, L.coinTray.y + 12);

        // Draw coins
        const coinStartX = L.coinTray.x + 30;
        const coinY = L.coinTray.y + 32;
        this.COINS.forEach((coin, i) => {
            const cx = coinStartX + i * 70;
            coin._x = cx;
            coin._y = coinY;

            // Coin circle
            ctx.beginPath();
            ctx.arc(cx, coinY, coin.radius, 0, Math.PI * 2);
            ctx.fillStyle = coin.color;
            ctx.fill();
            ctx.strokeStyle = '#666';
            ctx.lineWidth = 1;
            ctx.stroke();

            // Coin text
            ctx.fillStyle = '#333';
            ctx.font = 'bold 9px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(coin.name, cx, coinY + 3);
        });

        // === CHANGE AREA (shows what you're giving back) ===
        ctx.fillStyle = '#2e2e4a';
        ctx.fillRect(L.changeArea.x, L.changeArea.y, L.changeArea.width, L.changeArea.height);

        ctx.fillStyle = '#666';
        ctx.font = '10px monospace';
        ctx.textAlign = 'left';
        ctx.fillText('CHANGE TO GIVE (click to undo)', L.changeArea.x + 5, L.changeArea.y + 12);

        // Draw change stack
        let changeX = L.changeArea.x + 10;
        let changeY = L.changeArea.y + 30;
        const maxPerRow = 8;

        this.changeStack.forEach((denom, i) => {
            if (i > 0 && i % maxPerRow === 0) {
                changeX = L.changeArea.x + 10;
                changeY += 25;
            }

            if (denom.radius) {
                // It's a coin
                ctx.beginPath();
                ctx.arc(changeX + 10, changeY + 10, denom.radius - 2, 0, Math.PI * 2);
                ctx.fillStyle = denom.color;
                ctx.fill();
                changeX += 25;
            } else {
                // It's a bill
                ctx.fillStyle = denom.color;
                ctx.fillRect(changeX, changeY, 30, 15);
                ctx.fillStyle = '#1a3d2a';
                ctx.font = '8px monospace';
                ctx.textAlign = 'center';
                ctx.fillText(denom.name, changeX + 15, changeY + 11);
                changeX += 35;
            }
        });

        // === DONE BUTTON ===
        const isCorrect = this.transaction.changeGiven === this.transaction.changeDue;
        ctx.fillStyle = isCorrect ? '#27ae60' : '#e74c3c';
        ctx.fillRect(L.doneBtn.x, L.doneBtn.y, L.doneBtn.width, L.doneBtn.height);

        ctx.fillStyle = '#fff';
        ctx.font = 'bold 16px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('DONE', L.doneBtn.x + L.doneBtn.width / 2, L.doneBtn.y + 30);

        // Small hint
        ctx.font = '10px monospace';
        ctx.fillText(isCorrect ? '✓ Correct!' : 'Check change', L.doneBtn.x + L.doneBtn.width / 2, L.doneBtn.y + 50);
    },

    // Handle click
    handleClick(x, y) {
        if (!this.active) return false;

        const L = this.layout;

        // Check bills
        for (const bill of this.BILLS) {
            if (x >= bill._x && x <= bill._x + bill.width &&
                y >= bill._y && y <= bill._y + bill.height) {
                this.addChange(bill);
                return true;
            }
        }

        // Check coins
        for (const coin of this.COINS) {
            const dx = x - coin._x;
            const dy = y - coin._y;
            if (dx * dx + dy * dy <= coin.radius * coin.radius) {
                this.addChange(coin);
                return true;
            }
        }

        // Check change area (undo)
        if (x >= L.changeArea.x && x <= L.changeArea.x + L.changeArea.width &&
            y >= L.changeArea.y && y <= L.changeArea.y + L.changeArea.height) {
            this.undoChange();
            return true;
        }

        // Check done button
        if (x >= L.doneBtn.x && x <= L.doneBtn.x + L.doneBtn.width &&
            y >= L.doneBtn.y && y <= L.doneBtn.y + L.doneBtn.height) {
            this.complete();
            return true;
        }

        return false;
    },
};
