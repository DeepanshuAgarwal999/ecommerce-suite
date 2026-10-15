import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermissions, Roles } from '@ecommerce/auth';
import {
  CreateBannerDto,
  CreateFooterColumnDto,
  CreateFooterLinkDto,
  CreateHomeSectionDto,
  CreateSectionTileDto,
  CreateThemeDto,
  MerchandisingPatterns,
  Permission,
  ReorderDto,
  Role,
  UpdateBannerDto,
  UpdateFooterColumnDto,
  UpdateFooterLinkDto,
  UpdateFooterSettingsDto,
  UpdateHomeSectionDto,
  UpdateSectionTileDto,
  UpdateThemeDto,
} from '@ecommerce/contracts';
import { GatewayService } from '../common/gateway.service';

/**
 * Home page CMS - banners, the home page shelves ("Shop by occasion", product
 * grids, deal of the day, ...) and the storefront-wide occasion themes. Split from AdminController purely for size; the
 * same staff role gate and CATALOG_WRITE permission apply, because this is
 * still catalog-service content, just the merchandising slice of it.
 */
@ApiTags('admin')
@ApiBearerAuth('access-token')
@Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.SUPPORT)
@RequirePermissions(Permission.CATALOG_WRITE)
@Controller('admin')
export class MerchandisingAdminController {
  constructor(private readonly gateway: GatewayService) {}

  // --- banners -----------------------------------------------------------

  @Get('banners')
  @ApiOperation({ summary: 'Every banner, including inactive or out of schedule' })
  listBanners() {
    return this.gateway.catalog(MerchandisingPatterns.ADMIN_LIST_BANNERS, {});
  }

  @Post('banners')
  @ApiOperation({ summary: 'Create a hero carousel slide' })
  createBanner(@Body() dto: CreateBannerDto) {
    return this.gateway.catalog(MerchandisingPatterns.CREATE_BANNER, { dto });
  }

  @Patch('banners/:bannerId')
  @ApiOperation({ summary: 'Update a banner' })
  updateBanner(@Param('bannerId', ParseUUIDPipe) bannerId: string, @Body() dto: UpdateBannerDto) {
    return this.gateway.catalog(MerchandisingPatterns.UPDATE_BANNER, { bannerId, dto });
  }

