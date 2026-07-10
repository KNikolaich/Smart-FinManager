import type { Server as HttpServer } from "http";
import { Server } from "socket.io";

let io: Server;

export function initSocket(httpServer: HttpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  io.on("connection", (socket) => {
    console.log("A user connected:", socket.id);

    socket.on("join", (userId) => {
      if (userId) {
        socket.join(`user:${userId}`);
        console.log(`User ${userId} joined their room`);
      }
    });

    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.id);
    });
  });

  return io;
}

export const notifyUser = (userId: string, event: string, data: any) => {
  io.to(`user:${userId}`).emit(event, data);
};
