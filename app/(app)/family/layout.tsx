import type { ReactNode } from "react";

/**
 * Applies the "Ambient animations" preference (Settings > Appearance) to /family and
 * /family/[memberId] too -- see AmbientMotionEffect's doc comment for why this needs mounting
 * per top-level surface this task owns, rather than once in app/(app)/layout.tsx (out of this
 * task's touchable set).
 */
export default function FamilyLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
    </>
  );
}
