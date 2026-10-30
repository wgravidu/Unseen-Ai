# UNSEEN AI

UNSEEN AI is a dark, futuristic web workspace for investigating visible wall
stains and possible moisture-related issues. It includes a session-gated
animated startup, hamburger navigation, dashboard feature cards, browser
Camera Scan, multi-image Gallery Upload (maximum four), Automatic Damage
Highlight via FastAPI `POST /highlight`, Meta AI Investigation via
`POST /analyze` and `POST /investigate`, an illustrative React Three Fiber
wall view, in-session investigation history, and explicit API/Local AI engine
settings.

The selected AI engine is persisted in `localStorage`. API AI sends images to
the configured FastAPI backend only when an API feature is run. Local AI is an
experimental on-device mode described below. The `/highlight` backend now
uses the configured Meta vision model to return tightly bounded visible-region
boxes in normalized 0–1000 coordinates. It returns no boxes when no distinct
visible problem area is identified. These boxes mark visible appearance only;
they do not diagnose moisture, mold, leakage, or a cause, and their scores are
not measured accuracy.

## Requirements

- Node.js and npm
- Python 3.10 or newer
- A Meta-compatible model API key configured in the backend environment

## Run the backend

Open PowerShell and run:

```powershell
cd "C:\Users\Piyumi\Desktop\Meta Ai\backend"
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
$env:MODEL_API_KEY = "your-model-api-key"
python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

Keep the API key in the backend environment only. Do not put it in a `VITE_`
variable or any frontend file.

In another PowerShell window, check that the backend is running:

```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:8000/health"
```

The backend's default CORS configuration allows the Vite development origins
`http://localhost:5173` and `http://127.0.0.1:5173`.

## Run the frontend

In a second terminal:

```powershell
cd "C:\Users\Piyumi\Desktop\Meta Ai\unseen-ai"
Copy-Item .env.example .env.local
npm install
npm run dev
```

Open the Vite URL shown in the terminal, select a JPEG, PNG, or WebP image up
to 8 MB, and choose **Analyze wall**.

`VITE_API_BASE_URL` sets the FastAPI origin. The default is
`http://localhost:8000`; edit `unseen-ai/.env.local` if the backend is hosted
elsewhere, then restart the Vite server:

```dotenv
VITE_API_BASE_URL=http://localhost:8000
```

## Verify the frontend

From `unseen-ai`, run:

```powershell
npm run lint
npm run build
```

Backend parser tests (no model call):

```powershell
cd "C:\Users\Piyumi\Desktop\Meta Ai\backend"
python -m unittest discover -s tests -v
```

### Accuracy validation protocol (required before any accuracy claim)

1. Collect 30–50 real wall photos covering stains, cracks, peeling, clean walls, shadows, and non-wall images.
2. Human-label each visible damage region with a box in 0–1000 coordinates.
3. Run `/highlight` and `/analyze` on the same held-out set.
4. Measure box precision, recall, and IoU; record false boxes on clean/non-wall photos separately.
5. Tune prompts or thresholds, rerun, and only publish the measured held-out result.

To exercise the analysis endpoint directly with the sample image from the
project root (the backend must be running and its model key configured):

```powershell
curl.exe -F "image=@C:\Users\Piyumi\Desktop\Meta Ai\wall.jpg;type=image/jpeg" http://127.0.0.1:8000/analyze
```

The endpoint accepts the multipart field `image`. The UI displays the backend
response fields for wall visibility, observations, uncertainties, possible
causes, evidence requests, next-best-view guidance, safe next steps, and
confidence. It does not treat the investigation-only `what_changed` field as
part of the single-image response.

## Full-app capabilities

