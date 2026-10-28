import { useState } from "react";
const API = "http://127.0.0.1:8000";

function List({ title, items }) {
  if (!items || items.length === 0) return null;
  return (
    <div style={{ marginTop: 16 }}>
      <h4 style={{ margin: "0 0 6px", fontSize: 14, textTransform: "uppercase", letterSpacing: 0.5, opacity: 0.7 }}>{title}</h4>
      <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.6 }}>{items.map((t, i) => <li key={i}>{t}</li>)}</ul>
    </div>
  );
}

function Highlighted({ src, regions, loading }) {
  if (!src) return null;
  return (
    <div style={{ position: "relative", display: "inline-block", marginTop: 12 }}>
      <div style={{ borderRadius: 12, overflow: "hidden", boxShadow: "0 4px 20px rgba(0,0,0,0.1)" }}>
        <img src={src} alt="evidence" style={{ maxWidth: "100%", maxHeight: 380, display: "block" }} />
      </div>
      {loading && <div style={{ position: "absolute", top: 10, left: 10, background: "rgba(0,0,0,0.8)", color: "white", padding: "6px 10px", borderRadius: 20, fontSize: 12 }}>Locating marked areas...</div>}
      {regions && regions.map((r, i) => {
        const left = r.x1 / 10;
        const top = r.y1 / 10;
        const width = (r.x2 - r.x1) / 10;
        const height = (r.y2 - r.y1) / 10;
        return (
          <div key={i} style={{ position: "absolute", left: `${left}%`, top: `${top}%`, width: `${width}%`, height: `${height}%`, border: "2.5px solid #ff2a2a", borderRadius: 6, boxSizing: "border-box" }}>
            <span style={{ background: "#ff2a2a", color: "white", fontSize: 11, padding: "2px 6px", position: "absolute", bottom: "100%", left: 0, marginBottom: 4, whiteSpace: "nowrap", borderRadius: 4, fontWeight: 600 }}>{r.label}</span>
          </div>
        );
      })}
    </div>
  );
}

function ResultView({ result }) {
  if (result.error) return <p style={{ color: "crimson", background: "#ffe8e8", padding: 10, borderRadius: 8 }}>{result.error}</p>;
  return (
    <div style={{ background: "white", padding: 16, borderRadius: 12, marginTop: 12 }}>
      {result.what_changed && <p style={{ background: "#e8f1ff", color: "#123", padding: 10, borderRadius: 8, marginTop: 0 }}><strong>What changed:</strong> {result.what_changed}</p>}
      <List title="What I can see" items={result.observations} />
      <List title="Uncertainties" items={result.uncertainties} />
      <List title="Possible causes" items={(result.possible_causes || []).map((c) => `${c.cause} (${c.confidence})`)} />
      <List title="Safe next steps" items={result.safe_next_steps} />
    </div>
  );
}

export default function App() {
  const [images, setImages] = useState([]);
  const [notes, setNotes] = useState([]);
  const [rounds, setRounds] = useState([]);
  const [sentCount, setSentCount] = useState(0);
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [hLoading, setHLoading] = useState(false);
  const [error, setError] = useState("");

  const latest = rounds[rounds.length - 1];
  const isFinal = latest && !latest.error && !latest.needs_more_evidence;

  function addPhoto(e) {
    const f = e.target.files[0];
    if (!f) return;
    setImages((p) => [...p, { file: f, url: URL.createObjectURL(f) }]);
    e.target.value = "";
    setError("");
  }

  async function investigate() {
    const newAnswer = answer.trim();
    if (images.length === 0) { setError("Add a photo first."); return; }
    if (rounds.length > 0 && images.length === sentCount && !newAnswer) { setError("Add new photo or answer."); return; }
    const newNotes = newAnswer ? [...notes, newAnswer] : notes;
    setLoading(true); setError("");
    try {
      const form = new FormData();
      images.forEach((im) => form.append("images", im.file));
      form.append("notes", JSON.stringify(newNotes));
      form.append("previous", latest && !latest.error ? JSON.stringify(latest) : "");
      form.append("round_no", String(rounds.length + 1));
      const res = await fetch(`${API}/investigate`, { method: "POST", body: form });
      if (!res.ok) throw new Error("Server error " + res.status);
      const data = await res.json();
      let regions = [];
      try {
        setHLoading(true);
        const hForm = new FormData();
        hForm.append("image", images[images.length - 1].file);
        const hRes = await fetch(`${API}/highlight`, { method: "POST", body: hForm });
        const hData = await hRes.json();
        regions = hData.regions || [];
      } catch {}
      setHLoading(false);
      setRounds((r) => [...r, { ...data, regions, imageUrl: images[images.length - 1].url }]);
      setNotes(newNotes); setSentCount(images.length); setAnswer("");
    } catch (e) { setError(e.message); }
    finally { setLoading(false); setHLoading(false); }
  }

  function reset() { setImages([]); setNotes([]); setRounds([]); setSentCount(0); setAnswer(""); setError(""); }

  return (
    <div style={{ minHeight: "100vh", background: "#f6f5ef", color: "#1a1a1a" }}>
      <div style={{ maxWidth: 800, margin: "0 auto", padding: 24 }}>
        <h1 style={{ fontSize: 48, marginBottom: 0, letterSpacing: -1 }}>UNSEEN AI</h1>
        <p style={{ marginTop: 4, opacity: 0.7, fontSize: 18 }}>See. Understand. Solve.</p>
        {!isFinal && (
          <div style={{ marginTop: 24, background: "white", padding: 16, borderRadius: 16, border: "1px dashed #bbb" }}>
            <input type="file" accept="image/*" onChange={addPhoto} />
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
              {images.map((im, i) => <img key={i} src={im.url} alt={`ev ${i}`} style={{ height: 100, borderRadius: 8, border: "1px solid #ddd" }} />)}
            </div>
          </div>
        )}
        {rounds.map((r, i) => (
          <div key={i} style={{ marginTop: 28 }}>
            <h3 style={{ marginBottom: 8 }}>{i === rounds.length - 1 && isFinal ? "Final Report" : `Round ${i + 1}`}</h3>
            <Highlighted src={r.imageUrl} regions={r.regions} loading={i === rounds.length - 1 && hLoading} />
            <ResultView result={r} />
          </div>
        ))}
        {latest && !latest.error && latest.needs_more_evidence && latest.followup_request && (
          <div style={{ marginTop: 20, padding: 14, border: "2px solid #ff9a00", background: "#fff7e6", borderRadius: 12 }}>
            <strong>I need more evidence ({latest.followup_request.type}):</strong>
            <p style={{ margin: "8px 0" }}>{latest.followup_request.text}</p>
            <textarea value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Type your answer here" rows={3} style={{ width: "100%", boxSizing: "border-box", padding: 10, borderRadius: 8, border: "1px solid #ccc" }} />
          </div>
        )}
        {error && <p style={{ color: "crimson", background: "white", padding: 10, borderRadius: 8 }}>{error}</p>}
        <div style={{ marginTop: 20, display: "flex", gap: 10 }}>
          {!isFinal && <button onClick={investigate} disabled={loading} style={{ padding: "10px 18px", borderRadius: 10, border: "none", background: "black", color: "white", cursor: "pointer", fontWeight: 600 }}>{loading ? "Investigating..." : rounds.length === 0 ? "Investigate" : "Update investigation"}</button>}
          {rounds.length > 0 && <button onClick={reset} style={{ padding: "10px 18px", borderRadius: 10, border: "1px solid #bbb", background: "white", cursor: "pointer" }}>Start over</button>}
        </div>
      </div>
    </div>
  );
}