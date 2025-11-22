// ========================================
// 🃏 لعبة الطرنيب - المنطق الكامل
// ========================================

let gameState = {
    mode: null, // 'solo', 'duo', 'online'
    players: [],
    currentPlayer: 0,
    dealer: 0,
    round: 1,
    hands: [[], [], [], []],
    playedCards: [],
    currentTrick: [],
    trumpSuit: null,
    leadSuit: null,
    bid: { player: -1, amount: 0, suit: null },
    scores: [[0, 0], [0, 0]], // [فريق 1, فريق 2]
    tricksWon: [[0, 0], [0, 0]],
    gameMode: null,
    onlineGameId: null,
    myPosition: 0
    ,gameHistory: []
};

const SUITS = ['hearts', 'diamonds', 'clubs', 'spades'];
const SUIT_SYMBOLS = {
    hearts: '♥',
    diamonds: '♦',
    clubs: '♣',
    spades: '♠'
};
const SUIT_NAMES = {
    hearts: 'قلوب',
    diamonds: 'ديناري',
    clubs: 'سباتي',
    spades: 'بستوني'
};
const VALUES = ['7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const VALUE_NAMES = {
    '7': '٧', '8': '٨', '9': '٩', '10': '١٠',
    'J': 'ولد', 'Q': 'بنت', 'K': 'شايب', 'A': 'آس'
};
const CARD_STRENGTH = {
    '7': 1, '8': 2, '9': 3, '10': 4,
    'J': 5, 'Q': 6, 'K': 7, 'A': 8
};

let me = null;
try {
    me = JSON.parse(localStorage.getItem("user"));
    if (!me) {
        window.location.href = "login.html";
    }
} catch (e) {
    window.location.href = "login.html";
}

// ========================================
// بدء اللعبة
// ========================================
function startGame(mode) {
    gameState.mode = mode;

    if (mode === 'online') {
        showOnlineSetup();
        return;
    }

    // دعم وضع ثنائي مع تمرير opponentId عبر معلمة URL `op`
    const params = new URLSearchParams(window.location.search);
    const op = params.get('op');

    if (mode === 'duo' && op) {
        // حاول جلب بيانات المنافس من Firebase ثم قم بالإعداد
        getUser(op).then(u => {
            setupPlayers(mode);
            gameState.opponentId = String(op);
            if (gameState.players[2]) {
                gameState.players[2].name = u.username || 'صديق';
                gameState.players[2].id = String(u.id || op);
            }
            updatePlayerInfo();
            $('#startScreen').hide();
            $('#gameArea').show();
            startNewRound();
        }).catch(err => {
            console.warn('Failed to load opponent, continuing without it:', err);
            setupPlayers(mode);
            $('#startScreen').hide();
            $('#gameArea').show();
            startNewRound();
        });
    } else {
        setupPlayers(mode);
        $('#startScreen').hide();
        $('#gameArea').show();
        startNewRound();
    }
}

function setupPlayers(mode) {
    if (mode === 'solo') {
        gameState.players = [
            { name: me.username, isHuman: true, isMe: true },
            { name: 'بوت 1', isHuman: false },
            { name: 'بوت 2', isHuman: false },
            { name: 'بوت 3', isHuman: false }
        ];
    } else if (mode === 'duo') {
        // سيتم اختيار الصديق لاحقاً
        gameState.players = [
            { name: me.username, isHuman: true, isMe: true },
            { name: 'بوت 1', isHuman: false },
            { name: 'صديق', isHuman: true },
            { name: 'بوت 2', isHuman: false }
        ];
    }
    
    updatePlayerInfo();
}

function updatePlayerInfo() {
    $('#player1Info .player-name').text(gameState.players[1]?.name || 'اللاعب 1');
    $('#player2Info .player-name').text(gameState.players[2]?.name || 'اللاعب 2');
    $('#player3Info .player-name').text(gameState.players[3]?.name || 'اللاعب 3');
}

// ========================================
// بدء جولة جديدة
// ========================================
function startNewRound() {
    gameState.round++;
    gameState.hands = [[], [], [], []];
    gameState.playedCards = [];
    gameState.currentTrick = [];
    gameState.trumpSuit = null;
    gameState.leadSuit = null;
    gameState.bid = { player: -1, amount: 0, suit: null };
    gameState.tricksWon = [[0, 0], [0, 0]];
    // سجل الجولة الحالية مؤقتًا
    gameState.currentRoundRecord = {
        round: gameState.round,
        bid: null,
        trump: null,
        tricksWon: [0, 0]
    };
    
    $('#roundNumber').text(gameState.round);
    $('#currentBid').text('-');
    $('#playedCards').html('');
    
    dealCards();
    startBidding();
}

