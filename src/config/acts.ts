/** Story Mode acts (docs/STORY_MODE.md), in order. Names: i18n `act.<id>.title` / `act.<id>.region`. */
export const ACTS = [
  { id: 'act1', playable: true }, // Thung lũng Thông: mammoth
  { id: 'act2', playable: false }, // Rừng Xoắn: sabertooth (D3)
  { id: 'act3', playable: false }, // Đèo Tuyết: woolly rhino (D3)
] as const;
export type ActId = (typeof ACTS)[number]['id'];
