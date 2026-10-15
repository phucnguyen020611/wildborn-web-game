export interface CreatureConfig {
  radius: number;
  walkSpeed: number;
  runSpeed: number;
  turnRate: number; // radians per second
  fleeDistance: number; // starts fleeing when the player is closer than this (0 = never flees)
  aggroDistance: number; // gets angry and charges when the player is closer than this (0 = only when hurt)
  idleTime: number; // seconds spent at each waypoint
  hp: number;
  staggerTime: number; // seconds frozen after each hit
  fightsBack: boolean; // once hurt, chases and attacks instead of fleeing
  attackRange: number; // starts the attack wind-up when the player is this close
  attackReachGrace: number; // extra distance the attack still lands at (stepping away must be possible but not trivial)
  attackWindup: number; // seconds of readable telegraph before the attack lands
  attackDamage: number;
  attackCooldown: number;
  hitbox: { length: number; radius: number; height: number }; // capsule along heading, centered at `height`
  boss: boolean; // killing it wins the hunt
  // Presentation (render only)
  model: string; // file in src/assets/creatures/<model>.glb
  scale: number; // model units -> meters
  animations: {
    idle: string;
    walk: string;
    run: string;
    attack?: string;
    hit?: string;
    death?: string;
  };
}

export const CREATURES = {
  // Placeholder quadruped (Khronos sample) to validate rig + animation; modelled in centimeters.
  fox: {
    radius: 0.4,
    walkSpeed: 1.6,
    runSpeed: 6,
    turnRate: 5,
    fleeDistance: 6,
    aggroDistance: 0,
    idleTime: 3,
    hp: 100,
    staggerTime: 0.25,
    fightsBack: true,
    attackRange: 1.4,
    attackReachGrace: 0.4,
    attackWindup: 0.6,
    attackDamage: 20,
    attackCooldown: 1,
    hitbox: { length: 1, radius: 0.3, height: 0.45 },
    boss: false,
    model: 'crt_fox',
    scale: 0.01,
    animations: { idle: 'Survey', walk: 'Walk', run: 'Run' },
  },
  // First boss, built by tools/blender/make_mammoth.py. Slow to turn: circle it, strike, step out of the tusk swing.
  mammoth: {
    radius: 1.5,
    walkSpeed: 1.4,
    runSpeed: 5.5, // player sprints at 8, so it can be outrun
    turnRate: 1.6,
    fleeDistance: 0,
    aggroDistance: 12,
    idleTime: 4,
    hp: 400,
    staggerTime: 0.1,
    fightsBack: true,
    attackRange: 4.2,
    attackReachGrace: 1,
    attackWindup: 0.7, // = ATTACK_WINDUP in make_mammoth.py (the rear-up in the clip)
    attackDamage: 35,
    attackCooldown: 2,
    hitbox: { length: 3.6, radius: 1.3, height: 2.2 },
    boss: true,
    model: 'crt_mammoth',
    scale: 1,
    animations: {
      idle: 'Idle',
      walk: 'Walk',
      run: 'Run',
      attack: 'Attack',
      hit: 'Hit',
      death: 'Death',
    },
  },
} satisfies Record<string, CreatureConfig>;

export type CreatureKind = keyof typeof CREATURES;
