import os, io, json, base64, logging
from typing import Literal
from dotenv import load_dotenv
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.concurrency import run_in_threadpool
from openai import OpenAI
from PIL import Image, ImageOps, UnidentifiedImageError
from pydantic import BaseModel, Field, ValidationError

load_dotenv()
logging.basicConfig(level=logging.INFO)
log = logging.getLogger('unseen')
MODEL = os.getenv('MODEL_NAME', 'llama-4-maverick-17b-128e-instruct')
MAX_BYTES = 8 * 1024 * 1024
Image.MAX_IMAGE_PIXELS = 20_000_000

# --- MODELS IN CORRECT ORDER ---

class Cause(BaseModel):
    cause: str
    likelihood: Literal['low', 'medium', 'high']

class Followup(BaseModel):
    type: Literal['question', 'photo']
    text: str

class NextBestView(BaseModel):
    instruction: str = Field(description="Clear instruction for next photo")
    focus_area: dict = Field(description="{x_min,y_min,x_max,y_max} 0-1000")
    reason: str
    expected_evidence: str
    priority: Literal['low', 'medium', 'high']
    visual_guide: Literal['arrow', 'box', 'circle'] = 'box'
    distance: Literal['close-up', 'medium', 'wide'] = 'medium'
    angle: Literal['straight', 'low', 'high', 'side'] = 'straight'

class Analysis(BaseModel):
    is_wall_visible: bool
    observations: list[str] = Field(default_factory=list)
    uncertainties: list[str] = Field(default_factory=list)
    possible_causes: list[Cause] = Field(default_factory=list)
    needs_more_evidence: bool
    followup_request: Followup | None = None
    next_best_view: NextBestView | None = None
    safe_next_steps: list[str] = Field(default_factory=list)
    confidence: float = Field(default=0.6, ge=0, le=1)

SYSTEM_PROMPT = '''You are UNSEEN AI PRO with Next-Best-View capability.
Return ONLY a JSON object with these keys: is_wall_visible (boolean), observations (array), uncertainties (array), possible_causes (array with cause and likelihood), needs_more_evidence (boolean), followup_request (null or object with type: question/photo and text), next_best_view (null or object with instruction, focus_area {x_min,y_min,x_max,y_max 0-1000}, reason, expected_evidence, priority low/medium/high, visual_guide box, distance close-up/medium/wide, angle straight/low/high/side), safe_next_steps (array), confidence (0.0-1.0).

If needs_more_evidence=true, you MUST provide next_best_view with specific instruction like "පැල්ලමේ පහළ කොටස සහ බිම අසල ප්රදේශය පැහැදිලිව පෙනෙන ඡායාරූපයක් ලබාදෙන්න. දුර 30cm, low angle එකෙන්" and reason like "Bottom edge සහ floor junction එකෙන් moisture source එක හඳුනාගන්න". Be specific about distance and angle. If user wrote Sinhala, give instruction in Sinhala, else English.

Only describe what photos support. Never claim definitive diagnosis. Ask at most one targeted follow-up.'''

app = FastAPI(title='UNSEEN AI Backend', version='3.0')
app.add_middleware(CORSMiddleware, allow_origins=[x.strip() for x in os.getenv('CORS_ORIGINS','http://localhost:5173,http://127.0.0.1:5173').split(',') if x.strip()], allow_credentials=True, allow_methods=['GET','POST'], allow_headers=['*'])

@app.get('/health')
def health():
    return {'status':'ok', 'model_configured':bool(os.getenv('MODEL_API_KEY'))}

def client():
    key = os.getenv('MODEL_API_KEY')
    if not key:
        raise HTTPException(503, 'MODEL_API_KEY is not configured')
    return OpenAI(base_url=os.getenv('MODEL_BASE_URL','https://api.meta.ai/v1'), api_key=key, timeout=45.0, max_retries=1)

