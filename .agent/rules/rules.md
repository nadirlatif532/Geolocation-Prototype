---
trigger: always_on
---

# COUCH HEROES - CODING RULES & CONTEXT

## 1. DATA STRUCTURES
Always use these interfaces when generating code for Quests and Rewards.

```typescript
// packages/shared/types.ts

export type QuestType = 'MOVEMENT' | 'CHECKIN' | 'DAILY';

export interface Quest {
  id: string;
  type: QuestType;
  title: string;
  description: string;
  // For Movement Quests
  targetDistanceMeters?: number;
  currentDistanceMeters?: number;
  // For Check-in Quests
  targetCoordinates?: { lat: number; lng: number };
  radiusMeters?: number; // Default 50m
  // Rewards
  rewards: {
    type: 'EXP' | 'ITEM' | 'CURRENCY';
    value: string | number;
    itemId?: string;
  }[];
}

export interface UserLocation {
  lat: number;
  lng: number;
  timestamp: number;
  speed: number; // m/s
}