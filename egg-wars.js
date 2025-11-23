// Game Constants
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const PLAYER_SIZE = 30;
let PLAYER_SPEED = 5;
const GENERATOR_RADIUS = 40;
const EGG_SIZE = 40;
const FRICTION = 0.92; // Realistic friction
const ACCELERATION = 0.5; // Smooth acceleration

// Teams Configuration (4 Players)
const TEAMS_CONFIG = [
    { name: 'blue', color: '#3498db', x: 100, y: 100, eggX: 60, eggY: 60 },
    { name: 'red', color: '#e74c3c', x: 700, y: 100, eggX: 740, eggY: 60 },
    { name: 'green', color: '#2ecc71', x: 100, y: 500, eggX: 60, eggY: 540 },
    { name: 'yellow', color: '#f1c40f', x: 700, y: 500, eggX: 740, eggY: 540 }
];

// Mobile Detection
const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

// Sound System (auto-disabled on mobile for performance)
let soundEnabled = !isMobileDevice;
const sounds = {
    attack: { freq: 200, duration: 100 },
    eggHit: { freq: 300, duration: 150 },
    eggBreak: { freq: 100, duration: 300 },
    collect: { freq: 500, duration: 80 },
    powerup: { freq: 600, duration: 200 }
};

// Game State
let canvas, ctx;
let gameId, myId;
let myTeamIndex = -1;
let gameActive = false;
let playersList = [];

// Resources
let resources = {
    iron: 0,
    gold: 0,
    diamond: 0
};

// Me
let me = {
    x: 0, y: 0,
    vx: 0, vy: 0, // Velocity for physics
    color: '#fff',
    health: 100, maxHealth: 100,
    damage: 10,
    team: '',
    isAttacking: false,
    avatar: '👮',
    footsteps: [] // Track footsteps
};

// Opponents (Map: id -> object)
let opponents = {};

// Environment effects (reduced on mobile)
let rainDrops = [];
let dustParticles = [];
let weatherEnabled = !isMobileDevice; // Auto-disabled on mobile for better performance

// Map Objects
const generators = [
    { x: 400, y: 300, type: 'diamond', color: '#3498db', lastGen: 0 },
    { x: 400, y: 100, type: 'gold', color: '#f1c40f', lastGen: 0 },
    { x: 400, y: 500, type: 'gold', color: '#f1c40f', lastGen: 0 },
    { x: 200, y: 300, type: 'iron', color: '#bdc3c7', lastGen: 0 },
    { x: 600, y: 300, type: 'iron', color: '#bdc3c7', lastGen: 0 }
];

// Eggs State
let eggs = {}; 

// Input
const keys = {};

// Firebase Refs
let gameRef, myRef;

// Initialization
window.onload = function() {
    const urlParams = new URLSearchParams(window.location.search);
    gameId = urlParams.get('game');
    const opponentId = urlParams.get('op');
    
    const user = JSON.parse(localStorage.getItem("user"));
    if (!user) window.location.href = "login.html";
    myId = user.id;

    if (!gameId) {
        alert("No game ID provided");
        window.location.href = "rooms.html";
        return;
    }

    initGame(opponentId);
};

