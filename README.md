# Couch Heroes - Geolocation MVP

A hybrid web/mobile geolocation MMO companion app that tracks player movement and geolocation check-ins to unlock rewards for a separate UE5 MMO.

## 🏗️ Architecture

```
couch-heroes/
├── apps/
│   ├── web/          # Next.js 15 (Desktop + Mobile Web)
│   ├── mobile/       # Capacitor wrapper
│   └── backend/      # Hono + Prisma + PostgreSQL
└── packages/
    └── shared/       # Shared types & utilities
```

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Start all services in development mode
npm run dev

# Build all apps
npm run build
```

## 📱 Apps

### Web (`apps/web`)
- **Framework**: Next.js 15 (App Router)
- **Map Engine**: MapLibre GL JS
- **Tiles**: OpenFreeMap (Vector Tiles)
- **State**: Zustand
- **Styling**: Tailwind CSS + Shadcn/UI
- **URL**: http://localhost:3000

### Mobile (`apps/mobile`)
- **Framework**: Capacitor
- **Platforms**: iOS, Android
- **Source**: Wraps `apps/web`

### Backend (`apps/backend`)
- **Framework**: Hono
- **Database**: PostgreSQL + Prisma
- **URL**: http://localhost:3001

## 🎮 Features

### Quest Types
- **Movement Quests**: Track distance using Haversine formula
- **Check-in Quests**: Proximity-based location validation (default 50m radius)

### Anti-Cheat
- Speed cap enforcement (>30 km/h rejected)
- Teleportation detection
- Location history tracking

### Development Tools
- **Mock Location Service**: Simulate GPS movement with keyboard controls (WASD/Arrows)
- Real-time quest progress tracking
- Three-layer UI: Map → Game Canvas → UI Overlay

## 📦 Packages

### Shared (`packages/shared`)
Shared TypeScript types and utilities:
- Quest interfaces
- Location types
- Haversine distance calculation
- Movement validation helpers

## 🛠️ Tech Stack

- **Monorepo**: Turborepo
- **Frontend**: React 19, Next.js 15, TypeScript
- **Maps**: MapLibre GL JS, OpenFreeMap
- **State**: Zustand
- **Styling**: Tailwind CSS, Shadcn/UI
- **Backend**: Node.js, Hono, Prisma, PostgreSQL
- **Mobile**: Capacitor

## 📖 Development

### Running Individual Apps

```bash
# Web app only
cd apps/web && npm run dev

# Backend only
cd apps/backend && npm run dev
```

### Building for Production

```bash
# Build all apps
npm run build

# Build specific app
cd apps/web && npm run build
```

### Mobile Development

```bash
# Sync web build to native platforms
cd apps/mobile
npx cap sync

# Open in Xcode (iOS)
npx cap open ios

# Open in Android Studio
npx cap open android
```

## 🗺️ Map Configuration

- **Center**: Athens, Greece (37.9838° N, 23.7275° E)
- **Style**: OpenFreeMap 'Liberty'
- **No API Keys Required**: Uses open-source tiles

## 🧪 Testing

### Mock Location Service
Toggle "Use Mock GPS" in the UI to use keyboard controls:
- **WASD** or **Arrow Keys**: Move in cardinal directions
- Simulates walking/running speeds
- Perfect for testing without leaving your desk

### Real GPS Testing
Requires actual movement (walking/driving) to test on mobile devices.

## 📄 License

MIT
