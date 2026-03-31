import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
// UPDATED: Added 'push' to imports for saving transactions
import { getDatabase, ref, set, get, update, onValue, push } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyDR2OugzoVNnKN6OUKsPxC9ajldlhanteE",
    authDomain: "tournament-af6dd.firebaseapp.com",
    databaseURL: "https://tournament-af6dd-default-rtdb.firebaseio.com",
    projectId: "tournament-af6dd",
    appId: "1:726964405659:web:d03f72c2d6f8721bc98d3e"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

// Original Names List
const PAKISTANI_NAMES = [ 
    'Ayesha','Nazim','Fatima','Sana','Maria','Hina','Zainab','Sara','Iqra','Mehreen','Nida','Ali','Ahmed','Usman','Hassan','Bilal','Imran','Kamran','Faisal','Zahid','Waqas','Aiman','Amna','Anaya','Areeba','Arisha','Arooj','Asma','Ayat','Azka','Benish','Bushra','Dua','Eman','Esha','Fariha','Farwa','Hafsa','Hajra','Hiba','Humaira','Ifrah','Inaya','Iram','Isma','Javeria','Kainat','Kanza','Komal','Laiba','Lubna','Maham','Mahnoor','Malaika','Mariam','Mehwish','Minal','Misbah','Momina','Nabeela','Nadia','Naima','Naila','Nashra','Neelam','Nimra','Noor','Rabab','Rabia','Rafayla','Ramsha','Rania','Rashida','Rida','Rimsha','Saba','Sadia','Saima','Samina','Saniya','Shanza','Shazia','Sidra','Sobia','Sonia','Sumaira','Tabassum','Tahira','Tania','Tehmina','Uzma','Wajiha','Yasmin','Yumna','Zara','Zarmeen','Zehra','Zain','Zoya','Zunaira','Sehrish','Aleena','Alishba','Anum','Aqsa','Bareera','Erum','Falak','Ghazal','Hoorain','Iqrah','Jannat','Kashaf','Laraib','Mahira','Nargis','Qandeel','Rukhsar','Sahar','Shifa','Tooba'
];

let userAuth = null;
let isLoginMode = true;
let isGameRunning = false;

const cardSuits = [
    { s: '♠', color: 'black-card' }, { s: '♣', color: 'black-card' },
    { s: '♦', color: 'red-card' }, { s: '♥', color: 'red-card' }
];

// --- Modal Controls ---
const modal = document.getElementById('modal-overlay');
if(document.getElementById('profile-trigger')) document.getElementById('profile-trigger').onclick = () => modal.style.display = 'flex';
if(document.getElementById('close-modal')) document.getElementById('close-modal').onclick = () => modal.style.display = 'none';

window.toggleAuthUI = () => {
    isLoginMode = !isLoginMode;
    document.getElementById('signup-fields').classList.toggle('hidden', isLoginMode);
    document.getElementById('auth-btn').innerText = isLoginMode ? "Confirm" : "Sign Up";
};

// --- Auth Handling ---
onAuthStateChanged(auth, (u) => {
    if(u) {
        userAuth = u;
        document.getElementById('auth-form').style.display = 'none';
        document.getElementById('profile-info').style.display = 'block';
        onValue(ref(db, 'users/' + u.uid), s => {
            const d = s.val();
            if(d) {
                // Multi-currency read
                const pkrBalance = (d.wallet && d.wallet.PKR !== undefined) ? d.wallet.PKR : (d.wallet_balance || 0);
                
                document.getElementById('wallet-display').innerText = `PKR ${pkrBalance}`;
                document.getElementById('prof-user').innerText = d.username || 'User';
                document.getElementById('prof-email').innerText = d.email;
                document.getElementById('prof-balance').innerText = pkrBalance;
                if(document.getElementById('user-display')) document.getElementById('user-display').innerText = d.username || 'User';
            }
        });
    } else {
        userAuth = null;
        document.getElementById('auth-form').style.display = 'block';
        document.getElementById('profile-info').style.display = 'none';
        document.getElementById('wallet-display').innerText = "Login Required";
    }
});

document.getElementById('auth-btn').onclick = async () => {
    const e = document.getElementById('email').value, p = document.getElementById('password').value, u = document.getElementById('username') ? document.getElementById('username').value : '';
    try {
        if(isLoginMode) {
            await signInWithEmailAndPassword(auth, e, p);
        } else {
            const r = await createUserWithEmailAndPassword(auth, e, p);
            // Create user with multi-currency wallet structure
            await set(ref(db, 'users/' + r.user.uid), { 
                username: u, 
                email: e, 
                wallet: { PKR: 500, INR: 0, USD: 0 }, // 500 PKR signup bonus
                preferred_currency: 'PKR'
            });

            // LOG TRANSACTION: Signup Bonus
            await push(ref(db, `transactions/${r.user.uid}`), {
                amount: 500,
                type: "credit",
                currency: 'PKR',
                description: "Signup Bonus",
                created_at: new Date().toISOString()
            });
        }
        if(modal) modal.style.display = 'none';
    } catch (err) { alert(err.message); }
};

if(document.getElementById('logout-btn')) {
    document.getElementById('logout-btn').onclick = () => { signOut(auth); if(modal) modal.style.display = 'none'; };
}