function initGame(opponentId) {
    canvas = document.getElementById('game-canvas');
    ctx = canvas.getContext('2d');
    
    // Optimize canvas for mobile
    if (isMobileDevice) {
        // Use lower resolution for better performance
        canvas.width = 600;  // Instead of 800
        canvas.height = 450; // Instead of 600
        // Adjust constants
        CANVAS_WIDTH = 600;
        CANVAS_HEIGHT = 450;
    }
    
    // Show mobile mode indicator
    if (isMobileDevice) {
        const mobileIndicator = document.getElementById('mobile-mode-indicator');
        if (mobileIndicator) mobileIndicator.style.display = 'block';
        
        const weatherHint = document.getElementById('weather-toggle-hint');
        if (weatherHint) weatherHint.style.display = 'none';
        
        // Start with minimized resource bar on mobile
        const resourceBar = document.querySelector('.resource-bar');
        if (resourceBar) resourceBar.classList.add('minimized');
        
        console.log('📱 Mobile Optimization: ON');
        console.log('⚡ Canvas: 600x450 (reduced from 800x600)');
        console.log('⚡ Reduced Effects: Shadows, Glow, Weather, Sounds');
    }

    // Input Listeners
    window.addEventListener('keydown', e => {
        keys[e.code] = true;
        keys[e.key] = true;
        if (e.key === 'b' || e.key === 'B') toggleShop();
        if (e.key === ' ') attack();
        
        // Toggle weather with 'E' (only on desktop)
        if (!isMobileDevice && (e.key === 'e' || e.key === 'E')) {
            weatherEnabled = !weatherEnabled;
            showNotification(weatherEnabled ? '🌧️ Weather ON' : '☀️ Weather OFF', '#3498db');
        }
    });
    window.addEventListener('keyup', e => {
        keys[e.code] = false;
        keys[e.key] = false;
    });

    // Firebase Setup
    gameRef = firebase.database().ref(`rooms/${gameId}`);

    // 1. Fetch Room Data
    gameRef.once('value').then(snapshot => {
        let room = snapshot.val();
        
        // Handle 1v1 Challenge Mode (Legacy/Direct Link)
        if ((!room || !room.players) && opponentId) {
            console.log("Detected 1v1 Challenge Mode");
            // Create virtual room structure for 1v1
            // Sort IDs to ensure consistent Team assignment (Player 1 vs Player 2)
            const sortedIds = [myId, opponentId].sort();
            room = {
                players: sortedIds.map(id => ({ id: id })),
                gameType: 'egg-wars'
            };
        }

        if (!room || !room.players) {
            alert("Invalid Room");
            window.location.href = "rooms.html";
            return;
        }

        // Handle players as array or object
        if (Array.isArray(room.players)) {
            playersList = room.players;
        } else {
            playersList = Object.values(room.players);
        }
        
        // Find my index
        myTeamIndex = playersList.findIndex(p => (p.id === myId) || (p === myId));

        if (myTeamIndex === -1) {
            alert("You are not in this room!");
            window.location.href = "rooms.html";
            return;
        }

        // Setup Me
        const config = TEAMS_CONFIG[myTeamIndex % TEAMS_CONFIG.length];
        me.team = config.name;
        me.color = config.color;
        me.x = config.x;
        me.y = config.y;
        
        // Setup Eggs
        playersList.forEach((p, index) => {
            const teamConfig = TEAMS_CONFIG[index % TEAMS_CONFIG.length];
            eggs[teamConfig.name] = {
                x: teamConfig.eggX,
                y: teamConfig.eggY,
                broken: false,
                health: 7, // Initialize with 7 hits
                color: teamConfig.color,
                ownerId: (p.id || p)
            };
        });

        // Setup My Ref
        myRef = gameRef.child('game_players').child(myId);
        myRef.set({
            x: me.x,
            y: me.y,
            health: me.health,
            team: me.team,
            avatar: me.avatar,
            connected: true
        });
        myRef.onDisconnect().update({ connected: false });

        // Listen to other players
        gameRef.child('game_players').on('value', snapshot => {
            const val = snapshot.val();
            if (!val) return;
            
            // Update opponents
            Object.keys(val).forEach(pid => {
                if (pid !== myId) {
                    if (!opponents[pid]) opponents[pid] = {};
                    const data = val[pid];
                    opponents[pid].targetX = data.x;
                    opponents[pid].targetY = data.y;
                    opponents[pid].health = data.health;
                    opponents[pid].team = data.team;
                    opponents[pid].avatar = data.avatar;
                    opponents[pid].isAttacking = data.isAttacking;
                    
                    if (opponents[pid].x === undefined) {
                        opponents[pid].x = data.x;
                        opponents[pid].y = data.y;
                    }
                    
                    // Sync elimination status
                    opponents[pid].eliminated = data.eliminated;
                }
            });
            
            // Check if all players are connected
            const connectedCount = Object.values(val).filter(p => p.connected).length;
            const totalRequired = playersList.length;
            
            const waitingScreen = document.getElementById('waiting-screen');
            const waitingText = waitingScreen.querySelector('h1');
            
            if (connectedCount >= totalRequired) {
                gameActive = true;
                waitingScreen.style.display = 'none';
            } else {
                if (waitingText) {
                    waitingText.innerText = `جاري انتظار اللاعبين (${connectedCount}/${totalRequired})`;
                }
                // Keep waiting screen visible if game hasn't started
                if (!gameActive) {
                    waitingScreen.style.display = 'flex';
                }
            }
        });

        // Listen for Egg Status
        gameRef.child('eggs').on('value', snapshot => {
            const val = snapshot.val();
            if (val) {
                Object.keys(val).forEach(team => {
                    if (eggs[team]) {
                        if (typeof val[team] === 'object') {
                            eggs[team].broken = val[team].broken;
                            eggs[team].health = val[team].health;
                        } else {
                            // Legacy support
                            eggs[team].broken = val[team];
                            eggs[team].health = val[team] ? 0 : 7;
                        }
                    }
                });
                updateEggUI();
            }
        });
        
        updateEggUI();

        // Listen for Winner
        gameRef.child('winner').on('value', snapshot => {
            const winnerTeam = snapshot.val();
            if (winnerTeam) {
                showResult(winnerTeam === me.team);
                markGameAsFinished();
                
                // Only the winner updates the room scores to avoid conflicts
                if (winnerTeam === me.team) {
                    updateRoomScores(winnerTeam);
                }
            }
        });

        requestAnimationFrame(gameLoop);
        // Reduce update frequency on mobile
        const updateInterval = isMobileDevice ? 150 : 100;
        setInterval(sendUpdate, updateInterval);
        // Resource generation (optimized interval)
    const resourceInterval = isMobileDevice ? 1500 : 1000;
    setInterval(generateResources, resourceInterval);
        
        startEventListeners();
        setupMobileControls();
    });
}

