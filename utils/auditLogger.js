// backend/utils/auditLogger.js
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Log an audit entry
 * @param {Object} params - Audit log parameters
 * @param {string} params.tableName - Name of the table being modified
 * @param {number} params.recordId - ID of the record being modified
 * @param {string} params.action - Action performed (INSERT, UPDATE, DELETE, STORE)
 * @param {Object} params.oldValues - Previous values (for UPDATE/DELETE)
 * @param {Object} params.newValues - New values (for INSERT/UPDATE)
 * @param {number} params.userId - User ID from session/auth (optional)
 * @param {string} params.walletAddress - Wallet address (optional)
 * @param {string} params.ipAddress - IP address (optional)
 * @param {string} params.userAgent - User agent (optional)
 */
export async function logAudit({
  tableName,
  recordId,
  action,
  oldValues = null,
  newValues = null,
  userId = null,
  walletAddress = null,
  ipAddress = null,
  userAgent = null
}) {
  try {
    await prisma.audit_log.create({
      data: {
        table_name: tableName,
        record_id: recordId,
        action: action.toUpperCase(),
        old_values: oldValues ? JSON.parse(JSON.stringify(oldValues)) : null,
        new_values: newValues ? JSON.parse(JSON.stringify(newValues)) : null,
        changed_by: userId,
        changed_by_wallet: walletAddress,
        ip_address: ipAddress,
        user_agent: userAgent,
        changed_at: new Date()
      }
    });
    
    console.log(`✅ Audit log created: ${action} on ${tableName} #${recordId}`);
  } catch (error) {
    // Don't fail the main operation if audit logging fails
    console.error('❌ Error creating audit log:', error);
  }
}

/**
 * Extract IP address from request
 */
export function getIpAddress(req) {
  return req.ip || 
         req.headers['x-forwarded-for']?.split(',')[0] || 
         req.connection.remoteAddress || 
         null;
}

/**
 * Get user agent from request
 */
export function getUserAgent(req) {
  return req.headers['user-agent'] || null;
}