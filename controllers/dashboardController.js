const Campaign = require("../models/Campaign");
const Template = require("../models/Template");
const Organization = require("../models/Organization");
const User = require("../models/User");
const Audience = require("../models/Audience");
const { AppError, asyncHandler } = require("../middleware/errorHandler");
const logger = require("../utils/logger");

// Get dashboard overview data
const getDashboardOverview = asyncHandler(async (req, res) => {
  let dashboardData = {};

  if (["super_admin", "system_admin"].includes(req.user.role)) {
    // System-wide dashboard for super admin and system admin
    dashboardData = await getSystemDashboard();
  } else {
    // Organization-specific dashboard for organization admin and user
    dashboardData = await getOrganizationDashboard(req.user.organization_id);
  }

  res.json({
    success: true,
    data: dashboardData,
  });
});

// Get dashboard statistics
const getDashboardStats = asyncHandler(async (req, res) => {
  let stats = {};

  if (["super_admin", "system_admin"].includes(req.user.role)) {
    stats = await getSystemStats();
  } else {
    stats = await getOrganizationStats(req.user.organization_id);
  }

  res.json({
    success: true,
    data: { statistics: stats },
  });
});

// Get recent activities
const getRecentActivities = asyncHandler(async (req, res) => {
  const { limit = 10 } = req.query;
  let activities = [];

  if (["super_admin", "system_admin"].includes(req.user.role)) {
    activities = await getSystemActivities(parseInt(limit));
  } else {
    activities = await getOrganizationActivities(
      req.user.organization_id,
      parseInt(limit)
    );
  }

  res.json({
    success: true,
    data: { activities },
  });
});

// System-wide dashboard data
const getSystemDashboard = async () => {
  const [
    totalOrganizations,
    totalUsers,
    totalCampaigns,
    totalTemplates,
    runningCampaigns,
    pendingApprovals,
  ] = await Promise.all([
    Organization.count(),
    User.count(),
    Campaign.count(),
    Template.count(),
    Campaign.count({ status: "running" }),
    getPendingApprovalsCount(),
  ]);

  return {
    overview: {
      total_organizations: totalOrganizations,
      total_users: totalUsers,
      total_campaigns: totalCampaigns,
      total_templates: totalTemplates,
      running_campaigns: runningCampaigns,
      pending_approvals: pendingApprovals,
    },
    user_role: "system_admin",
  };
};

// Organization-specific dashboard data
const getOrganizationDashboard = async (organizationId) => {
  const [
    organizationUsers,
    organizationCampaigns,
    organizationTemplates,
    runningCampaigns,
    totalAudience,
    campaignStats,
  ] = await Promise.all([
    User.count({ organization_id: organizationId }),
    Campaign.count({ organization_id: organizationId }),
    Template.count({ organization_id: organizationId }),
    Campaign.count({ organization_id: organizationId, status: "running" }),
    Audience.countFromTable(
      { organization_id: organizationId },
      "audience_master"
    ),
    Campaign.getCampaignStats(organizationId),
  ]);

  return {
    overview: {
      organization_users: organizationUsers,
      total_campaigns: organizationCampaigns,
      total_templates: organizationTemplates,
      running_campaigns: runningCampaigns,
      total_audience: totalAudience,
      campaign_statistics: campaignStats,
    },
    user_role: "organization",
  };
};

// System-wide statistics
const getSystemStats = async () => {
  const [orgStats, campaignStats, templateStats] = await Promise.all([
    // Organization statistics
    Organization.pool.query(`
      SELECT 
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_organizations,
        COUNT(CASE WHEN status = 'inactive' THEN 1 END) as inactive_organizations
      FROM organizations
    `),

    // Campaign statistics
    Campaign.pool.query(`
      SELECT 
        COUNT(CASE WHEN status = 'draft' THEN 1 END) as draft_campaigns,
        COUNT(CASE WHEN status = 'pending_approval' THEN 1 END) as pending_campaigns,
        COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_campaigns,
        COUNT(CASE WHEN status = 'running' THEN 1 END) as running_campaigns,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_campaigns
      FROM campaigns
    `),

    // Template statistics
    Template.pool.query(`
      SELECT 
        COUNT(CASE WHEN status = 'pending_approval' THEN 1 END) as pending_templates,
        COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_templates,
        COUNT(CASE WHEN status = 'approved' AND approved_by_admin = 'pending' THEN 1 END) as pending_admin_approval_templates,
        COUNT(CASE WHEN status = 'approved' AND approved_by_admin = 'approved' THEN 1 END) as admin_approved_templates,
        COUNT(CASE WHEN approved_by_admin = 'rejected' THEN 1 END) as admin_rejected_templates
      FROM templates
    `),
  ]);

  return {
    ...orgStats.rows[0],
    ...campaignStats.rows[0],
    ...templateStats.rows[0],
  };
};

