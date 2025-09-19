# WhatsApp Server API - Frontend Implementation Guide

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [API Client Setup](#api-client-setup)
4. [User Management](#user-management)
5. [Organization Management](#organization-management)
6. [Template Management](#template-management)
7. [Template Admin Approval Workflow](#template-admin-approval-workflow)
8. [Campaign Management](#campaign-management)
9. [Audience Management with Validation](#audience-management-with-validation)
10. [Error Handling](#error-handling)
11. [State Management](#state-management)
12. [UI Components](#ui-components)
13. [Real-time Updates](#real-time-updates)

## Overview

This guide provides complete frontend implementation details for integrating with the WhatsApp Server API. The API includes role-based access control, template admin approval workflow, and audience parameter validation.

### Key Features

- **Authentication & Authorization**: JWT-based with role management
- **Template Admin Approval**: Two-stage approval process with parameter mapping
- **Audience Parameter Validation**: Validates audience data against template requirements
- **Real-time Updates**: WebSocket support for live notifications
- **File Uploads**: Media handling for templates and campaigns

### User Roles

- **Super Admin**: Full system access
- **System Admin**: Cross-organization management
- **Organization Admin**: Organization-level management
- **Organization User**: Limited access within organization

## Authentication

### Login Implementation

```javascript
// auth.js
class AuthService {
  constructor() {
    this.baseURL = process.env.REACT_APP_API_URL || "http://localhost:3000/api";
    this.token = localStorage.getItem("accessToken");
    this.refreshToken = localStorage.getItem("refreshToken");
  }

  async login(email, password) {
    try {
      const response = await fetch(`${this.baseURL}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Login failed");
      }

      // Store tokens
      this.token = data.data.accessToken;
      this.refreshToken = data.data.refreshToken;
      localStorage.setItem("accessToken", this.token);
      localStorage.setItem("refreshToken", this.refreshToken);
      localStorage.setItem("user", JSON.stringify(data.data.user));

      return data.data;
    } catch (error) {
      throw new Error(error.message);
    }
  }

  async refreshAccessToken() {
    try {
      const response = await fetch(`${this.baseURL}/auth/refresh`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ refreshToken: this.refreshToken }),
      });

      const data = await response.json();

      if (!response.ok) {
        this.logout();
        throw new Error("Session expired");
      }

      this.token = data.data.accessToken;
      localStorage.setItem("accessToken", this.token);

      return this.token;
    } catch (error) {
      this.logout();
      throw error;
    }
  }

  logout() {
    this.token = null;
    this.refreshToken = null;
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("user");
    window.location.href = "/login";
  }

  getUser() {
    const user = localStorage.getItem("user");
    return user ? JSON.parse(user) : null;
  }

  isAuthenticated() {
    return !!this.token;
  }

  hasRole(requiredRoles) {
    const user = this.getUser();
    if (!user) return false;

    if (Array.isArray(requiredRoles)) {
      return requiredRoles.includes(user.role);
    }
    return user.role === requiredRoles;
  }
}

export default new AuthService();
```

### Protected Route Component

```jsx
// components/ProtectedRoute.jsx
import React from "react";
import { Navigate } from "react-router-dom";
import AuthService from "../services/auth";

const ProtectedRoute = ({ children, requiredRoles = null }) => {
  const isAuthenticated = AuthService.isAuthenticated();
  const hasRequiredRole = requiredRoles
    ? AuthService.hasRole(requiredRoles)
    : true;

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!hasRequiredRole) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
};

export default ProtectedRoute;
```

## API Client Setup

### HTTP Client with Interceptors

```javascript
// services/apiClient.js
import AuthService from "./auth";

class ApiClient {
  constructor() {
    this.baseURL = process.env.REACT_APP_API_URL || "http://localhost:3000/api";
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const config = {
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
      ...options,
    };

    // Add auth token if available
    if (AuthService.token) {
      config.headers.Authorization = `Bearer ${AuthService.token}`;
    }

    try {
      let response = await fetch(url, config);

      // Handle token refresh
      if (response.status === 401 && AuthService.refreshToken) {
        try {
          await AuthService.refreshAccessToken();
          config.headers.Authorization = `Bearer ${AuthService.token}`;
          response = await fetch(url, config);
        } catch (refreshError) {
          AuthService.logout();
          throw new Error("Session expired");
        }
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || `HTTP ${response.status}`);
      }

      return data;
    } catch (error) {
      console.error("API Request failed:", error);
      throw error;
    }
  }

  // HTTP Methods
  get(endpoint, params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const url = queryString ? `${endpoint}?${queryString}` : endpoint;
    return this.request(url, { method: "GET" });
  }

  post(endpoint, data = {}) {
    return this.request(endpoint, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  put(endpoint, data = {}) {
    return this.request(endpoint, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  delete(endpoint) {
    return this.request(endpoint, { method: "DELETE" });
  }

  // File upload
  upload(endpoint, formData) {
    return this.request(endpoint, {
      method: "POST",
      headers: {}, // Let browser set Content-Type for FormData
      body: formData,
    });
  }
}

export default new ApiClient();
```

## User Management

### User Service

```javascript
// services/userService.js
import ApiClient from "./apiClient";

class UserService {
  async getUsers(params = {}) {
    return ApiClient.get("/users", params);
  }

  async getUserById(userId) {
    return ApiClient.get(`/users/${userId}`);
  }

  async createUser(userData) {
    return ApiClient.post("/users", userData);
  }

  async updateUser(userId, userData) {
    return ApiClient.put(`/users/${userId}`, userData);
  }

  async deleteUser(userId) {
    return ApiClient.delete(`/users/${userId}`);
  }

  async updateProfile(userData) {
    return ApiClient.put("/users/profile", userData);
  }

  async changePassword(passwordData) {
    return ApiClient.put("/users/change-password", passwordData);
  }
}

export default new UserService();
```

### User Management Component

```jsx
// components/UserManagement.jsx
import React, { useState, useEffect } from "react";
import UserService from "../services/userService";
import AuthService from "../services/auth";

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const currentUser = AuthService.getUser();
  const canManageUsers = AuthService.hasRole([
    "super_admin",
    "system_admin",
    "organization_admin",
  ]);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const response = await UserService.getUsers();
      setUsers(response.data.users);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (userData) => {
    try {
      await UserService.createUser(userData);
      setShowCreateModal(false);
      loadUsers();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteUser = async (userId) => {
    if (window.confirm("Are you sure you want to delete this user?")) {
      try {
        await UserService.deleteUser(userId);
        loadUsers();
      } catch (err) {
        setError(err.message);
      }
    }
  };

  if (loading) return <div className="loading">Loading users...</div>;
  if (error) return <div className="error">Error: {error}</div>;

  return (
    <div className="user-management">
      <div className="header">
        <h2>User Management</h2>
        {canManageUsers && (
          <button
            className="btn btn-primary"
            onClick={() => setShowCreateModal(true)}
          >
            Create User
          </button>
        )}
      </div>

      <div className="users-table">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Organization</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>
                  {user.first_name} {user.last_name}
                </td>
                <td>{user.email}</td>
                <td>{user.role}</td>
                <td>{user.organization_name}</td>
                <td>
                  <span className={`status ${user.status}`}>{user.status}</span>
                </td>
                <td>
                  {canManageUsers && user.id !== currentUser.id && (
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => handleDeleteUser(user.id)}
                    >
                      Delete
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCreateModal && (
        <CreateUserModal
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreateUser}
        />
      )}
    </div>
  );
};

export default UserManagement;
```

## Organization Management

### Organization Service

```javascript
// services/organizationService.js
import ApiClient from "./apiClient";

class OrganizationService {
  async getOrganizations(params = {}) {
    return ApiClient.get("/organizations", params);
  }

  async getOrganizationById(orgId) {
    return ApiClient.get(`/organizations/${orgId}`);
  }

  async createOrganization(orgData) {
    return ApiClient.post("/organizations", orgData);
  }

  async updateOrganization(orgId, orgData) {
    return ApiClient.put(`/organizations/${orgId}`, orgData);
  }

  async deleteOrganization(orgId) {
    return ApiClient.delete(`/organizations/${orgId}`);
  }

  async updateWhatsAppConfig(orgId, config) {
    return ApiClient.put(`/organizations/${orgId}/whatsapp-config`, config);
  }

  async getWhatsAppConfig(orgId) {
    return ApiClient.get(`/organizations/${orgId}/whatsapp-config`);
  }

  async getOrganizationUsers(orgId, role = null) {
    const params = role ? { role } : {};
    return ApiClient.get(`/organizations/${orgId}/users`, params);
  }
}

export default new OrganizationService();
```

### WhatsApp Configuration Component

````jsx
// components/WhatsAppConfig.jsx
import React, { useState, useEffect } from 'react';
import OrganizationService from '../services/organizationService';

const WhatsAppConfig = ({ organizationId }) => {
  const [config, setConfig] = useState({
    whatsapp_business_account_id: '',
    whatsapp_access_token: '',
    whatsapp_phone_number_id: '',
    whatsapp_webhook_verify_token: '',
    whatsapp_webhook_url: '',
    whatsapp_app_id: '',
    whatsapp_app_secret: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    loadConfig();
  }, [organizationId]);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const response = await OrganizationService.getWhatsAppConfig(organizationId);
      setConfig(response.data.whatsapp_config);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError(null);
      await OrganizationService.updateWhatsAppConfig(organizationId, config);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (e) => {
    setConfig({
      ...config,
      [e.target.name]: e.target.value,
    });
  };

  if (loading) return <div className="loading">Loading configuration...</div>;

  return (
    <div className="whatsapp-config">
      <h3>WhatsApp Business Configuration</h3>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">Configuration updated successfully!</div>}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="whatsapp_business_account_id">Business Account ID</label>
          <input
            type="text"
            id="whatsapp_business_account_id"
            name="whatsapp_business_account_id"
            value={config.whatsapp_business_account_id}
            onChange={handleChange}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="whatsapp_access_token">Access Token</label>
          <input
            type="password"
            id="whatsapp_access_token"
            name="whatsapp_access_token"
            value={config.whatsapp_access_token}
            onChange={handleChange}
            required
          />
          <small>This will be encrypted when stored</small>
        </div>

        <div className="form-group">
          <label htmlFor="whatsapp_phone_number_id">Phone Number ID</label>
          <input
            type="text"
            id="whatsapp_phone_number_id"
            name="whatsapp_phone_number_id"
            value={config.whatsapp_phone_number_id}
            onChange={handleChange}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="whatsapp_webhook_verify_token">Webhook Verify Token</label>
          <input
            type="text"
            id="whatsapp_webhook_verify_token"
            name="whatsapp_webhook_verify_token"
            value={config.whatsapp_webhook_verify_token}
            onChange={handleChange}
          />
        </div>

        <div className="form-group">
          <label htmlFor="whatsapp_webhook_url">Webhook URL</label>
          <input
            type="url"
            id="whatsapp_webhook_url"
            name="whatsapp_webhook_url"
            value={config.whatsapp_webhook_url}
            onChange={handleChange}
          />
        </div>

        <div className="form-group">
          <label htmlFor="whatsapp_app_id">App ID</label>
          <input
            type="text"
            id="whatsapp_app_id"
            name="whatsapp_app_id"
            value={config.whatsapp_app_id}
            onChange={handleChange}
          />
        </div>

        <div className="form-group">
          <label htmlFor="whatsapp_app_secret">App Secret</label>
          <input
            type="password"
            id="whatsapp_app_secret"
            name="whatsapp_app_secret"
            value={config.whatsapp_app_secret}
            onChange={handleChange}
          />
          <small>This will be encrypted when stored</small>
        </div>

        <button
          type="submit"
          className="btn btn-primary"
          disabled={saving}
        >
          {saving ? 'Saving...' : 'Save Configuration'}
        </button>
      </form>
    </div>
  );
};

export default WhatsAppConfig;

## Template Management

### Template Service

```javascript
// services/templateService.js
import ApiClient from './apiClient';

class TemplateService {
  async getTemplates(params = {}) {
    return ApiClient.get('/templates', params);
  }

  async getTemplateById(templateId) {
    return ApiClient.get(`/templates/${templateId}`);
  }

  async createTemplate(templateData) {
    return ApiClient.post('/templates', templateData);
  }

  async updateTemplate(templateId, templateData) {
    return ApiClient.put(`/templates/${templateId}`, templateData);
  }

  async deleteTemplate(templateId) {
    return ApiClient.delete(`/templates/${templateId}`);
  }

  async submitForApproval(templateId) {
    return ApiClient.post(`/templates/${templateId}/submit-approval`);
  }

  async approveTemplate(templateId) {
    return ApiClient.post(`/templates/${templateId}/approve`);
  }

  async rejectTemplate(templateId, reason) {
    return ApiClient.post(`/templates/${templateId}/reject`, { rejection_reason: reason });
  }

  async syncWithWhatsApp(templateId) {
    return ApiClient.post(`/templates/${templateId}/sync-whatsapp`);
  }

  // Admin Approval Methods
  async getPendingAdminApprovalTemplates() {
    return ApiClient.get('/templates/pending-admin-approval');
  }

  async adminApproveTemplate(templateId, parameters) {
    return ApiClient.post(`/templates/${templateId}/admin-approve`, { parameters });
  }

  async adminRejectTemplate(templateId, reason) {
    return ApiClient.post(`/templates/${templateId}/admin-reject`, { rejection_reason: reason });
  }

  async updateTemplateParameters(templateId, parameters) {
    return ApiClient.put(`/templates/${templateId}/parameters`, { parameters });
  }
}

export default new TemplateService();
````

### Template List Component

```jsx
// components/TemplateList.jsx
import React, { useState, useEffect } from "react";
import TemplateService from "../services/templateService";
import AuthService from "../services/auth";

const TemplateList = () => {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("all");

  const currentUser = AuthService.getUser();
  const canApproveTemplates = AuthService.hasRole([
    "super_admin",
    "system_admin",
  ]);
  const canAdminApprove = AuthService.hasRole(["super_admin", "system_admin"]);

  useEffect(() => {
    loadTemplates();
  }, [filter]);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const params = filter !== "all" ? { status: filter } : {};
      const response = await TemplateService.getTemplates(params);
      setTemplates(response.data.templates);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (templateId) => {
    try {
      await TemplateService.approveTemplate(templateId);
      loadTemplates();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleReject = async (templateId) => {
    const reason = prompt("Enter rejection reason:");
    if (reason) {
      try {
        await TemplateService.rejectTemplate(templateId, reason);
        loadTemplates();
      } catch (err) {
        setError(err.message);
      }
    }
  };

  const getStatusBadge = (template) => {
    const { status, approved_by_admin } = template;

    if (status === "approved" && approved_by_admin === "approved") {
      return <span className="badge badge-success">Ready for Campaign</span>;
    } else if (status === "approved" && approved_by_admin === "pending") {
      return (
        <span className="badge badge-warning">Pending Admin Approval</span>
      );
    } else if (status === "approved" && approved_by_admin === "rejected") {
      return <span className="badge badge-danger">Admin Rejected</span>;
    } else {
      return <span className={`badge badge-${status}`}>{status}</span>;
    }
  };

  if (loading) return <div className="loading">Loading templates...</div>;
  if (error) return <div className="error">Error: {error}</div>;

  return (
    <div className="template-list">
      <div className="header">
        <h2>Templates</h2>
        <div className="filters">
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">All Templates</option>
            <option value="draft">Draft</option>
            <option value="pending_approval">Pending Approval</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>

      <div className="templates-grid">
        {templates.map((template) => (
          <div key={template.id} className="template-card">
            <div className="template-header">
              <h3>{template.name}</h3>
              {getStatusBadge(template)}
            </div>

            <div className="template-content">
              <p>
                <strong>Category:</strong> {template.category}
              </p>
              <p>
                <strong>Language:</strong> {template.language}
              </p>
              <div className="template-body">
                <strong>Body:</strong>
                <p>{template.body_text}</p>
              </div>
            </div>

            <div className="template-actions">
              {canApproveTemplates &&
                template.status === "pending_approval" && (
                  <>
                    <button
                      className="btn btn-success btn-sm"
                      onClick={() => handleApprove(template.id)}
                    >
                      Approve
                    </button>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => handleReject(template.id)}
                    >
                      Reject
                    </button>
                  </>
                )}

              {canAdminApprove &&
                template.status === "approved" &&
                template.approved_by_admin === "pending" && (
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() =>
                      (window.location.href = `/templates/${template.id}/admin-approval`)
                    }
                  >
                    Admin Review
                  </button>
                )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TemplateList;
```

## Template Admin Approval Workflow

### Admin Approval Component

```jsx
// components/TemplateAdminApproval.jsx
import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import TemplateService from "../services/templateService";

const TemplateAdminApproval = () => {
  const { templateId } = useParams();
  const navigate = useNavigate();

  const [template, setTemplate] = useState(null);
  const [parameters, setParameters] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [showRejectModal, setShowRejectModal] = useState(false);

  useEffect(() => {
    loadTemplate();
  }, [templateId]);

  const loadTemplate = async () => {
    try {
      setLoading(true);
      const response = await TemplateService.getTemplateById(templateId);
      const templateData = response.data.template;
      setTemplate(templateData);

      // Extract placeholders from template body
      const placeholders = extractPlaceholders(templateData.body_text);
      const initialParams = {};
      placeholders.forEach((placeholder, index) => {
        initialParams[placeholder] = "";
      });
      setParameters(initialParams);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const extractPlaceholders = (text) => {
    const regex = /\{\{(\d+)\}\}/g;
    const matches = [];
    let match;
    while ((match = regex.exec(text)) !== null) {
      matches.push(match[1]);
    }
    return [...new Set(matches)].sort();
  };

  const handleParameterChange = (placeholder, value) => {
    setParameters({
      ...parameters,
      [placeholder]: value,
    });
  };

  const handleApprove = async () => {
    try {
      setSaving(true);
      setError(null);

      // Validate that all parameters are mapped
      const emptyParams = Object.entries(parameters).filter(
        ([key, value]) => !value.trim()
      );
      if (emptyParams.length > 0) {
        setError("Please map all template parameters before approving.");
        return;
      }

      await TemplateService.adminApproveTemplate(templateId, parameters);
      navigate("/templates", {
        state: {
          message: "Template approved successfully for campaign usage!",
        },
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      setError("Please provide a rejection reason.");
      return;
    }

    try {
      setSaving(true);
      setError(null);
      await TemplateService.adminRejectTemplate(templateId, rejectionReason);
      navigate("/templates", {
        state: { message: "Template rejected for campaign usage." },
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
      setShowRejectModal(false);
    }
  };

  if (loading) return <div className="loading">Loading template...</div>;
  if (error && !template) return <div className="error">Error: {error}</div>;

  const placeholders = extractPlaceholders(template.body_text);

  return (
    <div className="template-admin-approval">
      <div className="header">
        <h2>Admin Approval: {template.name}</h2>
        <div className="status">
          <span className="badge badge-warning">Pending Admin Approval</span>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="template-preview">
        <h3>Template Preview</h3>
        <div className="template-card">
          <p>
            <strong>Category:</strong> {template.category}
          </p>
          <p>
            <strong>Language:</strong> {template.language}
          </p>
          <div className="template-body">
            <strong>Body Text:</strong>
            <div className="body-preview">{template.body_text}</div>
          </div>
          {template.header_text && (
            <div className="template-header">
              <strong>Header:</strong> {template.header_text}
            </div>
          )}
          {template.footer_text && (
            <div className="template-footer">
              <strong>Footer:</strong> {template.footer_text}
            </div>
          )}
        </div>
      </div>

      <div className="parameter-mapping">
        <h3>Parameter Mapping</h3>
        <p>Map each template parameter to an audience attribute name:</p>

        {placeholders.length > 0 ? (
          <div className="parameters-form">
            {placeholders.map((placeholder) => (
              <div key={placeholder} className="parameter-row">
                <label>
                  <strong>Parameter {{ placeholder }}:</strong>
                  <input
                    type="text"
                    value={parameters[placeholder] || ""}
                    onChange={(e) =>
                      handleParameterChange(placeholder, e.target.value)
                    }
                    placeholder="e.g., customer_name, order_number, etc."
                    required
                  />
                </label>
                <small>
                  This parameter will be replaced with the value from the
                  audience's "{parameters[placeholder] || "attribute_name"}"
                  field
                </small>
              </div>
            ))}
          </div>
        ) : (
          <p className="no-parameters">
            This template has no parameters to map.
          </p>
        )}
      </div>

      <div className="approval-actions">
        <button
          className="btn btn-success"
          onClick={handleApprove}
          disabled={saving}
        >
          {saving ? "Approving..." : "Approve for Campaign Usage"}
        </button>

        <button
          className="btn btn-danger"
          onClick={() => setShowRejectModal(true)}
          disabled={saving}
        >
          Reject
        </button>

        <button
          className="btn btn-secondary"
          onClick={() => navigate("/templates")}
        >
          Cancel
        </button>
      </div>

      {showRejectModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Reject Template</h3>
            <div className="form-group">
              <label htmlFor="rejectionReason">Rejection Reason:</label>
              <textarea
                id="rejectionReason"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Please provide a detailed reason for rejection..."
                rows={4}
                required
              />
            </div>
            <div className="modal-actions">
              <button
                className="btn btn-danger"
                onClick={handleReject}
                disabled={saving}
              >
                {saving ? "Rejecting..." : "Confirm Rejection"}
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => setShowRejectModal(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TemplateAdminApproval;
```

## Campaign Management

### Campaign Service

```javascript
// services/campaignService.js
import ApiClient from "./apiClient";

class CampaignService {
  async getCampaigns(params = {}) {
    return ApiClient.get("/campaigns", params);
  }

  async getCampaignById(campaignId) {
    return ApiClient.get(`/campaigns/${campaignId}`);
  }

  async createCampaign(campaignData) {
    return ApiClient.post("/campaigns", campaignData);
  }

  async updateCampaign(campaignId, campaignData) {
    return ApiClient.put(`/campaigns/${campaignId}`, campaignData);
  }

  async deleteCampaign(campaignId) {
    return ApiClient.delete(`/campaigns/${campaignId}`);
  }

  async launchCampaign(campaignId) {
    return ApiClient.post(`/campaigns/${campaignId}/launch`);
  }

  async pauseCampaign(campaignId) {
    return ApiClient.post(`/campaigns/${campaignId}/pause`);
  }

  async resumeCampaign(campaignId) {
    return ApiClient.post(`/campaigns/${campaignId}/resume`);
  }

  async getCampaignStats(campaignId) {
    return ApiClient.get(`/campaigns/${campaignId}/stats`);
  }

  async getCampaignAudience(campaignId, params = {}) {
    return ApiClient.get(`/campaigns/${campaignId}/audience`, params);
  }

  async addAudienceToCampaign(campaignId, audienceData) {
    return ApiClient.post(`/campaigns/${campaignId}/audience`, audienceData);
  }

  async removeAudienceFromCampaign(campaignId, audienceIds) {
    return ApiClient.delete(`/campaigns/${campaignId}/audience`, {
      audience_ids: audienceIds,
    });
  }
}

export default new CampaignService();
```

### Campaign Creation Component

```jsx
// components/CampaignCreate.jsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import CampaignService from "../services/campaignService";
import TemplateService from "../services/templateService";

const CampaignCreate = () => {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    template_id: "",
    scheduled_at: "",
    priority: "medium",
  });

  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [templatesLoading, setTemplatesLoading] = useState(true);

  useEffect(() => {
    loadApprovedTemplates();
  }, []);

  const loadApprovedTemplates = async () => {
    try {
      setTemplatesLoading(true);
      const response = await TemplateService.getTemplates({
        status: "approved",
        approved_by_admin: "approved",
      });
      setTemplates(response.data.templates);
    } catch (err) {
      setError("Failed to load templates: " + err.message);
    } finally {
      setTemplatesLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError(null);

      const campaignData = {
        ...formData,
        scheduled_at: formData.scheduled_at || null,
      };

      const response = await CampaignService.createCampaign(campaignData);
      navigate(`/campaigns/${response.data.campaign.id}`, {
        state: { message: "Campaign created successfully!" },
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const selectedTemplate = templates.find((t) => t.id === formData.template_id);

  return (
    <div className="campaign-create">
      <div className="header">
        <h2>Create New Campaign</h2>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="name">Campaign Name *</label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="description">Description</label>
          <textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleChange}
            rows={3}
          />
        </div>

        <div className="form-group">
          <label htmlFor="template_id">Template *</label>
          {templatesLoading ? (
            <div className="loading">Loading templates...</div>
          ) : (
            <select
              id="template_id"
              name="template_id"
              value={formData.template_id}
              onChange={handleChange}
              required
            >
              <option value="">Select a template</option>
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name} ({template.category})
                </option>
              ))}
            </select>
          )}
          <small>
            Only admin-approved templates are available for campaigns
          </small>
        </div>

        {selectedTemplate && (
          <div className="template-preview">
            <h4>Template Preview</h4>
            <div className="template-card">
              <p>
                <strong>Body:</strong> {selectedTemplate.body_text}
              </p>
              {selectedTemplate.parameters && (
                <div className="parameters-info">
                  <strong>Required Parameters:</strong>
                  <ul>
                    {Object.entries(
                      JSON.parse(selectedTemplate.parameters)
                    ).map(([key, value]) => (
                      <li key={key}>
                        {{ key }} → {value}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="form-group">
          <label htmlFor="priority">Priority</label>
          <select
            id="priority"
            name="priority"
            value={formData.priority}
            onChange={handleChange}
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="scheduled_at">Schedule For (Optional)</label>
          <input
            type="datetime-local"
            id="scheduled_at"
            name="scheduled_at"
            value={formData.scheduled_at}
            onChange={handleChange}
          />
          <small>Leave empty to create as draft</small>
        </div>

        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? "Creating..." : "Create Campaign"}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => navigate("/campaigns")}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};

export default CampaignCreate;
```

## Audience Management with Validation

### Audience Upload Component

```jsx
// components/AudienceUpload.jsx
import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import CampaignService from "../services/campaignService";
import TemplateService from "../services/templateService";

const AudienceUpload = () => {
  const { campaignId } = useParams();

  const [campaign, setCampaign] = useState(null);
  const [template, setTemplate] = useState(null);
  const [audienceData, setAudienceData] = useState("");
  const [audienceList, setAudienceList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [validationErrors, setValidationErrors] = useState([]);
  const [uploadResult, setUploadResult] = useState(null);

  useEffect(() => {
    loadCampaignData();
  }, [campaignId]);

  const loadCampaignData = async () => {
    try {
      setLoading(true);
      const campaignResponse = await CampaignService.getCampaignById(
        campaignId
      );
      const campaignData = campaignResponse.data.campaign;
      setCampaign(campaignData);

      if (campaignData.template_id) {
        const templateResponse = await TemplateService.getTemplateById(
          campaignData.template_id
        );
        setTemplate(templateResponse.data.template);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const parseAudienceData = (data) => {
    try {
      // Try to parse as JSON first
      return JSON.parse(data);
    } catch (e) {
      // If JSON parsing fails, try CSV parsing
      const lines = data.trim().split("\n");
      if (lines.length < 2) {
        throw new Error("CSV must have at least a header row and one data row");
      }

      const headers = lines[0].split(",").map((h) => h.trim());
      const audience = [];

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(",").map((v) => v.trim());
        if (values.length !== headers.length) {
          throw new Error(
            `Row ${i + 1} has ${values.length} columns, expected ${
              headers.length
            }`
          );
        }

        const attributes = {};
        headers.forEach((header, index) => {
          if (header !== "name" && header !== "msisdn") {
            attributes[header] = values[index];
          }
        });

        audience.push({
          name: values[headers.indexOf("name")] || "",
          msisdn: values[headers.indexOf("msisdn")] || "",
          attributes,
        });
      }

      return { audience_list: audience };
    }
  };

  const validateAudienceData = (audienceList) => {
    const errors = [];
    const requiredParams = template?.parameters
      ? Object.values(JSON.parse(template.parameters))
      : [];

    audienceList.forEach((audience, index) => {
      const rowErrors = [];

      // Validate required fields
      if (!audience.name?.trim()) {
        rowErrors.push("Name is required");
      }
      if (!audience.msisdn?.trim()) {
        rowErrors.push("Phone number is required");
      }

      // Validate template parameters
      if (requiredParams.length > 0) {
        const missingParams = requiredParams.filter(
          (param) =>
            !audience.attributes?.[param] || !audience.attributes[param].trim()
        );
        if (missingParams.length > 0) {
          rowErrors.push(
            `Missing required parameters: ${missingParams.join(", ")}`
          );
        }
      }

      if (rowErrors.length > 0) {
        errors.push({
          row: index + 1,
          name: audience.name || "Unknown",
          msisdn: audience.msisdn || "Unknown",
          errors: rowErrors,
        });
      }
    });

    return errors;
  };

  const handleDataChange = (e) => {
    const data = e.target.value;
    setAudienceData(data);
    setValidationErrors([]);
    setUploadResult(null);

    if (data.trim()) {
      try {
        const parsed = parseAudienceData(data);
        setAudienceList(parsed.audience_list || []);

        // Validate the data
        const errors = validateAudienceData(parsed.audience_list || []);
        setValidationErrors(errors);
      } catch (err) {
        setError("Invalid data format: " + err.message);
        setAudienceList([]);
      }
    } else {
      setAudienceList([]);
    }
  };

  const handleUpload = async () => {
    if (validationErrors.length > 0) {
      setError("Please fix validation errors before uploading");
      return;
    }

    try {
      setUploading(true);
      setError(null);

      const response = await CampaignService.addAudienceToCampaign(campaignId, {
        audience_list: audienceList,
      });

      setUploadResult(response.data);
      setAudienceData("");
      setAudienceList([]);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const getRequiredParameters = () => {
    if (!template?.parameters) return [];
    try {
      return Object.entries(JSON.parse(template.parameters));
    } catch {
      return [];
    }
  };

  if (loading) return <div className="loading">Loading campaign data...</div>;
  if (error && !campaign) return <div className="error">Error: {error}</div>;

  const requiredParams = getRequiredParameters();

  return (
    <div className="audience-upload">
      <div className="header">
        <h2>Add Audience to Campaign: {campaign?.name}</h2>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {uploadResult && (
        <div className="alert alert-success">
          <h4>Upload Complete!</h4>
          <p>Total processed: {uploadResult.total_processed}</p>
          <p>Successful: {uploadResult.successful}</p>
          <p>Failed: {uploadResult.failed}</p>
        </div>
      )}

      <div className="template-info">
        <h3>Template Requirements</h3>
        <div className="template-card">
          <p>
            <strong>Template:</strong> {template?.name}
          </p>
          <p>
            <strong>Body:</strong> {template?.body_text}
          </p>
          {requiredParams.length > 0 && (
            <div className="required-params">
              <strong>Required Audience Attributes:</strong>
              <ul>
                {requiredParams.map(([key, value]) => (
                  <li key={key}>
                    <code>{value}</code> (for parameter {{ key }})
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      <div className="data-input">
        <h3>Audience Data</h3>
        <p>Enter audience data in JSON or CSV format:</p>

        <div className="format-examples">
          <details>
            <summary>JSON Format Example</summary>
            <pre>{`{
  "audience_list": [
    {
      "name": "John Doe",
      "msisdn": "+1234567890",
      "attributes": {
        ${requiredParams
          .map(([key, value]) => `"${value}": "sample_value"`)
          .join(",\n        ")}
      }
    }
  ]
}`}</pre>
          </details>

          <details>
            <summary>CSV Format Example</summary>
            <pre>{`name,msisdn,${requiredParams
              .map(([key, value]) => value)
              .join(",")}
John Doe,+1234567890,${requiredParams
              .map(() => "sample_value")
              .join(",")}`}</pre>
          </details>
        </div>

        <textarea
          value={audienceData}
          onChange={handleDataChange}
          placeholder="Paste your audience data here..."
          rows={10}
          className="data-textarea"
        />
      </div>

      {audienceList.length > 0 && (
        <div className="preview">
          <h3>Data Preview ({audienceList.length} records)</h3>

          {validationErrors.length > 0 && (
            <div className="validation-errors">
              <h4>Validation Errors:</h4>
              {validationErrors.map((error, index) => (
                <div key={index} className="error-item">
                  <strong>
                    Row {error.row} ({error.name} - {error.msisdn}):
                  </strong>
                  <ul>
                    {error.errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}

          <div className="preview-table">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Phone</th>
                  {requiredParams.map(([key, value]) => (
                    <th key={key}>{value}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {audienceList.slice(0, 5).map((audience, index) => (
                  <tr
                    key={index}
                    className={
                      validationErrors.some((e) => e.row === index + 1)
                        ? "error-row"
                        : ""
                    }
                  >
                    <td>{audience.name}</td>
                    <td>{audience.msisdn}</td>
                    {requiredParams.map(([key, value]) => (
                      <td key={key}>{audience.attributes?.[value] || "-"}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {audienceList.length > 5 && (
              <p>... and {audienceList.length - 5} more records</p>
            )}
          </div>
        </div>
      )}

      <div className="upload-actions">
        <button
          className="btn btn-primary"
          onClick={handleUpload}
          disabled={
            uploading ||
            audienceList.length === 0 ||
            validationErrors.length > 0
          }
        >
          {uploading ? "Uploading..." : `Upload ${audienceList.length} Records`}
        </button>
      </div>
    </div>
  );
};

export default AudienceUpload;
```

## Error Handling

### Global Error Handler

```javascript
// utils/errorHandler.js
export class AppError extends Error {
  constructor(message, statusCode = 500, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export const handleApiError = (error) => {
  console.error("API Error:", error);

  if (error.response) {
    // Server responded with error status
    const { status, data } = error.response;
    return new AppError(data.message || "Server error", status);
  } else if (error.request) {
    // Network error
    return new AppError("Network error. Please check your connection.", 0);
  } else {
    // Other error
    return new AppError(error.message || "An unexpected error occurred");
  }
};

export const showNotification = (message, type = "info") => {
  // Implement your notification system here
  // Could use toast libraries like react-toastify
  console.log(`${type.toUpperCase()}: ${message}`);
};
```

### Error Boundary Component

```jsx
// components/ErrorBoundary.jsx
import React from "react";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Error caught by boundary:", error, errorInfo);
    // Log to error reporting service
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <h2>Something went wrong</h2>
          <p>We're sorry, but something unexpected happened.</p>
          <button onClick={() => window.location.reload()}>Reload Page</button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
```

## State Management

### Context for Global State

```jsx
// context/AppContext.jsx
import React, { createContext, useContext, useReducer } from "react";
import AuthService from "../services/auth";

const AppContext = createContext();

const initialState = {
  user: AuthService.getUser(),
  organizations: [],
  templates: [],
  campaigns: [],
  loading: false,
  error: null,
  notifications: [],
};

const appReducer = (state, action) => {
  switch (action.type) {
    case "SET_LOADING":
      return { ...state, loading: action.payload };

    case "SET_ERROR":
      return { ...state, error: action.payload, loading: false };

    case "CLEAR_ERROR":
      return { ...state, error: null };

    case "SET_USER":
      return { ...state, user: action.payload };

    case "SET_ORGANIZATIONS":
      return { ...state, organizations: action.payload };

    case "SET_TEMPLATES":
      return { ...state, templates: action.payload };

    case "UPDATE_TEMPLATE":
      return {
        ...state,
        templates: state.templates.map((t) =>
          t.id === action.payload.id ? action.payload : t
        ),
      };

    case "SET_CAMPAIGNS":
      return { ...state, campaigns: action.payload };

    case "ADD_NOTIFICATION":
      return {
        ...state,
        notifications: [...state.notifications, action.payload],
      };

    case "REMOVE_NOTIFICATION":
      return {
        ...state,
        notifications: state.notifications.filter(
          (n) => n.id !== action.payload
        ),
      };

    default:
      return state;
  }
};

export const AppProvider = ({ children }) => {
  const [state, dispatch] = useReducer(appReducer, initialState);

  const actions = {
    setLoading: (loading) =>
      dispatch({ type: "SET_LOADING", payload: loading }),
    setError: (error) => dispatch({ type: "SET_ERROR", payload: error }),
    clearError: () => dispatch({ type: "CLEAR_ERROR" }),
    setUser: (user) => dispatch({ type: "SET_USER", payload: user }),
    setOrganizations: (orgs) =>
      dispatch({ type: "SET_ORGANIZATIONS", payload: orgs }),
    setTemplates: (templates) =>
      dispatch({ type: "SET_TEMPLATES", payload: templates }),
    updateTemplate: (template) =>
      dispatch({ type: "UPDATE_TEMPLATE", payload: template }),
    setCampaigns: (campaigns) =>
      dispatch({ type: "SET_CAMPAIGNS", payload: campaigns }),
    addNotification: (notification) =>
      dispatch({
        type: "ADD_NOTIFICATION",
        payload: { ...notification, id: Date.now() },
      }),
    removeNotification: (id) =>
      dispatch({ type: "REMOVE_NOTIFICATION", payload: id }),
  };

  return (
    <AppContext.Provider value={{ state, actions }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useApp must be used within AppProvider");
  }
  return context;
};
```

## UI Components

### Reusable Components

```jsx
// components/common/LoadingSpinner.jsx
import React from "react";

const LoadingSpinner = ({ size = "medium", message = "Loading..." }) => {
  return (
    <div className={`loading-spinner ${size}`}>
      <div className="spinner"></div>
      <p>{message}</p>
    </div>
  );
};

export default LoadingSpinner;
```

```jsx
// components/common/StatusBadge.jsx
import React from "react";

const StatusBadge = ({ status, type = "default" }) => {
  const getStatusClass = () => {
    switch (status?.toLowerCase()) {
      case "active":
      case "approved":
      case "completed":
        return "badge-success";
      case "pending":
      case "pending_approval":
        return "badge-warning";
      case "rejected":
      case "failed":
      case "inactive":
        return "badge-danger";
      case "draft":
        return "badge-secondary";
      default:
        return "badge-default";
    }
  };

  return <span className={`badge ${getStatusClass()}`}>{status}</span>;
};

export default StatusBadge;
```

```jsx
// components/common/DataTable.jsx
import React, { useState } from "react";

const DataTable = ({
  data,
  columns,
  loading = false,
  pagination = null,
  onRowClick = null,
  className = "",
}) => {
  const [sortField, setSortField] = useState(null);
  const [sortDirection, setSortDirection] = useState("asc");

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const sortedData = React.useMemo(() => {
    if (!sortField) return data;

    return [...data].sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];

      if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  }, [data, sortField, sortDirection]);

  if (loading) {
    return <div className="loading">Loading data...</div>;
  }

  return (
    <div className={`data-table ${className}`}>
      <table>
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                onClick={() => column.sortable && handleSort(column.key)}
                className={column.sortable ? "sortable" : ""}
              >
                {column.label}
                {sortField === column.key && (
                  <span className="sort-indicator">
                    {sortDirection === "asc" ? "↑" : "↓"}
                  </span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedData.map((row, index) => (
            <tr
              key={row.id || index}
              onClick={() => onRowClick && onRowClick(row)}
              className={onRowClick ? "clickable" : ""}
            >
              {columns.map((column) => (
                <td key={column.key}>
                  {column.render
                    ? column.render(row[column.key], row)
                    : row[column.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {pagination && (
        <div className="pagination">
          <button
            disabled={pagination.page === 1}
            onClick={() => pagination.onPageChange(pagination.page - 1)}
          >
            Previous
          </button>
          <span>
            Page {pagination.page} of {pagination.pages}
          </span>
          <button
            disabled={pagination.page === pagination.pages}
            onClick={() => pagination.onPageChange(pagination.page + 1)}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};

export default DataTable;
```

## Real-time Updates

### WebSocket Service

```javascript
// services/websocketService.js
class WebSocketService {
  constructor() {
    this.ws = null;
    this.listeners = new Map();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
  }

  connect(token) {
    const wsUrl = `${
      process.env.REACT_APP_WS_URL || "ws://localhost:3000"
    }?token=${token}`;

    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log("WebSocket connected");
      this.reconnectAttempts = 0;
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.handleMessage(data);
      } catch (error) {
        console.error("Error parsing WebSocket message:", error);
      }
    };

    this.ws.onclose = () => {
      console.log("WebSocket disconnected");
      this.attemptReconnect(token);
    };

    this.ws.onerror = (error) => {
      console.error("WebSocket error:", error);
    };
  }

  attemptReconnect(token) {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      setTimeout(() => {
        console.log(
          `Attempting to reconnect... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`
        );
        this.connect(token);
      }, 1000 * this.reconnectAttempts);
    }
  }

  handleMessage(data) {
    const { type, payload } = data;
    const listeners = this.listeners.get(type) || [];
    listeners.forEach((callback) => callback(payload));
  }

  subscribe(eventType, callback) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }
    this.listeners.get(eventType).push(callback);

    // Return unsubscribe function
    return () => {
      const listeners = this.listeners.get(eventType) || [];
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    };
  }

  send(type, payload) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, payload }));
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

export default new WebSocketService();
```

### Real-time Notifications Hook

```jsx
// hooks/useRealTimeUpdates.js
import { useEffect } from "react";
import { useApp } from "../context/AppContext";
import WebSocketService from "../services/websocketService";
import AuthService from "../services/auth";

export const useRealTimeUpdates = () => {
  const { actions } = useApp();

  useEffect(() => {
    if (AuthService.isAuthenticated()) {
      WebSocketService.connect(AuthService.token);

      // Subscribe to template updates
      const unsubscribeTemplate = WebSocketService.subscribe(
        "template_updated",
        (template) => {
          actions.updateTemplate(template);
          actions.addNotification({
            type: "info",
            message: `Template "${template.name}" has been updated`,
          });
        }
      );

      // Subscribe to campaign updates
      const unsubscribeCampaign = WebSocketService.subscribe(
        "campaign_status_changed",
        (campaign) => {
          actions.addNotification({
            type: "info",
            message: `Campaign "${campaign.name}" status changed to ${campaign.status}`,
          });
        }
      );

      // Subscribe to admin approval notifications
      const unsubscribeAdminApproval = WebSocketService.subscribe(
        "admin_approval_required",
        (template) => {
          actions.addNotification({
            type: "warning",
            message: `Template "${template.name}" requires admin approval`,
          });
        }
      );

      return () => {
        unsubscribeTemplate();
        unsubscribeCampaign();
        unsubscribeAdminApproval();
        WebSocketService.disconnect();
      };
    }
  }, [actions]);
};
```

## CSS Styles

### Base Styles

```css
/* styles/globals.css */
:root {
  --primary-color: #007bff;
  --success-color: #28a745;
  --warning-color: #ffc107;
  --danger-color: #dc3545;
  --secondary-color: #6c757d;
  --light-color: #f8f9fa;
  --dark-color: #343a40;
}

.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.2s;
}

.btn-primary {
  background-color: var(--primary-color);
  color: white;
}
.btn-success {
  background-color: var(--success-color);
  color: white;
}
.btn-warning {
  background-color: var(--warning-color);
  color: black;
}
.btn-danger {
  background-color: var(--danger-color);
  color: white;
}
.btn-secondary {
  background-color: var(--secondary-color);
  color: white;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.badge {
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: bold;
}

.badge-success {
  background-color: var(--success-color);
  color: white;
}
.badge-warning {
  background-color: var(--warning-color);
  color: black;
}
.badge-danger {
  background-color: var(--danger-color);
  color: white;
}
.badge-secondary {
  background-color: var(--secondary-color);
  color: white;
}

.alert {
  padding: 12px;
  border-radius: 4px;
  margin-bottom: 16px;
}

.alert-success {
  background-color: #d4edda;
  color: #155724;
  border: 1px solid #c3e6cb;
}
.alert-warning {
  background-color: #fff3cd;
  color: #856404;
  border: 1px solid #ffeaa7;
}
.alert-error {
  background-color: #f8d7da;
  color: #721c24;
  border: 1px solid #f5c6cb;
}

.loading {
  text-align: center;
  padding: 20px;
}

.error {
  color: var(--danger-color);
  padding: 10px;
  background-color: #f8d7da;
  border-radius: 4px;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  margin-bottom: 4px;
  font-weight: bold;
}

.form-group input,
.form-group select,
.form-group textarea {
  width: 100%;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.data-table table {
  width: 100%;
  border-collapse: collapse;
}

.data-table th,
.data-table td {
  padding: 12px;
  text-align: left;
  border-bottom: 1px solid #ddd;
}

.data-table th {
  background-color: var(--light-color);
  font-weight: bold;
}

.data-table .sortable {
  cursor: pointer;
}

.data-table .clickable {
  cursor: pointer;
}

.data-table .clickable:hover {
  background-color: var(--light-color);
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  background: white;
  padding: 24px;
  border-radius: 8px;
  max-width: 500px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
}
```

This comprehensive frontend implementation guide provides everything needed to build a complete React application that integrates with the WhatsApp Server API, including all the new template admin approval and audience parameter validation features.
