const { AppError, asyncHandler } = require("../middleware/errorHandler");
const logger = require("../utils/logger");
const { normalizeMSISDN } = require("../utils/phoneUtils");

const Conversation = require("../models/Conversation");
const ConversationMessage = require("../models/ConversationMessage");
const Organization = require("../models/Organization");
const Template = require("../models/Template");
const Campaign = require("../models/Campaign");
const Audience = require("../models/Audience");

const { sendMessageBatch } = require("../services/sqsService");

const sendInstentMessage = asyncHandler(async (req, res) => {
  const {
    organizationId,
    to,
    messageContent,
    isTemplate,
    templateId,
    templateParameters,
    messageType,
    mediaUrl,
    mediaType,
    caption,
    audienceData,
    campaignData,
  } = req.body;

  /* -------------------- BASIC VALIDATION -------------------- */

  const requiredFields = ["organizationId", "to", "messageContent", "campaignData"];
  const missingFields = requiredFields.filter((f) => !req.body[f]);
  if (missingFields.length > 0) {
    throw new AppError(`Missing required fields: ${missingFields.join(", ")}`, 400);
  }

  const organization = await Organization.findById(organizationId);
  if (!organization) throw new AppError("Organization not found", 404);

  if (
    req.user.role === "organization_admin" &&
    req.user.organization_id !== organizationId
  ) {
    throw new AppError("Access denied to this organization", 403);
  }

  if (req.user.role === "organization_user") {
    throw new AppError("Organization users cannot send messages", 403);
  }

//   const normalizedTo = Audience.normalizeMSISDN(to);
//   if (!normalizedTo) throw new AppError("Invalid phone number", 400);

    const normalizedTo = normalizeMSISDN(to);
  if (!normalizedTo) throw new AppError("Invalid phone number", 400);
  /* -------------------- TEMPLATE VALIDATION -------------------- */

  let template = null;

  if (isTemplate) {
    template = await Template.findById(templateId);
    if (!template) throw new AppError("Template not found", 404);
    if (template.organization_id !== organizationId)
      throw new AppError("Template does not belong to this organization", 403);
    if (template.status !== "approved" || template.approved_by_admin !== "approved") {
      throw new AppError("Template is not approved for use", 400);
    }
  }

  /* -------------------- CREATE CAMPAIGN -------------------- */

  const finalCampaignData = {
    ...campaignData,
    name: `${campaignData.name}-${Date.now()}`, // avoid duplicates
    organization_id: organizationId,
    template_id: templateId,
    created_by: req.user.id,
    status: "draft",
  };

  const validationErrors = Campaign.validateCampaign(finalCampaignData);
  if (validationErrors.length > 0) {
    throw new AppError(`Validation failed: ${validationErrors.join(", ")}`, 400);
  }

  const campaign = await Campaign.create(finalCampaignData);

  logger.info("Instant campaign created", {
    campaignId: campaign.id,
    organizationId,
  });

  /* -------------------- BUILD SINGLE AUDIENCE -------------------- */

  const audience_list = [
    {
      name: audienceData?.name || "Customer",
      msisdn: normalizedTo,
      attributes: templateParameters || {},
    },
  ];

  /* -------------------- TEMPLATE PARAM VALIDATION -------------------- */

  if (template && template.parameters) {
    const templateParams =
      typeof template.parameters === "string"
        ? JSON.parse(template.parameters)
        : template.parameters;

    const requiredAttributes = Object.values(templateParams || {});
    const missing = requiredAttributes.filter(
      (attr) => !audience_list[0].attributes?.[attr]
    );

    if (missing.length > 0) {
      throw new AppError(
        `Missing template attributes: ${missing.join(", ")}`,
        400
      );
    }
  }

  /* -------------------- ADD AUDIENCE -------------------- */

  await Audience.addToCampaign(
    campaign.id,
    organizationId,
    audience_list
  );

  /* -------------------- APPROVE & RUN CAMPAIGN -------------------- */

  await Campaign.approveCampaign(campaign.id, req.user.id);

  logger.info("Instant campaign started", {
    campaignId: campaign.id,
  });

  /* -------------------- CREATE CONVERSATION MESSAGE (OPTIONAL UI) -------------------- */

//   const conversation = await Conversation.getOrCreate(
//     organizationId,
//     normalizedTo,
//  {customerName: audienceData?.name, conversationType: "general", relatedCampaignId: campaign.id}
//   );

//   const message = await ConversationMessage.createMessage({
//     conversationId: conversation.id,
//     organizationId,
//     direction: "outbound",
//     sentByUserId: req.user.id,
//     messageType: messageType || "template",
//     messageContent,
//     mediaUrl,
//     mediaType,
//     caption,
//   });

  /* -------------------- PUSH TO SQS -------------------- */

  // sendMessageBatch([
  //   {
  //     campaignId: campaign.id,
  //     to: normalizedTo,
  //     template,
  //     templateParameters,
  //     messageType,
  //     mediaUrl,
  //     mediaType,
  //     caption,
  //   },
  // ]);

  /* -------------------- RESPONSE -------------------- */

  res.status(200).json({
    success: true,
    message: "Instant message sent using campaign flow",
    data: {
      campaignId: campaign.id,
    //   messageId: message.id,
    },
  });
});

module.exports = {
  sendInstentMessage,
};
