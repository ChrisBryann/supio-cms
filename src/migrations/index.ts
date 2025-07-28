import * as migration_20250728_170203 from './20250728_170203';

export const migrations = [
  {
    up: migration_20250728_170203.up,
    down: migration_20250728_170203.down,
    name: '20250728_170203'
  },
];
