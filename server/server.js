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

app.get("/", (req, res) => {
  res.send("BACKROOMS THE ULTIMATE MONSTER ONLINE SERVER");
});

const rooms = new Map();

io.on("connection", (socket) => {

  console.log("CONNECTED:", socket.id);

  socket.on("joinRoom", (data) => {

    const name = String(data?.name || "Player").slice(0, 18);
    const room = String(data?.room || "ROOM-1").slice(0, 18);
    const character = Number(data?.character) === 2 ? 2 : 1;

    socket.join(room);

    socket.data.room = room;
    socket.data.name = name;

    if (!rooms.has(room)) {
      rooms.set(room, new Map());
    }

    const roomPlayers = rooms.get(room);

    const player = {
      id: socket.id,
      name,
      room,
      character,
      x: 0,
      y: 0,
      z: 4,
      rotationY: 0
    };

    roomPlayers.set(socket.id, player);

    socket.emit(
      "roomPlayers",
      [...roomPlayers.values()]
    );

    socket.to(room).emit(
      "playerJoined",
      player
    );

    console.log(name, "joined", room);
  });

  socket.on("updatePlayer", (data) => {

    const room = socket.data.room;

    if (!room || !rooms.has(room)) return;

    const roomPlayers = rooms.get(room);
    const player = roomPlayers.get(socket.id);

    if (!player) return;

    player.x = Number(data?.x) || 0;
    player.y = Number(data?.y) || 0;
    player.z = Number(data?.z) || 0;
    player.rotationY = Number(data?.rotationY) || 0;

    if (Number(data?.character) === 2) {
      player.character = 2;
    } else {
      player.character = 1;
    }

    socket.to(room).emit(
      "playerUpdated",
      player
    );
  });

  socket.on("disconnect", () => {

    const room = socket.data.room;

    if (room && rooms.has(room)) {

      const roomPlayers = rooms.get(room);

      roomPlayers.delete(socket.id);

      socket.to(room).emit(
        "playerLeft",
        socket.id
      );

      if (roomPlayers.size === 0) {
        rooms.delete(room);
      }
    }

    console.log("DISCONNECTED:", socket.id);
  });

});

const PORT = process.env.PORT || 3000;

server.listen(PORT, "0.0.0.0", () => {
  console.log(
    `BACKROOMS SERVER RUNNING ON PORT ${PORT}`
  );
});