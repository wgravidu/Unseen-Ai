import { useState } from "react";

const API = "http://127.0.0.1:8000";

function List({ title, items }) {
  if (!items || items.length === 0) return null;
  return (
    <div style={{ marginTop: 12 }}>
      <h4 style={{ margin: "8px 0" }}>{title}</h4>
      <ul style={{ marginTop: 0 }}>{items.map((t, i) => <li key={i}>{t}</li>)}</ul>
    </div>
  );
}

function ResultView({ result }) {
  if (result.error) return <p style={{ color: "crimson" }}>{result.error}</p>;
  return (
    <div>
      {result.what_changed && (
        <p style={{ background: "#e8f1ff", color: "#123", padding: 10, borderRadius: 8 }}>
          <strong>What changed:</strong> {result.what_changed}
        </p>
      )}
      <List title="What I can see" items={result.observations} />
      <List title="What I'm unsure about" items={result.uncertainties} />
      <List
        title="Possible causes"
        items={(result.possible_causes || []).map((c) => `${c.cause} (${c.confidence})`)}
      />
      <List title="Safe next steps" items={result.safe_next_steps} />
    </div>
  );
}

export default function App() {
  const [images, setImages] = useState([]); // [{file, url}]
  const [notes, setNotes] = useState([]);
  const [rounds, setRounds] = useState([]);
  const [sentCount, setSentCount] = useState(0);
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const latest = rounds[rounds.length - 1];
  const isFinal = latest && !latest.error && !latest.needs_more_evidence;

  function addPhoto(e) {
    const f = e.target.files[0];
    if (!f) return;
    setImages((prev) => [...prev, { file: f, url: URL.createObjectURL(f) }]);
    e.target.value = "";
    setError("");
  }

  async function investigate() {
    const newAnswer = answer.trim();
    if (images.length === 0) {
      setError("Add a photo first.");
      return;
    }
    if (rounds.length > 0 && images.length === sentCount && !newAnswer) {
      setError("Add a new photo or write an answer first.");
      return;
    }
    const newNotes = newAnswer ? [...notes, newAnswer] : notes;

    setLoading(true);
    setError("");
    try {
      const form = new FormData();
      images.forEach((im) => form.append("images", im.file));
      form.append("notes", JSON.stringify(newNotes));
      form.append("previous", latest && !latest.error ? JSON.stringify(latest) : "");
      form.append("round_no", String(rounds.length + 1));

      const res = await fetch(`${API}/investigate`, { method: "POST", body: form });
      if (!res.ok) throw new Error("Server error " + res.status);
      const data = await res.json();

      setRounds((r) => [...r, data]);
      setNotes(newNotes);
      setSentCount(images.length);
      setAnswer("");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setImages([]);
    setNotes([]);
    setRounds([]);
    setSentCount(0);
    setAnswer("");
    setError("");
  }

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: 24, textAlign: "left" }}>
      <h1 style={{ marginBottom: 0 }}>UNSEEN AI</h1>
      <p style={{ marginTop: 4 }}>See. Understand. Solve.</p>

      {!isFinal && (
        <div>
          <input type="file" accept="image/*" onChange={addPhoto} />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
            {images.map((im, i) => (
              <img key={i} src={im.url} alt={`evidence ${i + 1}`} style={{ height: 110, borderRadius: 6 }} />
            ))}
          </div>
        </div>
      )}

      {rounds.map((r, i) => (
        <div key={i} style={{ marginTop: 24, borderTop: "1px solid #8884", paddingTop: 8 }}>
          <h3>
            {i === rounds.length - 1 && isFinal ? "Final report" : `Round ${i + 1}`}
          </h3>
          <ResultView result={r} />
        </div>
      ))}

      {latest && !latest.error && latest.needs_more_evidence && latest.followup_request && (
        <div style={{ marginTop: 16, padding: 12, border: "2px solid orange", borderRadius: 8 }}>
          <strong>I need more evidence ({latest.followup_request.type}):</strong>
          <p>{latest.followup_request.text}</p>
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
               placeholder="Type your answer here"
                           rows={3}
            style={{ width: "100%", boxSizing: "border-box" }}
          />
        </div>
      )}

      {error && <p style={{ color: "crimson" }}>{error}</p>}

      <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
        {!isFinal && (
          <button onClick={investigate} disabled={loading}>
            {loading ? "Investigating..." : rounds.length === 0 ? "Investigate" : "Update investigation"}
          </button>
        )}
        {rounds.length > 0 && <button onClick={reset}>Start over</button>}
      </div>
    </div>
  );
}