import { Injectable } from '@nestjs/common';
import { AppException, slugify, uniqueSlug } from '@ecommerce/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBrandDto } from '@ecommerce/contracts';

@Injectable()
export class BrandService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: { q?: string } = {}) {
    return this.prisma.brand.findMany({
      where: {
        isActive: true,
        ...(query.q ? { name: { contains: query.q, mode: 'insensitive' as const } } : {}),
      },
      orderBy: { name: 'asc' },
    });
  }

  async create(dto: CreateBrandDto) {
    const existing = await this.prisma.brand.findUnique({ where: { name: dto.name } });
    if (existing) throw AppException.conflict(`Brand "${dto.name}" already exists`);

    const base = slugify(dto.name);
    const slugTaken = await this.prisma.brand.findUnique({
      where: { slug: base },
      select: { id: true },
    });

    return this.prisma.brand.create({
      data: {
        name: dto.name,
        slug: slugTaken ? uniqueSlug(dto.name) : base,
        logoUrl: dto.logoUrl,
        description: dto.description,
      },
    });
  }
}
