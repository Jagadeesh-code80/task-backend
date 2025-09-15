const express = require("express");
const router = express.Router();
const {
  getOrCreateConversation,
  createGroup,
  sendMessage,
  getMessages,
  getUserConversations,
  markMessagesRead
} = require("../controllers/chatController");
const { authenticate, requireAdmin } = require('../middleware/auth');

router.use(authenticate);


router.post("/conversation", getOrCreateConversation);
router.get("/conversations",getUserConversations);

router.post("/group", createGroup);
router.post("/message",sendMessage);
router.get("/messages/:conversationId", getMessages);
router.put("/messages/read",markMessagesRead);


module.exports = router;
