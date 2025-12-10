# DYSECTOR Shop Prototype - Progress

## Current Version: v0.1

---

## Session 4 - Dec 10, 2024

### What We Built
- **Shelf/Display Table Stocking System**
  - 20 inventory items with costPrice + marketPrice
  - Backstock storage, shelves (3 slots, 10 per slot), display tables (single item, max 5)
  - Player sets prices with +10%/+20%/+30% quick buttons (based on market price)
  - Profit display shows margin vs cost

- **NPC Shelf/Table Browsing**
  - BUY intent NPCs browse shelves and display tables
  - Random price tolerance (5-35% over market) per customer
  - High markup = fewer sales, low markup = more volume

- **Service Pricing Overhaul (MAJOR)**
  - Player diagnoses device and sets repair price (not customer)
  - Market rate calculated from: problem type × device grade × needsDive
  - Customer reacts based on urgency (desperate pays 140-170%, flexible 90-110%)
  - Negotiation: MAKE QUOTE → accept/counter → ACCEPT/HOLD FIRM
  - **Half down payment** on job acceptance - enables buying supplies before completion

- **Canvas UI Buttons**
  - PAUSE button (green/red) - stops time and NPC movement
  - Q.STOCK button - quick fills all shelves/tables with random items/prices (testing)
  - Version number display (bottom left)

- **Calendar Improvements**
  - Shows job count (3J) and bill charges ($150) on each day
  - Warning pulse animation when jobs + bills overlap
  - Bills show with gold accent, jobs show with red accent

### What's Working
- Full sales loop: backstock → stock shelves → set prices → NPCs browse → check prices → buy or leave → POS register
- Full service loop: customer arrives → diagnose → quote price → negotiate → down payment → job scheduled
- Pause for real-life breaks
- Quick stock for rapid testing
- Calendar shows upcoming financial pressure at a glance

### Version History
- v0.1 - Initial prototype with full shop loop

---

## Session 3 - Dec 10, 2024

### What We Built
- **Dialogue JSON externalization** - 3 files with ~350 lines each, ~30 getter methods
- **Register mini-game** - Bills ($20/10/5/1) + coins (25¢/10¢/5¢/1¢), wrong change = rep hit
- **Service interface** - 14-day calendar for deadline selection
- **NPC intent system** - ? shows until they decide, then S or B reveals intent

### Bug Fixes
- SERVICE_WAIT/POS_WAIT tiles now walkable
- NPC stuck detection with emergency teleport
- Door spawn position fixed (y+1)
- Proper cleanup after serving customers

---

## Session 2 - Dec 10, 2024

### What We Built
- **SaveSystem** - localStorage persistence, version migration
- **ShopGenerator** - Seeded proc-gen layouts, dual counters
- **NPCSystem** - Intent-based routing, state machine, patience decay
- **ShopMap** - Canvas renderer with click handling

---

## Session 1 - Dec 10, 2024

### What We Built
- **Full tabbed interface** matching design doc aesthetic
  - SHOP - text adventure customer interactions
  - SHOP OS - business PC (supplier, licenses, bills, reviews, Null_Sector)
  - DIVE OS - avatar loadout, bits shop, weapons, mods, license tests
  - CALENDAR - week view with deadlines and bills
  - PROBE - placeholder for mini-games later

- **Complete day/time system**
  - Morning phase (frozen) → Open phase (clock runs ~7-8 min) → Closed phase (frozen)
  - Auto-close at 9PM
  - Based on Supermarket Simulator / TCG Card Shop Sim timing

- **Fatigue system**
  - Builds with actions (diving costs 25, failed dive 35, etc.)
  - Levels: Rested → Fine → Tired → Exhausted → Critical
  - Collapse at 100 forces sleep
  - Limits how much you can do after shop closes

- **Customer negotiation system**
  - Random customer generation with names, devices, problems
  - Urgency types affect behavior (desperate pays more, flexible wants discount)
  - Deadline negotiation (accept, counter, rush offer, decline)
  - Jobs tracked with deadlines on calendar

- **Simulated dive system**
  - Success chance based on device grade + health
  - Awards bits (20-80 + bonus), chance for software loot
  - Device health drops during dive
  - Failed dives = more fatigue, less rewards

### What's Working
- Full day loop: wake → morning prep → open shop → customers → close → dive → sleep → repeat
- Two economies (cash vs bits) separated correctly
- Time runs during open hours, customers spawn randomly
- Can negotiate with customers, take jobs, track deadlines
- Can dive into devices on workbench, get results
- Fatigue builds and limits actions

### Next Session - TODO
1. **Probe mini-games** - Star Fox 2D side-scroller for workbench (scan, clean, recover, defrag, bypass)
2. **Device selection for diving** - Currently auto-picks, should let player choose
3. **Workbench scanning** - Implement scan action at workbench (costs fatigue, reveals problems)
4. **Job completion flow** - Complete jobs when device fixed, get paid, reviews
5. **More customer variety** - Different customer types, repeat customers
6. **Weekend handling** - Shop closed Sat/Sun per design doc
7. **Staff system** - Hire workers with their own dive charges
8. **Software packaging** - Cases system for selling found software

### Design Questions to Test
- Is 7-8 min per day right? Too fast? Too slow?
- Does fatigue feel limiting or frustrating?
- Is customer spawn rate good?
- Does negotiation have enough depth?

### Notes
- Kept it vanilla JS - no framework needed for this scope
- Workbench repairs will use probe mini-games, not just dice rolls
- Real dive combat exists in Godot - this is just shop loop testing
