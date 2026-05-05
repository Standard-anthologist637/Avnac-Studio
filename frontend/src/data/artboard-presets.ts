export type ArtboardPresetCategory = 'general' | 'social-media' | 'presentation' | 'print'

export type ArtboardPreset = {
  id: string
  label: string
  width: number
  height: number
  category: ArtboardPresetCategory
}

export const ARTBOARD_PRESETS: readonly ArtboardPreset[] = [
  { id: 'custom-4000', label: 'Large square (4000)', width: 4000, height: 4000, category: 'general' },
  { id: 'hd', label: 'HD (1920×1080)', width: 1920, height: 1080, category: 'general' },
  { id: 'ig-square', label: 'Instagram square (1080)', width: 1080, height: 1080, category: 'social-media' },
  { id: 'ig-portrait', label: 'Instagram portrait (1080×1350)', width: 1080, height: 1350, category: 'social-media' },
  { id: 'ig-story', label: 'Story / Reels (1080×1920)', width: 1080, height: 1920, category: 'social-media' },
  { id: 'twitter-post', label: 'X / Twitter post (1200×675)', width: 1200, height: 675, category: 'social-media' },
  { id: 'linkedin', label: 'LinkedIn share (1200×627)', width: 1200, height: 627, category: 'social-media' },
  { id: 'youtube-thumb', label: 'YouTube thumbnail (1280×720)', width: 1280, height: 720, category: 'social-media' },
  { id: 'a4-300', label: 'Print A4 @300dpi (2480×3508)', width: 2480, height: 3508, category: 'print' },
] as const
