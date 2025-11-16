import { io } from "socket.io-client";

// export const socket = io("http://localhost:3000");
const socket = io("http://206.87.151.12:3000");


socket.on("pong", () => {
  console.log("Received pong from server!");
});