// ========================================
// توزيع الورق
// ========================================
function dealCards() {
    const deck = createDeck();
    shuffleDeck(deck);
    
    // توزيع أوراق من حجم الطابلة الفعلي (يعتمد على طول الـ deck)
    for (let i = 0; i < deck.length; i++) {
        const player = i % 4;
        gameState.hands[player].push(deck[i]);
    }

    // ترتيب أوراق كل لاعب
    for (let p = 0; p < 4; p++) {
        sortHand(p);
    }
    displayPlayerHand();
}

function createDeck() {
    const deck = [];
    for (let suit of SUITS) {
        for (let value of VALUES) {
            deck.push({ suit, value });
        }
    }
    return deck;
}

function shuffleDeck(deck) {
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
}

function sortHand(player) {
    gameState.hands[player].sort((a, b) => {
        if (a.suit !== b.suit) {
            return SUITS.indexOf(a.suit) - SUITS.indexOf(b.suit);
        }
        return CARD_STRENGTH[a.value] - CARD_STRENGTH[b.value];
    });
}

function displayPlayerHand() {
    const hand = gameState.hands[0];
    const container = $('#playerHand');
    container.html('');
    
    hand.forEach((card, index) => {
        const cardEl = createCardElement(card, index);
        container.append(cardEl);
    });
}

function createCardElement(card, index) {
    if (!card || !card.suit || !card.value) {
        console.error('Invalid card in createCardElement:', card);
        return $('<div></div>');
    }
    
    const symbol = SUIT_SYMBOLS[card.suit];
    const valueName = VALUE_NAMES[card.value];
    
    const cardEl = $(`
        <div class="card ${card.suit}" data-index="${index}">
            <div class="card-top">
                <span>${valueName}</span>
                <span>${symbol}</span>
            </div>
            <div class="card-center">${symbol}</div>
            <div class="card-bottom">
                <span>${valueName}</span>
                <span>${symbol}</span>
            </div>
        </div>
    `);
    
    cardEl.on('click', function() {
        playCard(index);
    });
    
    return cardEl;
}

// ========================================
// المزايدة
// ========================================
function startBidding() {
    gameState.currentPlayer = (gameState.dealer + 1) % 4;
    showBidModal();
}

function showBidModal() {
    if (gameState.currentPlayer === 0) {
        // دور اللاعب البشري
        const container = $('#bidOptions');
        container.html('');
        
        const minBid = gameState.bid.amount + 1;
        for (let i = Math.max(7, minBid); i <= 13; i++) {
            container.append(`
                <div class="bid-btn" onclick="makeBid(${i})">${i}</div>
            `);
        }
        
        $('#bidModal').addClass('active');
    } else {
        // دور البوت
        setTimeout(() => {
            botMakeBid();
        }, 1500);
    }
}

function makeBid(amount) {
    // إخفاء خيارات المزايدة داخل المودال وعرض محدد النوع
    $('#bidOptions').hide();
    $('#suitSelector').show();
    gameState.tempBid = amount;
}

function selectSuit(suit) {
    gameState.bid = {
        player: gameState.currentPlayer,
        amount: gameState.tempBid,
        suit: suit
    };
    
    gameState.trumpSuit = suit;
    $('#currentBid').text(`${gameState.tempBid} ${SUIT_NAMES[suit]}`);
    // أغلق المودال وأعد الحالة
    $('#bidModal').removeClass('active');
    $('#suitSelector').hide();
    $('#bidOptions').show();
    
    showMessage('المزايدة', `${gameState.players[gameState.currentPlayer].name} زايد ${gameState.tempBid} ${SUIT_NAMES[suit]}`);
    
    setTimeout(() => {
        nextBidder();
    }, 2000);
}

function passBid() {
    $('#bidModal').removeClass('active');
    nextBidder();
}

function nextBidder() {
    gameState.currentPlayer = (gameState.currentPlayer + 1) % 4;
    
    // إذا عاد الدور للمزايد، نبدأ اللعب
    if (gameState.currentPlayer === gameState.bid.player) {
        startPlaying();
    } else {
        showBidModal();
    }
}

