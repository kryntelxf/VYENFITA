/**
 * VYENFITA User Repository
 * 
 * Data access for User model
 * 
 * @version 1.0.0
 */

import { User } from '@prisma/client';
import { BaseRepository } from './base.repository';
import { PrismaClient, TransactionClient } from '../client';

export interface CreateUserInput {
  email: string;
  passwordHash?: string;
  name?: string;
  avatarUrl?: string;
  status?: string;
  ssoProvider?: string;
  ssoProviderId?: string;
  preferredLanguage?: string;
  timezone?: string;
}

export interface UpdateUserInput {
  email?: string;
  passwordHash?: string;
  name?: string;
  avatarUrl?: string;
  status?: string;
  emailVerified?: boolean;
  preferredLanguage?: string;
  timezone?: string;
  lastLoginAt?: Date;
}

export class UserRepository extends BaseRepository<
  User,
  CreateUserInput,
  UpdateUserInput,
  any
> {
  protected modelName = 'User';

  protected getModel(client: PrismaClient | TransactionClient): any {
    return client.user;
  }

  /**
   * Find user by email
   */
  async findByEmail(email: string, tx?: TransactionClient): Promise<User | null> {
    return this.findOne({ email: email.toLowerCase(), deletedAt: null } as any, tx);
  }

  /**
   * Find user by SSO provider
   */
  async findBySSO(
    provider: string,
    providerId: string,
    tx?: TransactionClient
  ): Promise<User | null> {
    return this.findOne(
      { ssoProvider: provider, ssoProviderId: providerId, deletedAt: null } as any,
      tx
    );
  }

  /**
   * Find user with memberships
   */
  async findWithMemberships(id: string, tx?: TransactionClient): Promise<any> {
    const client = tx || PrismaClient;
    return this.getModel(client).findUnique({
      where: { id },
      include: {
        memberships: {
          include: {
            tenant: true,
            role: true,
          },
        },
      },
    });
  }

  /**
   * Update last login
   */
  async updateLastLogin(id: string, tx?: TransactionClient): Promise<User> {
    return this.update(id, { lastLoginAt: new Date() } as any, tx);
  }

  /**
   * Verify email
   */
  async verifyEmail(id: string, tx?: TransactionClient): Promise<User> {
    return this.update(id, { emailVerified: true } as any, tx);
  }

  /**
   * Check if email exists
   */
  async emailExists(email: string, tx?: TransactionClient): Promise<boolean> {
    return this.exists({ email: email.toLowerCase() } as any, tx);
  }
}

export const userRepository = new UserRepository();
