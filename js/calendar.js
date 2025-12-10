/* DYSECTOR Shop Prototype - Calendar Tab Logic */

const Calendar = {
    currentWeek: 1,

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

            // Get jobs for this day
            const jobsThisDay = GameState.activeJobs.filter(j => j.deadline === dayNum);
            const workThisDay = GameState.activeJobs.filter(j => {
                // Estimate work days (simplified)
                const workStart = j.acceptedDay;
                const workEnd = j.deadline;
                return dayNum >= workStart && dayNum <= workEnd;
            });

            dayEl.innerHTML = `
                <div class="day-header">
                    <span class="day-name">${dayNames[i]}</span>
                    <span class="day-num">${dayNum}</span>
                </div>
                <div class="day-content">
                    ${isWeekend ? `
                        <div class="day-closed">CLOSED</div>
                    ` : `
                        <div class="day-dives">
                            <span class="dive-icon">D</span>
                            <span class="dive-count">${isToday ? `${GameState.divesRemaining}/${GameState.divesMax}` : `${GameState.divesMax}/${GameState.divesMax}`}</span>
                        </div>
                        <div class="day-jobs">
                            ${jobsThisDay.map(job => `
                                <div class="day-job deadline">
                                    <div class="day-job-name">${job.device.fullName}</div>
                                    <div class="day-job-customer">DEADLINE - ${job.customer}</div>
                                </div>
                            `).join('')}
                            ${workThisDay.filter(j => j.deadline !== dayNum).map(job => `
                                <div class="day-job">
                                    <div class="day-job-name">${job.device.fullName}</div>
                                    <div class="day-job-customer">${job.customer}</div>
                                </div>
                            `).join('')}
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

        list.innerHTML = sortedJobs.map(job => {
            const daysLeft = job.deadline - GameState.currentDay;
            let statusClass = 'safe';
            if (daysLeft <= 0) statusClass = 'danger';
            else if (daysLeft <= 1) statusClass = 'warning';

            const needsDive = job.problem.needsDive && !job.device.problems.every(p => p.fixed);

            return `
                <div class="deadline-item ${statusClass}">
                    <div class="deadline-device">${job.device.fullName}</div>
                    <div class="deadline-customer">${job.customer}</div>
                    <div class="deadline-info">
                        <span class="deadline-due">${daysLeft <= 0 ? 'OVERDUE' : daysLeft === 1 ? 'Tomorrow' : `${daysLeft} days`}</span>
                        <span class="deadline-status ${needsDive ? 'needs-dive' : 'workbench'}">${needsDive ? 'NEEDS DIVE' : 'WORKBENCH'}</span>
                    </div>
                </div>
            `;
        }).join('');
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
