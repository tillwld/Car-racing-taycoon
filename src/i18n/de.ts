// Alle deutschen Texte. Die Texte liegen in Teildateien (de/*.ts), damit sie sich übersichtlich pflegen lassen.
import { app } from './de/app';
import { common } from './de/common';
import { data } from './de/data';
import { logic } from './de/logic';
import { race } from './de/race';
import { screens1 } from './de/screens1';
import { screens2 } from './de/screens2';
import { tycoon } from './de/tycoon';

export const de: Record<string, string> = { ...common, ...app, ...screens1, ...screens2, ...race, ...logic, ...tycoon, ...data };
