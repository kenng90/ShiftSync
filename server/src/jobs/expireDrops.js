import { expireDrops } from '../services/swaps.js';

export function startJobs() {
  const tick = async () => {
    try {
      await expireDrops();
    } catch (err) {
      console.error('expireDrops failed', err);
    }
  };
  tick();
  return setInterval(tick, 60 * 1000);
}
