import { useEffect, useRef, useState } from "react";
import { useChat } from "../hooks/useChat";

export const UI = ({ hidden }) => {
  const input = useRef(null);
  const { chat, loading, cameraZoomed, setCameraZoomed, message } = useChat();

  // local transcript (simple)
  const [history, setHistory] = useState([]);
  const lastAssistantRef = useRef(null);

  const sendMessage = () => {
    const text = (input.current?.value || "").trim();
    if (!text || loading || message) return;

    setHistory((h) => [...h, { role: "user", text, ts: Date.now() }]);
    chat(text);
    input.current.value = "";
  };

  // log assistant message once when a new one starts playing
  useEffect(() => {
    const assistantText = message?.text?.trim();
    if (!assistantText) return;
    if (lastAssistantRef.current === assistantText) return;

    setHistory((h) => [...h, { role: "assistant", text: assistantText, ts: Date.now() }]);
    lastAssistantRef.current = assistantText;
  }, [message]);

  if (hidden) return null;
  const isBusy = loading || !!message;

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col justify-between p-4 pointer-events-none">
      {/* Top-right controls */}
      <div className="flex justify-end gap-3">
        <button
          onClick={() => setCameraZoomed(!cameraZoomed)}
          className="pointer-events-auto w-10 h-10 rounded-full bg-white/90 backdrop-blur shadow flex items-center justify-center hover:bg-white"
          title={cameraZoomed ? "Zoom out" : "Zoom in"}
          aria-label="Toggle camera zoom"
        >
          {cameraZoomed ? (
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-4.7-4.7M10.5 7.5v6M13.5 10.5h-6m8-2a6 6 0 11-12 0 6 6 0 0112 0z" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-4.7-4.7M13.5 10.5h-6m8-3a6 6 0 11-12 0 6 6 0 0112 0z" />
            </svg>
          )}
        </button>

        <button
          onClick={() => document.body.classList.toggle("greenScreen")}
          className="pointer-events-auto w-10 h-10 rounded-full bg-white/90 backdrop-blur shadow flex items-center justify-center hover:bg-white"
          title="Toggle green screen"
          aria-label="Toggle green screen"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M3 5a2 2 0 012-2h14a2 2 0 012 2v11a2 2 0 01-2 2h-5l2 2H8l2-2H5a2 2 0 01-2-2V5z" />
          </svg>
        </button>
      </div>

      {/* Transcript + input */}
      <div className="pointer-events-auto w-full max-w-xl mx-auto flex flex-col gap-2">
        {/* Transcript */}
        <div className="bg-white/80 backdrop-blur rounded-2xl shadow border border-blue-200/60 max-h-[40vh] overflow-y-auto px-3 py-2">
          {history.length === 0 ? (
            <div className="text-sm text-gray-600 p-2">No messages yet. Say hi 👋</div>
          ) : (
            <ul className="space-y-2">
              {history.map((m, i) => (
                <li
                  key={`${m.ts}-${i}`}
                  className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm ${
                      m.role === "user"
                        ? "bg-blue-600 text-white rounded-br-sm"   // <-- powerful blue
                        : "bg-white text-gray-900 border border-blue-100 rounded-bl-sm"
                    }`}
                  >
                    {m.text}
                  </div>
                </li>
              ))}
              {isBusy && (
                <li className="flex justify-start">
                  <div className="bg-white text-gray-600 border border-blue-100 px-3 py-2 rounded-2xl text-sm">
                    {message ? "Speaking…" : "Typing…"}
                  </div>
                </li>
              )}
            </ul>
          )}
        </div>

        {/* Input bar */}
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-white/90 backdrop-blur border border-blue-400 rounded-full shadow px-4 py-2 focus-within:ring-2 focus-within:ring-blue-500">
            <input
              ref={input}
              placeholder="Ask me anything..."
              className="w-full bg-transparent outline-none text-gray-900 placeholder:text-gray-500 py-2"
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              disabled={isBusy}
            />
          </div>

          <button
            onClick={sendMessage}
            disabled={isBusy}
            className={`w-12 h-12 rounded-full flex items-center justify-center shadow ${
              isBusy ? "bg-gray-300 cursor-not-allowed" : "bg-blue-600 text-white hover:bg-blue-700"
            }`}
            aria-label="Send"
            title="Send"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        <div className="text-xs text-gray-700 mt-1 px-2">
          {isBusy ? "Speaking…" : "Press Enter to send"}
        </div>
      </div>
    </div>
  );
};
