# MINJA

A multilingual portfolio for MINJA: visual direction, music visuals, live VJ and generative film.

**Live site:** https://jiamiing.github.io/minja-portfolio/

## Experience

- 11 directly addressable pages, including six project details
- English, Japanese, Simplified Chinese, Traditional Chinese and Korean
- Portfolio artwork extracted and optimized as responsive WebP images
- Real-time WebGL refraction, page transitions, scroll reveals, image parallax and a sticky editorial composition
- Filterable work index, drag-to-scroll galleries and a keyboard-accessible image lightbox
- Mobile navigation, persistent language selection, reduced-motion support and an explicit motion switch
- Xiaohongshu and Douyin contact links

## Local development

No dependencies or build step are required.

```sh
python3 -m http.server 4173
```

Visit http://localhost:4173/. Run `npm run check` for JavaScript syntax checks.

## Edit

- `content.js`: five-language copy, project data and contact links
- `app.js`: pages and interaction logic
- `style.css`: typography, layout, motion and responsive styles
- `assets/`: optimized artwork extracted from the supplied portfolio
- Each route includes its own `index.html`, so GitHub Pages supports direct links and refreshes.

Publish the `main` branch, `/ (root)`, in Settings → Pages. `.nojekyll` keeps this a plain static site.

Typography uses Google Fonts (Bodoni Moda and DM Sans), with system fallbacks. All other assets are hosted in the repository. No analytics or server-side data collection.

All artwork © MINJA. No artwork reuse license is granted by this repository.
