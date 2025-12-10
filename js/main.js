/* DYSECTOR Shop Prototype - Main Controller */

const Main = {
    currentTab: 'shop',

    init() {
        this.bindTabNavigation();
        this.showTab('shop');

        // Add a test device to workbench for demo
        this.addDemoData();
    },

    bindTabNavigation() {
        document.querySelectorAll('.main-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                if (tab.classList.contains('disabled')) return;

                const tabName = tab.dataset.tab;
                this.showTab(tabName);
            });
        });
    },

    showTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.main-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === tabName);
        });

        // Update tab panels
        document.querySelectorAll('.tab-panel').forEach(panel => {
            panel.classList.toggle('active', panel.id === tabName);
        });

        this.currentTab = tabName;

        // Refresh tab-specific content
        switch (tabName) {
            case 'calendar':
                Calendar.render();
                break;
            case 'dive-os':
                DiveOS.updateDisplays();
                break;
        }
    },

    addDemoData() {
        // Add a demo device to workbench slots
        const demoDevice = generateDevice('c');
        demoDevice.problems.push(generateProblem(demoDevice));
        GameState.workbenchSlots[1] = demoDevice;
    }
};

// Global keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // Number keys 1-5 for tab switching
    if (e.key >= '1' && e.key <= '5' && !e.ctrlKey && !e.altKey) {
        const tabs = ['shop', 'shop-os', 'dive-os', 'calendar', 'probe'];
        const index = parseInt(e.key) - 1;
        if (tabs[index] && tabs[index] !== 'probe') {
            Main.showTab(tabs[index]);
        }
    }
});

// Initialize when DOM ready
document.addEventListener('DOMContentLoaded', () => {
    Main.init();
    updateDisplays();
});
