// Per-actor comment colors. Each commenter gets a deterministic color
// derived from a hash of their actor id, so highlights and thread entries
// visually separate multiple voices in a document.

export interface ActorColor {
  bg: string;          // idle highlight background
  bgActive: string;    // active (focused) highlight background
  border: string;      // idle underline / stripe
  borderActive: string; // active underline / stripe
  text: string;        // actor name text color in thread header
}

// 8-color palette. Amber stays first so single-author docs keep the
// existing look. Ordered so neighboring hashes don't collide visually.
const ACTOR_PALETTE: ActorColor[] = [
  { bg: 'rgba(252, 211, 77, 0.30)',  bgActive: 'rgba(252, 211, 77, 0.50)', border: '#FCD34D', borderActive: '#FBBF24', text: '#B45309' }, // amber
  { bg: 'rgba(56, 189, 248, 0.28)',  bgActive: 'rgba(56, 189, 248, 0.48)', border: '#38BDF8', borderActive: '#0EA5E9', text: '#0369A1' }, // sky
  { bg: 'rgba(244, 114, 182, 0.28)', bgActive: 'rgba(244, 114, 182, 0.48)', border: '#F472B6', borderActive: '#EC4899', text: '#BE185D' }, // rose
  { bg: 'rgba(52, 211, 153, 0.28)',  bgActive: 'rgba(52, 211, 153, 0.48)', border: '#34D399', borderActive: '#10B981', text: '#047857' }, // emerald
  { bg: 'rgba(167, 139, 250, 0.28)', bgActive: 'rgba(167, 139, 250, 0.48)', border: '#A78BFA', borderActive: '#8B5CF6', text: '#6D28D9' }, // violet
  { bg: 'rgba(251, 146, 60, 0.28)',  bgActive: 'rgba(251, 146, 60, 0.48)', border: '#FB923C', borderActive: '#F97316', text: '#C2410C' }, // orange
  { bg: 'rgba(45, 212, 191, 0.28)',  bgActive: 'rgba(45, 212, 191, 0.48)', border: '#2DD4BF', borderActive: '#14B8A6', text: '#0F766E' }, // teal
  { bg: 'rgba(232, 121, 249, 0.28)', bgActive: 'rgba(232, 121, 249, 0.48)', border: '#E879F9', borderActive: '#D946EF', text: '#A21CAF' }, // fuchsia
];

function hashActor(actor: string): number {
  let h = 0;
  for (let i = 0; i < actor.length; i++) {
    h = ((h * 31) + actor.charCodeAt(i)) >>> 0;
  }
  return h;
}

export function colorForActor(actor: string | undefined | null): ActorColor {
  if (!actor) return ACTOR_PALETTE[0];
  return ACTOR_PALETTE[hashActor(actor) % ACTOR_PALETTE.length];
}

export function commentStyleForActor(
  actor: string | undefined | null,
  active: boolean
): string {
  const c = colorForActor(actor);
  return `background-color: ${active ? c.bgActive : c.bg}; border-bottom: 2px solid ${active ? c.borderActive : c.border};`;
}
