interface IntroPopupProps {
  visible: boolean;
  title: string;
  onClose: (e: React.MouseEvent) => void;
  onLetsChat: () => void;
}

export function IntroPopup({ visible, title, onClose, onLetsChat }: IntroPopupProps) {
  return (
    <div
      className={`chat-intro-popup ${visible ? "" : "hidden"}`}
      role="dialog"
      aria-labelledby="chatIntroPopupTitle"
      aria-hidden={!visible}
    >
      <button
        type="button"
        className="chat-intro-popup-close"
        aria-label="Close"
        onClick={onClose}
      >
        ×
      </button>
      <h2 id="chatIntroPopupTitle" className="chat-intro-popup-title">
        {title}
      </h2>
      <p className="chat-intro-popup-sub">How can I help you?</p>
      <button type="button" className="chat-intro-popup-cta" onClick={onLetsChat}>
        Let&apos;s Chat
      </button>
    </div>
  );
}
