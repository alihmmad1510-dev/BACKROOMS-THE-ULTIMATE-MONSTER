// server/server.js
const http = require("http");
const { WebSocketServer } = require("ws");

const PORT = process.env.PORT || 10000;
const rooms = new Map();

const httpServer = http.createServer((req, res) => {
    res.writeHead(200, {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
    });

    res.end(JSON.stringify({
        game: "BACKROOMS THE ULTIMATE MONSTER",
        online: true,
        rooms: rooms.size
    }));
});

const wss = new WebSocketServer({
    server: httpServer
});

function send(ws, data) {
    if (ws.readyState === 1) {
        ws.send(JSON.stringify(data));
    }
}

function broadcast(room, data, except = null) {
    for (const player of room.players.values()) {
        if (player.ws !== except) {
            send(player.ws, data);
        }
    }
}

function createRoomCode() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code;

    do {
        code = "";

        for (let i = 0; i < 5; i++) {
            code += chars[
                Math.floor(Math.random() * chars.length)
            ];
        }
    } while (rooms.has(code));

    return code;
}

function createPlayerId() {
    return Math.random()
        .toString(36)
        .substring(2, 10);
}

function getPlayers(room) {
    return [...room.players.values()].map(player => ({
        id: player.id,
        name: player.name,
        character: player.character,
        x: player.x,
        y: player.y,
        z: player.z,
        rotationY: player.rotationY
    }));
}

wss.on("connection", ws => {

    const player = {
        ws,
        id: createPlayerId(),
        room: null,
        name: "Player",
        character: "PLAYER1",

        x: 0,
        y: 1.7,
        z: 5,

        rotationY: 0
    };

    send(ws, {
        type: "connected",
        id: player.id
    });

    ws.on("message", raw => {

        let data;

        try {
            data = JSON.parse(raw.toString());
        } catch {
            return;
        }

        // CREATE ROOM
        if (data.type === "CREATE_ROOM") {

            if (player.room) return;

            const code = createRoomCode();

            const room = {
                code,
                level: 0,
                players: new Map()
            };

            rooms.set(code, room);

            player.room = code;
            player.name =
                String(data.name || "Player 1")
                .substring(0, 20);

            player.character =
                data.character === "PLAYER2"
                    ? "PLAYER2"
                    : "PLAYER1";

            room.players.set(player.id, player);

            send(ws, {
                type: "ROOM_CREATED",
                room: code,
                id: player.id,
                players: getPlayers(room)
            });

            return;
        }

        // JOIN ROOM
        if (data.type === "JOIN_ROOM") {

            if (player.room) return;

            const code =
                String(data.room || "")
                .trim()
                .toUpperCase();

            const room = rooms.get(code);

            if (!room) {

                send(ws, {
                    type: "ERROR",
                    message: "ROOM NOT FOUND"
                });

                return;
            }

            if (room.players.size >= 2) {

                send(ws, {
                    type: "ERROR",
                    message: "ROOM IS FULL"
                });

                return;
            }

            player.room = code;

            player.name =
                String(data.name || "Player 2")
                .substring(0, 20);

            player.character =
                data.character === "PLAYER1"
                    ? "PLAYER1"
                    : "PLAYER2";

            room.players.set(
                player.id,
                player
            );

            send(ws, {
                type: "ROOM_JOINED",
                room: code,
                id: player.id,
                players: getPlayers(room)
            });

            broadcast(room, {
                type: "PLAYERS",
                players: getPlayers(room)
            });

            return;
        }

        // PLAYER POSITION
        if (data.type === "PLAYER_STATE") {

            if (!player.room) return;

            const room =
                rooms.get(player.room);

            if (!room) return;

            player.x =
                Number(data.x) || 0;

            player.y =
                Number(data.y) || 1.7;

            player.z =
                Number(data.z) || 5;

            player.rotationY =
                Number(data.rotationY) || 0;

            broadcast(
                room,
                {
                    type: "REMOTE_PLAYER",
                    player: {
                        id: player.id,
                        name: player.name,
                        character: player.character,
                        x: player.x,
                        y: player.y,
                        z: player.z,
                        rotationY: player.rotationY
                    }
                },
                ws
            );

            return;
        }

        // START GAME
        if (data.type === "START_GAME") {

            if (!player.room) return;

            const room =
                rooms.get(player.room);

            if (!room) return;

            room.level =
                Number(data.level) || 0;

            broadcast(room, {
                type: "GAME_START",
                level: room.level
            });

            return;
        }
    });

    ws.on("close", () => {

        if (!player.room) return;

        const room =
            rooms.get(player.room);

        if (!room) return;

        room.players.delete(player.id);

        broadcast(room, {
            type: "PLAYER_LEFT",
            id: player.id,
            players: getPlayers(room)
        });

        if (room.players.size === 0) {
            rooms.delete(room.code);
        }
    });
});

httpServer.listen(
    PORT,
    "0.0.0.0",
    () => {
        console.log(
            `BACKROOMS ONLINE SERVER: ${PORT}`
        );
    }
);