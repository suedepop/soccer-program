import { MARK_BOLD, MARK_ITALIC, MARK_UNDERLINE, parseRich } from '@/lib/richtext';

/**
 * Renders ad copy with its inline bold / italic / underline marks.
 *
 * The parser emits plain runs and this emits styled spans — markup never
 * reaches the DOM as markup, so there is no HTML to sanitise.
 */
export default function RichText({
  source,
  boldWeight = 700,
}: {
  source: string;
  /** Families without a true bold get a lighter nominal weight. */
  boldWeight?: number;
}) {
  const runs = parseRich(source);
  if (!runs.length) return null;

  return (
    <>
      {runs.map((run, i) =>
        run.marks === 0 ? (
          <span key={i}>{run.text}</span>
        ) : (
          <span
            key={i}
            style={{
              fontWeight: run.marks & MARK_BOLD ? boldWeight : undefined,
              fontStyle: run.marks & MARK_ITALIC ? 'italic' : undefined,
              textDecoration: run.marks & MARK_UNDERLINE ? 'underline' : undefined,
              textUnderlineOffset: run.marks & MARK_UNDERLINE ? '0.14em' : undefined,
            }}
          >
            {run.text}
          </span>
        )
      )}
    </>
  );
}
