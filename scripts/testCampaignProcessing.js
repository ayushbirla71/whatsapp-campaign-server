#!/usr/bin/env node

/**
 * Test script for campaign processing and SQS integration
 * This script demonstrates how the campaign processing works
 */

require('dotenv').config();
const campaignMessageGenerator = require('../services/campaignMessageGenerator');
const sqsService = require('../services/sqsService');
const logger = require('../utils/logger');

// Sample test data
const sampleCampaign = {
  id: '123e4567-e89b-12d3-a456-426614174001',
  organization_id: '123e4567-e89b-12d3-a456-426614174000',
  name: 'Test Campaign',
  status: 'asset_generated'
};

const sampleTemplate = {
  id: '123e4567-e89b-12d3-a456-426614174003',
  name: 'welcome_message',
  category: 'MARKETING',
  language: 'en',
  body_text: 'Hi {{1}}, welcome to our store! Get {{2}}% off your first purchase.',
  components: [
    {
      type: 'HEADER',
      format: 'TEXT',
      text: 'Welcome to Our Store!'
    },
    {
      type: 'BODY',
      text: 'Hi {{1}}, welcome to our store! Get {{2}}% off your first purchase with code WELCOME{{3}}.',
      example: {
        body_text: [
          ['John', '20', '2024']
        ]
      }
    },
    {
      type: 'FOOTER',
      text: 'Terms and conditions apply'
    }
  ]
};

const sampleAudienceList = [
  {
    id: '123e4567-e89b-12d3-a456-426614174004',
    campaign_id: sampleCampaign.id,
    organization_id: sampleCampaign.organization_id,
    name: 'John Doe',
    msisdn: '+1234567890',
    attributes: {
      param_1: 'John',
      param_2: '20',
      param_3: '2024'
    }
  },
  {
    id: '123e4567-e89b-12d3-a456-426614174005',
    campaign_id: sampleCampaign.id,
    organization_id: sampleCampaign.organization_id,
    name: 'Jane Smith',
    msisdn: '+1234567891',
    attributes: {
      param_1: 'Jane',
      param_2: '25',
      param_3: '2024'
    }
  }
];

async function testMessageGeneration() {
  console.log('\n🧪 Testing Message Generation...\n');

  try {
    for (const audienceData of sampleAudienceList) {
      console.log(`Generating message for: ${audienceData.name}`);
      
      const messagePayload = campaignMessageGenerator.generateMessage(
        sampleCampaign,
        sampleTemplate,
        audienceData
      );

      console.log('Generated message payload:');
      console.log(JSON.stringify(messagePayload, null, 2));

      // Validate the payload
      const isValid = campaignMessageGenerator.validateMessagePayload(messagePayload);
      console.log(`Validation result: ${isValid ? '✅ Valid' : '❌ Invalid'}`);
      console.log('---');
    }
  } catch (error) {
    console.error('❌ Error during message generation:', error.message);
  }
}

async function testSQSIntegration() {
  console.log('\n📡 Testing SQS Integration...\n');

  try {
    // Check if SQS is configured
    const isConfigured = await sqsService.isConfigured();
    console.log(`SQS Configuration: ${isConfigured ? '✅ Configured' : '❌ Not Configured'}`);

    if (!isConfigured) {
      console.log('⚠️  SQS is not configured. Please set up AWS credentials and queue URL.');
      return;
    }

    // Generate test messages
    const testMessages = [];
    for (const audienceData of sampleAudienceList) {
      const messagePayload = campaignMessageGenerator.generateMessage(
        sampleCampaign,
        sampleTemplate,
        audienceData
      );
      testMessages.push(messagePayload);
    }

    // Send messages to SQS
    console.log(`Sending ${testMessages.length} messages to SQS...`);
    const result = await sqsService.sendMessageBatch(testMessages, {
      messageGroupId: process.env.SQS_MESSAGE_GROUP_ID || 'test-messages'
    });

    console.log('SQS Send Result:');
    console.log(`✅ Successful: ${result.Successful?.length || 0}`);
    console.log(`❌ Failed: ${result.Failed?.length || 0}`);

    if (result.Failed && result.Failed.length > 0) {
      console.log('Failed messages:', result.Failed);
    }

  } catch (error) {
    console.error('❌ Error during SQS testing:', error.message);
  }
}

async function testTextMessage() {
  console.log('\n📝 Testing Text Message Generation...\n');

  const textTemplate = {
    id: '123e4567-e89b-12d3-a456-426614174006',
    name: 'simple_text',
    category: 'UTILITY',
    language: 'en',
    body_text: 'Hello {{name}}, your order #{{order_id}} is ready for pickup!'
  };

  const textAudience = {
    id: '123e4567-e89b-12d3-a456-426614174007',
    campaign_id: sampleCampaign.id,
    organization_id: sampleCampaign.organization_id,
    name: 'Alice Johnson',
    msisdn: '+1234567892',
    attributes: {
      order_id: 'ORD-12345'
    }
  };

  try {
    const messagePayload = campaignMessageGenerator.generateMessage(
      sampleCampaign,
      textTemplate,
      textAudience
    );

    console.log('Text message payload:');
    console.log(JSON.stringify(messagePayload, null, 2));

    const isValid = campaignMessageGenerator.validateMessagePayload(messagePayload);
    console.log(`Validation result: ${isValid ? '✅ Valid' : '❌ Invalid'}`);

  } catch (error) {
    console.error('❌ Error during text message generation:', error.message);
  }
}

async function testMediaMessage() {
  console.log('\n🖼️  Testing Media Message Generation...\n');

  const mediaTemplate = {
    id: '123e4567-e89b-12d3-a456-426614174008',
    name: 'product_image',
    category: 'MARKETING',
    language: 'en',
    header_type: 'IMAGE',
    header_media_url: 'https://example.com/images/{{name}}-offer.jpg',
    body_text: 'Special offer for {{name}}! Check out this amazing deal.'
  };

  const mediaAudience = {
    id: '123e4567-e89b-12d3-a456-426614174009',
    campaign_id: sampleCampaign.id,
    organization_id: sampleCampaign.organization_id,
    name: 'Bob Wilson',
    msisdn: '+1234567893',
    attributes: {
      image_url: 'https://example.com/images/bob-offer.jpg'
    }
  };

  try {
    const messagePayload = campaignMessageGenerator.generateMessage(
      sampleCampaign,
      mediaTemplate,
      mediaAudience
    );

    console.log('Media message payload:');
    console.log(JSON.stringify(messagePayload, null, 2));

    const isValid = campaignMessageGenerator.validateMessagePayload(messagePayload);
    console.log(`Validation result: ${isValid ? '✅ Valid' : '❌ Invalid'}`);

  } catch (error) {
    console.error('❌ Error during media message generation:', error.message);
  }
}

async function runTests() {
  console.log('🚀 Starting Campaign Processing Tests\n');
  console.log('=====================================');

  await testMessageGeneration();
  await testTextMessage();
  await testMediaMessage();
  await testSQSIntegration();

  console.log('\n✅ All tests completed!');
  console.log('\n📋 Next Steps:');
  console.log('1. Configure AWS SQS credentials in .env file');
  console.log('2. Create campaigns with asset_generated status');
  console.log('3. Use the API endpoints to process campaigns');
  console.log('4. Monitor SQS queue for generated messages');
}

// Run tests if this script is executed directly
if (require.main === module) {
  runTests().catch(error => {
    console.error('❌ Test execution failed:', error.message);
    process.exit(1);
  });
}

module.exports = {
  testMessageGeneration,
  testSQSIntegration,
  testTextMessage,
  testMediaMessage,
  runTests
};
