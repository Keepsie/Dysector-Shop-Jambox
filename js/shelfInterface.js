/* DYSECTOR Shop Prototype - Shelf Stocking Interface */

const ShelfInterface = {
    active: false,
    canvas: null,
    ctx: null,

    // Current shelf being stocked
    currentShelf: null,
    currentShelfKey: null,

    // UI state
    selectedItem: null,
    priceInput: 0,
    quantityInput: 1,

    // Scrolling for item list
    scrollOffset: 0,
    maxVisible: 6,

    // Layout
    layout: {
        shelfInfo: { x: 0, y: 0, width: 0, height: 0 },
        itemList: { x: 0, y: 0, width: 0, height: 0 },
        priceArea: { x: 0, y: 0, width: 0, height: 0 },
        actions: { x: 0, y: 0, width: 0, height: 0 },
    },

    // Clickable elements
    buttons: [],

    init() {
        // Will use ShopMap's canvas
    },

    // Open shelf interface
    openShelf(shelfKey) {
        const shelf = InventorySystem.shelves[shelfKey];
        if (!shelf) {
            console.warn('[SHELF] No shelf at', shelfKey);
            return;
        }

        this.active = true;
        this.currentShelf = shelf;
        this.currentShelfKey = shelfKey;
        this.selectedItem = null;
        this.priceInput = 0;
        this.quantityInput = 1;
        this.scrollOffset = 0;
        this.buttons = [];

        if (typeof ShopMap !== 'undefined' && ShopMap.canvas) {
            this.canvas = ShopMap.canvas;
            this.ctx = ShopMap.ctx;
            this.calculateLayout();
        }

        console.log('[SHELF] Opened shelf at', shelfKey, shelf);
    },

    close() {
        this.active = false;
        this.currentShelf = null;
        this.currentShelfKey = null;
    },

    calculateLayout() {
        const w = this.canvas.width;
        const h = this.canvas.height;

        this.layout = {
            shelfInfo: { x: 10, y: 10, width: w - 20, height: 80 },
            itemList: { x: 10, y: 100, width: w * 0.55 - 15, height: h - 160 },
            priceArea: { x: w * 0.55 + 5, y: 100, width: w * 0.45 - 15, height: h - 160 },
            actions: { x: 10, y: h - 50, width: w - 20, height: 40 },
        };
    },

    // Select item from backstock
    selectItem(itemId) {
        const item = InventorySystem.getItem(itemId);
        if (!item) return;

        this.selectedItem = item;
        this.priceInput = item.costPrice;  // Default to cost (what you paid)
        this.quantityInput = 1;
    },

    // Set price to percentage above market
    setPricePercent(percent) {
        if (!this.selectedItem) return;
        this.priceInput = Math.round(this.selectedItem.marketPrice * (1 + percent / 100));
    },

    // Adjust price
    adjustPrice(delta) {
        this.priceInput = Math.max(1, this.priceInput + delta);
    },

    // Adjust quantity
    adjustQuantity(delta) {
        const maxQty = this.selectedItem ?
            InventorySystem.getBackstockQuantity(this.selectedItem.id) : 1;
        this.quantityInput = Math.max(1, Math.min(maxQty, this.quantityInput + delta));
    },

    // Stock the selected item
    stockItem() {
        if (!this.selectedItem || !this.currentShelfKey) return;

        const result = InventorySystem.stockShelf(
            this.currentShelfKey,
            this.selectedItem.id,
            this.quantityInput,
            this.priceInput
        );

        if (result.success) {
            console.log(`[SHELF] Stocked ${result.added}x ${this.selectedItem.name} at $${this.priceInput}`);
            // Reset selection if no more in backstock
            if (InventorySystem.getBackstockQuantity(this.selectedItem.id) <= 0) {
                this.selectedItem = null;
            }
            this.quantityInput = 1;
        } else {
            console.warn('[SHELF] Stock failed:', result.error);
        }
    },

    // Remove item from shelf
    unstockItem(itemId) {
        if (!this.currentShelfKey) return;
        InventorySystem.unstockShelf(this.currentShelfKey, itemId, 1);
    },

    // Render
    render() {
        if (!this.active || !this.ctx) return;

        const ctx = this.ctx;
        const L = this.layout;
        this.buttons = [];

        // Background
        ctx.fillStyle = '#0d0d1a';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // === SHELF INFO (top) ===
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(L.shelfInfo.x, L.shelfInfo.y, L.shelfInfo.width, L.shelfInfo.height);
        ctx.strokeStyle = '#d4ac0d';
        ctx.lineWidth = 2;
        ctx.strokeRect(L.shelfInfo.x, L.shelfInfo.y, L.shelfInfo.width, L.shelfInfo.height);

        ctx.fillStyle = '#d4ac0d';
        ctx.font = 'bold 14px monospace';
        ctx.textAlign = 'left';
        ctx.fillText('SHELF STOCK', L.shelfInfo.x + 10, L.shelfInfo.y + 22);

        // Show what's on shelf
        ctx.fillStyle = '#aaa';
        ctx.font = '11px monospace';
        let shelfY = L.shelfInfo.y + 42;

        if (this.currentShelf.items.length === 0) {
            ctx.fillText('Empty - stock items from your backstock', L.shelfInfo.x + 10, shelfY);
        } else {
            for (const slot of this.currentShelf.items) {
                const item = InventorySystem.getItem(slot.itemId);
                const priceDiff = slot.price - item.marketPrice;
                const priceColor = priceDiff > 0 ? '#2ecc71' : priceDiff < 0 ? '#e74c3c' : '#fff';

                ctx.fillStyle = '#fff';
                ctx.fillText(`${item.name} x${slot.quantity}`, L.shelfInfo.x + 10, shelfY);

                ctx.fillStyle = priceColor;
                ctx.fillText(`$${slot.price}`, L.shelfInfo.x + 200, shelfY);

                ctx.fillStyle = '#666';
                ctx.fillText(`(market: $${item.marketPrice})`, L.shelfInfo.x + 260, shelfY);

                // Remove button
                const removeBtn = { x: L.shelfInfo.x + L.shelfInfo.width - 30, y: shelfY - 10, width: 20, height: 14, action: 'unstock', itemId: slot.itemId };
                this.buttons.push(removeBtn);
                ctx.fillStyle = '#e74c3c';
                ctx.fillRect(removeBtn.x, removeBtn.y, removeBtn.width, removeBtn.height);
                ctx.fillStyle = '#fff';
                ctx.font = '9px monospace';
                ctx.textAlign = 'center';
                ctx.fillText('-', removeBtn.x + 10, shelfY);

                shelfY += 16;
            }
        }

        // === ITEM LIST (left) - backstock items ===
        ctx.fillStyle = '#1a2a1a';
        ctx.fillRect(L.itemList.x, L.itemList.y, L.itemList.width, L.itemList.height);
        ctx.strokeStyle = '#2ecc71';
        ctx.lineWidth = 1;
        ctx.strokeRect(L.itemList.x, L.itemList.y, L.itemList.width, L.itemList.height);

        ctx.fillStyle = '#2ecc71';
        ctx.font = 'bold 11px monospace';
        ctx.textAlign = 'left';
        ctx.fillText('BACKSTOCK', L.itemList.x + 10, L.itemList.y + 16);

        // List items in backstock
        let itemY = L.itemList.y + 35;
        const itemHeight = 28;
        let visibleCount = 0;

        for (let i = this.scrollOffset; i < InventorySystem.backstock.length && visibleCount < this.maxVisible; i++) {
            const stock = InventorySystem.backstock[i];
            const item = InventorySystem.getItem(stock.itemId);
            if (!item) continue;

            const isSelected = this.selectedItem && this.selectedItem.id === item.id;

            // Item row background
            ctx.fillStyle = isSelected ? '#2a4a2a' : '#1a2a1a';
            ctx.fillRect(L.itemList.x + 5, itemY - 12, L.itemList.width - 10, itemHeight - 4);

            // Item button area
            const itemBtn = { x: L.itemList.x + 5, y: itemY - 12, width: L.itemList.width - 10, height: itemHeight - 4, action: 'select', itemId: item.id };
            this.buttons.push(itemBtn);

            // Item info
            ctx.fillStyle = isSelected ? '#2ecc71' : '#ccc';
            ctx.font = '11px monospace';
            ctx.textAlign = 'left';
            ctx.fillText(`${item.icon} ${item.name}`, L.itemList.x + 10, itemY);

            ctx.fillStyle = '#888';
            ctx.fillText(`x${stock.quantity}`, L.itemList.x + 180, itemY);

            ctx.fillStyle = '#666';
            ctx.font = '9px monospace';
            ctx.fillText(`$${item.marketPrice}`, L.itemList.x + 220, itemY);

            itemY += itemHeight;
            visibleCount++;
        }

        // Scroll indicators
        if (this.scrollOffset > 0) {
            ctx.fillStyle = '#2ecc71';
            ctx.fillText('▲ more', L.itemList.x + L.itemList.width / 2, L.itemList.y + 28);
        }
        if (this.scrollOffset + this.maxVisible < InventorySystem.backstock.length) {
            ctx.fillStyle = '#2ecc71';
            ctx.fillText('▼ more', L.itemList.x + L.itemList.width / 2, L.itemList.y + L.itemList.height - 8);
        }

        // === PRICE/QTY AREA (right) ===
        ctx.fillStyle = '#2a1a2a';
        ctx.fillRect(L.priceArea.x, L.priceArea.y, L.priceArea.width, L.priceArea.height);
        ctx.strokeStyle = '#9b59b6';
        ctx.lineWidth = 1;
        ctx.strokeRect(L.priceArea.x, L.priceArea.y, L.priceArea.width, L.priceArea.height);

        ctx.fillStyle = '#9b59b6';
        ctx.font = 'bold 11px monospace';
        ctx.textAlign = 'left';
        ctx.fillText('SET PRICE', L.priceArea.x + 10, L.priceArea.y + 16);

        if (this.selectedItem) {
            const costPrice = this.selectedItem.costPrice;
            const marketPrice = this.selectedItem.marketPrice;
            const profit = this.priceInput - costPrice;
            const profitPercent = Math.round((profit / costPrice) * 100);

            // Selected item
            ctx.fillStyle = '#fff';
            ctx.font = '12px monospace';
            ctx.fillText(this.selectedItem.name, L.priceArea.x + 10, L.priceArea.y + 36);

            // Cost and market reference
            ctx.fillStyle = '#e74c3c';
            ctx.font = '10px monospace';
            ctx.fillText(`Cost: $${costPrice}`, L.priceArea.x + 10, L.priceArea.y + 52);
            ctx.fillStyle = '#2ecc71';
            ctx.fillText(`Market: $${marketPrice}`, L.priceArea.x + 100, L.priceArea.y + 52);

            // Price input
            ctx.fillStyle = '#0d0d1a';
            ctx.fillRect(L.priceArea.x + 10, L.priceArea.y + 62, 70, 28);

            ctx.fillStyle = profit > 0 ? '#2ecc71' : profit < 0 ? '#e74c3c' : '#fff';
            ctx.font = 'bold 16px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(`$${this.priceInput}`, L.priceArea.x + 45, L.priceArea.y + 82);

            // +/- buttons for price
            const priceMinusBtn = { x: L.priceArea.x + 90, y: L.priceArea.y + 62, width: 26, height: 28, action: 'price_minus' };
            const pricePlusBtn = { x: L.priceArea.x + 120, y: L.priceArea.y + 62, width: 26, height: 28, action: 'price_plus' };
            this.buttons.push(priceMinusBtn, pricePlusBtn);

            ctx.fillStyle = '#e74c3c';
            ctx.fillRect(priceMinusBtn.x, priceMinusBtn.y, priceMinusBtn.width, priceMinusBtn.height);
            ctx.fillStyle = '#2ecc71';
            ctx.fillRect(pricePlusBtn.x, pricePlusBtn.y, pricePlusBtn.width, pricePlusBtn.height);

            ctx.fillStyle = '#fff';
            ctx.font = 'bold 14px monospace';
            ctx.fillText('-', priceMinusBtn.x + 13, priceMinusBtn.y + 20);
            ctx.fillText('+', pricePlusBtn.x + 13, pricePlusBtn.y + 20);

            // Quick price buttons: +10%, +20%, +30%
            const btnW = 45;
            const btnY = L.priceArea.y + 96;
            const p10Btn = { x: L.priceArea.x + 10, y: btnY, width: btnW, height: 20, action: 'price_10' };
            const p20Btn = { x: L.priceArea.x + 60, y: btnY, width: btnW, height: 20, action: 'price_20' };
            const p30Btn = { x: L.priceArea.x + 110, y: btnY, width: btnW, height: 20, action: 'price_30' };
            this.buttons.push(p10Btn, p20Btn, p30Btn);

            ctx.fillStyle = '#4a4a6a';
            ctx.fillRect(p10Btn.x, p10Btn.y, p10Btn.width, p10Btn.height);
            ctx.fillRect(p20Btn.x, p20Btn.y, p20Btn.width, p20Btn.height);
            ctx.fillRect(p30Btn.x, p30Btn.y, p30Btn.width, p30Btn.height);

            ctx.fillStyle = '#fff';
            ctx.font = '10px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('+10%', p10Btn.x + btnW/2, p10Btn.y + 14);
            ctx.fillText('+20%', p20Btn.x + btnW/2, p20Btn.y + 14);
            ctx.fillText('+30%', p30Btn.x + btnW/2, p30Btn.y + 14);

            // Profit indicator
            ctx.fillStyle = profit > 0 ? '#2ecc71' : profit < 0 ? '#e74c3c' : '#888';
            ctx.font = '10px monospace';
            ctx.textAlign = 'left';
            const profitText = profit > 0 ? `+$${profit} (+${profitPercent}%)` : profit < 0 ? `-$${-profit} (${profitPercent}%)` : 'No profit';
            ctx.fillText(profitText, L.priceArea.x + 10, L.priceArea.y + 132);

            // Quantity
            ctx.fillStyle = '#9b59b6';
            ctx.font = 'bold 11px monospace';
            ctx.fillText('QUANTITY', L.priceArea.x + 10, L.priceArea.y + 152);

            ctx.fillStyle = '#0d0d1a';
            ctx.fillRect(L.priceArea.x + 10, L.priceArea.y + 160, 70, 28);

            ctx.fillStyle = '#fff';
            ctx.font = 'bold 16px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(String(this.quantityInput), L.priceArea.x + 45, L.priceArea.y + 180);

            // +/- buttons for quantity
            const qtyMinusBtn = { x: L.priceArea.x + 90, y: L.priceArea.y + 160, width: 26, height: 28, action: 'qty_minus' };
            const qtyPlusBtn = { x: L.priceArea.x + 120, y: L.priceArea.y + 160, width: 26, height: 28, action: 'qty_plus' };
            this.buttons.push(qtyMinusBtn, qtyPlusBtn);

            ctx.fillStyle = '#e74c3c';
            ctx.fillRect(qtyMinusBtn.x, qtyMinusBtn.y, qtyMinusBtn.width, qtyMinusBtn.height);
            ctx.fillStyle = '#2ecc71';
            ctx.fillRect(qtyPlusBtn.x, qtyPlusBtn.y, qtyPlusBtn.width, qtyPlusBtn.height);

            ctx.fillStyle = '#fff';
            ctx.font = 'bold 14px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('-', qtyMinusBtn.x + 13, qtyMinusBtn.y + 20);
            ctx.fillText('+', qtyPlusBtn.x + 13, qtyPlusBtn.y + 20);

            // Stock button
            const stockBtn = { x: L.priceArea.x + 10, y: L.priceArea.y + 200, width: L.priceArea.width - 20, height: 32, action: 'stock' };
            this.buttons.push(stockBtn);

            ctx.fillStyle = '#2ecc71';
            ctx.fillRect(stockBtn.x, stockBtn.y, stockBtn.width, stockBtn.height);
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 12px monospace';
            ctx.fillText('STOCK SHELF', stockBtn.x + stockBtn.width / 2, stockBtn.y + 21);

        } else {
            ctx.fillStyle = '#666';
            ctx.font = '11px monospace';
            ctx.textAlign = 'left';
            ctx.fillText('Select an item from', L.priceArea.x + 10, L.priceArea.y + 50);
            ctx.fillText('backstock to price', L.priceArea.x + 10, L.priceArea.y + 66);
            ctx.fillText('and stock on shelf', L.priceArea.x + 10, L.priceArea.y + 82);
        }

        // === ACTIONS (bottom) ===
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(L.actions.x, L.actions.y, L.actions.width, L.actions.height);

        // Close button with better design
        const closeBtn = { x: L.actions.x + L.actions.width - 100, y: L.actions.y + 5, width: 90, height: 30, action: 'close' };
        this.buttons.push(closeBtn);

        // Button background with gradient effect
        const gradient = ctx.createLinearGradient(closeBtn.x, closeBtn.y, closeBtn.x, closeBtn.y + closeBtn.height);
        gradient.addColorStop(0, '#e74c3c');
        gradient.addColorStop(1, '#c0392b');
        ctx.fillStyle = gradient;
        ctx.fillRect(closeBtn.x, closeBtn.y, closeBtn.width, closeBtn.height);

        // Button border
        ctx.strokeStyle = '#a93226';
        ctx.lineWidth = 1;
        ctx.strokeRect(closeBtn.x, closeBtn.y, closeBtn.width, closeBtn.height);

        // X icon instead of text
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        const centerX = closeBtn.x + closeBtn.width / 2;
        const centerY = closeBtn.y + closeBtn.height / 2;
        const offset = 8;
        ctx.moveTo(centerX - offset, centerY - offset);
        ctx.lineTo(centerX + offset, centerY + offset);
        ctx.moveTo(centerX + offset, centerY - offset);
        ctx.lineTo(centerX - offset, centerY + offset);
        ctx.stroke();

        // Subtle shadow effect
        ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
        ctx.shadowBlur = 3;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 1;
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Info text
        ctx.fillStyle = '#666';
        ctx.font = '10px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(`Shelf capacity: ${this.currentShelf.items.length}/${this.currentShelf.maxSlots} slots`, L.actions.x + 10, L.actions.y + 25);
    },

    // Handle click
    handleClick(x, y) {
        if (!this.active) return false;

        for (const btn of this.buttons) {
            if (x >= btn.x && x <= btn.x + btn.width &&
                y >= btn.y && y <= btn.y + btn.height) {

                switch (btn.action) {
                    case 'select':
                        this.selectItem(btn.itemId);
                        break;
                    case 'price_minus':
                        this.adjustPrice(-1);
                        break;
                    case 'price_plus':
                        this.adjustPrice(1);
                        break;
                    case 'price_10':
                        this.setPricePercent(10);
                        break;
                    case 'price_20':
                        this.setPricePercent(20);
                        break;
                    case 'price_30':
                        this.setPricePercent(30);
                        break;
                    case 'qty_minus':
                        this.adjustQuantity(-1);
                        break;
                    case 'qty_plus':
                        this.adjustQuantity(1);
                        break;
                    case 'stock':
                        this.stockItem();
                        break;
                    case 'unstock':
                        this.unstockItem(btn.itemId);
                        break;
                    case 'close':
                        this.close();
                        break;
                }
                return true;
            }
        }

        // Check scroll areas
        const L = this.layout;
        if (x >= L.itemList.x && x <= L.itemList.x + L.itemList.width) {
            if (y >= L.itemList.y && y <= L.itemList.y + 30 && this.scrollOffset > 0) {
                this.scrollOffset--;
                return true;
            }
            if (y >= L.itemList.y + L.itemList.height - 20 &&
                this.scrollOffset + this.maxVisible < InventorySystem.backstock.length) {
                this.scrollOffset++;
                return true;
            }
        }

        return false;
    },
};