function botMakeBid() {
    const hand = gameState.hands[gameState.currentPlayer];
    const strength = evaluateHandStrength(hand);
    
    // البوت يقرر بناءً على قوة أوراقه
    if (strength >= 7 && strength > gameState.bid.amount) {
        const bidAmount = Math.min(13, strength);
        const bestSuit = findBestSuit(hand);
        
        gameState.bid = {
            player: gameState.currentPlayer,
            amount: bidAmount,
            suit: bestSuit
        };
        
        gameState.trumpSuit = bestSuit;
        $('#currentBid').text(`${bidAmount} ${SUIT_NAMES[bestSuit]}`);
        console.log('Bot bid', gameState.currentPlayer, bidAmount, bestSuit);
        showMessage('المزايدة', `${gameState.players[gameState.currentPlayer].name} زايد ${bidAmount} ${SUIT_NAMES[bestSuit]}`);
        
        setTimeout(() => {
            nextBidder();
        }, 2000);
    } else {
        // البوت يمرر
        console.log('Bot passed', gameState.currentPlayer);
        showMessage('المزايدة', `${gameState.players[gameState.currentPlayer].name} مرر`);
        setTimeout(() => {
            nextBidder();
        }, 1500);
    }
}

function evaluateHandStrength(hand) {
    let strength = 0;
    const suitCounts = {};
    
    hand.forEach(card => {
        suitCounts[card.suit] = (suitCounts[card.suit] || 0) + 1;
        if (CARD_STRENGTH[card.value] >= 6) strength += 1;
        if (CARD_STRENGTH[card.value] === 8) strength += 0.5;
    });
    
    return Math.round(strength);
}

function findBestSuit(hand) {
    const suitStrength = {};
    
    SUITS.forEach(suit => {
        suitStrength[suit] = 0;
    });
    
    hand.forEach(card => {
        suitStrength[card.suit] += CARD_STRENGTH[card.value];
    });
    
    let bestSuit = SUITS[0];
    let maxStrength = 0;
    
    for (let suit in suitStrength) {
        if (suitStrength[suit] > maxStrength) {
            maxStrength = suitStrength[suit];
            bestSuit = suit;
        }
    }
    
    return bestSuit;
}

// ========================================
// بدء اللعب
// ========================================
function startPlaying() {
    gameState.currentPlayer = gameState.bid.player;
    highlightCurrentPlayer();
    
    if (gameState.currentPlayer !== 0) {
        setTimeout(() => {
            botPlayCard();
        }, 1500);
    }
}

function highlightCurrentPlayer() {
    $('.player-info').removeClass('active');
    
    if (gameState.currentPlayer === 0) {
        // اللاعب البشري - لا نحتاج highlight
    } else if (gameState.currentPlayer === 1) {
        $('#player1Info').addClass('active');
    } else if (gameState.currentPlayer === 2) {
        $('#player2Info').addClass('active');
    } else if (gameState.currentPlayer === 3) {
        $('#player3Info').addClass('active');
    }
}

// ========================================
// لعب الورقة
// ========================================
function playCard(index) {
    if (gameState.currentPlayer !== 0) return;
    
    const card = gameState.hands[0][index];
    
    // التحقق من صحة اللعبة
    if (!isValidPlay(card, gameState.hands[0])) {
        showMessage('خطأ', 'لا يمكنك لعب هذه الورقة!');
        return;
    }
    
    // إزالة الورقة من يد اللاعب
    gameState.hands[0].splice(index, 1);
    
    // إضافة الورقة للعب
    gameState.currentTrick.push({
        player: 0,
        card: card
    });
    
    // تحديد نوع الورقة الأولى
    if (gameState.currentTrick.length === 1) {
        gameState.leadSuit = card.suit;
    }
    
    displayPlayedCard(card, 'pos-bottom');
    displayPlayerHand();
    
    nextPlayer();
}

function isValidPlay(card, hand) {
    // أول ورقة في الدورة
    if (gameState.currentTrick.length === 0) {
        return true;
    }
    
    // يجب اتباع نوع الورقة الأولى إذا كان لديك
    const hasSuit = hand.some(c => c.suit === gameState.leadSuit);
    
    if (hasSuit && card.suit !== gameState.leadSuit) {
        return false;
    }
    
    return true;
}

function displayPlayedCard(card, position) {
    if (!card || !card.suit || !card.value) {
        console.error('Invalid card:', card);
        return;
    }
    
    const symbol = SUIT_SYMBOLS[card.suit];
    const valueName = VALUE_NAMES[card.value];
    
    if (!symbol || !valueName) {
        console.error('Invalid card data:', card);
        return;
    }
    
    const cardEl = $(`
        <div class="card ${card.suit} played-card ${position}">
            <div class="card-top">
                <span>${valueName}</span>
                <span>${symbol}</span>
            </div>
            <div class="card-center">${symbol}</div>
            <div class="card-bottom">
                <span>${valueName}</span>
                <span>${symbol}</span>
            </div>
        </div>
    `);
    
    $('#playedCards').append(cardEl);
}

