import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChatConfig } from "../lib/config";
import { buildBotCopy, normalizePrimaryHex } from "../lib/config";
import {
  BOT_REPLY_DELAY_MS,
  type ChatAnswers,
  type ChatMessage,
  type ChatStage,
} from "../lib/constants";
import { applyProjectTheme, avatarFallbackDataUrl } from "../lib/theme";
import { isValidIndianPhone, isValidLeadName, normalizeIndianMobile } from "../lib/validation";
import { useLeadSubmit } from "../hooks/useLeadSubmit";
import { useMobileLayout } from "../hooks/useMobileLayout";
import { ChatFooter } from "./ChatFooter";
import { IntroPopup } from "./IntroPopup";
import { MessageList } from "./MessageList";
import { OptionsPanel, type OptionsVariant } from "./OptionsPanel";
import { ProfileTeaser } from "./ProfileTeaser";

export interface ChatWidgetProps {
  config: ChatConfig;
  embedded?: boolean;
}

let msgId = 0;
function nextId() {
  return `m-${++msgId}`;
}

export function ChatWidget({ config: cfg, embedded = false }: ChatWidgetProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const agentName = cfg.agentName || cfg.brokerName;
  const brokerLabel = cfg.brokerName || cfg.projectName;
  const botCopy = useMemo(() => buildBotCopy(agentName, brokerLabel), [agentName, brokerLabel]);
  const mobileLayout = useMobileLayout(embedded);

  const [chatOpen, setChatOpen] = useState(false);
  const [introPopupVisible, setIntroPopupVisible] = useState(false);
  const [introPopupDismissed, setIntroPopupDismissed] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [stage, setStage] = useState<ChatStage>("idle");
  const [answers, setAnswers] = useState<ChatAnswers>({
    intent: "",
    configuration: "",
    name: "",
    phone: "",
  });
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [typing, setTyping] = useState(false);
  const [optionsVariant, setOptionsVariant] = useState<OptionsVariant>(null);
  const [optionsDismissing, setOptionsDismissing] = useState(false);
  const [showTextInput, setShowTextInput] = useState(false);
  const [showContact, setShowContact] = useState(false);
  const [textValue, setTextValue] = useState("");
  const [nameValue, setNameValue] = useState("");
  const [phoneValue, setPhoneValue] = useState("");
  const [inputPlaceholder, setInputPlaceholder] = useState("Type your message...");
  const [scrollMode, setScrollMode] = useState<"bottom" | "top">("bottom");
  const [avatarSrc, setAvatarSrc] = useState(cfg.agentAvatar);

  const { submitLead } = useLeadSubmit(cfg);

  useEffect(() => {
    const el = rootRef.current;
    if (el) applyProjectTheme(el, cfg.theme);
  }, [cfg.theme]);

  useEffect(() => {
    setAvatarSrc(cfg.agentAvatar);
  }, [cfg.agentAvatar]);

  const resolveAvatar = useCallback(() => {
    const brand = normalizePrimaryHex(cfg.theme?.primary) || "#2563eb";
    setAvatarSrc(avatarFallbackDataUrl(agentName, brand));
  }, [cfg.theme?.primary, agentName]);

  const addMessage = useCallback((text: string, sender: "bot" | "user") => {
    setMessages((prev) => [...prev, { id: nextId(), text, sender }]);
    setScrollMode("bottom");
  }, []);

  const botReply = useCallback(
    (text: string, callback?: () => void, delayMs = BOT_REPLY_DELAY_MS) => {
      setTyping(true);
      setScrollMode("bottom");
      setTimeout(() => {
        setTyping(false);
        addMessage(text, "bot");
        callback?.();
      }, delayMs);
    },
    [addMessage]
  );

  const addBotMessagesInstant = useCallback(
    (texts: string[]) => {
      texts.forEach((text) => addMessage(text, "bot"));
    },
    [addMessage]
  );

  const clearControls = useCallback(() => {
    setOptionsVariant(null);
    setOptionsDismissing(false);
    setShowTextInput(false);
    setShowContact(false);
    setTextValue("");
    setNameValue("");
    setPhoneValue("");
  }, []);

  const dismissOptions = useCallback(() => {
    if (!optionsVariant) return;
    setOptionsDismissing(true);
    setTimeout(() => {
      setOptionsVariant(null);
      setOptionsDismissing(false);
      setScrollMode("bottom");
    }, 220);
  }, [optionsVariant]);

  const askPrimaryIntent = useCallback(() => {
    clearControls();
    setStage("await_intent");
    setOptionsVariant("cta-grid");
    setShowTextInput(true);
    setInputPlaceholder("Type your message...");
    setScrollMode("top");
  }, [clearControls]);

  const moveToConfiguration = useCallback(() => {
    clearControls();
    setStage("await_configuration");
    setOptionsVariant("config-grid");
    setShowTextInput(true);
    setInputPlaceholder("Pick your preferred size");
    setScrollMode("bottom");
  }, [clearControls]);

  const moveToContact = useCallback(() => {
    clearControls();
    setStage("await_contact");
    setShowContact(true);
    setScrollMode("bottom");
  }, [clearControls]);

  const startConversation = useCallback(() => {
    if (hasStarted) return;
    setHasStarted(true);
    askPrimaryIntent();
  }, [hasStarted, askPrimaryIntent]);

  const openChat = useCallback(() => {
    setIntroPopupVisible(false);
    setChatOpen(true);
    requestAnimationFrame(() => {
      startConversation();
    });
  }, [startConversation]);

  const closeChat = useCallback(() => {
    setChatOpen(false);
  }, []);

  const showIntroPopup = useCallback(() => {
    if (introPopupDismissed || chatOpen) return;
    setIntroPopupVisible(true);
  }, [introPopupDismissed, chatOpen]);

  useEffect(() => {
    const delay = Number(cfg.autoOpenDelayMs);
    if (Number.isFinite(delay) && delay > 0) {
      const t = setTimeout(showIntroPopup, delay);
      return () => clearTimeout(t);
    }
  }, [cfg.autoOpenDelayMs, showIntroPopup]);

  const handleOptionSelect = useCallback(
    (option: string) => {
      const clean = String(option || "").trim();
      if (!clean) return;
      dismissOptions();
      addMessage(clean, "user");

      if (stage === "await_intent") {
        setAnswers((a) => ({ ...a, intent: clean }));
        botReply(botCopy.actionAck, () => {
          botReply(botCopy.askConfig, moveToConfiguration);
        });
        return;
      }
      if (stage === "await_configuration") {
        setAnswers((a) => ({ ...a, configuration: clean }));
        botReply(botCopy.afterConfigAck, () => {
          botReply(botCopy.askNameFirst, moveToContact);
        });
      }
    },
    [
      stage,
      dismissOptions,
      addMessage,
      botReply,
      botCopy,
      moveToConfiguration,
      moveToContact,
    ]
  );

  const handleTextSubmit = useCallback(() => {
    const value = textValue.trim();
    if (!value) return;
    dismissOptions();
    addMessage(value, "user");
    setTextValue("");

    if (stage === "await_intent") {
      setAnswers((a) => ({ ...a, intent: value }));
      botReply(botCopy.actionAck, () => {
        botReply(botCopy.askConfig, moveToConfiguration);
      });
      return;
    }
    if (stage === "await_configuration") {
      setAnswers((a) => ({ ...a, configuration: value }));
      botReply(botCopy.afterConfigAck, () => {
        botReply(botCopy.askNameFirst, moveToContact);
      });
    }
  }, [
    textValue,
    stage,
    dismissOptions,
    addMessage,
    botReply,
    botCopy,
    moveToConfiguration,
    moveToContact,
  ]);

  const handleContactSubmit = useCallback(() => {
    const name = nameValue.trim();
    const phone = phoneValue.trim();
    if (!name) {
      botReply(botCopy.askNameFirst);
      return;
    }
    if (!isValidLeadName(name)) {
      botReply(botCopy.invalidName);
      return;
    }
    if (!isValidIndianPhone(phone)) {
      botReply(botCopy.invalidPhoneIndian);
      return;
    }
    const phoneDigits = normalizeIndianMobile(phone);
    setAnswers((a) => ({ ...a, name, phone: phoneDigits }));
    addMessage(`${name} | ${phoneDigits}`, "user");
    clearControls();
    setStage("submitting");
    setTyping(true);
    setScrollMode("bottom");

    submitLead(
      { ...answers, name, phone: phoneDigits },
      () => {
        setTyping(false);
        setStage("done");
        addBotMessagesInstant([
          botCopy.submitSuccessThanks,
          botCopy.submitSuccessDone,
        ]);
      },
      (hint) => {
        setTyping(false);
        setStage("done");
        addMessage(
          hint ? `${botCopy.submitFailure} — ${hint}` : botCopy.submitFailure,
          "bot"
        );
        setScrollMode("bottom");
      }
    );
  }, [
    nameValue,
    phoneValue,
    answers,
    botCopy,
    addMessage,
    addBotMessagesInstant,
    clearControls,
    submitLead,
  ]);

  const headerPhotoPosition = chatOpen && mobileLayout ? "center 30%" : "center 22%";

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    el.setAttribute("data-embedded", embedded ? "1" : "0");
    if (mobileLayout) el.setAttribute("data-mobile-chat-layout", "1");
    else el.removeAttribute("data-mobile-chat-layout");
    if (chatOpen && mobileLayout) el.setAttribute("data-chat-open", "1");
    else el.removeAttribute("data-chat-open");
  }, [embedded, mobileLayout, chatOpen]);

  return (
    <div
      ref={rootRef}
      id="leadestate-chat-root"
      className="leadestate-chat-root"
      data-embedded={embedded ? "1" : "0"}
    >
      <div className="widget-inner" style={{ pointerEvents: "auto" }}>
        <div className={`widget ${chatOpen ? "" : "hidden"}`}>
          <div className="chat-shell">
            <div className="chat-header">
              <div className="header-left">
                <div className="chat-header-photo-wrap">
                  <div
                    className="chat-header-photo"
                    style={{
                      backgroundImage: `url('${avatarSrc}')`,
                      backgroundPosition: headerPhotoPosition,
                    }}
                  />
                </div>
                <div className="chat-header-copy">
                  <div className="chat-header-name">{agentName}</div>
                  <p className="chat-header-sub">Online now</p>
                </div>
              </div>
              <button
                type="button"
                className="close-btn"
                aria-label="Close chat"
                onClick={closeChat}
              >
                ×
              </button>
            </div>
            <div className="chat-box-body">
              <div className="chat-box-overlay" />
              <div className="chat-logs">
                <div className="chat-container">
                  <div className="chat-messages-time">Today</div>
                  <MessageList
                    messages={messages}
                    showIntro={hasStarted}
                    introLine1={botCopy.intro}
                    introLine2={botCopy.help}
                    avatarSrc={avatarSrc}
                    avatarAlt={agentName}
                    typing={typing}
                    scrollMode={scrollMode}
                  />
                  <div className="chat-actions-container">
                    <OptionsPanel
                      variant={optionsVariant}
                      dismissing={optionsDismissing}
                      onSelect={handleOptionSelect}
                    />
                  </div>
                </div>
              </div>
            </div>
            <ChatFooter
              showInput={showTextInput}
              showContact={showContact}
              textValue={textValue}
              nameValue={nameValue}
              phoneValue={phoneValue}
              sendDisabled={!textValue.trim()}
              inputPlaceholder={inputPlaceholder}
              onTextChange={setTextValue}
              onNameChange={setNameValue}
              onPhoneChange={setPhoneValue}
              onSend={handleTextSubmit}
              onContactSubmit={handleContactSubmit}
            />
          </div>
        </div>

        {!chatOpen && (
          <div className="chat-launcher-stack">
            <IntroPopup
              visible={introPopupVisible}
              title={`Hey, I'm ${agentName}!`}
              onClose={(e) => {
                e.stopPropagation();
                setIntroPopupDismissed(true);
                setIntroPopupVisible(false);
              }}
              onLetsChat={openChat}
            />
            <ProfileTeaser
              avatarSrc={avatarSrc}
              avatarAlt={agentName}
              ariaLabel={`${agentName} from ${brokerLabel}. Tap to start chat.`}
              onOpen={openChat}
            />
          </div>
        )}
      </div>
      <img
        src={cfg.agentAvatar}
        alt=""
        aria-hidden
        style={{ display: "none" }}
        onError={resolveAvatar}
      />
    </div>
  );
}
