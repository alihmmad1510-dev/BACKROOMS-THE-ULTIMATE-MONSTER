// ============================================
// SPACE FRONTIER — Online Multiplayer Client
// v2.0 — يدعم نظام الركوب
// ============================================
export function createOnlineClient(serverUrl, callbacks = {}) {
    let url = serverUrl.trim().replace(/\/+$/, '');
    url = url.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:');
    if (!url.endsWith('/ws')) url += '/ws';

    let ws = null;
    let reconnectTimer = null;
    let heartbeatTimer = null;
    let intentionallyClosed = false;
    let reconnectAttempts = 0;
    const maxReconnects = 10;

    const state = { id: null, connected: false, sendQueue: [] };

    function connect() {
        try { ws = new WebSocket(url); }
        catch (err) { console.error('[ONLINE] WebSocket create failed:', err); scheduleReconnect(); return; }

        ws.onopen = () => {
            reconnectAttempts = 0;
            state.connected = true;
            console.log('[ONLINE] Connected to', url);
            ws.send(JSON.stringify({ type: 'join' }));
            while (state.sendQueue.length > 0) ws.send(state.sendQueue.shift());
            clearInterval(heartbeatTimer);
            heartbeatTimer = setInterval(() => {
                if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type: 'ping' }));
            }, 15000);
        };

        ws.onmessage = (event) => {
            let data;
            try { data = JSON.parse(event.data); } catch { return; }

            switch (data.type) {
                case 'welcome':
                    state.id = data.id;
                    if (callbacks.onConnected) callbacks.onConnected(data.id);
                    break;
                case 'players':
                    if (data.players && callbacks.onPlayerUpdate) data.players.forEach(p => callbacks.onPlayerUpdate(p));
                    break;
                case 'player_joined':
                case 'player_update':
                    if (data.player && callbacks.onPlayerUpdate) callbacks.onPlayerUpdate(data.player);
                    break;
                case 'player_left':
                    if (data.id && callbacks.onPlayerLeft) callbacks.onPlayerLeft(data.id);
                    break;
                case 'hit':
                    if (callbacks.onHit) callbacks.onHit({ from: data.from, damage: data.damage });
                    break;
                case 'ride':
                    if (callbacks.onRide) callbacks.onRide({ from: data.from, target: data.target, action: data.action });
                    break;
                case 'pong':
                    break;
            }
        };

        ws.onclose = () => {
            state.connected = false;
            clearInterval(heartbeatTimer);
            if (callbacks.onDisconnected) callbacks.onDisconnected();
            if (!intentionallyClosed && reconnectAttempts < maxReconnects) scheduleReconnect();
        };

        ws.onerror = () => console.error('[ONLINE] WebSocket error');
    }

    function scheduleReconnect() {
        reconnectAttempts++;
        const delay = Math.min(3000 * reconnectAttempts, 15000);
        clearTimeout(reconnectTimer);
        reconnectTimer = setTimeout(connect, delay);
    }

    connect();

    return {
        get id() { return state.id; },
        get connected() { return state.connected; },
        send(data) {
            const payload = JSON.stringify({ type: 'move', ...data });
            if (ws && ws.readyState === 1) ws.send(payload);
            else if (state.sendQueue.length < 20) state.sendQueue.push(payload);
        },
        sendRaw(data) {
            const payload = JSON.stringify(data);
            if (ws && ws.readyState === 1) ws.send(payload);
            else if (state.sendQueue.length < 20) state.sendQueue.push(payload);
        },
        requestRide(targetId) {
            const payload = JSON.stringify({ type: 'ride', target: targetId, action: 'join', from: state.id });
            if (ws && ws.readyState === 1) ws.send(payload);
        },
        leaveRide(targetId) {
            const payload = JSON.stringify({ type: 'ride', target: targetId, action: 'leave', from: state.id });
            if (ws && ws.readyState === 1) ws.send(payload);
        },
        disconnect() {
            intentionallyClosed = true;
            clearTimeout(reconnectTimer);
            clearInterval(heartbeatTimer);
            if (ws) try { ws.close(); } catch {}
        }
    };
}