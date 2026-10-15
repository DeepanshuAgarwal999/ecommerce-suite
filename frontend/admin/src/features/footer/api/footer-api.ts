import { api, endpoints } from '@/lib/api';
import type {
  FooterAdminData,
  FooterColumn,
  FooterColumnInput,
  FooterLink,
  FooterLinkInput,
  FooterSettings,
  FooterSettingsInput,
} from '../types';

export interface ReorderInput {
  items: { id: string; displayOrder: number }[];
}

export const footerApi = {
  list: () => api.get<FooterAdminData>(endpoints.admin.footerColumns),

  createColumn: (input: FooterColumnInput) =>
    api.post<FooterColumn>(endpoints.admin.footerColumns, input),

  updateColumn: (columnId: string, input: Partial<FooterColumnInput>) =>
    api.patch<FooterColumn>(endpoints.admin.footerColumn(columnId), input),

  removeColumn: (columnId: string) =>
    api.delete<{ ok: true }>(endpoints.admin.footerColumn(columnId)),

  reorderColumns: (input: ReorderInput) =>
    api.post<FooterColumn[]>(endpoints.admin.reorderFooterColumns, input),

  createLink: (columnId: string, input: FooterLinkInput) =>
    api.post<FooterLink>(endpoints.admin.footerLinks(columnId), input),

  updateLink: (columnId: string, linkId: string, input: Partial<FooterLinkInput>) =>
    api.patch<FooterLink>(endpoints.admin.footerLink(columnId, linkId), input),

  removeLink: (columnId: string, linkId: string) =>
    api.delete<{ ok: true }>(endpoints.admin.footerLink(columnId, linkId)),

  reorderLinks: (columnId: string, input: ReorderInput) =>
    api.post<FooterColumn>(endpoints.admin.reorderFooterLinks(columnId), input),

  updateSettings: (input: FooterSettingsInput) =>
    api.patch<FooterSettings>(endpoints.admin.footerSettings, input),
};
