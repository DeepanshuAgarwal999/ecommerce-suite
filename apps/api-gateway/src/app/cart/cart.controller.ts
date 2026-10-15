import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@ecommerce/auth';
import { PaginationQueryDto } from '@ecommerce/common';
import {
  AddItemDto,
  ApplyCouponDto,
  AuthenticatedUser,
  CartPatterns,
  ToggleWishlistDto,
  UpdateItemDto,
} from '@ecommerce/contracts';
import { GatewayService } from '../common/gateway.service';

@ApiTags('cart')
@ApiBearerAuth('access-token')
@Controller()
export class CartController {
  constructor(private readonly gateway: GatewayService) {}

  @Get('cart')
  @ApiOperation({ summary: 'My cart, with live availability' })
  cart(@CurrentUser() user: AuthenticatedUser, @Query('pincode') pincode?: string) {
    return this.gateway.cart(CartPatterns.GET_CART, { userId: user.userId, pincode });
  }

  @Post('cart/items')
  @ApiOperation({ summary: 'Add a variant to the cart' })
  addItem(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AddItemDto,
    @Query('pincode') pincode?: string,
  ) {
    return this.gateway.cart(CartPatterns.ADD_ITEM, { userId: user.userId, dto, pincode });
  }

  @Patch('cart/items/:itemId')
  @ApiOperation({ summary: 'Change quantity (0 removes)' })
  updateItem(
    @CurrentUser() user: AuthenticatedUser,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: UpdateItemDto,
    @Query('pincode') pincode?: string,
  ) {
    return this.gateway.cart(CartPatterns.UPDATE_ITEM, { userId: user.userId, itemId, dto, pincode });
  }

  @Delete('cart/items/:itemId')
  @ApiOperation({ summary: 'Remove a line' })
  removeItem(
    @CurrentUser() user: AuthenticatedUser,
    @Param('itemId', ParseUUIDPipe) itemId: string,
  ) {
    return this.gateway.cart(CartPatterns.REMOVE_ITEM, { userId: user.userId, itemId });
  }

  @Delete('cart')
  @ApiOperation({ summary: 'Empty the cart' })
  clear(@CurrentUser() user: AuthenticatedUser) {
    return this.gateway.cart(CartPatterns.CLEAR, { userId: user.userId });
  }

  @Post('cart/coupon')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Apply a coupon code' })
  applyCoupon(@CurrentUser() user: AuthenticatedUser, @Body() dto: ApplyCouponDto) {
    return this.gateway.cart(CartPatterns.APPLY_COUPON, { userId: user.userId, dto });
  }

  @Delete('cart/coupon')
  @ApiOperation({ summary: 'Remove the coupon' })
  removeCoupon(@CurrentUser() user: AuthenticatedUser) {
    return this.gateway.cart(CartPatterns.REMOVE_COUPON, { userId: user.userId });
  }

  @Get('wishlist')
  @ApiOperation({ summary: 'Saved items' })
  wishlist(@CurrentUser() user: AuthenticatedUser, @Query() query: PaginationQueryDto) {
    return this.gateway.cart(CartPatterns.GET_WISHLIST, {
      userId: user.userId,
      page: query.page,
      limit: query.limit,
    });
  }

  @Post('wishlist/toggle')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Save or unsave a product' })
  toggleWishlist(@CurrentUser() user: AuthenticatedUser, @Body() dto: ToggleWishlistDto) {
    return this.gateway.cart(CartPatterns.TOGGLE_WISHLIST, { userId: user.userId, dto });
  }
}
