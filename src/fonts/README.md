# Fonts Directory

This directory contains the Roboto font files required for PDF generation with pdfmake.

## Quick Setup

### First Time Setup

Run the download script to automatically download all required fonts:

```bash
npm run download-fonts
```

### If Fonts Are Corrupted or Invalid

If you get "Unknown font format" errors, clean and re-download:

```bash
npm run clean-fonts
```

This will delete existing fonts and download fresh ones.

### Manual Download

Or manually:

```bash
node src/fonts/download-fonts.js
```

## Required Font Files

The following font files are required:

1. **Roboto-Regular.ttf** - Normal text
2. **Roboto-Bold.ttf** - Bold text
3. **Roboto-Italic.ttf** - Italic text
4. **Roboto-Medium.ttf** - Medium weight (used for bolditalics)

## Manual Download

If the automatic download fails, you can manually download Roboto fonts from:

- Google Fonts: https://fonts.google.com/specimen/Roboto
- GitHub: https://github.com/google/fonts/tree/main/apache/roboto

After downloading, place the `.ttf` files directly in this `src/fonts/` directory.

## Note

These fonts are required for PDF generation. Without them, PDF exports will fail with font loading errors.

The fonts are automatically checked when the PDF utility is initialized, and a clear error message will be shown if any fonts are missing.