async def prepare_image(upload: UploadFile):
    if upload.content_type not in ('image/jpeg','image/png','image/webp'):
        raise HTTPException(415, 'Upload a JPEG, PNG or WebP image')
    raw = await upload.read(MAX_BYTES+1)
    if len(raw)>MAX_BYTES:
        raise HTTPException(413, 'Image exceeds 8 MB')
    try:
        def convert():
            with Image.open(io.BytesIO(raw)) as source:
                source.verify()
            with Image.open(io.BytesIO(raw)) as source:
                im=ImageOps.exif_transpose(source).convert('RGB')
                im.thumbnail((1024,1024))
                buf=io.BytesIO(); im.save(buf,format='JPEG',quality=82)
                return buf.getvalue()
        return await run_in_threadpool(convert)
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError) as exc:
        raise HTTPException(422,'Invalid or unsupported image') from exc

def data_url(data):
    return 'data:image/jpeg;base64,'+base64.b64encode(data).decode('ascii')

LIKELIHOOD_VALUES = {'low', 'medium', 'high'}
FOLLOWUP_TYPES = {'question', 'photo'}
VISUAL_GUIDES = {'arrow', 'box', 'circle'}
DISTANCES = {'close-up', 'medium', 'wide'}
ANGLES = {'straight', 'low', 'high', 'side'}

def _enum(value, allowed, fallback):
    return value if isinstance(value, str) and value in allowed else fallback

def _string_list(value):
    if isinstance(value, str):
        return [value] if value.strip() else []
    if isinstance(value, list):
        return [str(item) for item in value if item is not None and str(item).strip()]
    return []

def _number(value):
    try:
        return float(value)
    except (TypeError, ValueError):
        return None

def _clamp(value, low, high):
    return low if value is None else max(low, min(high, value))

def normalize_analysis(payload):
    """Repair common model shape slips without inventing findings."""
    data = dict(payload)

    for key in ('observations', 'uncertainties', 'safe_next_steps'):
        data[key] = _string_list(data.get(key))

    causes = []
    raw_causes = data.get('possible_causes')
    if isinstance(raw_causes, str):
        raw_causes = [raw_causes]
    if isinstance(raw_causes, list):
        for item in raw_causes:
            if isinstance(item, str):
                causes.append({'cause': item, 'likelihood': 'medium'})
            elif isinstance(item, dict) and item.get('cause'):
                causes.append({
                    'cause': str(item['cause']),
                    'likelihood': _enum(item.get('likelihood'), LIKELIHOOD_VALUES, 'medium'),
                })
    data['possible_causes'] = causes

    followup = data.get('followup_request')
    if isinstance(followup, str) and followup.strip():
        followup = {'type': 'question', 'text': followup}
    if not isinstance(followup, dict):
        followup = None
    if followup is not None and not str(followup.get('text', '')).strip():
        followup = None
    if followup is not None:
        followup = {'type': _enum(followup.get('type'), FOLLOWUP_TYPES, 'question'), 'text': str(followup['text'])}
    data['followup_request'] = followup

    next_view = data.get('next_best_view')
    if isinstance(next_view, dict):
        # Muse Spark commonly puts the focus box in visual_guide instead of focus_area.
        if not isinstance(next_view.get('focus_area'), dict) and isinstance(next_view.get('visual_guide'), dict):
            next_view['focus_area'] = next_view['visual_guide']
            next_view['visual_guide'] = 'box'
        focus = next_view.get('focus_area')
        if isinstance(focus, dict):
            focus = {key: _clamp(_number(focus.get(key)), 0, 1000) for key in ('x_min', 'y_min', 'x_max', 'y_max')}
            if focus['x_max'] <= focus['x_min']:
                focus['x_max'] = _clamp(focus['x_min'] + 100, 0, 1000)
                focus['x_min'] = _clamp(focus['x_max'] - 100, 0, 1000)
            if focus['y_max'] <= focus['y_min']:
                focus['y_max'] = _clamp(focus['y_min'] + 100, 0, 1000)
                focus['y_min'] = _clamp(focus['y_max'] - 100, 0, 1000)
        else:
            focus = {'x_min': 0, 'y_min': 0, 'x_max': 1000, 'y_max': 1000}
        next_view = {
            'instruction': str(next_view.get('instruction', '')),
            'focus_area': focus,
            'reason': str(next_view.get('reason', '')),
            'expected_evidence': str(next_view.get('expected_evidence', '')),
            'priority': _enum(next_view.get('priority'), LIKELIHOOD_VALUES, 'medium'),
            'visual_guide': _enum(next_view.get('visual_guide'), VISUAL_GUIDES, 'box'),
            'distance': _enum(next_view.get('distance'), DISTANCES, 'medium'),
            'angle': _enum(next_view.get('angle'), ANGLES, 'straight'),
        }
        if not next_view['instruction'].strip():
            next_view = None
    else:
        next_view = None
    data['next_best_view'] = next_view

    confidence = _number(data.get('confidence'))
    if confidence is None:
        confidence = 0.6
    elif confidence > 1:
        confidence = confidence / 100 if confidence <= 100 else 0.6
    data['confidence'] = _clamp(confidence, 0, 1)

    data['is_wall_visible'] = data.get('is_wall_visible') is True
    data['needs_more_evidence'] = data.get('needs_more_evidence') is True
    data = {field: data[field] for field in Analysis.model_fields if field in data}

    if data['needs_more_evidence'] and data['followup_request'] is None and data['next_best_view'] is None:
        raise ValueError('needs_more_evidence=true but no followup_request or next_best_view was provided')
    return data

