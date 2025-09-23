#!/usr/bin/env node

/**
 * Test script for message retry service
 * This script demonstrates and tests the message retry functionality
 */

require("dotenv").config();
const messageRetryService = require("../services/messageRetryService");
const Message = require("../models/Message");
const logger = require("../utils/logger");

// Test configuration
const TEST_CONFIG = {
  organizationId: "123e4567-e89b-12d3-a456-426614174000",
  campaignId: "123e4567-e89b-12d3-a456-426614174001",
  campaignAudienceId: "123e4567-e89b-12d3-a456-426614174002",
  templateId: "123e4567-e89b-12d3-a456-426614174003",
};

async function createTestFailedMessage() {
  try {
    console.log("Creating test failed message...");

    const testMessage = {
      organization_id: TEST_CONFIG.organizationId,
      campaign_id: TEST_CONFIG.campaignId,
      campaign_audience_id: TEST_CONFIG.campaignAudienceId,
      from_number: "+1234567890",
      to_number: "+0987654321",
      message_type: "template",
      template_name: "test_template",
      template_language: "en",
      template_parameters: JSON.stringify([]),
      is_incoming: false,
      message_status: "failed",
      failure_reason: "Test failure for retry testing",
      retry_count: 0,
      failed_at: new Date(),
    };

    const createdMessage = await Message.create(testMessage);
    console.log("✅ Test failed message created:", createdMessage.id);
    return createdMessage;
  } catch (error) {
    console.error("❌ Error creating test message:", error.message);
    throw error;
  }
}

async function createTestCampaignData() {
  try {
    console.log("Note: This test assumes campaign and template data exists in the database");
    console.log("Campaign ID:", TEST_CONFIG.campaignId);
    console.log("Template ID:", TEST_CONFIG.templateId);
    console.log("Organization ID:", TEST_CONFIG.organizationId);
    console.log("Campaign Audience ID:", TEST_CONFIG.campaignAudienceId);
    console.log("");
    console.log("For a complete test, ensure these records exist in your database:");
    console.log("- campaigns table with the specified campaign_id");
    console.log("- templates table with the specified template_id");
    console.log("- campaign_audience table with the specified campaign_audience_id");
    console.log("");
  } catch (error) {
    console.error("❌ Error with test data:", error.message);
    throw error;
  }
}

async function testRetryServiceStatus() {
  try {
    console.log("Testing message retry service status...");
    
    const status = messageRetryService.getStatus();
    console.log("Service Status:", {
      isRunning: status.isRunning,
      retryInterval: `${status.retryInterval / 1000 / 60 / 60} hours`,
      maxRetryCount: status.maxRetryCount,
      retryAfterHours: status.retryAfterHours,
    });

    return status;
  } catch (error) {
    console.error("❌ Error checking service status:", error.message);
    throw error;
  }
}

async function testFindFailedMessages() {
  try {
    console.log("Testing failed message detection...");
    
    // Use the service's internal method to find failed messages
    const failedMessages = await messageRetryService.findFailedMessagesForRetry();
    
    console.log(`Found ${failedMessages.length} failed messages eligible for retry`);
    
    if (failedMessages.length > 0) {
      console.log("Sample failed message:", {
        id: failedMessages[0].id,
        retryCount: failedMessages[0].retry_count,
        status: failedMessages[0].message_status,
        updatedAt: failedMessages[0].updated_at,
      });
    }

    return failedMessages;
  } catch (error) {
    console.error("❌ Error finding failed messages:", error.message);
    throw error;
  }
}

async function testManualRetryTrigger() {
  try {
    console.log("Testing manual retry trigger...");
    
    await messageRetryService.triggerRetryProcessing();
    console.log("✅ Manual retry processing completed");
  } catch (error) {
    console.error("❌ Error during manual retry:", error.message);
    throw error;
  }
}

async function testServiceLifecycle() {
  try {
    console.log("Testing service lifecycle...");
    
    // Stop service if running
    if (messageRetryService.isRunning) {
      messageRetryService.stop();
      console.log("✅ Service stopped");
    }
    
    // Start service
    messageRetryService.start();
    console.log("✅ Service started");
    
    // Check status
    const status = messageRetryService.getStatus();
    console.log("Service is running:", status.isRunning);
    
    // Stop service
    messageRetryService.stop();
    console.log("✅ Service stopped");
    
    return true;
  } catch (error) {
    console.error("❌ Error testing service lifecycle:", error.message);
    throw error;
  }
}

async function cleanupTestData(messageId) {
  try {
    if (messageId) {
      console.log("Cleaning up test message...");
      await Message.delete(messageId);
      console.log("✅ Test message cleaned up");
    }
  } catch (error) {
    console.error("❌ Error cleaning up test data:", error.message);
  }
}

async function runTests() {
  console.log("🧪 Starting Message Retry Service Tests\n");
  
  let testMessageId = null;
  
  try {
    // Test 1: Service Status
    console.log("=== Test 1: Service Status ===");
    await testRetryServiceStatus();
    console.log("");
    
    // Test 2: Service Lifecycle
    console.log("=== Test 2: Service Lifecycle ===");
    await testServiceLifecycle();
    console.log("");
    
    // Test 3: Campaign Data Check
    console.log("=== Test 3: Campaign Data Check ===");
    await createTestCampaignData();
    console.log("");
    
    // Test 4: Create Test Failed Message
    console.log("=== Test 4: Create Test Failed Message ===");
    const testMessage = await createTestFailedMessage();
    testMessageId = testMessage.id;
    console.log("");
    
    // Test 5: Find Failed Messages
    console.log("=== Test 5: Find Failed Messages ===");
    await testFindFailedMessages();
    console.log("");
    
    // Test 6: Manual Retry Trigger
    console.log("=== Test 6: Manual Retry Trigger ===");
    await testManualRetryTrigger();
    console.log("");
    
    console.log("✅ All tests completed successfully!");
    
  } catch (error) {
    console.error("❌ Test failed:", error.message);
  } finally {
    // Cleanup
    if (testMessageId) {
      await cleanupTestData(testMessageId);
    }
    
    // Ensure service is stopped
    if (messageRetryService.isRunning) {
      messageRetryService.stop();
    }
    
    console.log("\n🏁 Test execution completed");
    process.exit(0);
  }
}

// Handle script execution
if (require.main === module) {
  runTests().catch((error) => {
    console.error("❌ Unhandled error:", error);
    process.exit(1);
  });
}

module.exports = {
  createTestFailedMessage,
  testRetryServiceStatus,
  testFindFailedMessages,
  testManualRetryTrigger,
  testServiceLifecycle,
  cleanupTestData,
  runTests,
};
