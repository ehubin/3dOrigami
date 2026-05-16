# Polyhedron Capture — Design Document

A new variant of the existing editor's "add triangle face on selected edge"
command, where the third vertex of the new triangle is determined by a
WebXR camera capture instead of numeric input or a screen click.

**Integration mode:** native command in the existing Babylon.js editor.
No standalone app, no file format, no import step. The capture enters and
exits an `immersive-ar` session mid-edit and mutates the scene directly.

**Target platform:** Android Chrome only (WebXR `immersive-ar`). iOS Safari
does not support `immersive-ar`; the command should be hidden or disabled
on unsupported browsers.

---

## 1. Architecture overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    Existing Babylon.js editor                   │
│                                                                 │
│   edge selected ──▶ "Add face from capture" command             │
│                                │                                │
│                                ▼                                │
│                    ┌────────────────────────┐                   │
│                    │  AR capture session    │                   │
│                    │  (same canvas, swap)   │                   │
│                    └────────────────────────┘                   │
│                                │                                │
│                                ▼                                │
│                    camera pose + 1 image                        │
│                    + 2 pinned vertices                          │
│                    + 1 detected new vertex                      │
│                                │                                │
│                                ▼                                │
│                    ┌────────────────────────┐                   │
│                    │  Pose refinement (P3P) │                   │
│                    │  + back-projection     │                   │
│                    └────────────────────────┘                   │
│                                │                                │
│                                ▼                                │
│                    new Vector3 in editor frame                  │
│                                │                                │
│                                ▼                                │
│            same code path as the existing command:              │
│            addTriangleFace(selectedEdge, newVertex)             │
└─────────────────────────────────────────────────────────────────┘
```

Each capture is a **local operation**: one new vertex, attached to a known
edge. There is no global reconstruction step, no accumulator across
captures, no closure-error solver. Errors are bounded per-face because each
new face is anchored to two pre-existing vertices in editor world space.

---

## 2. The geometric problem

Given:
- Two known points `V0`, `V1` in editor world space (the selected edge endpoints)
- A camera pose `(C_pos, C_rot)` from WebXR at capture time, expressed in
  the AR session's reference frame
- Camera intrinsics `K` (focal length, principal point) for that frame
- Three pixel positions detected in the captured image: `p0`, `p1`, `p2`
  — corresponding to `V0`, `V1`, and the new third vertex `V2` to be solved

Find: `V2` in editor world space.

There are two coordinate frames in play: the **editor frame** (where `V0`,
`V1` live) and the **AR session frame** (where `C_pos`, `C_rot` live). The
piece must be physically positioned so that the editor's existing geometry
maps onto the real-world piece — which means the user has to tell the system
how the two frames relate. See §4 for the alignment step.

### 2.1 The robust solve

Naïve solve: assume the AR pose is correct, build the face plane through
`V0` and `V1` perpendicular to the camera-forward axis, ray-cast `p2`
through the camera onto that plane, done.

Problem: AR tracking drift of even a few millimeters at the camera puts
`V2` off by centimeters at typical capture distances. The pixel positions
of `V0` and `V1` give us a much stronger signal than the AR pose.

Better: **solve a P3P / PnP problem** using the three pixel detections and
the two known vertices, to get a refined camera pose that's consistent with
the editor's geometry. Then place `V2`.

```
1. Initial pose = WebXR camera pose at capture.

2. Refine pose: minimize reprojection error of V0 and V1
   onto pixels p0 and p1, with the initial pose as starting point.
   This is a 2-point Procrustes-like problem with one degree of
   freedom remaining (rotation around the V0–V1 axis).

