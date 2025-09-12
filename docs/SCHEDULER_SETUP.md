# Campaign Scheduler Service Setup

## Overview

The Campaign Scheduler Service automatically monitors campaigns with `asset_generated` status and pushes them to AWS SQS when their scheduled time arrives. This enables automated campaign execution through the WhatsApp Business API.

## Environment Variables

Add these environment variables to your `.env` file:

### AWS SQS Configuration
```env
# AWS Credentials
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key

# SQS Queue URL
SQS_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/123456789012/whatsapp-messages

# Scheduler Configuration
SCHEDULER_CHECK_INTERVAL_MS=60000  # Check every 60 seconds (default)
AUTO_START_SCHEDULER=true          # Auto-start scheduler on server startup

# SQS Processing Configuration (for receiver)
BATCH_SIZE=10                      # Number of messages to process at once
PROCESSING_TIMEOUT_MS=30000        # Processing timeout per message
MAX_RETRY_ATTEMPTS=3               # Maximum retry attempts for failed messages
```

## AWS SQS Setup

### 1. Create SQS Queue

```bash
# Create the main queue
aws sqs create-queue --queue-name whatsapp-messages --region us-east-1

# Create Dead Letter Queue (optional but recommended)
aws sqs create-queue --queue-name whatsapp-messages-dlq --region us-east-1
```

### 2. Configure Queue Attributes

```bash
# Set visibility timeout and message retention
aws sqs set-queue-attributes \
  --queue-url https://sqs.us-east-1.amazonaws.com/123456789012/whatsapp-messages \
  --attributes '{
    "VisibilityTimeoutSeconds": "60",
    "MessageRetentionPeriod": "1209600",
    "ReceiveMessageWaitTimeSeconds": "20"
  }'
```

### 3. IAM Permissions

Create an IAM user with the following policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "sqs:SendMessage",
        "sqs:ReceiveMessage",
        "sqs:DeleteMessage",
        "sqs:GetQueueAttributes",
        "sqs:GetQueueUrl"
      ],
      "Resource": [
        "arn:aws:sqs:us-east-1:123456789012:whatsapp-messages",
        "arn:aws:sqs:us-east-1:123456789012:whatsapp-messages-dlq"
      ]
    }
  ]
}
```

## API Endpoints

### Start Scheduler
```http
POST /api/scheduler/start
Authorization: Bearer <super_admin_or_system_admin_token>
```

### Stop Scheduler
```http
POST /api/scheduler/stop
Authorization: Bearer <super_admin_or_system_admin_token>
```

### Get Scheduler Status
```http
GET /api/scheduler/status
Authorization: Bearer <super_admin_or_system_admin_token>
```

### Manual Campaign Check
```http
POST /api/scheduler/check-campaigns
Authorization: Bearer <super_admin_or_system_admin_token>
```

### Queue Health Check
```http
GET /api/scheduler/queue-health
Authorization: Bearer <super_admin_or_system_admin_token>
```

## SQS Message Format

The scheduler sends messages to SQS in the following format:

```json
{
  "campaignId": "uuid-123",
  "organizationId": "uuid-456",
  "templateId": "uuid-789",
  "audienceId": "uuid-abc",
  "messageType": "whatsapp_business_message",
  "whatsappMessageBody": {
    "messaging_product": "whatsapp",
    "to": "+1234567890",
    "type": "template",
    "template": {
      "name": "welcome_message",
      "language": {
        "code": "en"
      },
      "components": [
        {
          "type": "body",
          "parameters": [
            {
              "type": "text",
              "text": "John Doe"
            }
          ]
        }
      ]
    },
    "_credentials": {
      "phoneNumberId": "123456789",
      "accessToken": "token_here",
      "businessAccountId": "987654321"
    },
    "_tracking": {
      "campaignId": "uuid-123",
      "organizationId": "uuid-456",
      "templateId": "uuid-789",
      "audienceId": "uuid-abc",
      "generatedAssetUrls": "{\"image\": \"s3://bucket/image.png\"}"
    }
  },
  "timestamp": "2025-01-10T10:00:00.000Z",
  "retryCount": 0
}
```

## Campaign Workflow

1. **Campaign Creation**: Campaign created with `draft` status
2. **Asset Generation**: Status changes to `asset_generation` → `asset_generated`
3. **Scheduling**: Campaign scheduled with `scheduled_at` timestamp
4. **Scheduler Check**: Scheduler checks every minute for ready campaigns
5. **Status Update**: Campaign status updated to `ready_to_launch`
6. **SQS Push**: Each audience member pushed to SQS as individual message
7. **Campaign Running**: Status updated to `running`
8. **Message Processing**: SQS receiver processes messages and sends via WhatsApp API

## Monitoring and Troubleshooting

### Check Scheduler Status
```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/scheduler/status
```

### Check Queue Health
```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/scheduler/queue-health
```

### Manual Campaign Check
```bash
curl -X POST -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/scheduler/check-campaigns
```

### Common Issues

1. **Scheduler Not Starting**: Check AWS credentials and SQS queue URL
2. **Messages Not Processing**: Verify SQS permissions and queue configuration
3. **Campaign Stuck**: Check campaign status and scheduled_at timestamp
4. **WhatsApp API Errors**: Verify organization WhatsApp credentials

## Security Considerations

- Only Super Admin and System Admin can control the scheduler
- AWS credentials should be stored securely
- SQS messages contain sensitive WhatsApp credentials
- Use IAM roles in production instead of access keys
- Enable SQS encryption at rest and in transit
- Monitor queue for message buildup or processing failures

## Production Deployment

1. Use IAM roles instead of access keys
2. Enable SQS encryption
3. Set up CloudWatch monitoring
4. Configure Dead Letter Queue
5. Implement proper logging and alerting
6. Use environment-specific queues
7. Set appropriate queue retention and visibility timeouts
