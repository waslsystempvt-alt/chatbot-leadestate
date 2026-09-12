import { useEffect, useRef } from "react";
import type { ChatMessage } from "../lib/constants";
import { IntroBubble } from "./IntroBubble";

interface MessageListProps {
  messages: ChatMessage[];
  showIntro: boolean;
  introLine1: string;
  introLine2: string;
  avatarSrc: string;
  avatarAlt: string;
  typing: boolean;
  scrollMode: "bottom" | "top";
}

export function MessageList({
  messages,
  showIntro,
  introLine1,
  introLine2,
  avatarSrc,
  avatarAlt,
  typing,
  scrollMode,
}: MessageListProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    requestAnimationFrame(() => {
      if (scrollMode === "top") {
        el.scrollTop = 0;
        requestAnimationFrame(() => {
          el.scrollTop = 0;
        });
      } else {
        el.scrollTop = el.scrollHeight;
        requestAnimationFrame(() => {
          el.scrollTop = el.scrollHeight;
        });
      }
    });
  }, [messages, typing, showIntro, scrollMode]);

  return (
    <div ref={ref} className="chat-messages chat-messages-container">
      {showIntro && (
        <IntroBubble
          line1={introLine1}
          line2={introLine2}
          avatarSrc={avatarSrc}
          avatarAlt={avatarAlt}
          onAvatarLoad={() => {
            const el = ref.current;
            if (el) el.scrollTop = 0;
          }}
        />
      )}
      {messages.map((m) => (
        <div key={m.id} className={`message-row ${m.sender === "bot" ? "bot-row" : "user-row"}`}>
          {m.sender === "bot" && (
            <img className="message-avatar" src={avatarSrc} alt={avatarAlt} />
          )}
          <div className={`message ${m.sender}`}>
            {m.text}
            <span className="message-time">Just now</span>
          </div>
        </div>
      ))}
      {typing && (
        <div className="message-row bot-row" id="typingRow">
          <img className="message-avatar" src={avatarSrc} alt={avatarAlt} />
          <div className="message bot">
            <span className="typing">
              <span />
              <span />
              <span />
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
