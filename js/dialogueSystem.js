/* DYSECTOR Shop Prototype - Dialogue System */

const DialogueSystem = {
    data: {
        service: null,
        sales: null,
        outcomes: null
    },

    loaded: false,

    async init() {
        try {
            const [service, sales, outcomes] = await Promise.all([
                this.loadJSON('data/dialogue-service.json'),
                this.loadJSON('data/dialogue-sales.json'),
                this.loadJSON('data/dialogue-outcomes.json')
            ]);

            this.data.service = service;
            this.data.sales = sales;
            this.data.outcomes = outcomes;
            this.loaded = true;

            console.log('[DIALOGUE] All dialogue files loaded');
        } catch (e) {
            console.error('[DIALOGUE] Failed to load dialogue files:', e);
            // Fall back to basic dialogue
            this.loaded = false;
        }
    },

    async loadJSON(path) {
        const response = await fetch(path);
        if (!response.ok) throw new Error(`Failed to load ${path}`);
        return response.json();
    },

    // Get a random item from an array
    random(arr) {
        if (!arr || arr.length === 0) return null;
        return arr[Math.floor(Math.random() * arr.length)];
    },

    // Replace placeholders like {device} in text
    format(text, vars = {}) {
        if (!text) return '';
        let result = text;
        for (const [key, value] of Object.entries(vars)) {
            result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
        }
        return result;
    },

    // ========================================
    // SERVICE DIALOGUE
    // ========================================

    getPlayerGreeting() {
        if (!this.loaded) return "What can I help you with?";
        return this.random(this.data.service.greetings.player);
    },

    getCustomerEntering() {
        if (!this.loaded) return "A customer walks in.";
        return this.random(this.data.service.greetings.customer_entering);
    },

    getProblemDescription(problemType, deviceName) {
        if (!this.loaded) return `Something's wrong with my ${deviceName}.`;

        const problems = this.data.service.problems[problemType];
        if (!problems) return `My ${deviceName} has issues.`;

        const text = this.random(problems.descriptions);
        return this.format(text, { device: deviceName });
    },

    getUrgencyInitial(urgencyType) {
        if (!this.loaded) return "When can you have it done?";

        const urgency = this.data.service.urgency[urgencyType];
        if (!urgency) return "When can you have it done?";

        return this.random(urgency.initial);
    },

    getUrgencyAcceptCounter(urgencyType) {
        if (!this.loaded) return "Okay, I can wait.";

        const urgency = this.data.service.urgency[urgencyType];
        if (!urgency || !urgency.accept_counter) return "Fine, I'll wait.";

        return this.random(urgency.accept_counter);
    },

    getUrgencyRejectCounter(urgencyType) {
        if (!this.loaded) return "That's too long.";

        const urgency = this.data.service.urgency[urgencyType];
        if (!urgency || !urgency.reject_counter) return "That won't work for me.";

        return this.random(urgency.reject_counter);
    },

    getUrgencyAcceptRush(urgencyType) {
        if (!this.loaded) return "Done. Rush it.";

        const urgency = this.data.service.urgency[urgencyType];
        if (!urgency || !urgency.accept_rush) return "Fine, I'll pay for rush.";

        return this.random(urgency.accept_rush);
    },

    getUrgencyRejectRush(urgencyType) {
        if (!this.loaded) return "Too expensive.";

        const urgency = this.data.service.urgency[urgencyType];
        if (!urgency || !urgency.reject_rush) return "That's too much.";

        return this.random(urgency.reject_rush);
    },

    getJobConfirmed(urgencyType) {
        if (!this.loaded) return "Thanks. See you then.";

        const urgency = this.data.service.urgency[urgencyType];
        if (!urgency || !urgency.job_confirmed) return "Thanks. I'll be back.";

        return this.random(urgency.job_confirmed);
    },

    getDeclineReaction(isDesperate = false) {
        if (!this.loaded) return "Oh. Okay then.";

        if (isDesperate) {
            return this.random(this.data.service.decline_reaction_desperate);
        }
        return this.random(this.data.service.decline_reaction);
    },

    // ========================================
    // SALES DIALOGUE
    // ========================================

    getSalesGreetingCustomer() {
        if (!this.loaded) return "I'm looking to buy something.";
        return this.random(this.data.sales.greetings.customer);
    },

    getSalesGreetingPlayer() {
        if (!this.loaded) return "What can I get for you?";
        return this.random(this.data.sales.greetings.player);
    },

    getSaleRequest() {
        if (!this.loaded) {
            return {
                item: "USB Cable",
                price: 15,
                dialogue: "Just need a cable."
            };
        }

        // Pick a random category
        const categories = Object.keys(this.data.sales.requests);
        const category = this.random(categories);
        const categoryData = this.data.sales.requests[category];

        const item = this.random(categoryData.items);
        const dialogue = this.random(categoryData.dialogue);

        return {
            item: item.name,
            price: item.price,
            dialogue: dialogue,
            category: category
        };
    },

    getUpsellAccept() {
        if (!this.loaded) return "Okay, I'll take the upgrade.";
        return this.random(this.data.sales.upsell.accept);
    },

    getUpsellReject() {
        if (!this.loaded) return "No thanks, I'll stick with the original.";
        return this.random(this.data.sales.upsell.reject);
    },

    getSaleComplete() {
        if (!this.loaded) return "Thanks!";
        return this.random(this.data.sales.sale_complete);
    },

    getOutOfStockCustomer() {
        if (!this.loaded) return "Oh, you're out? Okay.";
        return this.random(this.data.sales.out_of_stock.customer);
    },

    getOutOfStockPlayer() {
        if (!this.loaded) return "Sorry, we're out of that.";
        return this.random(this.data.sales.out_of_stock.player);
    },

    // ========================================
    // OUTCOME DIALOGUE
    // ========================================

    getJobSuccessCustomer() {
        if (!this.loaded) return "It's working! Thanks!";
        return this.random(this.data.outcomes.job_complete.success.customer_pickup);
    },

    getJobSuccessPlayer(deviceName) {
        if (!this.loaded) return "All fixed up.";
        const text = this.random(this.data.outcomes.job_complete.success.player_deliver);
        return this.format(text, { device: deviceName });
    },

    getJobPartialCustomer() {
        if (!this.loaded) return "At least some of it works.";
        return this.random(this.data.outcomes.job_complete.partial_success.customer_reaction);
    },

    getJobPartialPlayer() {
        if (!this.loaded) return "Got most of it working.";
        return this.random(this.data.outcomes.job_complete.partial_success.player_explain);
    },

    getJobFailedCustomer() {
        if (!this.loaded) return "You can't fix it?!";
        return this.random(this.data.outcomes.job_failed.unfixable.customer_reaction);
    },

    getJobFailedPlayer() {
        if (!this.loaded) return "I'm sorry. It's beyond repair.";
        return this.random(this.data.outcomes.job_failed.unfixable.player_explain);
    },

    getJobMadeWorseCustomer() {
        if (!this.loaded) return "You made it worse?!";
        return this.random(this.data.outcomes.job_failed.made_worse.customer_reaction);
    },

    getJobMadeWorsePlayer() {
        if (!this.loaded) return "I'm so sorry.";
        return this.random(this.data.outcomes.job_failed.made_worse.player_apologize);
    },

    getJobOverdueAngry() {
        if (!this.loaded) return "Where is my device?!";
        return this.random(this.data.outcomes.job_overdue.customer_angry);
    },

    getJobOverdueUnderstanding() {
        if (!this.loaded) return "Running behind?";
        return this.random(this.data.outcomes.job_overdue.customer_understanding);
    },

    getJobOverdueApology() {
        if (!this.loaded) return "I'm sorry for the delay.";
        return this.random(this.data.outcomes.job_overdue.player_apologize);
    },

    getJobOverdueExcuse() {
        if (!this.loaded) return "It's taking longer than expected.";
        return this.random(this.data.outcomes.job_overdue.player_excuse);
    },

    // ========================================
    // RETURNING CUSTOMERS
    // ========================================

    getReturningPositive() {
        if (!this.loaded) return "Welcome back!";
        return this.random(this.data.outcomes.returning_customer.recognized_positive);
    },

    getReturningNegative() {
        if (!this.loaded) return "Back already?";
        return this.random(this.data.outcomes.returning_customer.recognized_negative);
    },

    getReturningExplanation() {
        if (!this.loaded) return "New problem.";
        return this.random(this.data.outcomes.returning_customer.customer_explains_return);
    },

    // ========================================
    // SMALL TALK
    // ========================================

    getSmallTalk() {
        if (!this.loaded) return "Busy day?";
        return this.random(this.data.outcomes.general_chitchat.small_talk);
    },

    getSmallTalkResponse() {
        if (!this.loaded) return "Just another day.";
        return this.random(this.data.outcomes.general_chitchat.player_responses);
    },

    getTimeGreeting() {
        if (!this.loaded) return "Hello!";

        const hour = GameState?.currentHour || 12;
        let timeOfDay = 'afternoon';

        if (hour < 12) timeOfDay = 'morning';
        else if (hour >= 18) timeOfDay = 'evening';

        return this.random(this.data.outcomes.time_of_day[timeOfDay]);
    },

    // ========================================
    // SPECIAL SCENARIO DIALOGUE
    // ========================================

    getSpecialScenarioDescription(scenarioType, deviceName) {
        if (!this.loaded) return `Something's wrong with my ${deviceName}.`;

        const scenario = this.data.service.special_scenarios[scenarioType];
        if (!scenario || !scenario.descriptions) return `My ${deviceName} has issues.`;

        const text = this.random(scenario.descriptions);
        return this.format(text, { device: deviceName });
    },

    getSpecialScenarioUrgency(scenarioType) {
        if (!this.loaded) return "This is really important to me.";

        const scenario = this.data.service.special_scenarios[scenarioType];
        if (!scenario || !scenario.urgency_lines) return "I need this fixed soon.";

        return this.random(scenario.urgency_lines);
    },

    // Check if should use special scenario (15% chance)
    shouldUseSpecialScenario() {
        return Math.random() < 0.15;
    },

    // Get random special scenario type
    getRandomSpecialScenario() {
        const scenarios = ['student_emergency', 'weird_technical', 'conspiracy_theorist', 'overly_dramatic', 'senile_confused'];
        return this.random(scenarios);
    }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    DialogueSystem.init();
});
