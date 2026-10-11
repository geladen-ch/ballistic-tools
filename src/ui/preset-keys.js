// The two synthetic preset keys, on their own so that modules with no DOM (the truing session's model, which the planning
// worker loads) can use them without pulling in the preset field itself.

// A synthetic, non-pickable option shown whenever the paired number field's
// value no longer matches any preset — indicates "you're not looking at a
// preset value anymore" rather than offering an action of its own.
export const CUSTOM_PRESET_KEY = '__custom__';

// A synthetic option offered only while the active cartridge specifies its
// own value for this field — picks up that value the same way a real
// preset does, but its value comes from the Arsenal rather than the preset
// list.
export const RIG_PRESET_KEY = '__rig__';
