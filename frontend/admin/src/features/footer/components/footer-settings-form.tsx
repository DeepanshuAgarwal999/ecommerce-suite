'use client';

import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useFooter, useUpdateFooterSettings } from '../hooks/use-footer';
import { SOCIAL_PLATFORMS, type SocialLink } from '../types';

export function FooterSettingsForm() {
  const { data, isLoading } = useFooter();
  const update = useUpdateFooterSettings();

  const [social, setSocial] = useState<SocialLink[]>([]);
  const [appStoreUrl, setAppStoreUrl] = useState('');
  const [playStoreUrl, setPlayStoreUrl] = useState('');
  const [copyrightText, setCopyrightText] = useState('');
  const [loaded, setLoaded] = useState(false);

  // Seed local form state once, the first time settings arrive - an admin's
  // in-progress edits should not be clobbered by a background refetch.
  useEffect(() => {
    if (loaded || !data) return;
    const settings = data.settings;
    setSocial(settings?.socialLinks ?? []);
    setAppStoreUrl(settings?.appStoreUrl ?? '');
    setPlayStoreUrl(settings?.playStoreUrl ?? '');
    setCopyrightText(settings?.copyrightText ?? '');
    setLoaded(true);
  }, [data, loaded]);

  if (isLoading || !loaded) {
    return <Skeleton className="h-96 w-full" />;
  }

  function updateSocialRow(index: number, patch: Partial<SocialLink>) {
    setSocial((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function save() {
    update.mutate({
      socialLinks: social.filter((row) => row.url.trim() !== ''),
      appStoreUrl: appStoreUrl || null,
      playStoreUrl: playStoreUrl || null,
      copyrightText: copyrightText || null,
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Social links</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {social.map((row, index) => (
            <div key={index} className="flex items-center gap-2">
              <Select
                value={row.platform}
                onValueChange={(value) => updateSocialRow(index, { platform: value as SocialLink['platform'] })}
              >
                <SelectTrigger className="w-36 shrink-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SOCIAL_PLATFORMS.map((platform) => (
                    <SelectItem key={platform} value={platform} className="capitalize">
                      {platform}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                value={row.url}
                onChange={(event) => updateSocialRow(index, { url: event.target.value })}
                placeholder="https://instagram.com/..."
                className="flex-1"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => setSocial((rows) => rows.filter((_, i) => i !== index))}
                aria-label="Remove social link"
              >
                <Trash2 className="size-4 text-destructive" aria-hidden />
              </Button>
            </div>
          ))}

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="self-start"
            onClick={() => setSocial((rows) => [...rows, { platform: 'instagram', url: '' }])}
          >
            <Plus className="size-3.5" aria-hidden />
            Add platform
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">App download links</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="app-store-url">App Store URL</Label>
            <Input
              id="app-store-url"
              value={appStoreUrl}
              onChange={(event) => setAppStoreUrl(event.target.value)}
              placeholder="https://apps.apple.com/..."
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="play-store-url">Play Store URL</Label>
            <Input
              id="play-store-url"
              value={playStoreUrl}
              onChange={(event) => setPlayStoreUrl(event.target.value)}
              placeholder="https://play.google.com/..."
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Copyright line</CardTitle>
        </CardHeader>
        <CardContent>
          <Input
            value={copyrightText}
            onChange={(event) => setCopyrightText(event.target.value)}
            placeholder="© 2026 Nestora. All rights reserved."
          />
        </CardContent>
      </Card>

      <Button type="button" onClick={save} disabled={update.isPending} className="self-start">
        {update.isPending ? 'Saving…' : 'Save footer settings'}
      </Button>
    </div>
  );
}
