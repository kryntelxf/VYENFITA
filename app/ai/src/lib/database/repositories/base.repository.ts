/**
 * VYENFITA Base Repository
 * 
 * @version 1.0.1
 */

import { PrismaClient } from '@prisma/client';
import { prisma } from '../client';

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
  protected abstract getModel(client: any): any;

  protected get delegate(): any {
    return this.getModel(prisma);
  }

  async create(data: TCreateInput, tx?: any): Promise<TModel> {
    const client = tx || prisma;
    const model = this.getModel(client);
    return model.create({ data });
  }

  async findById(id: string, tx?: any): Promise<TModel | null> {
    const client = tx || prisma;
    const model = this.getModel(client);
    return model.findUnique({ where: { id } });
  }

  async findByIdOrThrow(id: string, tx?: any): Promise<TModel> {
    const record = await this.findById(id, tx);
    if (!record) {
      throw new Error(`${this.modelName} with id ${id} not found`);
    }
    return record;
  }

  async findOne(where: TWhereInput, tx?: any): Promise<TModel | null> {
    const client = tx || prisma;
    const model = this.getModel(client);
    return model.findFirst({ where });
  }

  async findMany(
    where: TWhereInput = {} as TWhereInput,
    options: {
      pagination?: PaginationOptions;
      sort?: SortOptions;
      include?: any;
      select?: any;
    } = {},
    tx?: any
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

  async findAll(
    where: TWhereInput = {} as TWhereInput,
    options: { include?: any; sort?: SortOptions } = {},
    tx?: any
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

  async update(
    id: string,
    data: TUpdateInput,
    tx?: any
  ): Promise<TModel> {
    const client = tx || prisma;
    const model = this.getModel(client);
    return model.update({ where: { id }, data });
  }

  async updateMany(
    where: TWhereInput,
    data: TUpdateInput,
    tx?: any
  ): Promise<{ count: number }> {
    const client = tx || prisma;
    const model = this.getModel(client);
    return model.updateMany({ where, data });
  }

  async softDelete(id: string, tx?: any): Promise<TModel> {
    return this.update(id, { deletedAt: new Date() } as any, tx);
  }

  async delete(id: string, tx?: any): Promise<TModel> {
    const client = tx || prisma;
    const model = this.getModel(client);
    return model.delete({ where: { id } });
  }

  async deleteMany(
    where: TWhereInput,
    tx?: any
  ): Promise<{ count: number }> {
    const client = tx || prisma;
    const model = this.getModel(client);
    return model.deleteMany({ where });
  }

  async count(where: TWhereInput = {} as TWhereInput, tx?: any): Promise<number> {
    const client = tx || prisma;
    const model = this.getModel(client);
    return model.count({ where });
  }

  async exists(where: TWhereInput, tx?: any): Promise<boolean> {
    const count = await this.count(where, tx);
    return count > 0;
  }
}

// Re-export PrismaClient for repositories
export { PrismaClient };
