// SPACE FRONTIER 3D - Multiplayer client
// This file is imported by index.html.
// It loads Socket.IO in the browser and exposes a small multiplayer API.

let socketIoPromise=null;

function loadSocketIO(){
    if(window.io) return Promise.resolve(window.io);
    if(socketIoPromise) return socketIoPromise;

    socketIoPromise=new Promise((resolve,reject)=>{
        const script=document.createElement("script");
        script.src="https://cdn.socket.io/4.8.1/socket.io.min.js";
        script.async=true;
        script.onload=()=>{
            if(window.io) resolve(window.io);
            else reject(new Error("Socket.IO loaded but window.io is missing"));
        };
        script.onerror=()=>reject(new Error("Could not load Socket.IO client"));
        document.head.appendChild(script);
    });

    return socketIoPromise;
}

export async function createOnlineClient(serverUrl, callbacks={}){
    const io=await loadSocketIO();

    const cleanUrl=String(serverUrl||"").replace(/\/+$/,"");
    if(!cleanUrl) throw new Error("Missing multiplayer server URL");

    const socket=io(cleanUrl,{
        transports:["websocket","polling"],
        reconnection:true,
        reconnectionAttempts:8,
        timeout:8000
    });

    const client={
        id:null,
        socket,
        send(data){
            if(socket.connected) socket.emit("playerUpdate",data);
        },
        disconnect(){
            socket.disconnect();
        }
    };

    socket.on("connect",()=>{
        client.id=socket.id;
        callbacks.onConnected?.(socket.id);
    });

    socket.on("worldState",(players)=>{
        if(Array.isArray(players)){
            players.forEach(p=>callbacks.onPlayerUpdate?.(p));
        }
    });

    socket.on("playerJoined",(player)=>{
        callbacks.onPlayerJoined?.(player);
    });

    socket.on("playerUpdate",(player)=>{
        callbacks.onPlayerUpdate?.(player);
    });

    socket.on("playerLeft",(id)=>{
        callbacks.onPlayerLeft?.(id);
    });

    socket.on("disconnect",()=>{
        callbacks.onDisconnected?.();
    });

    socket.on("connect_error",(error)=>{
        console.warn("Socket.IO connection error:",error.message);
    });

    return client;
}
