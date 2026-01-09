const pool = require("../config/database");
const Conversation = require("../models/Conversation");
const conversationService = require("../services/conversationService");
const S3Service = require("../services/S3Service");

/**
 * ===============================
 * 1️⃣ GET INBOX (Conversation List)
 * ===============================
 * GET /api/inbox?organizationId=UUID
 */
exports.getInboxAudience = async (req, res) => {
  try {
    let organizationId = req.user.organization_id;
    if(!organizationId){
      organizationId  = req.query.organizationId;
    }
   

    if (!organizationId) {
      return res.status(400).json({
        success: false,
        message: "organizationId is required",
      });
    }

    const sql = `
      SELECT
        c.id AS conversation_id,
        c.customer_phone_number AS msisdn,
        COALESCE(am.name, c.customer_name) AS name,
        c.last_message_at,
        c.last_customer_message_at,
        c.unread_customer_messages,

        (
          SELECT cm.message_content
          FROM conversation_messages cm
          WHERE cm.conversation_id = c.id
          ORDER BY cm.created_at DESC
          LIMIT 1
        ) AS last_message

      FROM conversations c
      LEFT JOIN audience_master am
        ON am.msisdn = c.customer_phone_number
       AND am.organization_id = c.organization_id

      WHERE c.organization_id = $1
      ORDER BY c.last_message_at DESC;
    `;

    const { rows } = await pool.query(sql, [organizationId]);

    const data = rows.map(row => ({
      conversationId: row.conversation_id,
      name: row.name,
      msisdn: row.msisdn,
      lastMessage: row.last_message,
      lastMessageAt: row.last_message_at,
      unreadCount: row.unread_customer_messages || 0,
      isActive:
        row.last_customer_message_at &&
        Date.now() - new Date(row.last_customer_message_at) <
          24 * 60 * 60 * 1000,
    }));

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("getInboxAudience error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};



/**
 * =================================
 * 2️⃣ GET MESSAGES OF A CONVERSATION
 * =================================
 * GET /api/inbox/:conversationId/messages
 */
exports.getConversationMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 50;
    const offset = (page - 1) * limit;

    const sql = `
      SELECT
        cm.id,
        cm.direction,
        cm.message_type,
        cm.message_content,
        cm.media_url,
        cm.media_type,
        cm.caption,
        cm.filename,
        cm.template_name,
        cm.template_language,
        cm.template_parameters,
        cm.interactive_type,
        cm.interactive_data,
        cm.message_status,
        cm.created_at,

        t.id AS template_id,
        t.name AS template_name_full,
        t.category,
        t.language,
        t.components,
        t.status AS template_status

      FROM conversation_messages cm
      LEFT JOIN templates t
        ON cm.template_name = t.name
      WHERE cm.conversation_id = $1
      ORDER BY cm.created_at ASC
      LIMIT $2 OFFSET $3
    `;

    const { rows } = await pool.query(sql, [
      conversationId,
      limit,
      offset,
    ]);

    // 🔹 Formatting like Templates API
    const messages = rows.map(row => ({
      id: row.id,
      direction: row.direction,
      type: row.message_type,
      message: row.message_content,
      media_url: row.media_url,
      created_at: row.created_at,
      status: row.message_status,

      template: row.template_id
        ? {
            id: row.template_id,
            name: row.template_name_full,
            category: row.category,
            language: row.language,
            status: row.template_status,
            components: row.components,
            parameters: row.template_parameters,
          }
        : null,

      interactive: row.interactive_type
        ? {
            type: row.interactive_type,
            data: row.interactive_data,
          }
        : null,
    }));

    res.json({
      success: true,
      data: {
        messages,
        pagination: {
          page,
          limit,
          total: messages.length,
        },
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch conversation messages",
    });
  }
};




/**
 * ==========================================
 * 3️⃣ CHECK IF MESSAGE CAN BE SENT (24 HOURS)
 * ==========================================
 * GET /api/inbox/:conversationId/can-send
 */
exports.canSendMessage = async (req, res) => {
  try {
    const { conversationId } = req.params;

    const { rows } = await pool.query(
      `
      SELECT last_customer_message_at
      FROM conversations
      WHERE id = $1
      `,
      [conversationId]
    );

    if (!rows.length || !rows[0].last_customer_message_at) {
      return res.json({
        canSend: false,
        reason: "No customer message received yet",
      });
    }

    const lastIncomingAt = rows[0].last_customer_message_at;
    const canSend =
      Date.now() - new Date(lastIncomingAt) <= 24 * 60 * 60 * 1000;

    res.json({
      canSend,
      lastIncomingAt,
    });
  } catch (error) {
    console.error("canSendMessage error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};



/**
 * =============================
 * 4️⃣ SEND OUTBOUND MESSAGE
 * =============================
 * POST /api/inbox/:conversationId/send
 */
exports.sendMessage = async (req, res) => {
  try {
    const conversationId = req.params.conversationId;
    console.log("conversationId: ", conversationId);
   
         // Verify conversation exists and user has access
         const conversation = await Conversation.findById(conversationId);
         if (!conversation) {
           return res.status(404).json({
             success: false,
             message: "Conversation not found",
           });
         }
   
         console.log("conversation.organization_id: ", conversation.organization_id);
         console.log("req.user.organizationId: ", req.user.organization_id);
   
         if (conversation.organization_id !== req.user.organization_id) {
           return res.status(403).json({
             success: false,
             message: "Access denied",
           });
         }
   
         let from_phone_number = conversation.business_phone_number;
         let to_phone_number = conversation.customer_phone_number;
   
         const messageData = {
           organizationId: req.user.organization_id,
           conversationId,
           senderId: req.user.userId,
           from_phone_number,
           to_phone_number,
           messageType: req.body.messageType || "text",
           messageContent: req.body.messageContent,
           mediaUrl: req.body.mediaUrl,
           mediaType: req.body.mediaType,
           caption: req.body.caption,
           templateName: req.body.templateName,
           templateLanguage: req.body.templateLanguage,
           templateParameters: req.body.templateParameters,
           contextMessageId: req.body.contextMessageId,
           direction: "outbound",
   
         };
   
         const message = await conversationService.sendMessage(
           messageData,
           req.user.userId
         );
   
         res.status(201).json({
           success: true,
           message: "Message sent successfully",
           data: message,
         });
       } catch (error) {
         console.error("Error sending conversation message:", error);
         res.status(500).json({
           success: false,
           message: "Failed to send message",
           error: error.message,
         });
       }
};



/**
 * =============================
 * 5️⃣ MARK CONVERSATION AS READ
 * =============================
 * POST /api/inbox/:conversationId/read
 */
exports.markConversationRead = async (req, res) => {
  try {
    const { conversationId } = req.params;

    await pool.query(
      `
      UPDATE conversations
      SET unread_customer_messages = 0
      WHERE id = $1
      `,
      [conversationId]
    );

    res.json({
      success: true,
    });
  } catch (error) {
    console.error("markConversationRead error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};


exports.uploadMedia = async (req, res) => {
  try {
    const { file } = req;
    console.log("file: ", req.file);

    if (!file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded",
      });
    }

    // Upload to S3
    const result = await S3Service.uploadFile(
      file,
      "whatsapp-media"
    );

    return res.json({
      success: true,
      data: {
        url: result.url, // S3 URL
        key: result.key, // store if needed
      },
    });
  } catch (error) {
    console.error("uploadMedia error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to upload media",
    });
  }
};