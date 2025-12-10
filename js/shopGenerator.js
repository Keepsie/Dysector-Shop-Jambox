/* DYSECTOR Shop Prototype - Procedural Shop Generator */

const ShopGenerator = {
    // Tile types
    TILES: {
        VOID: 0,
        WALL: 1,
        FLOOR: 2,
        SERVICE_COUNTER: 3,  // For device repairs (blue)
        POS_COUNTER: 4,      // For buying items (purple)
        TABLE: 5,            // Display tables
        WORKBENCH: 6,        // Repair area (back room)
        DOOR: 7,             // Customer entrance (top)
        BACKFLOOR: 8,        // Employee only floor
        SHELF: 9,            // Display shelves
        SERVICE_WAIT: 10,    // Waiting area for service
        POS_WAIT: 11,        // Waiting area for POS
    },

    // Seeded random number generator
    seededRandom: null,

    initRandom(seed) {
        // Simple seeded PRNG (mulberry32)
        this.seededRandom = () => {
            let t = seed += 0x6D2B79F5;
            t = Math.imul(t ^ t >>> 15, t | 1);
            t ^= t + Math.imul(t ^ t >>> 7, t | 61);
            return ((t ^ t >>> 14) >>> 0) / 4294967296;
        };
    },

    random() {
        return this.seededRandom ? this.seededRandom() : Math.random();
    },

    randomInt(min, max) {
        return Math.floor(this.random() * (max - min + 1)) + min;
    },

    // Main generation function
    generate(seed, width = 20, height = 14) {
        this.initRandom(seed);

        const map = this.createEmptyMap(width, height);

        // Build structure
        this.buildWalls(map, width, height);
        this.buildFloor(map, width, height);
        this.buildDivider(map, width, height);
        this.buildDoor(map, width, height);

        // Place counters
        this.placeServiceCounter(map, width, height);
        this.placePOSCounter(map, width, height);

        // Place furniture
        this.placeDisplayTables(map, width, height);
        this.placeWorkbenches(map, width, height);
        this.placeShelves(map, width, height);

        return map;
    },

    createEmptyMap(width, height) {
        return Array(height).fill(null).map(() =>
            Array(width).fill(this.TILES.VOID)
        );
    },

    buildWalls(map, width, height) {
        // Outer walls
        for (let x = 0; x < width; x++) {
            map[0][x] = this.TILES.WALL;
            map[height - 1][x] = this.TILES.WALL;
        }
        for (let y = 0; y < height; y++) {
            map[y][0] = this.TILES.WALL;
            map[y][width - 1] = this.TILES.WALL;
        }
    },

    buildFloor(map, width, height) {
        // Divider at 60% from top - front room is TOP (customers), back room is BOTTOM (employee)
        const dividerY = Math.floor(height * 0.6);

        // Front room floor (TOP - customer area)
        for (let y = 1; y < dividerY; y++) {
            for (let x = 1; x < width - 1; x++) {
                map[y][x] = this.TILES.FLOOR;
            }
        }

        // Back room floor (BOTTOM - employee only, workbenches)
        for (let y = dividerY + 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                map[y][x] = this.TILES.BACKFLOOR;
            }
        }
    },

    buildDivider(map, width, height) {
        const dividerY = Math.floor(height * 0.6);

        // Divider wall
        for (let x = 1; x < width - 1; x++) {
            map[dividerY][x] = this.TILES.WALL;
        }

        // Gap in divider (random position, but centered-ish)
        const gapCenter = Math.floor(width / 2) + this.randomInt(-2, 2);
        map[dividerY][gapCenter] = this.TILES.FLOOR;
        map[dividerY][gapCenter + 1] = this.TILES.FLOOR;
    },

    buildDoor(map, width, height) {
        // Door at TOP - where customers enter
        const doorX = Math.floor(width / 2) + this.randomInt(-3, 3);
        map[0][doorX] = this.TILES.DOOR;
        map[0][doorX + 1] = this.TILES.DOOR;

        // Store door position for NPC spawning (just inside door)
        this.doorPosition = { x: doorX, y: 1 };
    },

    placeServiceCounter(map, width, height) {
        const dividerY = Math.floor(height * 0.6);
        const counterY = dividerY - 1;

        // Service counter (BLUE) on the left side - GUARANTEED 3 tiles minimum
        const counterStartX = 2;
        const counterLength = 3;  // Fixed length to guarantee placement

        for (let x = counterStartX; x < counterStartX + counterLength; x++) {
            map[counterY][x] = this.TILES.SERVICE_COUNTER;
        }

        // Place SERVICE waiting area in front of counter (towards door/top)
        const waitY = counterY - 1;
        if (waitY > 1) {
            for (let x = counterStartX; x < counterStartX + counterLength; x++) {
                if (map[waitY][x] === this.TILES.FLOOR) {
                    map[waitY][x] = this.TILES.SERVICE_WAIT;
                }
            }
        }

        this.serviceCounterPos = { x: counterStartX + 1, y: counterY + 1 };
    },

    placePOSCounter(map, width, height) {
        const dividerY = Math.floor(height * 0.6);
        const counterY = dividerY - 1;

        // POS counter (PURPLE) on the right side - GUARANTEED 3 tiles minimum
        const counterLength = 3;  // Fixed length to guarantee placement
        const counterStartX = width - 2 - counterLength;  // Start from right side

        for (let x = counterStartX; x < counterStartX + counterLength; x++) {
            map[counterY][x] = this.TILES.POS_COUNTER;
        }

        // Place POS waiting area in front of counter (towards door/top)
        const waitY = counterY - 1;
        if (waitY > 1) {
            for (let x = counterStartX; x < counterStartX + counterLength; x++) {
                if (map[waitY][x] === this.TILES.FLOOR) {
                    map[waitY][x] = this.TILES.POS_WAIT;
                }
            }
        }

        this.posCounterPos = { x: counterStartX + 1, y: counterY + 1 };
    },

    placeDisplayTables(map, width, height) {
        const dividerY = Math.floor(height * 0.6);

        // Random number of tables (2-4)
        const numTables = this.randomInt(2, 4);

        // Possible table positions (avoiding counters and door area)
        const positions = [];

        // Left side tables
        positions.push({ x: 2, y: 2 });
        positions.push({ x: 2, y: Math.floor(dividerY / 2) });

        // Right side tables
        positions.push({ x: width - 5, y: 2 });
        positions.push({ x: width - 5, y: Math.floor(dividerY / 2) });

        // Center tables (if room)
        if (width > 16) {
            positions.push({ x: Math.floor(width / 2) - 1, y: 2 });
        }

        // Shuffle and pick
        this.shuffle(positions);

        for (let i = 0; i < numTables && i < positions.length; i++) {
            const pos = positions[i];
            this.placeTable(map, pos.x, pos.y, width, height);
        }
    },

    placeTable(map, startX, startY, width, height) {
        // 2x2 table
        const tableWidth = 2;
        const tableHeight = 2;

        for (let y = startY; y < startY + tableHeight && y < height - 2; y++) {
            for (let x = startX; x < startX + tableWidth && x < width - 2; x++) {
                if (map[y][x] === this.TILES.FLOOR) {
                    map[y][x] = this.TILES.TABLE;
                }
            }
        }
    },

    placeWorkbenches(map, width, height) {
        const dividerY = Math.floor(height * 0.6);

        // 2 workbenches in back room
        // Left workbench
        const leftX = 2 + this.randomInt(0, 2);
        const benchY = dividerY + 2;

        for (let y = benchY; y < benchY + 2 && y < height - 1; y++) {
            for (let x = leftX; x < leftX + 2 && x < width / 2 - 1; x++) {
                if (map[y][x] === this.TILES.BACKFLOOR) {
                    map[y][x] = this.TILES.WORKBENCH;
                }
            }
        }

        // Right workbench
        const rightX = width - 4 - this.randomInt(0, 2);

        for (let y = benchY; y < benchY + 2 && y < height - 1; y++) {
            for (let x = rightX; x < rightX + 2 && x < width - 1; x++) {
                if (map[y][x] === this.TILES.BACKFLOOR) {
                    map[y][x] = this.TILES.WORKBENCH;
                }
            }
        }
    },

    placeShelves(map, width, height) {
        const dividerY = Math.floor(height * 0.6);
        const doorX = this.doorPosition?.x || Math.floor(width / 2);

        // Keep a clear path from door (y=1) to counters (dividerY-1)
        // Main aisle is around doorX +/- 2

        // Left wall shelves - against the wall, not blocking paths
        const leftShelfY = 3;  // Start lower to not block horizontal movement at y=2
        const leftShelfLength = this.randomInt(2, 3);
        for (let y = leftShelfY; y < leftShelfY + leftShelfLength && y < dividerY - 3; y++) {
            if (map[y][1] === this.TILES.FLOOR) {
                map[y][1] = this.TILES.SHELF;
            }
        }

        // Right wall shelves - against the wall
        const rightShelfY = 3 + this.randomInt(0, 2);
        const rightShelfLength = this.randomInt(2, 3);
        for (let y = rightShelfY; y < rightShelfY + rightShelfLength && y < dividerY - 3; y++) {
            if (map[y][width - 2] === this.TILES.FLOOR) {
                map[y][width - 2] = this.TILES.SHELF;
            }
        }

        // Maybe short shelf clusters on sides (not blocking center aisle)
        // Left side cluster
        if (this.random() > 0.5) {
            const clusterX = 3;  // Away from wall, but left of center
            const clusterY = 4 + this.randomInt(0, 2);
            if (clusterX < doorX - 3 && map[clusterY][clusterX] === this.TILES.FLOOR) {
                map[clusterY][clusterX] = this.TILES.SHELF;
            }
        }

        // Right side cluster
        if (this.random() > 0.5) {
            const clusterX = width - 4;  // Away from wall, but right of center
            const clusterY = 4 + this.randomInt(0, 2);
            if (clusterX > doorX + 3 && map[clusterY][clusterX] === this.TILES.FLOOR) {
                map[clusterY][clusterX] = this.TILES.SHELF;
            }
        }
    },

    shuffle(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(this.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    },

    // Get key positions for NPC pathfinding
    getKeyPositions(map, width, height) {
        const positions = {
            door: null,
            serviceCounter: [],
            posCounter: [],
            tables: [],
            workbenches: [],
            serviceWaitSpots: [],
            posWaitSpots: [],
        };

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const tile = map[y][x];
                switch (tile) {
                    case this.TILES.DOOR:
                        // Door spawn point is just INSIDE the door (y+1 for top door)
                        positions.door = { x, y: y + 1 };
                        break;
                    case this.TILES.SERVICE_COUNTER:
                        positions.serviceCounter.push({ x, y });
                        break;
                    case this.TILES.POS_COUNTER:
                        positions.posCounter.push({ x, y });
                        break;
                    case this.TILES.TABLE:
                        positions.tables.push({ x, y });
                        break;
                    case this.TILES.WORKBENCH:
                        positions.workbenches.push({ x, y });
                        break;
                    case this.TILES.SERVICE_WAIT:
                        positions.serviceWaitSpots.push({ x, y });
                        break;
                    case this.TILES.POS_WAIT:
                        positions.posWaitSpots.push({ x, y });
                        break;
                }
            }
        }

        // Find browse spots adjacent to tables
        positions.browseSpots = this.findAdjacentFloor(map, positions.tables, width, height);

        return positions;
    },

    findAdjacentFloor(map, tiles, width, height) {
        const spots = new Set();
        const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];

        for (const tile of tiles) {
            for (const [dx, dy] of dirs) {
                const nx = tile.x + dx;
                const ny = tile.y + dy;
                if (nx > 0 && nx < width - 1 && ny > 0 && ny < height - 1) {
                    if (map[ny][nx] === this.TILES.FLOOR || map[ny][nx] === this.TILES.BACKFLOOR) {
                        spots.add(`${nx},${ny}`);
                    }
                }
            }
        }

        return Array.from(spots).map(s => {
            const [x, y] = s.split(',').map(Number);
            return { x, y };
        });
    },
};
