# UNSEEN AI — Demo Script (සිංහල)

> **කියවන්න කලින්:** මේ script එක ඔයාට demo එක present කරන්න step-by-step පාවිච්චි කරන්න පුළුවන්.
> App එක දැනටමත් run වෙනවා — පහළ "දැන් run වෙලා තියෙන තත්ත්වය" බලන්න.

---

## 1. Demo එකට කලින් සූදානම (Demo එකට විනාඩි 10කට කලින්)

### 1.1 App එක start කරන විදිය (ලේසිම විදිය)

1. `C:\Users\Piyumi\Desktop\Meta Ai` folder එක අරින්න.
2. **`start-app.bat`** එක double-click කරන්න.
3. කළු පාට window **2ක්** අරුණට එනවා — ඒ දෙක වහන්න එපා:
   - **UNSEEN AI Backend** (FastAPI, port `8000`)
   - **UNSEEN AI Frontend** (Vite, port `5173`)
4. ටික වෙලාවකින් browser එක auto open වෙලා `https://localhost:5173` පෙන්වනවා.

> App එක **නවත්වන්න:** ඒ කළු window දෙක වහන්න, නැත්නම් ඒ window ඇතුළේ `Ctrl+C` ඔබන්න.

### 1.2 දැනටමත් run වෙලා තියෙනවද කියලා බලන විදිය

- Browser එකේ: `https://localhost:5173` → app එක පෙනෙනවා නම් frontend එක වැඩ.
- Browser එකේ උඩ දකුණු පැත්තේ **"API online"** කියලා පෙන්වනවා නම් backend එකත් වැඩ.
  (`API offline` නම් backend window එක වහලා ආයෙත් `start-app.bat` දාන්න.)

### 1.3 Phone එකෙන් demo කරනවා නම් (camera demo එකට)

1. Phone එකයි laptop එකයි **එකම Wi-Fi** එකට connect කරන්න.
2. `start-app.bat` window එකේ යටින් පෙන්වන **Network** ලිපිනය phone එකේ browser එකෙන් අරින්න.
   උදා: `https://192.168.1.50:5173`
3. Camera එකට HTTPS අනිවාර්යයි — ඒකයි මේ project එකේ mkcert වලින් local certificate එකක් හදලා තියෙන්නේ.
   Phone එකේ certificate warning එකක් ආවොත්, laptop එකේ තියෙන root CA එක phone එකට install කරන්න ඕනේ වෙන්න පුළුවන්.

### 1.4 Demo එකට හොඳ photo එකක්

- බිත්තියේ පැල්ලමක් / ඉරිතැලීමක් / තෙත් පැල්ලමක් තියෙන පැහැදිලි photo එකක් phone එකේ ලෑස්ති කරගන්න.
- Photo එක **අඳුරු / බොඳ / දුර වැඩි** නම් app එක ඒක reject කරනවා (ඒක feature එකක් — පහළ බලන්න), ඉතින් හොඳ එළිය තියෙන photo එකක් ගන්න.

---

## 2. App එක මොකක්ද? (Opening — විනාඩි 1)

> කියන්න: *"මේක UNSEEN AI. බිත්තියේ photo එකකින්, බිත්තියේ මතුපිට යට සිද්ධ වෙන දේ — පැල්ලම්, ඉරිතැලීම්, තෙතමනය වගේ දේවල් — ගැන AI එකකින් දෘශ්‍ය පරීක්ෂණයක් කරන app එකක්. කැමරාවෙන් ගන්නත් පුළුවන්, gallery එකෙන් upload කරන්නත් පුළුවන්. ඊළඟට ප්‍රශ්නය මොකක්ද කියලා විතරක් නෙවෙයි, ඊළඟට ගන්න ඕන photo එක මොකක්ද කියලත් AI එක කියලා දෙනවා."*

- **Frontend:** React + Vite — `unseen-ai` folder එක.
- **Backend:** Python FastAPI — `backend` folder එක, `main.py`.
- **AI Model:** Meta AI (`muse-spark-1.3`), backend එක හරහා.
- **භාෂා 2ක්:** English + සිංහල (උඩ දකුණු පැත්තේ `EN` / `සිං` බොත්තම්).

---

## 3. Demo Flow — Step by Step

### Step 1 — Splash + Dashboard (තත්පර 30)

