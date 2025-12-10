/* DYSECTOR Shop Prototype - Display Table Interface (Single Item) */

const DisplayTableInterface = {
    active: false,
    canvas: null,
    ctx: null,

    currentTable: null,
    currentTableKey: null,

    selectedItem: null,
    priceInput: 0,
    quantityInput: 1,

    scrollOffset: 0,
    maxVisible: 6,

    layout: {},
    buttons: [],

    openTable(tableKey) {
        const table = InventorySystem.displayTables[tableKey];
        if (!table) {
            console.warn('[DISPLAY] No table at', tableKey);
            return;
        }

        this.active = true;
        this.currentTable = table;
        this.currentTableKey = tableKey;
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

        console.log('[DISPLAY] Opened table at', tableKey, table);
    },

    close() {
        this.active = false;
        this.currentTable = null;
        this.currentTableKey = null;
    },

    calculateLayout() {
        const w = this.canvas.width;
        const h = this.canvas.height;

        this.layout = {
            tableInfo: { x: 10, y: 10, width: w - 20, height: 70 },
            itemList: { x: 10, y: 90, width: w * 0.5 - 15, height: h - 150 },
            priceArea: { x: w * 0.5 + 5, y: 90, width: w * 0.5 - 15, height: h - 150 },
            actions: { x: 10, y: h - 50, width: w - 20, height: 40 },
        };
    },

    selectItem(itemId) {
        const item = InventorySystem.getItem(itemId);
        if (!item) return;

        this.selectedItem = item;
        this.priceInput = item.costPrice;  // Default to cost (what you paid)
        this.quantityInput = 1;
    },

    setPricePercent(percent) {
        if (!this.selectedItem) return;
        this.priceInput = Math.round(this.selectedItem.marketPrice * (1 + percent / 100));
    },

    adjustPrice(delta) {
        this.priceInput = Math.max(1, this.priceInput + delta);
    },

    adjustQuantity(delta) {
        const maxQty = this.selectedItem ?
            Math.min(InventorySystem.getBackstockQuantity(this.selectedItem.id), this.currentTable.maxQuantity) : 1;
        this.quantityInput = Math.max(1, Math.min(maxQty, this.quantityInput + delta));
    },

    stockItem() {
        if (!this.selectedItem || !this.currentTableKey) return;

        const result = InventorySystem.stockDisplayTable(
            this.currentTableKey,
            this.selectedItem.id,
            this.quantityInput,
            this.priceInput
        );

        if (result.success) {
            console.log(`[DISPLAY] Stocked ${result.added}x ${this.selectedItem.name} at $${this.priceInput}`);
            if (InventorySystem.getBackstockQuantity(this.selectedItem.id) <= 0) {
                this.selectedItem = null;
            }
            this.quantityInput = 1;
        } else {
            console.warn('[DISPLAY] Stock failed:', result.error);
        }
    },

    unstockItem() {
        if (!this.currentTableKey) return;
        InventorySystem.unstockDisplayTable(this.currentTableKey, 1);
    },

    render() {
        if (!this.active || !this.ctx) return;

        const ctx = this.ctx;
        const L = this.layout;
        this.buttons = [];

        // Background
        ctx.fillStyle = '#0d0d1a';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // === TABLE INFO ===
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(L.tableInfo.x, L.tableInfo.y, L.tableInfo.width, L.tableInfo.height);
        ctx.strokeStyle = '#e94560';
        ctx.lineWidth = 2;
        ctx.strokeRect(L.tableInfo.x, L.tableInfo.y, L.tableInfo.width, L.tableInfo.height);

        ctx.fillStyle = '#e94560';
        ctx.font = 'bold 14px monospace';
        ctx.textAlign = 'left';
        ctx.fillText('DISPLAY TABLE', L.tableInfo.x + 10, L.tableInfo.y + 22);

        ctx.fillStyle = '#888';
        ctx.font = '10px monospace';
        ctx.fillText('Single item showcase - customers see this first!', L.tableInfo.x + 10, L.tableInfo.y + 40);

        // Current item on table
        if (this.currentTable.item) {
            const item = InventorySystem.getItem(this.currentTable.item.itemId);
            const priceDiff = this.currentTable.item.price - item.marketPrice;

            ctx.fillStyle = '#fff';
            ctx.font = '12px monospace';
            ctx.fillText(`${item.name} x${this.currentTable.item.quantity}`, L.tableInfo.x + 10, L.tableInfo.y + 58);

            ctx.fillStyle = priceDiff > 0 ? '#2ecc71' : priceDiff < 0 ? '#e74c3c' : '#fff';
            ctx.fillText(`$${this.currentTable.item.price}`, L.tableInfo.x + 250, L.tableInfo.y + 58);

            // Remove button
            const removeBtn = { x: L.tableInfo.x + L.tableInfo.width - 80, y: L.tableInfo.y + 45, width: 70, height: 20, action: 'unstock' };
            this.buttons.push(removeBtn);
            ctx.fillStyle = '#e74c3c';
            ctx.fillRect(removeBtn.x, removeBtn.y, removeBtn.width, removeBtn.height);
            ctx.fillStyle = '#fff';
            ctx.font = '10px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('REMOVE', removeBtn.x + 35, removeBtn.y + 14);
        } else {
            ctx.fillStyle = '#666';
            ctx.font = '11px monospace';
            ctx.fillText('Empty - select an item to display', L.tableInfo.x + 10, L.tableInfo.y + 58);
        }

        // === ITEM LIST ===
        ctx.fillStyle = '#1a2a1a';
        ctx.fillRect(L.itemList.x, L.itemList.y, L.itemList.width, L.itemList.height);
        ctx.strokeStyle = '#2ecc71';
        ctx.lineWidth = 1;
        ctx.strokeRect(L.itemList.x, L.itemList.y, L.itemList.width, L.itemList.height);

        ctx.fillStyle = '#2ecc71';
        ctx.font = 'bold 11px monospace';
        ctx.textAlign = 'left';
        ctx.fillText('BACKSTOCK', L.itemList.x + 10, L.itemList.y + 16);

        let itemY = L.itemList.y + 35;
        const itemHeight = 28;
        let visibleCount = 0;

        for (let i = this.scrollOffset; i < InventorySystem.backstock.length && visibleCount < this.maxVisible; i++) {
            const stock = InventorySystem.backstock[i];
            const item = InventorySystem.getItem(stock.itemId);
            if (!item) continue;

            const isSelected = this.selectedItem && this.selectedItem.id === item.id;

            ctx.fillStyle = isSelected ? '#2a4a2a' : '#1a2a1a';
            ctx.fillRect(L.itemList.x + 5, itemY - 12, L.itemList.width - 10, itemHeight - 4);

            const itemBtn = { x: L.itemList.x + 5, y: itemY - 12, width: L.itemList.width - 10, height: itemHeight - 4, action: 'select', itemId: item.id };
            this.buttons.push(itemBtn);

            ctx.fillStyle = isSelected ? '#2ecc71' : '#ccc';
            ctx.font = '11px monospace';
            ctx.textAlign = 'left';
            ctx.fillText(`${item.icon} ${item.name}`, L.itemList.x + 10, itemY);

            ctx.fillStyle = '#888';
            ctx.fillText(`x${stock.quantity}`, L.itemList.x + 160, itemY);

            itemY += itemHeight;
            visibleCount++;
        }

        // === PRICE AREA ===
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

            ctx.fillStyle = '#fff';
            ctx.font = '12px monospace';
            ctx.fillText(this.selectedItem.name, L.priceArea.x + 10, L.priceArea.y + 36);

            // Cost and market reference
            ctx.fillStyle = '#e74c3c';
            ctx.font = '10px monospace';
            ctx.fillText(`Cost: $${costPrice}`, L.priceArea.x + 10, L.priceArea.y + 52);
            ctx.fillStyle = '#2ecc71';
            ctx.fillText(`Market: $${marketPrice}`, L.priceArea.x + 90, L.priceArea.y + 52);

            // Price display
            ctx.fillStyle = '#0d0d1a';
            ctx.fillRect(L.priceArea.x + 10, L.priceArea.y + 62, 65, 26);

            ctx.fillStyle = profit > 0 ? '#2ecc71' : profit < 0 ? '#e74c3c' : '#fff';
            ctx.font = 'bold 14px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(`$${this.priceInput}`, L.priceArea.x + 42, L.priceArea.y + 80);

            // +/- price
            const priceMinusBtn = { x: L.priceArea.x + 82, y: L.priceArea.y + 62, width: 24, height: 26, action: 'price_minus' };
            const pricePlusBtn = { x: L.priceArea.x + 110, y: L.priceArea.y + 62, width: 24, height: 26, action: 'price_plus' };
            this.buttons.push(priceMinusBtn, pricePlusBtn);

            ctx.fillStyle = '#e74c3c';
            ctx.fillRect(priceMinusBtn.x, priceMinusBtn.y, priceMinusBtn.width, priceMinusBtn.height);
            ctx.fillStyle = '#2ecc71';
            ctx.fillRect(pricePlusBtn.x, pricePlusBtn.y, pricePlusBtn.width, pricePlusBtn.height);

            ctx.fillStyle = '#fff';
            ctx.font = 'bold 12px monospace';
            ctx.fillText('-', priceMinusBtn.x + 12, priceMinusBtn.y + 18);
            ctx.fillText('+', pricePlusBtn.x + 12, pricePlusBtn.y + 18);

            // Quick price buttons: +10%, +20%, +30%
            const btnW = 40;
            const btnY = L.priceArea.y + 94;
            const p10Btn = { x: L.priceArea.x + 10, y: btnY, width: btnW, height: 18, action: 'price_10' };
            const p20Btn = { x: L.priceArea.x + 55, y: btnY, width: btnW, height: 18, action: 'price_20' };
            const p30Btn = { x: L.priceArea.x + 100, y: btnY, width: btnW, height: 18, action: 'price_30' };
            this.buttons.push(p10Btn, p20Btn, p30Btn);

            ctx.fillStyle = '#4a4a6a';
            ctx.fillRect(p10Btn.x, p10Btn.y, p10Btn.width, p10Btn.height);
            ctx.fillRect(p20Btn.x, p20Btn.y, p20Btn.width, p20Btn.height);
            ctx.fillRect(p30Btn.x, p30Btn.y, p30Btn.width, p30Btn.height);

            ctx.fillStyle = '#fff';
            ctx.font = '9px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('+10%', p10Btn.x + btnW/2, p10Btn.y + 13);
            ctx.fillText('+20%', p20Btn.x + btnW/2, p20Btn.y + 13);
            ctx.fillText('+30%', p30Btn.x + btnW/2, p30Btn.y + 13);

            // Profit indicator
            ctx.fillStyle = profit > 0 ? '#2ecc71' : profit < 0 ? '#e74c3c' : '#888';
            ctx.font = '10px monospace';
            ctx.textAlign = 'left';
            const profitText = profit > 0 ? `+$${profit}` : profit < 0 ? `-$${-profit}` : '$0';
            ctx.fillText(profitText, L.priceArea.x + 145, L.priceArea.y + 80);

            // Quantity
            ctx.fillStyle = '#9b59b6';
            ctx.font = 'bold 11px monospace';
            ctx.fillText('QTY', L.priceArea.x + 10, L.priceArea.y + 115);

            ctx.fillStyle = '#0d0d1a';
            ctx.fillRect(L.priceArea.x + 10, L.priceArea.y + 125, 70, 28);

            ctx.fillStyle = '#fff';
            ctx.font = 'bold 16px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(String(this.quantityInput), L.priceArea.x + 45, L.priceArea.y + 145);

            const qtyMinusBtn = { x: L.priceArea.x + 90, y: L.priceArea.y + 125, width: 28, height: 28, action: 'qty_minus' };
            const qtyPlusBtn = { x: L.priceArea.x + 122, y: L.priceArea.y + 125, width: 28, height: 28, action: 'qty_plus' };
            this.buttons.push(qtyMinusBtn, qtyPlusBtn);

            ctx.fillStyle = '#e74c3c';
            ctx.fillRect(qtyMinusBtn.x, qtyMinusBtn.y, qtyMinusBtn.width, qtyMinusBtn.height);
            ctx.fillStyle = '#2ecc71';
            ctx.fillRect(qtyPlusBtn.x, qtyPlusBtn.y, qtyPlusBtn.width, qtyPlusBtn.height);

            ctx.fillStyle = '#fff';
            ctx.font = 'bold 14px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('-', qtyMinusBtn.x + 14, qtyMinusBtn.y + 20);
            ctx.fillText('+', qtyPlusBtn.x + 14, qtyPlusBtn.y + 20);

            // Stock button
            const canStock = !this.currentTable.item || this.currentTable.item.itemId === this.selectedItem.id;
            const stockBtn = { x: L.priceArea.x + 10, y: L.priceArea.y + 170, width: L.priceArea.width - 20, height: 32, action: 'stock' };
            this.buttons.push(stockBtn);

            ctx.fillStyle = canStock ? '#2ecc71' : '#555';
            ctx.fillRect(stockBtn.x, stockBtn.y, stockBtn.width, stockBtn.height);
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 12px monospace';
            ctx.fillText(canStock ? 'DISPLAY' : 'REMOVE FIRST', stockBtn.x + stockBtn.width / 2, stockBtn.y + 21);
        } else {
            ctx.fillStyle = '#666';
            ctx.font = '11px monospace';
            ctx.textAlign = 'left';
            ctx.fillText('Select item', L.priceArea.x + 10, L.priceArea.y + 50);
            ctx.fillText('from backstock', L.priceArea.x + 10, L.priceArea.y + 66);
        }

        // === ACTIONS ===
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(L.actions.x, L.actions.y, L.actions.width, L.actions.height);

        const closeBtn = { x: L.actions.x + L.actions.width - 100, y: L.actions.y + 5, width: 90, height: 30, action: 'close' };
        this.buttons.push(closeBtn);

        ctx.fillStyle = '#e74c3c';
        ctx.fillRect(closeBtn.x, closeBtn.y, closeBtn.width, closeBtn.height);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 12px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('CLOSE', closeBtn.x + closeBtn.width / 2, closeBtn.y + 20);

        ctx.fillStyle = '#666';
        ctx.font = '10px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(`Max: ${this.currentTable.maxQuantity} items`, L.actions.x + 10, L.actions.y + 25);
    },

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
                        if (!this.currentTable.item || this.currentTable.item.itemId === this.selectedItem?.id) {
                            this.stockItem();
                        }
                        break;
                    case 'unstock':
                        this.unstockItem();
                        break;
                    case 'close':
                        this.close();
                        break;
                }
                return true;
            }
        }

        return false;
    },
};
