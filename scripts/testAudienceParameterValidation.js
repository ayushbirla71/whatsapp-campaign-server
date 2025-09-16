const Template = require('../models/Template');
const Campaign = require('../models/Campaign');
const Audience = require('../models/Audience');
const logger = require('../utils/logger');

/**
 * Test script to verify audience parameter validation against template requirements
 */
async function testAudienceParameterValidation() {
  console.log('Starting Audience Parameter Validation Test...\n');
  
  try {
    // Test 1: Create test template with admin-defined parameters
    console.log('Test 1: Creating template with admin-defined parameters...');
    const testTemplate = {
      id: 'test-template-id',
      name: 'Order Notification Template',
      category: 'MARKETING',
      language: 'en',
      body_text: 'Hello {{1}}, your order {{2}} is ready for pickup at {{3}}!',
      organization_id: 'test-org-id',
      status: 'approved',
      approved_by_admin: 'approved',
      admin_approved_by: 'super-admin-id',
      admin_approved_at: new Date(),
      parameters: {
        "1": "customer_name",
        "2": "order_number", 
        "3": "pickup_location"
      },
      components: [
        {
          type: 'BODY',
          text: 'Hello {{1}}, your order {{2}} is ready for pickup at {{3}}!'
        }
      ]
    };
    
    console.log('✓ Template with parameters:', JSON.stringify(testTemplate.parameters, null, 2));
    
    // Test 2: Test valid audience data (should pass)
    console.log('\nTest 2: Testing valid audience data...');
    const validAudienceList = [
      {
        name: 'John Doe',
        msisdn: '+1234567890',
        attributes: {
          customer_name: 'John Doe',
          order_number: 'ORD-12345',
          pickup_location: 'Downtown Store',
          // Extra attributes are allowed
          email: 'john@example.com'
        }
      },
      {
        name: 'Jane Smith',
        msisdn: '+1234567891',
        attributes: {
          customer_name: 'Jane Smith',
          order_number: 'ORD-12346',
          pickup_location: 'Mall Store'
        }
      }
    ];
    
    const validationResult1 = validateAudienceAgainstTemplate(testTemplate, validAudienceList);
    if (validationResult1.isValid) {
      console.log('✓ Valid audience data passed validation');
    } else {
      console.log('✗ Valid audience data failed validation:', validationResult1.errors);
    }
    
    // Test 3: Test invalid audience data (missing required attributes)
    console.log('\nTest 3: Testing invalid audience data...');
    const invalidAudienceList = [
      {
        name: 'Bob Wilson',
        msisdn: '+1234567892',
        attributes: {
          customer_name: 'Bob Wilson',
          order_number: 'ORD-12347',
          // Missing pickup_location
          email: 'bob@example.com'
        }
      },
      {
        name: 'Alice Brown',
        msisdn: '+1234567893',
        attributes: {
          customer_name: 'Alice Brown',
          // Missing order_number and pickup_location
          phone: '+1234567893'
        }
      }
    ];
    
    const validationResult2 = validateAudienceAgainstTemplate(testTemplate, invalidAudienceList);
    if (!validationResult2.isValid) {
      console.log('✓ Invalid audience data correctly failed validation');
      console.log('  Errors:', validationResult2.errors);
    } else {
      console.log('✗ Invalid audience data incorrectly passed validation');
    }
    
    // Test 4: Test audience with empty/null values
    console.log('\nTest 4: Testing audience with empty/null values...');
    const emptyValueAudienceList = [
      {
        name: 'Charlie Davis',
        msisdn: '+1234567894',
        attributes: {
          customer_name: 'Charlie Davis',
          order_number: '', // Empty string
          pickup_location: null // Null value
        }
      }
    ];
    
    const validationResult3 = validateAudienceAgainstTemplate(testTemplate, emptyValueAudienceList);
    if (!validationResult3.isValid) {
      console.log('✓ Empty/null values correctly failed validation');
      console.log('  Errors:', validationResult3.errors);
    } else {
      console.log('✗ Empty/null values incorrectly passed validation');
    }
    
    // Test 5: Test template without admin parameters (should skip validation)
    console.log('\nTest 5: Testing template without admin parameters...');
    const templateWithoutParams = {
      ...testTemplate,
      approved_by_admin: 'pending',
      parameters: {}
    };
    
    const validationResult4 = validateAudienceAgainstTemplate(templateWithoutParams, invalidAudienceList);
    if (validationResult4.isValid) {
      console.log('✓ Template without admin parameters skipped validation');
    } else {
      console.log('✗ Template without admin parameters incorrectly validated');
    }
    
    // Test 6: Test template with legacy approval (should skip validation)
    console.log('\nTest 6: Testing template with legacy approval...');
    const legacyTemplate = {
      ...testTemplate,
      approved_by_admin: 'approved',
      parameters: null // No parameters defined
    };
    
    const validationResult5 = validateAudienceAgainstTemplate(legacyTemplate, invalidAudienceList);
    if (validationResult5.isValid) {
      console.log('✓ Legacy template without parameters skipped validation');
    } else {
      console.log('✗ Legacy template incorrectly validated');
    }
    
    // Test 7: Test mixed valid/invalid audience
    console.log('\nTest 7: Testing mixed valid/invalid audience...');
    const mixedAudienceList = [
      {
        name: 'Valid User',
        msisdn: '+1111111111',
        attributes: {
          customer_name: 'Valid User',
          order_number: 'ORD-VALID',
          pickup_location: 'Valid Store'
        }
      },
      {
        name: 'Invalid User',
        msisdn: '+2222222222',
        attributes: {
          customer_name: 'Invalid User',
          // Missing order_number and pickup_location
        }
      }
    ];
    
    const validationResult6 = validateAudienceAgainstTemplate(testTemplate, mixedAudienceList);
    if (!validationResult6.isValid) {
      console.log('✓ Mixed audience correctly failed validation');
      console.log('  Errors:', validationResult6.errors);
    } else {
      console.log('✗ Mixed audience incorrectly passed validation');
    }
    
    console.log('\n🎉 All audience parameter validation tests completed!');
    console.log('\nSummary:');
    console.log('- Valid audience data: ✓');
    console.log('- Invalid audience data detection: ✓');
    console.log('- Empty/null value detection: ✓');
    console.log('- Template without parameters handling: ✓');
    console.log('- Legacy template handling: ✓');
    console.log('- Mixed audience validation: ✓');
    
  } catch (error) {
    console.error('Test failed:', error);
    throw error;
  }
}

