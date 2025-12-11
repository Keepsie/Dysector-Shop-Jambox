# DYSECTOR Shop Prototype

## What This Is
HTML/CSS/JS prototype for testing the shop management half of DYSECTOR before building in-engine. The game is a **shop management + FPS diving hybrid** - you run a repair shop by day, dive into corrupted devices to fix them by night.

## Project Structure
```
index.html              - Main app shell with 5 tabs
progress.md             - Session-by-session development log
css/
  main.css              - Base styles, header, tabs, variables
  shop.css              - Text adventure/dialogue styling
  shop-os.css           - Desktop OS interface (business PC)
  dive-os.css           - Avatar loadout/bits shop
  calendar.css          - Planning/scheduling grid
  probe.css             - Probe workbench minigames
js/
  gameState.js          - Core state, currencies, time, fatigue, problem types
  saveSystem.js         - LocalStorage persistence
  shop.js               - Customer interactions, day flow, daily summary
  shopOS.js             - Furniture, Wholesale, Liquidation, Licenses, Bills, Bank, Reviews, Hire, Null_Sector
  diveOS.js             - Avatar loadout, weapons, mods, license tests
  calendar.js           - Week view, job popups, dive/workbench routing
  probe.js              - 4 minigames (Memory, Launch, Pipes, Packet), job completion
  npcSystem.js          - NPC spawning, pathfinding, state machine
  furnitureSystem.js    - Furniture placement mode
  inventorySystem.js    - Item definitions, shelf stocking, license gating
  shopGenerator.js      - Procedural map generation
  dialogueSystem.js     - Customer dialogue trees
  serviceInterface.js   - Repair negotiation UI
  registerSystem.js     - POS/counter transactions
  main.js               - Tab switching, initialization
Dysector Guides/        - Design docs (HTML)
```

## Design Docs (in Dysector Guides/)
- `dysector_shop_identity_guide.html` - Shop mechanics, economy, staff
- `dysector_probe_identity_guide.html` - 2D probe mini-game system
- `dysector_world_foundation_guide.html` - Lore, SYNC, AVA, Null_Sector
- `dysector_combat_identity_guide.html` - FPS dive combat
- `dysector_cli_minigames_guide.html` - Minigame specifications

## Two Economies
- **Cash ($)** - earned from repairs/sales, spent at Shop OS (furniture, wholesale, pallets, bills, licenses)
- **Bits** - earned from diving/combat, spent at Dive OS (ammo, mods, weapons, license tests)

## License Progression
| License | Test (Bits @ Dive OS) | Purchase (Cash @ Shop OS) |
|---------|----------------------|--------------------------|
| E | Free | Free (starting) |
| C | 5,000 | $1,500 |
| B | 15,000 | $4,000 |
| A | 50,000 | $10,000 |

## Problem Types & Repair Methods
- **Dive Required**: Virus, Data Corruption, Crashes, Data Recovery
- **Workbench OK**: System Slowdown, System Cleanup

## Day Flow
1. **MORNING** (frozen time) - Prep at Dive OS, check calendar, pay bills
2. **OPEN** (7-8 min real time) - Customers spawn, negotiate jobs, clock runs 9AM-9PM
3. **CLOSED** (frozen time) - Dive into devices, workbench repairs (Probe minigames), sleep when done

## Key Systems
- **Time**: 32 real seconds = 1 game hour, pauses in menus/dialogue
- **Fatigue**: 0-100, builds with actions, collapse at 100 forces sleep
- **Reputation**: 0-5 stars, affects customer spawn rate, updated via daily summary
- **Dive Simulator**: 70% success rate, uses dive charges, awards bits by device grade
- **Probe Minigames**: 4 games for workbench repairs, difficulty scales with device grade
- **Customer Negotiation**: Urgency types (desperate/normal/flexible) affect pricing acceptance

## Tech Notes
- Vanilla HTML/CSS/JS, no framework
- Uses Google Fonts: Orbitron, Rajdhani, Share Tech Mono
- Dark cyberpunk aesthetic matching the design docs
- Cannot build/test in WSL environment

## Commands
Just open `index.html` in browser. No build step needed.
