/**
 * VYENFITA Database Seed
 * 
 * Seeds database with:
 * - System permissions
 * - System roles
 * - Demo tenant
 * - Demo users
 * 
 * @version 1.0.0
 */

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// ============================================================
// SYSTEM PERMISSIONS
// ============================================================

const SYSTEM_PERMISSIONS = [
  // Application permissions
  { resource: 'application', action: 'create', description: 'Create applications' },
  { resource: 'application', action: 'read', description: 'Read applications' },
  { resource: 'application', action: 'update', description: 'Update applications' },
  { resource: 'application', action: 'delete', description: 'Delete applications' },
  { resource: 'application', action: 'publish', description: 'Publish applications' },
  { resource: 'application', action: 'deploy', description: 'Deploy applications' },

  // Workflow permissions
  { resource: 'workflow', action: 'create', description: 'Create workflows' },
  { resource: 'workflow', action: 'read', description: 'Read workflows' },
  { resource: 'workflow', action: 'update', description: 'Update workflows' },
  { resource: 'workflow', action: 'delete', description: 'Delete workflows' },
  { resource: 'workflow', action: 'execute', description: 'Execute workflows' },

  // User management permissions
  { resource: 'user', action: 'create', description: 'Create users' },
  { resource: 'user', action: 'read', description: 'Read users' },
  { resource: 'user', action: 'update', description: 'Update users' },
  { resource: 'user', action: 'delete', description: 'Delete users' },
  { resource: 'user', action: 'invite', description: 'Invite users' },

  // Role management permissions
  { resource: 'role', action: 'create', description: 'Create roles' },
  { resource: 'role', action: 'read', description: 'Read roles' },
  { resource: 'role', action: 'update', description: 'Update roles' },
  { resource: 'role', action: 'delete', description: 'Delete roles' },

  // Analytics permissions
  { resource: 'analytics', action: 'read', description: 'Read analytics' },
  { resource: 'analytics', action: 'export', description: 'Export analytics' },

  // Billing permissions
  { resource: 'billing', action: 'read', description: 'Read billing' },
  { resource: 'billing', action: 'manage', description: 'Manage billing' },

  // Settings permissions
  { resource: 'settings', action: 'read', description: 'Read settings' },
  { resource: 'settings', action: 'update', description: 'Update settings' },

  // Audit permissions
  { resource: 'audit', action: 'read', description: 'Read audit logs' },

  // Admin permissions
  { resource: '*', action: 'manage', description: 'Full administrative access' },
];

// ============================================================
// SYSTEM ROLES
// ============================================================

const SYSTEM_ROLES = [
  {
    name: 'Owner',
    description: 'Full access to tenant, including billing',
    isSystem: true,
    isDefault: false,
    permissions: ['*:manage'],
  },
  {
    name: 'Admin',
    description: 'Administrative access to tenant resources',
    isSystem: true,
    isDefault: false,
    permissions: [
      'application:create', 'application:read', 'application:update', 'application:delete', 'application:publish', 'application:deploy',
      'workflow:create', 'workflow:read', 'workflow:update', 'workflow:delete', 'workflow:execute',
      'user:create', 'user:read', 'user:update', 'user:delete', 'user:invite',
      'role:create', 'role:read', 'role:update', 'role:delete',
      'analytics:read', 'analytics:export',
      'settings:read', 'settings:update',
      'audit:read',
    ],
  },
  {
    name: 'Editor',
    description: 'Can create and edit applications and workflows',
    isSystem: true,
    isDefault: true,
    permissions: [
      'application:create', 'application:read', 'application:update', 'application:publish',
      'workflow:create', 'workflow:read', 'workflow:update', 'workflow:execute',
      'analytics:read',
      'settings:read',
    ],
  },
  {
    name: 'Viewer',
    description: 'Read-only access',
    isSystem: true,
    isDefault: false,
    permissions: [
      'application:read',
      'workflow:read',
      'analytics:read',
      'settings:read',
    ],
  },
];

// ============================================================
// SEED FUNCTIONS
// ============================================================

async function seedPermissions() {
  console.log('Seeding system permissions...');

  for (const perm of SYSTEM_PERMISSIONS) {
    await prisma.permission.upsert({
      where: {
        resource_action: {
          resource: perm.resource,
          action: perm.action,
        },
      },
      update: {
        description: perm.description,
      },
      create: {
        resource: perm.resource,
        action: perm.action,
        description: perm.description,
      },
    });
  }

  const count = await prisma.permission.count();
  console.log(`✅ Seeded ${count} permissions`);
}