1. Page එක reload කරන්න → UNSEEN AI logo එකත් එක්ක splash screen එක එනවා.
2. **Skip Intro** ඔබන්න, නැත්නම් ඉවර වෙනකම් ඉන්න.
3. Dashboard එකේ feature cards 6ක් පෙන්වනවා:
   - 📷 **Camera Scan** — කැමරා ස්කෑන්
   - 🖼️ **Gallery Upload** — ගැලරි උඩුගත කිරීම
   - 🔍 **Automatic Damage Highlight** — ස්වයංක්‍රීය හානි උද්දීපනය
   - 🧪 **Meta AI Investigation** — Meta AI පරීක්ෂණය
   - 🧊 **Interactive 3D Visualization** — අන්තර්ක්‍රියාකාරී 3D දසුන
   - ⚙️ **AI Engine Settings** — AI එන්ජින් සැකසීම්

> කියන්න: *"උඩ දකුණු පැත්තේ 'API online' කියලා පෙන්වනවා — ඒ කියන්නේ frontend එක backend එකට connect වෙලා කියන එක. මේක තත්පර 30කට සැරයක් auto check වෙනවා."*

### Step 2 — භාෂාව මාරු කරන එක පෙන්වන්න (තත්පර 20)

- උඩ දකුණු පැත්තේ **සිං** බොත්තම ඔබන්න → මුළු app එකම සිංහලට මාරු වෙනවා.
- Demo එක සිංහලෙන් කරනවා නම් මෙතනින්ම සිංහලට දාගන්න.

### Step 3 — Photo එකක් Upload කරන එක (විනාඩි 1)

1. වම් පැත්තේ මෙනුව (☰) අරින්න → **ගැලරි උඩුගත කිරීම (Gallery)** තෝරන්න.
   - JPG / PNG / WebP photo **4ක් දක්වා** දාන්න පුළුවන්.
   - File එකක් **8 MB** ට වැඩි නම් හරි, type එක වැරදි නම් හරි, validation error එකක් පෙන්වනවා.
2. හරිම බිත්ති photo එකක් තෝරන්න → preview එක පෙන්වනවා.
3. **Meta AI පරීක්ෂණය (Investigation)** තෝරන්න → photo එක එතැනටත් එනවා, **"Analyze wall"** බොත්තම ඔබන්න.

### Step 4 — පළමු විශ්ලේෂණය: `/analyze` (විනාඩි 2–3)

මෙතන තමයි backend එක වැඩ කරන්නේ:

1. බොත්තම ඔබපු ගමන්, කලින් frontend එක photo එකේ **quality එක** බලනවා:
   - අඳුරු වැඩිද? බොඳ වැඩිද? දුර වැඩිද?
   - හරි නැත්නම් → **"සාක්ෂි තවම ප්‍රමාණවත් නොවේ"** කියලා, backend එකට යවන්නේ නැතුවම ආයේ photo එකක් ඉල්ලනවා.
   - පස්සේ photo එක **1024px වලට compress** කරලා WebP කරලා යවනවා (data අඩුවෙන් යවන්න).
2. Backend එකෙන් (`POST /analyze`) ලැබෙන උත්තරේ:
   - **දෘශ්‍ය නිරීක්ෂණ** (Observations) — photo එකේ ඇත්තටම පෙනෙන දේ.
   - **අනිශ්චිතතා** (Uncertainties) — photo එකෙන් තහවුරු කරන්න බැරි දේ.
   - **විය හැකි හේතු** (Possible causes) — low / medium / high likelihood එකත් එක්ක.
   - **විශ්වාසය** (Confidence %) — උදා: 62%.
   - **ආරක්ෂිත ඊළඟ පියවර** (Safe next steps).

> කියන්න: *"මේක නිශ්චිත diagnosis එකක් නෙවෙයි — visual assessment එකක් විතරයි කියලා app එක හැමතැනම කියනවා. ඒක intentional, ආරක්ෂාවට."*

### Step 5 — Automatic Damage Highlight: `/highlight` (විනාඩි 1–2)

1. මෙනුවෙන් **ස්වයංක්‍රීය හානි උද්දීපනය (Highlight)** තෝරන්න.
2. Backend එක `POST /highlight` එකට photo එක යවනවා.
3. AI එක හානි පැල්ලම් තියෙන තැන් වලට **කොටු (bounding boxes)** අඳිනවා — label එකයි confidence එකයි එක්ක.
   - උදා: "dark stain patch — 0.87"

