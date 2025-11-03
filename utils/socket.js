const mongoose = require("mongoose");
const User = require("../models/User");
const Message = require("../models/Message");
const Conversation = require("../models/Conversation");
const { fetchUserConversations } = require("../controllers/chatController");

module.exports = function (io) {
  io.on("connection", (socket) => {
    console.log(`🔗 User connected: ${socket.id}`);

    // ✅ REGISTER USER
    socket.on("register", async (userId) => {
      try {
        socket.userId = userId;
        socket.join(userId);
        console.log(`✅ User ${userId} joined their personal room`);

        // Mark user online
        await User.findByIdAndUpdate(userId, { isOnline: true, lastSeen: null });

        // Fetch and send user's conversation list
        const myConvList = await fetchUserConversations(userId);
        io.to(userId).emit("conversationList", myConvList);

        // 🔔 Send unread message summary
        const unreadMessages = await Message.find({
          receiverId: userId,
          isRead: false,
        }).select("conversationId");

        const unreadCount = unreadMessages.length;
        const unreadByConversation = unreadMessages.reduce((acc, msg) => {
          const convId = msg.conversationId.toString();
          acc[convId] = (acc[convId] || 0) + 1;
          return acc;
        }, {});

        io.to(userId).emit("unreadCount", {
          totalUnread: unreadCount,
          byConversation: unreadByConversation,
        });

        console.log(`🔔 Sent unread count (${unreadCount}) to user ${userId}`);
      } catch (err) {
        console.error("❌ Register error:", err.message);
      }
    });

    // ✅ JOIN CONVERSATION
    socket.on("joinConversation", (conversationId) => {
      socket.join(conversationId);
      socket.currentConversation = conversationId;
      console.log(`✅ User joined conversation ${conversationId}`);
    });

// ✅ Send message
socket.on("sendMessage", async (data, callback) => {
  try {
    const { conversationId, senderId, receiverId, text, fileUrl, replyTo } = data;

    let conversation = conversationId
      ? await Conversation.findById(conversationId)
      : await Conversation.findOne({
          participants: { $all: [senderId, receiverId], $size: 2 },
        });

    // 🔹 Create conversation if not found
    if (!conversation) {
      conversation = await Conversation.create({
        participants: [senderId, receiverId],
        isGroup: false,
      });

      // Notify both users of new conversation
      for (const uid of [senderId, receiverId]) {
        const convList = await fetchUserConversations(uid);
        io.to(uid.toString()).emit("conversationList", convList);
      }
    }

    // 🔹 Create message
    const message = await Message.create({
      conversationId: conversation._id,
      sender: senderId,
      receiverId,
      text,
      fileUrl,
      replyTo,
      isRead: false,
    });

    await message.populate("sender", "name email avatar");

    // Send message to conversation room
    io.to(conversation._id.toString()).emit("newMessage", message);

    // 🔹 Update unread count for receiver (ALWAYS)
    const unreadMessages = await Message.find({
      receiverId,
      isRead: false,
    }).select("_id conversationId");

    const unreadCount = unreadMessages.length;
    const unreadByConversation = unreadMessages.reduce((acc, msg) => {
      const convId = msg.conversationId.toString();
      acc[convId] = (acc[convId] || 0) + 1;
      return acc;
    }, {});

    io.to(receiverId.toString()).emit("unreadCount", {
      totalUnread: unreadCount,
      byConversation: unreadByConversation,
    });

    console.log(`📩 Unread count updated for receiver ${receiverId}: ${unreadCount}`);

    // 🔹 Refresh both conversation lists
    for (const p of conversation.participants) {
      const convList = await fetchUserConversations(p.toString());
      io.to(p.toString()).emit("conversationList", convList);
    }

    if (callback) callback({ success: true, message });
  } catch (err) {
    console.error("❌ sendMessage error:", err.message);
    if (callback) callback({ success: false, error: err.message });
  }
});
// ✅ Get conversation messages
socket.on("getMessages", async ({ conversationId }, callback) => {
  try {
    if (!conversationId) {
      if (callback) callback({ success: false, error: "conversationId is required" });
      return;
    }

    // Fetch all messages in the conversation (latest first)
    const messages = await Message.find({ conversationId })
      .populate("sender", "name email avatar")
      .sort({ createdAt: 1 }); // oldest → newest (change to -1 if you want reverse)

    // Mark all messages as read for this user (if logged-in user is a participant)
    if (socket.userId) {
      await Message.updateMany(
        { conversationId, receiverId: socket.userId, isRead: false },
        { $set: { isRead: true } }
      );

      // 🔹 Update unread count after marking as read
      const unreadMessages = await Message.find({
        receiverId: socket.userId,
        isRead: false,
      }).select("_id conversationId");

      const unreadCount = unreadMessages.length;
      const unreadByConversation = unreadMessages.reduce((acc, msg) => {
        const convId = msg.conversationId.toString();
        acc[convId] = (acc[convId] || 0) + 1;
        return acc;
      }, {});

      io.to(socket.userId.toString()).emit("unreadCount", {
        totalUnread: unreadCount,
        byConversation: unreadByConversation,
      });
    }

    if (callback) callback({ success: true, messages });
  } catch (err) {
    console.error("❌ getConversationMessages error:", err.message);
    if (callback) callback({ success: false, error: err.message });
  }
});


    // ✅ MARK AS READ
    socket.on("markAsRead", async ({ conversationId, userId }) => {
      try {
        await Message.updateMany(
          { conversationId, receiverId: userId, isRead: false },
          { $set: { isRead: true } }
        );

        const unreadCount = await Message.countDocuments({
          receiverId: userId,
          isRead: false,
        });

        io.to(userId).emit("unreadCountUpdated", unreadCount);
        console.log(`📭 User ${userId} marked conversation ${conversationId} as read`);
      } catch (err) {
        console.error("❌ markAsRead error:", err.message);
      }
    });

    // ✅ CREATE GROUP
    socket.on("createGroup", async ({ name, participants, createdBy }, callback) => {
      try {
        const group = await Conversation.create({
          name,
          participants,
          isGroup: true,
          createdBy,
        });

        for (const p of participants) {
          const convList = await fetchUserConversations(p);
          io.to(p.toString()).emit("conversationList", convList);
          io.to(p).emit("groupCreated", group);
        }

        if (callback) callback({ success: true, group });
      } catch (err) {
        console.error("❌ createGroup error:", err.message);
        if (callback) callback({ success: false, error: err.message });
      }
    });

    // ✅ TYPING
    socket.on("typing", ({ conversationId, senderId }) => {
      socket.to(conversationId).emit("typing", { senderId });
    });

    // ✅ DISCONNECT
    socket.on("disconnect", async () => {
      if (!socket.userId) {
        console.log(`❌ Socket disconnected without userId: ${socket.id}`);
        return;
      }

      console.log(`❌ User disconnected: ${socket.userId}`);

      await User.findByIdAndUpdate(socket.userId, {
        isOnline: false,
        lastSeen: new Date(),
      });

      const userConversations = await Conversation.find({
        participants: socket.userId,
      }).select("participants");

      for (const conv of userConversations) {
        for (const p of conv.participants) {
          if (p.toString() !== socket.userId.toString()) {
            io.to(p.toString()).emit("userOffline", { userId: socket.userId });
          }
        }
      }
    });
  });
};
