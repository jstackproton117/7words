import type { Player, Story } from "../game/types";
import { SKIPPED_TEXT } from "../game/mutations";

interface Props {
  story: Story;
  players: Player[];
  emptyMessage?: string;
  className?: string;
}

export function StoryBody({ story, players, emptyMessage, className }: Props) {
  if (story.contributions.length === 0) {
    return (
      <p className={`text-stone-500 italic text-lg ${className ?? ""}`}>
        {emptyMessage ?? "Nothing here yet."}
      </p>
    );
  }
  return (
    <p className={`text-xl leading-relaxed ${className ?? ""}`}>
      {story.contributions.map((c, i) => {
        if (c.text === SKIPPED_TEXT) {
          return (
            <span key={i} className="text-stone-400 italic text-base">
              {i > 0 ? " " : ""}
              (skipped)
            </span>
          );
        }
        const author = players.find((p) => p.id === c.playerId);
        const color = author?.color ?? "#1c1917";
        return (
          <span key={i} style={{ color }}>
            {i > 0 ? " " : ""}
            {c.text}
          </span>
        );
      })}
    </p>
  );
}