def _extract_json_text(text):
    text = text.strip()
    if text.startswith('```'):
        lines = text.split('\n')
        if len(lines) > 1 and lines[0].startswith('```'):
            text = '\n'.join(lines[1:])
        if text.rstrip().endswith('```'):
            text = text.rstrip()[:-3].rstrip()
    start = text.find('{')
    end = text.rfind('}')
    if start != -1 and end > start:
        text = text[start:end + 1]
    return text

def parse_analysis(content):
    if not content:
        raise HTTPException(502,'AI returned an empty response')
    try:
        payload = json.loads(_extract_json_text(content))
        if not isinstance(payload, dict):
            raise ValueError('Model response is not a JSON object')
        result = Analysis.model_validate(normalize_analysis(payload))
        if result.needs_more_evidence and result.followup_request is None and result.next_best_view is None:
            raise ValueError('Missing follow-up or next_best_view')
        return result
    except (ValueError, TypeError, ValidationError) as exc:
        log.warning('Invalid model response: %s',str(exc)[:300])
        log.warning('Raw content: %s', content[:500])
        log.warning('Raw tail: %s', content[-500:])
        raise HTTPException(502,'AI returned an invalid structured response; please retry') from exc

def ask_ai(content):
    messages=[{'role':'system','content':SYSTEM_PROMPT},{'role':'user','content':content}]
    last_error: HTTPException | None = None
    for attempt in range(2):
        try:
            try:
                response=client().chat.completions.create(model=MODEL,messages=messages,temperature=0.2,response_format={'type':'json_object'})
            except Exception as exc:
                # Reword retry handling can mask the real cause, so log before falling back.
                log.warning('JSON mode request failed (%s); retrying without response_format', type(exc).__name__)
                response=client().chat.completions.create(model=MODEL,messages=messages,temperature=0.2)
            raw=response.choices[0].message.content
        except HTTPException:
            raise
        except Exception as exc:
            log.exception('Model request failed')
            raise HTTPException(502,'Model API request failed; check credentials') from exc
        try:
            return parse_analysis(raw)
        except HTTPException as exc:
            last_error=exc
            if attempt == 0:
                log.warning('Retrying model request once after invalid structured response')
                messages.append({'role':'assistant','content':raw or ''})
                messages.append({'role':'user','content':(
                    'Your previous reply failed validation. Reply with ONLY a corrected JSON object for exactly this schema: '
                    '{"is_wall_visible":boolean,"observations":[string],"uncertainties":[string],'
                    '"possible_causes":[{"cause":string,"likelihood":"low|medium|high"}],'
                    '"needs_more_evidence":boolean,'
                    '"followup_request":null or {"type":"question|photo","text":string},'
                    '"next_best_view":null or {"instruction":string,'
                    '"focus_area":{"x_min":number,"y_min":number,"x_max":number,"y_max":number},'
                    '"reason":string,"expected_evidence":string,"priority":"low|medium|high",'
                    '"visual_guide":"arrow|box|circle","distance":"close-up|medium|wide",'
                    '"angle":"straight|low|high|side"},'
                    '"safe_next_steps":[string],"confidence":number_between_0_and_1}. '
                    'visual_guide must be only the word "box" (or "arrow"/"circle"); focus_area must be an object with numeric coordinates. '
                    'No markdown fences and no text outside the JSON object.'
                )})
    raise last_error or HTTPException(502,'AI returned an invalid structured response; please retry')

