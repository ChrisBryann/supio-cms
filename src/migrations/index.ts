import * as migration_20250728_170203 from './20250728_170203';
import * as migration_20250801_033003 from './20250801_033003';
import * as migration_20250814_182659 from './20250814_182659';

export const migrations = [
  {
    up: migration_20250728_170203.up,
    down: migration_20250728_170203.down,
    name: '20250728_170203',
  },
  {
    up: migration_20250801_033003.up,
    down: migration_20250801_033003.down,
    name: '20250801_033003',
  },
  {
    up: migration_20250814_182659.up,
    down: migration_20250814_182659.down,
    name: '20250814_182659'
  },
];