> කියන්න: *"මේ කොටු කියන්නේ පෙනෙන පෙනුම විතරයි — 'මේක තෙතමනයයි' කියලා diagnose කරන්නේ නෑ."*

### Step 6 — Multi-round Investigation + Next-Best-View: `/investigate` (විනාඩි 3) ⭐ (මේක demo එකේ highlight එක)

මේක මේ app එකේ special ම feature එක:

1. පළමු analysis එකේ **confidence එක අඩු නම්** (උදා: 70% ට අඩු), AI එක කියනවා **"තවත් සාක්ෂි අවශ්‍යයි"** කියලා.
2. එතකොට AI එක **Next-Best-View** එකක් දෙනවා — ඊළඟ photo එක ගන්න ඕන විදිය:
   - **Instruction:** උදා: *"පැල්ලමේ පහළ කොටස සහ බිම අසල ප්‍රදේශය පැහැදිලිව පෙනෙන ඡායාරූපයක් ලබාදෙන්න. දුර 30cm, low angle එකෙන්"*
   - **Focus box:** පරණ photo එක උඩ කොටුවකින් ඊළඟට බලන්න ඕන තැන පෙන්වනවා.
   - **Distance / Angle / Priority:** close-up / medium / wide, straight / low / high / side.
3. ඔයා ඒ විදියට දෙවෙනි photo එකක් අරන් upload කරන්න → **Round 2**.
4. Round 2 එකේදී backend එකට යන්නේ:
   - අලුත් photo එක (photo 4ක් දක්වා),
   - ඔයාගේ notes / පිළිතුර,
   - **පරණ analysis එකම** (`previous`) — AI එක ඒක critically reassess කරනවා.
5. උත්තරේ අලුත් දේවල් විතරක් නෙවෙයි, **"What changed"** card එකකුත් එනවා:
   - අලුත් නිරීක්ෂණ, අයින් වුණ නිරීක්ෂණ, confidence එක කීයකින් වෙනස් වුණාද.

> කියන්න: *"සාමාන්‍ය AI photo analyzer එකක් photo එකක් බලලා ඉවරයි. මේක photographer කෙනෙක්ට වගේ — 'ඊළඟ photo එක මෙහෙම ගන්න' කියලා කියලා දෙනවා, ඊට පස්සේ පරණ උත්තරේ හරිද කියලා ආයෙත් බලනවා."*

### Step 7 — Camera Scan (විනාඩි 1)

1. මෙනුවෙන් **කැමරා ස්කෑන් (Camera)** තෝරන්න.
2. **Smart Capture Guide** එක එනවා — real-time එකේ කියනවා:
   - "අඳුරු වැඩියි — ආලෝකය එක් කරන්න"
   - "බොඳ වැඩියි — ස්ථාවරව අල්ලන්න"
   - "තවත් ළං වන්න"
   - "රාමුව හොඳයි — දැන් ගන්න" ✅
3. Capture ඔබන්න → photo එක කෙලින්ම investigation එකට යනවා.
   - Torch (flashlight) on/off කරන්නත් පුළුවන්.

### Step 8 — 3D Visualization (විනාඩි 1)

1. මෙනුවෙන් **අන්තර්ක්‍රියාකාරී 3D දසුන (Visualization)** තෝරන්න.
2. ඔයාගේ photo එක 3D බිත්ති panel එකකට project වෙනවා.
3. Highlight boxes + Next-Best-View focus area එකත් 3D එකේ පෙන්වනවා.
4. Mouse එකෙන් rotate / zoom කරන්න පුළුවන්.

> කියන්න: *"මේක illustrative 3D workspace එකක් — measurements ගන්න නෙවෙයි, ප්‍රදේශ map කරලා බලන්න."*

### Step 9 — Local AI Mode (Offline) (විනාඩි 1–2) ⭐

