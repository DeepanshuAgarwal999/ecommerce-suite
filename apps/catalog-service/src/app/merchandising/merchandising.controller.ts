import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import {
  CreateBannerDto,
  CreateFooterColumnDto,
  CreateFooterLinkDto,
  CreateHomeSectionDto,
  CreateSectionTileDto,
  CreateThemeDto,
  MerchandisingPatterns,
  ReorderDto,
  UpdateBannerDto,
  UpdateFooterColumnDto,
  UpdateFooterLinkDto,
  UpdateFooterSettingsDto,
  UpdateHomeSectionDto,
  UpdateSectionTileDto,
  UpdateThemeDto,
} from '@ecommerce/contracts';
import { BannerService } from './banner.service';
import { FooterService } from './footer.service';
import { HomeSectionService } from './home-section.service';
import { ThemeService } from './theme.service';

@Controller()
export class MerchandisingController {
  constructor(
    private readonly banners: BannerService,
    private readonly sections: HomeSectionService,
    private readonly themes: ThemeService,
    private readonly footer: FooterService,
  ) {}

  // --- banners -----------------------------------------------------------

  @MessagePattern(MerchandisingPatterns.LIST_BANNERS)
  listBanners() {
    return this.banners.listPublic();
  }

  @MessagePattern(MerchandisingPatterns.ADMIN_LIST_BANNERS)
  adminListBanners() {
    return this.banners.adminList();
  }

  @MessagePattern(MerchandisingPatterns.CREATE_BANNER)
  createBanner(@Payload() msg: { dto: CreateBannerDto }) {
    return this.banners.create(msg.dto);
  }

  @MessagePattern(MerchandisingPatterns.UPDATE_BANNER)
  updateBanner(@Payload() msg: { bannerId: string; dto: UpdateBannerDto }) {
    return this.banners.update(msg.bannerId, msg.dto);
  }

  @MessagePattern(MerchandisingPatterns.DELETE_BANNER)
  deleteBanner(@Payload() msg: { bannerId: string }) {
    return this.banners.remove(msg.bannerId);
  }

  @MessagePattern(MerchandisingPatterns.REORDER_BANNERS)
  reorderBanners(@Payload() msg: { dto: ReorderDto }) {
    return this.banners.reorder(msg.dto);
  }

  // --- home sections -------------------------------------------------------

  @MessagePattern(MerchandisingPatterns.LIST_HOME_SECTIONS)
  listHomeSections() {
    return this.sections.listPublic();
  }

  @MessagePattern(MerchandisingPatterns.ADMIN_LIST_HOME_SECTIONS)
  adminListHomeSections() {
    return this.sections.adminList();
  }

  @MessagePattern(MerchandisingPatterns.CREATE_HOME_SECTION)
  createHomeSection(@Payload() msg: { dto: CreateHomeSectionDto }) {
    return this.sections.createSection(msg.dto);
  }

  @MessagePattern(MerchandisingPatterns.UPDATE_HOME_SECTION)
  updateHomeSection(@Payload() msg: { sectionId: string; dto: UpdateHomeSectionDto }) {
    return this.sections.updateSection(msg.sectionId, msg.dto);
  }

  @MessagePattern(MerchandisingPatterns.DELETE_HOME_SECTION)
  deleteHomeSection(@Payload() msg: { sectionId: string }) {
    return this.sections.removeSection(msg.sectionId);
  }

  @MessagePattern(MerchandisingPatterns.REORDER_HOME_SECTIONS)
  reorderHomeSections(@Payload() msg: { dto: ReorderDto }) {
    return this.sections.reorderSections(msg.dto);
  }

  // --- section tiles -------------------------------------------------------

  @MessagePattern(MerchandisingPatterns.CREATE_SECTION_TILE)
  createSectionTile(@Payload() msg: { sectionId: string; dto: CreateSectionTileDto }) {
    return this.sections.createTile(msg.sectionId, msg.dto);
  }

  @MessagePattern(MerchandisingPatterns.UPDATE_SECTION_TILE)
  updateSectionTile(@Payload() msg: { sectionId: string; tileId: string; dto: UpdateSectionTileDto }) {
    return this.sections.updateTile(msg.sectionId, msg.tileId, msg.dto);
  }

