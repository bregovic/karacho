<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# 🎤 KARACHO PROJECT STANDARDS

## 🎹 Designer Logic (Timing Editor)
- **ENTER Key / 📏 Button**: Line Advance ONLY. Preparation mode. Does NOT key the first word.
- **W Key / ✨ Button**: Word Timing. If pressed on the last word of a line, it MUST advance to the next line AND automatically key the first word of that new line (Fluid flow).
- **BACKSPACE**: Must always have a visible UI button (✕) in mobile view because keyboard Backspace is unreliable on mobile.

## 📱 Mobile UI & Accessibility
- **Designer Progress Bar**: Height >= 30px on mobile for touch precision.
- **Top Bar**: Logo on left, Hamburger Menu on right. Do NOT wrap items to multiple lines.
- **No Slovakisms**: Labels must be in proper Czech (e.g., "ŤUKEJ SEM DO RYTMU" instead of "RYTMA").

## 🎸 Chords Mode (Songbook)
- **Audio Suppression**: If localMode or sessionMode is 'CHORDS', audio MUST be muted, paused, and preferably not preloaded.
- **Full Width**: Text view uses 100% viewport width and optimized font scaling.
- **Smart Detection**: Detect chords even in plain text format (A, G, Ami) and render them yellow above text lines.

## 🕵️ Scraper Logic
- **Supermusic**: Use export.php if possible, otherwise parse HTML `<span>` and `<b>` tags to extract chords into `[G]` format.
