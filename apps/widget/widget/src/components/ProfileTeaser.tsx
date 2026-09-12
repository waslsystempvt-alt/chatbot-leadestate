interface ProfileTeaserProps {
  avatarSrc: string;
  avatarAlt: string;
  ariaLabel: string;
  onOpen: () => void;
}

export function ProfileTeaser({ avatarSrc, avatarAlt, ariaLabel, onOpen }: ProfileTeaserProps) {
  return (
    <div
      className="profile-teaser"
      role="button"
      tabIndex={0}
      aria-label={ariaLabel}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
    >
      <div className="profile-teaser-avatar-stack">
        <div className="profile-avatar-wrap">
          <img src={avatarSrc} alt={avatarAlt} />
        </div>
        <span className="profile-live-dot" aria-hidden="true" />
      </div>
      <div className="profile-teaser-copy">
        <span className="profile-teaser-title">Chat with us</span>
        <span className="profile-teaser-sub">Expert help in minutes</span>
      </div>
    </div>
  );
}