function nextPlayer() {
    if (gameState.currentTrick.length === 4) {
        // نهاية الدورة
        setTimeout(() => {
            evaluateTrick();
        }, 2000);
    } else {
        gameState.currentPlayer = (gameState.currentPlayer + 1) % 4;
        highlightCurrentPlayer();
        
        if (gameState.currentPlayer !== 0) {
            setTimeout(() => {
                botPlayCard();
            }, 1500);
        }
    }
}

function botPlayCard() {
    const hand = gameState.hands[gameState.currentPlayer];
    const cardIndex = chooseBotCard(hand);
    const card = hand[cardIndex];
    
    hand.splice(cardIndex, 1);
    
    gameState.currentTrick.push({
        player: gameState.currentPlayer,
        card: card
    });
    
    if (gameState.currentTrick.length === 1) {
        gameState.leadSuit = card.suit;
    }
    
    let position = 'pos-top';
    if (gameState.currentPlayer === 1) position = 'pos-left';
    else if (gameState.currentPlayer === 3) position = 'pos-right';
    
    console.log('Bot played', gameState.currentPlayer, card);
    displayPlayedCard(card, position);
    
    nextPlayer();
}

function chooseBotCard(hand) {
    const validCards = hand.filter(card => isValidPlay(card, hand));
    
    if (validCards.length === 0) return 0;
    
    // استراتيجية بسيطة: العب أقوى ورقة إذا كنت تريد الفوز
    if (gameState.currentTrick.length === 3) {
        // آخر لاعب - حاول الفوز
        const winningCard = findWinningCard(validCards);
        if (winningCard !== -1) {
            return hand.indexOf(validCards[winningCard]);
        }
    }
    
    // العب أضعف ورقة صالحة
    let weakestIndex = 0;
    let weakestStrength = 100;
    
    validCards.forEach((card, i) => {
        const strength = CARD_STRENGTH[card.value];
        if (strength < weakestStrength) {
            weakestStrength = strength;
            weakestIndex = i;
        }
    });
    
    return hand.indexOf(validCards[weakestIndex]);
}

function findWinningCard(cards) {
    // احصل على بطاقة الفائز الحالية من الدورة (ليس بالضرورة أن يكون موقعها مساوي لرقم اللاعب)
    const currentWinnerPlayer = getCurrentTrickWinner();
    const winnerEntryIndex = gameState.currentTrick.findIndex(e => e.player === currentWinnerPlayer);
    if (winnerEntryIndex === -1) return -1;

    const winningCard = gameState.currentTrick[winnerEntryIndex].card;

    for (let i = 0; i < cards.length; i++) {
        if (canBeat(cards[i], winningCard)) {
            return i;
        }
    }

    return -1;
}

function canBeat(card1, card2) {
    // الطرنيب يفوز على كل شيء
    if (card1.suit === gameState.trumpSuit && card2.suit !== gameState.trumpSuit) {
        return true;
    }
    
    if (card2.suit === gameState.trumpSuit && card1.suit !== gameState.trumpSuit) {
        return false;
    }
    
    // نفس النوع - قارن القوة
    if (card1.suit === card2.suit) {
        return CARD_STRENGTH[card1.value] > CARD_STRENGTH[card2.value];
    }
    
    // أنواع مختلفة - الورقة الثانية تفوز
    return false;
}

// ========================================
// تقييم الدورة
// ========================================
function evaluateTrick() {
    const winner = getCurrentTrickWinner();
    const team = winner % 2;
    
    gameState.tricksWon[team][Math.floor(winner / 2)]++;
    // حدّث سجل الجولة
    try {
        gameState.currentRoundRecord.tricksWon = [
            (gameState.tricksWon[0][0] + gameState.tricksWon[0][1]) || 0,
            (gameState.tricksWon[1][0] + gameState.tricksWon[1][1]) || 0
        ];
    } catch (e) {
        console.warn('No currentRoundRecord to update', e);
    }
    
    showMessage('الفائز', `${gameState.players[winner].name} فاز بالدورة!`);
    
    setTimeout(() => {
        $('#playedCards').html('');
        gameState.currentTrick = [];
        gameState.leadSuit = null;
        gameState.currentPlayer = winner;
        
        // التحقق من نهاية الجولة
        if (gameState.hands[0].length === 0) {
            endRound();
        } else {
            highlightCurrentPlayer();
            if (gameState.currentPlayer !== 0) {
                setTimeout(() => {
                    botPlayCard();
                }, 1500);
            }
        }
    }, 2500);
}

function getCurrentTrickWinner() {
    let winner = 0;
    let winningCard = gameState.currentTrick[0].card;
    
    for (let i = 1; i < gameState.currentTrick.length; i++) {
        const card = gameState.currentTrick[i].card;
        
        if (canBeat(card, winningCard)) {
            winner = i;
            winningCard = card;
        }
    }
    
    return gameState.currentTrick[winner].player;
}

