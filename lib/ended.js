import { EXHIBITION_END } from './config.js';

// True once the exhibition's final day has fully passed in New York (UTC-4, EDT
// in August). Comparing to end-of-day -04:00 keeps the last day open everywhere.
export function exhibitionEnded(now = new Date()) {
    return now.getTime() > new Date(EXHIBITION_END + 'T23:59:59-04:00').getTime();
}
