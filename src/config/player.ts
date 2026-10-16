export const PLAYER = {
  hp: 100,
  radius: 0.4,
  eyeHeight: 1.6,
  walkSpeed: 5,
  sprintSpeed: 8,
  airControl: 0.1, // fraction of target velocity blended in per step while airborne
  jumpSpeed: 7,
  stepHeight: 0.35, // ledges up to this high are walked onto automatically
  gravity: 20,
  maxSlope: 0.9, // terrain steeper than this rise/run (~42°) can't be walked or jumped up
  slideSpeed: 5, // m/s down a too-steep slope
  safeFallSpeed: 12, // landing faster than this hurts (~3.6 m drop); a normal jump lands at 7
  fallDamage: 7, // hp per m/s over the safe speed: a 6 m drop costs ~26, a 10 m drop ~59
};