// --- Game Logic ---
if(document.getElementById('main-play-btn')) {
    document.getElementById('main-play-btn').onclick = async () => {
        if(!userAuth) { if(modal) modal.style.display = 'flex'; return; }
        
        const s = await get(ref(db, 'users/' + userAuth.uid));
        const userData = s.val();
        
        // Check PKR balance
        const currentPkr = (userData.wallet && userData.wallet.PKR !== undefined) ? userData.wallet.PKR : (userData.wallet_balance || 0);

        if(currentPkr < 75) return alert("Low Balance! Minimum PKR 75 required.");
        
        // Deduct 75 from PKR wallet
        await update(ref(db, `users/${userAuth.uid}/wallet`), { PKR: currentPkr - 75 });

        // LOG TRANSACTION: Game Bet
        await push(ref(db, `transactions/${userAuth.uid}`), {
            amount: 75,
            type: 'debit',
            currency: 'PKR',
            description: 'Card Game Bet Entry',
            created_at: new Date().toISOString()
        });
        
        document.getElementById('lobby-screen').classList.add('hidden');
        document.getElementById('game-board').classList.remove('hidden');
        prepareRound();
    };
}

function prepareRound() {
    isGameRunning = true;
    const shuffledNames = [...PAKISTANI_NAMES].sort(() => 0.5 - Math.random());
    for(let i=0; i<3; i++) {
        const nameEl = document.getElementById(`name-${i}`);
        const avEl = document.getElementById(`av-${i}`);
        if(nameEl) nameEl.innerText = shuffledNames[i];
        if(avEl) avEl.innerText = shuffledNames[i][0];
    }
    document.querySelectorAll('.card').forEach(c => c.classList.add('active'));
}

window.startSpinSequence = async (cardIdx) => {
    if(!isGameRunning) return;
    isGameRunning = false;
    document.querySelectorAll('.card').forEach(c => c.classList.remove('active'));

    const adminSnap = await get(ref(db, 'game_settings/next_winner'));
    const winnerType = adminSnap.val() || 'default';
    
    let winPos; // 0:Green, 1:Blue, 2:Yellow, 3:User
    if(winnerType === 'user') winPos = 3;
    else if(winnerType === 'cpu0') winPos = 0;
    else if(winnerType === 'cpu1') winPos = 1;
    else if(winnerType === 'cpu2') winPos = 2;
    else winPos = Math.floor(Math.random() * 3);

    // Spin
    let current = 0, loops = 0, max = 20 + winPos;
    let timer = setInterval(() => {
        document.querySelectorAll('.corner').forEach(c => c.classList.remove('spinning-now'));
        const currentCorner = document.getElementById(`corner-${current % 4}`);
        if(currentCorner) currentCorner.classList.add('spinning-now');
        current++; loops++;
        if(loops >= max) { clearInterval(timer); showFinalResult(winPos); }
    }, 100);
};

function showFinalResult(winnerPos) {
    const winCorner = document.getElementById(`corner-${winnerPos}`);
    if(winCorner) winCorner.classList.add('winner-active');
    
    const suits = [...cardSuits].sort(() => 0.5 - Math.random());
    document.querySelectorAll('.card').forEach((card, idx) => {
        const front = card.querySelector('.card-front');
        if(!front) return;
        const suit = suits[idx];
        front.className = `card-face card-front ${suit.color}`;
        front.querySelector('.suit-center').innerText = suit.s;
        
        if(idx === winnerPos) {
            front.querySelector('.suit-corner').innerText = "A\n" + suit.s;
            front.querySelector('.suit-bottom').innerText = "A\n" + suit.s;
        } else {
            const low = ["7","8","9"][Math.floor(Math.random()*3)];
            front.querySelector('.suit-corner').innerText = low + "\n" + suit.s;
            front.querySelector('.suit-bottom').innerText = low + "\n" + suit.s;
        }
        card.classList.add('flipped');
    });

    let name = "CPU";
    if(winnerPos === 3) {
        name = "YOU";
    } else {
        const nameEl = document.getElementById(`name-${winnerPos}`);
        if(nameEl) name = nameEl.innerText;
    }

    if(winnerPos === 3) rewardUser();

    setTimeout(() => {
        const winInfo = document.getElementById('winner-info');
        if(winInfo) winInfo.innerText = name + (winnerPos === 3 ? " WON PKR 1000!" : " WINS!");
        const resScreen = document.getElementById('result-screen');
        if(resScreen) resScreen.style.display = 'flex';
    }, 1500);
}

async function rewardUser() {
    if(!userAuth) return;
    const s = await get(ref(db, 'users/' + userAuth.uid));
    const userData = s.val();
    
    // Add 1000 to PKR wallet
    const currentPkr = (userData.wallet && userData.wallet.PKR !== undefined) ? userData.wallet.PKR : (userData.wallet_balance || 0);
    await update(ref(db, `users/${userAuth.uid}/wallet`), { PKR: currentPkr + 1000 });

    // LOG TRANSACTION: Game Win
    await push(ref(db, `transactions/${userAuth.uid}`), {
        amount: 1000,
        type: 'credit',
        currency: 'PKR',
        description: 'Card Game Win Reward',
        created_at: new Date().toISOString()
    });
}

window.backToLobby = () => {
    if(document.getElementById('result-screen')) document.getElementById('result-screen').style.display = 'none';
    if(document.getElementById('game-board')) document.getElementById('game-board').classList.add('hidden');
    if(document.getElementById('lobby-screen')) document.getElementById('lobby-screen').classList.remove('hidden');
    document.querySelectorAll('.card').forEach(c => c.classList.remove('flipped', 'active'));
    document.querySelectorAll('.corner').forEach(c => c.classList.remove('winner-active', 'spinning-now'));
};
