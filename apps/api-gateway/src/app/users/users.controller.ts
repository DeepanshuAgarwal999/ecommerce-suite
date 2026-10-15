import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@ecommerce/auth';
import { Ctx } from '@ecommerce/common';
import {
  AuthenticatedUser,
  CreateAddressDto,
  RequestContext,
  UpdateAddressDto,
  UpdateProfileDto,
  UserPatterns,
} from '@ecommerce/contracts';
import { GatewayService } from '../common/gateway.service';

/** Profile and addresses for the signed-in user. Every route is scoped to `me`. */
@ApiTags('users')
@ApiBearerAuth('access-token')
@Controller('users/me')
export class UsersController {
  constructor(private readonly gateway: GatewayService) {}

  @Get()
  @ApiOperation({ summary: 'My profile' })
  profile(@CurrentUser() user: AuthenticatedUser) {
    return this.gateway.user(UserPatterns.GET_PROFILE, { userId: user.userId });
  }

  @Patch()
  @ApiOperation({ summary: 'Update my profile' })
  updateProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProfileDto,
    @Ctx() ctx: RequestContext,
  ) {
    return this.gateway.user(UserPatterns.UPDATE_PROFILE, { userId: user.userId, dto, ctx });
  }

  @Get('addresses')
  @ApiOperation({ summary: 'My saved addresses' })
  addresses(@CurrentUser() user: AuthenticatedUser) {
    return this.gateway.user(UserPatterns.LIST_ADDRESSES, { userId: user.userId });
  }

  @Post('addresses')
  @ApiOperation({ summary: 'Add an address' })
  createAddress(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateAddressDto) {
    return this.gateway.user(UserPatterns.CREATE_ADDRESS, { userId: user.userId, dto });
  }

  @Put('addresses/:addressId')
  @ApiOperation({ summary: 'Update an address' })
  updateAddress(
    @CurrentUser() user: AuthenticatedUser,
    @Param('addressId', ParseUUIDPipe) addressId: string,
    @Body() dto: UpdateAddressDto,
  ) {
    return this.gateway.user(UserPatterns.UPDATE_ADDRESS, { userId: user.userId, addressId, dto });
  }

  @Delete('addresses/:addressId')
  @ApiOperation({ summary: 'Remove an address' })
  deleteAddress(
    @CurrentUser() user: AuthenticatedUser,
    @Param('addressId', ParseUUIDPipe) addressId: string,
  ) {
    return this.gateway.user(UserPatterns.DELETE_ADDRESS, { userId: user.userId, addressId });
  }

  @Post('addresses/:addressId/default')
  @ApiOperation({ summary: 'Make an address the default' })
  setDefault(
    @CurrentUser() user: AuthenticatedUser,
    @Param('addressId', ParseUUIDPipe) addressId: string,
  ) {
    return this.gateway.user(UserPatterns.SET_DEFAULT_ADDRESS, { userId: user.userId, addressId });
  }
}
