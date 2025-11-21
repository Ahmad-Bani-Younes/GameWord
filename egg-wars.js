// Game Constants
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const PLAYER_SIZE = 30;
const PLAYER_SPEED = 5;
const GENERATOR_RADIUS = 40;
const EGG_SIZE = 40;

// Teams Configuration (4 Players)
const TEAMS_CONFIG = [
    { name: 'blue', color: '#3498db', x: 100, y: 100, eggX: 60, eggY: 60 },
    { name: 'red', color: '#e74c3c', x: 700, y: 100, eggX: 740, eggY: 60 },
    { name: 'green', color: '#2ecc71', x: 100, y: 500, eggX: 60, eggY: 540 },
    { name: 'yellow', color: '#f1c40f', x: 700, y: 500, eggX: 740, eggY: 540 }
];

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
    color: '#fff',
    health: 100, maxHealth: 100,
    damage: 10,
    team: '',
    isAttacking: false,
    avatar: '👮'
};

// Opponents (Map: id -> object)
let opponents = {};

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

    // Input Listeners
    window.addEventListener('keydown', e => {
        keys[e.code] = true;
        keys[e.key] = true;
        if (e.key === 'b' || e.key === 'B') toggleShop();
        if (e.key === ' ') attack();
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
            
            gameActive = true;
            document.getElementById('waiting-screen').style.display = 'none';
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
        setInterval(sendUpdate, 100);
        setInterval(generateResources, 1000);
        
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
        if (keys['KeyW'] || keys['ArrowUp'] || keys['w'] || keys['W']) me.y -= PLAYER_SPEED;
        if (keys['KeyS'] || keys['ArrowDown'] || keys['s'] || keys['S']) me.y += PLAYER_SPEED;
        if (keys['KeyA'] || keys['ArrowLeft'] || keys['a'] || keys['A']) me.x -= PLAYER_SPEED;
        if (keys['KeyD'] || keys['ArrowRight'] || keys['d'] || keys['D']) me.x += PLAYER_SPEED;

        me.x = Math.max(PLAYER_SIZE, Math.min(CANVAS_WIDTH - PLAYER_SIZE, me.x));
        me.y = Math.max(PLAYER_SIZE, Math.min(CANVAS_HEIGHT - PLAYER_SIZE, me.y));
    }

    // Interpolate Opponents
    Object.values(opponents).forEach(op => {
        if (op.targetX !== undefined) {
            op.x += (op.targetX - op.x) * 0.2;
            op.y += (op.targetY - op.y) * 0.2;
        }
    });
}

function draw() {
    ctx.fillStyle = '#27ae60';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Generators
    generators.forEach(gen => {
        ctx.beginPath();
        ctx.arc(gen.x, gen.y, GENERATOR_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.fill();
        
        ctx.beginPath();
        ctx.arc(gen.x, gen.y, 15, 0, Math.PI * 2);
        ctx.fillStyle = gen.color;
        ctx.fill();
        
        ctx.fillStyle = 'white';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(gen.type, gen.x, gen.y + 30);
    });

    // Eggs
    Object.values(eggs).forEach(egg => drawEgg(egg));

    // Players
    drawPlayer(me);
    Object.values(opponents).forEach(op => drawPlayer(op));
}

function drawEgg(egg) {
    if (egg.broken) return;

    ctx.fillStyle = egg.color;
    ctx.beginPath();
    ctx.ellipse(egg.x, egg.y, 20, 25, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.beginPath();
    ctx.arc(egg.x, egg.y, 40, 0, Math.PI * 2);
    ctx.stroke();
}

function drawPlayer(p) {
    if (p.health <= 0) return;

    ctx.font = '30px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(p.avatar || '👮', p.x, p.y);
    
    if (p.isAttacking) {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.beginPath();
        ctx.arc(0, 0, 40, -Math.PI/4, Math.PI/4);
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 5;
        ctx.stroke();
        ctx.restore();
    }
    
    ctx.fillStyle = 'red';
    ctx.fillRect(p.x - 20, p.y - 30, 40, 5);
    ctx.fillStyle = '#2ecc71';
    ctx.fillRect(p.x - 20, p.y - 30, 40 * (p.health / (p.maxHealth || 100)), 5);
    
    ctx.fillStyle = 'white';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(p.team === me.team ? 'أنت' : 'الخصم', p.x, p.y - 35);
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

    generators.forEach(gen => {
        const dist = Math.hypot(me.x - gen.x, me.y - gen.y);
        if (dist < GENERATOR_RADIUS) {
            resources[gen.type]++;
            updateUI();
        }
    });
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
                    }
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
