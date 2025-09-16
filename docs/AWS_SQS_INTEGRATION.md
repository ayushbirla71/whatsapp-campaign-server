# AWS SQS Integration for Campaign Message Processing

This document describes the AWS SQS integration for processing WhatsApp campaign messages.

## Overview

The system automatically processes campaigns with `asset_generated` status, updates them to `ready_to_launch`, and pushes individual message payloads to AWS SQS for WhatsApp message delivery.

## Architecture

```
Campaign (asset_generated) → Campaign Processing Service → Message Generator → AWS SQS → WhatsApp API
```

## Configuration

### Environment Variables

Add the following variables to your `.env` file:

```env
# AWS SQS Configuration
AWS_ACCESS_KEY_ID=your_aws_access_key_id
AWS_SECRET_ACCESS_KEY=your_aws_secret_access_key
AWS_REGION=us-east-1
AWS_SQS_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/123456789012/whatsapp-messages

# Campaign Processing Configuration
CAMPAIGN_BATCH_SIZE=10
CAMPAIGN_PROCESSING_INTERVAL=30000
BACKGROUND_JOB_INTERVAL=60000
SQS_MESSAGE_GROUP_ID=whatsapp-messages
```

### AWS Setup

1. **Create SQS Queue**:

   ```bash
   aws sqs create-queue --queue-name whatsapp-messages --region us-east-1
   ```

2. **Configure IAM Permissions**:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": [
           "sqs:SendMessage",
           "sqs:SendMessageBatch",
           "sqs:GetQueueAttributes"
         ],
         "Resource": "arn:aws:sqs:us-east-1:123456789012:whatsapp-messages"
       }
     ]
   }
   ```

## Message Formats

The system generates different message types based on campaign templates and audience data:

### Template Message

```json
{
  "organizationId": "123e4567-e89b-12d3-a456-426614174000",
  "campaignId": "123e4567-e89b-12d3-a456-426614174001",
  "campaignAudienceId": "123e4567-e89b-12d3-a456-426614174002",
  "to": "+1234567890",
  "templateName": "hello_world",
  "templateLanguage": "en",
  "templateParameters": []
}
```

### Template Message with Parameters

```json
{
  "organizationId": "123e4567-e89b-12d3-a456-426614174000",
  "campaignId": "123e4567-e89b-12d3-a456-426614174001",
  "campaignAudienceId": "123e4567-e89b-12d3-a456-426614174002",
  "to": "+1234567890",
  "templateName": "welcome_message",
  "templateLanguage": "en",
  "templateParameters": [
    {
      "type": "header",
      "valueType": "text",
      "value": "Welcome!"
    },
    {
      "type": "body",
      "valueType": "text",
      "value": "John Doe"
    }
  ]
}
```

### Text Message

```json
{
  "organizationId": "123e4567-e89b-12d3-a456-426614174000",
  "campaignId": "123e4567-e89b-12d3-a456-426614174001",
  "campaignAudienceId": "123e4567-e89b-12d3-a456-426614174002",
  "to": "+1234567890",
  "messageType": "text",
  "messageContent": "Hello! This is a simple text message."
}
```

### Media Messages

```json
{
  "organizationId": "123e4567-e89b-12d3-a456-426614174000",
  "campaignId": "123e4567-e89b-12d3-a456-426614174001",
  "campaignAudienceId": "123e4567-e89b-12d3-a456-426614174002",
  "to": "+1234567890",
  "messageType": "image",
  "mediaUrl": "https://your-bucket.s3.amazonaws.com/images/personalized-offer.jpg",
  "caption": "Special offer just for you!"
}
```

**Note**: The `caption` field is supported for all media message types (image, video, document, audio) and will be included in the message payload even if empty.

## API Endpoints

### Process Campaign Messages

```http
POST /api/campaigns/:campaignId/process-messages
Authorization: Bearer <token>
```

Manually trigger message processing for a specific campaign.

### Check SQS Status

```http
GET /api/campaigns/sqs-status
Authorization: Bearer <token>
```

Check SQS configuration and queue status.

## Background Processing

The system runs a background job processor that:

1. **Monitors Campaigns**: Checks for campaigns with `asset_generated` status
2. **Updates Status**: Changes campaign status to `ready_to_launch`
3. **Generates Messages**: Creates individual message payloads for each audience member
4. **Sends to SQS**: Pushes messages to AWS SQS in batches
5. **Updates Audience Status**: Marks audience members as `ready_to_send`

## Monitoring and Logging

- All SQS operations are logged with detailed information
- Campaign processing status is tracked in the database
- Health checks ensure background services are running
- Failed messages are logged with error details

## Error Handling

- **SQS Failures**: Messages are retried and errors are logged
- **Invalid Payloads**: Validation errors are logged and audience marked as failed
- **Service Failures**: Background processor automatically restarts failed services

## Scaling Considerations

- **Batch Processing**: Messages are sent in batches of 10 (SQS limit)
- **Rate Limiting**: Configurable processing intervals to manage load
- **Queue Management**: Use SQS DLQ for failed message handling
- **Monitoring**: CloudWatch metrics for queue depth and processing rates

## Testing

Use the provided API endpoints to test the integration:

1. Create a campaign with `asset_generated` status
2. Call the process messages endpoint
3. Check SQS queue for generated messages
4. Monitor logs for processing status

## Troubleshooting

### Common Issues

1. **SQS Not Configured**: Check AWS credentials and queue URL
2. **Permission Denied**: Verify IAM permissions for SQS operations
3. **Invalid Messages**: Check template and audience data format
4. **Processing Stopped**: Background processor will auto-restart failed services

### Debug Commands

```bash
# Check SQS queue attributes
aws sqs get-queue-attributes --queue-url <queue-url> --attribute-names All

# Monitor queue messages
aws sqs receive-message --queue-url <queue-url> --max-number-of-messages 10
```