  @MessagePattern(MerchandisingPatterns.DELETE_SECTION_TILE)
  deleteSectionTile(@Payload() msg: { sectionId: string; tileId: string }) {
    return this.sections.removeTile(msg.sectionId, msg.tileId);
  }

  @MessagePattern(MerchandisingPatterns.REORDER_SECTION_TILES)
  reorderSectionTiles(@Payload() msg: { sectionId: string; dto: ReorderDto }) {
    return this.sections.reorderTiles(msg.sectionId, msg.dto);
  }

  // --- occasion themes -----------------------------------------------------

  @MessagePattern(MerchandisingPatterns.ACTIVE_THEME)
  activeTheme() {
    return this.themes.active();
  }

  @MessagePattern(MerchandisingPatterns.ADMIN_LIST_THEMES)
  adminListThemes() {
    return this.themes.adminList();
  }

  @MessagePattern(MerchandisingPatterns.CREATE_THEME)
  createTheme(@Payload() msg: { dto: CreateThemeDto }) {
    return this.themes.create(msg.dto);
  }

  @MessagePattern(MerchandisingPatterns.UPDATE_THEME)
  updateTheme(@Payload() msg: { themeId: string; dto: UpdateThemeDto }) {
    return this.themes.update(msg.themeId, msg.dto);
  }

  @MessagePattern(MerchandisingPatterns.DELETE_THEME)
  deleteTheme(@Payload() msg: { themeId: string }) {
    return this.themes.remove(msg.themeId);
  }

  // --- footer ----------------------------------------------------------------

  @MessagePattern(MerchandisingPatterns.GET_FOOTER)
  getFooter() {
    return this.footer.getPublic();
  }

  @MessagePattern(MerchandisingPatterns.ADMIN_LIST_FOOTER_COLUMNS)
  adminListFooterColumns() {
    return this.footer.adminList();
  }

  @MessagePattern(MerchandisingPatterns.CREATE_FOOTER_COLUMN)
  createFooterColumn(@Payload() msg: { dto: CreateFooterColumnDto }) {
    return this.footer.createColumn(msg.dto);
  }

  @MessagePattern(MerchandisingPatterns.UPDATE_FOOTER_COLUMN)
  updateFooterColumn(@Payload() msg: { columnId: string; dto: UpdateFooterColumnDto }) {
    return this.footer.updateColumn(msg.columnId, msg.dto);
  }

  @MessagePattern(MerchandisingPatterns.DELETE_FOOTER_COLUMN)
  deleteFooterColumn(@Payload() msg: { columnId: string }) {
    return this.footer.removeColumn(msg.columnId);
  }

  @MessagePattern(MerchandisingPatterns.REORDER_FOOTER_COLUMNS)
  reorderFooterColumns(@Payload() msg: { dto: ReorderDto }) {
    return this.footer.reorderColumns(msg.dto);
  }

  @MessagePattern(MerchandisingPatterns.CREATE_FOOTER_LINK)
  createFooterLink(@Payload() msg: { columnId: string; dto: CreateFooterLinkDto }) {
    return this.footer.createLink(msg.columnId, msg.dto);
  }

  @MessagePattern(MerchandisingPatterns.UPDATE_FOOTER_LINK)
  updateFooterLink(@Payload() msg: { columnId: string; linkId: string; dto: UpdateFooterLinkDto }) {
    return this.footer.updateLink(msg.columnId, msg.linkId, msg.dto);
  }

  @MessagePattern(MerchandisingPatterns.DELETE_FOOTER_LINK)
  deleteFooterLink(@Payload() msg: { columnId: string; linkId: string }) {
    return this.footer.removeLink(msg.columnId, msg.linkId);
  }

  @MessagePattern(MerchandisingPatterns.REORDER_FOOTER_LINKS)
  reorderFooterLinks(@Payload() msg: { columnId: string; dto: ReorderDto }) {
    return this.footer.reorderLinks(msg.columnId, msg.dto);
  }

  @MessagePattern(MerchandisingPatterns.UPDATE_FOOTER_SETTINGS)
  updateFooterSettings(@Payload() msg: { dto: UpdateFooterSettingsDto }) {
    return this.footer.updateSettings(msg.dto);
  }
}
