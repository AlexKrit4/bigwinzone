import Link from "next/link";
import { GameCard } from "@/components/GameCard";

export default function HomePage() {
  return (
    <main>
      <section className="hero-section">
        <div className="hero-glow hero-glow-one" />
        <div className="hero-glow hero-glow-two" />
        <div className="hero-content">
          <p className="eyebrow">Rave Casino</p>
          <h1>Казино в неоне, где твой баланс живет в аккаунте</h1>
          <p className="hero-copy">
            Авторизуйся, пополни тестовый баланс и запускай Rave Slot прямо на
            сайте. Игра остается статикой, а деньги хранятся на сервере.
          </p>
          <div className="hero-actions">
            <Link href="/play/rave" className="primary-btn">
              Играть в Rave
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
            href="/play/rave"
            title="Rave Slot"
            description="xWays, бонусные окошки, split wilds и рейвовая Big Win презентация."
          />
          <GameCard
            href="/play/xboot"
            title="Red Devil"
            description="Das xBoot-style: барабаны 2-3-4-4-3-2, xWays и xNudge, подводная тема."
          />
          <GameCard
            href="/play/newslot"
            title="New Slot"
            description="Новый слот в разработке. Серверный баланс уже подключён — правила игры скоро."
          />
        </div>
      </section>

      <footer className="site-footer">
        <span>Rave Casino MVP</span>
        <span>Играйте ответственно. Это тестовая платформа.</span>
      </footer>
    </main>
  );
}
