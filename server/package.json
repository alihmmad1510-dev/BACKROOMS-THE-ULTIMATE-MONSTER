const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;
const players = new Map();

app.get("/", (req, res) => {
  res.json({
    game: "SPACE FRONTIER 3D",
    online: true,
    players: players.size,
    status: "Multiplayer server is running"
  });
});

io.on("connection", (socket) => {
  const player = {
    id: socket.id,
    x: 0,
    y: 0,
    z: 0,
    rx: 0,
    ry: 0,
    rz: 0,
    character: "PLAYER1",
    level: 0
  };

  players.set(socket.id, player);

  socket.emit("worldState", Array.from(players.values()));
  socket.broadcast.emit("playerJoined", player);

  socket.on("playerUpdate", (data) => {
    const current = players.get(socket.id);
    if (!current || !data || typeof data !== "object") return;

    const n = (value, fallback = 0) => {
      const v = Number(value);
      return Number.isFinite(v) ? v : fallback;
    };

    current.x = n(data.x);
    current.y = n(data.y);
    current.z = n(data.z);
    current.rx = n(data.rx);
    current.ry = n(data.ry);
    current.rz = n(data.rz);

    if (typeof data.character === "string") {
      current.character = data.character.slice(0, 32);
    }

    current.level = Math.max(0, Math.floor(n(data.level)));

    socket.broadcast.emit("playerUpdate", current);
  });

  socket.on("disconnect", () => {
    players.delete(socket.id);
    socket.broadcast.emit("playerLeft", socket.id);
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`SPACE FRONTIER 3D multiplayer server listening on port ${PORT}`);
});
