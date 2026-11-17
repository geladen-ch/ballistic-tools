// Scoring function for the "El Intendente" novelty target — a visual skin
// over ch-campagne-e: the same stepped 45x165cm silhouette, scored by the
// very same function (re-exported, not copied, so the two can never
// drift). Its JSON keeps ch-campagne-e's geometry (widthM/heightM/
// aspectRatio) for the same reason; only resultSvg differs, describing the
// figure artwork (2349.12 px/m, point of aim at the figure's geometric
// centre, which is where the silhouette's own origin sits). See
// src/targets/el-intendente.json for the target's own data.
export { hitProbability } from './ch-campagne-e.js';
