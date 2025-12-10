# DYSECTOR Shop Prototype

## What This Is
HTML/CSS/JS prototype for testing the shop management half of DYSECTOR before building in-engine. The game is a **shop management + FPS diving hybrid** - you run a repair shop by day, dive into corrupted devices to fix them by night.

## Project Structure
```
index.html          - Main app shell with 5 tabs
css/
  main.css          - Base styles, header, tabs, variables
  shop.css          - Text adventure/dialogue styling
  shop-os.css       - Desktop OS interface (business PC)
  dive-os.css       - Avatar loadout/bits shop
  calendar.css      - Planning/scheduling grid
js/
  gameState.js      - All game data, currencies, time system, fatigue, dive simulator
  shop.js           - Customer interactions, negotiation, day flow
  shopOS.js         - Supplier, licenses, bills, Null_Sector
  diveOS.js         - Avatar loadout, weapons, mods, consumables
  calendar.js       - Week view, deadlines, bills overview
  main.js           - Tab switching, initialization
```

## Design Docs (HTML guides in root)
- `dysector_shop_identity_guide.html` - Shop mechanics, economy, staff
- `dysector_probe_identity_guide.html` - 2D probe mini-game system
- `dysector_world_foundation_guide.html` - Lore, SYNC, AVA, Null_Sector
- `dysector_combat_identity_guide.html` - FPS dive combat

## Two Economies
- **Cash ($)** - earned from repairs, spent at Shop OS (pallets, cases, bills, licenses)
- **Bits** - earned from combat/diving, spent at Dive OS (ammo, mods, weapons, license tests)

## Day Flow
1. **MORNING** (frozen time) - Prep at Dive OS, check calendar, pay bills
2. **OPEN** (7-8 min real time) - Customers spawn, negotiate jobs, clock runs 9AM-9PM
3. **CLOSED** (frozen time) - Dive into devices, workbench repairs, sleep when done

## Key Systems
- **Time**: 32 real seconds = 1 game hour, pauses in menus/dialogue
- **Fatigue**: 0-100, builds with actions, collapse at 100 forces sleep
- **Dive Simulator**: Random success based on device grade/health, awards bits + loot
- **Customer Negotiation**: Urgency types (desperate/normal/flexible) affect deadlines and pricing

## Tech Notes
- Vanilla HTML/CSS/JS, no framework
- Uses Google Fonts: Orbitron, Rajdhani, Share Tech Mono
- Dark cyberpunk aesthetic matching the design docs
- Cannot build/test in WSL environment

## Commands
Just open `index.html` in browser. No build step needed.
