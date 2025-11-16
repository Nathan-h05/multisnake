import { io } from "socket.io-client";

// Default connection. If you want teammates to paste a different URL, replace this
// or implement a small connect helper. For now we export the socket so the game can
// emit its state and listen for other players.
const socket = io("http://localhost:3000");

socket.on("pong", () => {
  console.log("Received pong from server!");
});

export default socket;
