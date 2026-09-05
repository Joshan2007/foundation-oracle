export type ActivityAction = 'BOUGHT' | 'SOLD' | 'FORGED';

export interface ActivityItem {
  id: string;
  action: ActivityAction;
  tokenId: number;
  cardName: string;
  image?: string;
  rarity?: string;
  type?: string;
  price?: string; // in ETH (for BOUGHT/SOLD)
  timestamp: number; // Unix timestamp in ms
  txHash?: string;
  userAddress?: string;
}

export const ACTIVITY_STORAGE_KEY = 'mythic_activity_history';

export function getStoredActivities(): ActivityItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(ACTIVITY_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to read activity history:', e);
    return [];
  }
}

export function saveActivities(activities: ActivityItem[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(ACTIVITY_STORAGE_KEY, JSON.stringify(activities));
  } catch (e) {
    console.error('Failed to save activities:', e);
  }
}

export function addActivity(item: Omit<ActivityItem, 'id' | 'timestamp'> & { id?: string; timestamp?: number }): ActivityItem {
  const fullItem: ActivityItem = {
    id: item.id || `${item.action}-${item.tokenId}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    timestamp: item.timestamp || Date.now(),
    ...item,
  };

  if (typeof window !== 'undefined') {
    try {
      const current = getStoredActivities();
      // Deduplicate by txHash if present, or by same action and tokenId within recent time
      const filtered = current.filter((c) => {
        if (fullItem.txHash && c.txHash && fullItem.txHash.toLowerCase() === c.txHash.toLowerCase() && c.action === fullItem.action) {
          return false;
        }
        if (c.id === fullItem.id) return false;
        return true;
      });

      const updated = [fullItem, ...filtered];
      saveActivities(updated);

      // Dispatch event for reactive updates in any listening component
      window.dispatchEvent(new CustomEvent('mythic_activity_updated', { detail: fullItem }));
    } catch (e) {
      console.error('Failed to append activity:', e);
    }
  }

  return fullItem;
}

// Backfill from previously saved minted or purchased cards if activity log is empty
export function backfillActivitiesIfEmpty(): ActivityItem[] {
  if (typeof window === 'undefined') return [];
  const current = getStoredActivities();
  if (current.length > 0) return current;

  const backfilled: ActivityItem[] = [];

  try {
    const rawMinted = localStorage.getItem('mythic_minted_cards');
    if (rawMinted) {
      const mintedCards = JSON.parse(rawMinted);
      if (Array.isArray(mintedCards)) {
        mintedCards.forEach((c, idx) => {
          backfilled.push({
            id: `backfill-forge-${c.tokenId}-${idx}`,
            action: 'FORGED',
            tokenId: c.tokenId,
            cardName: c.name || `Relic #${c.tokenId}`,
            image: c.image,
            rarity: c.rarity,
            type: c.type,
            timestamp: Date.now() - (mintedCards.length - idx) * 3600000,
            userAddress: c.seller,
          });
        });
      }
    }

    const rawPurchased = localStorage.getItem('mythic_purchased_cards');
    if (rawPurchased) {
      const purchasedCards = JSON.parse(rawPurchased);
      if (Array.isArray(purchasedCards)) {
        purchasedCards.forEach((c, idx) => {
          backfilled.push({
            id: `backfill-buy-${c.tokenId}-${idx}`,
            action: 'BOUGHT',
            tokenId: c.tokenId,
            cardName: c.name || `Card #${c.tokenId}`,
            image: c.image,
            rarity: c.rarity,
            type: c.type,
            price: c.price || '0.15',
            timestamp: Date.now() - (purchasedCards.length - idx) * 1800000,
            userAddress: c.seller,
          });
        });
      }
    }

    if (backfilled.length > 0) {
      backfilled.sort((a, b) => b.timestamp - a.timestamp);
      saveActivities(backfilled);
    }
  } catch (e) {
    console.warn('Backfill activity error:', e);
  }

  return backfilled;
}
