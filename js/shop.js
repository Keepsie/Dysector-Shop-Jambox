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

        // Check if we should use a special scenario (15% chance)
        let problemDesc;
        let specialScenario = null;

        if (DialogueSystem.shouldUseSpecialScenario()) {
            specialScenario = DialogueSystem.getRandomSpecialScenario();
            // Override the problem description with special scenario dialogue
            problemDesc = DialogueSystem.getSpecialScenarioDescription(specialScenario, npc.data.device.typeName);

            // Store special scenario on npc data for later use
            npc.data.specialScenario = specialScenario;
        } else {
            problemDesc = DialogueSystem.getProblemDescription(npc.data.problem.id, npc.data.device.typeName);
        }

        const job = {
            device: npc.data.device.fullName,
            deviceGrade: npc.data.device.grade,
            problemType: npc.data.problem.name,
            problem: npc.data.problem,
            problemDesc: problemDesc,
            urgency: npc.data.urgency,
            specialScenario: specialScenario
        };

        // Start service interface on canvas
        this.addText('[Opening service terminal...]', 'system');

        ServiceInterface.startService(npc, job, (result) => this.handleServiceComplete(result));

        this.setOptions([
            { label: '[Use service terminal on map]', action: 'none', disabled: true }
        ]);
    },

    // Handle service interface completion
    handleServiceComplete(result) {
        this.interactionState = 'negotiating';

        if (result.accepted) {
            // Create the job
            const job = {
                id: Date.now(),
                customer: this.currentCustomer.name,
                device: this.currentCustomer.device,
                problem: this.currentCustomer.problem,
                deadline: result.deadline,
                price: result.price,
                downPayment: result.downPayment,
                remainingPayment: result.price - result.downPayment,
                status: 'pending'
            };

            GameState.activeJobs = GameState.activeJobs || [];
            GameState.activeJobs.push(job);

            // Add down payment to cash
            GameState.cash = (GameState.cash || 0) + result.downPayment;

            this.addText(`[JOB ACCEPTED] ${job.device.fullName} - Due Day ${result.deadline}`, 'success');
            this.addText(`[DOWN PAYMENT] +$${result.downPayment} (remaining: $${job.remainingPayment})`, 'success');

            updateDisplays();
            this.finishInteraction(true);
        } else {
            // Declined or rejected
            const reason = result.reason === 'price_rejected' ? '[Customer left - price too high]' : '[Job declined]';
            this.addText(reason, 'system');
            this.finishInteraction(false);
        }
    },

    // Called when player interacts with PICKUP customer
    triggerPickupDialogue(npc) {
        if (this.interactionState !== 'idle') return;

        const job = npc.pickupJob;
        if (!job) {
            this.addText('[ERROR] No job found for pickup.', 'error');
            this.finishInteraction(false);
            return;
        }

        this.currentNPC = npc;
        this.currentCustomer = npc.data;
        this.interactionState = 'pickup';

        const deviceName = job.device?.fullName || 'device';
        const remainingPayment = job.remainingPayment || 0;

        this.addText(`${job.customer} approaches the counter.`, 'narrator');
        this.addText(`"Hi, I'm here to pick up my ${job.device?.typeName || 'device'}."`, 'customer');

        if (remainingPayment > 0) {
            this.addText(`[PICKUP] ${deviceName} - Remaining balance: $${remainingPayment}`, 'system');
            this.addText(`"That'll be $${remainingPayment} for the remaining balance."`, 'player');
            this.addText(`"Sure thing!"`, 'customer');

            // Add remaining payment
            GameState.cash = (GameState.cash || 0) + remainingPayment;
            this.addText(`[+$${remainingPayment}]`, 'success');
        } else {
            this.addText(`[PICKUP] ${deviceName} - Fully paid`, 'system');
        }

        // Complete the job
        this.addText(`"Here's your ${job.device?.typeName || 'device'}, all fixed up!"`, 'player');

        // Pick a happy response
        const happyResponses = [
            "Thanks so much! You're a lifesaver!",
            "Awesome, it works perfectly now!",
            "Great service, I'll definitely be back!",
            "Wow, that was fast! Thanks!",
            "Perfect! You really know your stuff."
        ];
        const response = happyResponses[Math.floor(Math.random() * happyResponses.length)];
        this.addText(`"${response}"`, 'customer');

        // Remove job from active jobs, add to completed
        GameState.activeJobs = GameState.activeJobs.filter(j => j.id !== job.id);
        GameState.completedJobs = GameState.completedJobs || [];
        GameState.completedJobs.push({
            ...job,
            completedDay: GameState.currentDay,
            totalEarned: job.price
        });

        // Track stats
        GameState.stats = GameState.stats || {};
        GameState.stats.jobsCompleted = (GameState.stats.jobsCompleted || 0) + 1;
        GameState.stats.totalEarnings = (GameState.stats.totalEarnings || 0) + (remainingPayment || 0);

        // Small reputation boost for completed jobs
        GameState.reputation = Math.min(5, (GameState.reputation || 0) + 0.15);
        this.addText('[+0.15 Reputation]', 'success');

        this.addText(`[JOB COMPLETE] ${deviceName}`, 'success');

        updateDisplays();
        this.finishInteraction(true);
    },

    // Called when player interacts with BUY customer - go straight to register
    triggerSaleDialogue(npc) {
        if (this.interactionState !== 'idle') return;

        this.currentNPC = npc;
        this.interactionState = 'register';

        // Check if customer picked something from shelf or display table
        let itemName, price;
        if (npc.selectedItem) {
            // Customer picked from shelf or display table
            itemName = npc.selectedItem.name;
            price = npc.selectedItem.price;

            // Only remove from inventory if not already removed when they picked it up
            if (!npc.selectedItem.alreadyRemovedFromInventory) {
                if (npc.selectedItem.fromTable) {
                    InventorySystem.purchaseFromDisplayTable(npc.selectedItem.tableKey);
                } else {
                    InventorySystem.purchaseFromShelf(npc.selectedItem.shelfKey, npc.selectedItem.itemId);
                }
            }
            // Track stats for daily summary
            GameState.dailyStats = GameState.dailyStats || {};
            GameState.dailyStats.itemsSold = (GameState.dailyStats.itemsSold || 0) + 1;
        } else {
            // Fallback: generate random item (shouldn't happen with new flow)
            const wantsToBuy = DialogueSystem.getSaleRequest();
            itemName = wantsToBuy.item;
            price = wantsToBuy.price;
        }

        this.currentSale = { item: itemName, price: price };

        // Convert price to cents for register
        const priceInCents = price * 100;

        // Go straight to register - no dialogue needed
        RegisterSystem.startTransaction(
            itemName,
            priceInCents,
            (result) => this.handleRegisterComplete(result)
        );

        // Clear options while register is active
        this.setOptions([]);
    },

    // Handle register completion
    handleRegisterComplete(result) {
        this.interactionState = 'selling';

        if (result.correct) {
            // Correct change given
            this.addText('"Here\'s your change."', 'player');
            const thanks = DialogueSystem.getSaleComplete();
            this.addText(`"${thanks}"`, 'customer');
            this.addText(`[+${formatMoney(this.currentSale.price)}]`, 'success');

            GameState.cash += this.currentSale.price;
            GameState.stats = GameState.stats || {};
            GameState.stats.totalEarnings = (GameState.stats.totalEarnings || 0) + this.currentSale.price;

            updateDisplays();
            this.finishInteraction(true);
        } else {
            // Wrong change
            const diff = result.difference / 100;  // Convert back to dollars
            if (diff > 0) {
                // Gave too much change - customer's gain, your loss
                this.addText(`[OOPS] Gave ${formatMoney(Math.abs(diff))} too much in change!`, 'warning');
                this.addText('Customer happily pockets the extra. Your mistake, your loss.', 'narrator');

                // Still complete sale but lose the difference from your pocket
                const actualEarnings = this.currentSale.price - Math.abs(diff);
                GameState.cash += actualEarnings;

                // NO rep hit - customer got extra money, they're happy!
                // Just a financial mistake on your part
            } else {
                // Gave too little change - shortchanging the customer
                this.addText(`[ERROR] Shorted customer ${formatMoney(Math.abs(diff))}!`, 'error');
                this.addText('"Hey, this isn\'t right!" The customer is annoyed.', 'customer');

                // Still get the sale but rep hit for being dishonest/sloppy
                GameState.cash += this.currentSale.price;

                // Rep hit for shortchanging - customers don't like being cheated
                GameState.reputation = Math.max(0, (GameState.reputation || 0) - 0.3);
                this.addText('[-0.3 Reputation]', 'error');
            }

            GameState.stats = GameState.stats || {};
            GameState.stats.totalEarnings = (GameState.stats.totalEarnings || 0) + this.currentSale.price;

            updateDisplays();
            this.finishInteraction(true);
        }
    },

    // Serve NPC from chat button (not map click)
    serveNPCFromButton(npcId) {
        const npc = NPCSystem.npcs.find(n => n.id == npcId);
        if (!npc || npc.state !== NPCSystem.STATE.WAITING) return;

        // Mark as being served
        NPCSystem.serveNPC(npcId);

        // Trigger appropriate dialogue
        if (npc.intent === NPCSystem.INTENT.SERVICE) {
            this.triggerServiceDialogue(npc);
        } else if (npc.intent === NPCSystem.INTENT.BUY) {
            this.triggerSaleDialogue(npc);
        }
    },

    // Handle dismiss NPC
    dismissNPC() {
        if (this.currentNPC) {
            this.addText('"Sorry, can\'t help right now."', 'player');
            this.addText(`${this.currentNPC.data.name} leaves disappointed.`, 'narrator');
        }
        this.finishInteraction(false);
    },

    // Clear all remaining customers when closing up
    clearRemainingCustomers() {
        const waiting = [...NPCSystem.getWaitingAtService(), ...NPCSystem.getWaitingAtPOS()];

        if (waiting.length > 0) {
            this.addText('"Sorry folks, we\'re closed for the night."', 'player');
            this.addText(`${waiting.length} customer(s) leave disappointed.`, 'narrator');

            // Remove all waiting NPCs
            for (const npc of waiting) {
                NPCSystem.dismissNPC(npc.id);
            }
        }

        this.showClosedOptions();
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

        // Clear the map info panel and selection
        if (typeof ShopMap !== 'undefined') {
            ShopMap.selectedNPC = null;
            ShopMap.clearInfoPanel();
        }

        this.returnToIdle();
    },

    bindEvents() {
        // Bind option buttons via delegation
        if (this.optionsContainer) {
            this.optionsContainer.addEventListener('click', (e) => {
                const btn = e.target.closest('.option-btn');
                if (btn && !btn.classList.contains('disabled')) {
                    const action = btn.dataset.action;
                    const npcId = btn.dataset.npcId;
                    this.handleAction(action, npcId);
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
            if (opt.npcId) btn.dataset.npcId = opt.npcId;
            if (opt.disabled) btn.classList.add('disabled');
            btn.innerHTML = `[${index + 1}] ${opt.label}`;
            this.optionsContainer.appendChild(btn);
        });
    },

    // Handle action
    handleAction(action, npcId = null) {
        switch (action) {
            case 'wait':
                this.waitForCustomer();
                break;
            case 'serve_npc':
                this.serveNPCFromButton(npcId);
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
            case 'clear_remaining':
                this.clearRemainingCustomers();
                break;
            case 'complete_sale':
                this.completeSale();
                break;
            case 'start_register':
                this.startRegister();
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
            case 'place_furniture':
                // Open furniture shop in Shop OS
                document.querySelector('[data-tab="shop-os"]')?.click();
                setTimeout(() => {
                    if (typeof ShopOS !== 'undefined') {
                        ShopOS.openApp('furniture');
                    }
                }, 100);
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
            { label: 'Place furniture', action: 'place_furniture' },
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

        // Start idle refresh timer - updates serve buttons when NPCs arrive at counter
        this.startIdleRefresh();

        this.returnToIdle();
    },

    // Refresh idle options periodically to show new waiting customers
    startIdleRefresh() {
        if (this.idleRefreshTimer) clearInterval(this.idleRefreshTimer);

        this.idleRefreshTimer = setInterval(() => {
            // Only refresh if idle and shop is open
            if (this.interactionState === 'idle' && GameState.dayPhase === 'open') {
                this.returnToIdle();
            }
        }, 1000);  // Check every second
    },

    stopIdleRefresh() {
        if (this.idleRefreshTimer) {
            clearInterval(this.idleRefreshTimer);
            this.idleRefreshTimer = null;
        }
    },

    // Return to idle state (during open hours)
    returnToIdle() {
        this.interactionState = 'idle';
        this.currentCustomer = null;

        if (GameState.dayPhase === 'open') {
            const options = [];

            // Get waiting NPCs and show SERVE buttons for each
            const waitingService = NPCSystem.getWaitingAtService();
            const waitingPOS = NPCSystem.getWaitingAtPOS();

            if (waitingService.length > 0) {
                for (const npc of waitingService) {
                    options.push({
                        label: `Serve ${npc.data.name} (Repair)`,
                        action: 'serve_npc',
                        npcId: npc.id,
                        class: 'primary'
                    });
                }
            }

            if (waitingPOS.length > 0) {
                for (const npc of waitingPOS) {
                    options.push({
                        label: `Serve ${npc.data.name} (Sale)`,
                        action: 'serve_npc',
                        npcId: npc.id,
                        class: 'success'
                    });
                }
            }

            if (options.length === 0) {
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

        // First check if there are still customers waiting (shop just closed)
        const waitingService = NPCSystem.getWaitingAtService();
        const waitingPOS = NPCSystem.getWaitingAtPOS();

        if (waitingService.length > 0 || waitingPOS.length > 0) {
            this.addText('[Finishing up with remaining customers...]', 'system');

            for (const npc of waitingService) {
                options.push({
                    label: `Serve ${npc.data.name} (Repair)`,
                    action: 'serve_npc',
                    npcId: npc.id,
                    class: 'primary'
                });
            }

            for (const npc of waitingPOS) {
                options.push({
                    label: `Serve ${npc.data.name} (Sale)`,
                    action: 'serve_npc',
                    npcId: npc.id,
                    class: 'success'
                });
            }

            options.push({ label: 'Send them away (close up)', action: 'clear_remaining', class: 'danger' });
            this.setOptions(options);
            return;
        }

        // Shop-focused closed options
        options.push({ label: 'Shop PC (bills, furniture, orders)', action: 'go_shop_os' });
        options.push({ label: 'Place furniture', action: 'place_furniture' });

        // Sleep
        if (fatigueLevel === 'critical' || fatigueLevel === 'exhausted') {
            options.push({ label: 'Go to sleep (end day)', action: 'sleep', class: 'warning' });
        } else {
            options.push({ label: 'Go to sleep (end day)', action: 'sleep' });
        }

        this.setOptions(options);
    },

    goToSleep() {
        // Calculate daily summary and review changes
        const stats = GameState.dailyStats;
        const netProfit = stats.moneyEarned - stats.moneySpent;

        // Calculate review change based on transactions
        // Good transactions boost rep, bad ones hurt it
        let reviewChange = 0;
        if (stats.goodTransactions > 0 || stats.badTransactions > 0) {
            const totalTrans = stats.goodTransactions + stats.badTransactions;
            const goodRatio = stats.goodTransactions / totalTrans;
            // -0.5 to +0.5 based on ratio, scaled by transaction count
            reviewChange = (goodRatio - 0.5) * Math.min(totalTrans / 5, 1);
        }
        // Bonus for completing services
        if (stats.servicesCompleted > 0) {
            reviewChange += stats.servicesCompleted * 0.1;
        }
        // Small boost just for being open and selling stuff
        if (stats.itemsSold > 0) {
            reviewChange += 0.05;
        }

        // Apply review change (clamp 0-5)
        const oldRep = GameState.reputation;
        GameState.reputation = Math.max(0, Math.min(5, GameState.reputation + reviewChange));
        const newRep = GameState.reputation;

        // Show daily summary
        this.showDailySummary(stats, netProfit, oldRep, newRep);
    },

    showDailySummary(stats, netProfit, oldRep, newRep) {
        const repChange = newRep - oldRep;
        const repArrow = repChange > 0 ? '▲' : repChange < 0 ? '▼' : '–';
        const repColor = repChange > 0 ? 'var(--green)' : repChange < 0 ? 'var(--red)' : 'var(--text-dim)';

        const summaryHtml = `
            <div style="background: var(--bg-dark); border: 2px solid var(--primary); padding: 20px; border-radius: 8px; max-width: 350px; margin: 20px auto; font-family: var(--font-mono);">
                <h2 style="color: var(--primary); margin: 0 0 15px 0; text-align: center;">DAY ${GameState.currentDay} SUMMARY</h2>

                <div style="margin-bottom: 15px; padding-bottom: 15px; border-bottom: 1px solid var(--border);">
                    <div style="display: flex; justify-content: space-between; margin: 5px 0;">
                        <span style="color: var(--text-dim);">Money Earned:</span>
                        <span style="color: var(--green);">+$${stats.moneyEarned}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin: 5px 0;">
                        <span style="color: var(--text-dim);">Money Spent:</span>
                        <span style="color: var(--red);">-$${stats.moneySpent}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin: 5px 0; font-weight: bold;">
                        <span>Net Profit:</span>
                        <span style="color: ${netProfit >= 0 ? 'var(--green)' : 'var(--red)'};">${netProfit >= 0 ? '+' : ''}$${netProfit}</span>
                    </div>
                </div>

                <div style="margin-bottom: 15px; padding-bottom: 15px; border-bottom: 1px solid var(--border);">
                    <div style="display: flex; justify-content: space-between; margin: 5px 0;">
                        <span style="color: var(--text-dim);">Items Sold:</span>
                        <span>${stats.itemsSold}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin: 5px 0;">
                        <span style="color: var(--text-dim);">Services Completed:</span>
                        <span>${stats.servicesCompleted}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin: 5px 0;">
                        <span style="color: var(--text-dim);">Customers Served:</span>
                        <span>${stats.customersServed}</span>
                    </div>
                </div>

                <div style="text-align: center;">
                    <div style="color: var(--text-dim); margin-bottom: 5px;">SHOP RATING</div>
                    <div style="font-size: 24px;">
                        <span style="color: var(--yellow);">${'★'.repeat(Math.floor(newRep))}${'☆'.repeat(5 - Math.floor(newRep))}</span>
                    </div>
                    <div style="color: ${repColor}; font-size: 14px;">
                        ${repArrow} ${Math.abs(repChange).toFixed(2)} (${newRep.toFixed(2)}/5.00)
                    </div>
                </div>

                <button id="sleep-continue-btn" style="width: 100%; margin-top: 20px; padding: 10px; background: var(--primary); border: none; color: var(--bg-dark); font-weight: bold; cursor: pointer; border-radius: 4px;">
                    CONTINUE TO NEXT DAY
                </button>
            </div>
        `;

        // Create overlay
        const overlay = document.createElement('div');
        overlay.id = 'daily-summary-overlay';
        overlay.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 9999;';
        overlay.innerHTML = summaryHtml;
        document.body.appendChild(overlay);

        // Continue button
        document.getElementById('sleep-continue-btn').addEventListener('click', () => {
            overlay.remove();
            this.resetDailyStats();
            this.addText('', 'narrator');
            this.addText('You head to bed. Tomorrow is another day...', 'narrator');
            setTimeout(() => {
                FatigueSystem.sleep();
            }, 500);
        });
    },

    resetDailyStats() {
        GameState.dailyStats = {
            moneyEarned: 0,
            moneySpent: 0,
            itemsSold: 0,
            servicesCompleted: 0,
            customersServed: 0,
            goodTransactions: 0,
            badTransactions: 0,
        };
    },

    // ========================================
    // CUSTOMER SPAWNING - Now uses ShopMap
    // ========================================

    startCustomerSpawning() {
        // Check for customers periodically during open hours
        this.customerSpawnTimer = setInterval(() => {
            if (!GameState.shopOpen || GameState.timePaused) return;

            // Don't spawn if map is full (if it has customer management)
            if (typeof ShopMap !== 'undefined' && ShopMap.customers &&
                typeof ShopMap.maxCustomers !== 'undefined' &&
                ShopMap.customers.length >= ShopMap.maxCustomers) return;

            // Random chance of customer based on reputation
            // New shops (0 stars) still need customers to build reputation!
            const hourProgress = (GameState.currentHour - GameState.businessHoursStart) /
                                (GameState.businessHoursEnd - GameState.businessHoursStart);
            const reputation = GameState.reputation || 0;

            // Base 20% chance even with 0 reputation - new shops need foot traffic
            // Up to 45% with max reputation (5 stars)
            const baseChance = 0.20 + (reputation / 5) * 0.25;

            // Time modifiers: busier in morning and around lunch
            let timeModifier = 1.0;
            if (hourProgress < 0.3) {
                timeModifier = 1.3; // Morning rush
            } else if (hourProgress > 0.4 && hourProgress < 0.6) {
                timeModifier = 1.2; // Lunch rush
            } else if (hourProgress > 0.8) {
                timeModifier = 0.7; // Evening slowdown
            }

            if (Math.random() < baseChance * timeModifier) {
                this.spawnCustomerOnMap();
            }

            // Also check if any completed jobs need pickup
            this.checkForPickups();
        }, 2500); // Check every 2.5 real seconds
    },

    spawnCustomerOnMap() {
        // Use NPCSystem to spawn - it handles its own customer generation
        if (typeof NPCSystem !== 'undefined') {
            const npc = NPCSystem.trySpawn();
            if (npc) {
                this.addText('The door chimes. A customer walks in.', 'narrator');
            }
            // If trySpawn returns null (full or door blocked), no message
        }
    },

    // Check for completed jobs that need customer pickup
    checkForPickups() {
        if (typeof NPCSystem === 'undefined') return;

        // Find completed jobs that haven't been picked up yet
        const completedJobs = (GameState.activeJobs || []).filter(job =>
            job.status === 'complete' && !job.pickupSpawned
        );

        if (completedJobs.length === 0) return;

        // Random chance for a pickup customer to arrive (higher than regular)
        // The more completed jobs waiting, the higher the chance
        const pickupChance = 0.15 + (completedJobs.length * 0.1);

        if (Math.random() < pickupChance) {
            // Pick a random completed job
            const job = completedJobs[Math.floor(Math.random() * completedJobs.length)];

            // Try to spawn a pickup NPC
            const npc = NPCSystem.spawnPickupNPC(job);
            if (npc) {
                job.pickupSpawned = true;  // Mark so we don't spawn multiple
                this.addText(`The door chimes. ${job.customer} returns for their ${job.device?.typeName || 'device'}.`, 'narrator');
            }
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
        let urgencyLine;
        if (c.specialScenario) {
            // Use special scenario urgency dialogue
            urgencyLine = DialogueSystem.getSpecialScenarioUrgency(c.specialScenario);
        } else {
            urgencyLine = DialogueSystem.getUrgencyInitial(c.urgency.id);
        }
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
        this.stopIdleRefresh();
        TimeSystem.closeShopEarly();

        // Clear out NPCs that aren't at counter yet
        if (typeof NPCSystem !== 'undefined') {
            const toRemove = [];
            for (const npc of NPCSystem.npcs) {
                // Only keep NPCs that are waiting or being served
                if (npc.state !== NPCSystem.STATE.WAITING && npc.state !== NPCSystem.STATE.BEING_SERVED) {
                    toRemove.push(npc.id);
                }
            }
            // Remove them
            for (const id of toRemove) {
                NPCSystem.npcs = NPCSystem.npcs.filter(n => n.id !== id);
            }
        }

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