// ========================================
// نهاية الجولة
// ========================================
function endRound() {
    const bidTeam = gameState.bid.player % 2;
    const bidderTricks = gameState.tricksWon[bidTeam][0] + gameState.tricksWon[bidTeam][1];
    
    if (bidderTricks >= gameState.bid.amount) {
        // الفريق المزايد نجح
        gameState.scores[bidTeam][0] += bidderTricks;
        gameState.scores[bidTeam][1] += bidderTricks;
    } else {
        // الفريق المزايد فشل
        gameState.scores[bidTeam][0] -= gameState.bid.amount;
        gameState.scores[bidTeam][1] -= gameState.bid.amount;
        
        // الفريق الآخر يأخذ نقاطه
        const otherTeam = 1 - bidTeam;
        const otherTricks = gameState.tricksWon[otherTeam][0] + gameState.tricksWon[otherTeam][1];
        gameState.scores[otherTeam][0] += otherTricks;
        gameState.scores[otherTeam][1] += otherTricks;
    }
    
    updateScores();
    
    // التحقق من نهاية اللعبة
    if (gameState.scores[0][0] >= 41 || gameState.scores[1][0] >= 41) {
        // أضف ملخّص الجولة لسجل اللعبة
        try {
            gameState.currentRoundRecord.bid = gameState.bid;
            gameState.currentRoundRecord.trump = gameState.trumpSuit;
            gameState.gameHistory = gameState.gameHistory || [];
            gameState.gameHistory.push(gameState.currentRoundRecord);
        } catch (e) { console.warn('Failed to append round to history', e); }

        endGame();
    } else {
        // أضف ملخّص الجولة لسجل اللعبة
        try {
            gameState.currentRoundRecord.bid = gameState.bid;
            gameState.currentRoundRecord.trump = gameState.trumpSuit;
            gameState.gameHistory = gameState.gameHistory || [];
            gameState.gameHistory.push(gameState.currentRoundRecord);
        } catch (e) { console.warn('Failed to append round to history', e); }

        showMessage('نهاية الجولة', `النتيجة: ${gameState.scores[0][0]} - ${gameState.scores[1][0]}`);
        setTimeout(() => {
            startNewRound();
        }, 3000);
    }
}

function updateScores() {
    $('#ourScore').text(gameState.scores[0][0]);
    $('#theirScore').text(gameState.scores[1][0]);
}

function endGame() {
    const winner = gameState.scores[0][0] >= 41 ? 'فريقنا' : 'فريقهم';
    showMessage('🎉 نهاية اللعبة', `${winner} فاز باللعبة!`);

    // حفظ نتيجة اللعبة في Firebase
    saveTarneebResult();
    
    setTimeout(() => {
        if (confirm('هل تريد لعب جولة جديدة؟')) {
            location.reload();
        } else {
            exitGame();
        }
    }, 3000);
}

// ========================================
// حفظ نتيجة اللعبة في Firebase
// ========================================
function saveTarneebResult() {
    try {
        if (!me || !me.id) {
            console.warn('No logged-in user to save game result');
            return;
        }

        const userWon = gameState.scores[0][0] >= 41;
        const result = userWon ? 'win' : 'lose';

        const gameRecord = {
            id: 't' + Date.now(),
            type: 'tarneeb',
            result: result,
            ourScore: gameState.scores[0][0],
            theirScore: gameState.scores[1][0],
            time: Date.now(),
            history: gameState.gameHistory || []
        };

        me.games = me.games || [];
        me.games.push(gameRecord);

        // تحديث المستخدم المحلي في قاعدة البيانات
        if (typeof updateUser === 'function') {
            updateUser(me.id, { games: me.games }).then(() => {
                console.log('Tarneeb result saved to Firebase for me:', me.id);
                showMessage('حفظ النتيجة', 'تم حفظ نتيجة اللعبة بنجاح.');

                // إذا كانت اللعبة ثنائية أو أونلاين وحُدد opponentId، احفظ نسخة للمنافس
                // ملاحظة: لا يمكن حفظ نتائج البوتات في الوضع `solo` لعدم وجود مستخدم حقيقي
                if ((gameState.mode === 'duo' || (gameState.mode === 'online' && gameState.opponentId)) && gameState.opponentId) {
                    getUser(gameState.opponentId).then(op => {
                        try {
                            op.games = op.games || [];
                            // سجّل نسخة تشير إلى أن opponent انتهى من اللعبة
                            const hisRecord = Object.assign({}, gameRecord, { opponentView: true, opponentId: me.id });
                            op.games.push(hisRecord);
                            updateUser(gameState.opponentId, { games: op.games }).then(() => {
                                console.log('Tarneeb result saved to opponent:', gameState.opponentId);
                            }).catch(err => console.error('Failed to update opponent games:', err));
                        } catch (e) { console.error('Error preparing opponent record', e); }
                    }).catch(err => console.warn('Failed to fetch opponent user:', err));
                }

            }).catch(err => console.error('Failed to save tarneeb result:', err));
        } else {
            console.warn('updateUser not available - make sure firebase-data.js is loaded');
        }
    } catch (e) {
        console.error('Error saving tarneeb result:', e);
    }
}

