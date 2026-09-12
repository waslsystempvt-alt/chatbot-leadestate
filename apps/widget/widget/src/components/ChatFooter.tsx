interface ChatFooterProps {
  showInput: boolean;
  showContact: boolean;
  textValue: string;
  nameValue: string;
  phoneValue: string;
  sendDisabled: boolean;
  inputPlaceholder: string;
  onTextChange: (v: string) => void;
  onNameChange: (v: string) => void;
  onPhoneChange: (v: string) => void;
  onSend: () => void;
  onContactSubmit: () => void;
}

export function ChatFooter({
  showInput,
  showContact,
  textValue,
  nameValue,
  phoneValue,
  sendDisabled,
  inputPlaceholder,
  onTextChange,
  onNameChange,
  onPhoneChange,
  onSend,
  onContactSubmit,
}: ChatFooterProps) {
  return (
    <div className="chat-footer">
      <div className="chat-controls">
        <div className="hb-actions-name">
          <div className="input-bottom">
            <div className={`input-row ${showInput ? "" : "hidden"}`}>
              <input
                className="input chat-elements"
                type="text"
                placeholder={inputPlaceholder}
                value={textValue}
                onChange={(e) => onTextChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    onSend();
                  }
                }}
              />
              <button
                className="btn primary send-btn"
                type="button"
                title="Send message"
                disabled={sendDisabled}
                onClick={onSend}
                aria-label="Send"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M5 12h12m0 0l-4-4m4 4l-4 4"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
            <div className={`contact-row ${showContact ? "" : "hidden"}`}>
              <input
                className="input"
                type="text"
                placeholder="Enter Your name"
                value={nameValue}
                onChange={(e) => onNameChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.preventDefault();
                }}
              />
              <input
                className="input"
                type="tel"
                placeholder="Enter Your Mobile Number"
                value={phoneValue}
                onChange={(e) => onPhoneChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") onContactSubmit();
                }}
              />
              <button className="btn primary" type="button" onClick={onContactSubmit}>
                Submit
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