function setupMobileControls() {
    const bindBtn = (id, key) => {
        const btn = document.getElementById(id);
        if (!btn) return;
        
        const start = (e) => { 
            e.preventDefault(); 
            keys[key] = true; 
            // Also set arrow keys for compatibility
            if (key === 'KeyW') keys['ArrowUp'] = true;
            if (key === 'KeyS') keys['ArrowDown'] = true;
            if (key === 'KeyA') keys['ArrowLeft'] = true;
            if (key === 'KeyD') keys['ArrowRight'] = true;
        };
        const end = (e) => { 
            e.preventDefault(); 
            keys[key] = false; 
            if (key === 'KeyW') keys['ArrowUp'] = false;
            if (key === 'KeyS') keys['ArrowDown'] = false;
            if (key === 'KeyA') keys['ArrowLeft'] = false;
            if (key === 'KeyD') keys['ArrowRight'] = false;
        };
        
        btn.addEventListener('touchstart', start, { passive: false });
        btn.addEventListener('touchend', end, { passive: false });
        btn.addEventListener('mousedown', start);
        btn.addEventListener('mouseup', end);
        btn.addEventListener('mouseleave', end);
    };

    bindBtn('btn-up', 'KeyW');
    bindBtn('btn-down', 'KeyS');
    bindBtn('btn-left', 'KeyA');
    bindBtn('btn-right', 'KeyD');
}

function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

function update() {
    if (!gameActive) return;

    if (me.health > 0) {
        // Apply acceleration based on input
        if (keys['KeyW'] || keys['ArrowUp'] || keys['w'] || keys['W']) me.vy -= ACCELERATION;
        if (keys['KeyS'] || keys['ArrowDown'] || keys['s'] || keys['S']) me.vy += ACCELERATION;
        if (keys['KeyA'] || keys['ArrowLeft'] || keys['a'] || keys['A']) me.vx -= ACCELERATION;
        if (keys['KeyD'] || keys['ArrowRight'] || keys['d'] || keys['D']) me.vx += ACCELERATION;

        // Apply friction
        me.vx *= FRICTION;
        me.vy *= FRICTION;

        // Limit max speed
        const maxSpeed = PLAYER_SPEED;
        const speed = Math.sqrt(me.vx * me.vx + me.vy * me.vy);
        if (speed > maxSpeed) {
            me.vx = (me.vx / speed) * maxSpeed;
            me.vy = (me.vy / speed) * maxSpeed;
        }

        // Update position
        const oldX = me.x;
        const oldY = me.y;
        me.x += me.vx;
        me.y += me.vy;

        // Bounds checking
        me.x = Math.max(PLAYER_SIZE, Math.min(CANVAS_WIDTH - PLAYER_SIZE, me.x));
        me.y = Math.max(PLAYER_SIZE, Math.min(CANVAS_HEIGHT - PLAYER_SIZE, me.y));

        // Add footstep trail if moved (reduced on mobile)
        const maxFootsteps = isMobileDevice ? 5 : 15;
        if (Math.abs(me.x - oldX) > 0.5 || Math.abs(me.y - oldY) > 0.5) {
            me.footsteps.push({ x: me.x, y: me.y, alpha: 1, time: Date.now() });
            if (me.footsteps.length > maxFootsteps) me.footsteps.shift();
        }

        // Update footsteps fade
        me.footsteps = me.footsteps.filter(f => {
            f.alpha -= 0.02;
            return f.alpha > 0;
        });
    }

    // Update weather effects
    updateWeather();

    // Interpolate Opponents
    Object.values(opponents).forEach(op => {
        if (op.targetX !== undefined) {
            op.x += (op.targetX - op.x) * 0.2;
            op.y += (op.targetY - op.y) * 0.2;
        }
    });
}