@app.post('/analyze',response_model=Analysis)
async def analyze(image: UploadFile=File(...)):
    data=await prepare_image(image)
    content=[{'type':'text','text':'Analyze this image. Do not invent details.'},{'type':'image_url','image_url':{'url':data_url(data)}}]
    return await run_in_threadpool(ask_ai,content)

@app.post('/investigate')
async def investigate(images: list[UploadFile]=File(...), notes: str=Form('[]'), previous: str=Form(''), round_no: int=Form(1)):
    if not 1<=len(images)<=4:
        raise HTTPException(422,'Supply 1 to 4 images')
    if not 1<=round_no<=20:
        raise HTTPException(422,'Invalid round number')
    if len(notes)>6000 or len(previous)>12000:
        raise HTTPException(413,'Investigation text is too long')
    log.info('investigate round %s: notes=%s chars, previous=%s chars', round_no, len(notes), len(previous))
    try:
        user_notes=json.loads(notes)
        if not isinstance(user_notes,list) or any(not isinstance(n,str) for n in user_notes): raise ValueError()
        prior=Analysis.model_validate_json(previous) if previous.strip() else None
    except (ValueError,ValidationError) as exc:
        raise HTTPException(422,'notes must be JSON array; previous must be valid analysis JSON') from exc
    prompt=f'Investigation round {round_no}. Notes: {json.dumps(user_notes,ensure_ascii=False)}. '
    if prior: prompt+='Previous analysis (reassess critically): '+prior.model_dump_json()
    prompt+=' If evidence insufficient, provide next_best_view with specific instruction, focus_area, reason, expected_evidence, priority, distance, angle.'
    content=[{'type':'text','text':prompt}]
    for upload in images:
        content.append({'type':'image_url','image_url':{'url':data_url(await prepare_image(upload))}})
    result=await run_in_threadpool(ask_ai,content)
    output=result.model_dump()
    if prior:
        before=set(prior.observations); after=set(result.observations)
        output['what_changed']={'new_observations':sorted(after-before),'removed_observations':sorted(before-after),'confidence_delta': result.confidence - prior.confidence,'note':'Changes reflect model output, not verified physical changes.'}
    return output

HIGHLIGHT_PROMPT = '''Locate visible wall-surface problem areas in this photo, such as stains, discoloration, damp-looking patches, mold-like dark patches, cracks, peeling, bubbling, or damaged paint.
Return ONLY a JSON object with exactly this shape:
{"wall_visible":boolean,"regions":[{"label":string,"x_min":number,"y_min":number,"x_max":number,"y_max":number,"confidence":number_between_0_and_1}],"summary":string}
Coordinates use a normalized 0-1000 image coordinate system: (0,0) is top-left and (1000,1000) is bottom-right.
Rules:
- Include at most 5 regions.
- Draw each box tightly around a visibly distinct problem area only.
- Do NOT box the whole wall unless the whole visible wall is the problem area.
- Do NOT invent regions. If no distinct problem area is visible, return an empty regions array.
- Labels must describe visible appearance only, for example "dark stain patch", "discoloration", "crack line", "peeling paint area". Do not claim a cause or diagnosis.
- confidence is your visual certainty that the boxed area is visibly distinct, not diagnostic certainty.
- No markdown fences and no text outside the JSON object.'''

def _highlight_box(item):
    if not isinstance(item, dict):
        return None
    focus = item.get('focus_area') if isinstance(item.get('focus_area'), dict) else item
    coords = {}
    for key in ('x_min', 'y_min', 'x_max', 'y_max'):
        value = _number(focus.get(key))
        if value is None:
            return None
        # Some vision models return 0-1 coordinates despite the 0-1000 instruction.
        if 0 <= value <= 1:
            value *= 1000
        coords[key] = _clamp(value, 0, 1000)
    if coords['x_max'] <= coords['x_min'] or coords['y_max'] <= coords['y_min']:
        return None
    width = coords['x_max'] - coords['x_min']
    height = coords['y_max'] - coords['y_min']
    if width < 12 or height < 12 or width * height > 850_000:
        return None
    label = str(item.get('label') or item.get('type') or 'visible problem area').strip()
    if not label:
        label = 'visible problem area'
    confidence = _number(item.get('confidence'))
    if confidence is not None and confidence > 1 and confidence <= 100:
        confidence /= 100
    return {
        'label': label[:80],
        'x_min': round(coords['x_min']),
        'y_min': round(coords['y_min']),
        'x_max': round(coords['x_max']),
        'y_max': round(coords['y_max']),
        'confidence': round(_clamp(confidence, 0, 1), 3) if confidence is not None else None,
    }

