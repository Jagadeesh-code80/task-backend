// --------------------- server.js ---------------------
const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const { createServer } = require('http');
const { Server } = require('socket.io');
const socketHandler = require('./utils/socket');
const cron = require("node-cron");
const axios = require("axios");

dotenv.config();

const app = express();
const httpServer = createServer(app);

// --------- Middlewares ---------
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --------- Healthcheck API ---------
app.get("/api/healthcheck", (req, res) => {
  res.status(200).json({
    status: "running",
    timestamp: new Date()
  });
});

// --------- Socket.IO Setup ---------
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000
});

// Initialize Socket Handler - THIS IS WHAT YOU WERE MISSING!
socketHandler(io);

// Attach io to requests (non-blocking emits)
app.use((req, res, next) => {
  req.io = io;
  next();
});

// --------- REST API Routes ---------
app.use('/api', require('./routes/authRoutes'));
app.use('/api/company', require('./routes/companyRoutes'));
app.use('/api/branch', require('./routes/branchRoutes'));
app.use('/api/department', require('./routes/departmentRoutes'));
app.use('/api/designation', require('./routes/designation'));
app.use('/api/employees', require('./routes/userRoutes'));
app.use('/api/project', require('./routes/projectRoutes'));
app.use('/api/task', require('./routes/taskRoutes'));
app.use('/api/chat', require('./routes/chatRoutes'));

// --------- CRON JOB TO PREVENT RENDER SLEEP ---------
const SERVER_URL = "https://taskmanager-86fo.onrender.com";

cron.schedule("*/5 * * * *", async () => {
  try {
    console.log("⏳ Cron: Pinging server to keep it awake...");
    await axios.get(`${SERVER_URL}/api/healthcheck`);
    console.log("💚 Server responded and is awake.");
  } catch (error) {
    console.error("❌ Cron ping failed:", error.message);
  }
});

// --------- Connect to MongoDB, THEN start server ---------
const PORT = process.env.PORT || 3000;

mongoose.connect(process.env.MONGODB_URI, {  
    useNewUrlParser: true,
    useUnifiedTopology: true,
    maxPoolSize: 50,
    serverSelectionTimeoutMS: 5000
})
.then(() => {
    console.log('✅ MongoDB connected');

    httpServer.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`🔌 Socket.IO ready at ws://localhost:${PORT}`);
    });
})
.catch(err => {
    console.error('❌ MongoDB connection failed:', err.message);
});