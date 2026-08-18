export const GRAVITY = 9.80665;

// Ballistic coefficient is conventionally expressed in lb/in^2 (mass per
// frontal area) even in an otherwise metric app — it's how every published
// BC value (box labels, manufacturer data, chronograph tools) is quoted.
// The drag equation needs BC in consistent SI units (kg/m^2), so every use
// of BC in the drag formula must go through this conversion.
export const LBIN2_TO_KGM2 = 703.0695796391593;

export const TRANSONIC_LO = 0.85;
export const TRANSONIC_HI = 1.3;
export const H_COARSE = 0.02;
export const H_FINE = 0.003;
export const MAX_STEPS = 20000;
