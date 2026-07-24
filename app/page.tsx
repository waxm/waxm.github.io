"use client";

import { useEffect, useMemo, useState } from "react";

type GameStatus = "live" | "soon";

interface Game {
  id: string;
  title: string;
  eyebrow: string;
  description: string;
  url: string;
  sourceUrl: string;
  status: GameStatus;
  tags: string[];
  accent: string;
  index: string;
}

const games: Game[] = [
  {
    id: "Game2048",
    title: "2048 竞技场",
    eyebrow: "数字吞噬 · 实时移动",
    description:
      "从一个小方块出发，收集数字、延伸轨迹，在圆形竞技场里与智能对手争夺最终排名。",
    url: "https://waxm.github.io/Work_AI/game2048/",
    sourceUrl: "https://github.com/waxm/Work_AI/tree/codex/2048-game",
    status: "live",
    tags: ["Cocos Creator", "2D Arena", "2048"],
    accent: "coral",
    index: "01",
  },
  {
    id: "Puzzle",
    title: "光影拼图",
    eyebrow: "经典拼图 · 轻量体验",
    description:
      "拖动碎片完成图像，在有限步数里寻找正确位置。适合随时打开、马上开始的一局小游戏。",
    url: "https://waxm.github.io/Work_AI/",
    sourceUrl: "https://github.com/waxm/Work_AI/tree/codex/puzzle",
    status: "live",
    tags: ["Cocos Creator", "Puzzle", "Portrait"],
    accent: "violet",
    index: "02",
  },
];

function getHashGameId(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  const hash = window.location.hash.replace(/^#/, "");
  return games.some((game) => game.id === hash) ? hash : null;
}

function ArenaPreview() {
  return (
    <div className="arena-preview" aria-hidden="true">
      <span className="arena-orbit orbit-one" />
      <span className="arena-orbit orbit-two" />
      <span className="arena-dot dot-one">2</span>
      <span className="arena-dot dot-two">8</span>
      <span className="arena-dot dot-three">4</span>
      <span className="arena-chain chain-one">16</span>
      <span className="arena-chain chain-two">8</span>
      <span className="arena-chain chain-three">4</span>
    </div>
  );
}

function PuzzlePreview() {
  return (
    <div className="puzzle-preview" aria-hidden="true">
      {Array.from({ length: 9 }, (_, index) => (
        <span
          className={`puzzle-piece puzzle-piece-${index + 1}`}
          key={index}
        />
      ))}
      <span className="puzzle-cursor" />
    </div>
  );
}

function GameCard({ game }: { game: Game }) {
  return (
    <article className={`game-card game-card-${game.accent}`}>
      <div className="card-topline">
        <span>{game.index}</span>
        <span className={`live-state live-state-${game.status}`}>
          <i />
          {game.status === "live" ? "可在线游玩" : "即将上线"}
        </span>
      </div>

      <a className="game-visual" href={`#${game.id}`} aria-label={`打开${game.title}`}>
        {game.id === "Game2048" ? <ArenaPreview /> : <PuzzlePreview />}
        <span className="visual-action">
          <span>PLAY</span>
          <strong>↗</strong>
        </span>
      </a>

      <div className="card-copy">
        <p>{game.eyebrow}</p>
        <h3>{game.title}</h3>
        <span>{game.description}</span>
      </div>

      <div className="card-footer">
        <div className="tag-list" aria-label="游戏标签">
          {game.tags.map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </div>
        <a href={game.sourceUrl} target="_blank" rel="noreferrer">
          源码
        </a>
      </div>
    </article>
  );
}

function GamePlayer({
  game,
  onClose,
}: {
  game: Game;
  onClose: () => void;
}) {
  return (
    <div className="player-shell" role="dialog" aria-modal="true">
      <header className="player-header">
        <button type="button" onClick={onClose} aria-label="返回游戏大厅">
          <span>←</span>
          返回大厅
        </button>
        <div>
          <span>{game.eyebrow}</span>
          <strong>{game.title}</strong>
        </div>
        <a
          href={game.status === "live" ? game.url : game.sourceUrl}
          target="_blank"
          rel="noreferrer"
        >
          {game.status === "live" ? "新窗口打开 ↗" : "查看开发分支 ↗"}
        </a>
      </header>
      <main className="player-stage">
        {game.status === "live" ? (
          <>
            <div className="device-frame">
              <iframe
                key={game.id}
                src={game.url}
                title={game.title}
                allow="autoplay; fullscreen"
              />
            </div>
            <p>如果游戏没有自动显示，请选择右上角“新窗口打开”。</p>
          </>
        ) : (
          <div className="coming-soon">
            <span>BUILD IN PROGRESS</span>
            <strong>正在准备网页版</strong>
            <p>2048 竞技场完成发布后，这个入口会直接加载游戏。</p>
          </div>
        )}
      </main>
    </div>
  );
}

export default function Home() {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    const updateSelectedGame = () => setSelectedId(getHashGameId());
    updateSelectedGame();
    window.addEventListener("hashchange", updateSelectedGame);
    return () => window.removeEventListener("hashchange", updateSelectedGame);
  }, []);

  useEffect(() => {
    document.body.classList.toggle("game-open", Boolean(selectedId));
    return () => document.body.classList.remove("game-open");
  }, [selectedId]);

  const selectedGame = useMemo(
    () => games.find((game) => game.id === selectedId) ?? null,
    [selectedId],
  );

  const closePlayer = () => {
    window.history.pushState(null, "", window.location.pathname);
    setSelectedId(null);
  };

  if (selectedGame) {
    return <GamePlayer game={selectedGame} onClose={closePlayer} />;
  }

  return (
    <main className="site-shell">
      <div className="ambient-grid" aria-hidden="true" />
      <header className="site-header">
        <a className="brand" href="#top" aria-label="WAXM 游戏实验室首页">
          <span className="brand-mark">W</span>
          <span>
            <strong>WAXM</strong>
            <small>PLAYGROUND</small>
          </span>
        </a>
        <nav aria-label="主导航">
          <a href="#games">游戏</a>
          <a href="https://github.com/waxm" target="_blank" rel="noreferrer">
            GitHub ↗
          </a>
        </nav>
      </header>

      <section className="hero" id="top">
        <div className="hero-kicker">
          <span />
          INDEPENDENT GAME LAB · 2026
        </div>
        <h1>
          把小游戏，
          <br />
          放进同一个<span>宇宙。</span>
        </h1>
        <div className="hero-bottom">
          <p>
            这里收录我的游戏实验、交互原型和可在线体验的作品。
            <br />
            选择一款游戏，直接开始。
          </p>
          <a href="#games">
            <span>探索游戏</span>
            <strong>↓</strong>
          </a>
        </div>
      </section>

      <section className="games-section" id="games">
        <div className="section-heading">
          <div>
            <p>SELECTED GAMES</p>
            <h2>当前作品</h2>
          </div>
          <span>02 / 持续更新</span>
        </div>
        <div className="game-grid">
          {games.map((game) => (
            <GameCard game={game} key={game.id} />
          ))}
        </div>
      </section>

      <section className="about-strip">
        <p>
          BUILT WITH
          <strong>COCOS CREATOR</strong>
        </p>
        <p>
          DESIGNED FOR
          <strong>WEB & MOBILE</strong>
        </p>
        <p>
          SOURCE ON
          <strong>GITHUB</strong>
        </p>
      </section>

      <footer>
        <p>© 2026 WAXM PLAYGROUND</p>
        <p>游戏、代码与一点点好奇心。</p>
      </footer>
    </main>
  );
}
