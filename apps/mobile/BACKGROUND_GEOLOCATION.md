# Capacitor Background Geolocation

## Installation

```bash
npm install @capacitor-community/background-geolocation
npx cap sync
```

## iOS Configuration

Add to `ios/App/App/Info.plist`:

```xml
<key>UIBackgroundModes</key>
<array>
  <string>location</string>
</array>
<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
<string>Couch Heroes needs background location access to track your quest progress even when the app is in the background.</string>
<key>NSLocationWhenInUseUsageDescription</key>
<string>Couch Heroes needs location access to track your movement quests.</string>
```

## Android Configuration

Add to `android/app/src/main/AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_LOCATION" />
```

## Usage

See `apps/web/src/services/BackgroundGeolocationService.ts` for implementation.

### Key Features

- **Battery Efficient**: Uses OS-level optimizations for background tracking
- **Batch Updates**: Stores locations while app is backgrounded, sends in batches
- **Auto Start/Stop**: Integrates with app lifecycle
- **Configurable**: Distance filter and update interval can be adjusted

### Important Notes

1. **Backend must accept batch uploads**: The background plugin will send 10-20 locations at once when app wakes
2. **Battery optimization**: Set `distanceFilter` to at least 10m to avoid excessive updates
3. **iOS requires "Always" permission**: Users must grant background location access
4. **Android requires foreground service**: Shows persistent notification while tracking

## Configuration

```typescript
BackgroundGeolocation.configure({
  locationProvider: BackgroundGeolocation.RAW_PROVIDER,
  desiredAccuracy: BackgroundGeolocation.HIGH_ACCURACY,
  stationaryRadius: 20,
  distanceFilter: 10, // Minimum 10m movement to trigger update
  notificationTitle: 'Couch Heroes Quest Tracking',
  notificationText: 'Tracking your adventure...',
  debug: false,
  interval: 10000, // 10 seconds
  fastestInterval: 5000,
  activitiesInterval: 10000,
});
```
