// Setup socket.io handlers for real-time events
export default (io) => {
  io.on("connection", (socket) => {
    console.log("Socket connected:", socket.id);

    // Client should send 'authenticate' with userId to attach userId to socket
    socket.on("authenticate", (userId) => {
      socket.data.userId = userId;
      console.log(`Socket ${socket.id} authenticated as ${userId}`);
    });

    // join one-to-one conversation room
    socket.on("join_conversation", (conversationId) => {
      socket.join(conversationId);
    });

    // join group room: prefix group_ for uniqueness
    socket.on("join_group", (groupId) => {
      socket.join(`group_${groupId}`);
    });

    socket.on("leave_group", (groupId) => {
      socket.leave(`group_${groupId}`);
    });

    socket.on("typing", ({ conversationId, groupId, typing }) => {
      if (groupId) {
        socket.to(`group_${groupId}`).emit("typing", { groupId, user: socket.data.userId, typing });
      } else if (conversationId) {
        socket.to(conversationId).emit("typing", { conversationId, user: socket.data.userId, typing });
      }
    });

    socket.on("mark_read", ({ messageId, conversationId, groupId }) => {
      // Optionally server can track read receipts here, or client calls API to update
      if (groupId) {
        socket.to(`group_${groupId}`).emit("message_read", { messageId, user: socket.data.userId });
      } else if (conversationId) {
        socket.to(conversationId).emit("message_read", { messageId, user: socket.data.userId });
      }
    });

    socket.on("disconnect", () => {
      console.log("Socket disconnected:", socket.id);
    });
  });
};
