const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const { createServer } = require('http');
const { Server } = require('socket.io');

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
app.get('/api/test', (req, res) => res.json({ status: 'Server running ✅' }));

app.use('/api', require('./routes/authRoutes'));
app.use('/api/company', require('./routes/companyRoutes'));
app.use('/api/branch', require('./routes/branchRoutes'));
app.use('/api/department', require('./routes/departmentRoutes'));
app.use('/api/designation', require('./routes/designation'));
app.use('/api/employees', require('./routes/userRoutes'));
app.use('/api/project', require('./routes/projectRoutes'));
app.use('/api/task', require('./routes/taskRoutes'));
app.use('/api/chat', require('./routes/chatRoutes')); // <-- chat API

// --------- Import Controllers for reuse ---------
const chatController = require('./controllers/chatController');

// --------- Socket.IO Events ---------
io.on("connection", (socket) => {
  console.log(`🔗 User connected: ${socket.id}`);

  // Join personal room
  socket.on("register", (userId) => {
    socket.join(userId);
    console.log(`✅ User ${userId} joined personal room`);
  });

  // Join conversation room
  socket.on("joinConversation", (conversationId) => {
    socket.join(conversationId);
    console.log(`✅ User joined conversation ${conversationId}`);
  });

  // Send message via socket → reuse controller
  socket.on("sendMessage", async (data, callback) => {
    try {
      const { conversationId, senderId, text, fileUrl, replyTo } = data;

      const message = await mongoose.model("Message").create({
        conversationId,
        sender: senderId,
        text,
        fileUrl,
        replyTo,
      });

      await message.populate("sender", "name email avatar");

      io.to(conversationId.toString()).emit("newMessage", message);

      if (callback) callback({ success: true, message });
    } catch (err) {
      console.error("❌ Socket sendMessage error:", err.message);
      if (callback) callback({ success: false, error: err.message });
    }
  });

  // Create group via socket
  socket.on("createGroup", async ({ name, participants, createdBy }, callback) => {
    try {
      const Conversation = mongoose.model("Conversation");
      const group = await Conversation.create({
        name,
        participants,
        isGroup: true,
        createdBy,
      });

      participants.forEach(p => io.to(p).emit("groupCreated", group));

      if (callback) callback({ success: true, group });
    } catch (err) {
      console.error("❌ Socket createGroup error:", err.message);
      if (callback) callback({ success: false, error: err.message });
    }
  });

  // Typing indicator
  socket.on("typing", ({ conversationId, senderId }) => {
    socket.to(conversationId).emit("typing", { senderId });
  });

  // Disconnect
  socket.on("disconnect", () => {
    console.log(`❌ User disconnected: ${socket.id}`);
  });
});

// --------- Start Server ---------
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
