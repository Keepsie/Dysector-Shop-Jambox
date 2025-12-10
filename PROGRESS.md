# DYSECTOR Shop Prototype - Progress

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
