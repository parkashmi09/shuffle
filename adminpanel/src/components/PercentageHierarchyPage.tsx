import React, { useEffect, useState } from "react";
import { Box, Typography, Paper, Skeleton, Chip } from "@mui/material";
import { apiFetch, buildPath } from "../utils/api";
import { ENDPOINTS } from "../services/endpoints";
import { roleKey } from "../constants/permissions";
import { GitBranch } from "lucide-react";

interface Node {
  id: number;
  name: string;
  role: string | null;
  percentage: number;
  parent_id: number | null;
  depth: number;
}

/**
 * One entry per row of the `roles` table. `Super Master` and `Executive` were
 * missing, and they are 7 of the 18 accounts in this hierarchy — every one of
 * them rendered in the grey fallback.
 */
const ROLE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  SuperAdmin:  { bg: "rgba(224,27,79,0.15)",  border: "#E01B4F", text: "#E01B4F" },
  Admin:       { bg: "rgba(136,108,255,0.15)", border: "#886CFF", text: "#886CFF" },
  SubAdmin:    { bg: "rgba(123,94,245,0.15)", border: "#7B5EF5", text: "#7B5EF5" },
  SuperMaster: { bg: "rgba(85,129,247,0.15)", border: "#A08FFF", text: "#A08FFF" },
  Master:      { bg: "rgba(255,194,63,0.15)", border: "#FFC23F", text: "#FFC23F" },
  Agent:       { bg: "rgba(14,204,104,0.15)", border: "#0ECC68", text: "#0ECC68" },
  SubAgent:    { bg: "rgba(0,191,165,0.15)",  border: "#00BFA5", text: "#00BFA5" },
  Executive:   { bg: "rgba(131,132,165,0.15)", border: "#8384A5", text: "#8384A5" },
  User:        { bg: "rgba(30,45,85,0.35)",   border: "#1E2D55", text: "#8384A5" },
};

/**
 * Looked up by NORMALISED name — see `roleKey`. The API closes the name up,
 * but going through `roleKey` means a spaced `Super Master` off an older
 * build still finds its colour instead of falling through to grey.
 */
const ROLE_COLORS_BY_KEY = Object.fromEntries(
  Object.entries(ROLE_COLORS).map(([name, colors]) => [roleKey(name), colors])
);

