/* DYSECTOR Shop Prototype - Game State */

const GameState = {
    // Resources
    cash: 1500,
    bits: 0,  // Start with 0 - earn from diving/combat
    divesRemaining: 2,
    divesMax: 2,

    // Time
    currentDay: 1,
    currentDayName: 'MON',
    currentHour: 8,
    currentMinute: 0,
    shopOpen: false,
    businessHoursStart: 9,
    businessHoursEnd: 21, // 9PM closing

    // Time system
    timeRunning: false,
    timePaused: false, // For dialogue/menus
    gameSpeed: 1, // 1x, 2x, etc.
    realSecondsPerGameHour: 32, // ~7-8 min per full day (13 hours open)

    // Day phases
    dayPhase: 'morning', // morning, open, closed, diving

    // Fatigue system (0-100)
    fatigue: 0,
    fatigueMax: 100,
    fatigueCritical: 80, // Warnings start
    fatigueCollapse: 100, // Forced sleep

    // Stats
    customersToday: 0,
    totalRepairs: 0,
    reputation: 0, // out of 5 - start at 0, build it up!

    // Daily tracking (reset each day)
    dailyStats: {
        moneyEarned: 0,
        moneySpent: 0,
        itemsSold: 0,
        servicesCompleted: 0,
        customersServed: 0,
        goodTransactions: 0,  // Fair prices, on time
        badTransactions: 0,   // Overpriced, late, refused
    },

    // Licenses owned
    licenses: {
        e: true,  // Starting license
        c: false,
        b: false,
        a: false
    },

    // License tests passed (need to pass test before buying license)
    testsPassed: {
        c: false,
        b: false,
        a: false
    },

    // Inventory
    inventory: {
        devices: [],
        software: [],
        cases: 2,
        stims: 1,
        accessories: []
    },

    // Shop furniture inventory (owned but not placed)
    furnitureInventory: {
        shelf: 1,        // Start with 1 free shelf
        displayTable: 0,
        counter: 0,      // Extra counter sections
    },

    // Furniture prices
    furniturePrices: {
        shelf: 150,
        displayTable: 250,
    },

    // Active jobs (customer devices being repaired)
    activeJobs: [],

    // Devices on workbench
    workbenchSlots: [
        null,
        null,
        null
    ],

    // Bills
    bills: [
        { name: 'Rent', amount: 500, dueDay: 7, paid: false },
        { name: 'Utilities', amount: 100, dueDay: 7, paid: false }
    ],

    // Reviews
    reviews: [],

    // Customer queue (generated)
    customerQueue: [],

    // Current interaction state
    currentInteraction: null,

    // Day names
    dayNames: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']
};

// Device templates
const DeviceTypes = {
    laptop: {
        name: 'Laptop',
        models: ['Model A', 'Model B'],
        baseValue: { e: 200, c: 400, b: 700, a: 1200 },
        repairDifficulty: 'medium'
    },
    phone: {
        name: 'Phone',
        models: ['Model A', 'Model B'],
        baseValue: { e: 100, c: 250, b: 450, a: 800 },
        repairDifficulty: 'easy'
    },
    desktop: {
        name: 'Desktop',
        models: ['Model A', 'Model B'],
        baseValue: { e: 300, c: 550, b: 900, a: 1500 },
        repairDifficulty: 'hard'
    },
    tablet: {
        name: 'Tablet',
        models: ['Model A', 'Model B'],
        baseValue: { e: 150, c: 350, b: 600, a: 1000 },
        repairDifficulty: 'easy'
    },
    console: {
        name: 'Game Console',
        models: ['Model A', 'Model B'],
        baseValue: { e: 180, c: 380, b: 650, a: 1100 },
        repairDifficulty: 'medium'
    },
    tv: {
        name: 'Smart TV',
        models: ['Model A', 'Model B'],
        baseValue: { e: 250, c: 500, b: 850, a: 1400 },
        repairDifficulty: 'hard'
    }
};

