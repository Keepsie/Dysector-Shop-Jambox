/* DYSECTOR Shop Prototype - Service Interface System */

const ServiceInterface = {
    active: false,
    canvas: null,
    ctx: null,

    // Current service interaction
    currentNPC: null,
    currentJob: null,

    // Pricing state - WE set the price
    ourPrice: 0,
    marketRate: 0,
    selectedDeadline: null,

    // Negotiation state
    negotiationStage: 'initial',  // initial, quoted, countered, final
    customerReaction: null,
    customerCounterOffer: null,

    // UI state
    dialogueLines: [],
    buttons: [],

    // Layout regions
    layout: {
        dialogue: { x: 0, y: 0, width: 0, height: 0 },
        pricing: { x: 0, y: 0, width: 0, height: 0 },
        calendar: { x: 0, y: 0, width: 0, height: 0 },
        actions: { x: 0, y: 0, width: 0, height: 0 },
    },

    // Calendar data
    calendarDays: [],
    hoveredDay: null,

    // Callback when done
    onComplete: null,

    init() {
        // Will use ShopMap's canvas when active
    },

    // Start service interaction
    startService(npc, job, onComplete) {
        this.active = true;
        this.currentNPC = npc;
        this.currentJob = job;
        this.onComplete = onComplete;

        this.dialogueLines = [];
        this.buttons = [];
        this.selectedDeadline = null;
        this.hoveredDay = null;
        this.negotiationStage = 'initial';
        this.customerReaction = null;
        this.customerCounterOffer = null;

        // Calculate market rate based on problem severity
        this.marketRate = this.calculateMarketRate(job);
        this.ourPrice = this.marketRate;  // Start at market rate

        // Take over canvas
        if (typeof ShopMap !== 'undefined' && ShopMap.canvas) {
            this.canvas = ShopMap.canvas;
            this.ctx = ShopMap.ctx;
            this.calculateLayout();
        }

        // Build calendar days
        this.buildCalendar();

        // Initial dialogue - customer describes problem
        this.addDialogue('customer', `"${job.problemDesc}"`);
        const repairMethod = job.problem?.needsDive ? 'DIVE REQUIRED' : 'WORKBENCH';
        this.addDialogue('system', `[${job.device} - ${job.problemType}]`);
        this.addDialogue('system', `[Repair: ${repairMethod}] [Market rate: $${this.marketRate}]`);

        console.log('[SERVICE] Started service for:', npc.data.name, job);
    },

    calculateLayout() {
        const w = this.canvas.width;
        const h = this.canvas.height;

        this.layout = {
            dialogue: { x: 10, y: 10, width: w * 0.5 - 15, height: h * 0.45 },
            pricing: { x: 10, y: h * 0.47, width: w * 0.5 - 15, height: h * 0.35 },
            actions: { x: 10, y: h * 0.84, width: w * 0.5 - 15, height: h * 0.14 },
            calendar: { x: w * 0.5 + 5, y: 10, width: w * 0.5 - 15, height: h - 20 },
        };
    },

    // Calculate market rate based on job
    calculateMarketRate(job) {
        // Base rate by problem type
        const baseRates = {
            // Dive required
            'virus': 45,
            'corruption': 60,
            'crash': 50,
            'recovery': 80,
            // Workbench
            'slowdown': 30,
            'cleanup': 25,
            'dust': 20,
            'driver': 25,
            'update': 35,
            'startup': 25,
        };

        let base = baseRates[job.problem?.id] || 40;

        // Modify by device grade (higher grade = more delicate = more expensive)
        const gradeMultiplier = {
            'Consumer': 1.0,
            'Professional': 1.3,
            'Enterprise': 1.6,
            'Military': 2.0,
        };
        base *= gradeMultiplier[job.deviceGrade] || 1.0;

        // Modify by whether it needs a dive
        if (job.problem?.needsDive) {
            base *= 1.4;
        }

        return Math.round(base);
    },

    buildCalendar() {
        this.calendarDays = [];
        const today = GameState.currentDay || 1;
        const currentHour = GameState.currentHour || 9;

        // Show 14 days (2 weeks)
        for (let i = 0; i < 14; i++) {
            const dayNum = today + i;
            const isToday = i === 0;
            const isTomorrow = i === 1;

            // Check what jobs are already scheduled this day
            const existingJobs = (GameState.activeJobs || []).filter(j => j.deadline === dayNum).length;

            // Check what bills are due this day
            const billsThisDay = (GameState.bills || []).filter(b => !b.paid && b.dueDay === dayNum);
            const totalCharges = billsThisDay.reduce((sum, b) => sum + b.amount, 0);

            this.calendarDays.push({
                day: dayNum,
                label: isToday ? 'TODAY' : isTomorrow ? 'TOMORROW' : `Day ${dayNum}`,
                shortLabel: isToday ? 'TODAY' : isTomorrow ? 'TMR' : `D${dayNum}`,
                isToday: isToday,
                isTomorrow: isTomorrow,
                daysOut: i,
                existingJobs: existingJobs,
                billCount: billsThisDay.length,
                totalCharges: totalCharges,
                available: !isToday || currentHour < 18,
            });
        }
    },

    addDialogue(type, text) {
        this.dialogueLines.push({ type, text });
        if (this.dialogueLines.length > 6) {
            this.dialogueLines.shift();
        }
    },

    adjustPrice(delta) {
        this.ourPrice = Math.max(5, this.ourPrice + delta);
    },

    setPricePercent(percent) {
        this.ourPrice = Math.round(this.marketRate * (1 + percent / 100));
    },

    selectDeadline(day) {
        this.selectedDeadline = day;
    },

    // Make our quote to the customer
    makeQuote() {
        if (!this.selectedDeadline) {
            this.addDialogue('system', '[Select a deadline first!]');
            return;
        }

        const price = this.ourPrice;
        const deadline = this.selectedDeadline;
        const urgency = this.currentJob.urgency;
        const daysOut = deadline.daysOut;

        // Calculate how customer feels about our price
        const priceRatio = price / this.marketRate;
        const isRush = daysOut <= 1;
        const isQuick = daysOut <= 2;

        // Customer's max they'll pay (varies by urgency)
        let maxWillPay;
        if (urgency.id === 'desperate') {
            maxWillPay = this.marketRate * (1.5 + Math.random() * 0.4);  // 150-190% of market - will pay a lot!
        } else if (urgency.id === 'normal') {
            maxWillPay = this.marketRate * (1.2 + Math.random() * 0.3);  // 120-150% of market - reasonable markup ok
        } else {
            maxWillPay = this.marketRate * (1.0 + Math.random() * 0.2);  // 100-120% of market - want fair price
        }

        // Check deadline compatibility
        let deadlineOk = true;
        if (urgency.id === 'desperate' && daysOut > 2) {
            deadlineOk = false;
        }

        this.addDialogue('player', `"That'll be $${price}, ready by ${deadline.label}."`);

        if (!deadlineOk) {
            // Deadline doesn't work for them
            this.addDialogue('customer', `"${deadline.label}?! I need it way sooner than that!"`);
            this.addDialogue('system', '[They need it faster - try today or tomorrow]');
            this.negotiationStage = 'initial';
            return;
        }

        if (price <= maxWillPay) {
            // They accept!
            this.negotiationStage = 'accepted';
            const reaction = this.getAcceptReaction(priceRatio, urgency.id);
            this.addDialogue('customer', `"${reaction}"`);

            const downPayment = Math.ceil(price / 2);
            this.addDialogue('system', `[ACCEPTED - Down payment: $${downPayment}]`);

            setTimeout(() => {
                this.complete({
                    accepted: true,
                    deadline: deadline.day,
                    price: price,
                    downPayment: downPayment,
                    daysOut: daysOut
                });
            }, 1200);
        } else {
            // They want to negotiate
            this.negotiationStage = 'countered';
            this.customerCounterOffer = Math.round(maxWillPay * (0.85 + Math.random() * 0.1));

            const reaction = this.getCounterReaction(priceRatio, urgency.id);
            this.addDialogue('customer', `"${reaction}"`);
            this.addDialogue('customer', `"How about $${this.customerCounterOffer}?"`);
        }
    },

    getAcceptReaction(priceRatio, urgency) {
        if (priceRatio <= 0.9) {
            return "Wow, that's a great price! Deal!";
        } else if (priceRatio <= 1.0) {
            return "That sounds fair. You've got a deal.";
        } else if (priceRatio <= 1.2) {
            return "A bit steep, but I need this done. Fine.";
        } else {
            if (urgency === 'desperate') {
                return "...Fine. I don't have a choice, do I?";
            }
            return "That's expensive, but... okay, fine.";
        }
    },

    getCounterReaction(priceRatio, urgency) {
        if (priceRatio > 1.5) {
            return "Whoa, that's way too much!";
        } else if (priceRatio > 1.3) {
            return "That's pretty steep...";
        } else {
            return "Hmm, that's more than I was hoping...";
        }
    },

    // Accept customer's counter offer
    acceptCounter() {
        if (!this.customerCounterOffer || !this.selectedDeadline) return;

        this.ourPrice = this.customerCounterOffer;
        this.addDialogue('player', `"Alright, $${this.ourPrice} works."`);
        this.addDialogue('customer', '"Great, thanks!"');

        const downPayment = Math.ceil(this.ourPrice / 2);
        this.addDialogue('system', `[ACCEPTED - Down payment: $${downPayment}]`);

        this.negotiationStage = 'accepted';

        setTimeout(() => {
            this.complete({
                accepted: true,
                deadline: this.selectedDeadline.day,
                price: this.ourPrice,
                downPayment: downPayment,
                daysOut: this.selectedDeadline.daysOut
            });
        }, 1000);
    },

    // Reject counter and hold firm
    rejectCounter() {
        this.addDialogue('player', `"Sorry, $${this.ourPrice} is my price."`);

        // 40% chance they walk, 60% they accept anyway
        if (Math.random() < 0.4) {
            this.addDialogue('customer', '"Then I\'ll find someone else."');
            this.negotiationStage = 'rejected';
            setTimeout(() => {
                this.complete({ accepted: false, reason: 'price_rejected' });
            }, 800);
        } else {
            this.addDialogue('customer', '"...Fine. But this better be worth it."');
            const downPayment = Math.ceil(this.ourPrice / 2);
            this.addDialogue('system', `[ACCEPTED - Down payment: $${downPayment}]`);
            this.negotiationStage = 'accepted';
            setTimeout(() => {
                this.complete({
                    accepted: true,
                    deadline: this.selectedDeadline.day,
                    price: this.ourPrice,
                    downPayment: downPayment,
                    daysOut: this.selectedDeadline.daysOut
                });
            }, 1000);
        }
    },

    // Decline job entirely
    decline() {
        this.addDialogue('player', '"Sorry, can\'t help you with this one."');
        const reaction = this.currentJob.urgency.id === 'desperate'
            ? "Are you serious?! I really need this!"
            : "Oh... okay then.";
        this.addDialogue('customer', `"${reaction}"`);

        setTimeout(() => {
            this.complete({ accepted: false, reason: 'declined' });
        }, 800);
    },

    // Complete the interaction
    complete(result) {
        this.active = false;
        if (this.onComplete) {
            this.onComplete(result);
        }
    },

    // Render the interface
    render() {
        if (!this.active || !this.ctx) return;

        const ctx = this.ctx;
        const L = this.layout;
        this.buttons = [];

        // Background
        ctx.fillStyle = '#0d0d1a';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // === DIALOGUE AREA ===
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(L.dialogue.x, L.dialogue.y, L.dialogue.width, L.dialogue.height);
        ctx.strokeStyle = '#3498db';
        ctx.lineWidth = 2;
        ctx.strokeRect(L.dialogue.x, L.dialogue.y, L.dialogue.width, L.dialogue.height);

        ctx.fillStyle = '#3498db';
        ctx.font = 'bold 12px monospace';
        ctx.textAlign = 'left';
        ctx.fillText('SERVICE REQUEST', L.dialogue.x + 10, L.dialogue.y + 18);

        if (this.currentNPC) {
            ctx.fillStyle = '#f1c40f';
            ctx.font = '11px monospace';
            ctx.fillText(this.currentNPC.data.name, L.dialogue.x + 140, L.dialogue.y + 18);
        }

        // Service type - BIG and visible
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 14px monospace';
        ctx.fillText(this.currentJob.problemType.toUpperCase(), L.dialogue.x + 10, L.dialogue.y + 38);

        // Repair method badge (DIVE or WORKBENCH)
        const needsDive = this.currentJob.problem?.needsDive;
        const methodText = needsDive ? 'DIVE' : 'BENCH';
        const methodColor = needsDive ? '#e74c3c' : '#2ecc71';
        const problemWidth = ctx.measureText(this.currentJob.problemType.toUpperCase()).width;
        ctx.fillStyle = methodColor;
        ctx.font = 'bold 11px monospace';
        ctx.fillText(`[${methodText}]`, L.dialogue.x + 20 + problemWidth, L.dialogue.y + 38);

        // Device and urgency on next line
        ctx.fillStyle = '#888';
        ctx.font = '11px monospace';
        ctx.fillText(this.currentJob.device, L.dialogue.x + 10, L.dialogue.y + 54);

        // Urgency badge
        const urgency = this.currentJob.urgency.id.toUpperCase();
        const urgColor = urgency === 'DESPERATE' ? '#e74c3c' : urgency === 'NORMAL' ? '#f39c12' : '#2ecc71';
        ctx.fillStyle = urgColor;
        ctx.font = 'bold 11px monospace';
        const deviceWidth = ctx.measureText(this.currentJob.device).width;
        ctx.fillText(urgency, L.dialogue.x + 20 + deviceWidth, L.dialogue.y + 54);

        // Dialogue lines
        let lineY = L.dialogue.y + 75;
        ctx.font = '11px monospace';
        for (const line of this.dialogueLines) {
            ctx.fillStyle = line.type === 'customer' ? '#f1c40f' :
                           line.type === 'player' ? '#3498db' : '#888';

            const words = line.text.split(' ');
            let currentLine = '';
            const maxWidth = L.dialogue.width - 20;

            for (const word of words) {
                const testLine = currentLine + word + ' ';
                if (ctx.measureText(testLine).width > maxWidth && currentLine !== '') {
                    ctx.fillText(currentLine.trim(), L.dialogue.x + 10, lineY);
                    currentLine = word + ' ';
                    lineY += 14;
                } else {
                    currentLine = testLine;
                }
            }
            ctx.fillText(currentLine.trim(), L.dialogue.x + 10, lineY);
            lineY += 18;
        }

        // === PRICING AREA ===
        ctx.fillStyle = '#1a2a1a';
        ctx.fillRect(L.pricing.x, L.pricing.y, L.pricing.width, L.pricing.height);
        ctx.strokeStyle = '#2ecc71';
        ctx.lineWidth = 2;
        ctx.strokeRect(L.pricing.x, L.pricing.y, L.pricing.width, L.pricing.height);

        ctx.fillStyle = '#2ecc71';
        ctx.font = 'bold 12px monospace';
        ctx.textAlign = 'left';
        ctx.fillText('YOUR QUOTE', L.pricing.x + 10, L.pricing.y + 18);

        // Market rate reference
        ctx.fillStyle = '#888';
        ctx.font = '10px monospace';
        ctx.fillText(`Market rate: $${this.marketRate}`, L.pricing.x + 10, L.pricing.y + 36);

        // Our price display
        ctx.fillStyle = '#0d0d1a';
        ctx.fillRect(L.pricing.x + 10, L.pricing.y + 45, 80, 32);

        const profit = this.ourPrice - this.marketRate;
        ctx.fillStyle = profit >= 0 ? '#2ecc71' : '#e74c3c';
        ctx.font = 'bold 18px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`$${this.ourPrice}`, L.pricing.x + 50, L.pricing.y + 68);

        // +/- buttons
        const priceMinusBtn = { x: L.pricing.x + 100, y: L.pricing.y + 45, width: 30, height: 32, action: 'price_minus' };
        const pricePlusBtn = { x: L.pricing.x + 135, y: L.pricing.y + 45, width: 30, height: 32, action: 'price_plus' };
        this.buttons.push(priceMinusBtn, pricePlusBtn);

        ctx.fillStyle = '#e74c3c';
        ctx.fillRect(priceMinusBtn.x, priceMinusBtn.y, priceMinusBtn.width, priceMinusBtn.height);
        ctx.fillStyle = '#2ecc71';
        ctx.fillRect(pricePlusBtn.x, pricePlusBtn.y, pricePlusBtn.width, pricePlusBtn.height);

        ctx.fillStyle = '#fff';
        ctx.font = 'bold 16px monospace';
        ctx.fillText('-', priceMinusBtn.x + 15, priceMinusBtn.y + 22);
        ctx.fillText('+', pricePlusBtn.x + 15, pricePlusBtn.y + 22);

        // Quick price buttons
        const btnY = L.pricing.y + 85;
        const p10Btn = { x: L.pricing.x + 10, y: btnY, width: 50, height: 22, action: 'price_10' };
        const p20Btn = { x: L.pricing.x + 65, y: btnY, width: 50, height: 22, action: 'price_20' };
        const p30Btn = { x: L.pricing.x + 120, y: btnY, width: 50, height: 22, action: 'price_30' };
        this.buttons.push(p10Btn, p20Btn, p30Btn);

        ctx.fillStyle = '#4a4a6a';
        ctx.fillRect(p10Btn.x, p10Btn.y, p10Btn.width, p10Btn.height);
        ctx.fillRect(p20Btn.x, p20Btn.y, p20Btn.width, p20Btn.height);
        ctx.fillRect(p30Btn.x, p30Btn.y, p30Btn.width, p30Btn.height);

        ctx.fillStyle = '#fff';
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('+10%', p10Btn.x + 25, p10Btn.y + 15);
        ctx.fillText('+20%', p20Btn.x + 25, p20Btn.y + 15);
        ctx.fillText('+30%', p30Btn.x + 25, p30Btn.y + 15);

        // Profit/margin display
        ctx.textAlign = 'left';
        ctx.fillStyle = profit >= 0 ? '#2ecc71' : '#e74c3c';
        ctx.font = '10px monospace';
        const profitText = profit >= 0 ? `+$${profit} profit` : `-$${-profit} loss`;
        ctx.fillText(profitText, L.pricing.x + 180, L.pricing.y + 68);

        // Selected deadline display
        ctx.fillStyle = '#9b59b6';
        ctx.font = 'bold 11px monospace';
        ctx.fillText('DEADLINE:', L.pricing.x + 10, L.pricing.y + 125);

        ctx.fillStyle = this.selectedDeadline ? '#fff' : '#666';
        ctx.font = '11px monospace';
        ctx.fillText(this.selectedDeadline ? this.selectedDeadline.label : '(select from calendar)', L.pricing.x + 90, L.pricing.y + 125);

        // Down payment preview
        if (this.selectedDeadline) {
            const downPayment = Math.ceil(this.ourPrice / 2);
            ctx.fillStyle = '#f39c12';
            ctx.font = '10px monospace';
            ctx.fillText(`Half down: $${downPayment}`, L.pricing.x + 10, L.pricing.y + 145);
        }

        // === ACTIONS AREA ===
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(L.actions.x, L.actions.y, L.actions.width, L.actions.height);

        if (this.negotiationStage === 'countered') {
            // Counter offer buttons
            const acceptBtn = { x: L.actions.x + 10, y: L.actions.y + 10, width: 100, height: 30, action: 'accept_counter' };
            const rejectBtn = { x: L.actions.x + 120, y: L.actions.y + 10, width: 100, height: 30, action: 'reject_counter' };
            this.buttons.push(acceptBtn, rejectBtn);

            ctx.fillStyle = '#2ecc71';
            ctx.fillRect(acceptBtn.x, acceptBtn.y, acceptBtn.width, acceptBtn.height);
            ctx.fillStyle = '#e74c3c';
            ctx.fillRect(rejectBtn.x, rejectBtn.y, rejectBtn.width, rejectBtn.height);

            ctx.fillStyle = '#fff';
            ctx.font = 'bold 11px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('ACCEPT', acceptBtn.x + 50, acceptBtn.y + 20);
            ctx.fillText('HOLD FIRM', rejectBtn.x + 50, rejectBtn.y + 20);

        } else if (this.negotiationStage !== 'accepted' && this.negotiationStage !== 'rejected') {
            // Normal buttons
            const quoteBtn = { x: L.actions.x + 10, y: L.actions.y + 10, width: 120, height: 30, action: 'quote' };
            const declineBtn = { x: L.actions.x + 140, y: L.actions.y + 10, width: 90, height: 30, action: 'decline' };
            this.buttons.push(quoteBtn, declineBtn);

            ctx.fillStyle = this.selectedDeadline ? '#2ecc71' : '#555';
            ctx.fillRect(quoteBtn.x, quoteBtn.y, quoteBtn.width, quoteBtn.height);
            ctx.fillStyle = '#e74c3c';
            ctx.fillRect(declineBtn.x, declineBtn.y, declineBtn.width, declineBtn.height);

            ctx.fillStyle = '#fff';
            ctx.font = 'bold 11px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('MAKE QUOTE', quoteBtn.x + 60, quoteBtn.y + 20);
            ctx.fillText('DECLINE', declineBtn.x + 45, declineBtn.y + 20);
        }

        // === CALENDAR ===
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(L.calendar.x, L.calendar.y, L.calendar.width, L.calendar.height);
        ctx.strokeStyle = '#9b59b6';
        ctx.lineWidth = 2;
        ctx.strokeRect(L.calendar.x, L.calendar.y, L.calendar.width, L.calendar.height);

        ctx.fillStyle = '#9b59b6';
        ctx.font = 'bold 12px monospace';
        ctx.textAlign = 'left';
        ctx.fillText('SELECT DEADLINE', L.calendar.x + 10, L.calendar.y + 18);

        // Urgency hint
        const urgHint = this.currentJob.urgency.id === 'desperate' ? 'NEEDS IT FAST!' :
                       this.currentJob.urgency.id === 'normal' ? 'Standard timing' : 'No rush';
        ctx.fillStyle = this.currentJob.urgency.id === 'desperate' ? '#e74c3c' :
                       this.currentJob.urgency.id === 'normal' ? '#f39c12' : '#2ecc71';
        ctx.font = '10px monospace';
        ctx.fillText(urgHint, L.calendar.x + 150, L.calendar.y + 18);

        // Calendar grid
        const cellWidth = (L.calendar.width - 20) / 2;
        const cellHeight = 32;
        const startX = L.calendar.x + 10;
        const startY = L.calendar.y + 35;

        this.calendarDays.forEach((day, i) => {
            const col = Math.floor(i / 7);
            const row = i % 7;
            const cellX = startX + col * cellWidth;
            const cellY = startY + row * cellHeight;

            day._x = cellX;
            day._y = cellY;
            day._width = cellWidth - 4;
            day._height = cellHeight - 4;

            // Cell background
            let bgColor = '#2a2a4e';
            if (this.selectedDeadline === day) {
                bgColor = '#4a4a8e';
            } else if (this.hoveredDay === day) {
                bgColor = '#3a3a6e';
            } else if (day.isToday) {
                bgColor = '#2a3a2a';
            }

            if (!day.available) {
                bgColor = '#1a1a1a';
            }

            ctx.fillStyle = bgColor;
            ctx.fillRect(cellX, cellY, cellWidth - 4, cellHeight - 4);

            ctx.strokeStyle = this.selectedDeadline === day ? '#2ecc71' :
                             day.isToday ? '#2ecc71' : day.isTomorrow ? '#f39c12' : '#444';
            ctx.lineWidth = this.selectedDeadline === day ? 2 : 1;
            ctx.strokeRect(cellX, cellY, cellWidth - 4, cellHeight - 4);

            ctx.fillStyle = day.available ? '#fff' : '#555';
            ctx.font = '10px monospace';
            ctx.textAlign = 'left';
            ctx.fillText(day.label, cellX + 5, cellY + 14);

            // Job count and charges on same line
            let infoX = cellX + 5;
            if (day.existingJobs > 0) {
                ctx.fillStyle = '#e74c3c';
                ctx.font = '9px monospace';
                ctx.fillText(`${day.existingJobs}J`, infoX, cellY + 25);
                infoX += ctx.measureText(`${day.existingJobs}J`).width + 6;
            }
            if (day.totalCharges > 0) {
                ctx.fillStyle = '#f39c12';
                ctx.font = '9px monospace';
                ctx.fillText(`-$${day.totalCharges}`, infoX, cellY + 25);
            }
        });
    },

    handleClick(x, y) {
        if (!this.active) return false;

        // Check buttons
        for (const btn of this.buttons) {
            if (x >= btn.x && x <= btn.x + btn.width &&
                y >= btn.y && y <= btn.y + btn.height) {

                switch (btn.action) {
                    case 'price_minus': this.adjustPrice(-5); break;
                    case 'price_plus': this.adjustPrice(5); break;
                    case 'price_10': this.setPricePercent(10); break;
                    case 'price_20': this.setPricePercent(20); break;
                    case 'price_30': this.setPricePercent(30); break;
                    case 'quote': this.makeQuote(); break;
                    case 'decline': this.decline(); break;
                    case 'accept_counter': this.acceptCounter(); break;
                    case 'reject_counter': this.rejectCounter(); break;
                }
                return true;
            }
        }

        // Check calendar days
        for (const day of this.calendarDays) {
            if (day.available && day._x !== undefined) {
                if (x >= day._x && x <= day._x + day._width &&
                    y >= day._y && y <= day._y + day._height) {
                    this.selectDeadline(day);
                    return true;
                }
            }
        }

        return false;
    },

    handleMove(x, y) {
        if (!this.active) return;

        this.hoveredDay = null;
        for (const day of this.calendarDays) {
            if (day.available && day._x !== undefined) {
                if (x >= day._x && x <= day._x + day._width &&
                    y >= day._y && y <= day._y + day._height) {
                    this.hoveredDay = day;
                    break;
                }
            }
        }
    },
};