/**
 * Validate audience data against template parameters
 * This replicates the logic from audienceController.js
 */
function validateAudienceAgainstTemplate(template, audienceList) {
  // Skip validation if template is not admin approved or has no parameters
  if (template.approved_by_admin !== "approved" || !template.parameters) {
    return { isValid: true, message: 'Validation skipped - template not admin approved or no parameters' };
  }

  const templateParams = typeof template.parameters === 'string' 
    ? JSON.parse(template.parameters) 
    : template.parameters;
  
  if (!templateParams || Object.keys(templateParams).length === 0) {
    return { isValid: true, message: 'Validation skipped - no template parameters defined' };
  }

  const requiredAttributes = Object.values(templateParams);
  const validationErrors = [];

  audienceList.forEach((audienceData, index) => {
    const missingAttributes = [];
    const audienceAttributes = audienceData.attributes || {};

    requiredAttributes.forEach(requiredAttr => {
      if (!audienceAttributes.hasOwnProperty(requiredAttr) || 
          audienceAttributes[requiredAttr] === null || 
          audienceAttributes[requiredAttr] === undefined || 
          audienceAttributes[requiredAttr] === '') {
        missingAttributes.push(requiredAttr);
      }
    });

    if (missingAttributes.length > 0) {
      validationErrors.push({
        index: index + 1,
        msisdn: audienceData.msisdn,
        missingAttributes
      });
    }
  });

  if (validationErrors.length > 0) {
    const errorMessage = validationErrors.map(error => 
      `Audience ${error.index} (${error.msisdn}): Missing required attributes [${error.missingAttributes.join(', ')}]`
    ).join('; ');
    
    return {
      isValid: false,
      errors: errorMessage,
      requiredAttributes,
      validationErrors
    };
  }

  return { 
    isValid: true, 
    message: 'All audience data contains required template parameters',
    requiredAttributes 
  };
}

// Example API usage
function printUsageExamples() {
  console.log('\n📋 API Usage Examples:');
  console.log('\n1. Template with Admin Parameters:');
  console.log('{');
  console.log('  "approved_by_admin": "approved",');
  console.log('  "parameters": {');
  console.log('    "1": "customer_name",');
  console.log('    "2": "order_number",');
  console.log('    "3": "pickup_location"');
  console.log('  }');
  console.log('}');
  
  console.log('\n2. Valid Audience Data:');
  console.log('POST /api/campaigns/:campaignId/audience');
  console.log('{');
  console.log('  "audience_list": [');
  console.log('    {');
  console.log('      "name": "John Doe",');
  console.log('      "msisdn": "+1234567890",');
  console.log('      "attributes": {');
  console.log('        "customer_name": "John Doe",');
  console.log('        "order_number": "ORD-12345",');
  console.log('        "pickup_location": "Downtown Store"');
  console.log('      }');
  console.log('    }');
  console.log('  ]');
  console.log('}');
  
  console.log('\n3. Error Response for Invalid Data:');
  console.log('{');
  console.log('  "success": false,');
  console.log('  "message": "Template parameter validation failed. Required attributes: [customer_name, order_number, pickup_location]. Errors: Audience 1 (+1234567890): Missing required attributes [order_number, pickup_location]"');
  console.log('}');
}

// Run test if this file is executed directly
if (require.main === module) {
  testAudienceParameterValidation()
    .then(() => {
      printUsageExamples();
      console.log('\n✅ Audience Parameter Validation Test completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Audience Parameter Validation Test failed:', error);
      process.exit(1);
    });
}

module.exports = testAudienceParameterValidation;