// Customer name pools
const CustomerNames = {
    first: ['Alex', 'Jordan', 'Taylor', 'Morgan', 'Casey', 'Riley', 'Quinn', 'Avery', 'Parker', 'Blake', 'Sam', 'Jamie', 'Drew', 'Skyler', 'Reese'],
    last: ['Chen', 'Williams', 'Garcia', 'Kim', 'Patel', 'Johnson', 'Lee', 'Brown', 'Martinez', 'Anderson', 'Taylor', 'Thomas', 'Jackson', 'White', 'Harris']
};

// Problem types
const ProblemTypes = [
    // Dive required (serious issues)
    { id: 'virus', name: 'Virus Infection', severity: 'medium', needsDive: true, description: 'System infected with malware' },
    { id: 'corruption', name: 'Data Corruption', severity: 'hard', needsDive: true, description: 'Critical files corrupted' },
    { id: 'crash', name: 'Frequent Crashes', severity: 'medium', needsDive: true, description: 'System instability' },
    { id: 'recovery', name: 'Data Recovery', severity: 'hard', needsDive: true, description: 'Customer needs files recovered' },

    // Workbench repairs (common everyday issues)
    { id: 'slowdown', name: 'System Slowdown', severity: 'easy', needsDive: false, description: 'Performance degradation' },
    { id: 'cleanup', name: 'System Cleanup', severity: 'easy', needsDive: false, description: 'Junk and bloatware removal' },
    { id: 'dust', name: 'Overheating', severity: 'easy', needsDive: false, description: 'Needs cleaning and thermal paste' },
    { id: 'driver', name: 'Driver Issues', severity: 'easy', needsDive: false, description: 'Outdated or broken drivers' },
    { id: 'update', name: 'Failed Updates', severity: 'medium', needsDive: false, description: 'System updates stuck or broken' },
    { id: 'startup', name: 'Slow Boot', severity: 'easy', needsDive: false, description: 'Takes forever to start up' },
];

// Urgency types (affects customer patience)
const UrgencyTypes = [
    { id: 'desperate', name: 'Desperate', patience: 1, payMultiplier: 1.3, description: 'Will pay extra for rush' },
    { id: 'normal', name: 'Normal', patience: 3, payMultiplier: 1.0, description: 'Reasonable expectations' },
    { id: 'flexible', name: 'Flexible', patience: 5, payMultiplier: 0.9, description: 'No rush, wants discount' }
];

// Helper functions
function generateCustomerName() {
    const first = CustomerNames.first[Math.floor(Math.random() * CustomerNames.first.length)];
    const last = CustomerNames.last[Math.floor(Math.random() * CustomerNames.last.length)];
    return `${first} ${last}`;
}

function generateDevice(forceGrade = null) {
    const types = Object.keys(DeviceTypes);
    const type = types[Math.floor(Math.random() * types.length)];
    const deviceType = DeviceTypes[type];
    const model = deviceType.models[Math.floor(Math.random() * deviceType.models.length)];

    // Grade distribution (or forced)
    let grade;
    if (forceGrade) {
        grade = forceGrade;
    } else {
        const roll = Math.random();
        if (roll < 0.4) grade = 'e';
        else if (roll < 0.7) grade = 'c';
        else if (roll < 0.9) grade = 'b';
        else grade = 'a';
    }

    // Health (20-100%)
    const health = Math.floor(Math.random() * 60) + 40;

    return {
        id: Date.now() + Math.random(),
        type: type,
        typeName: deviceType.name,
        model: model,
        fullName: `${deviceType.name} ${model}`,
        grade: grade,
        health: health,
        maxHealth: 100,
        baseValue: deviceType.baseValue[grade],
        difficulty: deviceType.repairDifficulty,
        scanned: false,
        problems: [],
        owner: null // null = shop inventory, string = customer name
    };
}

function generateProblem(device) {
    // Filter problems by device difficulty
    let availableProblems = [...ProblemTypes];
    if (device.difficulty === 'easy') {
        availableProblems = availableProblems.filter(p => p.severity !== 'hard');
    }

    // Weight selection: 60% workbench, 40% dive (workbench issues are more common)
    const workbenchProblems = availableProblems.filter(p => !p.needsDive);
    const diveProblems = availableProblems.filter(p => p.needsDive);

    let problem;
    if (workbenchProblems.length > 0 && diveProblems.length > 0) {
        // Weighted selection
        if (Math.random() < 0.6) {
            // 60% chance workbench
            problem = workbenchProblems[Math.floor(Math.random() * workbenchProblems.length)];
        } else {
            // 40% chance dive
            problem = diveProblems[Math.floor(Math.random() * diveProblems.length)];
        }
    } else {
        // Fallback to any available
        problem = availableProblems[Math.floor(Math.random() * availableProblems.length)];
    }

    return { ...problem };
}