  @Delete('banners/:bannerId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a banner' })
  deleteBanner(@Param('bannerId', ParseUUIDPipe) bannerId: string) {
    return this.gateway.catalog(MerchandisingPatterns.DELETE_BANNER, { bannerId });
  }

  @Post('banners/reorder')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Persist a new carousel order' })
  reorderBanners(@Body() dto: ReorderDto) {
    return this.gateway.catalog(MerchandisingPatterns.REORDER_BANNERS, { dto });
  }

  // --- home sections -------------------------------------------------------

  @Get('home-sections')
  @ApiOperation({ summary: 'Every home page section and its tiles, including inactive ones' })
  listHomeSections() {
    return this.gateway.catalog(MerchandisingPatterns.ADMIN_LIST_HOME_SECTIONS, {});
  }

  @Post('home-sections')
  @ApiOperation({ summary: 'Create a new home page section (a "shelf")' })
  createHomeSection(@Body() dto: CreateHomeSectionDto) {
    return this.gateway.catalog(MerchandisingPatterns.CREATE_HOME_SECTION, { dto });
  }

  @Patch('home-sections/:sectionId')
  @ApiOperation({ summary: 'Update a section' })
  updateHomeSection(
    @Param('sectionId', ParseUUIDPipe) sectionId: string,
    @Body() dto: UpdateHomeSectionDto,
  ) {
    return this.gateway.catalog(MerchandisingPatterns.UPDATE_HOME_SECTION, { sectionId, dto });
  }

  @Delete('home-sections/:sectionId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a section and all of its tiles' })
  deleteHomeSection(@Param('sectionId', ParseUUIDPipe) sectionId: string) {
    return this.gateway.catalog(MerchandisingPatterns.DELETE_HOME_SECTION, { sectionId });
  }

  @Post('home-sections/reorder')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Persist a new section order' })
  reorderHomeSections(@Body() dto: ReorderDto) {
    return this.gateway.catalog(MerchandisingPatterns.REORDER_HOME_SECTIONS, { dto });
  }

  // --- section tiles ---------------------------------------------------------

  @Post('home-sections/:sectionId/tiles')
  @ApiOperation({ summary: 'Add a tile to a section' })
  createSectionTile(
    @Param('sectionId', ParseUUIDPipe) sectionId: string,
    @Body() dto: CreateSectionTileDto,
  ) {
    return this.gateway.catalog(MerchandisingPatterns.CREATE_SECTION_TILE, { sectionId, dto });
  }

  @Patch('home-sections/:sectionId/tiles/:tileId')
  @ApiOperation({ summary: 'Update a tile' })
  updateSectionTile(
    @Param('sectionId', ParseUUIDPipe) sectionId: string,
    @Param('tileId', ParseUUIDPipe) tileId: string,
    @Body() dto: UpdateSectionTileDto,
  ) {
    return this.gateway.catalog(MerchandisingPatterns.UPDATE_SECTION_TILE, { sectionId, tileId, dto });
  }

  @Delete('home-sections/:sectionId/tiles/:tileId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove a tile from a section' })
  deleteSectionTile(
    @Param('sectionId', ParseUUIDPipe) sectionId: string,
    @Param('tileId', ParseUUIDPipe) tileId: string,
  ) {
    return this.gateway.catalog(MerchandisingPatterns.DELETE_SECTION_TILE, { sectionId, tileId });
  }

  @Post('home-sections/:sectionId/tiles/reorder')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Persist a new tile order within a section' })
  reorderSectionTiles(@Param('sectionId', ParseUUIDPipe) sectionId: string, @Body() dto: ReorderDto) {
    return this.gateway.catalog(MerchandisingPatterns.REORDER_SECTION_TILES, { sectionId, dto });
  }

  // --- occasion themes -------------------------------------------------------

  @Get('themes')
  @ApiOperation({ summary: 'Every occasion theme, live or not' })
  listThemes() {
    return this.gateway.catalog(MerchandisingPatterns.ADMIN_LIST_THEMES, {});
  }

  @Post('themes')
  @ApiOperation({ summary: 'Create an occasion theme (Diwali, Holi, ...)' })
  createTheme(@Body() dto: CreateThemeDto) {
    return this.gateway.catalog(MerchandisingPatterns.CREATE_THEME, { dto });
  }

  @Patch('themes/:themeId')
  @ApiOperation({ summary: 'Update a theme - including switching it on/off or rescheduling it' })
  updateTheme(@Param('themeId', ParseUUIDPipe) themeId: string, @Body() dto: UpdateThemeDto) {
    return this.gateway.catalog(MerchandisingPatterns.UPDATE_THEME, { themeId, dto });
  }

  @Delete('themes/:themeId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a theme; banners/sections tied to it become always-on' })
  deleteTheme(@Param('themeId', ParseUUIDPipe) themeId: string) {
    return this.gateway.catalog(MerchandisingPatterns.DELETE_THEME, { themeId });
  }

  // --- footer columns ----------------------------------------------------------

  @Get('footer/columns')
  @ApiOperation({ summary: 'Every footer column and link, including inactive ones, plus settings' })
  listFooterColumns() {
    return this.gateway.catalog(MerchandisingPatterns.ADMIN_LIST_FOOTER_COLUMNS, {});
  }

  @Post('footer/columns')
  @ApiOperation({ summary: 'Create a footer link column' })
  createFooterColumn(@Body() dto: CreateFooterColumnDto) {
    return this.gateway.catalog(MerchandisingPatterns.CREATE_FOOTER_COLUMN, { dto });
  }

  @Patch('footer/columns/:columnId')
  @ApiOperation({ summary: 'Update a footer column' })
  updateFooterColumn(
    @Param('columnId', ParseUUIDPipe) columnId: string,
    @Body() dto: UpdateFooterColumnDto,
  ) {
    return this.gateway.catalog(MerchandisingPatterns.UPDATE_FOOTER_COLUMN, { columnId, dto });
  }

  @Delete('footer/columns/:columnId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a footer column and all of its links' })
  deleteFooterColumn(@Param('columnId', ParseUUIDPipe) columnId: string) {
    return this.gateway.catalog(MerchandisingPatterns.DELETE_FOOTER_COLUMN, { columnId });
  }

  @Post('footer/columns/reorder')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Persist a new footer column order' })
  reorderFooterColumns(@Body() dto: ReorderDto) {
    return this.gateway.catalog(MerchandisingPatterns.REORDER_FOOTER_COLUMNS, { dto });
  }

  // --- footer links --------------------------------------------------------------

  @Post('footer/columns/:columnId/links')
  @ApiOperation({ summary: 'Add a link to a footer column' })
  createFooterLink(
    @Param('columnId', ParseUUIDPipe) columnId: string,
    @Body() dto: CreateFooterLinkDto,
  ) {
    return this.gateway.catalog(MerchandisingPatterns.CREATE_FOOTER_LINK, { columnId, dto });
  }

  @Patch('footer/columns/:columnId/links/:linkId')
  @ApiOperation({ summary: 'Update a footer link' })
  updateFooterLink(
    @Param('columnId', ParseUUIDPipe) columnId: string,
    @Param('linkId', ParseUUIDPipe) linkId: string,
    @Body() dto: UpdateFooterLinkDto,
  ) {
    return this.gateway.catalog(MerchandisingPatterns.UPDATE_FOOTER_LINK, { columnId, linkId, dto });
  }

  @Delete('footer/columns/:columnId/links/:linkId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove a link from a footer column' })
  deleteFooterLink(
    @Param('columnId', ParseUUIDPipe) columnId: string,
    @Param('linkId', ParseUUIDPipe) linkId: string,
  ) {
    return this.gateway.catalog(MerchandisingPatterns.DELETE_FOOTER_LINK, { columnId, linkId });
  }

  @Post('footer/columns/:columnId/links/reorder')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Persist a new link order within a footer column' })
  reorderFooterLinks(@Param('columnId', ParseUUIDPipe) columnId: string, @Body() dto: ReorderDto) {
    return this.gateway.catalog(MerchandisingPatterns.REORDER_FOOTER_LINKS, { columnId, dto });
  }

  // --- footer settings -------------------------------------------------------------

  @Patch('footer/settings')
  @ApiOperation({ summary: 'Update social links, app store links and the copyright line' })
  updateFooterSettings(@Body() dto: UpdateFooterSettingsDto) {
    return this.gateway.catalog(MerchandisingPatterns.UPDATE_FOOTER_SETTINGS, { dto });
  }
}