// ========================================
// وظائف مساعدة
// ========================================
function showMessage(title, text) {
    $('#messageTitle').text(title);
    $('#messageText').text(text);
    $('#gameMessage').addClass('show');
    
    setTimeout(() => {
        $('#gameMessage').removeClass('show');
    }, 2000);
}

// عرض سجل اللعبة - يبنى ديناميكياً من `gameState.gameHistory`
function showGameHistory() {
    const history = gameState.gameHistory || [];
    if (history.length === 0) {
        alert('لا يوجد سجل متوفر بعد. ابدأ لعبة أولاً.');
        return;
    }

    let html = `
        <div style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);z-index:9999;display:flex;justify-content:center;align-items:center;">
            <div style="background:white;padding:20px;border-radius:12px;max-width:800px;width:90%;max-height:80vh;overflow:auto;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                    <h2 style="margin:0;">سجل اللعبة</h2>
                    <button onclick="document.querySelector('#historyModal').style.display='none'" style="background:none;border:none;font-size:22px;cursor:pointer;">×</button>
                </div>
                <div style="font-size:14px;color:#333;">
    `;

    history.forEach(r => {
        html += `
            <div style="border-bottom:1px solid #eee;padding:10px 0;">
                <div><strong>الجولة ${r.round}</strong></div>
                <div>المزايدة: ${r.bid ? (r.bid.amount + ' ' + (r.bid.suit ? SUIT_NAMES[r.bid.suit] : '')) : '-'}</div>
                <div>الطرنيب: ${r.trump ? SUIT_NAMES[r.trump] : '-'}</div>
                <div>الاكلات: فريقنا ${r.tricksWon ? r.tricksWon[0] : 0} - فريقهم ${r.tricksWon ? r.tricksWon[1] : 0}</div>
            </div>
        `;
    });

    html += `</div></div></div>`;

    const modal = document.getElementById('historyModal');
    modal.innerHTML = html;
    modal.style.display = 'block';
}

// ========================================
// مستمع التحديات - إشعارات داخل التطبيق (Realtime)
// ========================================
function startTarneebListener() {
    if (!me || !me.id) return;

    gameState.knownTarneebGames = gameState.knownTarneebGames || {};

    const ref = firebase.database().ref('users/' + me.id + '/tarneebGames');
    ref.on('value', snapshot => {
        const raw = snapshot.val();
        const list = Array.isArray(raw) ? raw : (raw ? Object.values(raw) : []);

        list.forEach(g => {
            if (!g || !g.id) return;

            const prev = gameState.knownTarneebGames[g.id];
            // تحديث الحالة المعروفة
            gameState.knownTarneebGames[g.id] = g.status;

            // حالة: تحدي وارد (invited) — عرض إشعار قبول/رفض
            if (!prev && g.status === 'invited') {
                // جلب بيانات المنافس لعرض الاسم
                getUser(g.opponentId).then(u => {
                    const name = (u && u.username) ? u.username : 'صديق';
                    const accept = confirm(`${name} تحداك للعب الطرنيب. قبول التحدي الآن؟`);
                    if (accept) {
                        acceptTarneebChallenge(g.id, g.opponentId);
                    } else {
                        rejectTarneebChallenge(g.id, g.opponentId);
                    }
                }).catch(() => {
                    const accept = confirm(`لديك تحدي جديد - قبول؟`);
                    if (accept) acceptTarneebChallenge(g.id, g.opponentId);
                    else rejectTarneebChallenge(g.id, g.opponentId);
                });
            }

            // حالة: تم قبول تحديك (كان لديك pending ثم صار playing)
            if (prev === 'pending' && g.status === 'playing') {
                // المنافس قبل التحدي
                getUser(g.opponentId).then(u => {
                    const name = (u && u.username) ? u.username : 'صديق';
                    showMessage('تم قبول التحدي', `${name} قبل تحديك — ابدأ اللعب الآن`);
                    // اضبط opponentId وابدأ الوضع الثنائي
                    gameState.opponentId = String(g.opponentId);
                    setTimeout(() => startGame('duo'), 1200);
                }).catch(() => {
                    showMessage('تم قبول التحدي', `المنافس قبل التحدي — ابدأ اللعب الآن`);
                    gameState.opponentId = String(g.opponentId);
                    setTimeout(() => startGame('duo'), 1200);
                });
            }

            // حالة: تم إلغاء/رفض التحدي — تظهر رسالة بسيطة
            if (prev && (g.status === 'cancelled' || g.status === 'rejected')) {
                showMessage('تحديث التحدي', 'تم إلغاء التحدي أو رفضه.');
            }
        });
    });
}