function generateCustomer() {
    const name = generateCustomerName();
    const urgency = UrgencyTypes[Math.floor(Math.random() * UrgencyTypes.length)];

    // Generate device with grade based on player's licenses
    let maxGrade = 'e';
    if (GameState.licenses.a) maxGrade = 'a';
    else if (GameState.licenses.b) maxGrade = 'b';
    else if (GameState.licenses.c) maxGrade = 'c';

    const grades = ['e'];
    if (maxGrade !== 'e') grades.push('c');
    if (maxGrade === 'b' || maxGrade === 'a') grades.push('b');
    if (maxGrade === 'a') grades.push('a');

    const grade = grades[Math.floor(Math.random() * grades.length)];
    const device = generateDevice(grade);
    device.owner = name;

    const problem = generateProblem(device);
    device.problems.push(problem);

    // Calculate repair price
    const basePrice = device.baseValue * 0.3; // 30% of device value
    const difficultyMultiplier = problem.severity === 'easy' ? 0.8 : problem.severity === 'hard' ? 1.3 : 1.0;
    const repairPrice = Math.round(basePrice * difficultyMultiplier * urgency.payMultiplier);

    // Desired deadline (in days from now)
    const desiredDeadline = Math.max(1, urgency.patience + Math.floor(Math.random() * 2) - 1);

    return {
        id: Date.now() + Math.random(),
        name: name,
        urgency: urgency,
        device: device,
        problem: problem,
        repairPrice: repairPrice,
        desiredDeadline: desiredDeadline,
        negotiatedDeadline: null,
        state: 'arriving' // arriving, negotiating, waiting, pickup, gone
    };
}

function formatTime(hour, minute) {
    const h = hour > 12 ? hour - 12 : (hour === 0 ? 12 : hour);
    const m = minute.toString().padStart(2, '0');
    const ampm = hour >= 12 ? 'PM' : 'AM';
    return `${h}:${m} ${ampm}`;
}

// ========================================
// TIME SYSTEM
// ========================================
const TimeSystem = {
    tickInterval: null,
    lastTick: 0,

    start() {
        if (this.tickInterval) return;
        this.lastTick = Date.now();
        this.tickInterval = setInterval(() => this.tick(), 100); // 10 ticks per second
    },

    stop() {
        if (this.tickInterval) {
            clearInterval(this.tickInterval);
            this.tickInterval = null;
        }
    },

    tick() {
        if (!GameState.timeRunning || GameState.timePaused) return;

        const now = Date.now();
        const elapsed = (now - this.lastTick) / 1000; // seconds
        this.lastTick = now;

        // Calculate game time advancement
        const gameMinutesPerRealSecond = 60 / GameState.realSecondsPerGameHour;
        const minutesToAdd = elapsed * gameMinutesPerRealSecond * GameState.gameSpeed;

        GameState.currentMinute += minutesToAdd;

        // Roll over minutes to hours
        while (GameState.currentMinute >= 60) {
            GameState.currentMinute -= 60;
            GameState.currentHour++;

            // Check for auto-close at business end
            if (GameState.shopOpen && GameState.currentHour >= GameState.businessHoursEnd) {
                this.autoCloseShop();
            }
        }

        updateDisplays();
    },

    autoCloseShop() {
        GameState.shopOpen = false;
        GameState.timeRunning = false;
        GameState.dayPhase = 'closed';

        if (typeof Shop !== 'undefined') {
            Shop.addText('[SYSTEM] 9:00 PM - Shop automatically closed.', 'system');
            Shop.addText('Evening free. Workbench repairs, diving, or sleep.', 'narrator');
            Shop.showClosedOptions();
        }
        updateDisplays();
    },

    openShop() {
        if (GameState.dayPhase !== 'morning') return;

        GameState.shopOpen = true;
        GameState.timeRunning = true;
        GameState.dayPhase = 'open';
        GameState.currentHour = GameState.businessHoursStart;
        GameState.currentMinute = 0;
        this.lastTick = Date.now();

        updateDisplays();
    },

    closeShopEarly() {
        GameState.shopOpen = false;
        GameState.timeRunning = false;
        GameState.dayPhase = 'closed';
        updateDisplays();
    },

    pauseTime() {
        GameState.timePaused = true;
    },

    resumeTime() {
        GameState.timePaused = false;
        this.lastTick = Date.now();
    }
};