// Organization-specific statistics
const getOrganizationStats = async (organizationId) => {
  const [campaignStats, templateStats, messageStats] = await Promise.all([
    // Campaign statistics for organization
    Campaign.pool.query(
      `
      SELECT 
        COUNT(CASE WHEN status = 'draft' THEN 1 END) as draft_campaigns,
        COUNT(CASE WHEN status = 'pending_approval' THEN 1 END) as pending_campaigns,
        COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_campaigns,
        COUNT(CASE WHEN status = 'running' THEN 1 END) as running_campaigns,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_campaigns
      FROM campaigns
      WHERE organization_id = $1
    `,
      [organizationId]
    ),

    // Template statistics for organization
    Template.pool.query(
      `
      SELECT 
        COUNT(CASE WHEN status = 'pending_approval' THEN 1 END) as pending_templates,
        COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_templates,
        COUNT(CASE WHEN status = 'approved' AND approved_by_admin = 'pending' THEN 1 END) as pending_admin_approval_templates,
        COUNT(CASE WHEN status = 'approved' AND approved_by_admin = 'approved' THEN 1 END) as admin_approved_templates,
        COUNT(CASE WHEN approved_by_admin = 'rejected' THEN 1 END) as admin_rejected_templates
      FROM templates
      WHERE organization_id = $1
    `,
      [organizationId]
    ),

    // Message statistics for organization
    Campaign.pool.query(
      `
      SELECT 
        COUNT(CASE WHEN ca.message_status = 'sent' THEN 1 END) as messages_sent,
        COUNT(CASE WHEN ca.message_status = 'delivered' THEN 1 END) as messages_delivered,
        COUNT(CASE WHEN ca.message_status = 'failed' THEN 1 END) as messages_failed
      FROM campaign_audience ca
      JOIN campaigns c ON ca.campaign_id = c.id
      WHERE c.organization_id = $1
    `,
      [organizationId]
    ),
  ]);

  return {
    ...campaignStats.rows[0],
    ...templateStats.rows[0],
    ...messageStats.rows[0],
  };
};

// System-wide recent activities
const getSystemActivities = async (limit) => {
  const query = `
    SELECT 
      'campaign' as type,
      c.id,
      c.name,
      c.status::text as status,
      NULL as admin_status,
      c.created_at,
      o.name as organization_name
    FROM campaigns c
    JOIN organizations o ON c.organization_id = o.id
    UNION ALL
    SELECT 
      'template' as type,
      t.id,
      t.name,
      t.status::text as status,
      t.approved_by_admin::text as admin_status,
      t.created_at,
      o.name as organization_name
    FROM templates t
    JOIN organizations o ON t.organization_id = o.id
    ORDER BY created_at DESC
    LIMIT $1
  `;

  const result = await Campaign.pool.query(query, [limit]);
  return result.rows;
};

// Organization-specific recent activities
const getOrganizationActivities = async (organizationId, limit) => {
  const query = `
    SELECT 
      'campaign' as type,
      c.id,
      c.name,
      c.status::text as status,
      NULL as admin_status,
      c.created_at
    FROM campaigns c
    WHERE c.organization_id = $1
    UNION ALL
    SELECT 
      'template' as type,
      t.id,
      t.name,
      t.status::text as status,
      t.approved_by_admin::text as admin_status,
      t.created_at
    FROM templates t
    WHERE t.organization_id = $1
    ORDER BY created_at DESC
    LIMIT $2
  `;

  const result = await Campaign.pool.query(query, [organizationId, limit]);
  return result.rows;
};

// Get pending approvals count (including admin approvals)
const getPendingApprovalsCount = async () => {
  const [pendingCampaigns, pendingTemplates, pendingAdminApprovals] =
    await Promise.all([
      Campaign.count({ status: "pending_approval" }),
      Template.count({ status: "pending_approval" }),
      Template.count({ status: "approved", approved_by_admin: "pending" }),
    ]);

  return pendingCampaigns + pendingTemplates + pendingAdminApprovals;
};

module.exports = {
  getDashboardOverview,
  getDashboardStats,
  getRecentActivities,
};
