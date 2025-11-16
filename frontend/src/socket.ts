import { io } from "socket.io-client";

// export const socket = io("http://localhost:3000");
const socket = io("http://10.43.195.170:3000");


socket.on("pong", () => {
  console.log("Received pong from server!");
});