3. Resolve the remaining DoF using either:
   a. The AR camera-forward direction as a prior (it's roughly right,
      just not millimeter-accurate), OR
   b. A user-confirmed face normal direction ("which side of the
      edge is the new face on?"), OR
   c. The constraint that p2's reprojection ray must lie on the
      correct side of the V0–V1 line in image space.

4. With the refined pose, ray-cast pixel p2 through the camera.
   The face plane is unconstrained until we pick its normal —
   so we still need step 3 to define the plane. Once the plane is
   chosen, intersect the ray with it. That's V2.
```

For a v1 implementation, **skip P3P entirely** and trust the AR pose. The
result will be visibly noisy but functional, and you can ship it. P3P
refinement is a follow-up that improves accuracy without changing the data
flow.

---

## 3. Suggested stack

You're already on Babylon.js, so most of this is "use what you have."

| Concern                        | Approach                                    |
| ------------------------------ | ------------------------------------------- |
| WebXR session, AR overlay      | `WebXRDefaultExperience` from `@babylonjs/core` |
| Drift-resistant references     | `WebXRAnchorSystem` (Babylon) — see §4.5     |
| Camera frame access            | Custom WebGL readback from XR camera texture |
| Triangle vertex detection      | v1: three user taps on the captured photo   |
|                                | v2: OpenCV.js corner detection + user confirm |
| Pose refinement                | v1: skip; v2: small PnP solver in JS        |
| State                          | Same store the editor already uses          |

No new dependencies for v1 beyond what Babylon already brings. OpenCV.js
arrives in v2 if you decide automatic detection is worth the bundle size
(~8 MB).

---

## 4. The frame-alignment step

This is the one piece of UX that doesn't exist in the original command.
Before the very first capture in a session, the system needs to know how
the **editor world frame** maps to the **AR session frame** — i.e. where
in the real world is the piece sitting, relative to the editor's origin.

### Recommended approach: edge-anchored alignment

The selected edge `(V0, V1)` is the alignment reference. The user is asked
to:

1. Point the phone at the real piece.
2. Tap the position of `V0` on the live AR view.
3. Tap the position of `V1` on the live AR view.

Each tap projects through the AR camera onto the ARCore-detected ground
plane (or a hit-test against the piece itself). This gives two real-world
points, which combined with the known editor-frame positions of `V0` and
`V1` defines a similarity transform: translation, rotation around vertical,
and scale.

There is one ambiguity (the edge could be flipped), resolved either by
asking the user which endpoint they tapped first, or by using the existing
editor's notion of edge direction.

After this step, every subsequent capture in the same AR session reuses
the same transform — but **not** as a stored matrix. Each tap creates a
WebXR anchor at that real-world point, and the editor-to-AR transform is
recomputed every capture from the current anchor poses. See §4.5 on why
this matters.

### Alternative: skip alignment, work in AR frame only

If you're willing to constrain the workflow so that **the entire polyhedron
is captured in one AR session, starting from a single seed triangle**, you
can skip alignment entirely. The first triangle is captured with its
vertices placed directly in AR session frame, and that becomes the editor
frame for the duration. Simpler, but you can't mix AR-captured faces with
faces created by other commands in the same session.

For v1, **the alternative is much simpler**. Recommend starting there and
adding alignment only if mixing capture with other commands becomes
important.

---

## 4.5 Anchor strategy

ARCore's local reference space drifts. After a minute of phone movement the
session origin can wander several millimeters relative to the real world.
A static `editorToAR` transform computed once at alignment time will be
wrong by the time you've captured the fifth face. Anchors are how you
fight this.

A WebXR `XRAnchor` is a point that ARCore tracks against the real world,
not against the session frame. Querying its current pose every frame gives
you a stable real-world reference, even as the session-local frame drifts.

### What gets anchored

1. **Alignment anchors.** The two `V0`/`V1` taps from §4 each create an
   `XRAnchor` at the real-world tap position. The editor-to-AR similarity
   transform is recomputed from the **current** anchor poses on every
   capture, not stored once.
2. **Per-vertex anchors.** Each time a triangle is committed to the editor,
   drop an `XRAnchor` at each of its three vertices' AR-frame positions.
   Subsequent captures use these anchors (refreshed each frame) instead of
   stored AR coordinates when reprojecting pinned edges.
3. **Optionally, per-capture camera anchor.** Less important; useful only
   if you want to revisit the captured frame later from the AR session.

### The transform becomes "live"

Pseudocode:

```ts
function currentEditorToAR(): Similarity3D {
  const v0_now = getAnchorPose(alignmentAnchors[0]).position;
  const v1_now = getAnchorPose(alignmentAnchors[1]).position;
  return computeSimilarity(
    [edge.v0, edge.v1],         // editor-frame source
    [v0_now,  v1_now]            // AR-frame target, refreshed
  );
}
```

If ARCore drifts but the anchors are good (which they almost always are
when their real-world reference is in view), the transform self-corrects.

### Babylon API

```ts
const fm = xr.baseExperience.featuresManager;
const anchorSystem = fm.enableFeature(
  WebXRFeatureName.ANCHOR_SYSTEM, "latest"
) as WebXRAnchorSystem;

// Drop an anchor at a position+rotation in the current frame
const anchor = await anchorSystem.addAnchorAtPositionAndRotationAsync(
  position, rotation
);

// anchor.transformationMatrix updates every frame as ARCore refines
```

Request `"anchors"` in the session's `optionalFeatures` array.

### Lifetime

WebXR anchors are scoped to the session. They do not persist across exits.
Chrome on Android has experimental persistent-anchor APIs, but for v1
treat each AR session as fresh: alignment anchors are created on entry,
discarded on exit. Re-entering means redoing alignment — fine, since the
piece may have moved on the table anyway.

### When this changes the milestones

M2 and M3 should drop alignment anchors at capture time, not just compute
a one-shot transform. It's a small code change with a large stability win.
M5 (P3P refinement) becomes optional rather than essential — anchors
handle most of the drift problem on their own.

---

## 4.6 Do you need a printed marker?

**Short answer: no, not for v1.**

A printed fiducial (ArUco, QR-style marker) does the same job as the
two-tap alignment plus anchors, just automatically and slightly more
accurately. For tabletop captures of a stationary ceramic piece, the
two-tap alignment is fast enough that the marker isn't worth the friction
(printing, laminating, fixing in place relative to the piece).

A marker becomes useful in three cases:

1. **Cross-session persistence.** If you want to capture some faces
   today, exit, edit on desktop, then re-enter AR tomorrow and have the
   editor *automatically* re-align with the real piece, a marker fixed
   in position relative to the piece is the easiest way. The alternative
   (re-tap alignment on each entry) is fine for hobby use.
2. **Sub-millimeter accuracy.** Marker detection is pixel-precise; human
   taps are ±5 mm at best. Probably overkill for ceramics.
3. **Recovery from tracking loss.** Without a marker, losing tracking
   means redoing alignment.

If you do want a marker later, ArUco detection in OpenCV.js is ~50 lines
and integrates cleanly with the same anchor system: detect the marker,
create an anchor at its detected pose, use that anchor instead of the
two tap-anchors as the alignment reference.

### The piece itself as a "marker"

Once you've captured a few faces, you have a partial mesh in the editor.
A natural alignment refinement is to render that mesh as a translucent
overlay on the live AR view; the user moves the phone until the overlay
matches the real piece, then taps "aligned." This refines the alignment
transform from visual feedback rather than from raw vertex taps, and
needs no printed marker. Worth considering for v2.

---

## 5. The capture command — UX flow

### 5.1 Entry

1. User selects an edge in the editor.
2. User invokes "Add face from capture" command (palette / context menu).
3. If the device doesn't support `immersive-ar`, command is disabled with
   a tooltip explaining Android-only.
4. Otherwise, the editor swaps its canvas into an AR session.

### 5.2 First capture in the session (alignment, if needed)

Either the simple path (first triangle defines the frame, no alignment UI)
or the alignment path (tap the two edge endpoints in AR, which creates two
anchors), per §4 and §4.5.

### 5.3 Each capture

1. UI overlay shows the **selected edge highlighted in 3D**, projected onto
   the AR view at its world position. The user can see exactly where the
   edge is on the real piece.
2. UI suggests roughly perpendicular alignment to the new face by
   showing a tilt indicator. The "ideal" tilt is unknown without user
   guidance — show a permissive indicator (anything within ~30° of
   perpendicular to the edge plane is fine).
3. User taps **Capture**.
4. The captured frame is shown frozen, with the two reprojected edge
   endpoints overlaid as crosses.
5. User taps the position of the new third vertex on the photo.
6. (Optional) User confirms or adjusts the two reprojected endpoints.
7. New `V2` is computed and the new triangle is added to the scene.

### 5.4 Exit

User taps **Done** to return to the regular editor view. Or **Add another**
to keep the AR session open and capture another face — at which point the
editor's selection logic decides what edge is now selected (typically one
of the just-added triangle's free edges).

---

## 6. Key code sketches

### 6.1 Entering AR from the editor

```ts
import { WebXRDefaultExperience, WebXRState } from "@babylonjs/core";

async function startCaptureCommand(
  editor: Editor,
  selectedEdge: Edge
): Promise<void> {
  if (!await isWebXRSupported()) {
    editor.notify("AR capture requires Android Chrome");
    return;
  }

  // Save editor view state so we can restore on exit
  const savedView = editor.snapshotView();

  // Hide the editor's regular meshes while in AR (or keep selected edge
  // visible — your call). Switch the scene's camera to the XR camera.
  const xr = await WebXRDefaultExperience.CreateAsync(editor.scene, {
    uiOptions: { sessionMode: "immersive-ar", referenceSpaceType: "local" },
    optionalFeatures: ["hit-test", "anchors", "dom-overlay"]
  });

  const fm = xr.baseExperience.featuresManager;
  fm.enableFeature(WebXRFeatureName.HIT_TEST,      "latest");
  fm.enableFeature(WebXRFeatureName.ANCHOR_SYSTEM, "latest");

  xr.baseExperience.onStateChangedObservable.add(state => {
    if (state === WebXRState.NOT_IN_XR) {
      editor.restoreView(savedView);
      xr.dispose();
    }
  });

  await runCaptureLoop(editor, xr, selectedEdge);
}
```

### 6.2 Per-capture pipeline

```ts
async function captureFaceAtEdge(
  xr: WebXRDefaultExperience,
  edge: Edge,                          // V0, V1 in editor frame
  alignment: FrameAlignment            // editor → AR transform
): Promise<Vector3> {
  // 1. Get camera pose at capture
  const camera = xr.baseExperience.camera;
  const pose = {
    position:    camera.position.clone(),       // AR frame
    orientation: camera.absoluteRotation.clone()
  };

  // 2. Grab camera frame
  const imageBlob = await grabXRCameraFrame(xr.baseExperience.sessionManager);
  const intrinsics = getCameraIntrinsics(xr.baseExperience.sessionManager);

  // 3. Show the photo with reprojected edge endpoints, await user input
  const v0_AR = alignment.editorToAR(edge.v0);
  const v1_AR = alignment.editorToAR(edge.v1);
  const p0 = project(v0_AR, pose, intrinsics);
  const p1 = project(v1_AR, pose, intrinsics);

  const userInput = await showCaptureReviewUI({
    image: imageBlob,
    pinnedVertices: [p0, p1],
    prompt: "Tap the third vertex of the new triangle"
  });
  if (userInput.cancelled) throw new CaptureCancelled();
  const p2 = userInput.thirdVertex;

  // 4. Solve for V2 in AR frame
  const v2_AR = solveThirdVertex({
    pose, intrinsics,
    knownWorldPoints: [v0_AR, v1_AR],
    knownPixels:      [p0, p1],
    newVertexPixel:   p2,
    faceNormalHint:   forwardVector(pose.orientation).scale(-1)
  });

  // 5. Convert back to editor frame
  return alignment.arToEditor(v2_AR);
}
```

### 6.3 The third-vertex solve (v1, AR-pose-trusting)

```ts
function solveThirdVertex(args: SolveArgs): Vector3 {
  const { pose, intrinsics, knownWorldPoints, newVertexPixel, faceNormalHint } = args;
  const [v0, v1] = knownWorldPoints;

  // Define the new face's plane: passes through v0 and v1, normal is the
  // hint projected onto the plane perpendicular to the edge.
  const edgeDir = v1.subtract(v0).normalize();
  const normal = faceNormalHint
    .subtract(edgeDir.scale(Vector3.Dot(faceNormalHint, edgeDir)))
    .normalize();

  // Ray-cast the new pixel through the camera into the world.
  const ray = pixelToWorldRay(newVertexPixel, pose, intrinsics);

  // Intersect the ray with the face plane.
  return rayPlaneIntersect(ray, { point: v0, normal });
}
```

### 6.4 P3P refinement (v2 upgrade)

For v2, replace step 4 above with a small Gauss-Newton refinement of the
camera pose. With only two correspondences, you have one DoF left
(rotation around the edge axis); use the face-normal hint as a soft prior.
Iterate three or four steps minimizing reprojection error of `v0` and `v1`,
then proceed with the refined pose.

The math is small — six pose parameters, two reprojection residuals plus
one prior residual — and converges in a few iterations. No external
optimizer needed.

### 6.5 Frame grabbing

Babylon doesn't expose "give me the current XR frame as a Blob," so this
is the one piece of raw WebGL you'll need to write. Sketch:

```ts
async function grabXRCameraFrame(sm: WebXRSessionManager): Promise<Blob> {
  const frame = sm.currentFrame;
  const referenceSpace = sm.referenceSpace;
  const view = frame.getViewerPose(referenceSpace).views[0];
  const layer = sm.session.renderState.baseLayer;
  const viewport = layer.getViewport(view);

  // Render the XR view into an offscreen framebuffer, readPixels,
  // wrap in a canvas, toBlob. Details depend on your engine setup.
  // ...
}
```

This is the genuinely fiddly part of the codebase — budget an evening
for it.

---

## 7. Implementation milestones

| Milestone | Scope | Status check |
| --------- | ----- | ------------ |
| **M1** | Editor command "Add face from capture" enters and exits an `immersive-ar` session cleanly without changing the scene. | Round-trip works on Android Chrome. |
| **M2** | First-capture-defines-frame alignment: capture creates a triangle with all three vertices via three user taps, no edge constraint yet. | A first triangle appears in the scene. |
| **M3** | Edge-anchored capture: command takes the selected edge as input, user taps only the new third vertex on the photo, the triangle is correctly attached. Alignment uses WebXR anchors so the editor-to-AR transform refreshes every capture. AR pose used directly, no PnP refinement. | Multiple triangles can be added in sequence without drift. |
| **M4** | Frame alignment UI for mixing AR captures with other commands across separate AR sessions. | Capture, exit, edit, re-enter, re-align, capture again — geometry stays consistent. |
| **M5** | P3P pose refinement to suppress residual placement error in `V2`. | Vertex placement noise visibly reduced; mostly a polish step now that anchors exist. |
| **M6** | OpenCV.js auto-detection of the third vertex with user confirmation. | Tap count drops to one ("looks good"). |

M1–M3 is the minimum viable feature. M4 onward is polish and accuracy.

---

## 8. Known limitations and gotchas

- **Android only.** WebXR `immersive-ar` is unsupported on iOS Safari.
  Disable the command on non-supporting browsers; don't try to polyfill.
- **Specular ceramic surfaces** confuse ARCore's tracking and will also
  defeat OpenCV corner detection (M6). Matt finishes capture cleanly;
  for glossy pieces, use 3D-scan spray or cornstarch dusting.
- **Re-entering AR loses the previous AR session frame.** That's why
  the alignment in §4 is per-AR-session, not per-editor-session. Each
  AR re-entry needs alignment again (unless you committed to the
  simple "first triangle defines the frame" approach, in which case
  re-entry only works to extend the existing polyhedron, not to
  start a new one).
- **The XR camera frame access is not in Babylon's public API.** You
  write WebGL readback yourself. Plan for one focused evening on
  this; it's the only "raw graphics" code in the project.
- **Tracking drift over a long session.** ARCore drifts a few mm per
  minute even when stationary. Anchors (§4.5) keep alignment stable; a
  static stored transform does not. If anchors lose tracking — typically
  because the user pointed the phone away from all anchored points for
  a while — the next capture's reprojection of pinned vertices will be
  visibly off, and the user should re-aim the phone to bring an
  anchored region back into view before tapping capture.
- **Edge selection after capture.** Decide your default: after adding
  a triangle, does the editor auto-select one of its new free edges
  (which one?) or stay on the original edge? Auto-selecting one of the
  two new edges enables fast "fan" capture along a strip of the piece;
  staying on the original enables fast "two faces sharing one edge"
  symmetric capture.

---

## 9. Open questions to decide before coding

1. **Simple frame model or alignment UI?** Start with simple
   (first-triangle-defines-frame). Add alignment only when needed.
2. **Default post-capture edge selection** — see last bullet of §8.
   Recommend exposing this as a user setting once the basic flow works.
3. **AR view UX during capture** — render the editor's current geometry
   as a translucent overlay onto the live camera view so the user can
   see how the in-progress polyhedron lines up with the real piece?
   Helpful but not required for v1.
