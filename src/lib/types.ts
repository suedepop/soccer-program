import type { AdSize, AdStatus, TeamId } from './config';

export interface PhotoRef {
  slot: number;
  fileId: number;
  url: string;
  width: number;
  height: number;
  origName: string;
  /** Pan within the slot, 0..1 on each axis. 0.5 is centred. */
  focalX: number;
  focalY: number;
  /** 1 fills the slot exactly; larger crops in. */
  zoom: number;
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
  /** Colour id for that effect. Empty means the effect picks its own. */
  nameEffectColor: string;
  /** Manual nudge on the message and "from" size. 1 leaves the fitter alone. */
  textScale: number;
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
