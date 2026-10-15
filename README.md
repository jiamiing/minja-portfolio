# MINJA

A multilingual portfolio for MINJA: visual direction, music visuals, live VJ and generative film.

**Live site:** https://jiamiing.github.io/minja-portfolio/

## Experience

- 11 directly addressable pages, including six project details
- English, Japanese, Simplified Chinese, Traditional Chinese and Korean
- 49 original artworks supplied by MINJA, optimized directly from the source PNG files as responsive WebP images
- Real-time WebGL refraction and textured glass, animated frosted panes, layered sharp/blurred images, page transitions, scroll reveals and parallax
- Code-drawn MINJA identity from vector contours: spring particles, cursor scattering, click bursts and reconstruction; no logo image is loaded
- Elastic glyph interaction and liquid displacement across hero type, a magnetic navigation indicator, rolling labels and an image-driven full-screen menu
- Six-image practice choreography, immersive project entrances and scroll-cut image sequences, a visual collaboration ledger, portrait shutters and scroll-lit multilingual reading
- Filterable project and 49-image indexes, drag-to-scroll galleries and a keyboard-accessible full-resolution image lightbox
- Mobile navigation, persistent language selection, reduced-motion support and an explicit motion switch
- Seven native-scroll chapters: image expansion, kinetic typography, split-mask scene changes, a horizontal project rail, glass takeover, photo constellation and closing invitation
- Five-language AJAX inquiry form with required fields, email validation, honeypot, duplicate-submit prevention and recoverable error states
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
- `style.css`: shared typography and layout
- `story.js` / `story.css`: native-scroll timeline and chapter compositions
- `motion.js` / `motion.css`: glyph physics, navigation and page-specific timelines
- `logo-geometry.js` / `identity.js`: editable vector paths and spring-particle identity renderer
- `inquiry.js` / `inquiry.css`: contact form and submission feedback
- `contact-config.js`: public FormSubmit endpoint and production form URL
- `assets/`: responsive artwork generated from the supplied high-resolution originals
- Each route includes its own `index.html`, so GitHub Pages supports direct links and refreshes.

Publish the `main` branch, `/ (root)`, in Settings → Pages. `.nojekyll` keeps this a plain static site.

Typography uses Google Fonts (Bodoni Moda and DM Sans), with system fallbacks. All other assets are hosted in the repository. `media.js` records the source and served dimensions for each artwork. No PDF screenshots or PDF-cropped artwork is used. The existing brand outline is rebuilt as code-defined vector contours; the interactive footer draws the shape and its particle targets on canvas. No analytics. Contact inquiries are sent to FormSubmit for email delivery; the site has no private SMTP credentials. The recipient must complete the one-time FormSubmit email activation before delivery starts. Change the public endpoint in `contact-config.js` to change recipients. Submission success confirms service acceptance, not inbox receipt.

All artwork © MINJA. No artwork reuse license is granted by this repository.