1. මෙනුවෙන් **AI එන්ජින් සැකසීම් (Settings)** තෝරන්න.
2. **Local AI** මාදිලියට මාරු කරන්න.
3. දැන් photo එක analyze කරන්න:
   - පළමු වතාවට පොඩි model එකක් (`Xenova/mobilevit-small`) browser එකට download වෙනවා — progress එක පෙන්වනවා.
   - ඊට පස්සේ **photo එක device එකෙන් එළියට යන්නේම නෑ** — සම්පූර්ණයෙන්ම browser එක ඇතුළේ (WebAssembly).
   - ලැබෙන්නේ measured සංඛ්‍යා: brightness, dark pixels %, edge density වගේ ඒවා + interpretation.
4. Photo 2ක් තියෙනවා නම් **Before/After compare** — slider එක අදින්න, heatmap එක බලන්න.

> කියන්න: *"API mode එකේ Meta AI එකේ සම්පූර්ණ intelligence එක ලැබෙනවා. Local mode එකේ privacy එක උපරිමයි — internet නැතුවත් වැඩ, හැබැයි ඒක experimental, measured data විතරයි දෙන්නේ, diagnosis නෙවෙයි."*

### Step 10 — PDF Report + History (තත්පර 30)

1. Investigation එක ඉවර වුණාම **"PDF වාර්තාව බාගත කරන්න"** බොත්තම තියෙනවා.
   - Report එකේ: observations, causes, confidence, rounds ඔක්කොම.
2. **"මෙම උපාංගයේ නඩුව සුරකින්න"** — case එක browser එකේ IndexedDB එකේ save වෙනවා.
3. මෙනුවෙන් **පරීක්ෂණ ඉතිහාසය (History)** → save කරපු cases, round එක ගානේ confidence timeline එක පෙන්වනවා.

> අනිවාර්යයෙන් කියන්න: *"Report එකේ අන්තිමට disclaimer එක තියෙනවා — 'මෙය AI අදහසක් පමණයි, නිවැරදි නිගමනය සඳහා වෘත්තිකයෙකු හමුවන්න'."*

---

## 4. Backend එකයි Frontend එකයි Connect වෙන විදිය ⭐

මේක තමයි "ඔක්කොම connect වෙන්නේ කොහොමද" කියන ප්‍රශ්නෙට උත්තරේ:

```
┌─────────────────────────────────────────────────────────────┐
│  PHONE / BROWSER  (Frontend)                                │
│  React + Vite  →  https://<hostname>:5173                   │
│  unseen-ai/src/App.jsx                                      │
└───────────────┬─────────────────────────────┬───────────────┘
                │                             │
        API calls (fetch)              Local mode නම් මෙතනින්
                │                      යන්නේ නෑ — browser එක
                ▼                      ඇතුළෙම analyze වෙනවා
┌───────────────────────────────────────────────┐
│  BACKEND  (FastAPI)                            │
│  https://<එකම hostname>:8000                   │
│  backend/main.py                               │
│                                                │
│  GET  /health      → server එක වැඩද?           │
│  POST /analyze     → photo 1 → විශ්ලේෂණය        │
│  POST /investigate → photos + notes + පරණ එක    │
│  POST /highlight   → හානි තැන් වලට කොටු         │
└───────────────┬───────────────────────────────┘
                │  OpenAI SDK (API key එක backend
                │  එකේ .env එකේ විතරයි — browser
                ▼  එකට කවදාවත් එන්නේ නෑ)
┌───────────────────────────────────────────────┐
│  META AI API  (https://api.meta.ai/v1)         │
│  Model: muse-spark-1.3                         │
└───────────────────────────────────────────────┘
```

### 4.1 Frontend එක backend එක හොයාගන්නේ කොහොමද?

- Frontend එක backend ලිපිනය හදන්නේ `unseen-ai/src/local/apiBase.js` එකෙන්:
  - `VITE_API_BASE_URL` එක set කරලා නැත්නම් → **එකම hostname එක + port 8000** auto ගන්නවා.
  - උදා: phone එක `https://192.168.1.50:5173` එකෙන් app එක ගත්තොත්, API එක auto `https://192.168.1.50:8000` වෙනවා. **ඒකයි phone එකෙන් කිසිම config එකක් නැතුව වැඩ කරන්නේ.**
- Frontend එක හැම call එකක්ම `fetch()` වලින්, `FormData` එකක photo එක දාලා යවනවා (`App.jsx` එකේ `postForm` function එක).

### 4.2 Backend එකේ endpoints 4

