/**
 * VYENFITA Base Repository
 * 
 * Abstract base repository with common operations
 * - CRUD operations
 * - Pagination
 * - Filtering
 * - Tenant isolation
 * 
 * @version 1.0.0
 */

import { PrismaClient, Prisma } from '@prisma/client';
import { prisma, TransactionClient } from '../client';

export interface PaginationOptions {
  page?: number;
  limit?: number;
  cursor?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface SortOptions {
  field: string;
  direction: 'asc' | 'desc';
}

export abstract class BaseRepository<
  TModel = any,
  TCreateInput = any,
  TUpdateInput = any,
  TWhereInput = any
> {
  protected abstract modelName: string;
  protected abstract getModel(client: PrismaClient | TransactionClient): any;

  /**
   * Get the Prisma model delegate
   */
  protected get delegate(): any {
    return this.getModel(prisma);
  }

  /**
   * Create a new record
   */
  async create(data: TCreateInput, tx?: TransactionClient): Promise<TModel> {
    const client = tx || prisma;
    const model = this.getModel(client);
    return model.create({ data });
  }

  /**
   * Find by ID
   */
  async findById(id: string, tx?: TransactionClient): Promise<TModel | null> {
    const client = tx || prisma;
    const model = this.getModel(client);
    return model.findUnique({ where: { id } });
  }

  /**
   * Find by ID or throw
   */
  async findByIdOrThrow(id: string, tx?: TransactionClient): Promise<TModel> {
    const record = await this.findById(id, tx);
    if (!record) {
      throw new Error(`${this.modelName} with id ${id} not found`);
    }
    return record;
  }

  /**
   * Find one by condition
   */
  async findOne(where: TWhereInput, tx?: TransactionClient): Promise<TModel | null> {
    const client = tx || prisma;
    const model = this.getModel(client);
    return model.findFirst({ where });
  }

  /**
   * Find many with pagination
   */
  async findMany(
    where: TWhereInput = {} as TWhereInput,
    options: {
      pagination?: PaginationOptions;
      sort?: SortOptions;
      include?: any;
      select?: any;
    } = {},
    tx?: TransactionClient
  ): Promise<PaginatedResult<TModel>> {
    const client = tx || prisma;
    const model = this.getModel(client);

    const page = options.pagination?.page ?? 1;
    const limit = Math.min(options.pagination?.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      model.findMany({
        where,
        skip,
        take: limit,
        orderBy: options.sort
          ? { [options.sort.field]: options.sort.direction }
          : { createdAt: 'desc' },
        include: options.include,
        select: options.select,
      }),
      model.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  /**
   * Find all (no pagination, use with caution)
   */
  async findAll(
    where: TWhereInput = {} as TWhereInput,
    options: { include?: any; sort?: SortOptions } = {},
    tx?: TransactionClient
  ): Promise<TModel[]> {
    const client = tx || prisma;
    const model = this.getModel(client);
    return model.findMany({
      where,
      include: options.include,
      orderBy: options.sort
        ? { [options.sort.field]: options.sort.direction }
        : { createdAt: 'desc' },
    });
  }

  /**
   * Update by ID
   */
  async update(
    id: string,
    data: TUpdateInput,
    tx?: TransactionClient
  ): Promise<TModel> {
    const client = tx || prisma;
    const model = this.getModel(client);
    return model.update({ where: { id }, data });
  }

  /**
   * Update many
   */
  async updateMany(
    where: TWhereInput,
    data: TUpdateInput,
    tx?: TransactionClient
  ): Promise<{ count: number }> {
    const client = tx || prisma;
    const model = this.getModel(client);
    return model.updateMany({ where, data });
  }

  /**
   * Soft delete (set deletedAt)
   */
  async softDelete(id: string, tx?: TransactionClient): Promise<TModel> {
    return this.update(id, { deletedAt: new Date() } as any, tx);
  }

  /**
   * Hard delete
   */
  async delete(id: string, tx?: TransactionClient): Promise<TModel> {
    const client = tx || prisma;
    const model = this.getModel(client);
    return model.delete({ where: { id } });
  }

  /**
   * Delete many
   */
  async deleteMany(
    where: TWhereInput,
    tx?: TransactionClient
  ): Promise<{ count: number }> {
    const client = tx || prisma;
    const model = this.getModel(client);
    return model.deleteMany({ where });
  }

  /**
   * Count records
   */
  async count(where: TWhereInput = {} as TWhereInput, tx?: TransactionClient): Promise<number> {
    const client = tx || prisma;
    const model = this.getModel(client);
    return model.count({ where });
  }

  /**
   * Check if record exists
   */
  async exists(where: TWhereInput, tx?: TransactionClient): Promise<boolean> {
    const count = await this.count(where, tx);
    return count > 0;
  }
  }