export default function PercentageHierarchyPage() {
  const [tree, setTree] = useState<Node[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const me = Number(localStorage.getItem("currentUserId"));
        const subtree = await apiFetch<Node[]>(buildPath(ENDPOINTS.staff.percentTree, { staffId: me }));
        const chain   = await apiFetch<Node[]>(buildPath(ENDPOINTS.staff.percentChain, { staffId: me }));
        // chain: depth 0 = me, 1 = parent, 2 = grandparent, ... (ordered DESC by API)
        // subtree: depth 0 = me, 1 = children, 2 = grandchildren, ...
        // Keep every ancestor (full upline) and flip their depth sign so FlowNode
        // can tell ancestors (negative) from descendants (non-negative).
        const ancestors: Node[] = chain
          .filter(n => n.depth >= 1)
          .map(n => ({ ...n, depth: -n.depth }));
        setTree([...ancestors, ...subtree]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <Box sx={{ p: 4, maxWidth: 1200, mx: "auto" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 3 }}>
          <Skeleton variant="circular" width={40} height={40} sx={{ bgcolor: "#1E2D55" }} />
          <Skeleton width={200} height={32} sx={{ bgcolor: "#1E2D55" }} />
        </Box>
        <Box sx={{ display: "flex", justifyContent: "center", gap: 3 }}>
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} variant="rectangular" width={160} height={70} sx={{ bgcolor: "#1E2D55", borderRadius: 2 }} />
          ))}
        </Box>
      </Box>
    );
  }

  const idSet = new Set(tree.map(n => n.id));
  const byParent: Record<number | "root", Node[]> = { root: [] };
  tree.forEach(n => {
    const key = n?.parent_id == null || !idSet.has(n?.parent_id) ? "root" : n?.parent_id;
    byParent[key] = byParent[key] || [];
    byParent[key].push(n);
  });

  const FlowNode: React.FC<{ node: Node; isRoot?: boolean }> = ({ node, isRoot }) => {
    const kids = byParent[node.id] || [];
    // Show upline (depth < 0), me (0) and first level of downline (1) expanded.
    // From depth 2 downward, collapse by default — click to reveal deeper downline.
    const [open, setOpen] = useState(node.depth < 2);
    const colors = ROLE_COLORS_BY_KEY[roleKey(node.role ?? "")] || ROLE_COLORS.User;

    return (
      <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        {/* Node card */}
        <Paper
          onClick={() => kids.length && setOpen(!open)}
          elevation={0}
          sx={{
            bgcolor: colors.bg,
            border: `1.5px solid ${colors.border}`,
            borderRadius: 2,
            px: 2,
            py: 1.25,
            minWidth: 160,
            textAlign: "center",
            cursor: kids.length ? "pointer" : "default",
            transition: "all 200ms",
            "&:hover": kids.length ? {
              bgcolor: colors.bg.replace("0.15", "0.25"),
              boxShadow: `0 0 12px ${colors.border}44`,
            } : {},
            position: "relative",
          }}
        >
          <Typography sx={{ color: "#F9F9F9", fontWeight: 600, fontSize: "0.82rem", mb: 0.25, lineHeight: 1.2 }}>
            {node.name}
          </Typography>
          <Chip
            label={node.role}
            size="small"
            sx={{
              height: 18,
              fontSize: "0.62rem",
              bgcolor: "transparent",
              color: colors.text,
              border: `1px solid ${colors.border}`,
              fontWeight: 600,
            }}
          />
          {isRoot && (
            <Typography sx={{ fontSize: "0.6rem", color: "#8384A5", mt: 0.25 }}>root</Typography>
          )}
          {kids.length > 0 && (
            <Box
              sx={{
                position: "absolute",
                top: 4,
                right: 6,
                width: 6,
                height: 6,
                borderRadius: "50%",
                bgcolor: open ? colors.border : "#1E2D55",
                transition: "background 200ms",
              }}
            />
          )}
        </Paper>

        {/* Connector line down */}
        {kids.length > 0 && open && (
          <Box sx={{ width: 2, height: 24, bgcolor: "#1E2D55" }} />
        )}

        {/* Children */}
        {kids.length > 0 && open && (
          <Box sx={{ position: "relative" }}>
            {/* Horizontal connector bar */}
            {kids.length > 1 && (
              <Box
                sx={{
                  position: "absolute",
                  top: 0,
                  left: "10%",
                  width: "80%",
                  height: 2,
                  bgcolor: "#1E2D55",
                }}
              />
            )}
            <Box sx={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 4, pt: "2px" }}>
              {kids.map(c => (
                <Box key={c.id} sx={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                  {/* Vertical line + % badge */}
                  <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <Box sx={{ width: 2, height: 16, bgcolor: "#1E2D55" }} />
                    <Box
                      sx={{
                        bgcolor: "#0E1831",
                        border: "1px solid #1E2D55",
                        borderRadius: 1,
                        px: 0.75,
                        py: 0.25,
                        mb: 0.75,
                      }}
                    >
                      <Typography sx={{ fontSize: "0.6rem", color: "#8384A5", fontWeight: 700, whiteSpace: "nowrap" }}>
                        {c.percentage}%
                      </Typography>
                    </Box>
                  </Box>
                  <FlowNode node={c} />
                </Box>
              ))}
            </Box>
          </Box>
        )}
      </Box>
    );
  };

  return (
    <Box sx={{ p: 3, maxWidth: 1400, mx: "auto" }}>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 3 }}>
        <Box sx={{ p: 1, bgcolor: "rgba(136,108,255,0.15)", borderRadius: 2, display: "flex" }}>
          <GitBranch size={22} color="#886CFF" />
        </Box>
        <Box>
          <Typography variant="h5" sx={{ color: "#F9F9F9", fontWeight: 700 }}>
            Percentage Hierarchy
          </Typography>
          <Typography variant="caption" sx={{ color: "#8384A5" }}>
            Profit-share tree — click any node to collapse
          </Typography>
        </Box>
      </Box>

      {/* Legend */}
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mb: 3 }}>
        {Object.entries(ROLE_COLORS).map(([role, c]) => (
          <Chip
            key={role}
            label={role}
            size="small"
            sx={{
              bgcolor: c.bg,
              color: c.text,
              border: `1px solid ${c.border}`,
              fontSize: "0.7rem",
              fontWeight: 600,
            }}
          />
        ))}
      </Box>

      {/* Tree canvas */}
      <Paper
        elevation={0}
        sx={{
          bgcolor: "#0B1427",
          border: "1px solid #1E2D55",
          borderRadius: 3,
          p: 4,
          overflowX: "auto",
          overflowY: "auto",
          minHeight: 200,
        }}
      >
        {(byParent.root || []).length === 0 ? (
          <Box sx={{ textAlign: "center", py: 6 }}>
            <GitBranch size={40} color="#1E2D55" />
            <Typography sx={{ color: "#8384A5", mt: 1 }}>No hierarchy data found.</Typography>
          </Box>
        ) : (
          <Box sx={{ display: "flex", justifyContent: "center", gap: 6 }}>
            {(byParent.root || []).map(r => (
              <FlowNode key={r.id} node={r} isRoot />
            ))}
          </Box>
        )}
      </Paper>
    </Box>
  );
}