// بدء الاستماع عند تحميل السكربت إذا كان المستخدم موجود
try {
    if (me && me.id) {
        startTarneebListener();
    }
} catch (e) {
    console.warn('Tarneeb listener init failed', e);
}

// ======= تحدي الأصدقاء (Firebase integration) =======
function openChallengeModal() {
    // احصل على أصدقاء المستخدم ثم عرضهم
    getAllUsers().then(users => {
        users.forEach(u => u.id = String(u.id));
        const friends = (me.friends || []).map(String);
        const list = users.filter(u => friends.includes(String(u.id)));

        let html = `
            <div style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);z-index:9999;display:flex;justify-content:center;align-items:center;">
                <div style="background:white;padding:20px;border-radius:12px;max-width:700px;width:90%;max-height:80vh;overflow:auto;">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                        <h2 style="margin:0;">تحدي صديق</h2>
                        <button onclick="document.getElementById('challengeModal').style.display='none'" style="background:none;border:none;font-size:22px;cursor:pointer;">×</button>
                    </div>
                    <div>
        `;

        if (list.length === 0) {
            html += `<div style="padding:20px;color:#666">لا يوجد أصدقاء لبدء تحدي</div>`;
        } else {
            list.forEach(friend => {
                html += `
                    <div style="display:flex;justify-content:space-between;align-items:center;padding:10px;border-bottom:1px solid #eee;">
                        <div style="display:flex;align-items:center;gap:12px;">
                            <img src="${friend.avatar || 'https://via.placeholder.com/40'}" style="width:40px;height:40px;border-radius:50%">
                            <div>
                                <div style="font-weight:700">${friend.username}</div>
                                <div style="font-size:12px;color:#666">${friend.email || ''}</div>
                            </div>
                        </div>
                        <div>
                            <button class="btn btn-primary" onclick="sendTarneebChallenge('${friend.id}')">🎯 تحدي</button>
                        </div>
                    </div>
                `;
            });
        }

        html += `</div></div></div>`;

        const modal = document.getElementById('challengeModal');
        modal.innerHTML = html;
        modal.style.display = 'block';
    }).catch(err => {
        console.error('Failed to load users for challenge modal', err);
        alert('حدث خطأ أثناء جلب الأصدقاء');
    });
}

function sendTarneebChallenge(friendId) {
    const gameId = 't' + Date.now();

    me.tarneebGames = (me.tarneebGames || []).filter(g => !(String(g.opponentId) === String(friendId) && g.status === 'finished'));

    const myGame = { id: gameId, opponentId: String(friendId), status: 'pending', time: Date.now() };
    const hisGame = { id: gameId, opponentId: String(me.id), status: 'invited', time: Date.now() };

    me.tarneebGames.push(myGame);

    updateUser(me.id, { tarneebGames: me.tarneebGames }).then(() => {
        getUser(friendId).then(fr => {
            fr.tarneebGames = (fr.tarneebGames || []).filter(g => !(String(g.opponentId) === String(me.id) && g.status === 'finished'));
            fr.tarneebGames.push(hisGame);
            updateUser(friendId, { tarneebGames: fr.tarneebGames }).then(() => {
                alert('تم إرسال التحدي!');
                document.getElementById('challengeModal').style.display = 'none';
            }).catch(err => { console.error(err); alert('فشل عند إرسال التحدي'); });
        }).catch(err => { console.error(err); alert('المستخدم غير موجود'); });
    }).catch(err => { console.error(err); alert('فشل عند تحديث بياناتك'); });
}

