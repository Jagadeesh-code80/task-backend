const Conversation = require("../models/Conversation");
const Message = require("../models/Message");

// Create or get 1-1 conversation
exports.getOrCreateConversation = async (req, res) => {
  try {
    const { userId1, userId2 } = req.body;

    let conversation = await Conversation.findOne({
      isGroup: false,
      participants: { $all: [userId1, userId2] },
    }).populate("participants", "name email avatar");

    if (!conversation) {
      conversation = await Conversation.create({
        participants: [userId1, userId2],
        isGroup: false,
      });

      // populate before sending back
      conversation = await Conversation.findById(conversation._id)
        .populate("participants", "name email avatar isOnline lastSeen");

      // 🔔 Emit event to user2 (the new friend)
      if (req.io) {
        req.io.to(userId2.toString()).emit("newConversation", conversation);

        // Optional: also notify user1 that a new conversation was created
        req.io.to(userId1.toString()).emit("newConversation", conversation);
      }
    }

    res.json(conversation);
  } catch (err) {
    console.error("getOrCreateConversation error:", err);
    res.status(500).json({ error: err.message });
  }
};


// Get all conversations for a specific user
exports.getUserConversations = async (req, res) => {
  try {
    const userId = req.user?.userId;

    const conversations = await Conversation.find({
      participants: userId,
    })
      .populate("participants", "name email avatar isOnline lastSeen")
      .populate("createdBy", "name email")
      .sort({ updatedAt: -1 })
      .lean(); // plain JS objects

    // Remove logged-in user from participants array
    const filtered = conversations.map(conv => {
      return {
        ...conv,
        participants: conv.participants.filter(p => p._id.toString() !== userId)
      };
    });

    res.json(filtered);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Helper to fetch conversations (used in socket events)
async function fetchUserConversations(userId) {
  const conversations = await Conversation.find({ participants: userId })
    .populate("participants", "name email avatar isOnline lastSeen")
    .populate("createdBy", "name email")
    .sort({ updatedAt: -1 })
    .lean();

  // Remove logged-in user from participants array
  return conversations.map(conv => ({
    ...conv,
    participants: conv.participants.filter(
      p => p._id.toString() !== userId
    )
  }));
}

exports.fetchUserConversations = fetchUserConversations;


// Create group conversation
exports.createGroup = async (req, res) => {
  try {
    const { name, participants, createdBy } = req.body;

    const group = await Conversation.create({
      name,
      participants,
      isGroup: true,
      createdBy,
    });

    res.json(group);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Send message
exports.sendMessage = async (req, res) => {
  try {
    const userId = req.user?.userId;

    const { conversationId, text, fileUrl, replyTo } = req.body;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized: no userId found" });
    }

    // Check if request already processed (prevent duplicates)
    if (req.processed) {
      return res.status(409).json({ error: "Duplicate request detected" });
    }
    req.processed = true;

    // Create message
    const message = await Message.create({
      conversationId,
      sender: userId,
      text,
      fileUrl,
      replyTo,
    });

    // await message.populate("sender", "name email avatar");

    // // Emit only once
    // if (req.io) {
    //   req.io.to(conversationId.toString()).emit("newMessage", message);
    // }

    return res.status(201).json(message);
  } catch (err) {
    console.error("❌ Error in sendMessage:", err);
    return res.status(500).json({ error: err.message });
  }
};
// Bulk update - mark multiple messages as read
exports.markMessagesRead = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const { messageIds } = req.body; // Array of messageIds

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized: no userId found" });
    }

    if (!Array.isArray(messageIds) || messageIds.length === 0) {
      return res.status(400).json({ error: "messageIds array is required" });
    }

    // Update all matching messages
    const result = await Message.updateMany(
      { _id: { $in: messageIds }, isRead: false },
      { $set: { isRead: true } }
    );

    // Optional: emit socket event to notify sender(s)
    if (req.io) {
      req.io.emit("messagesRead", {
        messageIds,
        reader: userId,
      });
    }

    return res.status(200).json({
      success: true,
      updatedCount: result.modifiedCount,
    });
  } catch (err) {
    console.error("❌ Error in markMessagesRead:", err);
    return res.status(500).json({ error: err.message });
  }
};


// Get messages
exports.getMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;

    const messages = await Message.find({ conversationId })
      .populate("sender", "name email avatar")
      .populate("replyTo");

    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
