'use client';

import { PageHeader } from '@/components/layout/page-header';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BannerList } from '@/features/banners/components/banner-list';
import { ColumnList } from '@/features/footer/components/column-list';
import { FooterSettingsForm } from '@/features/footer/components/footer-settings-form';
import { SectionList } from '@/features/home-sections/components/section-list';
import { ThemeList } from '@/features/themes/components/theme-list';

export default function StorefrontPage() {
  return (
    <>
      <PageHeader
        title="Storefront"
        description="Occasion themes (Diwali, Holi...), hero banners, home page sections and the site footer. Changes go live on the storefront within a few minutes."
      />

      <Tabs defaultValue="themes">
        <TabsList>
          <TabsTrigger value="themes">Occasion themes</TabsTrigger>
          <TabsTrigger value="banners">Banners</TabsTrigger>
          <TabsTrigger value="sections">Home sections</TabsTrigger>
          <TabsTrigger value="footer-columns">Footer columns</TabsTrigger>
          <TabsTrigger value="footer-settings">Footer settings</TabsTrigger>
        </TabsList>

        <TabsContent value="themes" className="mt-4">
          <ThemeList />
        </TabsContent>
        <TabsContent value="banners" className="mt-4">
          <BannerList />
        </TabsContent>
        <TabsContent value="sections" className="mt-4">
          <SectionList />
        </TabsContent>
        <TabsContent value="footer-columns" className="mt-4">
          <ColumnList />
        </TabsContent>
        <TabsContent value="footer-settings" className="mt-4">
          <FooterSettingsForm />
        </TabsContent>
      </Tabs>
    </>
  );
}