- Cinematic session splash with progress ring, SYSTEM READY hold, Skip Intro, and reduced-motion support.
- English/Sinhala UI switch in the header and AI Engine Settings, persisted in `localStorage`.
- Smart Guided Camera with a cyan framing guide and live brightness/detail hints.
- Gallery Upload with up to four validated photos and Investigation handoff.
- Meta AI Investigation with answer box, voice input where the browser provides SpeechRecognition (`en-US` / `si-LK`), follow-up photos, rounds, What Changed, Before/After slider, pixel-difference heatmap, focus-area overlay on the analyzed photo, and PDF report.
- Automatic Damage Highlight using the live Meta-vision `/highlight` endpoint; invalid and whole-image boxes are discarded and accuracy is not claimed without labels.
- Interactive illustrative 3D wall view with orbit/zoom, region selection, camera reset, and no invented depth data.
- Saved Cases in browser IndexedDB. Saving stores the current result and current image blob only on that device; saved cases can be reopened or deleted from Investigation History.
- Production PWA metadata and a service-worker app shell. The shell cache is progressive enhancement; API AI still needs its backend, while Local AI may reuse its model cache when the browser permits.

## Language

Use the **EN / සිං** switch in the top-right header, beside the API status.
The choice is saved in `localStorage` under `unseen-ai-language` and restored
on refresh. It translates static app UI: navigation, dashboard cards, camera,
gallery, highlight, investigation labels, local results labels, compare,
history, settings, and about text. The same switch is also available as
English / සිංහල buttons in AI Engine Settings. AI-generated observations and
answers are not mechanically translated; the Meta model may respond in the
language used in your photos/answers. The PDF report accepts the selected
language, but jsPDF standard fonts do not fully support Sinhala script, so the
PDF keeps English headings and states that limitation honestly.

## Web navigation

Use the hamburger button at the top left. The drawer contains Dashboard,
Camera Scan, Gallery Upload, Automatic Damage Highlight, Meta AI
Investigation, Interactive 3D Visualization, AI Engine Settings,
Investigation History, and About UNSEEN AI. It closes on selection, Escape,
backdrop click, or the close button. The 3D view projects the current photo
onto a flat wall panel and maps only backend-supplied highlight regions or
the latest Meta AI next-best-view focus area; it is illustrative and does not
reconstruct depth or prove structural damage.

## Analysis modes

Open **AI Engine Settings** from the drawer or dashboard:

- **API AI** is the original mode. It sends the selected image to FastAPI
  (`POST /analyze`) and follow-up evidence to `POST /investigate`.
- **Local AI** is an experimental, browser-based mode. It does not call the
  FastAPI analysis endpoints or an external AI inference API. It lazily loads
  Transformers.js and the quantized `Xenova/mobilevit-small` model only after
  the user starts a local analysis. The first load downloads roughly 6 MB of
  model files, so first-time setup may require internet access. After a
  successful load, the browser may reuse cached model files for later local
  analysis; this depends on browser cache policy and storage availability.

Local AI combines MobileViT-Small's general ImageNet image classification with
measured canvas pixel statistics: brightness, contrast, dark/very-dark/bright
pixel shares, edge density, dominant color buckets, and a 3-by-3 dark-region
concentration measure. A second photo can be compared locally using changes in
those measurements. These are **not** trained wall-stain, moisture, or mold
detection results and do not diagnose a cause. Lighting, angle, distance, and
camera exposure can change the measurements without a physical wall change.
Uploaded photos are held only in browser memory for the current session; the
app does not intentionally store them permanently.

## Phase A features

- **Automatic Damage Highlight:** `POST /highlight` asks the Meta vision model
  for at most five visible-region boxes. Invalid, tiny, duplicate, or
  whole-image boxes are discarded by the backend normalizer.
- **Before / After Compare:** after a second investigation round, the app
  shows a draggable slider and a resized pixel-difference heatmap with
  changed-pixel share and mean pixel difference. Lighting, angle, distance,
  and exposure differences can create heatmap changes without physical change.
- **PDF Report:** the current result can be downloaded as a jsPDF report with
  the current photo, observations, uncertainties, separately labeled possible
  causes, evidence required, safe next steps, highlight summary, round summary,
  and limitations.

UNSEEN AI does **not** claim 90% accuracy. Model confidence is not accuracy.
A real accuracy claim requires labeled wall photos with human-verified boxes
and measured precision, recall, and IoU on a held-out test set.

## Suggested checks

For Local AI, open the browser developer tools Network panel, switch to Local
AI, and analyze an image. Apart from first-time model/runtime downloads from
the model host, there should be no request to `localhost:8000/analyze` or
`/investigate`. Then run API AI mode and confirm those existing endpoints are
still called successfully when the backend is running.
