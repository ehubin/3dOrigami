# Medial-axis research papers — quick index

Each PDF in this folder has a sibling `.txt` with the extracted text (one
`===== PAGE k / N =====` banner per page) so you can `Grep` across the
literature without reopening the PDFs. Re-run `python _extract.py` to
regenerate (`MedialSkeletalDiagram.pdf` is skipped by default — pass its
filename as an argument to force).

| File | Authors / venue | What it covers | Relevant for our project |
| --- | --- | --- | --- |
| `TheMedialAxisTransform.pdf` | Peters/Ledoux/Arroyo Ohori, GEO1015 lecture notes (2018) | Definitions (medial atom, medial ball, spoke, separation angle, sheets/seams/junctions in 3D), MAT-from-Voronoi vs **shrinking-ball** approximation, pruning, DTM applications | Good vocabulary primer. No constructive offset-polygon algorithm. |
| `AccurateComputationOfMA.pdf` | Culver / Keyser / Manocha, SM 1999 | Exact-arithmetic **seam-tracing** algorithm for the MA of a 3-D polyhedron. Sheets = trimmed quadrics, seams = algebraic space curves, junctions = algebraic points. §3 representations. §4 search / curve topology. §6 **degeneracies** (≥4-governor seams, ≥5-governor junctions). | Best match for the 1-skeleton model (junctions / seams / governors / "first junction along a seam"). Traces the MA itself, not an inset at depth d. |
| `EfficientComputationOfMA.pdf` | Foskey / Lin / Manocha, SM 2003 | The **θ-Simplified Medial Axis (θ-SMA)**: subset of MA points whose separation angle exceeds θ. Computed via distance-field sampling on a voxel grid using GPU rasterisation (slice by slice). | Simplification criterion is angular, not depth-based. No 1-skeleton traversal. |
| `3DMedialAxis_hal.pdf` | Durix / Leonard / Morin / Chambon, HAL preprint 2023 | Voronoi-based clean 3-D MA with manifold sheets and consistent topology. **Sheet-by-sheet propagation** (label medial faces sharing regular edges; cross singular paths). ε-Hausdorff pruning. | "Propagation" here means flood-filling medial faces inside one sheet, not walking the 1-skeleton at fixed depth. |
| `MedialSkeletalDiagram.pdf` | (large, not extracted) | — | Skipped by default to keep the index small. |

## Useful greppable terms

- Culver vocabulary used in our codebase: `governor`, `seam`, `junction`,
  `sheet`, "first junction along the seam".
- Durix vocabulary: `medial face`, `singular path`, `regular edge`, sheet
  `propagation`.
- Generic: `equidistant`, `shrinking-ball`, `separation angle θ`,
  `Voronoi`, `Delaunay`.

## What is *not* in any of these papers

A traversal / sweep that, given the medial-axis 1-skeleton (junctions +
seams) of a polyhedron and a face `f`, walks the seams whose governor
set contains `f`, branches at junctions, and emits an inward-translated
polygon at a fixed depth `d` (level set of the distance-to-`f`
function restricted to the MA). None of the four papers names this
construction (no "ε-offset cell", "level set at depth d", "trim",
"inset / offset polygon" used in this sense).

The closest building block is Culver §3–4 (seam-tracing with governors
and "first junction along the seam"); using it for a depth-`d` inset
filtered by `gov ∋ f` is an application that has to be built on top.
