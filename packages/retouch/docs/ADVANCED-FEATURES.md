# Advanced features — research & license audit

Constraint: everything runs **fully client-side in TypeScript** (canvas/WebGL or
ONNX Runtime Web / transformers.js). Licenses are judged against an
MIT-licensed library used commercially, and each row below says when it was
last checked. Weights are fetched at runtime (HF CDN, GitHub or self-hosted),
never bundled — but defaults must still be permissive. Since 0.1.0 every
default URL is pinned to a commit of the repo that serves it, so a later push
there can never change what users download; bumping a pin is a deliberate,
reviewed change. Nine of the ten pinned sources are third-party conversions or
mirrors, not the model author's own repo.
[`third-party-models.json`](../packages/ml/third-party-models.json) records each
one's author repo, pin, SHA-256, license evidence and training data, and
[`THIRD_PARTY_NOTICES.md`](../packages/ml/THIRD_PARTY_NOTICES.md) carries the
copyright lines and license texts.

## License verdicts (checked at source)

| Model / lib | License | Verdict | Checked |
|---|---|---|---|
| BiRefNet | MIT | ⚠️ not a default (MODNet is; any BiRefNet export works through `modelUrl`). General and lite train on DIS5K, whose terms bar commercial use. BiRefNet-portrait doesn't use it, but is 490 MB | 2026-11-07 |
| MODNet | Apache-2.0 | ✅ shipped default, portrait matting (image + per-frame video). The author states Apache-2.0 for the models | 2026-11-07 |
| LaMa | Apache-2.0 | ⚠️ shipped default, object erase (ONNX ports exist, ~200 MB). The author's repo is Apache-2.0 with no separate statement on the weights, the Carve export has a tag but no license file, and Places2's terms limit its images to non-commercial research and education | 2026-11-07 |
| MI-GAN (Picsart) | MIT | ✅ small object-erase alternative. The official repo added a license file on 2026-09-14 | 2026-11-07 |
| Real-ESRGAN | BSD-3-Clause | ⚠️ shipped default, upscale. The license is inferred from the author's repo, which publishes the weights as release assets without a separate statement. DIV2K, part of its training set, is for academic research only | 2026-11-07 |
| Depth Anything V2 **Small** | Apache-2.0 | ✅ shipped (quantized 27 MB, 0.9993-correlated with fp32; fp16 export trips an ORT layer-norm fusion bug — avoided). The author states Apache-2.0 for Small. Its training data includes Virtual KITTI 2 (CC BY-NC-SA 3.0). Base/Large/Giant stay ❌ CC-BY-NC | 2026-11-07 |
| Depth Anything V2 Base/Large/Giant | CC-BY-NC-4.0 | ❌ non-commercial | 2026-11-07 |
| SAM2 | Apache-2.0 | ✅ upstream fine, and a licensed export now exists: `CardAnvilModels/sam2.1-hiera-tiny-ONNX` has a license file, and all 32 of its files are byte-identical to onnx-community's untagged export (encoder external data 29 MB at q4f16, 134 MB at fp32). Not shipped; video propagation needs separate exports | 2026-11-07 |
| SlimSAM-77 (Xenova ONNX) | Apache-2.0 | ✅ click-to-select (shipped default — 38 MB across encoder+decoder). Trained on SA-1B, which Meta describes as research-only (full text not read) | 2026-11-07 |
| DDColor | Apache-2.0 | ⚠️ upstream fine, and DDColor-tiny exports tagged Apache-2.0 now exist at ~135 MB fp16 (`edgetools/ddcolor`, `lensmera/lensmera-color-ddcolor`), though without license files. Tiny trains on ImageNet, whose terms weren't read; colorize can be un-parked once that's decided | 2026-11-07 |
| SCUNet (real-PSNR) | Apache-2.0 or MIT | ⚠️ denoise (shipped default — 3.8 MB graph stub + 73 MB `.onnx.data` sidecar). The author's SCUNet repo is Apache-2.0, but its script fetches these weights from the author's MIT-licensed KAIR repo, and the pinned repo is tagged Apache-2.0 while its `LICENSE.txt` is MIT text. Both are permissive. The author hasn't said which applies, so both notices ship | 2026-11-07 |
| PP-OCRv4 det + PP-OCRv5 Latin rec (PaddleOCR) | Apache-2.0 | ✅ read text (shipped default — 4.7 MB detector from SWHL/RapidOCR + 7.9 MB recognizer and dictionary from monkt/paddleocr-onnx, both repos Apache-2.0) | 2026-11-07 |
| GFPGAN | Apache-2.0 with exceptions | ⚠️ not cleared. Its LICENSE excepts third-party components, including NVIDIA StyleGAN2 code (non-commercial) and DFDNet-derived code (CC BY-NC-SA 4.0), and it trains on FFHQ | 2026-11-07 |
| CodeFormer | S-Lab 1.0 | ❌ non-commercial | 2026-11-07 |
| BRIA RMBG-1.4 / 2.0 | CC non-commercial | ❌ needs paid BRIA agreement | 2026-11-07 |
| RobustVideoMatting | GPL-3.0 | ❌ viral — incompatible as MIT-lib dependency | 2026-11-07 |
| Zero-DCE | CC-BY-NC (academic) | ❌ — use classical CLAHE/gamma or NAFNet (MIT) | 2026-11-07 |
| RIFE | MIT | ✅ license-wise, and `edgetools/rife` has a 21.5 MB v4.9 export with a license file. Browser speed on real clips is unmeasured — parked until benchmarked | 2026-11-07 |
| Whisper (tiny/base) | MIT | ✅ runs via transformers.js (captions, stretch). The author's README says code and weights are MIT. OpenAI's Hugging Face repos are tagged Apache-2.0 instead; both are permissive, and the README governs | 2026-11-07 |
| onnxruntime-web / transformers.js / TF.js | MIT / Apache-2.0 / Apache-2.0 | ✅ runtimes (npm latest: onnxruntime-web 1.31.1, @huggingface/transformers 4.3.2, @tensorflow/tfjs 4.22.0) | 2026-11-07 |
| YuNet (OpenCV Zoo) | MIT | ⚠️ face detection (0.1–0.2 MB ONNX; decode is multi-branch). OpenCV Zoo's folder is MIT and the training repo BSD-3-Clause, but it trains on WIDER FACE, like UltraFace, so switching wouldn't remove that point | 2026-11-07 |
| UltraFace RFB-320 (author's repo) | MIT | ⚠️ shipped default, face detection (~1.2 MB, priors decoded in-graph). Pinned to the author's own file, byte-identical to the deprecated ONNX Model Zoo copy it replaced. Trained on WIDER FACE, whose site lists CC BY-NC-ND: the strictest dataset term we ship | 2026-11-07 |
| MediaPipe BlazeFace / Face Mesh | Apache-2.0 | ✅ face detection + landmarks. Google's model cards for BlazeFace (short range) and Face Mesh V2 say Apache-2.0, trained on images Google captured. Use Google's files or convert them: the Hugging Face ONNX exports are third-party, tagged Apache-2.0, with no license file | 2026-11-07 |
| YOLOX-nano | Apache-2.0 | ✅ shipped default, object detection and tracking | 2026-11-07 |
| NanoDet-Plus | Apache-2.0 | ✅ object detection. OpenCV Zoo's NanoDet-Plus-m-1.5x export is Apache-2.0 with a license file (3.8 MB, 1.0 MB int8). Trained on COCO, like YOLOX | 2026-11-07 |
| OWL-ViT / OWLv2 | Apache-2.0 | ✅ open-vocabulary detection (text-prompted). Google's repos are tagged Apache-2.0, but of the ONNX exports only `onnx-community/owlvit-base-patch16-ONNX` (154 MB int8) carries a tag; Xenova's patch32 and OWLv2 exports have none | 2026-11-07 |
| Florence-2 base | MIT | ✅ detect+caption+OCR in one (~230 MB) | 2026-11-07 |
| BLIP | BSD-3-Clause | ⚠️ captions/tagging. The LICENSE is plain BSD-3-Clause, but the model card's ethical-considerations section says the release is for research purposes only. Ask Salesforce, or use Florence-2 (MIT) | 2026-11-07 |
| Tesseract.js | Apache-2.0 | ✅ OCR (tesseract.js 7.0.0, the Tesseract engine and `tessdata_fast` are all Apache-2.0) | 2026-11-07 |
| Ultralytics YOLO v5/v8/v11 | AGPL-3.0 | ❌ viral — same reason as RVM | 2026-11-07 |

✅ means the license on the code and weights is permissive on the evidence read.
⚠️ means it's permissive, with a point still open. Neither clears training
data: a dataset's terms are separate from a model's license, and whether they
reach weights trained on it is an unsettled legal question for counsel. This
page isn't legal advice.

Note: RMBG-2.0 is architecturally BiRefNet + BRIA's proprietary data — using
MIT BiRefNet directly avoids BRIA's license, but see the BiRefNet row on DIS5K.

Patent note: seam carving (content-aware scale) has MERL/Adobe patents in the
wild; OSS implements it widely, but commercial adopters should be aware.

## Tier A — pure TypeScript / canvas / WebGL (no models, no downloads)

1. ✅ Perspective / keystone correction — V/H sliders shipped (separable strip warp); 4-corner "perspective crop" still open
2. ✅ Auto-crop on straighten — largest inscribed rect, no black corners (shipped)
3. ✅ Curves + live histogram (shipped; Levels still open)
4. ✅ HSL mixer + white-balance eyedropper (shipped; split-toning wheels still open)
5. ✅ Selective (masked) adjustments — linear/radial gradients shipped (brush masks still open)
6. ✅ Clarity (midtone-weighted large-radius unsharp) + dehaze (shipped)
7. ✅ Lens corrections — barrel/pincushion distortion + devignette shipped (defish ≈ strong distortion; CA fix still open)
8. ✅ Warp / liquify — brush-painted push warp over a 33×33 displacement grid, size/strength brush + Reset, image and video (shipped; pinch/bloat modes and mesh/cage transform still open)
9. ✅ Content-aware scale — seam carving in a Blob-URL worker, Transform pane "Content-aware width" 50–100% (shipped, images only; see patent note. Preview carves a ≤1000px working copy; export carves at ≤1600px)
10. ✅ Stylize — tilt-shift, duotone, posterize, pixelate, halftone (shipped; per-region pixelate still open)
11. ✅ Video classical — GIF-of-range with forward/reverse/boomerang loops (gifenc, MIT), deflicker (export-time temporal gain), poster pick (shipped; full mp4 reverse still open — needs frame buffering)

## Tier B — on-device ML plugin packages (`@64tensor/retouch-ml-*`, lazy-loaded, WebGPU→WASM fallback)

1. ✅ Background removal / cutout — shipped in `@64tensor/retouch-ml` M1: MODNet (Apache-2.0, ~25 MB) default, any BiRefNet ONNX export via `modelUrl`; ORT-web WebGPU→WASM, Cache API weights, clears the background in place as an undoable step
2. ✅ Object erase / heal brush — shipped in `@64tensor/retouch-ml` M3: LaMa (Apache-2.0, Carve ONNX, ~208 MB — picked because MI-GAN had no licensed mirror at the time; the license table has LaMa's own open points). Brush-painted mask → padded square around the strokes runs at the model's fixed 512², fill composites back at full res (feathered, masked pixels only). Result replaces the image in place via the new core `replaceImageSource`; requires neutral geometry (guarded in the pane)
3. ✅ Upscale 4× — shipped in `@64tensor/retouch-ml` M2: Real-ESRGAN x4plus ONNX (BSD-3, ~67 MB, dynamic shapes), overlap-padded tile inference (64px cores + 8px context, no seams), WebGPU with run-level WASM fallback (some devices fail Conv buffers only at inference time), alpha carried via canvas upsampling, 2048px input cap
4. ✅ Depth bokeh — shipped in `@64tensor/retouch-ml` M6: **Depth Anything V2 Small** (Apache-2.0, quantized 27 MB, dynamic multiple-of-14 dims, higher = closer verified). The Depth tab analyzes once, then click-to-focus + Aperture recompose instantly from pre-blurred levels; Apply renders full-res in place (original buffered). Fog/depth-grade variants still open
5. ✅ Click-to-select — shipped in `@64tensor/retouch-ml` M5 as **SlimSAM-77** (Apache-2.0, ~38 MB: 1024² encoder cached per image + per-click prompt decoder, int64 labels). The Select tab segments on click with add/subtract refinement, then **Cut out** (transparent PNG) or **Erase object** (dilated mask → LaMa inpaint, in place). SlimSAM chosen over SAM2 for size and export licensing; SAM2 revisit open
6. Colorize B&W — **DDColor** (Apache-2.0) — ⚠️ parked: Apache-tagged DDColor-tiny exports now exist (~135 MB fp16), so what's left is a decision on ImageNet's terms (see license table)
7. Face restoration — model undecided. Not CodeFormer (non-commercial), and **GFPGAN** is no longer cleared (see license table). RestoreFormer++ (Apache-2.0) is the candidate, pending a decision on FFHQ's terms
8. ✅ Denoise — shipped in `@64tensor/retouch-ml` M7: **SCUNet real-PSNR** (Apache-2.0 or MIT, 3.8 MB stub + 73 MB weights sidecar; the runtime gained `externalDataUrl` for split exports, sidecar downloaded first so progress tracks the big file). Blind real-noise removal tiled at 192px cores + 16px context, each tile replicate-padded to the Swin-required multiple of 64 (zero-pad bleeds a dark rim at image borders); ~12 dB PSNR gain verified, alpha carried through, replaces the image in place (original buffered, Reset restores). NAFNet (MIT) alternative still open
9. Video matting — **MODNet per-frame** (RVM is GPL — excluded)
10. Auto-captions (stretch) — **Whisper tiny** (MIT) via transformers.js
11. ✅ Detection pack — shipped in `@64tensor/retouch-ml` M4 + M4b: **UltraFace** faces (MIT, ~1.2 MB, in-graph prior decode) and **YOLOX-nano** objects (Apache-2.0, ~3.5 MB, 80 COCO classes — raw per-anchor output decoded in TS with per-class NMS; **BGR** input confirmed empirically, person 0.90 vs 0.78 RGB). The Detect tab finds either and feeds the same actions: radial Masks-tool entries, destructive privacy **pixelate** (in place), and **crop-to-boxes**. Open-vocab (OWL-ViT) still open
12. Face-aware retouch — **MediaPipe Face Mesh** (Apache-2.0) landmarks gating skin smoothing / eye brighten

## Cut by the fully-client-side constraint

Generative inpaint/outpaint (FLUX/SDXL/Qwen-Image-Edit), IC-Light relighting,
video frame interpolation at scale — multi-GB diffusion/flow models with no
realistic browser path. Revisit only if a server proxy tier is ever wanted.

## Recommended order

1. ✅ Tier A (all 11 shipped)
2. `@64tensor/retouch-ml` milestones (agreed 2026-07): ✅ M1 scaffold+cutout → ✅ M2 upscale (Real-ESRGAN) → ✅ M3 erase (LaMa) → ✅ M4 detection pack (faces + ✅ M4b objects) → ✅ M5 SlimSAM select → ✅ M6 depth bokeh → ✅ M7 denoise (SCUNet — colorize skipped: blocked on export licensing) → M8+ face restoration (model undecided)
