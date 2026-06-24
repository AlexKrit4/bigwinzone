import Link from "next/link";
import { GameCard } from "@/components/GameCard";
import { WinTitleBar } from "@/components/WinTitleBar";

export default function HomePage() {
  return (
    <main className="desktop-main">
      <section className="hero-section win-window">
        <WinTitleBar title="Добро пожаловать в BigWinZone.exe" />
        <div className="win-body hero-content">
          <p className="eyebrow">BIGWINZONE · BWZ Casino</p>
          <h1>Ваше любимое казино с душой Windows&nbsp;95</h1>
          <p className="hero-copy">
            Регистрируйтесь, пополняйте счёт и крутите слоты прямо в браузере.
            Бонусы, фриспины, wild-символы и крупные выигрыши — всё как в
            настоящем зале, только уютнее и без очереди у автомата.
          </p>
          <div className="hero-actions">
            <Link href="/play/rave" className="primary-btn">
              Играть сейчас
            </Link>
            <a href="#games" className="secondary-btn">
              Каталог игр
            </a>
          </div>
        </div>
      </section>

      <section className="games-section win-window" id="games">
        <WinTitleBar title="Каталог игр — Program Manager" />
        <div className="win-body">
          <div className="section-heading">
            <p className="eyebrow">Слоты BWZ</p>
            <h2>Выберите игру</h2>
          </div>
          <div className="games-grid">
            <GameCard
              href="/play/rave"
              title="Rave Slot"
              windowTitle="RaveSlot.exe"
              coverSrc="/slot/images/high1.png"
              description="Неоновый рейв: xWays расширяют барабаны, split wilds делят символы, бонусные раунды и Big Win-шоу на весь экран."
            />
            <GameCard
              href="/play/xboot"
              title="Red Devil"
              windowTitle="RedDevil.exe"
              coverSrc="/slot/games/xboot/images/high1.png"
              description="Подводная охота: xNudge-толчки, xWays, бонусы на 3 и 4 скаттера, торpeda-сборка и шанс на MAX WIN."
            />
            <GameCard
              href="/play/newslot"
              title="New Slot"
              windowTitle="NewSlot.exe"
              coverSrc="/slot/images/high1.png"
              description="Новый слот в разработке. Серверный баланс подключён — правила игры скоро."
            />
          </div>
        </div>
      </section>

      <footer className="site-footer">
        <span>BigWinZone (BWZ) · © 1995–2026</span>
        <span>Играйте ответственно. Только 18+.</span>
      </footer>
    </main>
  );
}
