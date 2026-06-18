import Link from "next/link";
import { WinTitleBar } from "@/components/WinTitleBar";

type GameCardProps = {
  href: string;
  title: string;
  description: string;
  avatarSrc?: string;
  windowTitle?: string;
};

export function GameCard({
  href,
  title,
  description,
  avatarSrc = "/slot/images/high1.svg",
  windowTitle,
}: GameCardProps) {
  return (
    <Link href={href} className="game-card win-window">
      <WinTitleBar title={windowTitle ?? `${title}.exe`} />
      <div className="win-body game-card-body">
        <div className="game-card-art">
          <img src={avatarSrc} alt="" className="game-card-avatar" />
        </div>
        <div className="game-card-copy">
          <h3>{title}</h3>
          <p>{description}</p>
          <span className="game-card-cta">Запустить →</span>
        </div>
      </div>
    </Link>
  );
}