async function seedRoles() {
  console.log('Seeding system roles...');

  const allPermissions = await prisma.permission.findMany();
  const permissionMap = new Map(
    allPermissions.map((p) => [`${p.resource}:${p.action}`, p.id])
  );

  for (const role of SYSTEM_ROLES) {
    // Create or update role
    const createdRole = await prisma.role.upsert({
      where: {
        tenantId_name: {
          tenantId: null as any,
          name: role.name,
        },
      },
      update: {
        description: role.description,
        isSystem: role.isSystem,
        isDefault: role.isDefault,
      },
      create: {
        tenantId: null,
        name: role.name,
        description: role.description,
        isSystem: role.isSystem,
        isDefault: role.isDefault,
      },
    });

    // Clear existing permissions
    await prisma.rolePermission.deleteMany({
      where: { roleId: createdRole.id },
    });

    // Add permissions
    for (const permKey of role.permissions) {
      const permId = permissionMap.get(permKey);
      if (permId) {
        await prisma.rolePermission.create({
          data: {
            roleId: createdRole.id,
            permissionId: permId,
          },
        });
      }
    }

    console.log(`  ✓ Role: ${role.name} (${role.permissions.length} permissions)`);
  }

  const count = await prisma.role.count();
  console.log(`✅ Seeded ${count} roles`);
}

async function seedComplianceFrameworks() {
  console.log('Seeding compliance frameworks...');

  const frameworks = [
    {
      name: 'GDPR',
      version: 'EU/2016/679',
      description: 'General Data Protection Regulation',
      controls: [
        { code: 'GDPR-1', name: 'Data Protection Policy', description: 'Implement data protection policies' },
        { code: 'GDPR-2', name: 'Data Subject Rights', description: 'Enable users to access, correct, and delete their data' },
        { code: 'GDPR-3', name: 'Data Breach Notification', description: 'Implement breach detection and notification process' },
        { code: 'GDPR-4', name: 'Data Retention', description: 'Implement data retention and deletion policies' },
      ],
    },
    {
      name: 'SOC2',
      version: 'Type II',
      description: 'Service Organization Control 2',
      controls: [
        { code: 'SOC2-1', name: 'Security Controls', description: 'Implement security controls and monitoring' },
        { code: 'SOC2-2', name: 'Availability Controls', description: 'Implement availability and disaster recovery' },
        { code: 'SOC2-3', name: 'Incident Response', description: 'Implement incident response procedure' },
      ],
    },
    {
      name: 'ISO27001',
      version: '2022',
      description: 'Information Security Management',
      controls: [
        { code: 'ISO-1', name: 'Information Security Policy', description: 'Establish and maintain information security policy' },
        { code: 'ISO-2', name: 'Risk Assessment', description: 'Conduct regular risk assessments' },
        { code: 'ISO-3', name: 'Access Control', description: 'Implement access control measures' },
      ],
    },
  ];

  for (const framework of frameworks) {
    const created = await prisma.complianceFramework.upsert({
      where: { name: framework.name },
      update: {
        version: framework.version,
        description: framework.description,
      },
      create: {
        name: framework.name,
        version: framework.version,
        description: framework.description,
      },
    });

    for (const control of framework.controls) {
      await prisma.complianceControl.upsert({
        where: {
          frameworkId_code: {
            frameworkId: created.id,
            code: control.code,
          },
        },
        update: {
          name: control.name,
          description: control.description,
        },
        create: {
          frameworkId: created.id,
          code: control.code,
          name: control.name,
          description: control.description,
        },
      });
    }

    console.log(`  ✓ Framework: ${framework.name} (${framework.controls.length} controls)`);
  }

  console.log(`✅ Seeded ${frameworks.length} compliance frameworks`);
}

async function seedDemoData() {
  console.log('Seeding demo data...');

  // Create demo tenant
  const demoTenant = await prisma.tenant.upsert({
    where: { slug: 'demo' },
    update: {},
    create: {
      slug: 'demo',
      name: 'Demo Organization',
      description: 'Demo tenant for development',
      plan: 'pro',
      status: 'active',
    },
  });

  console.log(`  ✓ Tenant: ${demoTenant.name}`);

  // Get default role (Editor)
  const editorRole = await prisma.role.findFirst({
    where: {
      tenantId: null,
      name: 'Editor',
    },
  });

  if (!editorRole) {
    throw new Error('Editor role not found');
  }

  // Create demo user
  const passwordHash = await bcrypt.hash('demo123456', 10);

  const demoUser = await prisma.user.upsert({
    where: { email: 'demo@vyenfita.com' },
    update: {},
    create: {
      email: 'demo@vyenfita.com',
      passwordHash,
      name: 'Demo User',
      emailVerified: true,
      status: 'active',
    },
  });

  console.log(`  ✓ User: ${demoUser.email} (password: demo123456)`);

  // Create membership
  await prisma.membership.upsert({
    where: {
      userId_tenantId: {
        userId: demoUser.id,
        tenantId: demoTenant.id,
      },
    },
    update: {},
    create: {
      userId: demoUser.id,
      tenantId: demoTenant.id,
      roleId: editorRole.id,
      status: 'active',
      joinedAt: new Date(),
    },
  });

  console.log(`  ✓ Membership: ${demoUser.email} → ${demoTenant.name}`);

  console.log(`✅ Seeded demo data`);
}

// ============================================================
// MAIN
// ============================================================

async function main() {
  console.log('🌱 Starting database seed...\n');

  try {
    await seedPermissions();
    console.log();

    await seedRoles();
    console.log();

    await seedComplianceFrameworks();
    console.log();

    await seedDemoData();
    console.log();

    console.log('✅ Database seed completed successfully!');
  } catch (error) {
    console.error('❌ Seed failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main();
