import Link from "next/link";

type GameCardProps = {
  href: string;
  title: string;
  description: string;
};

export function GameCard({ href, title, description }: GameCardProps) {
  return (
    <Link href={href} className="game-card">
      <div className="game-card-art">
        <span>RAVE</span>
      </div>
      <div>
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
    </Link>
  );
}