| Endpoint | මොකක්ද කරන්නේ | Frontend එක කවදාද කතා කරන්නේ |
|---|---|---|
| `GET /health` | `{"status":"ok","model_configured":true}` — API key එක තියෙනවද කියනවා | App එක load වෙද්දී + තත්පර 30කට සැරයක් |
| `POST /analyze` | Photo 1ක් → observations, causes, confidence, next-best-view | පළමු "Analyze wall" click එක |
| `POST /investigate` | Photos (1–4) + notes + පරණ analysis → අලුත් analysis + "what changed" | Round 2, 3, ... follow-up හැම එකක්ම |
| `POST /highlight` | Photo 1ක් → හානි තැන් වල bounding boxes (0–1000 coordinates) | Highlight page එක |

### 4.3 Backend එක ඇතුළේ වෙන දේ (`backend/main.py`)

1. **Photo එක validate කරනවා:** JPEG/PNG/WebP විතරයි, 8 MB ට අඩු වෙන්න ඕනේ, ඇත්ත image එකක්ද කියලා Pillow වලින් verify කරනවා.
2. **Photo එක පොඩි කරනවා:** EXIF rotation හදලා, 1024×1024 ට resize, JPEG quality 82 → Meta AI එකට යවන්න ලේසි වෙන්න.
3. **Meta AI එකට යවනවා:** System prompt එකත් එක්ක — *"ONLY JSON එකක් විතරක් දෙන්න, පෙනෙන දේ විතරක් කියන්න, diagnosis කරන්න එපා."*
4. **උත්තරේ පිරිසිදු කරනවා:** AI එක වැරදි JSON එකක් දුන්නොත් `normalize_analysis()` එකෙන් හදනවා (උදා: likelihood එක "High" නම් "high" කරනවා, focus box එකේ numbers 0–1000 ඇතුළට clamp කරනවා). ඒත් බැරි නම් **තව සැරයක්** AI එකට කියනවා හරියට දෙන්න කියලා.
5. **Pydantic validation:** උත්තරේ schema එකට ගැලපෙනවද අන්තිමටම check කරනවා.
   `needs_more_evidence=true` නම් අනිවාර්යයෙන්ම follow-up එකක් හරි next-best-view එකක් හරි තියෙන්න ඕනේ — නැත්නම් error.
6. **Frontend එකට යවනවා:** Frontend එකත් (`isAnalysisPayload`) ඒ shape එක හරිද කියලා දෙවෙනි සැරේට check කරනවා.

### 4.4 ආරක්ෂාව (Security) — අහන්න ඉඩ තියෙන ප්‍රශ්න

- **API key එක තියෙන්නේ කොහෙද?** Backend එකේ `backend/.env` එකේ විතරයි. Browser එකට කවදාවත් එන්නේ නෑ — ඒකයි backend එකක් තියෙන්නේ.
- **කවුද backend එකට කතා කරන්න පුළුවන්?** CORS එකෙන් local + LAN ලිපින විතරයි allow කරලා තියෙන්නේ (`localhost`, `192.168.x.x`, `10.x.x.x`, `172.16–31.x.x` — port 5173/4173 විතරයි).
- **Photo සීමා:** 8 MB, වර්ග 3යි, 20 megapixel ට වැඩි ඒවා reject.
- **HTTPS ඇයි?** Camera එකට browser එක secure context එකක් ඉල්ලනවා. ඒකයි mkcert වලින් localhost + LAN IP එකට certificate හදලා, backend එකයි frontend එකයි දෙකම HTTPS වලින් දුවන්නේ.

---

## 5. ප්‍රශ්න ඇහුවොත් උත්තර (Q&A Cheat Sheet)

