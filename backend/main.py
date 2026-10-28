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
MODEL = os.getenv('MODEL_NAME', 'muse-spark-1.3')
MAX_BYTES = 8 * 1024 * 1024
Image.MAX_IMAGE_PIXELS = 20_000_000

class Cause(BaseModel):
    cause: str
    likelihood: Literal['low', 'medium', 'high']

class Followup(BaseModel):
    type: Literal['question', 'photo']
    text: str

class Analysis(BaseModel):
    is_wall_visible: bool
    observations: list[str] = Field(default_factory=list)
    uncertainties: list[str] = Field(default_factory=list)
    possible_causes: list[Cause] = Field(default_factory=list)
    needs_more_evidence: bool
    followup_request: Followup | None = None
    safe_next_steps: list[str] = Field(default_factory=list)

SYSTEM_PROMPT = '''You are UNSEEN AI, an evidence-driven visual assistant for visible wall issues.
Return ONLY a JSON object with these keys: is_wall_visible (boolean), observations (array of strings), uncertainties (array of strings), possible_causes (array of objects with cause and likelihood: low, medium, or high), needs_more_evidence (boolean), followup_request (null or object with type: question or photo, and text), safe_next_steps (array of strings).
Only describe what the photos actually support. Never claim a definitive diagnosis. Likelihood labels are qualitative, not calibrated probabilities. If a wall is not visible, say so and do not invent stains. Ask at most one targeted, safe follow-up. Never ask anyone to touch wiring, open appliances, climb, or enter hazardous areas. Recommend a qualified professional for potential structural, electrical, or serious moisture risks. For later rounds, compare new evidence with prior analysis and revise rather than automatically agreeing with it.'''

app = FastAPI(title='UNSEEN AI Backend', version='2.0')
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
                im.thumbnail((1600,1600))
                buf=io.BytesIO(); im.save(buf,format='JPEG',quality=85)
                return buf.getvalue()
        return await run_in_threadpool(convert)
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError) as exc:
        raise HTTPException(422,'Invalid or unsupported image') from exc

def data_url(data):
    return 'data:image/jpeg;base64,'+base64.b64encode(data).decode('ascii')

def parse_analysis(content):
    if not content:
        raise HTTPException(502,'AI returned an empty response')
    try:
        text=content.strip()
        if text.startswith('```'):
            text=text.split('\n',1)[-1].rsplit('```',1)[0].strip()
        result=Analysis.model_validate_json(text)
        if result.needs_more_evidence and result.followup_request is None:
            raise ValueError('Missing follow-up request')
        return result
    except (ValueError, ValidationError) as exc:
        log.warning('Invalid model response: %s',str(exc)[:200])
        raise HTTPException(502,'AI returned an invalid structured response; please retry') from exc

def ask_ai(content):
    try:
        response=client().chat.completions.create(model=MODEL,messages=[{'role':'system','content':SYSTEM_PROMPT},{'role':'user','content':content}],temperature=0.2)
        return parse_analysis(response.choices[0].message.content)
    except HTTPException:
        raise
    except Exception as exc:
        log.exception('Model request failed')
        raise HTTPException(502,'Model API request failed; check credentials, credits and model access') from exc

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
    try:
        user_notes=json.loads(notes)
        if not isinstance(user_notes,list) or any(not isinstance(n,str) for n in user_notes): raise ValueError()
        prior=Analysis.model_validate_json(previous) if previous.strip() else None
    except (ValueError,ValidationError) as exc:
        raise HTTPException(422,'notes must be a JSON string array; previous must be a valid analysis JSON object') from exc
    prompt=f'Investigation round {round_no}. Notes: {json.dumps(user_notes,ensure_ascii=False)}. '
    if prior: prompt+='Previous analysis (reassess critically): '+prior.model_dump_json()
    content=[{'type':'text','text':prompt}]
    for upload in images:
        content.append({'type':'image_url','image_url':{'url':data_url(await prepare_image(upload))}})
    result=await run_in_threadpool(ask_ai,content)
    output=result.model_dump()
    if prior:
        before=set(prior.observations); after=set(result.observations)
        output['what_changed']={'new_observations':sorted(after-before),'removed_observations':sorted(before-after),'note':'Changes reflect model output, not verified physical changes.'}
    return output

@app.post('/highlight')
async def highlight(image: UploadFile=File(...)):
    await prepare_image(image)
    # No fake boxes: actual SAM segmentation requires a separate verified model integration.
    return {'regions':[], 'method':'not_configured', 'message':'Segmentation model not connected; no highlight regions claimed.'}
