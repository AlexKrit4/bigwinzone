type WinTitleBarProps = {
  title: string;
};

export function WinTitleBar({ title }: WinTitleBarProps) {
  return (
    <div className="win-titlebar">
      <span className="win-titlebar-icon" aria-hidden="true" />
      <span className="win-titlebar-text">{title}</span>
      <div className="win-titlebar-buttons" aria-hidden="true">
        <span className="win-chrome-btn">_</span>
        <span className="win-chrome-btn">□</span>
        <span className="win-chrome-btn win-chrome-btn--close">×</span>
      </div>
    </div>
  );
}