// ========================================
// FATIGUE SYSTEM
// ========================================
const FatigueSystem = {
    // Fatigue costs for actions
    costs: {
        dive: 25,
        diveFailed: 35, // Failed dives are more tiring
        workbenchRepair: 10,
        workbenchScan: 5,
        customerServed: 2,
        hourOpen: 1, // Per game hour shop is open
    },

    add(amount, reason) {
        const oldFatigue = GameState.fatigue;
        GameState.fatigue = Math.min(GameState.fatigueMax, GameState.fatigue + amount);

        // Check thresholds
        if (GameState.fatigue >= GameState.fatigueCollapse) {
            this.collapse();
        } else if (GameState.fatigue >= GameState.fatigueCritical && oldFatigue < GameState.fatigueCritical) {
            this.warnFatigue();
        }

        updateDisplays();
    },

    reduce(amount) {
        GameState.fatigue = Math.max(0, GameState.fatigue - amount);
        updateDisplays();
    },

    reset() {
        GameState.fatigue = 0;
        updateDisplays();
    },

    warnFatigue() {
        if (typeof Shop !== 'undefined') {
            Shop.addText('[WARNING] You\'re exhausted. Consider sleeping soon.', 'alert');
        }
    },

    collapse() {
        if (typeof Shop !== 'undefined') {
            Shop.addText('[SYSTEM] You collapse from exhaustion...', 'error');
            Shop.addText('You wake up the next morning, groggy but rested.', 'narrator');
        }
        // Force next day
        this.sleep();
    },

    sleep() {
        advanceDay();
        this.reset();
    },

    canDive() {
        // Can dive if not too fatigued and have charges
        if (GameState.fatigue + this.costs.dive >= GameState.fatigueCollapse) {
            return { allowed: false, reason: 'Too exhausted to dive safely.' };
        }
        if (GameState.divesRemaining <= 0) {
            return { allowed: false, reason: 'No dive charges remaining.' };
        }
        if (GameState.shopOpen) {
            return { allowed: false, reason: 'Close shop before diving.' };
        }
        return { allowed: true };
    },

    getFatigueLevel() {
        const pct = GameState.fatigue / GameState.fatigueMax;
        if (pct < 0.3) return 'rested';
        if (pct < 0.5) return 'fine';
        if (pct < 0.7) return 'tired';
        if (pct < 0.85) return 'exhausted';
        return 'critical';
    }
};

function formatMoney(amount) {
    return `$${amount.toLocaleString()}`;
}

function canAfford(amount) {
    return GameState.cash >= amount;
}

function spendCash(amount) {
    if (canAfford(amount)) {
        GameState.cash -= amount;
        GameState.dailyStats.moneySpent += amount;
        updateDisplays();
        return true;
    }
    return false;
}

function earnCash(amount) {
    GameState.cash += amount;
    GameState.dailyStats.moneyEarned += amount;
    updateDisplays();
}

function spendBits(amount) {
    if (GameState.bits >= amount) {
        GameState.bits -= amount;
        updateDisplays();
        return true;
    }
    return false;
}

function earnBits(amount) {
    GameState.bits += amount;
    updateDisplays();
}

function useDive() {
    if (GameState.divesRemaining > 0) {
        GameState.divesRemaining--;
        updateDisplays();
        return true;
    }
    return false;
}

function advanceTime(minutes) {
    GameState.currentMinute += minutes;
    while (GameState.currentMinute >= 60) {
        GameState.currentMinute -= 60;
        GameState.currentHour++;
    }

    // Check if shop should close
    if (GameState.currentHour >= GameState.businessHoursEnd) {
        GameState.shopOpen = false;
    }

    updateDisplays();
}

