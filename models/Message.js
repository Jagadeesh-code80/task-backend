const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    isRead: { type: Boolean, default: false },
    text: { type: String },
    fileUrl: { type: String }, // attachments
    replyTo: { type: mongoose.Schema.Types.ObjectId, ref: "Message" }, // threaded reply
  },
  { timestamps: true }
);

module.exports = mongoose.model("Message", messageSchema);
