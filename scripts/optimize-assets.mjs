/**
 * Generates the runtime assets from the Figma cache (`design/assets`):
 * - NFT artwork in AVIF + WebP at several widths (`public/images/nft/<slug>-<width>.<ext>`),
 *   plus three square crops of the same artwork used as the other gallery views
 *   (`-detail`: face, `-torso`: chest/accessory, `-side`: alternative framing);
 * - Roboto Mono variable font (latin + latin-ext) copied from @fontsource-variable,
 *   self-hosted under `public/fonts` so it can be preloaded from index.html.
 *
 * Run with `node scripts/optimize-assets.mjs` (outputs are committed).
 */
import { copyFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const root = path.resolve(import.meta.dirname, '..')
const imagesDir = path.join(root, 'design/assets/images')
const outImages = path.join(root, 'public/images/nft')
const outFonts = path.join(root, 'public/fonts')

const ARTWORK = {
  'emerald-ape': '8459204731e6eba9d474cbc8ebc37071360d3ba5.png',
  'sage-nomad': '2986a7cb16d09de8970824d2dd58bf0bb021702c.png',
  'ivory-baron': '9df2ff42dd27ba657621c304557d1a855a4be6a5.png',
  'golden-beat': '87580f2def9af0ce13f4b6f6ce17bb2449bcfc16.png',
}
export const WIDTHS = [256, 512, 800]

await mkdir(outImages, { recursive: true })
await mkdir(outFonts, { recursive: true })

for (const [slug, file] of Object.entries(ARTWORK)) {
  const source = sharp(path.join(imagesDir, file))
  const { width = 1254, height = 1254 } = await source.metadata()
  const crop = (fraction, leftRatio, topRatio) => {
    const size = Math.round(width * fraction)
    return sharp(path.join(imagesDir, file)).extract({
      left: Math.round((width - size) * leftRatio),
      top: Math.min(Math.round(height * topRatio), height - size),
      width: size,
      height: size,
    })
  }
  const views = [
    [slug, source],
    [`${slug}-detail`, crop(0.62, 0.5, 0.12)],
    [`${slug}-torso`, crop(0.55, 0.5, 0.45)],
    [`${slug}-side`, crop(0.78, 0.05, 0.08)],
  ]
  for (const [name, image] of views) {
    for (const w of WIDTHS) {
      const resized = image.clone().resize(w, w)
      await resized.clone().avif({ quality: 50, effort: 6 }).toFile(path.join(outImages, `${name}-${w}.avif`))
      await resized.clone().webp({ quality: 78, effort: 6 }).toFile(path.join(outImages, `${name}-${w}.webp`))
    }
  }
  console.log('artwork', slug)
}

const fontFiles = ['roboto-mono-latin-wght-normal.woff2', 'roboto-mono-latin-ext-wght-normal.woff2']
for (const file of fontFiles) {
  await copyFile(path.join(root, 'node_modules/@fontsource-variable/roboto-mono/files', file), path.join(outFonts, file))
}
console.log('fonts', fontFiles.length)