function advanceDay() {
    GameState.currentDay++;
    GameState.currentDayName = GameState.dayNames[(GameState.currentDay - 1) % 7];
    GameState.currentHour = 8; // Wake up at 8 AM
    GameState.currentMinute = 0;
    GameState.divesRemaining = GameState.divesMax;
    GameState.customersToday = 0;
    GameState.shopOpen = false;
    GameState.timeRunning = false;
    GameState.dayPhase = 'morning';
    GameState.customerQueue = [];

    // Check for missed deadlines
    checkDeadlines();

    // Check for bills due
    checkBillsDue();

    updateDisplays();

    // Notify shop system
    if (typeof Shop !== 'undefined') {
        Shop.startNewDay();
    }
}

function checkBillsDue() {
    GameState.bills.forEach(bill => {
        if (!bill.paid && bill.dueDay === GameState.currentDay) {
            if (typeof Shop !== 'undefined') {
                Shop.addText(`[ALERT] ${bill.name} payment of ${formatMoney(bill.amount)} is due TODAY!`, 'error');
            }
        }
    });
}

// ========================================
// SIMULATED DIVE SYSTEM
// ========================================
const DiveSimulator = {
    // Dive difficulty based on device grade
    difficultyMods: {
        'e': 0.9,  // 90% success rate
        'c': 0.75,
        'b': 0.6,
        'a': 0.45
    },

    // Loot tables
    lootTables: {
        bits: { min: 20, max: 80 },
        bitsBonus: { min: 10, max: 40 }, // Extra for good performance
        software: ['antivirus', 'defrag_tool', 'firewall', 'decrypt_key', 'data_shard'],
        softwareChance: 0.3
    },

    // Simulate a dive into a device
    simulateDive(device, job = null) {
        const canDive = FatigueSystem.canDive();
        if (!canDive.allowed) {
            return { success: false, aborted: true, reason: canDive.reason };
        }

        // Use dive charge
        GameState.divesRemaining--;

        // Calculate success chance
        const baseDifficulty = this.difficultyMods[device.grade] || 0.7;
        const healthMod = device.health / 100; // Lower health = harder
        const successChance = baseDifficulty * (0.5 + healthMod * 0.5);

        const roll = Math.random();
        const success = roll < successChance;

        // Calculate time spent (affects fatigue feel)
        const diveMinutes = success ?
            Math.floor(Math.random() * 20) + 10 : // 10-30 min success
            Math.floor(Math.random() * 15) + 5;   // 5-20 min failure

        // Generate results
        const result = {
            success: success,
            aborted: false,
            device: device,
            job: job,
            diveMinutes: diveMinutes,
            bitsEarned: 0,
            lootFound: [],
            healthLost: 0,
            sectorsCleared: 0
        };

        if (success) {
            // Successful dive
            result.sectorsCleared = Math.floor(Math.random() * 3) + 1; // 1-3 sectors
            result.bitsEarned = this.lootTables.bits.min +
                Math.floor(Math.random() * (this.lootTables.bits.max - this.lootTables.bits.min));

            // Bonus bits for performance
            if (roll < successChance * 0.5) { // Did really well
                result.bitsEarned += this.lootTables.bitsBonus.min +
                    Math.floor(Math.random() * (this.lootTables.bitsBonus.max - this.lootTables.bitsBonus.min));
                result.excellent = true;
            }

            // Software loot chance
            if (Math.random() < this.lootTables.softwareChance) {
                const software = this.lootTables.software[
                    Math.floor(Math.random() * this.lootTables.software.length)
                ];
                result.lootFound.push(software);
            }

            // Small health loss from activity
            result.healthLost = Math.floor(Math.random() * 8) + 3; // 3-10%
            device.health = Math.max(1, device.health - result.healthLost);

            // Mark problems as fixed if this was a job
            if (job) {
                device.problems.forEach(p => p.fixed = true);
            }

            // Add fatigue
            FatigueSystem.add(FatigueSystem.costs.dive, 'dive');

            // Award bits
            earnBits(result.bitsEarned);

        } else {
            // Failed dive
            result.healthLost = Math.floor(Math.random() * 15) + 5; // 5-20%
            device.health = Math.max(1, device.health - result.healthLost);

            // Still get some bits for enemies killed
            result.bitsEarned = Math.floor(this.lootTables.bits.min * 0.3);
            earnBits(result.bitsEarned);

            // More fatigue for failed dive
            FatigueSystem.add(FatigueSystem.costs.diveFailed, 'failed dive');
        }

        return result;
    },

    // Format dive result for display
    formatResult(result) {
        if (result.aborted) {
            return `[DIVE ABORTED] ${result.reason}`;
        }

        let text = [];

        if (result.success) {
            text.push(`[DIVE COMPLETE] ${result.excellent ? 'EXCELLENT PERFORMANCE!' : 'Mission successful.'}`);
            text.push(`Sectors cleared: ${result.sectorsCleared}`);
            text.push(`Bits earned: +${result.bitsEarned}`);
            if (result.lootFound.length > 0) {
                text.push(`Software found: ${result.lootFound.join(', ')}`);
            }
            text.push(`Device health: ${result.device.health}% (-${result.healthLost}%)`);
        } else {
            text.push('[DIVE FAILED] Ejected from system.');
            text.push(`Bits salvaged: +${result.bitsEarned}`);
            text.push(`Device health: ${result.device.health}% (-${result.healthLost}%)`);
        }

        text.push(`Dive time: ~${result.diveMinutes} minutes`);
        text.push(`Fatigue: ${FatigueSystem.getFatigueLevel()}`);

        return text.join('\n');
    }
};

