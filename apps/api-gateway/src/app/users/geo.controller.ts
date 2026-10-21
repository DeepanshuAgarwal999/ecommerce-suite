import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ReverseGeocodeQueryDto, UserPatterns } from '@ecommerce/contracts';
import { GatewayService } from '../common/gateway.service';
import { RateLimit } from '../common/rate-limit.guard';

/**
 * Location helpers for the address form. Signed-in only (addresses are) and rate
 * limited per user: they proxy third-party geocoders with their own fair-use limits,
 * so the storefront must not become an open geocoding API. Results are cached in
 * user-service (see GeoService).
 */
@ApiTags('users')
@ApiBearerAuth('access-token')
@Controller('geo')
export class GeoController {
  constructor(private readonly gateway: GatewayService) {}

  @Get('reverse')
  @RateLimit({ limit: 30, windowSeconds: 60, scope: 'geo' })
  @ApiOperation({ summary: 'Address fields for a map point ("use my current location")' })
  reverse(@Query() { lat, lng }: ReverseGeocodeQueryDto) {
    return this.gateway.user(UserPatterns.GEO_REVERSE, { latitude: lat, longitude: lng });
  }

  @Get('pincode/:pincode')
  @RateLimit({ limit: 30, windowSeconds: 60, scope: 'geo' })
  @ApiOperation({ summary: 'City, state and localities for an Indian pincode' })
  pincode(@Param('pincode') pincode: string) {
    return this.gateway.user(UserPatterns.GEO_PINCODE, { pincode });
  }
}
