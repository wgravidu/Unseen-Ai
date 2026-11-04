import os, base64
from openai import OpenAI

client = OpenAI(base_url="https://api.meta.ai/v1", api_key=os.environ["MODEL_API_KEY"])

with open("wall.jpg", "rb") as f:
    b64 = base64.b64encode(f.read()).decode()

resp = client.chat.completions.create(
    model="muse-spark-1.3",   # error ආවොත් "muse-spark-1.2" try කරන්න
    messages=[{
        "role": "user",
        "content": [
            {"type": "text", "text": "Describe visible problems on this wall. Only state what you can see."},
            {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{b64}"}},
        ],
    }],
)
print(resp.choices[0].message.content)