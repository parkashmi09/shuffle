/**
 * The loading body of a table — reference `TableSkeleton`.
 *
 * Ten rows of shimmering bars in place of the real ones, striped on the even
 * rows by `TableSkeleton_root`'s own rules. The reference varies the shape per
 * column rather than filling every cell identically: a cell that will hold a
 * coin mark or an avatar gets a circle before its bar, everything else gets the
 * bar alone. `cells` spells that out — `"r"` for a bar, `"cr"` for circle then
 * bar — so each table passes the pattern read off the live page.
 *
 * The classes and the 1.5s shimmer are already in the captured stylesheets;
 * `SkeletonPlaceholder_longAnimationRepeats` is the ten-repeat variant the
 * reference uses inside tables, so a slow read keeps moving rather than
 * freezing after five passes.
 *
 * @param {string[]} cells  One entry per column: `"r"` or `"cr"`.
 * @param {number} [rows]   Defaults to the reference's ten.
 */
export default function TableSkeleton({ cells, rows = 10 }) {
  return (
    <tbody className="TableSkeleton_root">
      {Array.from({ length: rows }).map((_, row) => (
        <tr key={row}>
          {cells.map((shape, column) => (
            <td key={column}>
              <div className="TableSkeleton_wrapper">
                {shape.includes("c") && (
                  <span className="SkeletonPlaceholder_root SkeletonPlaceholder_longAnimationRepeats TableSkeleton_circle" />
                )}
                <span className="SkeletonPlaceholder_root SkeletonPlaceholder_longAnimationRepeats TableSkeleton_rect" />
              </div>
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  );
}
