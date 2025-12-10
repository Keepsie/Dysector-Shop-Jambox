/* DYSECTOR Shop Prototype - Service Interface System */

const ServiceInterface = {
    active: false,
    canvas: null,
    ctx: null,

    // Current service interaction
    currentNPC: null,
    currentJob: null,

    // UI state
    selectedDate: null,
    dialogueLines: [],
    choices: [],

    // Layout regions
    layout: {
        dialogue: { x: 0, y: 0, width: 0, height: 0 },
        calendar: { x: 0, y: 0, width: 0, height: 0 },
        choices: { x: 0, y: 0, width: 0, height: 0 },
        jobInfo: { x: 0, y: 0, width: 0, height: 0 },
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
        this.choices = [];
        this.selectedDate = null;
        this.hoveredDay = null;

        // Take over canvas
        if (typeof ShopMap !== 'undefined' && ShopMap.canvas) {
            this.canvas = ShopMap.canvas;
            this.ctx = ShopMap.ctx;
            this.calculateLayout();
        }

        // Build calendar days (current week + next week)
        this.buildCalendar();

        // Initial dialogue
        this.addDialogue('customer', `"${job.problemDesc}"`);
        this.addDialogue('system', `[${job.device} - ${job.problemType}]`);

        // Set initial choices
        this.setChoices([
            { label: 'Ask about urgency', action: 'ask_urgency' },
            { label: 'Accept job', action: 'accept_default', disabled: true },
            { label: 'Decline job', action: 'decline' }
        ]);

        console.log('[SERVICE] Started service for:', npc.data.name, job);
    },

    calculateLayout() {
        const w = this.canvas.width;
        const h = this.canvas.height;
        const midX = Math.floor(w * 0.55);  // 55% for dialogue, 45% for calendar

        this.layout = {
            dialogue: { x: 10, y: 10, width: midX - 20, height: h * 0.55 },
            choices: { x: 10, y: h * 0.58, width: midX - 20, height: h * 0.38 },
            jobInfo: { x: midX + 10, y: 10, width: w - midX - 20, height: 80 },
            calendar: { x: midX + 10, y: 100, width: w - midX - 20, height: h - 110 },
        };
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

            this.calendarDays.push({
                day: dayNum,
                label: isToday ? 'TODAY' : isTomorrow ? 'TOMORROW' : `Day ${dayNum}`,
                isToday: isToday,
                isTomorrow: isTomorrow,
                existingJobs: existingJobs,
                available: !isToday || currentHour < 18,  // Can't schedule same-day after 6pm
            });
        }
    },

    addDialogue(type, text) {
        this.dialogueLines.push({ type, text });
        // Keep last 8 lines
        if (this.dialogueLines.length > 8) {
            this.dialogueLines.shift();
        }
    },

    setChoices(choices) {
        this.choices = choices;
    },

    // Handle urgency question
    askUrgency() {
        const urgency = this.currentJob.urgency;
        let response = '';
        let deadlineHint = '';

        if (urgency.id === 'desperate') {
            response = DialogueSystem.getUrgencyInitial('desperate');
            deadlineHint = 'Needs it ASAP - today or tomorrow';
        } else if (urgency.id === 'normal') {
            response = DialogueSystem.getUrgencyInitial('normal');
            deadlineHint = 'Standard timeframe - 2-4 days';
        } else {
            response = DialogueSystem.getUrgencyInitial('flexible');
            deadlineHint = 'No rush - whenever you can';
        }

        this.addDialogue('customer', `"${response}"`);
        this.addDialogue('system', `[${deadlineHint}]`);

        // Now they can pick a date or accept/decline
        this.setChoices([
            { label: 'Pick deadline from calendar →', action: 'none', disabled: true },
            { label: 'Accept suggested deadline', action: 'accept_suggested' },
            { label: 'Decline job', action: 'decline' }
        ]);
    },

    // Accept with selected date
    acceptWithDate(day) {
        this.selectedDate = day;
        const urgency = this.currentJob.urgency;
        const daysOut = day.day - (GameState.currentDay || 1);

        // Check if this deadline works for them
        let accepted = false;
        let response = '';
        let priceMultiplier = 1.0;

        if (urgency.id === 'desperate') {
            if (daysOut <= 1) {
                accepted = true;
                response = DialogueSystem.getJobConfirmed('desperate');
                priceMultiplier = 1.5;  // Rush premium
            } else {
                response = DialogueSystem.getUrgencyRejectCounter('desperate');
                this.addDialogue('customer', `"${response}"`);
                this.addDialogue('system', '[They need it sooner!]');
                return;
            }
        } else if (urgency.id === 'normal') {
            if (daysOut <= 4) {
                accepted = true;
                response = DialogueSystem.getJobConfirmed('normal');
                priceMultiplier = daysOut <= 1 ? 1.2 : 1.0;
            } else {
                response = "That's a bit far out, but I guess it's fine...";
                accepted = true;
                priceMultiplier = 0.9;  // Discount for slow service
            }
        } else {  // flexible
            accepted = true;
            response = DialogueSystem.getJobConfirmed('flexible');
            priceMultiplier = daysOut <= 2 ? 1.1 : 1.0;
        }

        if (accepted) {
            this.addDialogue('customer', `"${response}"`);

            const finalPrice = Math.round(this.currentJob.estimatedPrice * priceMultiplier);
            this.addDialogue('system', `[Job accepted - Due: ${day.label} - Est. $${finalPrice}]`);

            // Complete after brief delay
            setTimeout(() => {
                this.complete({
                    accepted: true,
                    deadline: day.day,
                    price: finalPrice,
                    daysOut: daysOut
                });
            }, 1000);
        }
    },

    // Accept with suggested deadline based on urgency
    acceptSuggested() {
        const urgency = this.currentJob.urgency;
        let targetDay;

        if (urgency.id === 'desperate') {
            targetDay = this.calendarDays[1] || this.calendarDays[0];  // Tomorrow or today
        } else if (urgency.id === 'normal') {
            targetDay = this.calendarDays[3] || this.calendarDays[2];  // 3-4 days out
        } else {
            targetDay = this.calendarDays[6] || this.calendarDays[5];  // ~1 week
        }

        if (targetDay) {
            this.acceptWithDate(targetDay);
        }
    },

    // Decline job
    decline() {
        const isDesperate = this.currentJob.urgency.id === 'desperate';
        const response = DialogueSystem.getDeclineReaction(isDesperate);

        this.addDialogue('player', '"Sorry, can\'t take this one."');
        this.addDialogue('customer', `"${response}"`);

        setTimeout(() => {
            this.complete({
                accepted: false,
                reason: 'declined'
            });
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

        // Background
        ctx.fillStyle = '#0d0d1a';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // === DIALOGUE AREA (left top) ===
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(L.dialogue.x, L.dialogue.y, L.dialogue.width, L.dialogue.height);
        ctx.strokeStyle = '#3498db';
        ctx.lineWidth = 2;
        ctx.strokeRect(L.dialogue.x, L.dialogue.y, L.dialogue.width, L.dialogue.height);

        // Dialogue header
        ctx.fillStyle = '#3498db';
        ctx.font = 'bold 12px monospace';
        ctx.textAlign = 'left';
        ctx.fillText('SERVICE REQUEST', L.dialogue.x + 10, L.dialogue.y + 18);

        // Customer name
        if (this.currentNPC) {
            ctx.fillStyle = '#f1c40f';
            ctx.font = '11px monospace';
            ctx.fillText(this.currentNPC.data.name, L.dialogue.x + 140, L.dialogue.y + 18);
        }

        // Dialogue lines
        let lineY = L.dialogue.y + 40;
        ctx.font = '11px monospace';
        for (const line of this.dialogueLines) {
            if (line.type === 'customer') {
                ctx.fillStyle = '#f1c40f';
            } else if (line.type === 'player') {
                ctx.fillStyle = '#3498db';
            } else if (line.type === 'system') {
                ctx.fillStyle = '#888';
            } else {
                ctx.fillStyle = '#ccc';
            }

            // Word wrap
            const words = line.text.split(' ');
            let currentLine = '';
            const maxWidth = L.dialogue.width - 20;

            for (const word of words) {
                const testLine = currentLine + word + ' ';
                const metrics = ctx.measureText(testLine);
                if (metrics.width > maxWidth && currentLine !== '') {
                    ctx.fillText(currentLine.trim(), L.dialogue.x + 10, lineY);
                    currentLine = word + ' ';
                    lineY += 16;
                } else {
                    currentLine = testLine;
                }
            }
            ctx.fillText(currentLine.trim(), L.dialogue.x + 10, lineY);
            lineY += 20;
        }

        // === CHOICES AREA (left bottom) ===
        ctx.fillStyle = '#1e1e3e';
        ctx.fillRect(L.choices.x, L.choices.y, L.choices.width, L.choices.height);
        ctx.strokeStyle = '#2ecc71';
        ctx.lineWidth = 1;
        ctx.strokeRect(L.choices.x, L.choices.y, L.choices.width, L.choices.height);

        // Choices
        let choiceY = L.choices.y + 25;
        ctx.font = '12px monospace';
        this.choices.forEach((choice, i) => {
            choice._y = choiceY - 12;
            choice._height = 28;

            if (choice.disabled) {
                ctx.fillStyle = '#444';
            } else {
                ctx.fillStyle = '#2ecc71';
            }

            ctx.fillText(`${i + 1}. ${choice.label}`, L.choices.x + 10, choiceY);
            choiceY += 32;
        });

        // === JOB INFO (right top) ===
        ctx.fillStyle = '#1a2a1a';
        ctx.fillRect(L.jobInfo.x, L.jobInfo.y, L.jobInfo.width, L.jobInfo.height);
        ctx.strokeStyle = '#f39c12';
        ctx.lineWidth = 1;
        ctx.strokeRect(L.jobInfo.x, L.jobInfo.y, L.jobInfo.width, L.jobInfo.height);

        if (this.currentJob) {
            ctx.fillStyle = '#f39c12';
            ctx.font = 'bold 11px monospace';
            ctx.fillText('JOB DETAILS', L.jobInfo.x + 10, L.jobInfo.y + 18);

            ctx.fillStyle = '#ccc';
            ctx.font = '10px monospace';
            ctx.fillText(`Device: ${this.currentJob.device}`, L.jobInfo.x + 10, L.jobInfo.y + 36);
            ctx.fillText(`Problem: ${this.currentJob.problemType}`, L.jobInfo.x + 10, L.jobInfo.y + 50);
            ctx.fillText(`Est: $${this.currentJob.estimatedPrice}`, L.jobInfo.x + 10, L.jobInfo.y + 64);

            // Urgency indicator
            const urg = this.currentJob.urgency.id;
            ctx.fillStyle = urg === 'desperate' ? '#e74c3c' : urg === 'normal' ? '#f39c12' : '#2ecc71';
            ctx.fillText(`Urgency: ${urg.toUpperCase()}`, L.jobInfo.x + 120, L.jobInfo.y + 64);
        }

        // === CALENDAR (right bottom) ===
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(L.calendar.x, L.calendar.y, L.calendar.width, L.calendar.height);
        ctx.strokeStyle = '#9b59b6';
        ctx.lineWidth = 2;
        ctx.strokeRect(L.calendar.x, L.calendar.y, L.calendar.width, L.calendar.height);

        // Calendar header
        ctx.fillStyle = '#9b59b6';
        ctx.font = 'bold 11px monospace';
        ctx.fillText('SELECT DEADLINE', L.calendar.x + 10, L.calendar.y + 18);

        // Calendar grid (2 columns x 7 rows)
        const cellWidth = (L.calendar.width - 20) / 2;
        const cellHeight = 28;
        const startX = L.calendar.x + 10;
        const startY = L.calendar.y + 30;

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
            if (this.selectedDate === day) {
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

            // Cell border
            ctx.strokeStyle = day.isToday ? '#2ecc71' : day.isTomorrow ? '#f39c12' : '#444';
            ctx.lineWidth = 1;
            ctx.strokeRect(cellX, cellY, cellWidth - 4, cellHeight - 4);

            // Day label
            ctx.fillStyle = day.available ? '#fff' : '#555';
            ctx.font = '10px monospace';
            ctx.textAlign = 'left';
            ctx.fillText(day.label, cellX + 5, cellY + 12);

            // Job count indicator
            if (day.existingJobs > 0) {
                ctx.fillStyle = '#e74c3c';
                ctx.font = '9px monospace';
                ctx.fillText(`(${day.existingJobs} job${day.existingJobs > 1 ? 's' : ''})`, cellX + 5, cellY + 22);
            }
        });

        // Instructions
        ctx.fillStyle = '#666';
        ctx.font = '9px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('Click a day to set deadline', L.calendar.x + L.calendar.width / 2, L.calendar.y + L.calendar.height - 8);
    },

    // Handle click
    handleClick(x, y) {
        if (!this.active) return false;

        const L = this.layout;

        // Check calendar days
        for (const day of this.calendarDays) {
            if (day.available && day._x !== undefined) {
                if (x >= day._x && x <= day._x + day._width &&
                    y >= day._y && y <= day._y + day._height) {
                    this.acceptWithDate(day);
                    return true;
                }
            }
        }

        // Check choices
        for (let i = 0; i < this.choices.length; i++) {
            const choice = this.choices[i];
            if (choice.disabled) continue;

            if (x >= L.choices.x && x <= L.choices.x + L.choices.width &&
                y >= choice._y && y <= choice._y + choice._height) {
                this.handleChoice(choice.action);
                return true;
            }
        }

        return false;
    },

    // Handle mouse move for hover effects
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

    // Handle choice selection
    handleChoice(action) {
        switch (action) {
            case 'ask_urgency':
                this.askUrgency();
                break;
            case 'accept_suggested':
                this.acceptSuggested();
                break;
            case 'decline':
                this.decline();
                break;
        }
    },
};
