const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const { createServer } = require('http');
const { Server } = require('socket.io');
const socketHandler = require('./utils/socket');

dotenv.config();

const app = express();
const httpServer = createServer(app);

// --------- Middlewares ---------
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --------- Socket.IO Setup ---------
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Attach io to requests
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

// --------- Connect to MongoDB, THEN start server ---------
const PORT = process.env.PORT || 3000;

mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
  .then(() => {
    console.log('✅ MongoDB connected');
    // Initialize sockets AFTER successful DB connection
    socketHandler(io);

    httpServer.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  })
  .catch(err => {
    console.error('❌ MongoDB connection failed:', err.message);
  });
