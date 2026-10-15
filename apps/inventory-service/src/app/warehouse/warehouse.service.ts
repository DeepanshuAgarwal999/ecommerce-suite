import { Injectable } from '@nestjs/common';
import { AppException } from '@ecommerce/common';
import { WarehouseType } from '@ecommerce/contracts';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateWarehouseInput {
  code: string;
  name: string;
  type?: WarehouseType;
  addressLine: string;
  city: string;
  state: string;
  pincode: string;
  latitude?: number;
  longitude?: number;
  servicePincodes?: string[];
  priority?: number;
}

@Injectable()
export class WarehouseService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: { type?: WarehouseType; pincode?: string } = {}) {
    return this.prisma.warehouse.findMany({
      where: {
        isActive: true,
        ...(query.type ? { type: query.type } : {}),
        ...(query.pincode ? { servicePincodes: { has: query.pincode } } : {}),
      },
      orderBy: { priority: 'asc' },
    });
  }

  async create(input: CreateWarehouseInput) {
    const existing = await this.prisma.warehouse.findUnique({ where: { code: input.code } });
    if (existing) throw AppException.conflict(`Warehouse code ${input.code} is already in use`);

    return this.prisma.warehouse.create({
      data: {
        code: input.code.toUpperCase(),
        name: input.name,
        type: input.type ?? WarehouseType.FULFILMENT_CENTRE,
        addressLine: input.addressLine,
        city: input.city,
        state: input.state,
        pincode: input.pincode,
        latitude: input.latitude,
        longitude: input.longitude,
        servicePincodes: input.servicePincodes ?? [],
        // Dark stores are checked before regional centres, so a quick-commerce order is
        // served from the nearest one whenever it can be.
        priority: input.priority ?? (input.type === WarehouseType.DARK_STORE ? 10 : 100),
      },
    });
  }
}
