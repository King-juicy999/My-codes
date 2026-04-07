// PHASE 1 ONLY — move to backend in Phase 2
const ANTHROPIC_KEY = 'your-anthropic-api-key-here';

document.addEventListener('DOMContentLoaded', () => {
    // Check if consent already given
    if (localStorage.getItem('lumina-consent')) {
        showMainApp();
    } else {
        showConsent();
    }

    // Initialize
    updateGreeting();
    loadJournalEntries();
    initChat();

    // Event listeners
    document.getElementById('enter-lumina').addEventListener('click', handleConsent);
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => showTab(e.target.dataset.tab));
    });
    document.querySelectorAll('.mood-btn').forEach(btn => {
        btn.addEventListener('click', (e) => selectMood(e.target.dataset.mood));
    });
    document.querySelectorAll('[data-action]').forEach(el => {
        el.addEventListener('click', (e) => handleAction(e.target.closest('[data-action]').dataset.action));
    });
    document.getElementById('send-btn').addEventListener('click', sendMessage);
    document.getElementById('chat-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    document.getElementById('begin-btn').addEventListener('click', startBreathing);
    document.getElementById('pause-btn').addEventListener('click', pauseBreathing);
    document.getElementById('reset-btn').addEventListener('click', resetBreathing);
    document.querySelectorAll('.pattern-card').forEach(card => {
        card.addEventListener('click', (e) => selectPattern(e.target.closest('.pattern-card').dataset.pattern));
    });
    document.getElementById('new-prompt').addEventListener('click', newPrompt);
    document.getElementById('journal-text').addEventListener('input', updateWordCount);
    document.getElementById('save-entry').addEventListener('click', saveEntry);
});

function showConsent() {
    document.getElementById('consent-screen').classList.remove('hidden');
    document.getElementById('main-app').classList.add('hidden');
}

function showMainApp() {
    document.getElementById('consent-screen').classList.add('hidden');
    document.getElementById('main-app').classList.remove('hidden');
}

function handleConsent() {
    const consent = {
        personalize: document.getElementById('personalize').checked,
        contribute: document.getElementById('contribute').checked,
        reminders: document.getElementById('reminders').checked
    };
    localStorage.setItem('lumina-consent', JSON.stringify(consent));
    showMainApp();
}

function showTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.add('hidden'));
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`${tabName}-tab`).classList.remove('hidden');
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
}

function updateGreeting() {
    const hour = new Date().getHours();
    let greeting = 'Good evening';
    if (hour < 12) greeting = 'Good morning';
    else if (hour < 18) greeting = 'Good afternoon';
    document.getElementById('greeting').textContent = greeting;
}

function selectMood(mood) {
    document.querySelectorAll('.mood-btn').forEach(btn => btn.classList.remove('selected'));
    document.querySelector(`[data-mood="${mood}"]`).classList.add('selected');
    const moodData = { mood, timestamp: new Date().toISOString() };
    localStorage.setItem('lumina-mood', JSON.stringify(moodData));
}

function handleAction(action) {
    if (action === 'talk' || action === 'write') {
        showTab(action === 'talk' ? 'talk' : 'journal');
    } else {
        showTab(action);
    }
}

// Chat functionality
let chatMessages = [
    { role: 'assistant', content: "I'm here with you, fully present. Whatever you're carrying — I'd like to understand. What would you like to share today?" }
];

function initChat() {
    renderMessages();
}

function renderMessages() {
    const container = document.getElementById('chat-messages');
    container.innerHTML = '';
    chatMessages.forEach(msg => {
        const div = document.createElement('div');
        div.className = `message ${msg.role === 'user' ? 'user' : 'bot'}`;
        div.innerHTML = `<div class="bubble">${msg.content}</div>`;
        container.appendChild(div);
    });
    container.scrollTop = container.scrollHeight;
}

async function sendMessage() {
    const input = document.getElementById('chat-input');
    const content = input.value.trim();
    if (!content) return;

    chatMessages.push({ role: 'user', content });
    renderMessages();
    input.value = '';

    // Show typing indicator
    document.getElementById('typing-indicator').classList.remove('hidden');

    try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': ANTHROPIC_KEY,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: 'claude-sonnet-4-20250514',
                max_tokens: 1000,
                system: "You are Lumina, a deeply empathetic, emotionally intelligent wellness companion. You specialise in supporting people through depression, anxiety, grief, and emotional difficulty. Your voice is warm, poetic, and unhurried — like a wise and trusted confidant. You never sound clinical or robotic. Your approach: listen first, validate always, never minimise. Reflect feelings back with nuance before offering advice. Ask one thoughtful open-ended follow-up question at a time. Offer gentle coping strategies only when the person seems ready. Encourage professional support warmly, never abruptly. CRITICAL: If someone expresses suicidal thoughts or immediate danger, respond with deep compassion and immediately direct them to findahelpline.com and local emergency services. Keep responses warm and measured: 2 to 4 sentences. Never diagnose. Never prescribe. Never be clinical.",
                messages: chatMessages.map(msg => ({ role: msg.role, content: msg.content }))
            })
        });

        const data = await response.json();
        const aiMessage = data.content[0].text;
        chatMessages.push({ role: 'assistant', content: aiMessage });
        renderMessages();
    } catch (error) {
        console.error('Error:', error);
        chatMessages.push({ role: 'assistant', content: 'I\'m sorry, I\'m having trouble connecting right now. Please try again.' });
        renderMessages();
    }

    document.getElementById('typing-indicator').classList.add('hidden');
}