function draw() {
    // Apply screen shake (disabled on mobile)
    if (!isMobileDevice) {
        ctx.save();
        ctx.translate(screenShakeOffset.x, screenShakeOffset.y);
    }
    
    // Simplified background for mobile
    if (isMobileDevice) {
        // Solid gradient - much faster
        const gradient = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
        gradient.addColorStop(0, '#2c5f8d');
        gradient.addColorStop(1, '#2eaa60');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    } else {
        // Full gradient for desktop
        const gradient = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
        gradient.addColorStop(0, '#1e3c72');
        gradient.addColorStop(0.5, '#2a5298');
        gradient.addColorStop(1, '#27ae60');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        
        // Grid pattern (desktop only)
        ctx.strokeStyle = 'rgba(255,255,255,0.05)';
        ctx.lineWidth = 1;
        for (let i = 0; i < CANVAS_WIDTH; i += 40) {
            ctx.beginPath();
            ctx.moveTo(i, 0);
            ctx.lineTo(i, CANVAS_HEIGHT);
            ctx.stroke();
        }
        for (let i = 0; i < CANVAS_HEIGHT; i += 40) {
            ctx.beginPath();
            ctx.moveTo(0, i);
            ctx.lineTo(CANVAS_WIDTH, i);
            ctx.stroke();
        }
    }
    
    // Draw weather effects
    drawWeather();

    // Generators (simplified on mobile)
    generators.forEach(gen => {
        ctx.save();
        
        if (isMobileDevice) {
            // Simple version for mobile - no shadows, no pulse
            ctx.beginPath();
            ctx.arc(gen.x, gen.y, 15, 0, Math.PI * 2);
            ctx.fillStyle = gen.color;
            ctx.fill();
            
            // Simple border
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.stroke();
        } else {
            // Full effects for desktop
            ctx.shadowBlur = 20;
            ctx.shadowColor = gen.color;
            
            ctx.beginPath();
            ctx.arc(gen.x, gen.y, GENERATOR_RADIUS, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(0,0,0,0.3)';
            ctx.fill();
            
            const pulse = Math.sin(Date.now() / 500) * 3;
            ctx.beginPath();
            ctx.arc(gen.x, gen.y, 15 + pulse, 0, Math.PI * 2);
            ctx.fillStyle = gen.color;
            ctx.fill();
            
            ctx.strokeStyle = gen.color;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(gen.x, gen.y, 20 + pulse, 0, Math.PI * 2);
            ctx.stroke();
        }
        
        ctx.restore();
        
        // Text with shadow
        ctx.save();
        ctx.shadowBlur = 5;
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.fillStyle = 'white';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(gen.type.toUpperCase(), gen.x, gen.y + 35);
        ctx.restore();
    });

    // Eggs
    Object.values(eggs).forEach(egg => drawEgg(egg));

    // Players
    drawPlayer(me);
    Object.values(opponents).forEach(op => drawPlayer(op));
    
    // Restore screen shake (only if applied)
    if (!isMobileDevice) {
        ctx.restore();
    }
}

function drawEgg(egg) {
    if (egg.broken) return;

    ctx.save();
    
    // Glow effect (disabled on mobile)
    if (!isMobileDevice) {
        ctx.shadowBlur = 25;
        ctx.shadowColor = egg.color;
    }
    
    // Egg body
    ctx.fillStyle = egg.color;
    ctx.beginPath();
    ctx.ellipse(egg.x, egg.y, 20, 25, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Egg outline
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 3;
    ctx.stroke();
    
    // Shine effect
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.beginPath();
    ctx.ellipse(egg.x - 5, egg.y - 8, 6, 8, -0.3, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();
    
    // Protective circle (simplified on mobile)
    if (!isMobileDevice) {
        ctx.save();
        ctx.strokeStyle = egg.color;
        ctx.globalAlpha = 0.3;
        ctx.lineWidth = 2;
        ctx.beginPath();
        const circleRadius = 40 + Math.sin(Date.now() / 300) * 5;
        ctx.arc(egg.x, egg.y, circleRadius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }
    
    // Health bar (simplified on mobile)
    if (egg.health) {
        const healthPercent = egg.health / 100;
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(egg.x - 25, egg.y - 40, 50, 6);
        
        if (isMobileDevice) {
            // Solid color - faster
            ctx.fillStyle = '#e74c3c';
        } else {
            // Gradient for desktop
            const healthGradient = ctx.createLinearGradient(egg.x - 25, 0, egg.x + 25, 0);
            healthGradient.addColorStop(0, '#e74c3c');
            healthGradient.addColorStop(1, '#c0392b');
            ctx.fillStyle = healthGradient;
        }
        ctx.fillRect(egg.x - 25, egg.y - 40, 50 * healthPercent, 6);
    }
}

function drawPlayer(p) {
    if (p.health <= 0) return;

    // Draw footsteps if player is me (skip on mobile for performance)
    if (!isMobileDevice && p === me && p.footsteps) {
        p.footsteps.forEach(f => {
            ctx.save();
            ctx.globalAlpha = f.alpha * 0.3;
            ctx.fillStyle = p.color || '#ffffff';
            ctx.beginPath();
            ctx.arc(f.x, f.y, 8, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        });
    }

    ctx.save();
    
    // Shadow under player (simplified on mobile)
    if (!isMobileDevice) {
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.ellipse(p.x, p.y + 25, 15, 5, 0, 0, Math.PI * 2);
        ctx.fill();
    }
    
    // Glow effect based on team color (reduced on mobile)
    if (!isMobileDevice) {
        ctx.shadowBlur = 15;
        ctx.shadowColor = p.color || '#ffffff';
    }
    
    // Player avatar
    ctx.font = '35px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(p.avatar || '👮', p.x, p.y);
    
    ctx.restore();
    
    // Attack animation
    if (p.isAttacking) {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(Date.now() / 100);
        
        for (let i = 0; i < 3; i++) {
            ctx.beginPath();
            ctx.arc(0, 0, 35 + i * 10, -Math.PI/3, Math.PI/3);
            ctx.strokeStyle = `rgba(255, 255, 255, ${0.5 - i * 0.15})`;
            ctx.lineWidth = 4;
            ctx.stroke();
        }
        ctx.restore();
    }
    
    // Health bar with gradient
    const healthPercent = p.health / (p.maxHealth || 100);
    
    // Background
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(p.x - 22, p.y - 32, 44, 6);
    
    // Health gradient
    const healthGradient = ctx.createLinearGradient(p.x - 22, 0, p.x + 22, 0);
    if (healthPercent > 0.5) {
        healthGradient.addColorStop(0, '#2ecc71');
        healthGradient.addColorStop(1, '#27ae60');
    } else if (healthPercent > 0.2) {
        healthGradient.addColorStop(0, '#f1c40f');
        healthGradient.addColorStop(1, '#f39c12');
    } else {
        healthGradient.addColorStop(0, '#e74c3c');
        healthGradient.addColorStop(1, '#c0392b');
    }
    ctx.fillStyle = healthGradient;
    ctx.fillRect(p.x - 22, p.y - 32, 44 * healthPercent, 6);
    
    // Name tag
    ctx.save();
    ctx.shadowBlur = 3;
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.fillStyle = 'white';
    ctx.font = 'bold 11px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(p.team === me.team ? 'أنت' : p.team || 'خصم', p.x, p.y - 40);
    ctx.restore();
}

function sendUpdate() {
    if (!gameActive) return;
    myRef.update({
        x: me.x,
        y: me.y,
        health: me.health,
        isAttacking: me.isAttacking || false,
        avatar: me.avatar,
        team: me.team
    });
}

function generateResources() {
    if (!gameActive || me.health <= 0) return;

    let resourceChanged = false;
    generators.forEach(gen => {
        const dist = Math.hypot(me.x - gen.x, me.y - gen.y);
        if (dist < GENERATOR_RADIUS) {
            resources[gen.type]++;
            resourceChanged = true;
            if (!isMobileDevice) playSound('collect'); // Sound only on desktop
        }
    });
    
    // Update UI only if resources changed
    if (resourceChanged) {
        updateUI();
    }
}

function updateUI() {
    document.getElementById('iron-count').innerText = resources.iron;
    document.getElementById('gold-count').innerText = resources.gold;
    document.getElementById('diamond-count').innerText = resources.diamond;
    document.getElementById('health-count').innerText = me.health;
}

function selectAvatar(avatar) {
    me.avatar = avatar;
    document.getElementById('avatar-selection').style.display = 'none';
    if (myRef) myRef.update({ avatar: me.avatar });
}

function toggleShop() {
    const modal = document.getElementById('shop-modal');
    modal.style.display = modal.style.display === 'block' ? 'none' : 'block';
}

function toggleResourceBar() {
    const resourceBar = document.querySelector('.resource-bar');
    if (resourceBar) {
        resourceBar.classList.toggle('minimized');
    }
}

function buyItem(item, cost, currency) {
    if (resources[currency] >= cost) {
        resources[currency] -= cost;
        
        if (item === 'sword_wood') me.damage = 10;
        if (item === 'sword_iron') me.damage = 20;
        if (item === 'armor_diamond') { me.maxHealth = 200; me.health = 200; }
        if (item === 'heal') me.health = Math.min(me.maxHealth, me.health + 20);

        updateUI();
        alert('تم الشراء!');
    } else {
        alert('لا يوجد رصيد كافي!');
    }
}

function attack() {
    if (me.health <= 0) return;

    me.isAttacking = true;
    setTimeout(() => me.isAttacking = false, 200);

    // Play attack sound effect
    playSound('attack');

    // Attack Opponents
    Object.keys(opponents).forEach(opId => {
        const op = opponents[opId];
        const dist = Math.hypot(me.x - op.x, me.y - op.y);
        if (dist < 60 && op.health > 0) {
            gameRef.child('events').push({
                type: 'attack',
                target: opId,
                from: myId,
                damage: me.damage,
                timestamp: firebase.database.ServerValue.TIMESTAMP
            });
            
            // Visual feedback - camera shake
            shakeScreen();
        }
    });

    // Attack Eggs
    Object.keys(eggs).forEach(team => {
        if (team !== me.team) {
            const egg = eggs[team];
            if (!egg.broken) {
                const dist = Math.hypot(me.x - egg.x, me.y - egg.y);
                if (dist < 50) {
                    // Decrement health
                    let currentHealth = egg.health !== undefined ? egg.health : 7;
                    let newHealth = currentHealth - 1;
                    let isBroken = newHealth <= 0;
                    
                    // Update Firebase
                    gameRef.child('eggs').child(team).set({
                        health: newHealth,
                        broken: isBroken
                    });

                    if (isBroken) {
                        alert(`لقد دمرت بيضة ${team}!`);
                        playSound('eggBreak');
                    } else {
                        playSound('eggHit');
                    }
                    
                    shakeScreen();
                }
            }
        }
    });
}

function startEventListeners() {
    gameRef.child('events').on('child_added', snapshot => {
        const event = snapshot.val();
        if (event.type === 'attack' && event.target === myId) {
            takeDamage(event.damage);
            snapshot.ref.remove();
        }
    });
}

function takeDamage(amount) {
    me.health -= amount;
    updateUI();
    if (me.health <= 0) {
        respawn();
    }
}

function respawn() {
    const myEgg = eggs[me.team];
    if (myEgg && myEgg.broken) {
        // Eliminated
        myRef.update({ eliminated: true });
        showResult(false);
        
        // Check if game is over (Last Man Standing)
        const activeOpponentTeams = new Set();
        Object.values(opponents).forEach(op => {
            if (!op.eliminated) activeOpponentTeams.add(op.team);
        });
        
        // If only one team remains active, they win
        if (activeOpponentTeams.size === 1) {
            const winnerTeam = [...activeOpponentTeams][0];
            gameRef.update({ winner: winnerTeam });
        }
    } else {
        // Respawn
        const config = TEAMS_CONFIG[myTeamIndex % TEAMS_CONFIG.length];
        me.x = config.x;
        me.y = config.y;
        me.health = me.maxHealth;
        updateUI();
        alert('تم إعادة إحيائك!');
    }
}

function showResult(isWinner) {
    gameActive = false;
    const screen = document.getElementById('result-screen');
    const title = document.getElementById('result-title');
    const emoji = document.getElementById('result-emoji');
    
    screen.style.display = 'flex';
    
    if (isWinner) {
        title.innerText = '🎉 انتصرت!';
        title.style.color = '#2ecc71';
        emoji.innerText = '🏆';
    } else {
        title.innerText = '💀 خسرت!';
        title.style.color = '#e74c3c';
        emoji.innerText = '💔';
    }
}

function updateEggUI() {
    const container = document.getElementById('egg-status-container');
    if (!container) return;
    container.innerHTML = '';
    container.style.display = 'flex';
    container.style.gap = '10px';
    
    Object.keys(eggs).forEach(team => {
        const egg = eggs[team];
        const div = document.createElement('div');
        div.style.backgroundColor = egg.color;
        div.style.color = 'white';
        div.style.padding = '5px 10px';
        div.style.borderRadius = '5px';
        div.style.opacity = egg.broken ? '0.5' : '1';
        div.style.textDecoration = egg.broken ? 'line-through' : 'none';
        
        // Show health if not broken
        const healthText = egg.broken ? '' : ` (${egg.health !== undefined ? egg.health : 7})`;
        div.innerText = team.toUpperCase() + healthText;
        
        container.appendChild(div);
    });
}

function markGameAsFinished() {
    gameRef.update({ status: 'finished' });

    // Also update user profiles if this was a challenge
    const urlParams = new URLSearchParams(window.location.search);
    const opponentId = urlParams.get('op');

    if (opponentId) {
         // Update my status
        getUser(myId).then(user => {
            if (user && user.eggWarsGames) {
                const games = user.eggWarsGames.map(g => {
                    if (g.id === gameId) g.status = 'finished';
                    return g;
                });
                updateUser(myId, { eggWarsGames: games });
            }
        });

        // Update opponent status
        getUser(opponentId).then(user => {
            if (user && user.eggWarsGames) {
                const games = user.eggWarsGames.map(g => {
                    if (g.id === gameId) g.status = 'finished';
                    return g;
                });
                updateUser(opponentId, { eggWarsGames: games });
            }
        });
    }
}

function updateRoomScores(winnerTeam) {
    // Find the index of the winning team
    const winnerIndex = TEAMS_CONFIG.findIndex(t => t.name === winnerTeam);
    
    if (winnerIndex !== -1 && playersList[winnerIndex]) {
        const winnerId = playersList[winnerIndex].id || playersList[winnerIndex];
        
        // Fetch current room data to update players
        gameRef.once('value').then(snapshot => {
            const room = snapshot.val();
            if (room && room.players) {
                // Check if scores are already updated to avoid infinite loops or double counting
                // (Simple check: if winner has score > 0, maybe we already updated? 
                // But maybe they had score from previous rounds. 
                // For now, just update.)
                
                let updatedPlayers = [];
                if (Array.isArray(room.players)) {
                    updatedPlayers = room.players.map(p => {
                        const pid = p.id || p;
                        if (pid === winnerId) {
                            // Winner gets 100 points
                            return { ...p, score: (p.score || 0) + 100 }; 
                        }
                        return p;
                    });
                } else {
                    // Handle object structure if necessary (though rooms usually use arrays)
                    updatedPlayers = room.players;
                    Object.keys(updatedPlayers).forEach(key => {
                        const p = updatedPlayers[key];
                        const pid = p.id || p;
                        if (pid === winnerId) {
                            updatedPlayers[key] = { ...p, score: (p.score || 0) + 100 };
                        }
                    });
                }
                
                gameRef.update({ players: updatedPlayers });
            }
        });
    }
}

function forceStartGame() {
    gameActive = true;
    document.getElementById('waiting-screen').style.display = 'none';
}

// ==================== PROFESSIONAL FEATURES ====================

// Particle System
function createParticles(x, y, color, count = 10) {
    const container = document.getElementById('game-container');
    for (let i = 0; i < count; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        particle.style.left = x + 'px';
        particle.style.top = y + 'px';
        particle.style.width = Math.random() * 10 + 5 + 'px';
        particle.style.height = particle.style.width;
        particle.style.background = color;
        
        const tx = (Math.random() - 0.5) * 200;
        const ty = (Math.random() - 0.5) * 200;
        particle.style.setProperty('--tx', tx + 'px');
        particle.style.setProperty('--ty', ty + 'px');
        
        container.appendChild(particle);
        setTimeout(() => particle.remove(), 1000);
    }
}

// Combo System
let comboCount = 0;
let lastHitTime = 0;

function updateCombo() {
    const now = Date.now();
    if (now - lastHitTime < 2000) {
        comboCount++;
        if (comboCount > 1) {
            showComboDisplay();
        }
    } else {
        comboCount = 1;
    }
    lastHitTime = now;
    
    // Bonus damage for combos
    return comboCount > 1 ? me.damage * (1 + comboCount * 0.1) : me.damage;
}

function showComboDisplay() {
    const display = document.getElementById('combo-display');
    display.textContent = `COMBO x${comboCount}!`;
    display.style.opacity = '1';
    display.style.animation = 'none';
    setTimeout(() => {
        display.style.animation = 'pulse 0.5s ease-in-out';
    }, 10);
    setTimeout(() => {
        display.style.opacity = '0';
    }, 1500);
}

// PowerUp System
const powerUps = ['speed', 'damage', 'shield', 'heal'];
let activePowerUp = null;
let powerUpEndTime = 0;

function spawnRandomPowerUp() {
    if (Math.random() < 0.01 && !activePowerUp) { // 1% chance each frame
        const type = powerUps[Math.floor(Math.random() * powerUps.length)];
        const x = Math.random() * (CANVAS_WIDTH - 100) + 50;
        const y = Math.random() * (CANVAS_HEIGHT - 100) + 50;
        
        // Draw powerup on canvas
        ctx.save();
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#9b59b6';
        ctx.fillStyle = '#9b59b6';
        ctx.beginPath();
        ctx.arc(x, y, 15, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'white';
        ctx.font = 'bold 20px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(getPowerUpIcon(type), x, y + 7);
        ctx.restore();
        
        // Check collision with player
        const dist = Math.sqrt((me.x - x) ** 2 + (me.y - y) ** 2);
        if (dist < PLAYER_SIZE) {
            activatePowerUp(type);
        }
    }
}

function getPowerUpIcon(type) {
    const icons = {speed: '⚡', damage: '💥', shield: '🛡️', heal: '❤️'};
    return icons[type] || '?';
}

function activatePowerUp(type) {
    activePowerUp = type;
    powerUpEndTime = Date.now() + 5000; // 5 seconds
    
    // Play powerup sound
    playSound('powerup');
    
    const notification = document.getElementById('powerup-notification');
    let message = '';
    
    switch(type) {
        case 'speed':
            PLAYER_SPEED += 3;
            message = '⚡ سرعة مضاعفة!';
            break;
        case 'damage':
            me.damage *= 2;
            message = '💥 ضرر مضاعف!';
            break;
        case 'shield':
            me.maxHealth += 50;
            me.health += 50;
            message = '🛡️ درع قوي!';
            break;
        case 'heal':
            me.health = Math.min(me.health + 50, me.maxHealth);
            message = '❤️ شفاء كامل!';
            break;
    }
    
    notification.textContent = message;
    notification.style.opacity = '1';
    notification.style.animation = 'slideDown 0.5s ease-out';
    
    setTimeout(() => {
        notification.style.opacity = '0';
    }, 3000);
}

function checkPowerUpExpiry() {
    if (activePowerUp && Date.now() > powerUpEndTime) {
        switch(activePowerUp) {
            case 'speed':
                PLAYER_SPEED -= 3;
                break;
            case 'damage':
                me.damage /= 2;
                break;
        }
        activePowerUp = null;
    }
}

// Enhanced Attack with particles
const originalAttack = attack;
attack = function() {
    if (originalAttack) originalAttack();
    
    const damage = updateCombo();
    createParticles(me.x, me.y, me.color, 15);
    
    // Screen shake effect
    canvas.style.animation = 'shake 0.3s';
    setTimeout(() => canvas.style.animation = '', 300);
};

// Add shake animation
const style = document.createElement('style');
style.textContent = `
    @keyframes shake {
        0%, 100% { transform: translate(0, 0); }
        25% { transform: translate(-5px, 5px); }
        50% { transform: translate(5px, -5px); }
        75% { transform: translate(-5px, -5px); }
    }
    @keyframes pulse {
        0%, 100% { transform: translate(-50%, -50%) scale(1); }
        50% { transform: translate(-50%, -50%) scale(1.2); }
    }
    @keyframes slideDown {
        from { transform: translateX(-50%) translateY(-20px); opacity: 0; }
        to { transform: translateX(-50%) translateY(0); opacity: 1; }
    }
`;
document.head.appendChild(style);

// Enhanced Draw Function - Add visual effects
const originalDraw = draw;
draw = function() {
    if (originalDraw) originalDraw();
    
    // Draw powerups
    spawnRandomPowerUp();
    checkPowerUpExpiry();
    
    // Draw glow effects around player
    if (activePowerUp) {
        ctx.save();
        ctx.shadowBlur = 30;
        ctx.shadowColor = '#9b59b6';
        ctx.strokeStyle = '#9b59b6';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(me.x, me.y, PLAYER_SIZE + 5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }
    
    // Draw combo meter
    if (comboCount > 1) {
        ctx.save();
        ctx.fillStyle = '#f1c40f';
        ctx.font = 'bold 20px Arial';
        ctx.textAlign = 'center';
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#f39c12';
        ctx.fillText(`Combo x${comboCount}`, me.x, me.y - PLAYER_SIZE - 10);
        ctx.restore();
    }
};

// === Weather System ===
function updateWeather() {
    if (!weatherEnabled) return;
    
    // Spawn rain drops (minimal on mobile)
    const rainSpawnRate = isMobileDevice ? 0.02 : 0.3;
    if (Math.random() < rainSpawnRate) {
        rainDrops.push({
            x: Math.random() * CANVAS_WIDTH,
            y: -10,
            speed: 3 + Math.random() * 2,
            length: 10 + Math.random() * 10
        });
    }
    
    // Update rain (limit particles on mobile)
    rainDrops = rainDrops.filter(drop => {
        drop.y += drop.speed;
        return drop.y < CANVAS_HEIGHT + 20;
    });
    
    // Limit rain particles on mobile (very strict)
    if (isMobileDevice && rainDrops.length > 10) {
        rainDrops = rainDrops.slice(-10);
    }
    
    // Spawn dust near movement (minimal on mobile)
    const dustSpawnRate = isMobileDevice ? 0.01 : 0.2;
    if (Math.abs(me.vx) > 0.5 || Math.abs(me.vy) > 0.5) {
        if (Math.random() < dustSpawnRate) {
            dustParticles.push({
                x: me.x + (Math.random() - 0.5) * 20,
                y: me.y + (Math.random() - 0.5) * 20,
                vx: (Math.random() - 0.5) * 1,
                vy: -Math.random() * 2,
                alpha: 0.6,
                size: 2 + Math.random() * 3
            });
        }
    }
    
    // Update dust (limit particles on mobile)
    dustParticles = dustParticles.filter(dust => {
        dust.x += dust.vx;
        dust.y += dust.vy;
        dust.alpha -= 0.02;
        return dust.alpha > 0;
    });
    
    // Limit dust particles on mobile (very strict)
    if (isMobileDevice && dustParticles.length > 8) {
        dustParticles = dustParticles.slice(-8);
    }
}

function drawWeather() {
    if (!weatherEnabled) return;
    
    // Draw rain
    ctx.save();
    ctx.strokeStyle = 'rgba(173, 216, 230, 0.5)';
    ctx.lineWidth = 1;
    rainDrops.forEach(drop => {
        ctx.beginPath();
        ctx.moveTo(drop.x, drop.y);
        ctx.lineTo(drop.x - 2, drop.y - drop.length);
        ctx.stroke();
    });
    ctx.restore();
    
    // Draw dust
    ctx.save();
    dustParticles.forEach(dust => {
        ctx.globalAlpha = dust.alpha;
        ctx.fillStyle = '#d4a574';
        ctx.beginPath();
        ctx.arc(dust.x, dust.y, dust.size, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.restore();
}

// === Sound System ===
function playSound(type) {
    if (!soundEnabled || !sounds[type]) return;
    
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = sounds[type].freq;
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + sounds[type].duration / 1000);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + sounds[type].duration / 1000);
    } catch(e) {
        console.log('Sound not supported');
    }
}

// === Screen Effects ===
let screenShakeOffset = { x: 0, y: 0 };
function shakeScreen() {
    // Disable screen shake on mobile for performance
    if (isMobileDevice) return;
    
    const intensity = 5;
    screenShakeOffset.x = (Math.random() - 0.5) * intensity;
    screenShakeOffset.y = (Math.random() - 0.5) * intensity;
    
    setTimeout(() => {
        screenShakeOffset.x *= 0.5;
        screenShakeOffset.y *= 0.5;
    }, 50);
    
    setTimeout(() => {
        screenShakeOffset.x = 0;
        screenShakeOffset.y = 0;
    }, 100);
}

console.log('🎮 Professional features loaded: Particles, Combos, PowerUps, Realistic Physics!');
console.log('📱 Mobile Optimizations:');
console.log('  - Reduced canvas resolution on mobile (600x450)');
console.log('  - Disabled heavy effects (shadows, glow, grid)');
console.log('  - Minimal weather particles');
console.log('  - No footstep trails on mobile');
console.log('  - Simplified graphics & animations');
console.log('  - Reduced network updates (150ms vs 100ms)');
console.log('  - Resource generation every 1.5s on mobile');
console.log('⚡ Performance: OPTIMIZED for smooth mobile gameplay!');

