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
  miniBoss?: boolean; // guards a rare drop; gets a health bar like the boss
  // Presentation (render only)
  model: string; // file in src/assets/creatures/<model>.glb
  scale: number; // model units -> meters
  tint?: number; // multiplies the model's colours (< 1 darker): tells a variant apart from its kin
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
  // Quaternius Ultimate Animated Animal Pack (CC0): every animal shares one rig and clip set.
  // Skittish, but bites back once hurt.
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
    scale: 0.2,
    animations: {
      idle: 'Idle',
      walk: 'Walk',
      run: 'Gallop',
      attack: 'Attack',
      hit: 'Idle_HitReact_Left',
      death: 'Death',
    },
  },
  // Hunts in pairs: charges on sight, a little slower than the sprinting player so running away works.
  wolf: {
    radius: 0.5,
    walkSpeed: 1.8,
    runSpeed: 7,
    turnRate: 4.5,
    fleeDistance: 0,
    aggroDistance: 11,
    idleTime: 2.5,
    hp: 120,
    staggerTime: 0.3,
    fightsBack: true,
    attackRange: 1.8,
    attackReachGrace: 0.5,
    attackWindup: 0.5,
    attackDamage: 15,
    attackCooldown: 1.2,
    hitbox: { length: 1.3, radius: 0.35, height: 0.6 },
    boss: false,
    model: 'crt_wolf',
    scale: 0.32,
    animations: {
      idle: 'Idle',
      walk: 'Walk',
      run: 'Gallop',
      attack: 'Attack',
      hit: 'Idle_HitReact_Left',
      death: 'Death',
    },
  },
  // Act 1 mini-boss: the pack leader, bigger and tougher, guarding its den off the main trail. Drops its fang.
  wolf_alpha: {
    radius: 0.7,
    walkSpeed: 1.8,
    runSpeed: 7.4,
    turnRate: 4,
    fleeDistance: 0,
    aggroDistance: 14,
    idleTime: 3,
    hp: 320,
    staggerTime: 0.2,
    fightsBack: true,
    attackRange: 2.4,
    attackReachGrace: 0.6,
    attackWindup: 0.55,
    attackDamage: 24,
    attackCooldown: 1.4,
    hitbox: { length: 1.9, radius: 0.5, height: 0.85 },
    boss: false,
    miniBoss: true,
    model: 'crt_wolf',
    scale: 0.46,
    tint: 0.3, // near-black coat
    animations: {
      idle: 'Idle',
      walk: 'Walk',
      run: 'Gallop',
      attack: 'Attack',
      hit: 'Idle_HitReact_Left',
      death: 'Death',
    },
  },
  // Prey: bolts early and outruns the player; a thrown spear is the way to bring one down.
  deer: {
    radius: 0.5,
    walkSpeed: 1.4,
    runSpeed: 10,
    turnRate: 4,
    fleeDistance: 16,
    aggroDistance: 0,
    idleTime: 5,
    hp: 80,
    staggerTime: 0.3,
    fightsBack: false,
    attackRange: 1.8,
    attackReachGrace: 0.4,
    attackWindup: 0.5,
    attackDamage: 0,
    attackCooldown: 1,
    hitbox: { length: 1.6, radius: 0.45, height: 1 },
    boss: false,
    model: 'crt_deer',
    scale: 0.38,
    animations: {
      idle: 'Idle',
      walk: 'Walk',
      run: 'Gallop',
      attack: 'Attack_Headbutt',
      hit: 'Idle_HitReact_Left',
      death: 'Death',
    },
  },
  // Leads the herd; flees like the does, but a wounded stag turns and charges with its antlers.
  stag: {
    radius: 0.6,
    walkSpeed: 1.4,
    runSpeed: 9,
    turnRate: 3,
    fleeDistance: 12,
    aggroDistance: 0,
    idleTime: 5,
    hp: 160,
    staggerTime: 0.25,
    fightsBack: true,
    attackRange: 2.2,
    attackReachGrace: 0.6,
    attackWindup: 0.6,
    attackDamage: 25,
    attackCooldown: 1.6,
    hitbox: { length: 1.8, radius: 0.5, height: 1.1 },
    boss: false,
    model: 'crt_stag',
    scale: 0.4,
    animations: {
      idle: 'Idle',
      walk: 'Walk',
      run: 'Gallop',
      attack: 'Attack_Headbutt',
      hit: 'Idle_HitReact_Left',
      death: 'Death',
    },
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