// Breathing functionality
let breathingInterval;
let currentPhase = 'ready';
let cycleCount = 0;
let patterns = {
    box: { inhale: 4, hold: 4, exhale: 4 },
    deep: { inhale: 4, hold: 7, exhale: 8 },
    simple: { inhale: 5, hold: 0, exhale: 5 }
};
let currentPattern = 'box';

function selectPattern(pattern) {
    document.querySelectorAll('.pattern-card').forEach(card => card.classList.remove('active'));
    document.querySelector(`[data-pattern="${pattern}"]`).classList.add('active');
    currentPattern = pattern;
}

function startBreathing() {
    if (breathingInterval) return;
    document.getElementById('begin-btn').classList.add('hidden');
    document.getElementById('pause-btn').classList.remove('hidden');
    runBreathingCycle();
}

function pauseBreathing() {
    clearInterval(breathingInterval);
    breathingInterval = null;
    document.getElementById('begin-btn').classList.remove('hidden');
    document.getElementById('pause-btn').classList.add('hidden');
    document.getElementById('phase-label').textContent = 'Paused';
}

function resetBreathing() {
    clearInterval(breathingInterval);
    breathingInterval = null;
    currentPhase = 'ready';
    cycleCount = 0;
    document.querySelector('.breathe-circle').style.transform = 'scale(1)';
    document.getElementById('phase-label').textContent = 'Ready';
    document.getElementById('hint-text').textContent = 'Tap begin to start';
    document.getElementById('begin-btn').classList.remove('hidden');
    document.getElementById('pause-btn').classList.add('hidden');
}

function runBreathingCycle() {
    const pattern = patterns[currentPattern];
    let phaseIndex = 0;
    const phases = ['inhale', 'hold', 'exhale'];

    function nextPhase() {
        if (phaseIndex >= phases.length) {
            cycleCount++;
            phaseIndex = 0;
        }

        currentPhase = phases[phaseIndex];
        const duration = pattern[currentPhase];

        if (duration === 0) {
            phaseIndex++;
            nextPhase();
            return;
        }

        document.getElementById('phase-label').textContent = currentPhase.charAt(0).toUpperCase() + currentPhase.slice(1);
        document.getElementById('hint-text').textContent = `${duration} seconds • Cycle ${cycleCount + 1}`;

        const circle = document.querySelector('.breathe-circle');
        if (currentPhase === 'inhale') {
            circle.style.transform = 'scale(1.5)';
        } else if (currentPhase === 'hold') {
            // Keep scale
        } else {
            circle.style.transform = 'scale(1)';
        }

        setTimeout(() => {
            phaseIndex++;
            nextPhase();
        }, duration * 1000);
    }

    nextPhase();
}

// Journal functionality
const prompts = [
    "What made you smile today?",
    "What are you grateful for?",
    "Describe a moment of peace.",
    "What challenged you today?",
    "What are you looking forward to?",
    "How did you show kindness to yourself?",
    "What would you tell your younger self?"
];
let currentPromptIndex = 0;

function newPrompt() {
    currentPromptIndex = (currentPromptIndex + 1) % prompts.length;
    document.getElementById('journal-prompt').textContent = prompts[currentPromptIndex];
}

function updateWordCount() {
    const text = document.getElementById('journal-text').value;
    const words = text.trim().split(/\s+/).filter(word => word.length > 0).length;
    document.getElementById('word-count').textContent = `${words} words`;
}

function saveEntry() {
    const text = document.getElementById('journal-text').value.trim();
    if (!text) return;

    const entry = {
        text,
        prompt: prompts[currentPromptIndex],
        date: new Date().toLocaleDateString(),
        timestamp: new Date().toISOString(),
        words: text.split(/\s+/).filter(word => word.length > 0).length
    };

    const entries = JSON.parse(localStorage.getItem('lumina-entries') || '[]');
    entries.unshift(entry);
    localStorage.setItem('lumina-entries', JSON.stringify(entries));

    document.getElementById('journal-text').value = '';
    updateWordCount();
    loadJournalEntries();
}

function loadJournalEntries() {
    const entries = JSON.parse(localStorage.getItem('lumina-entries') || '[]');
    const container = document.getElementById('saved-entries');
    const entriesDiv = container.querySelector('.entries') || document.createElement('div');
    entriesDiv.className = 'entries';
    entriesDiv.innerHTML = '';

    entries.slice(0, 4).forEach(entry => {
        const card = document.createElement('div');
        card.className = 'entry-card';
        card.innerHTML = `
            <div class="entry-date">${entry.date}</div>
            <div class="entry-preview">${entry.text.substring(0, 100)}${entry.text.length > 100 ? '...' : ''}</div>
        `;
        entriesDiv.appendChild(card);
    });

    if (!container.querySelector('.entries')) {
        container.appendChild(entriesDiv);
    }
}