function acceptTarneebChallenge(gameId, opponentId) {
    const game = (me.tarneebGames || []).find(g => g.id === gameId);
    if (!game) return;

    // عند قبول التحدي، نغيّر الحالة إلى 'accepted' ونخطر صاحب التحدي
    game.status = 'accepted';

    updateUser(me.id, { tarneebGames: me.tarneebGames }).then(() => {
        // حدّث حالة المدعو عند صاحب التحدي إلى 'accepted'
        getUser(opponentId).then(opponent => {
            try {
                opponent.tarneebGames = opponent.tarneebGames || [];
                const hisGame = (opponent.tarneebGames || []).find(g => g.id === gameId);
                if (hisGame) {
                    hisGame.status = 'accepted';
                }
                updateUser(opponentId, { tarneebGames: opponent.tarneebGames }).then(() => {
                    showMessage('تم قبول التحدي', 'تم قبول التحدي، في انتظار بدء صاحب التحدي للعبة.');
                }).catch(err => console.error('Failed to update inviter after accept:', err));
            } catch (e) { console.error(e); }
        }).catch(err => console.warn('Failed to fetch inviter user:', err));
    }).catch(err => console.error('Failed to accept tarneeb challenge locally:', err));
}

// يبدأ صاحب التحدي اللعبة فعلياً: يغيّر الحالتين إلى 'playing' ويعيد التوجيه
function startTarneebGameAsOwner(gameId, opponentId) {
    // حدّث حالة في ملف المستخدم الحالي
    try {
        me.tarneebGames = me.tarneebGames || [];
        const myGame = me.tarneebGames.find(g => g.id === gameId);
        if (myGame) myGame.status = 'playing';
        updateUser(me.id, { tarneebGames: me.tarneebGames }).then(() => {
            // حدّث حالة المنافس
            getUser(opponentId).then(op => {
                try {
                    op.tarneebGames = op.tarneebGames || [];
                    const opGame = op.tarneebGames.find(g => g.id === gameId);
                    if (opGame) opGame.status = 'playing';
                    updateUser(opponentId, { tarneebGames: op.tarneebGames }).then(() => {
                        // اعادة توجيه صاحب التحدي لبدء اللعبة ثنائياً
                        window.location.href = `tarneeb.html?op=${opponentId}&game=${gameId}`;
                    }).catch(err => console.error('Failed to set opponent playing:', err));
                } catch (e) { console.error(e); }
            }).catch(err => console.error('Failed to fetch opponent to set playing:', err));
        }).catch(err => console.error('Failed to set my game to playing:', err));
    } catch (e) { console.error(e); }
}

function cancelTarneebChallenge(gameId, opponentId) {
    if (!confirm('هل تريد إلغاء التحدي؟')) return;
    me.tarneebGames = (me.tarneebGames || []).filter(g => g.id !== gameId);
    updateUser(me.id, { tarneebGames: me.tarneebGames }).then(() => {
        getUser(opponentId).then(op => {
            op.tarneebGames = (op.tarneebGames || []).filter(g => g.id !== gameId);
            updateUser(opponentId, { tarneebGames: op.tarneebGames }).then(() => {
                alert('تم إلغاء التحدي');
                document.getElementById('challengeModal').style.display = 'none';
            });
        });
    });
}

function rejectTarneebChallenge(gameId, opponentId) {
    if (!confirm('هل تريد رفض التحدي؟')) return;
    me.tarneebGames = (me.tarneebGames || []).filter(g => g.id !== gameId);
    updateUser(me.id, { tarneebGames: me.tarneebGames }).then(() => {
        getUser(opponentId).then(op => {
            op.tarneebGames = (op.tarneebGames || []).filter(g => g.id !== gameId);
            updateUser(opponentId, { tarneebGames: op.tarneebGames }).then(() => {
                alert('تم رفض التحدي');
                document.getElementById('challengeModal').style.display = 'none';
            });
        });
    });
}

// إذا فتحت الصفحة مع معلمات URL للخصم واستدعاء البدء، ابدأ الوضع الثنائي تلقائياً
(function autoStartFromParams(){
    try {
        const params = new URLSearchParams(window.location.search);
        const op = params.get('op');
        const autostart = params.get('autostart');
        if (op && autostart === 'duo') {
            // استدعاء startGame سينقل لإعداد اللاعبين وإطلاق الجولة
            startGame('duo');
        }
    } catch(e) { /* ignore */ }
})();

function showRules() {
    alert(`قواعد لعبة الطرنيب:

1. اللعبة تلعب بـ 4 لاعبين في فريقين
2. كل لاعب يحصل على 13 ورقة
3. المزايدة: كل لاعب يزايد على عدد الأكلات
4. الطرنيب: النوع الذي يختاره المزايد
5. اللعب: يجب اتباع نوع الورقة الأولى
6. الفوز: أول فريق يصل لـ 41 نقطة`);
}

function exitGame() {
    if (confirm('هل أنت متأكد من الخروج؟')) {
        window.location.href = 'index.html';
    }
}

// ========================================
// اللعب الأونلاين (سيتم تطويره)
// ========================================
function showOnlineSetup() {
    alert('اللعب الأونلاين قريباً!');
    location.reload();
}
