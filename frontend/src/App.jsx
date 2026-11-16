import { useEffect, useState } from "react";
import "./App.css";

// A setup check: shows whether the browser can reach the API and the database
function App() {
  const [status, setStatus] = useState("checking");

  useEffect(() => {
    fetch("/api/v1/health")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((body) => setStatus(body.data.database === "ok" ? "ok" : "down"))
      .catch(() => setStatus("down"));
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 p-4 text-slate-100">
      <div className="rounded-2xl border border-slate-800 bg-slate-900 px-8 py-6 text-center">
        <h1 className="text-2xl font-semibold">World Quiz</h1>
        <p className="mt-2 text-slate-400">
          API and database:{" "}
          <span className={status === "ok" ? "text-emerald-400" : "text-amber-400"}>{status}</span>
        </p>
      </div>
    </main>
  );
}

export default App;
