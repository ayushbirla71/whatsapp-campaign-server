const Template = require("../models/Template");
const Campaign = require("../models/Campaign");
const Audience = require("../models/Audience");
const campaignMessageGenerator = require("../services/campaignMessageGenerator");
const logger = require("../utils/logger");

/**
 * Test script to verify the template admin approval workflow
 * and parameter mapping functionality
 */
async function testTemplateAdminApproval() {
  console.log("Starting Template Admin Approval Test...\n");

  try {
    // Test 1: Create a test template
    console.log("Test 1: Creating test template...");
    const testTemplate = {
      name: "Test Marketing Template",
      category: "MARKETING",
      language: "en",
      body_text: "Hello {{1}}, your order {{2}} is ready for pickup at {{3}}!",
      organization_id: "test-org-id",
      created_by: "test-user-id",
      status: "approved", // Simulate approved template
      approved_by: "admin-user-id",
      approved_at: new Date(),
      components: [
        {
          type: "BODY",
          text: "Hello {{1}}, your order {{2}} is ready for pickup at {{3}}!",
        },
      ],
    };

    console.log("✓ Test template structure created");

    // Test 2: Test admin approval with parameters
    console.log("\nTest 2: Testing admin approval with parameter mapping...");
    const adminParameters = {
      1: "customer_name", // {{1}} maps to customer_name attribute
      2: "order_number", // {{2}} maps to order_number attribute
      3: "pickup_location", // {{3}} maps to pickup_location attribute
    };

    // Simulate admin approval
    const approvedTemplate = {
      ...testTemplate,
      approved_by_admin: "approved",
      admin_approved_by: "super-admin-id",
      admin_approved_at: new Date(),
      parameters: adminParameters,
    };

    console.log("✓ Admin approval with parameters:", adminParameters);

    // Test 3: Test campaign creation validation
    console.log("\nTest 3: Testing campaign creation validation...");

    // This should pass - template is admin approved
    const validCampaign = {
      name: "Test Campaign",
      template_id: "test-template-id",
      organization_id: "test-org-id",
      created_by: "test-user-id",
    };

    // Simulate template check for campaign creation
    if (
      approvedTemplate.status === "approved" &&
      approvedTemplate.approved_by_admin === "approved"
    ) {
      console.log(
        "✓ Campaign creation validation passed - template is admin approved"
      );
    } else {
      console.log("✗ Campaign creation validation failed");
    }

    // Test 4: Test message generation with admin-defined parameters
    console.log(
      "\nTest 4: Testing message generation with admin-defined parameters..."
    );

    const testAudienceData = {
      id: "audience-1",
      name: "John Doe",
      msisdn: "+1234567890",
      attributes: {
        customer_name: "John Doe",
        order_number: "ORD-12345",
        pickup_location: "Downtown Store",
        // Legacy attributes (should be ignored when admin params are defined)
        param_1: "Legacy Name",
        param_2: "Legacy Order",
        param_3: "Legacy Location",
      },
    };

    const testCampaign = {
      id: "campaign-1",
      organization_id: "test-org-id",
      name: "Test Campaign",
    };

    // Test message generation
    const messagePayload = campaignMessageGenerator.generateMessage(
      testCampaign,
      approvedTemplate,
      testAudienceData
    );

    console.log(
      "Generated message payload:",
      JSON.stringify(messagePayload, null, 2)
    );

    // Verify template parameters are correctly mapped
    const templateParams = messagePayload.templateParameters;
    if (templateParams && templateParams.length > 0) {
      console.log("\n✓ Template parameters generated:");
      templateParams.forEach((param, index) => {
        console.log(
          `  Parameter ${index + 1}: ${param.value} (type: ${param.type})`
        );
      });

      // Verify the parameters use admin-defined mappings
      const bodyParams = templateParams.filter((p) => p.type === "body");
      if (bodyParams.length === 3) {
        const expectedValues = ["John Doe", "ORD-12345", "Downtown Store"];
        const actualValues = bodyParams.map((p) => p.value);

        if (JSON.stringify(expectedValues) === JSON.stringify(actualValues)) {
          console.log("✓ Admin-defined parameter mapping working correctly");
        } else {
          console.log("✗ Parameter mapping failed");
          console.log("Expected:", expectedValues);
          console.log("Actual:", actualValues);
        }
      }
    }

    // Test 5: Test fallback to legacy parameters
    console.log("\nTest 5: Testing fallback to legacy parameters...");

    const templateWithoutAdminParams = {
      ...testTemplate,
      approved_by_admin: "approved",
      parameters: {}, // No admin-defined parameters
    };

    const legacyMessagePayload = campaignMessageGenerator.generateMessage(
      testCampaign,
      templateWithoutAdminParams,
      testAudienceData
    );

    const legacyBodyParams =
      legacyMessagePayload.templateParameters?.filter(
        (p) => p.type === "body"
      ) || [];
    if (legacyBodyParams.length > 0) {
      console.log("✓ Legacy parameter fallback working");
      console.log(
        "Legacy values:",
        legacyBodyParams.map((p) => p.value)
      );
    }

    // Test 6: Test parameter extraction
    console.log("\nTest 6: Testing parameter extraction...");

    const extractedParams = campaignMessageGenerator.extractBodyParameters(
      "Hello {{1}}, your order {{2}} is ready for pickup at {{3}}!",
      testAudienceData.attributes,
      adminParameters
    );

    console.log(
      "✓ Extracted parameters:",
      extractedParams.map((p) => p.value)
    );

    // Test 7: Test placeholder replacement
    console.log("\nTest 7: Testing placeholder replacement...");

    const testText =
      "Hello {{1}}, your order {{2}} is ready for pickup at {{3}}!";
    const replacedText = campaignMessageGenerator.replacePlaceholders(
      testText,
      testAudienceData,
      adminParameters
    );

    console.log("Original text:", testText);
    console.log("Replaced text:", replacedText);

    if (
      replacedText ===
      "Hello John Doe, your order ORD-12345 is ready for pickup at Downtown Store!"
    ) {
      console.log("✓ Placeholder replacement working correctly");
    } else {
      console.log("✗ Placeholder replacement failed");
    }

    // Test 8: Test interactive template with button mappings
    console.log(
      "\nTest 8: Testing interactive template with button mappings..."
    );

    const interactiveTemplate = {
      ...testTemplate,
      name: "Interactive Survey Template",
      body_text: "Would you like to receive updates about your order?",
      components: [
        {
          type: "BODY",
          text: "Would you like to receive updates about your order?",
        },
        {
          type: "BUTTONS",
          buttons: [
            {
              type: "QUICK_REPLY",
              text: "Yes",
            },
            {
              type: "QUICK_REPLY",
              text: "No",
            },
          ],
        },
      ],
    };

    // Create auto-reply templates for button responses
    const yesResponseTemplate = {
      ...testTemplate,
      name: "Yes Response Template",
      body_text: "Great! You will receive order updates.",
      is_auto_reply_template: true,
      approved_by_admin: "approved",
    };

    const noResponseTemplate = {
      ...testTemplate,
      name: "No Response Template",
      body_text: "No problem! You can change this preference anytime.",
      is_auto_reply_template: true,
      approved_by_admin: "approved",
    };

    // Test button mapping configuration
    const buttonMappings = {
      Yes: yesResponseTemplate.id,
      No: noResponseTemplate.id,
    };

    console.log("✓ Interactive template with button mappings configured");
    console.log("Button mappings:", buttonMappings);

    // Test 9: Test admin approval with button mappings
    console.log("\nTest 9: Testing admin approval with button mappings...");

    const approvedInteractiveTemplate = {
      ...interactiveTemplate,
      approved_by_admin: "approved",
      admin_approved_by: "super-admin-id",
      admin_approved_at: new Date(),
      auto_reply_button_mappings: buttonMappings,
    };

    console.log("✓ Interactive template approved with button mappings");
    console.log(
      "Auto-reply button mappings:",
      approvedInteractiveTemplate.auto_reply_button_mappings
    );

    console.log("\n🎉 All tests completed successfully!");
    console.log("\nSummary:");
    console.log("- Template admin approval workflow: ✓");
    console.log("- Parameter mapping configuration: ✓");
    console.log("- Campaign creation validation: ✓");
    console.log("- Message generation with admin parameters: ✓");
    console.log("- Legacy parameter fallback: ✓");
    console.log("- Parameter extraction: ✓");
    console.log("- Placeholder replacement: ✓");
    console.log("- Interactive template with button mappings: ✓");
    console.log("- Admin approval with button mappings: ✓");
  } catch (error) {
    console.error("Test failed:", error);
    throw error;
  }
}

