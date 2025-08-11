"use client";

import Image from "next/image";
import { FiMic } from "react-icons/fi";
import { useEffect, useRef, useState } from "react";

type Message = {
  role: "user" | "assistant";
  text: string;
};

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [previewVersion, setPreviewVersion] = useState(0);
  const previewSigRef = useRef<string | null>(null);

  useEffect(() => {
    audioRef.current = new Audio();
  }, []);

  // Auto-refresh preview iframe when preview.html changes on disk
  useEffect(() => {
    let isMounted = true;
    const check = async () => {
      try {
        const res = await fetch("/preview.html", { method: "HEAD", cache: "no-store" });
        const etag = res.headers.get("etag");
        const lastModified = res.headers.get("last-modified");
        const sig = etag || lastModified || String(Date.now());
        if (isMounted && sig && sig !== previewSigRef.current) {
          previewSigRef.current = sig;
          setPreviewVersion((v) => v + 1);
        }
      } catch {}
    };
    // initial check and interval polling
    check();
    const id = window.setInterval(check, 2000);
    return () => {
      isMounted = false;
      window.clearInterval(id);
    };
  }, []);

  async function startRecording() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mediaRecorder = new MediaRecorder(stream, {
      mimeType: "audio/webm",
    });

    audioChunksRef.current = [];
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) audioChunksRef.current.push(e.data);
    };

    mediaRecorder.onstop = async () => {
      const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
      await handleSendAudio(audioBlob);
      stream.getTracks().forEach((t) => t.stop());
    };

    mediaRecorderRef.current = mediaRecorder;
    mediaRecorder.start();
    setIsRecording(true);
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  }

  async function handleSendAudio(blob: Blob) {
    setIsBusy(true);
    // Placeholders
    let userIdx = -1;
    let assistantIdx = -1;
    setMessages((prev) => {
      const next = [...prev];
      userIdx = next.push({ role: "user", text: "(voice) Transcribing..." }) - 1;
      assistantIdx = next.push({ role: "assistant", text: "Transcribing..." }) - 1;
      return next;
    });

    try {
      // 1) STT
      const sttForm = new FormData();
      const file = new File([blob], "input.webm", { type: "audio/webm" });
      sttForm.append("audio", file);
      const sttRes = await fetch("/api/stt", { method: "POST", body: sttForm });
      if (!sttRes.ok) throw new Error("STT failed");
      const sttData: { transcript: string } = await sttRes.json();

      setMessages((prev) => {
        const next = [...prev];
        if (userIdx >= 0 && userIdx < next.length) {
          next[userIdx] = { role: "user", text: sttData.transcript };
        }
        if (assistantIdx >= 0 && assistantIdx < next.length) {
          next[assistantIdx] = { role: "assistant", text: "Thinking..." };
        }
        return next;
      });

      // 2) Agent
      const agentRes = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: sttData.transcript }),
      });
      if (!agentRes.ok) throw new Error("Agent failed");
      const agentData: { text: string } = await agentRes.json();

      setMessages((prev) => {
        const next = [...prev];
        if (assistantIdx >= 0 && assistantIdx < next.length) {
          next[assistantIdx] = { role: "assistant", text: agentData.text };
        }
        return next;
      });

      // 3) TTS (do not block showing the assistant text)
      const ttsRes = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: agentData.text }),
      });
      if (ttsRes.ok) {
        const ttsData: { audioBase64: string; mimeType: string } = await ttsRes.json();
        if (audioRef.current) {
          const audioUrl = `data:${ttsData.mimeType};base64,${ttsData.audioBase64}`;
          audioRef.current.src = audioUrl;
          audioRef.current.play().catch(() => {});
        }
      }
    } catch (e) {
      setMessages((prev) => {
        const next = [...prev];
        if (assistantIdx >= 0 && assistantIdx < next.length) {
          next[assistantIdx] = { role: "assistant", text: "Error: request failed" };
        }
        return next;
      });
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <div className="min-h-screen p-4 sm:p-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[calc(100vh-2rem)]">
        {/* Left: Chat */}
        <div className="flex flex-col rounded-2xl overflow-hidden shadow-[0_10px_30px_rgba(0,0,0,0.08)] backdrop-blur-md border border-black/5 bg-white/70">
          <div className="px-5 py-4 border-b border-black/5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100">
                <Image src="/file.svg" alt="Assistant" width={16} height={16} className="opacity-80" />
              </span>
              <div className="leading-tight text-black">
                <h2 className="text-[15px] font-semibold tracking-tight text-black">Assistant</h2>
                <p className="text-xs text-black/70">STT → GPT-5 → TTS</p>
              </div>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-5 space-y-3">
            {messages.length === 0 ? (
              <div className="text-sm text-black/80">
                Tap the mic and describe the website you want to create.
              </div>
            ) : (
              <ul className="space-y-3">
                {messages.map((m, i) => (
                  <li key={i} className={m.role === "user" ? "text-right" : "text-left"}>
                    <span
                      className="inline-block px-3.5 py-2.5 rounded-2xl text-sm max-w-[85%] whitespace-pre-wrap break-words shadow-sm text-black"
                      style={{
                        background: m.role === "user" ? "#111827" : "#f3f4f6",
                        color: m.role === "user" ? "#ffffff" : "#111827",
                      }}
                    >
                      {m.text}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="px-5 py-8 border-t border-black/5 flex items-center gap-3">
            <button
              onClick={isRecording ? stopRecording : startRecording}
              className={`h-12 w-12 rounded-full flex items-center justify-center text-white shadow ${
                isRecording ? "bg-red-600 animate-pulse" : "bg-emerald-600 hover:bg-emerald-700"
              }`}
              aria-label={isRecording ? "Stop recording" : "Start recording"}
              disabled={isBusy}
              title={isBusy ? "Processing..." : undefined}
            >
              {isRecording ? "■" : <FiMic size={20} />}
            </button>
            <span className="text-sm text-black">
              {isRecording ? "Recording... Click to stop." : isBusy ? "Thinking..." : "Click to speak."}
            </span>
          </div>
        </div>

        {/* Right: Preview */}
        <div className="rounded-2xl overflow-hidden shadow-[0_10px_30px_rgba(0,0,0,0.08)] border border-black/5 bg-white/85 backdrop-blur">
          <div className="px-5 py-4 border-b border-black/5 flex items-center justify-between bg-white/60">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-amber-100">
                <Image src="/window.svg" alt="Preview" width={16} height={16} className="opacity-80" />
              </span>
              <h2 className="text-xl font-semibold tracking-tight text-black">Preview</h2>
            </div>
            <a
              href="/preview.html"
              target="_blank"
              rel="noreferrer"
              className="text-xs text-emerald-700 hover:underline"
            >
              Open in new tab
            </a>
          </div>
          <iframe
            title="Preview"
            src={`/preview.html?v=${previewVersion}`}
            className="w-full h-full min-h-[50vh] lg:min-h-[calc(100vh-6rem)] bg-white"
          />
        </div>
      </div>
    </div>
  );
}
