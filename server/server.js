// ============================================
// SPACE FRONTIER — Multiplayer Server
// Deploy on Render.com
// ============================================
const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const path = require('path');
const { randomUUID } = require('crypto');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

// Serve static files from the parent directory (index.html, online.js, images, models)
app.use(express.static(path.join(__dirname, '..')));

// CORS
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', '*');
    next();
});

// Health check for Render
app.get('/health', (req, res) => res.send('OK'));

// ============ Player Store ============
const players = new Map(); // id → { id, ws, x, y, z, rx, ry, rz, walking, character, level, lastSeen }

function broadcast(type, payload, excludeId = null) {
    const msg = JSON.stringify({ type, ...payload });
    for (const [id, player] of players) {
        if (id === excludeId) continue;
        if (player.ws.readyState === 1) {
            try { player.ws.send(msg); } catch {}
        }
    }
}

// ============ WebSocket Handler ============
wss.on('connection', (ws, req) => {
    const id = randomUUID();
    console.log(`[WS] New connection: ${id.slice(0, 8)}`);

    ws.on('message', (raw) => {
        let data;
        try { data = JSON.parse(raw.toString()); } catch { return; }

        // ============ JOIN ============
        if (data.type === 'join') {
            const player = {
                id,
                ws,
                x: 0, y: 0, z: 0,
                rx: 0, ry: 0, rz: 0,
                walking: false,
                character: 'PLAYER1',
                level: 0,
                lastSeen: Date.now()
            };
            players.set(id, player);

            // Welcome the new player
            ws.send(JSON.stringify({ type: 'welcome', id }));

            // Send all existing players
            const others = [];
            for (const [pid, p] of players) {
                if (pid === id) continue;
                others.push({
                    id: p.id,
                    x: p.x, y: p.y, z: p.z,
                    rx: p.rx, ry: p.ry, rz: p.rz,
                    walking: p.walking,
                    character: p.character,
                    level: p.level
                });
            }
            ws.send(JSON.stringify({ type: 'players', players: others }));

            // Notify others
            broadcast('player_joined', {
                player: {
                    id,
                    x: 0, y: 0, z: 0,
                    rx: 0, ry: 0, rz: 0,
                    walking: false,
                    character: 'PLAYER1',
                    level: 0
                }
            }, id);

            console.log(`[JOIN] ${id.slice(0, 8)} | total players: ${players.size}`);
        }

        // ============ MOVE UPDATE ============
        else if (data.type === 'move') {
            const player = players.get(id);
            if (!player) return;

            player.x = Number(data.x) || 0;
            player.y = Number(data.y) || 0;
            player.z = Number(data.z) || 0;
            player.rx = Number(data.rx) || 0;
            player.ry = Number(data.ry) || 0;
            player.rz = Number(data.rz) || 0;
            player.walking = !!data.walking;
            player.character = data.character || 'PLAYER1';
            player.level = Number(data.level) || 0;
            player.lastSeen = Date.now();

            broadcast('player_update', {
                player: {
                    id,
                    x: player.x, y: player.y, z: player.z,
                    rx: player.rx, ry: player.ry, rz: player.rz,
                    walking: player.walking,
                    character: player.character,
                    level: player.level
                }
            }, id);
        }

        // ============ PING ============
        else if (data.type === 'ping') {
            const player = players.get(id);
            if (player) player.lastSeen = Date.now();
            ws.send(JSON.stringify({ type: 'pong' }));
        }

        // ============ HIT EVENT (PvP) ============
        else if (data.type === 'hit') {
            const target = players.get(data.target);
            if (!target) return;
            const shooter = players.get(id);
            if (!shooter) return;

            const damage = Number(data.damage) || 15;

            // ابعت للهدف إنه اتضرب
            if (target.ws.readyState === 1) {
                target.ws.send(JSON.stringify({
                    type: 'hit',
                    from: id,
                    damage: damage
                }));
            }

            console.log(`[HIT] ${id.slice(0,6)} → ${data.target.slice(0,6)} (${damage} dmg)`);
        }
    });

    ws.on('close', () => {
        if (players.has(id)) {
            players.delete(id);
            broadcast('player_left', { id });
            console.log(`[LEFT] ${id.slice(0, 8)} | total players: ${players.size}`);
        }
    });

    ws.on('error', (err) => {
        console.error(`[WS ERROR] ${id.slice(0, 8)}:`, err.message);
    });
});

// ============ Cleanup Stale Players ============
setInterval(() => {
    const now = Date.now();
    for (const [id, p] of players) {
        if (now - p.lastSeen > 60000) {
            try { p.ws.close(); } catch {}
            players.delete(id);
            broadcast('player_left', { id });
            console.log(`[TIMEOUT] ${id.slice(0, 8)}`);
        }
    }
}, 30000);

// ============ Start Server ============
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`✅ SPACE FRONTIER server running on port ${PORT}`);
    console.log(`   WebSocket: /ws`);
});