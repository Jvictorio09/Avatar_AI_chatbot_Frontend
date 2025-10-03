// src/components/UI.jsx
import { useEffect, useRef, useState } from "react";
import { useChat } from "../hooks/useChat";
import AvatarStage from "../components/AvatarStage";
import { Mic, MicOff, PanelRight, Square } from "lucide-react";

export const UI = ({ hidden }) => {
  const { chat, loading, cameraZoomed, setCameraZoomed, message } = useChat();

  // controlled input
  const [inputValue, setInputValue] = useState("");
  const [history, setHistory] = useState([]);
  const lastAssistantRef = useRef(null);

  // mic state
  const [isListening, setIsListening] = useState(false);
  const [micError, setMicError] = useState("");
  const [interim, setInterim] = useState("");
  const recognitionRef = useRef(null);

  // desktop layout toggle: 'rail' | 'centered'
  const [layout, setLayout] = useState("centered");

  const isBusy = loading || !!message;
  if (hidden) return null;

  const sendMessage = () => {
    const text = (inputValue + " " + (interim || "")).trim();
    if (!text || isBusy) return;
    setHistory((h) => [...h, { role: "user", text, ts: Date.now() }]);
    chat(text);
    setInputValue("");
    setInterim("");
    stopListening();
  };

  // capture assistant messages
  useEffect(() => {
    const assistantText = message?.text?.trim();
    if (!assistantText) return;
    if (lastAssistantRef.current === assistantText) return;
    setHistory((h) => [...h, { role: "assistant", text: assistantText, ts: Date.now() }]);
    lastAssistantRef.current = assistantText;
  }, [message]);

  // init speech recognition
  useEffect(() => {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition || null;
    if (SpeechRec) {
      const rec = new SpeechRec();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = "en-US";
      rec.onresult = (e) => {
        let finals = [];
        let inter = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const r = e.results[i];
          if (r.isFinal) finals.push(r[0].transcript);
          else inter += r[0].transcript;
        }
        if (finals.length) setInputValue((v) => (v + " " + finals.join(" ")).trim());
        setInterim(inter.trim());
      };
      rec.onerror = (e) => {
        setMicError(e.error || "speech-error");
        stopListening();
      };
      rec.onend = () => setIsListening(false);
      recognitionRef.current = rec;
    }
    return () => stopListening();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startListening = () => {
    setMicError("");
    try {
      recognitionRef.current && recognitionRef.current.start();
      setIsListening(true);
    } catch {
      setIsListening(true);
    }
  };
  const stopListening = () => {
    try { recognitionRef.current && recognitionRef.current.stop(); } catch {}
    setIsListening(false);
  };

  return (
    <>
      <style>{`
        :root{ --ink:#0B0F1A; --bone:#F7F5F1; --blue:#1A66FF; --blue-ink:#0D2B66; }
        .bubble{ box-shadow: 0 1px 0 rgba(0,0,0,.06), 0 12px 24px rgba(0,0,0,.10), inset 0 1px 0 rgba(255,255,255,.35); }
        .user{ background: linear-gradient(135deg, var(--blue), #3D8BFF); color:#fff; }
        .assistant{ background: linear-gradient(180deg, #fff, var(--bone)); color:var(--ink); border:1px solid rgba(13,43,102,.10); }
        .assistant--airy{ background: rgba(255,255,255,.86); color: var(--ink); border: none; }
        .mic-ring{ animation: pulse 1.6s infinite; box-shadow: 0 0 0 0 rgba(26,102,255,.45); }
        @keyframes pulse{ 0%{ box-shadow: 0 0 0 0 rgba(26,102,255,.45);} 70%{ box-shadow: 0 0 0 14px rgba(26,102,255,0);} 100%{ box-shadow: 0 0 0 0 rgba(26,102,255,0);} }
      `}</style>

      {/* Steve behind everything on desktop */}
      <div className="hidden md:block fixed inset-0 z-0 pointer-events-none">
        <AvatarStage className="absolute inset-0" />
      </div>

      {/* ===================== Mobile: avatar FULL-SCREEN + transparent chat overlay ===================== */}
      <div className="md:hidden fixed inset-0 z-[9999] pointer-events-none">
        {/* Avatar full-screen as the background */}
        <AvatarStage className="absolute inset-0 -z-10 pointer-events-none" />

        {/* Label pinned OVER the avatar (left/top) */}
        <div className="absolute top-3 left-4 z-20 pointer-events-none">
          <div className="text-[10px] uppercase tracking-[.38em] text-[var(--blue-ink)]/60">ASSISTANT</div>
          <div className="text-sm font-semibold text-[var(--ink)]/90">Steve • AI Assistant</div>
        </div>

        {/* Zoom button on top of canvas */}
        <button
          onClick={() => setCameraZoomed(!cameraZoomed)}
          className="absolute top-3 right-3 z-[10000] w-10 h-10 rounded-full bg-white/90 border border-black/10 shadow-lg grid place-items-center pointer-events-auto"
          title={cameraZoomed ? "Zoom out" : "Zoom in"}
          aria-label="Toggle zoom"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-4.7-4.7M13.5 10.5h-6m8-3a6 6 0 11-12 0 6 6 0 0112 0z" />
          </svg>
        </button>

        {/* Chat column over the avatar */}
        <div className="absolute inset-x-0 bottom-0 pointer-events-auto">
          {/* messages */}
          <div className="max-h-[48vh] overflow-y-auto px-4 pb-3 space-y-3">
            {history.length === 0 && (
              <div
                className="inline-block max-w-[86%] px-4 py-3 rounded-2xl"
                style={{
                  backdropFilter: "blur(12px)",
                  background: "rgba(255,255,255,0.78)",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.3)"
                }}
              >
                Hello! How can I help you?
              </div>
            )}
            {history.map((m, i) => (
              <div key={`${m.ts}-${i}`} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[86%] px-4 py-3 rounded-2xl ${m.role === "user" ? "user bubble rounded-br-md" : ""}`}
                  style={
                    m.role === "assistant"
                      ? {
                          backdropFilter: "blur(12px)",
                          background: "rgba(255,255,255,0.78)",
                          boxShadow:
                            "0 4px 12px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.3)",
                        }
                      : undefined
                  }
                >
                  {m.text}
                </div>
              </div>
            ))}
            {!!interim && isListening && (
              <div className="flex justify-end">
                <div className="user bubble rounded-2xl max-w-[86%] px-4 py-2">{interim}</div>
              </div>
            )}
          </div>

          {/* input bar */}
          <div className="px-3 pb-[env(safe-area-inset-bottom)] pb-4">
            <div className="rounded-full border border-black/10 bg-white/85 backdrop-blur px-3 py-2.5 flex items-center gap-2 shadow-lg">
              <button
                type="button"
                onClick={isListening ? stopListening : startListening}
                className={`h-10 w-10 rounded-full grid place-items-center 
                  ${isListening ? "bg-[var(--blue)] text-white mic-ring" : "bg-white/95 text-[var(--blue-ink)] border border-black/10"}`}
                aria-label="Microphone"
              >
                {isListening ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
              </button>
              <input
                value={isListening ? (inputValue + " " + (interim || "")).trim() : inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={isListening ? "Listening…" : "Ask me anything…"}
                className="flex-1 bg-transparent outline-none text-[16px]"
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                disabled={isBusy}
              />
              <button
                onClick={sendMessage}
                disabled={isBusy}
                className={`h-11 w-11 rounded-full grid place-items-center 
                  ${isBusy ? "bg-gray-300" : "bg-[var(--blue)] text-white"}`}
                aria-label="Send"
              >
                ➤
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ===================== Desktop: toggle between rail and centered ===================== */}
      {layout === "rail" ? (
        /* ---- Right Rail (original desktop) ---- */
        <div className="hidden md:block pointer-events-none fixed inset-y-0 right-0 w-[min(380px,88vw)] pr-6 z-[9998]">
          <div
            className="h-full rounded-l-3xl pointer-events-auto flex flex-col overflow-hidden"
            style={{
              backdropFilter: "blur(18px)",
              background: "linear-gradient(180deg, rgba(255,255,255,.70), rgba(255,255,255,.55))",
              borderLeft: "1px solid rgba(13,43,102,.10)",
              boxShadow: "-4px 0 24px rgba(0,0,0,.08), inset 1px 0 0 rgba(255,255,255,.35)",
            }}
          >
            {/* header */}
            <div className="px-4 pt-4 pb-2 flex items-center justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-[.38em] text-[var(--blue-ink)]/60">ASSISTANT</div>
                <div className="text-sm font-semibold text-[var(--ink)]/80">Conversation</div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setLayout("centered")}
                  className="h-8 w-8 rounded-full grid place-items-center bg-white/80 border border-black/10"
                  title="Switch to centered"
                  aria-label="Switch to centered"
                >
                  <Square className="w-4 h-4" />
                </button>
                <span className={`text-[11px] ${isListening ? "text-[var(--blue)]" : "text-black/50"}`}>
                  {isListening ? "Listening…" : "Tap mic"}
                </span>
              </div>
            </div>

            {/* messages */}
            <div className="flex-1 overflow-y-auto px-4 pb-2 space-y-3">
              {history.map((m, i) => (
                <div key={`${m.ts}-${i}`} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`bubble max-w-[86%] px-4 py-3 rounded-2xl 
                    ${m.role === "user" ? "user rounded-br-md" : "assistant rounded-bl-md"}`}>
                    {m.text}
                  </div>
                </div>
              ))}
              {!!interim && isListening && (
                <div className="flex justify-end">
                  <div className="bubble user rounded-2xl max-w-[86%] px-4 py-2">{interim}</div>
                </div>
              )}
            </div>

            {/* input */}
            <div className="px-4 pt-1 pb-4">
              <div className="rounded-full border bg-white/80 backdrop-blur px-3 py-2.5 flex items-center gap-2">
                <button
                  onClick={isListening ? stopListening : startListening}
                  className={`h-10 w-10 rounded-full grid place-items-center 
                    ${isListening ? "bg-[var(--blue)] text-white mic-ring" : "bg-white text-[var(--blue-ink)] border"}`}
                  aria-label="Microphone"
                >
                  {isListening ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
                </button>
                <input
                  value={isListening ? (inputValue + " " + (interim || "")).trim() : inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder={isListening ? "Listening…" : "Ask me anything…"}
                  className="flex-1 bg-transparent outline-none text-[15px]"
                  onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                />
                <button
                  onClick={sendMessage}
                  disabled={isBusy}
                  className={`h-10 w-10 rounded-full grid place-items-center 
                    ${isBusy ? "bg-gray-300" : "bg-[var(--blue)] text-white"}`}
                  aria-label="Send"
                >
                  ➤
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ---- Centered Overlay (desktop; matches mobile vibe but with header) ---- */
        <div className="hidden md:flex fixed inset-0 z-[9998] pointer-events-none items-end justify-center">
          {/* glass header pinned over the avatar */}
          <div
            className="fixed top-4 left-1/2 -translate-x-1/2 z-[10000] w-[min(680px,92vw)]
                       rounded-2xl px-4 py-2 flex items-center justify-between pointer-events-auto"
            style={{
              backdropFilter: "blur(14px)",
              background: "rgba(255,255,255,.70)",
              boxShadow: "0 8px 24px rgba(0,0,0,.10), inset 0 1px 0 rgba(255,255,255,.45)",
              border: "1px solid rgba(13,43,102,.10)",
            }}
          >
            <div>
              <div className="text-[10px] uppercase tracking-[.38em] text-[var(--blue-ink)]/60">ASSISTANT</div>
              <div className="text-base font-semibold text-[var(--ink)]/90">Conversation</div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-[12px] ${isListening ? "text-[var(--blue)]" : "text-black/50"}`}>
                {isListening ? "Listening…" : "Tap mic"}
              </span>
              <button
                onClick={() => setLayout("rail")}
                className="h-9 w-9 rounded-full grid place-items-center bg-white/90 border border-black/10"
                title="Switch to right rail"
                aria-label="Switch to right rail"
              >
                <PanelRight className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* chat column */}
          <div className="pointer-events-auto w-[min(720px,94vw)] mx-auto pb-[max(24px,env(safe-area-inset-bottom))]">
            <div className="max-h-[54vh] overflow-y-auto px-4 pt-[88px] pb-3 space-y-3">
              {history.length === 0 && (
                <div className="assistant bubble rounded-2xl px-4 py-3 text-[14.5px]">
                  Hello! How can I help you?
                </div>
              )}
              {history.map((m, i) => (
                <div key={`${m.ts}-${i}`} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`bubble max-w-[86%] px-4 py-3 rounded-2xl ${
                      m.role === "user" ? "user rounded-br-md" : "assistant rounded-bl-md"
                    }`}
                  >
                    {m.text}
                  </div>
                </div>
              ))}
              {!!interim && isListening && (
                <div className="flex justify-end">
                  <div className="bubble user rounded-2xl max-w-[86%] px-4 py-2">{interim}</div>
                </div>
              )}
            </div>

            <div className="px-3">
              <div className="rounded-full border border-black/10 bg-white/90 backdrop-blur px-3 py-2.5 flex items-center gap-2 shadow-lg">
                <button
                  onClick={isListening ? stopListening : startListening}
                  className={`h-10 w-10 rounded-full grid place-items-center 
                    ${isListening ? "bg-[var(--blue)] text-white mic-ring" : "bg-white text-[var(--blue-ink)] border"}`}
                  aria-label="Microphone"
                >
                  {isListening ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
                </button>
                <input
                  value={isListening ? (inputValue + " " + (interim || "")).trim() : inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder={isListening ? "Listening…" : "Ask me anything…"}
                  className="flex-1 bg-transparent outline-none text-[15px]"
                  onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                  disabled={isBusy}
                />
                <button
                  onClick={sendMessage}
                  disabled={isBusy}
                  className={`h-10 w-10 rounded-full grid place-items-center 
                    ${isBusy ? "bg-gray-300" : "bg-[var(--blue)] text-white"}`}
                  aria-label="Send"
                >
                  ➤
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