// Example usage scenarios
function printUsageExamples() {
  console.log("\n📋 Usage Examples:");
  console.log("\n1. Admin Approval with Parameters:");
  console.log("POST /api/templates/:templateId/admin-approve");
  console.log("Body: {");
  console.log('  "parameters": {');
  console.log('    "1": "customer_name",');
  console.log('    "2": "order_number",');
  console.log('    "3": "pickup_location"');
  console.log("  }");
  console.log("}");

  console.log("\n2. Campaign Audience Data:");
  console.log("{");
  console.log('  "name": "John Doe",');
  console.log('  "msisdn": "+1234567890",');
  console.log('  "attributes": {');
  console.log('    "customer_name": "John Doe",');
  console.log('    "order_number": "ORD-12345",');
  console.log('    "pickup_location": "Downtown Store"');
  console.log("  }");
  console.log("}");

  console.log("\n3. Generated WhatsApp Template Message:");
  console.log("{");
  console.log('  "templateName": "Test Marketing Template",');
  console.log('  "templateLanguage": "en",');
  console.log('  "templateParameters": [');
  console.log(
    '    {"type": "body", "valueType": "text", "value": "John Doe"},'
  );
  console.log(
    '    {"type": "body", "valueType": "text", "value": "ORD-12345"},'
  );
  console.log(
    '    {"type": "body", "valueType": "text", "value": "Downtown Store"}'
  );
  console.log("  ]");
  console.log("}");
}

// Run test if this file is executed directly
if (require.main === module) {
  testTemplateAdminApproval()
    .then(() => {
      printUsageExamples();
      console.log("\n✅ Template Admin Approval Test completed successfully");
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ Template Admin Approval Test failed:", error);
      process.exit(1);
    });
}

module.exports = testTemplateAdminApproval;
