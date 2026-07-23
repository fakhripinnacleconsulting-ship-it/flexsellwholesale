"use client";

import * as React from "react";
import { useThemeStore } from "@/stores/themeStore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { defaultTheme } from "@/config/theme.config";

export function ThemeEditor() {
  const { activeTheme, setTheme, resetTheme } = useThemeStore();
  const [localTheme, setLocalTheme] = React.useState(activeTheme);

  // Sync state if store changes
  React.useEffect(() => {
    setLocalTheme(activeTheme);
  }, [activeTheme]);

  const handleColorChange = (key: keyof typeof localTheme.colors, value: string) => {
    setLocalTheme((prev) => ({
      ...prev,
      colors: {
        ...prev.colors,
        [key]: value,
      },
    }));
  };

  const handleSave = () => {
    setTheme(localTheme);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Theme Editor</h1>
          <p className="text-muted-foreground mt-1">Customize the look and feel of your storefront.</p>
        </div>
        <div className="flex gap-4">
          <Button variant="outline" onClick={() => { resetTheme(); setLocalTheme(defaultTheme); }}>
            Reset to Default
          </Button>
          <Button onClick={handleSave}>Save Theme Changes</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Color Palette</CardTitle>
              <CardDescription>Adjust the primary brand colors. Changes take effect on save.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Primary Color</label>
                  <div className="flex gap-3">
                    <input 
                      type="color" 
                      value={localTheme.colors.primary}
                      onChange={(e) => handleColorChange("primary", e.target.value)}
                      className="h-10 w-16 p-1 rounded cursor-pointer"
                    />
                    <Input 
                      value={localTheme.colors.primary} 
                      onChange={(e) => handleColorChange("primary", e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Primary Foreground</label>
                  <div className="flex gap-3">
                    <input 
                      type="color" 
                      value={localTheme.colors.primaryForeground}
                      onChange={(e) => handleColorChange("primaryForeground", e.target.value)}
                      className="h-10 w-16 p-1 rounded cursor-pointer"
                    />
                    <Input 
                      value={localTheme.colors.primaryForeground} 
                      onChange={(e) => handleColorChange("primaryForeground", e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Secondary Color</label>
                  <div className="flex gap-3">
                    <input 
                      type="color" 
                      value={localTheme.colors.secondary}
                      onChange={(e) => handleColorChange("secondary", e.target.value)}
                      className="h-10 w-16 p-1 rounded cursor-pointer"
                    />
                    <Input 
                      value={localTheme.colors.secondary} 
                      onChange={(e) => handleColorChange("secondary", e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Accent Color</label>
                  <div className="flex gap-3">
                    <input 
                      type="color" 
                      value={localTheme.colors.accent}
                      onChange={(e) => handleColorChange("accent", e.target.value)}
                      className="h-10 w-16 p-1 rounded cursor-pointer"
                    />
                    <Input 
                      value={localTheme.colors.accent} 
                      onChange={(e) => handleColorChange("accent", e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Typography & Radius</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
               <div className="space-y-2">
                  <label className="text-sm font-medium">Border Radius (rem)</label>
                  <Input 
                    value={localTheme.borderRadius}
                    onChange={(e) => setLocalTheme(p => ({ ...p, borderRadius: e.target.value }))}
                  />
                  <p className="text-xs text-muted-foreground">Example: 0.5rem, 1rem, 9999px</p>
                </div>
            </CardContent>
          </Card>
        </div>

        {/* Live Preview Pane */}
        <div>
          <Card className="sticky top-24 overflow-hidden border-2 border-primary/20">
            <div className="bg-secondary/50 p-3 border-b text-sm font-medium text-center">
              Live Preview Component
            </div>
            <CardContent className="p-8 space-y-8" style={{
              // Inject the local unsaved variables just for this container to preview
              "--primary": localTheme.colors.primary,
              "--primary-foreground": localTheme.colors.primaryForeground,
              "--secondary": localTheme.colors.secondary,
              "--secondary-foreground": localTheme.colors.secondaryForeground,
              "--accent": localTheme.colors.accent,
              "--radius": localTheme.borderRadius,
            } as React.CSSProperties}>
              
              <div className="space-y-4">
                <h3 className="font-bold text-lg text-foreground">Buttons</h3>
                <div className="flex flex-wrap gap-4">
                  <Button>Primary Action</Button>
                  <Button variant="secondary">Secondary Action</Button>
                  <Button variant="outline">Outline</Button>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-bold text-lg text-foreground">Interactive Elements</h3>
                <div className="space-y-3">
                  <Input placeholder="This is an input field" className="focus-visible:ring-primary" />
                  <div className="flex items-center gap-2">
                    <input type="checkbox" checked readOnly className="rounded text-primary focus:ring-primary" />
                    <label className="text-sm">Checkboxes use primary color</label>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-bold text-lg text-foreground">Cards</h3>
                <Card className="shadow-none">
                  <CardContent className="p-4 bg-secondary text-secondary-foreground rounded-[var(--radius)]">
                    This card uses the secondary background color to highlight content.
                  </CardContent>
                </Card>
              </div>

            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
