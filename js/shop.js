/* DYSECTOR Shop Prototype - Shop Tab Logic */

const Shop = {
    textDisplay: null,
    optionsContainer: null,
    currentCustomer: null,
    currentMapCustomer: null, // Customer object from ShopMap
    interactionState: 'idle', // idle, customer_arriving, negotiating, working
    customerSpawnTimer: null,

    init() {
        this.textDisplay = document.getElementById('shop-text-display');
        this.optionsContainer = document.getElementById('shop-options');
        this.bindEvents();

        // Start with morning phase
        this.startNewDay();

        // Update map stats periodically
        setInterval(() => this.updateMapStats(), 500);
    },

    updateMapStats() {
        const countEl = document.getElementById('map-customer-count');
        const waitingEl = document.getElementById('map-waiting-count');
        if (countEl && typeof ShopMap !== 'undefined') {
            countEl.textContent = ShopMap.getCustomerCount();
        }
        if (waitingEl && typeof ShopMap !== 'undefined') {
            waitingEl.textContent = ShopMap.getWaitingCount();
        }
    },

    // Called by ShopMap when customer is clicked
    triggerCustomerDialogue(mapCustomer) {
        if (this.interactionState !== 'idle' || !GameState.shopOpen) return;
        if (mapCustomer.state !== 'waiting') {
            this.addText(`[Customer is still browsing...]`, 'system');
            return;
        }

        this.currentMapCustomer = mapCustomer;
        this.currentCustomer = mapCustomer.data;
        this.interactionState = 'customer_arriving';
        GameState.customersToday++;
        updateDisplays();

        this.addText('', 'narrator');
        this.addText(`<span class="customer-name">${this.currentCustomer.name}</span> is at the counter with a <span class="item-highlight">${this.currentCustomer.device.fullName}</span>.`, 'narrator');

        // Show urgency hint
        if (this.currentCustomer.urgency.id === 'desperate') {
            this.addText('They look stressed, glancing at their watch repeatedly.', 'narrator');
        } else if (this.currentCustomer.urgency.id === 'flexible') {
            this.addText('They seem relaxed and patient.', 'narrator');
        }

        this.setOptions([
            { label: '"What can I help you with?"', action: 'greet', class: 'primary' },
            { label: '[Wave them off]', action: 'dismiss_customer', class: 'danger' }
        ]);
    },

    // Called by ShopMap when customer reaches counter
    customerReady(mapCustomer) {
        this.addText(`[A customer is waiting at the counter]`, 'system');
    },

    // Called when player interacts with SERVICE customer
    triggerServiceDialogue(npc) {
        if (this.interactionState !== 'idle') return;

        this.currentNPC = npc;
        this.currentCustomer = npc.data;
        this.interactionState = 'negotiating';

        this.addText('', 'narrator');
        this.addText(`<span class="customer-name">${npc.data.name}</span> approaches with a <span class="item-highlight">${npc.data.device.fullName}</span>.`, 'narrator');

        // Show urgency hint
        if (npc.data.urgency?.id === 'desperate') {
            this.addText('They look stressed, desperate for help.', 'narrator');
        } else if (npc.data.urgency?.id === 'flexible') {
            this.addText('They seem relaxed, in no particular rush.', 'narrator');
        }

        const greeting = DialogueSystem.getPlayerGreeting();
        this.setOptions([
            { label: `"${greeting}"`, action: 'greet', class: 'primary' },
            { label: '"Sorry, not taking jobs right now."', action: 'dismiss_npc', class: 'danger' }
        ]);
    },

    // Called when player interacts with BUY customer
    triggerSaleDialogue(npc) {
        if (this.interactionState !== 'idle') return;

        this.currentNPC = npc;
        this.interactionState = 'selling';

        this.addText('', 'narrator');
        this.addText(`<span class="customer-name">${npc.data.name}</span> is ready to make a purchase.`, 'narrator');

        // Generate what they want to buy using dialogue system
        const wantsToBuy = DialogueSystem.getSaleRequest();

        this.addText(`"${wantsToBuy.dialogue}"`, 'customer');
        this.addText(`[SALE] ${wantsToBuy.item} - ${formatMoney(wantsToBuy.price)}`, 'system');

        this.currentSale = wantsToBuy;

        this.setOptions([
            { label: `"That'll be ${formatMoney(wantsToBuy.price)}." [Sell]`, action: 'complete_sale', class: 'success' },
            { label: '"Sorry, out of stock."', action: 'decline_sale' },
            { label: '"Actually, let me show you something better..." [Upsell]', action: 'upsell', class: 'negotiate' }
        ]);
    },

    // Handle dismiss NPC
    dismissNPC() {
        if (this.currentNPC) {
            this.addText('"Sorry, can\'t help right now."', 'player');
            this.addText(`${this.currentNPC.data.name} leaves disappointed.`, 'narrator');
        }
        this.finishInteraction(false);
    },

    // Complete a sale
    completeSale() {
        if (!this.currentSale || !this.currentNPC) return;

        GameState.cash += this.currentSale.price;
        GameState.stats = GameState.stats || {};
        GameState.stats.totalEarnings = (GameState.stats.totalEarnings || 0) + this.currentSale.price;

        this.addText(`"Here you go. ${formatMoney(this.currentSale.price)}, please."`, 'player');
        const thanks = DialogueSystem.getSaleComplete();
        this.addText(`"${thanks}"`, 'customer');
        this.addText(`[+${formatMoney(this.currentSale.price)}]`, 'success');

        updateDisplays();
        this.finishInteraction(true);
    },

    // Decline sale
    declineSale() {
        if (!this.currentNPC) return;

        const playerLine = DialogueSystem.getOutOfStockPlayer();
        const customerLine = DialogueSystem.getOutOfStockCustomer();

        this.addText(`"${playerLine}"`, 'player');
        this.addText(`"${customerLine}"`, 'customer');

        this.finishInteraction(false);
    },

    // Try to upsell
    tryUpsell() {
        if (!this.currentSale || !this.currentNPC) return;

        const upsellPrice = Math.round(this.currentSale.price * 1.5);
        const accepts = Math.random() < 0.4;  // 40% chance

        this.addText(`"Actually, I've got something better for ${formatMoney(upsellPrice)}..."`, 'player');

        if (accepts) {
            this.currentSale.price = upsellPrice;
            const acceptLine = DialogueSystem.getUpsellAccept();
            this.addText(`"${acceptLine}"`, 'customer');
            this.setOptions([
                { label: '[Complete sale]', action: 'complete_sale', class: 'success' }
            ]);
        } else {
            const rejectLine = DialogueSystem.getUpsellReject();
            this.addText(`"${rejectLine}"`, 'customer');
            this.setOptions([
                { label: '[Complete original sale]', action: 'complete_sale', class: 'success' },
                { label: '"Nevermind then."', action: 'decline_sale', class: 'danger' }
            ]);
        }
    },

    // Unified function to finish any interaction and clear NPC
    finishInteraction(satisfied = true) {
        // Handle NPC system NPCs
        if (this.currentNPC) {
            if (satisfied) {
                NPCSystem.completeService(this.currentNPC.id);
            } else {
                NPCSystem.dismissNPC(this.currentNPC.id);
            }
            this.currentNPC = null;
        }

        // Clear old references too (for backwards compat)
        this.currentMapCustomer = null;
        this.currentCustomer = null;
        this.currentSale = null;
        this.interactionState = 'idle';

        this.returnToIdle();
    },

    bindEvents() {
        // Bind option buttons via delegation
        if (this.optionsContainer) {
            this.optionsContainer.addEventListener('click', (e) => {
                const btn = e.target.closest('.option-btn');
                if (btn && !btn.classList.contains('disabled')) {
                    const action = btn.dataset.action;
                    this.handleAction(action);
                }
            });
        }
    },

    // Add text to the display
    addText(text, type = 'narrator') {
        if (!this.textDisplay) return;

        const line = document.createElement('div');
        line.className = `text-line ${type}`;
        line.innerHTML = text;
        this.textDisplay.appendChild(line);

        // Auto-scroll to bottom
        this.textDisplay.scrollTop = this.textDisplay.scrollHeight;
    },

    // Clear text display
    clearText() {
        if (this.textDisplay) {
            this.textDisplay.innerHTML = '';
        }
    },

    // Set options
    setOptions(options) {
        if (!this.optionsContainer) return;

        this.optionsContainer.innerHTML = '';
        options.forEach((opt, index) => {
            const btn = document.createElement('button');
            btn.className = `option-btn ${opt.class || ''}`;
            btn.dataset.action = opt.action;
            if (opt.disabled) btn.classList.add('disabled');
            btn.innerHTML = `[${index + 1}] ${opt.label}`;
            this.optionsContainer.appendChild(btn);
        });
    },

    // Handle action
    handleAction(action) {
        switch (action) {
            case 'wait':
                this.waitForCustomer();
                break;
            case 'workbench':
                this.goToWorkbench();
                break;
            case 'close':
                this.closeShopEarly();
                break;
            case 'greet':
                this.greetCustomer();
                break;
            case 'ask_problem':
                this.askAboutProblem();
                break;
            case 'accept_deadline':
                this.acceptDeadline();
                break;
            case 'counter_deadline':
                this.counterDeadline();
                break;
            case 'rush_offer':
                this.offerRush();
                break;
            case 'decline_job':
                this.declineJob();
                break;
            case 'confirm_job':
                this.confirmJob();
                break;
            case 'back_to_idle':
                this.returnToIdle();
                break;
            case 'dismiss_customer':
                this.dismissCustomer();
                break;
            case 'dismiss_npc':
                this.dismissNPC();
                break;
            case 'complete_sale':
                this.completeSale();
                break;
            case 'decline_sale':
                this.declineSale();
                break;
            case 'upsell':
                this.tryUpsell();
                break;
            case 'open_shop':
                this.openShop();
                break;
            case 'go_dive_os':
                document.querySelector('[data-tab="dive-os"]')?.click();
                break;
            case 'go_calendar':
                document.querySelector('[data-tab="calendar"]')?.click();
                break;
            case 'go_shop_os':
                document.querySelector('[data-tab="shop-os"]')?.click();
                break;
            case 'sleep':
                this.goToSleep();
                break;
            case 'dive':
                this.startDive();
                break;
            case 'end_day':
                this.goToSleep();
                break;
            default:
                console.log('Unknown action:', action);
        }
    },

    // ========================================
    // DAY PHASE MANAGEMENT
    // ========================================

    startNewDay() {
        this.clearText();
        this.interactionState = 'idle';
        this.currentCustomer = null;

        this.addText(`[DAY ${GameState.currentDay}] ${GameState.currentDayName}`, 'system');
        this.addText(`You wake up at 8:00 AM. ${FatigueSystem.getFatigueLevel() === 'rested' ? 'Feeling refreshed.' : 'Still a bit tired.'}`, 'narrator');
        this.addText('', 'narrator');

        // Check for pending jobs
        const urgentJobs = GameState.activeJobs.filter(j => j.deadline === GameState.currentDay);
        if (urgentJobs.length > 0) {
            this.addText(`[ALERT] ${urgentJobs.length} job(s) due TODAY!`, 'alert');
        }

        // Check bills
        const billsDue = GameState.bills.filter(b => !b.paid && b.dueDay === GameState.currentDay);
        if (billsDue.length > 0) {
            billsDue.forEach(b => {
                this.addText(`[BILL DUE] ${b.name}: ${formatMoney(b.amount)}`, 'error');
            });
        }

        this.showMorningOptions();
    },

    showMorningOptions() {
        this.addText('Morning prep time. Shop opens when you\'re ready.', 'narrator');
        this.setOptions([
            { label: 'Open shop for business', action: 'open_shop', class: 'success' },
            { label: 'Check Dive loadout', action: 'go_dive_os' },
            { label: 'Check calendar', action: 'go_calendar' },
            { label: 'Shop PC (orders, bills)', action: 'go_shop_os' }
        ]);
    },

    openShop() {
        TimeSystem.start();
        TimeSystem.openShop();

        this.addText('', 'narrator');
        this.addText('[SYSTEM] Shop opened. Business hours: 9AM - 9PM', 'system');
        this.addText('You flip the sign to OPEN and take your place at the counter.', 'narrator');

        // Start customer spawn timer
        this.startCustomerSpawning();

        this.returnToIdle();
    },

    // Return to idle state (during open hours)
    returnToIdle() {
        this.interactionState = 'idle';
        this.currentCustomer = null;

        if (GameState.dayPhase === 'open') {
            const waitingCount = typeof ShopMap !== 'undefined' ? ShopMap.getWaitingCount() : 0;
            const options = [];

            if (waitingCount > 0) {
                options.push({ label: `[Click a customer on the map to serve them]`, action: 'wait', disabled: true });
            } else {
                options.push({ label: '[Waiting for customers...]', action: 'wait', disabled: true });
            }
            options.push({ label: 'Go to workbench', action: 'workbench' });
            options.push({ label: 'Close shop early', action: 'close', class: 'danger' });

            this.setOptions(options);
        } else if (GameState.dayPhase === 'closed') {
            this.showClosedOptions();
        } else {
            this.showMorningOptions();
        }
    },

    showClosedOptions() {
        const canDive = FatigueSystem.canDive();
        const fatigueLevel = FatigueSystem.getFatigueLevel();

        const options = [];

        // Dive option
        if (GameState.divesRemaining > 0 && GameState.workbenchSlots.some(s => s !== null)) {
            if (canDive.allowed) {
                options.push({ label: `Dive into device (${GameState.divesRemaining} charges)`, action: 'dive', class: 'primary' });
            } else {
                options.push({ label: `Dive (${canDive.reason})`, action: 'dive', class: 'disabled', disabled: true });
            }
        }

        // Workbench
        if (GameState.workbenchSlots.some(s => s !== null)) {
            options.push({ label: 'Work at bench (scan/repair)', action: 'workbench' });
        }

        // Other tabs
        options.push({ label: 'Prep dive loadout', action: 'go_dive_os' });
        options.push({ label: 'Shop PC', action: 'go_shop_os' });

        // Sleep
        if (fatigueLevel === 'critical' || fatigueLevel === 'exhausted') {
            options.push({ label: 'Go to sleep (end day)', action: 'sleep', class: 'success' });
        } else {
            options.push({ label: 'Go to sleep (end day)', action: 'sleep' });
        }

        this.setOptions(options);
    },

    goToSleep() {
        this.addText('', 'narrator');
        this.addText('You head to bed. Tomorrow is another day...', 'narrator');

        // Brief pause then advance day
        setTimeout(() => {
            FatigueSystem.sleep();
        }, 1000);
    },

    // ========================================
    // CUSTOMER SPAWNING - Now uses ShopMap
    // ========================================

    startCustomerSpawning() {
        // Check for customers periodically during open hours
        this.customerSpawnTimer = setInterval(() => {
            if (!GameState.shopOpen || GameState.timePaused) return;

            // Don't spawn if map is full
            if (typeof ShopMap !== 'undefined' && ShopMap.customers.length >= ShopMap.maxCustomers) return;

            // Random chance of customer (higher early, lower late)
            const hourProgress = (GameState.currentHour - GameState.businessHoursStart) /
                                (GameState.businessHoursEnd - GameState.businessHoursStart);
            const baseChance = 0.2; // 20% check every few seconds
            const timeModifier = hourProgress < 0.5 ? 1.2 : 0.8; // Busier in morning

            if (Math.random() < baseChance * timeModifier) {
                this.spawnCustomerOnMap();
            }
        }, 2500); // Check every 2.5 real seconds
    },

    spawnCustomerOnMap() {
        const customerData = generateCustomer();
        if (typeof ShopMap !== 'undefined') {
            ShopMap.spawnCustomer(customerData);
            this.addText('The door chimes. A customer walks in.', 'narrator');
        }
    },

    stopCustomerSpawning() {
        if (this.customerSpawnTimer) {
            clearInterval(this.customerSpawnTimer);
            this.customerSpawnTimer = null;
        }
    },

    dismissCustomer() {
        if (this.currentMapCustomer) {
            this.addText('"Sorry, can\'t help you right now."', 'player');
            this.addText(`${this.currentCustomer.name} looks disappointed and leaves.`, 'narrator');
            ShopMap.customerLeave(this.currentMapCustomer.id);
        }
        this.currentCustomer = null;
        this.currentMapCustomer = null;
        this.interactionState = 'idle';
        this.returnToIdle();
    },

    // ========================================
    // DIVING
    // ========================================

    startDive() {
        // Find a device to dive into
        const deviceWithJob = GameState.workbenchSlots.find((d, i) => {
            if (!d) return false;
            const job = GameState.activeJobs.find(j => j.device.id === d.id);
            return job && !d.problems.every(p => p.fixed);
        });

        const device = deviceWithJob || GameState.workbenchSlots.find(d => d !== null);

        if (!device) {
            this.addText('[ERROR] No device on workbench to dive into.', 'error');
            return;
        }

        const job = GameState.activeJobs.find(j => j.device.id === device.id);

        this.addText('', 'narrator');
        this.addText(`Initiating dive into ${device.fullName}...`, 'narrator');
        this.addText('[DIVE STARTING] Entering system...', 'system');

        // Pause for effect
        TimeSystem.pauseTime();

        setTimeout(() => {
            const result = DiveSimulator.simulateDive(device, job);

            // Display results line by line
            const lines = DiveSimulator.formatResult(result).split('\n');
            lines.forEach(line => {
                const type = line.includes('COMPLETE') || line.includes('EXCELLENT') ? 'success' :
                            line.includes('FAILED') || line.includes('ABORTED') ? 'error' : 'system';
                this.addText(line, type);
            });

            TimeSystem.resumeTime();
            this.showClosedOptions();
            this.updateJobsDisplay();
        }, 1500);
    },

    // Wait for customer
    waitForCustomer() {
        advanceTime(15); // 15 minutes pass

        // Random chance of customer
        const customerChance = GameState.shopOpen ? 0.6 : 0.1;

        if (Math.random() < customerChance) {
            this.customerArrives();
        } else {
            const messages = [
                'The shop remains quiet. A hover-car passes by outside.',
                'You hear distant construction. No customers yet.',
                'The hum of the SYNC network fills the silence.',
                'A notification pings on your terminal. Just spam.',
                'Quiet afternoon. The workbench beckons.'
            ];
            this.addText(messages[Math.floor(Math.random() * messages.length)], 'narrator');

            // Check if shop should close
            if (!GameState.shopOpen) {
                this.addText('[SYSTEM] Business hours ended. Shop is now closed.', 'system');
                this.setOptions([
                    { label: 'Go to workbench', action: 'workbench' },
                    { label: 'End day', action: 'end_day' }
                ]);
            }
        }
    },

    // Customer arrives
    customerArrives() {
        this.currentCustomer = generateCustomer();
        this.interactionState = 'customer_arriving';
        GameState.customersToday++;
        updateDisplays();

        this.addText('', 'narrator');
        this.addText('The door chimes. A customer walks in.', 'narrator');
        this.addText(`<span class="customer-name">${this.currentCustomer.name}</span> approaches the counter, holding a <span class="item-highlight">${this.currentCustomer.device.fullName}</span>.`, 'narrator');

        // Show urgency hint
        if (this.currentCustomer.urgency.id === 'desperate') {
            this.addText('They look stressed, glancing at their watch repeatedly.', 'narrator');
        } else if (this.currentCustomer.urgency.id === 'flexible') {
            this.addText('They seem relaxed, browsing the shelves while waiting.', 'narrator');
        }

        this.setOptions([
            { label: '"What can I help you with?"', action: 'greet', class: 'primary' },
            { label: '[Ignore - continue working]', action: 'back_to_idle' }
        ]);
    },

    // Greet customer
    greetCustomer() {
        this.interactionState = 'negotiating';

        const greeting = DialogueSystem.getPlayerGreeting();
        this.addText(`"${greeting}"`, 'player');

        const c = this.currentCustomer;
        const problem = c.problem;
        const deviceName = c.device.typeName.toLowerCase();

        // Get problem description from dialogue system
        const description = DialogueSystem.getProblemDescription(problem.id, deviceName);
        this.addText(`"${description}"`, 'customer');

        this.setOptions([
            { label: '"Let me take a look at it."', action: 'ask_problem', class: 'primary' }
        ]);
    },

    // Examine the problem
    askAboutProblem() {
        const c = this.currentCustomer;

        this.addText('"Let me take a look."', 'player');
        this.addText(`You examine the ${c.device.fullName}...`, 'narrator');

        // Quick diagnosis based on visible signs
        advanceTime(5);

        this.addText(`[DIAGNOSIS] ${c.problem.description}. ${c.problem.needsDive ? 'Will require a dive to fix.' : 'Can be fixed at workbench.'}`, 'system');

        // Show device grade
        const gradeDisplay = c.device.grade.toUpperCase();
        this.addText(`[DEVICE] Grade: ${gradeDisplay} | Health: ${c.device.health}%`, 'system');

        // Customer states deadline preference using dialogue system
        const deadlineDay = GameState.currentDay + c.desiredDeadline;
        const deadlineDayName = GameState.dayNames[(deadlineDay - 1) % 7];

        // Get urgency-specific dialogue from the system
        const urgencyLine = DialogueSystem.getUrgencyInitial(c.urgency.id);
        this.addText(`"${urgencyLine}" They mention ${deadlineDayName} as their preferred deadline.`, 'customer');

        this.addText(`[QUOTE] Repair price: <span class="money-highlight">${formatMoney(c.repairPrice)}</span>`, 'system');

        this.setOptions([
            { label: `"${deadlineDayName} works." [Accept deadline]`, action: 'accept_deadline', class: 'success' },
            { label: '"I\'ll need more time." [Counter]', action: 'counter_deadline', class: 'negotiate' },
            { label: '"I can rush it for extra." [Rush offer]', action: 'rush_offer', class: 'negotiate' },
            { label: '"Sorry, can\'t take this job."', action: 'decline_job', class: 'danger' }
        ]);
    },

    // Accept the deadline
    acceptDeadline() {
        const c = this.currentCustomer;
        const deadline = GameState.currentDay + c.desiredDeadline;
        c.negotiatedDeadline = deadline;

        this.addText(`"${GameState.dayNames[(deadline - 1) % 7]} it is. I'll have it ready."`, 'player');

        // Get job confirmed dialogue based on urgency
        const confirmLine = DialogueSystem.getJobConfirmed(c.urgency.id);
        this.addText(`"${confirmLine}"`, 'customer');

        this.setOptions([
            { label: '[Confirm job]', action: 'confirm_job', class: 'success' }
        ]);
    },

    // Counter with longer deadline
    counterDeadline() {
        const c = this.currentCustomer;
        const originalDeadline = GameState.currentDay + c.desiredDeadline;
        const newDeadline = originalDeadline + 2; // 2 days later
        const newDayName = GameState.dayNames[(newDeadline - 1) % 7];

        this.addText(`"I've got a full schedule. Best I can do is ${newDayName}."`, 'player');

        // Customer reaction based on urgency - use dialogue system
        if (c.urgency.id === 'desperate') {
            // Desperate customers don't like waiting
            const accepts = Math.random() < 0.3;
            if (accepts) {
                c.negotiatedDeadline = newDeadline;
                c.repairPrice = Math.round(c.repairPrice * 0.9); // Slight discount for wait
                const acceptLine = DialogueSystem.getUrgencyAcceptCounter('desperate');
                this.addText(`"${acceptLine}"`, 'customer');
                this.addText(`[UPDATED] Price adjusted to ${formatMoney(c.repairPrice)}`, 'system');
                this.setOptions([
                    { label: '[Confirm job]', action: 'confirm_job', class: 'success' }
                ]);
            } else {
                const rejectLine = DialogueSystem.getUrgencyRejectCounter('desperate');
                this.addText(`"${rejectLine}"`, 'customer');
                this.addText(`${c.name} leaves the shop.`, 'narrator');
                this.finishInteraction(false);
            }
        } else if (c.urgency.id === 'flexible') {
            // Flexible customers are fine with it
            c.negotiatedDeadline = newDeadline;
            c.repairPrice = Math.round(c.repairPrice * 0.85); // Discount for flexibility
            const acceptLine = DialogueSystem.getUrgencyAcceptCounter('flexible');
            this.addText(`"${acceptLine}"`, 'customer');
            this.addText(`[UPDATED] Price adjusted to ${formatMoney(c.repairPrice)}`, 'system');
            this.setOptions([
                { label: '[Confirm job]', action: 'confirm_job', class: 'success' }
            ]);
        } else {
            // Normal customers might accept
            const accepts = Math.random() < 0.6;
            if (accepts) {
                c.negotiatedDeadline = newDeadline;
                const acceptLine = DialogueSystem.getUrgencyAcceptCounter('normal');
                this.addText(`"${acceptLine}"`, 'customer');
                this.setOptions([
                    { label: '[Confirm job]', action: 'confirm_job', class: 'success' }
                ]);
            } else {
                const rejectLine = DialogueSystem.getUrgencyRejectCounter('normal');
                this.addText(`"${rejectLine}"`, 'customer');
                this.addText(`${c.name} leaves, uncertain.`, 'narrator');
                this.finishInteraction(false);
            }
        }
    },

    // Offer rush service
    offerRush() {
        const c = this.currentCustomer;
        const rushPrice = Math.round(c.repairPrice * 1.4); // 40% markup
        const rushDeadline = GameState.currentDay + 1; // Tomorrow
        const rushDayName = GameState.dayNames[(rushDeadline - 1) % 7];

        this.addText(`"I can have it done by ${rushDayName} - tomorrow. Rush fee brings it to ${formatMoney(rushPrice)}."`, 'player');

        if (c.urgency.id === 'desperate') {
            // Desperate customers accept rush
            c.negotiatedDeadline = rushDeadline;
            c.repairPrice = rushPrice;
            const acceptLine = DialogueSystem.getUrgencyAcceptRush('desperate');
            this.addText(`"${acceptLine}"`, 'customer');
            this.setOptions([
                { label: '[Confirm job]', action: 'confirm_job', class: 'success' }
            ]);
        } else if (c.urgency.id === 'flexible') {
            // Flexible customers decline rush
            const rejectLine = DialogueSystem.getUrgencyRejectRush('flexible');
            this.addText(`"${rejectLine}"`, 'customer');
            // Revert to counter
            this.setOptions([
                { label: '"Okay, regular timing then." [Accept original]', action: 'accept_deadline', class: 'success' },
                { label: '"Sorry, rush or nothing."', action: 'decline_job', class: 'danger' }
            ]);
        } else {
            // Normal customers might accept
            const accepts = Math.random() < 0.4;
            if (accepts) {
                c.negotiatedDeadline = rushDeadline;
                c.repairPrice = rushPrice;
                const acceptLine = DialogueSystem.getUrgencyAcceptRush('normal');
                this.addText(`"${acceptLine}"`, 'customer');
                this.setOptions([
                    { label: '[Confirm job]', action: 'confirm_job', class: 'success' }
                ]);
            } else {
                const rejectLine = DialogueSystem.getUrgencyRejectRush('normal');
                this.addText(`"${rejectLine}"`, 'customer');
                this.setOptions([
                    { label: '"Sure, regular timing works."', action: 'accept_deadline', class: 'success' },
                    { label: '"Rush or I can\'t fit you in."', action: 'decline_job', class: 'danger' }
                ]);
            }
        }
    },

    // Decline the job
    declineJob() {
        const c = this.currentCustomer;

        this.addText('"Sorry, I can\'t take this job right now."', 'player');

        // Get decline reaction based on urgency
        const isDesperate = c.urgency?.id === 'desperate';
        const reactionLine = DialogueSystem.getDeclineReaction(isDesperate);
        this.addText(`"${reactionLine}"`, 'customer');

        this.addText(`${c.name} leaves the shop, disappointed.`, 'narrator');
        this.finishInteraction(false);
    },

    // Confirm and book the job
    confirmJob() {
        const c = this.currentCustomer;

        // Create job entry
        const job = {
            id: Date.now(),
            customer: c.name,
            device: c.device,
            problem: c.problem,
            price: c.repairPrice,
            deadline: c.negotiatedDeadline,
            deadlineDayName: GameState.dayNames[(c.negotiatedDeadline - 1) % 7],
            status: 'pending', // pending, in_progress, complete, overdue
            acceptedDay: GameState.currentDay
        };

        GameState.activeJobs.push(job);

        // Add device to workbench
        const emptySlot = GameState.workbenchSlots.findIndex(s => s === null);
        if (emptySlot !== -1) {
            GameState.workbenchSlots[emptySlot] = c.device;
        }

        this.addText(`[JOB ACCEPTED] ${c.device.fullName} for ${c.name}`, 'success');
        this.addText(`Deadline: ${job.deadlineDayName} (Day ${job.deadline}) | Payment: ${formatMoney(job.price)}`, 'system');

        this.addText(`${c.name} hands over the ${c.device.typeName.toLowerCase()} and leaves.`, 'narrator');

        // Update job display
        this.updateJobsDisplay();

        this.finishInteraction(true);
    },

    // Update active jobs display
    updateJobsDisplay() {
        const jobsList = document.getElementById('active-jobs');
        if (!jobsList) return;

        if (GameState.activeJobs.length === 0) {
            jobsList.innerHTML = '<div class="empty-state">No active jobs</div>';
            return;
        }

        jobsList.innerHTML = '';
        GameState.activeJobs.forEach(job => {
            const daysLeft = job.deadline - GameState.currentDay;
            let deadlineClass = 'safe';
            if (daysLeft <= 0) deadlineClass = 'danger';
            else if (daysLeft <= 1) deadlineClass = 'warning';

            const card = document.createElement('div');
            card.className = 'job-card';
            card.innerHTML = `
                <div class="job-card-header">
                    <span class="job-device">${job.device.fullName}</span>
                    <span class="job-deadline ${deadlineClass}">${job.deadlineDayName}</span>
                </div>
                <div class="job-customer">Customer: ${job.customer}</div>
                <div class="job-status">Status: ${job.status.toUpperCase()}</div>
            `;
            jobsList.appendChild(card);
        });
    },

    // Go to workbench (switch tab)
    goToWorkbench() {
        // Trigger tab switch
        document.querySelector('[data-tab="device-os"]')?.click();
    },

    // Close shop early
    closeShopEarly() {
        this.stopCustomerSpawning();
        TimeSystem.closeShopEarly();

        this.addText('', 'narrator');
        this.addText('[SYSTEM] Shop closed early.', 'system');
        this.addText('Evening free. Time for repairs, diving, or rest.', 'narrator');

        this.showClosedOptions();
    }
};

// Make sure time system is started
document.addEventListener('DOMContentLoaded', () => {
    TimeSystem.start();
});

// Initialize when DOM ready
document.addEventListener('DOMContentLoaded', () => {
    Shop.init();
    Shop.updateJobsDisplay();
});
