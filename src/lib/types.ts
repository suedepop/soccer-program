import type { AdSize, AdStatus, TeamId } from './config';

export interface PhotoRef {
  slot: number;
  fileId: number;
  url: string;
  width: number;
  height: number;
  origName: string;
  focalX: number;
  focalY: number;
}

/** Everything the canvas needs to draw an ad. Safe to send to the client. */
export interface AdView {
  id: number;
  userId: number;
  size: AdSize;
  layoutId: string;
  backgroundId: string;
  team: TeamId;
  playerName: string;
  message: string;
  attribution: string;
  /** Font ids from src/lib/fonts.ts. Empty means "use the background's pairing". */
  headingFont: string;
  bodyFont: string;
  /** Effect id from src/lib/effects.ts. Empty means none. */
  nameEffect: string;
  status: AdStatus;
  priceCents: number;
  adminNotes: string;
  createdAt: string;
  updatedAt: string;
  submittedAt: string | null;
  paidAt: string | null;
  photos: PhotoRef[];
}

export interface AdWithOwner extends AdView {
  ownerEmail: string;
  ownerName: string;
  ownerPhone: string;
}