| ප්‍රශ්නය | කෙටි උත්තරය |
|---|---|
| මේක ඇත්තටම diagnosis කරනවද? | නෑ. දෘශ්‍ය නිරීක්ෂණ සහ විය හැකි හේතු (උපකල්පන) විතරයි. හැම output එකකම disclaimer එක තියෙනවා. |
| Internet නැතුව වැඩ කරනවද? | Local AI mode එකේ වැඩ කරනවා (model එක පළමු සැරේ download වුණාට පස්සේ). API mode එකට backend + internet ඕනේ. |
| Photo කොහෙද යන්නේ? | API mode එකේ විතරක් backend එක හරහා Meta AI එකට. Local mode එකේ device එකෙන් එළියට යන්නේ නෑ. Save කරන cases තියෙන්නේ browser එකේ IndexedDB එකේ. |
| ඇයි සමහර photo reject වෙන්නේ? | අඳුරු / බොඳ / දුර වැඩි / එළිය වැඩි නම් frontend එකේ quality gate එකෙන්. ඒක වැරදි analysis එකක් දෙනවට වඩා හොඳයි. |
| Next-Best-View කියන්නේ මොකක්ද? | AI එක ඊළඟ photo එක ගන්න ඕන විදිය කියලා දෙන එක — focus box, දුර, කෝණය එක්ක. Evidence මදි වෙලාවට විතරයි එන්නේ. |
| Phone එකෙන් වැඩ කරනවද? | ඔව් — එකම Wi-Fi එකෙන්, Network ලිපිනයෙන්. Camera එකට HTTPS certificate එක ඕනේ. |
| Model එක මොකක්ද? | API: Meta AI `muse-spark-1.3`. Local: `Xenova/mobilevit-small` (browser එකේ දුවන පොඩි classifier එකක්). |

---

## 6. Demo එකේදි අවුලක් වුණොත් (Troubleshooting)

| අවුල | හේතුව / විසඳුම |
|---|---|
| "API offline" පෙන්වනවා | Backend window එක වහලා. `start-app.bat` ආයෙත් දාන්න. |
| Page එක load වෙන්නේ නෑ | Frontend window එක වහලා. `start-app.bat` ආයෙත් දාන්න (දෙකම check කරලා නැති එක විතරක් start කරනවා). |
| "MODEL_API_KEY is not configured" | `backend/.env` එකේ key එක නෑ. Key එක දාලා backend එක restart කරන්න. |
| "Could not reach the analysis server" | Backend එක down, නැත්නම් phone එක වෙන Wi-Fi එකක. |
| Photo එක reject වෙනවා (insufficient_evidence) | එළිය වැඩි කරලා, ළඟින්, focus කරලා ආයේ ගන්න. මේක demo එකට හොඳයි — quality gate එක feature එකක් විදියට පෙන්වන්න. |
| Camera එක වැඩ කරන්නේ නෑ (phone) | HTTPS නෙවෙයි නම් browser එක camera එක block කරනවා. Network ලිපිනය `https://` වලින් පටන් ගන්නවද බලන්න. |
| AI එක "invalid structured response" කියනවා | Backend එක auto තව සැරයක් try කරනවා. ආයෙත් ආවොත් photo එක මාරු කරලා බලන්න. |

---

## 7. Demo එකේ කෙටි පිළිවෙල (Cheat Sheet — විනාඩි 10)

```
0:00  Splash → Dashboard, "API online" පෙන්වන්න
1:00  සිංහලට මාරු කරන්න (සිං බොත්තම)
1:30  Gallery → බිත්ති photo 1ක් තෝරන්න
2:00  Investigation → Analyze wall  (/analyze)
4:00  ප්‍රතිඵල: observations, causes, confidence කියවන්න
5:00  Highlight → කොටු අඳින එක පෙන්වන්න  (/highlight)
6:00  Confidence අඩු photo එකකින් Next-Best-View පෙන්වන්න
7:30  Round 2 photo එක → "What changed"  (/investigate)
8:30  Camera guide එක පෙන්වන්න (phone camera)
9:00  3D view එක rotate කරලා පෙන්වන්න
9:30  Settings → Local AI (offline) පෙන්වන්න
10:00 PDF report download + disclaimer එක කියලා ඉවර කරන්න
```

---

## 8. තාක්ෂණික සාරාංශය (Closing එකට)

- **Frontend:** React 19 + Vite, React Three Fiber (3D), HuggingFace Transformers.js (local model), jsPDF (reports), IndexedDB (saved cases).
- **Backend:** FastAPI + Pydantic, Pillow (image processing), OpenAI SDK → Meta AI API.
- **Endpoints:** `/health`, `/analyze`, `/investigate`, `/highlight`.
- **Tests:** Backend parser tests 6ක් තියෙනවා — `cd backend; python -m pytest tests -q` → `6 passed`.
- **Run:** `start-app.bat` → Backend `:8000` (HTTPS), Frontend `:5173` (HTTPS), phone එකටත් LAN එකෙන්.
