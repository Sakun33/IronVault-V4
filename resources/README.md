# App Assets

## Source Files Required

To generate all required app icons and splash screens, place the following files in this directory:

### Icon (Required)
- `icon.png` - 1024x1024px PNG with transparent background
  - Will be used to generate all iOS and Android app icons
  - Should be a simple, recognizable design that works at small sizes
  - Must have padding (safe zone) as it will be cropped for iOS and Android

### Splash Screen (Optional but Recommended)
- `splash.png` - 2732x2732px PNG
  - Centered logo/branding on solid background
  - Will be used to generate launch screens for all devices

### Dark Mode Splash (Optional)
- `splash-dark.png` - 2732x2732px PNG
  - Dark mode variant of splash screen

## Generating Assets

Once you have the source files, run:

```bash
npx capacitor-assets generate
```

This will automatically generate:
- iOS app icons (all required sizes)
- iOS launch screens
- Android app icons (all densities)
- Android adaptive icons
- Android splash screens

## Manual Asset Locations

If you prefer to manually create assets:

### iOS
- App icons: `ios/App/App/Assets.xcassets/AppIcon.appiconset/`
- Launch images: `ios/App/App/Assets.xcassets/Splash.imageset/`

### Android
- App icons: `android/app/src/main/res/mipmap-*/`
- Adaptive icons: `android/app/src/main/res/mipmap-anydpi-v26/`
- Splash: `android/app/src/main/res/drawable*/`

## Current Status

The app currently references icon files in `/icons/` directory but these need to be created.
For now, Capacitor will use default placeholder icons until proper assets are generated.