function checkDeadlines() {
    GameState.activeJobs.forEach(job => {
        if (job.deadline <= GameState.currentDay && job.status !== 'complete') {
            // Missed deadline!
            job.status = 'overdue';
            // Could add reputation penalty here
        }
    });
}

function updateDisplays() {
    // Update header displays
    const cashDisplay = document.getElementById('display-cash');
    const bitsDisplay = document.getElementById('display-bits');
    const divesDisplay = document.getElementById('display-dives');
    const dayDisplay = document.getElementById('display-day');
    const fatigueDisplay = document.getElementById('display-fatigue');

    if (cashDisplay) cashDisplay.textContent = formatMoney(GameState.cash);
    if (bitsDisplay) bitsDisplay.textContent = GameState.bits;
    if (divesDisplay) divesDisplay.textContent = `${GameState.divesRemaining}/${GameState.divesMax}`;
    if (dayDisplay) dayDisplay.textContent = `${GameState.currentDayName} ${GameState.currentDay}`;

    // Update fatigue display
    if (fatigueDisplay) {
        const level = FatigueSystem.getFatigueLevel();
        fatigueDisplay.textContent = level.toUpperCase();
        fatigueDisplay.className = `stat-value fatigue-${level}`;
    }

    // Update fatigue bar if exists
    const fatigueBar = document.getElementById('fatigue-bar');
    if (fatigueBar) {
        const pct = (GameState.fatigue / GameState.fatigueMax) * 100;
        fatigueBar.style.width = `${pct}%`;
    }

    // Update shop time
    const shopTime = document.getElementById('shop-time');
    const osTime = document.getElementById('os-time');
    const timeStr = formatTime(GameState.currentHour, Math.floor(GameState.currentMinute));
    if (shopTime) shopTime.textContent = timeStr;
    if (osTime) osTime.textContent = timeStr;

    // Update shop status
    const shopStatus = document.getElementById('shop-status');
    if (shopStatus) {
        const statusText = GameState.dayPhase === 'morning' ? 'PREP' :
                          GameState.shopOpen ? 'OPEN' : 'CLOSED';
        shopStatus.textContent = statusText;
        shopStatus.className = `status-value ${GameState.shopOpen ? 'open' : 'closed'}`;
    }

    // Update day phase indicator
    const phaseDisplay = document.getElementById('display-phase');
    if (phaseDisplay) {
        phaseDisplay.textContent = GameState.dayPhase.toUpperCase();
    }

    // Update customers today
    const customersToday = document.getElementById('customers-today');
    if (customersToday) customersToday.textContent = GameState.customersToday;

    // Update dive bits display on Dive OS tab
    const diveBits = document.getElementById('dive-bits');
    if (diveBits) diveBits.textContent = GameState.bits;
}

// Initialize displays on load
document.addEventListener('DOMContentLoaded', updateDisplays);
