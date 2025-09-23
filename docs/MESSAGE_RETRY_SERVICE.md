# Message Retry Service Documentation

## Overview

The Message Retry Service is a background cron job that runs every 6 hours to automatically retry failed WhatsApp messages by resending them to the SQS queue for processing.

## Features

- **Automatic Retry**: Runs every 6 hours to check for failed messages
- **Configurable Retry Logic**: Configurable maximum retry attempts and retry delay
- **Batch Processing**: Processes messages in batches for optimal performance
- **SQS Integration**: Reuses existing SQS infrastructure for message delivery
- **Health Monitoring**: Integrated with background job processor health checks
- **Manual Trigger**: API endpoint for manual retry processing

## Configuration

### Environment Variables

Add these variables to your `.env` file:

```env
# Message Retry Configuration
MAX_MESSAGE_RETRY_COUNT=3          # Maximum retry attempts per message
MESSAGE_RETRY_AFTER_HOURS=2        # Hours to wait before retrying failed messages
```

### Default Values

- **Retry Interval**: 6 hours (21,600,000 milliseconds)
- **Max Retry Count**: 3 attempts
- **Retry After**: 2 hours from last update
- **Batch Size**: 10 messages (SQS limit)

## How It Works

### 1. Message Selection Criteria

The service selects messages for retry based on:

- `message_status = 'failed'`
- `retry_count < MAX_MESSAGE_RETRY_COUNT`
- `updated_at <= (current_time - MESSAGE_RETRY_AFTER_HOURS)`
- `campaign_id IS NOT NULL` (only campaign messages)

### 2. Processing Flow

```
Failed Messages → Generate SQS Payload → Send to SQS → Update Retry Count
```

1. **Query Failed Messages**: Find eligible failed messages from database
2. **Generate Payloads**: Recreate SQS message payloads using campaign data
3. **Send to SQS**: Send messages in batches to SQS queue
4. **Update Database**: Increment retry count and update message status

### 3. Retry Logic

- **Successful Retry**: Message status changed to `pending`, retry count incremented
- **Failed Retry**: Retry count incremented, status remains `failed`
- **Max Retries Reached**: Message marked as permanently failed

## Database Schema Changes

The service uses the new `retry_count` column in the `messages` table:

```sql
-- Retry tracking
retry_count INTEGER DEFAULT 0,
```

## API Endpoints

### Manual Retry Trigger

```http
POST /api/campaigns/retry-failed-messages
Authorization: Bearer <token>
```

**Access**: Super Admin and System Admin only

**Response**:
```json
{
  "success": true,
  "message": "Failed message retry processing triggered successfully",
  "data": {
    "triggeredAt": "2024-01-15T10:30:00.000Z",
    "triggeredBy": "admin@example.com"
  }
}
```

## Service Integration

### Background Job Processor

The service is automatically started with the background job processor:

```javascript
// services/backgroundJobProcessor.js
messageRetryService.start();
```

### Health Monitoring

The service includes health checks that automatically restart it if it stops:

```javascript
// Check if message retry service is still running
if (!messageRetryService.isRunning) {
  logger.warn("Message retry service is not running, restarting...");
  messageRetryService.start();
}
```

## Logging

The service provides comprehensive logging:

### Info Logs
- Service start/stop events
- Retry processing start/completion
- Batch processing results
- Manual trigger events

### Error Logs
- Failed message payload generation
- SQS send failures
- Database update errors
- Service health check failures

### Debug Logs
- Individual message retry status updates
- Batch processing details

## Monitoring

### Service Status

Check service status via background job processor:

```javascript
const backgroundJobProcessor = require('./services/backgroundJobProcessor');
const status = backgroundJobProcessor.getStatus();
console.log(status.messageRetryStatus);
```

### Metrics to Monitor

1. **Retry Success Rate**: Successful retries vs total retry attempts
2. **Message Recovery**: Failed messages that eventually succeed
3. **Permanent Failures**: Messages that reach max retry count
4. **Processing Time**: Time taken for each retry cycle
5. **Queue Depth**: SQS queue message count

## Error Handling

### Common Scenarios

1. **Invalid Message Data**: Skip message and log error
2. **SQS Unavailable**: Log error, retry in next cycle
3. **Database Connection Issues**: Service will restart automatically
4. **Template/Campaign Data Missing**: Mark message as permanently failed

### Recovery Strategies

- **Service Restart**: Automatic restart via health checks
- **Manual Intervention**: Use API endpoint to trigger processing
- **Database Cleanup**: Failed messages older than retention period are cleaned up

## Performance Considerations

### Batch Processing
- Messages processed in batches of 10 (SQS limit)
- Reduces API calls and improves throughput

### Query Optimization
- Indexed queries on `message_status`, `retry_count`, and `updated_at`
- Limited result set (100 messages per cycle)

### Resource Usage
- Minimal memory footprint
- CPU usage spikes only during processing cycles
- Network usage for SQS API calls

## Testing

### Manual Testing

1. Create a campaign with failed messages
2. Trigger manual retry processing:
   ```bash
   curl -X POST http://localhost:3000/api/campaigns/retry-failed-messages \
     -H "Authorization: Bearer <token>"
   ```
3. Check logs for processing results
4. Verify message status updates in database

### Automated Testing

The service can be tested by:
1. Creating test messages with `failed` status
2. Running the retry processing
3. Verifying SQS message generation
4. Checking database updates

## Troubleshooting

### Service Not Running
- Check background job processor status
- Verify environment variables
- Check application logs for startup errors

### Messages Not Being Retried
- Verify message selection criteria
- Check retry count and timing constraints
- Ensure campaign and template data exists

### SQS Failures
- Verify AWS credentials and permissions
- Check SQS queue configuration
- Monitor SQS service status

### High Retry Rates
- Investigate root cause of message failures
- Consider adjusting retry parameters
- Review WhatsApp API error responses

## Best Practices

1. **Monitor Retry Rates**: High retry rates indicate underlying issues
2. **Set Appropriate Limits**: Balance between recovery and resource usage
3. **Regular Cleanup**: Remove old failed messages to maintain performance
4. **Alert on Failures**: Set up monitoring for service health
5. **Log Analysis**: Regular review of retry patterns and failure reasons
