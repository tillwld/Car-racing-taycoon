// Texts (English): boot, platform, ads, storage. Same keys as the German file.
import type { common as de } from '../de/common';

export const common: Record<keyof typeof de, string> = {
  'boot.loading': 'Loading …',
  'boot.progress': 'Loading progress',
  'store.achievement': 'Achievement: {name}',
  'store.noGame': 'No saved game',
  'store.loadedFromCloud': 'Loaded your saved game from persistent artifact storage',
  'ads.tag': 'Ad',
  'ads.watching': 'Ad playing …',
  'ads.failed': 'The ad couldn\'t be shown. No reward this time.',
  'ads.optional': 'Optional: the game continues normally without ads.',
  'ads.sponsorBonus.title': 'Sponsor bonus',
  'ads.sponsorBonus.button': 'Watch for sponsor bonus: {amount:money}',
  'ads.sponsorBonus.hint': 'Watch a short ad to get 10% of your budget extra. Once per race weekend.',
  'ads.sponsorBonus.used': 'Already claimed for this race weekend.',
  'ads.sponsorBonus.granted': 'Sponsor bonus received: {amount:moneyS}',
  'ads.ledger.sponsorBonus': 'Sponsor bonus (ad)',
  'ads.news.sponsorBonus': 'Sponsor bonus after an ad: {amount:moneyS}.',
  'ads.repair.button': 'Halve repair costs',
  'ads.repair.hint': 'After the DNF: watch a short ad and repairs cost only half until the next race.',
  'ads.repair.granted': 'Repair costs halved until the next race.',
  'ads.news.repairHalf': 'Repair costs halved until the next race after an ad.',
  'ads.repair.active': 'Repair costs halved (ad)',
};
