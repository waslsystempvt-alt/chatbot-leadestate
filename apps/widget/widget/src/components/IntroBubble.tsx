interface IntroBubbleProps {
  line1: string;
  line2: string;
  avatarSrc: string;
  avatarAlt: string;
  onAvatarLoad?: () => void;
}

export function IntroBubble({ line1, line2, avatarSrc, avatarAlt, onAvatarLoad }: IntroBubbleProps) {
  return (
    <div className="intro-bubble-wrap">
      <img
        className="message-avatar"
        src={avatarSrc}
        alt={avatarAlt}
        onLoad={onAvatarLoad}
      />
      <div className="intro-bubble">
        <div className="intro-text">
          <span>{line1}</span>
          <span>{line2}</span>
        </div>
        <span className="intro-time">Just now</span>
      </div>
    </div>
  );
}
