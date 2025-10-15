const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const { createServer } = require('http');
const { Server } = require('socket.io');
const User = require("./models/User"); 


dotenv.config();

const app = express();
const httpServer = createServer(app);

// --------- Middlewares ---------
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --------- MongoDB Connection ---------
mongoose
  .connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  })
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB connection failed:', err.message));

// --------- Socket.IO Setup ---------
const io = new Server(httpServer, {
  cors: {
    origin: "*", // in production replace with your frontend URL
    methods: ["GET", "POST"]
  }
});

// Attach io to req for REST APIs
app.use((req, res, next) => {
  req.io = io;
  next();
});

// --------- REST API Routes ---------
app.post('/api/test', (req, res) => {
  // Log request body in server console
  console.log("Request Body:", req.body);

  // Send response back to client
  res.json({
    status: 'Server running ✅',
    RequestBody: req.body
  });
});

app.use('/api', require('./routes/authRoutes'));
app.use('/api/company', require('./routes/companyRoutes'));
app.use('/api/branch', require('./routes/branchRoutes'));
app.use('/api/department', require('./routes/departmentRoutes'));
app.use('/api/designation', require('./routes/designation'));
app.use('/api/employees', require('./routes/userRoutes'));
app.use('/api/project', require('./routes/projectRoutes'));
app.use('/api/task', require('./routes/taskRoutes'));
app.use('/api/chat', require('./routes/chatRoutes')); 

// --------- Import Controllers for reuse ---------
const { fetchUserConversations } = require("./controllers/chatController");

io.on("connection", (socket) => {
  console.log(`🔗 User connected: ${socket.id}`);

  // ✅ Register user (after login)
  socket.on("register", async (userId) => {
    try {
      socket.userId = userId;
      socket.join(userId);

      console.log(`✅ User ${userId} joined personal room`);

      // Mark user online
      await User.findByIdAndUpdate(
        userId,
        { isOnline: true, lastSeen: null },
        { new: true, select: "_id name email isOnline lastSeen" }
      );

      console.log("✅ User marked online:", userId);

      // Send updated conversation list to THIS user
      const myConvList = await fetchUserConversations(userId);
      io.to(userId).emit("conversationList", myConvList);

      // Notify all participants + refresh their conversation lists
      const Conversation = mongoose.model("Conversation");
      const userConversations = await Conversation.find({
        participants: userId
      }).select("participants");

      for (const conv of userConversations) {
        for (const p of conv.participants) {
          if (p.toString() !== userId.toString()) {
            io.to(p.toString()).emit("userOnline", { userId });

            // Send updated conversation list to your friend
            const friendConvList = await fetchUserConversations(p.toString());
            io.to(p.toString()).emit("conversationList", friendConvList);
          }
        }
      }
    } catch (err) {
      console.error("❌ Register error:", err.message);
    }
  });

  // ✅ Join conversation room
  socket.on("joinConversation", (conversationId) => {
    socket.join(conversationId);
    console.log(`✅ User joined conversation ${conversationId}`);
  });

  // ✅ Send message
  socket.on("sendMessage", async (data, callback) => {
    try {
      const { conversationId, senderId, receiverId, text, fileUrl, replyTo } = data;

      const Message = mongoose.model("Message");
      const Conversation = mongoose.model("Conversation");
      let conversation;

      // Find or create conversation
      if (!conversationId) {
        conversation = await Conversation.findOne({
          participants: { $all: [senderId, receiverId], $size: 2 }
        });

        if (!conversation) {
          conversation = await Conversation.create({
            participants: [senderId, receiverId],
            isGroup: false
          });

          // 🔔 Notify both users of new conversation + refresh their lists
          for (const uid of [senderId, receiverId]) {
            io.to(uid.toString()).emit("newConversation", conversation);
            const convList = await fetchUserConversations(uid.toString());
            io.to(uid.toString()).emit("conversationList", convList);
          }
        }
      } else {
        conversation = await Conversation.findById(conversationId);
      }

      // Save message
      const message = await Message.create({
        conversationId: conversation._id,
        sender: senderId,
        text,
        fileUrl,
        replyTo,
      });

      await message.populate("sender", "name email avatar");

      // Emit to conversation room
      io.to(conversation._id.toString()).emit("newMessage", message);

      // 🔄 Refresh conversation list for all participants
      for (const p of conversation.participants) {
        const convList = await fetchUserConversations(p.toString());
        io.to(p.toString()).emit("conversationList", convList);
      }

      if (callback) callback({ success: true, message, conversation });
    } catch (err) {
      console.error("❌ Socket sendMessage error:", err.message);
      if (callback) callback({ success: false, error: err.message });
    }
  });

  // ✅ Create group
  socket.on("createGroup", async ({ name, participants, createdBy }, callback) => {
    try {
      const Conversation = mongoose.model("Conversation");
      const group = await Conversation.create({
        name,
        participants,
        isGroup: true,
        createdBy,
      });

      for (const p of participants) {
        io.to(p).emit("groupCreated", group);
        const convList = await fetchUserConversations(p);
        io.to(p.toString()).emit("conversationList", convList);
      }

      if (callback) callback({ success: true, group });
    } catch (err) {
      console.error("❌ Socket createGroup error:", err.message);
      if (callback) callback({ success: false, error: err.message });
    }
  });

  // ✅ Typing
  socket.on("typing", ({ conversationId, senderId }) => {
    socket.to(conversationId).emit("typing", { senderId });
  });

  // ✅ Disconnect
  socket.on("disconnect", async () => {
    if (socket.userId) {
      console.log(`❌ User disconnected: ${socket.userId}`);

      await User.findByIdAndUpdate(
        socket.userId,
        { isOnline: false, lastSeen: new Date() },
        { new: true, select: "_id name email isOnline lastSeen" }
      );

      // Send updated conversation list to THIS user
      const myConvList = await fetchUserConversations(socket.userId);
      io.to(socket.userId).emit("conversationList", myConvList);

      // Notify all participants + refresh their conversation lists
      const Conversation = mongoose.model("Conversation");
      const userConversations = await Conversation.find({
        participants: socket.userId
      }).select("participants");

      for (const conv of userConversations) {
        for (const p of conv.participants) {
          if (p.toString() !== socket.userId.toString()) {
            io.to(p.toString()).emit("userOffline", { userId: socket.userId });

            // Send updated conversation list to friend
            const friendConvList = await fetchUserConversations(p.toString());
            io.to(p.toString()).emit("conversationList", friendConvList);
          }
        }
      }
    } else {
      console.log(`❌ Socket disconnected without userId: ${socket.id}`);
    }
  });
});



// --------- Start Server ---------
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