def parse_highlight(content):
    if not content:
        raise HTTPException(502, 'AI returned an empty highlight response')
    try:
        payload = json.loads(_extract_json_text(content))
        if not isinstance(payload, dict):
            raise ValueError('Highlight response is not a JSON object')
        wall_visible = payload.get('wall_visible')
        if wall_visible is None:
            wall_visible = payload.get('is_wall_visible')
        raw_regions = payload.get('regions', [])
        if isinstance(raw_regions, dict):
            raw_regions = [raw_regions]
        if not isinstance(raw_regions, list):
            raise ValueError('Highlight regions must be an array')
        regions = []
        seen = set()
        for item in raw_regions:
            region = _highlight_box(item)
            if not region:
                continue
            key = (region['x_min'] // 10, region['y_min'] // 10, region['x_max'] // 10, region['y_max'] // 10)
            if key not in seen:
                seen.add(key)
                regions.append(region)
            if len(regions) >= 5:
                break
        summary = str(payload.get('summary') or '').strip()
        return {
            'wall_visible': wall_visible is True,
            'regions': regions,
            'method': 'meta_vision_bbox_v1',
            'message': summary[:500] if summary else (
                'Vision model returned visible-region bounding boxes. These boxes mark visible appearance only; they do not diagnose moisture, mold, or a cause.'
                if regions else
                'Vision model did not identify a distinct visible problem region in this photo.'
            ),
        }
    except HTTPException:
        raise
    except (ValueError, TypeError, ValidationError) as exc:
        log.warning('Invalid highlight response: %s', str(exc)[:300])
        log.warning('Highlight raw content: %s', content[:500])
        raise HTTPException(502, 'AI returned an invalid highlight response; please retry') from exc

def ask_highlight_ai(content):
    messages = [
        {'role': 'system', 'content': HIGHLIGHT_PROMPT},
        {'role': 'user', 'content': content},
    ]
    last_error: HTTPException | None = None
    for attempt in range(2):
        try:
            try:
                response = client().chat.completions.create(model=MODEL, messages=messages, temperature=0.1, response_format={'type': 'json_object'})
            except Exception as exc:
                log.warning('Highlight JSON mode failed (%s); retrying without response_format', type(exc).__name__)
                response = client().chat.completions.create(model=MODEL, messages=messages, temperature=0.1)
            raw = response.choices[0].message.content
        except HTTPException:
            raise
        except Exception as exc:
            log.exception('Highlight model request failed')
            raise HTTPException(502, 'Highlight model request failed; check credentials') from exc
        try:
            return parse_highlight(raw)
        except HTTPException as exc:
            last_error = exc
            if attempt == 0:
                messages.append({'role': 'assistant', 'content': raw or ''})
                messages.append({'role': 'user', 'content': (
                    'Your previous highlight reply failed validation. Reply with ONLY this JSON shape: '
                    '{"wall_visible":boolean,"regions":[{"label":string,"x_min":number,"y_min":number,"x_max":number,"y_max":number,"confidence":number_between_0_and_1}],"summary":string}. '
                    'Coordinates must be numbers from 0 to 1000. No markdown and no extra text.'
                )})
    raise last_error or HTTPException(502, 'AI returned an invalid highlight response; please retry')

@app.post('/highlight')
async def highlight(image: UploadFile=File(...)):
    data = await prepare_image(image)
    content = [
        {'type': 'text', 'text': 'Find tightly bounded visible wall problem areas in this image. Return JSON only.'},
        {'type': 'image_url', 'image_url': {'url': data_url(data)}},
    ]
    return await run_in_threadpool(ask_highlight_ai, content)