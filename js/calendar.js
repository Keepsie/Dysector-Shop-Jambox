/* DYSECTOR Shop Prototype - Calendar Tab Logic */

const Calendar = {
    currentWeek: 1,
    selectedJob: null,

    init() {
        this.bindEvents();
        this.render();
    },

    bindEvents() {
        document.getElementById('cal-prev')?.addEventListener('click', () => {
            if (this.currentWeek > 1) {
                this.currentWeek--;
                this.render();
            }
        });

        document.getElementById('cal-next')?.addEventListener('click', () => {
            this.currentWeek++;
            this.render();
        });
    },

    render() {
        this.renderGrid();
        this.renderSidebar();
    },

    renderGrid() {
        const grid = document.querySelector('.calendar-grid');
        if (!grid) return;

        const startDay = (this.currentWeek - 1) * 7 + 1;
        const dayNames = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

        grid.innerHTML = '';

        for (let i = 0; i < 7; i++) {
            const dayNum = startDay + i;
            const isToday = dayNum === GameState.currentDay;
            const isWeekend = i >= 5;
            const isPast = dayNum < GameState.currentDay;

            const dayEl = document.createElement('div');
            dayEl.className = `cal-day ${isToday ? 'today' : ''} ${isWeekend ? 'weekend' : ''} ${isPast ? 'past' : ''}`;

            // Get jobs due this day (deadlines)
            const jobsThisDay = GameState.activeJobs.filter(j => j.deadline === dayNum);

            // Get bills due this day
            const billsThisDay = GameState.bills.filter(b => !b.paid && b.dueDay === dayNum);
            const totalCharges = billsThisDay.reduce((sum, b) => sum + b.amount, 0);

            // Build summary badges
            const jobCount = jobsThisDay.length;
            const billCount = billsThisDay.length;
            const hasIssue = jobCount >= 3 || (jobCount > 0 && billCount > 0);

            dayEl.innerHTML = `
                <div class="day-header">
                    <span class="day-name">${dayNames[i]}</span>
                    <span class="day-num">${dayNum}</span>
                </div>
                <div class="day-content">
                    ${isWeekend ? `
                        <div class="day-closed">CLOSED</div>
                    ` : `
                        <div class="day-summary ${hasIssue ? 'warning' : ''}">
                            ${jobCount > 0 ? `<span class="summary-jobs" title="${jobCount} job${jobCount > 1 ? 's' : ''} due">${jobCount}J</span>` : ''}
                            ${billCount > 0 ? `<span class="summary-bills" title="$${totalCharges} in bills">$${totalCharges}</span>` : ''}
                        </div>
                        <div class="day-jobs">
                            ${jobsThisDay.slice(0, 2).map(job => `
                                <div class="day-job deadline">
                                    <div class="day-job-name">${job.device?.fullName || 'Device'}</div>
                                </div>
                            `).join('')}
                            ${jobsThisDay.length > 2 ? `<div class="day-job-more">+${jobsThisDay.length - 2} more</div>` : ''}
                            ${billsThisDay.slice(0, 2).map(bill => `
                                <div class="day-bill">
                                    <div class="day-bill-name">${bill.name}</div>
                                    <div class="day-bill-amt">-$${bill.amount}</div>
                                </div>
                            `).join('')}
                            ${billsThisDay.length > 2 ? `<div class="day-bill-more">+${billsThisDay.length - 2} bills</div>` : ''}
                        </div>
                    `}
                </div>
            `;

            grid.appendChild(dayEl);
        }

        // Update week title
        document.querySelector('.cal-title').textContent = `WEEK ${this.currentWeek}`;
    },

    renderSidebar() {
        this.renderDeadlines();
        this.renderBills();
    },

    renderDeadlines() {
        const list = document.getElementById('deadline-list');
        if (!list) return;

        // Sort jobs by deadline
        const sortedJobs = [...GameState.activeJobs].sort((a, b) => a.deadline - b.deadline);

        if (sortedJobs.length === 0) {
            list.innerHTML = '<div class="empty-state">No pending deadlines</div>';
            return;
        }

        list.innerHTML = sortedJobs.map((job, index) => {
            const daysLeft = job.deadline - GameState.currentDay;
            let statusClass = 'safe';
            if (daysLeft <= 0) statusClass = 'danger';
            else if (daysLeft <= 1) statusClass = 'warning';

            const needsDive = job.problem?.needsDive && !job.device?.problems?.every(p => p.fixed);
            const isComplete = job.status === 'complete';

            return `
                <div class="deadline-item ${statusClass} ${isComplete ? 'complete' : ''}" data-job-index="${index}" style="cursor: pointer;">
                    <div class="deadline-device">${job.device?.fullName || 'Device'}</div>
                    <div class="deadline-customer">${job.customer}</div>
                    <div class="deadline-info">
                        <span class="deadline-due">${daysLeft <= 0 ? 'OVERDUE' : daysLeft === 1 ? 'Tomorrow' : `${daysLeft} days`}</span>
                        <span class="deadline-status ${isComplete ? 'complete' : needsDive ? 'needs-dive' : 'workbench'}">${isComplete ? 'READY' : needsDive ? 'NEEDS DIVE' : 'WORKBENCH'}</span>
                    </div>
                </div>
            `;
        }).join('');

        // Bind click events
        list.querySelectorAll('.deadline-item').forEach(item => {
            item.addEventListener('click', () => {
                const index = parseInt(item.dataset.jobIndex);
                const job = sortedJobs[index];
                if (job) {
                    this.showJobPopup(job);
                }
            });
        });
    },

    showJobPopup(job) {
        this.selectedJob = job;
        const needsDive = job.problem?.needsDive && !job.device?.problems?.every(p => p.fixed);
        const isComplete = job.status === 'complete';
        const daysLeft = job.deadline - GameState.currentDay;
        const diveCharges = GameState.divesRemaining || 0;

        const popupHtml = `
            <div style="background: var(--bg-dark); border: 2px solid var(--primary); padding: 20px; border-radius: 8px; max-width: 400px; margin: 20px auto; font-family: var(--font-mono);">
                <h2 style="color: var(--primary); margin: 0 0 15px 0; text-align: center;">JOB DETAILS</h2>

                <div style="margin-bottom: 15px; padding-bottom: 15px; border-bottom: 1px solid var(--border);">
                    <div style="color: var(--text); font-size: 16px; font-weight: bold;">${job.device?.fullName || 'Device'}</div>
                    <div style="color: var(--text-dim); font-size: 12px;">Owner: ${job.customer}</div>
                    <div style="color: var(--text-dim); font-size: 12px;">Problem: ${job.problem?.description || job.problemType || 'Unknown'}</div>
                    <div style="color: ${daysLeft <= 1 ? 'var(--red)' : 'var(--text-dim)'}; font-size: 12px;">
                        Deadline: Day ${job.deadline} (${daysLeft <= 0 ? 'OVERDUE!' : daysLeft === 1 ? 'Tomorrow!' : `${daysLeft} days left`})
                    </div>
                    <div style="color: var(--green); font-size: 14px; margin-top: 8px;">Payment: $${job.agreedPrice || job.repairPrice || 0}</div>
                </div>

                ${isComplete ? `
                    <div style="text-align: center; padding: 15px; background: rgba(46, 204, 113, 0.2); border-radius: 4px; margin-bottom: 15px;">
                        <div style="color: var(--green); font-size: 14px; font-weight: bold;">✓ REPAIR COMPLETE</div>
                        <div style="color: var(--text-dim); font-size: 11px;">Waiting for customer pickup</div>
                    </div>
                ` : `
                    <div style="margin-bottom: 15px;">
                        <div style="color: var(--text-dim); font-size: 11px; margin-bottom: 10px;">Choose how to repair:</div>

                        <button id="job-workbench-btn" style="width: 100%; padding: 12px; margin-bottom: 8px; background: var(--bg-light); border: 1px solid var(--border); color: var(--text); cursor: pointer; border-radius: 4px; text-align: left;">
                            <div style="font-weight: bold;">🔧 WORKBENCH (Probe)</div>
                            <div style="font-size: 11px; color: var(--text-dim);">Manual diagnostics - No charge cost</div>
                        </button>

                        <button id="job-dive-btn" style="width: 100%; padding: 12px; background: ${diveCharges > 0 ? 'var(--primary)' : 'var(--bg-light)'}; border: 1px solid ${diveCharges > 0 ? 'var(--primary)' : 'var(--border)'}; color: ${diveCharges > 0 ? 'var(--bg-dark)' : 'var(--text-dim)'}; cursor: ${diveCharges > 0 ? 'pointer' : 'not-allowed'}; border-radius: 4px; text-align: left;" ${diveCharges <= 0 ? 'disabled' : ''}>
                            <div style="font-weight: bold;">⚡ DIVE INTO DEVICE</div>
                            <div style="font-size: 11px;">70% success rate - Uses 1 dive charge (${diveCharges} left)</div>
                        </button>
                    </div>
                `}

                <button id="job-close-btn" style="width: 100%; padding: 10px; background: transparent; border: 1px solid var(--border); color: var(--text-dim); cursor: pointer; border-radius: 4px;">
                    CLOSE
                </button>
            </div>
        `;

        // Create overlay
        const overlay = document.createElement('div');
        overlay.id = 'job-popup-overlay';
        overlay.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 9999;';
        overlay.innerHTML = popupHtml;
        document.body.appendChild(overlay);

        // Bind buttons
        document.getElementById('job-close-btn').addEventListener('click', () => {
            overlay.remove();
            this.selectedJob = null;
        });

        if (!isComplete) {
            document.getElementById('job-workbench-btn').addEventListener('click', () => {
                overlay.remove();
                this.startWorkbench(job);
            });

            const diveBtn = document.getElementById('job-dive-btn');
            if (diveCharges > 0) {
                diveBtn.addEventListener('click', () => {
                    overlay.remove();
                    this.startDive(job);
                });
            }
        }
    },

    startWorkbench(job) {
        // TODO: Launch probe mini-game
        // For now, just show a placeholder
        alert('Workbench/Probe system coming soon!\n\nThis will be a 2D mini-game for manual repairs.');
    },

    startDive(job) {
        // Use a dive charge
        if (GameState.divesRemaining <= 0) {
            alert('No dive charges remaining!');
            return;
        }

        GameState.divesRemaining--;

        // 70% success chance
        const success = Math.random() < 0.7;
        const deviceGrade = job.device?.grade || 'e';

        // Calculate bits earned based on device grade
        const bitsByGrade = { 'e': 100, 'c': 250, 'b': 500, 'a': 1000 };
        const baseBits = bitsByGrade[deviceGrade] || 100;
        const bitsEarned = success ? Math.floor(baseBits * (0.8 + Math.random() * 0.4)) : Math.floor(baseBits * 0.2);

        // Award bits
        GameState.bits += bitsEarned;

        // Show dive summary
        this.showDiveSummary(job, success, bitsEarned, deviceGrade);
    },

    showDiveSummary(job, success, bitsEarned, grade) {
        const gradeColors = { 'e': 'var(--text-dim)', 'c': 'var(--green)', 'b': 'var(--blue)', 'a': 'var(--yellow)' };

        const summaryHtml = `
            <div style="background: var(--bg-dark); border: 2px solid ${success ? 'var(--green)' : 'var(--red)'}; padding: 20px; border-radius: 8px; max-width: 350px; margin: 20px auto; font-family: var(--font-mono);">
                <h2 style="color: ${success ? 'var(--green)' : 'var(--red)'}; margin: 0 0 15px 0; text-align: center;">
                    DIVE ${success ? 'SUCCESSFUL' : 'FAILED'}
                </h2>

                <div style="text-align: center; margin-bottom: 15px;">
                    <div style="font-size: 48px; margin-bottom: 10px;">${success ? '✓' : '✗'}</div>
                    <div style="color: var(--text-dim);">${job.device?.fullName || 'Device'}</div>
                    <div style="color: ${gradeColors[grade]}; font-size: 12px;">Grade ${grade.toUpperCase()}</div>
                </div>

                <div style="background: var(--bg-light); padding: 15px; border-radius: 4px; margin-bottom: 15px;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                        <span style="color: var(--text-dim);">Bits Earned:</span>
                        <span style="color: var(--cyan);">+${bitsEarned} bits</span>
                    </div>
                    <div style="display: flex; justify-content: space-between;">
                        <span style="color: var(--text-dim);">Dive Charges:</span>
                        <span style="color: var(--text);">${GameState.divesRemaining}/${GameState.divesMax}</span>
                    </div>
                </div>

                ${success ? `
                    <div style="color: var(--green); text-align: center; font-size: 12px; margin-bottom: 15px;">
                        Device repaired! Ready for customer pickup.
                    </div>
                ` : `
                    <div style="color: var(--red); text-align: center; font-size: 12px; margin-bottom: 15px;">
                        Dive failed. Device still needs repair.<br>Try again or use workbench.
                    </div>
                `}

                <button id="dive-continue-btn" style="width: 100%; padding: 10px; background: var(--primary); border: none; color: var(--bg-dark); font-weight: bold; cursor: pointer; border-radius: 4px;">
                    CONTINUE
                </button>
            </div>
        `;

        const overlay = document.createElement('div');
        overlay.id = 'dive-summary-overlay';
        overlay.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 9999;';
        overlay.innerHTML = summaryHtml;
        document.body.appendChild(overlay);

        // Update job status if successful
        if (success) {
            job.status = 'complete';
            if (job.device?.problems) {
                job.device.problems.forEach(p => p.fixed = true);
            }
        }

        document.getElementById('dive-continue-btn').addEventListener('click', () => {
            overlay.remove();
            this.render();  // Refresh calendar
            updateDisplays();  // Refresh header displays
        });
    },

    renderBills() {
        const container = document.querySelector('.bills-preview');
        if (!container) return;

        const unpaidBills = GameState.bills.filter(b => !b.paid);

        if (unpaidBills.length === 0) {
            container.innerHTML = '<div class="empty-state">All bills paid!</div>';
            return;
        }

        container.innerHTML = unpaidBills.map(bill => `
            <div class="bill-item">
                <span class="bill-name">${bill.name}</span>
                <span class="bill-due">Day ${bill.dueDay}</span>
                <span class="bill-amount">${formatMoney(bill.amount)}</span>
            </div>
        `).join('');
    },

    // Calculate capacity for a day (simplified)
    getDayCapacity(dayNum) {
        // Count jobs that span this day
        const jobsThisDay = GameState.activeJobs.filter(j => {
            return dayNum >= j.acceptedDay && dayNum <= j.deadline;
        });

        const divesNeeded = jobsThisDay.filter(j => j.problem.needsDive).length;
        const divesAvailable = GameState.divesMax;

        return {
            jobs: jobsThisDay.length,
            divesNeeded,
            divesAvailable,
            full: divesNeeded >= divesAvailable
        };
    }
};

// Initialize when DOM ready
document.addEventListener('DOMContentLoaded', () => {
    Calendar.init();
});
