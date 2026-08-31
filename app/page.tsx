import Link from "next/link";
import { GameCard } from "@/components/GameCard";

export default function HomePage() {
  return (
    <main>
      <section className="hero-section">
        <div className="hero-glow hero-glow-one" />
        <div className="hero-glow hero-glow-two" />
        <div className="hero-content">
          <p className="eyebrow">Das xBoot Casino</p>
          <h1>Казино с Das xBoot — баланс в аккаунте</h1>
          <p className="hero-copy">
            Авторизуйся, пополни баланс и запускай Das xBoot (Red Devil) прямо на
            сайте. xWays, xNudge и бонусные раунды.
          </p>
          <div className="hero-actions">
            <Link href="/play/xboot" className="primary-btn">
              Играть в Das xBoot
            </Link>
            <a href="#games" className="secondary-btn">
              Смотреть игры
            </a>
          </div>
        </div>
      </section>

      <section className="games-section" id="games">
        <div className="section-heading">
          <p className="eyebrow">Games</p>
          <h2>Доступные игры</h2>
        </div>
        <div className="games-grid">
          <GameCard
            href="/play/xboot"
            title="Das xBoot"
            description="Red Devil: барабаны 2-3-4-4-3-2, xWays и xNudge, подводная тема."
          />
        </div>
      </section>

      <footer className="site-footer">
        <span>Das xBoot Casino</span>
        <span>Играйте ответственно. Это тестовая платформа.</span>
      </footer>
    </main>
  );
}
