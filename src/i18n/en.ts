// All English texts. Same split into parts as de.ts; each part is type-checked against its German counterpart.
import { app } from './en/app';
import { common } from './en/common';
import { data } from './en/data';
import { logic } from './en/logic';
import { race } from './en/race';
import { screens1 } from './en/screens1';
import { screens2 } from './en/screens2';
import { tycoon } from './en/tycoon';

export const en: Record<string, string> = { ...common, ...app, ...screens1, ...screens2, ...race, ...logic, ...tycoon, ...data };
